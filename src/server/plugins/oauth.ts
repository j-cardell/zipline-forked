import { ApiError } from '@/lib/api/errors';
import { config } from '@/lib/config';
import { createToken } from '@/lib/crypto';
import { db } from '@/lib/db';
import { type OAuthProviderType } from '@/lib/db/enums';
import { createUser, getUser, getUserBySession } from '@/lib/db/models/user';
import { oauthProviders, users } from '@/lib/db/schema';
import { isPostgresError } from '@/lib/db/utils';
import Logger, { log } from '@/lib/logger';
import { parseOAuthState } from '@/lib/oauth/state';
import { and, eq } from 'drizzle-orm';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { z } from 'zod';
import { getSession, saveSession, ZiplineIronSession } from '../session';

export type OAuthQuery = {
  state?: string;
  code: string;
  host: string;
  session: ZiplineIronSession;
  pkceVerifier?: string;
};

export type OAuthResponse = {
  username: string;
  user_id: string;
  access_token: string;
  id_token?: string;
  refresh_token?: string | null;
  avatar?: string | null;
};

const oauthQuerySchema = z.object({
  state: z.string().optional(),
  code: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

function safeOAuthResponse(response: OAuthResponse) {
  return {
    ...response,
    access_token: '[redacted]',
    ...(response.id_token !== undefined && { id_token: '[redacted]' }),
    ...(response.refresh_token !== undefined && {
      refresh_token: response.refresh_token ? '[redacted]' : response.refresh_token,
    }),
  };
}

async function oauthPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('oauthHandle', oauthHandle);

  async function oauthHandle(
    this: FastifyRequest,
    reply: FastifyReply,
    provider: OAuthProviderType,
    handler: (query: OAuthQuery, logger: Logger) => Promise<OAuthResponse>,
  ) {
    const logger = log('api').c('auth').c('oauth').c(provider.toLowerCase());
    const session = await getSession(this, reply);

    const parsedQuery = oauthQuerySchema.safeParse(this.query);
    if (!parsedQuery.success) throw new ApiError(1000);
    const q = parsedQuery.data;
    const query: OAuthQuery = {
      state: q.state,
      code: q.code ?? '',
      host: this.host,
      session,
    };

    if (!q.code && !q.error) {
      if (q.state && q.state !== 'link' && q.state !== 'default') throw new ApiError(1064);

      if (q.state === 'link') {
        if (!session.sessionId || !(await getUserBySession(session.sessionId))) throw new ApiError(2000);
        session.oauthSessionId = session.sessionId;
      } else {
        delete session.oauthSessionId;
      }

      session.oauthProvider = provider;
      delete session.pkceVerifier;

      await handler(query, logger);
      throw new ApiError(6008);
    }

    const state = parseOAuthState(query.state);
    if (
      !state?.nonce ||
      state.nonce !== session.oauthState ||
      (session.oauthProvider && session.oauthProvider !== provider) ||
      (state.mode === 'link' && session.oauthSessionId && session.oauthSessionId !== session.sessionId)
    ) {
      logger.warn('invalid oauth state', {
        provider,
        ua: this.headers['user-agent'],
      });

      throw new ApiError(1064);
    }

    query.pkceVerifier = session.pkceVerifier;
    delete session.oauthState;
    delete session.oauthProvider;
    delete session.oauthSessionId;
    delete session.pkceVerifier;
    await session.save();

    if (q.error) throw new ApiError(6008, 'OAuth authorization was denied or failed.', 400);

    const user =
      state.mode === 'link' && session.sessionId ? await getUserBySession(session.sessionId) : null;
    if (state.mode === 'link' && !user) throw new ApiError(2000);

    const response = await handler(query, logger);

    logger.debug('oauth response', {
      response: safeOAuthResponse(response),
    });

    const [existingOauth] = await db
      .select({ id: oauthProviders.id, userId: oauthProviders.userId })
      .from(oauthProviders)
      .where(and(eq(oauthProviders.provider, provider), eq(oauthProviders.oauthId, response.user_id)))
      .limit(1);

    if (user) {
      if (existingOauth) throw new ApiError(1063);
      const userId = user.id;

      logger.debug('attempting to link oauth account', {
        provider,
        user: user.id,
      });

      try {
        await db.transaction(async (tx) => {
          const [currentUser] = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, userId))
            .for('update');
          if (!currentUser) throw new ApiError(2000);

          const [linked] = await tx
            .select({ id: oauthProviders.id })
            .from(oauthProviders)
            .where(and(eq(oauthProviders.userId, userId), eq(oauthProviders.provider, provider)))
            .limit(1);
          if (linked) throw new ApiError(1063);

          const [createdProvider] = await tx
            .insert(oauthProviders)
            .values({
              userId,
              provider,
              accessToken: response.access_token,
              refreshToken: response.refresh_token,
              username: response.username,
              oauthId: response.user_id,
            })
            .returning({ id: oauthProviders.id });
          if (!createdProvider) throw new ApiError(9005);
        });

        await saveSession(session, user, false);

        logger.info('linked oauth account', {
          provider,
          user: user.id,
        });

        return reply.redirect('/dashboard/settings');
      } catch (e) {
        logger.error('failed to link oauth account', {
          provider,
          user: user.id,
        });

        if (e instanceof ApiError) throw e;
        if (isPostgresError(e, '23505')) throw new ApiError(1063);
        throw new ApiError(9005);
      }
    } else if (existingOauth) {
      const loginUser = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(oauthProviders)
          .set({
            accessToken: response.access_token,
            refreshToken: response.refresh_token ?? undefined,
            username: response.username,
          })
          .where(eq(oauthProviders.id, existingOauth.id))
          .returning({ id: oauthProviders.id });
        if (!updated) throw new ApiError(9005);

        return getUser(existingOauth.userId, tx);
      });
      if (!loginUser) throw new ApiError(2001);

      session.sessionId = null;

      await saveSession(session, loginUser, false, { provider, idToken: response.id_token });

      logger.info('logged in with oauth', {
        provider,
        user: loginUser.id,
      });

      return reply.redirect('/dashboard');
    } else if (config.oauth.loginOnly) {
      logger.warn('user tried to create account with oauth, but login only is enabled', {
        oauth: response.username || 'unknown',
        ua: this.headers['user-agent'],
      });

      throw new ApiError(6009);
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, response.username))
      .limit(1);
    if (existingUser) throw new ApiError(6010);

    try {
      const nuser = await db.transaction(async (tx) => {
        const created = await createUser(
          {
            username: response.username!,
            token: createToken(),
            avatar: response.avatar ?? null,
          },
          tx,
        );

        const [createdProvider] = await tx
          .insert(oauthProviders)
          .values({
            userId: created.id,
            provider,
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            username: response.username,
            oauthId: response.user_id,
          })
          .returning({ id: oauthProviders.id });
        if (!createdProvider) throw new ApiError(9005);

        return created;
      });

      await saveSession(session, nuser, false, { provider, idToken: response.id_token });

      logger.info('created user with oauth', {
        provider,
        user: nuser.id,
      });

      return reply.redirect('/dashboard');
    } catch (e) {
      if (isPostgresError(e, '23505')) {
        // The unique constraint closes the race between the provider lookup and account creation.
        logger.warn('user tried to create account with oauth, but already linked', {
          oauth: response.username || 'unknown',
          ua: this.headers['user-agent'],
        });
        logger.debug('oauth create error', {
          response: safeOAuthResponse(response),
        });

        throw new ApiError(1063);
      } else throw e;
    }
  }
}

export default fastifyPlugin(oauthPlugin, {
  name: 'oauth',
  fastify: '5.x',
});

declare module 'fastify' {
  interface FastifyRequest {
    oauthHandle: (
      reply: FastifyReply,
      provider: OAuthProviderType,
      handler: (query: OAuthQuery, logger: Logger) => Promise<OAuthResponse>,
    ) => void;
  }
}
