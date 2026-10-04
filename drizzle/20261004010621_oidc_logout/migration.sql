ALTER TABLE "UserSession" ADD COLUMN "oauthProvider" "OAuthProviderType";--> statement-breakpoint
ALTER TABLE "UserSession" ADD COLUMN "oidcIdToken" text;--> statement-breakpoint
ALTER TABLE "Zipline" ADD COLUMN "oauthOidcEndSessionUrl" text;