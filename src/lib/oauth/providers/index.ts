import type { OAuthProviderType } from '@/lib/db/enums';

export function findProvider<T extends { provider: OAuthProviderType }>(
  provider: OAuthProviderType,
  providers: T[],
): T | undefined {
  return providers.find((p) => p.provider === provider);
}

export async function fetchUserInfo({ userInfoUrl, accessToken }: OAuthUserInfoOptions): Promise<any | null> {
  try {
    const res = await fetch(userInfoUrl!, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    if (!res.ok) return null;

    const json = await res.json();
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null;

    return json;
  } catch {
    return null;
  }
}

export type OAuthOptions = {
  clientId: string;
  origin: string;
  state?: string;
  redirectUri?: string | null;

  authorizeUrl?: string;

  codeChallenge?: string;
};

export type OAuthUserInfoOptions = {
  accessToken: string;
  userInfoUrl?: string;
};

export type OAuthLogoutOptions = {
  endSessionUrl: string;
  clientId: string;
  postLogoutRedirectUri: string;
  idToken?: string | null;
};

export { discordAuthorizeURL, discordUser } from './discord';
export { githubAuthorizeURL, githubUser } from './github';
export { googleAuthorizeURL, googleUser } from './google';
export { oidcAuthorizeURL, oidcLogoutURL, oidcUser } from './oidc';
