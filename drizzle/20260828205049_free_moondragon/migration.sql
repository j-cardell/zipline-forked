CREATE TABLE "FileShare" (
	"id" text,
	"createdAt" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) with time zone NOT NULL,
	"token" text NOT NULL,
	"fileId" text NOT NULL,
	"expiresAt" timestamp(3) with time zone,
	"maxViews" integer,
	"views" integer DEFAULT 0 NOT NULL,
	"password" text,
	CONSTRAINT "file_share_pkey" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "file_share_token_key" ON "FileShare" ("token");--> statement-breakpoint
CREATE INDEX "file_share_file_id_idx" ON "FileShare" ("fileId");--> statement-breakpoint
CREATE INDEX "file_share_token_idx" ON "FileShare" ("token");--> statement-breakpoint
ALTER TABLE "FileShare" ADD CONSTRAINT "file_share_file_id_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;