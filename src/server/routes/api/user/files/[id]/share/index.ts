import { ApiError } from '@/lib/api/errors';
import { config } from '@/lib/config';
import { hashPassword } from '@/lib/crypto';
import { db } from '@/lib/db';
import { files, fileShares, users } from '@/lib/db/schema';
import { log } from '@/lib/logger';
import { randomCharacters } from '@/lib/random';
import { canInteract } from '@/lib/role';
import { formatRootUrl } from '@/lib/url';
import { userMiddleware } from '@/server/middleware/user';
import typedPlugin from '@/server/typedPlugin';
import { eq, or, desc } from 'drizzle-orm';
import z from 'zod';

export type ApiUserFilesIdShareResponse = {
  share: {
    id: string;
    token: string;
    expiresAt: string | null;
    maxViews: number | null;
    views: number;
    createdAt: string;
  };
  url: string;
};

const logger = log('api').c('user').c('files').c('[id]').c('share');

const shareOutputSchema = z.object({
  id: z.string(),
  token: z.string(),
  expiresAt: z.union([z.date(), z.string()]).nullable(),
  maxViews: z.number().nullable(),
  views: z.number(),
  createdAt: z.union([z.date(), z.string()]),
});

export const PATH = '/api/user/files/:id/share';
export default typedPlugin(
  async (server) => {
    server.get(
      PATH,
      {
        schema: {
          description: 'List active share links for a file owned by the authenticated user.',
          params: z.object({ id: z.string() }),
          response: {
            200: z.object({
              shares: z.array(shareOutputSchema),
            }),
          },
          tags: ['auth'],
        },
        preHandler: [userMiddleware],
      },
      async (req, res) => {
        const [file] = await db
          .select()
          .from(files)
          .leftJoin(users, eq(users.id, files.userId))
          .where(or(eq(files.id, req.params.id), eq(files.name, req.params.id)))
          .limit(1);

        if (!file) throw new ApiError(4000);
        if (file.File.userId !== req.user.id && !canInteract(req.user.role, file.User?.role ?? 'USER'))
          throw new ApiError(4000);

        const shares = await db
          .select({
            id: fileShares.id,
            token: fileShares.token,
            expiresAt: fileShares.expiresAt,
            maxViews: fileShares.maxViews,
            views: fileShares.views,
            createdAt: fileShares.createdAt,
          })
          .from(fileShares)
          .where(eq(fileShares.fileId, file.File.id))
          .orderBy(desc(fileShares.createdAt));

        return res.send({ shares });
      },
    );

    server.post(
      PATH,
      {
        schema: {
          description: 'Create a share link for a file owned by the authenticated user.',
          params: z.object({ id: z.string() }),
          body: z
            .object({
              expiresAt: z.union([z.date(), z.string()]).nullable().optional(),
              maxViews: z.number().min(1).nullable().optional(),
              password: z.string().min(1).nullable().optional(),
            })
            .optional(),
          response: {
            200: z.object({
              share: shareOutputSchema,
              url: z.string(),
            }),
          },
          tags: ['auth'],
        },
        preHandler: [userMiddleware],
      },
      async (req, res) => {
        const [file] = await db
          .select()
          .from(files)
          .leftJoin(users, eq(users.id, files.userId))
          .where(or(eq(files.id, req.params.id), eq(files.name, req.params.id)))
          .limit(1);

        if (!file) throw new ApiError(4000);
        if (file.File.userId !== req.user.id && !canInteract(req.user.role, file.User?.role ?? 'USER'))
          throw new ApiError(4000);

        const { expiresAt, maxViews, password } = req.body ?? {};

        let token: string;
        let existing: { id: string } | undefined;
        do {
          token = randomCharacters(24);
          [existing] = await db
            .select({ id: fileShares.id })
            .from(fileShares)
            .where(eq(fileShares.token, token))
            .limit(1);
        } while (existing);

        const parsedExpiresAt =
          expiresAt === undefined || expiresAt === null ? undefined : new Date(expiresAt);

        const [share] = await db
          .insert(fileShares)
          .values({
            token,
            fileId: file.File.id,
            ...(parsedExpiresAt && { expiresAt: parsedExpiresAt }),
            ...(maxViews !== undefined && { maxViews }),
            ...(password && { password: await hashPassword(password) }),
          })
          .returning({
            id: fileShares.id,
            token: fileShares.token,
            expiresAt: fileShares.expiresAt,
            maxViews: fileShares.maxViews,
            views: fileShares.views,
            createdAt: fileShares.createdAt,
          });

        const host = `${config.core.returnHttpsUrls ? 'https' : 'http'}://${req.headers.host ?? 'localhost'}`;
        const url = `${host}${formatRootUrl(config.files.route, file.File.name)}?share=${encodeURIComponent(token)}`;

        logger.info(`${req.user.username} created share for file ${file.File.name}`, {
          file: file.File.id,
          share: share.id,
        });

        return res.send({ share, url });
      },
    );
  },
  { name: PATH },
);
