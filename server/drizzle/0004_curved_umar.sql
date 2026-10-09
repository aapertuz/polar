CREATE TABLE "workspace_context" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_context_source" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"file_name" text,
	"content_hash" text,
	"extracted_text" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "workspace_context_source_kind_check" CHECK ("workspace_context_source"."kind" in ('document', 'note'))
);
--> statement-breakpoint
ALTER TABLE "mission_proposal" ADD COLUMN "context_manifest" jsonb;--> statement-breakpoint
ALTER TABLE "mission_proposal" ADD COLUMN "citation_references" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reasoning_request" ADD COLUMN "context_manifest" jsonb;--> statement-breakpoint
ALTER TABLE "workspace_context" ADD CONSTRAINT "workspace_context_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_context_source" ADD CONSTRAINT "workspace_context_source_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_context_source" ADD CONSTRAINT "workspace_context_source_created_by_polar_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."polar_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_context_source" ADD CONSTRAINT "workspace_context_source_updated_by_polar_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."polar_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_context_source_active_idx" ON "workspace_context_source" USING btree ("workspace_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_context_source_hash_uq" ON "workspace_context_source" USING btree ("workspace_id","content_hash") WHERE "workspace_context_source"."archived_at" is null;