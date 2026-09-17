const ALLOWED_OAUTH = ["google", "github", "azure"] as const;

export type OAuthProvider = (typeof ALLOWED_OAUTH)[number];

export type UserAuthMethods = {
  hasPassword: boolean;
  oauthProviders: OAuthProvider[];
};

type IdentityLike = { provider?: string | null };

export function resolveUserAuthMethods(identities: IdentityLike[] | undefined): UserAuthMethods {
  const providers = (identities ?? [])
    .map((identity) => identity.provider?.trim().toLowerCase())
    .filter((provider): provider is string => Boolean(provider));

  const hasPassword = providers.includes("email");
  const oauthProviders = ALLOWED_OAUTH.filter((provider) => providers.includes(provider));

  return { hasPassword, oauthProviders };
}
