CREATE TABLE "attention_item" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"mission_id" text NOT NULL,
	"action_id" text NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_event" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mission_proposal_id_unique" UNIQUE("proposal_id")
);
--> statement-breakpoint
CREATE TABLE "mission_action" (
	"id" text PRIMARY KEY NOT NULL,
	"mission_id" text NOT NULL,
	"checkpoint_name" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"priority" text NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"goal" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"proposal_revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_message" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"revision" integer NOT NULL,
	"revision_hash" text NOT NULL,
	"content" jsonb NOT NULL,
	"status" text DEFAULT 'current' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_source" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"file_name" text NOT NULL,
	"content_hash" text NOT NULL,
	"extracted_text" text NOT NULL,
	"provenance" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"delivered_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reasoning_request" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attention_item" ADD CONSTRAINT "attention_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attention_item" ADD CONSTRAINT "attention_item_user_id_polar_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."polar_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attention_item" ADD CONSTRAINT "attention_item_mission_id_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attention_item" ADD CONSTRAINT "attention_item_action_id_mission_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."mission_action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_event" ADD CONSTRAINT "domain_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_event" ADD CONSTRAINT "domain_event_user_id_polar_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."polar_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission" ADD CONSTRAINT "mission_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission" ADD CONSTRAINT "mission_owner_user_id_polar_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."polar_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission" ADD CONSTRAINT "mission_proposal_id_mission_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."mission_proposal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_action" ADD CONSTRAINT "mission_action_mission_id_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_draft" ADD CONSTRAINT "mission_draft_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_draft" ADD CONSTRAINT "mission_draft_user_id_polar_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."polar_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_message" ADD CONSTRAINT "mission_message_draft_id_mission_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."mission_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_proposal" ADD CONSTRAINT "mission_proposal_draft_id_mission_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."mission_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_source" ADD CONSTRAINT "mission_source_draft_id_mission_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."mission_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reasoning_request" ADD CONSTRAINT "reasoning_request_draft_id_mission_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."mission_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reasoning_request" ADD CONSTRAINT "reasoning_request_user_id_polar_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."polar_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reasoning_request" ADD CONSTRAINT "reasoning_request_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_action_next_idx" ON "mission_action" USING btree ("mission_id","status","position");--> statement-breakpoint
CREATE INDEX "mission_message_draft_created_idx" ON "mission_message" USING btree ("draft_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mission_proposal_draft_revision_uq" ON "mission_proposal" USING btree ("draft_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "mission_source_draft_hash_uq" ON "mission_source" USING btree ("draft_id","content_hash");--> statement-breakpoint
CREATE INDEX "reasoning_request_workspace_status_idx" ON "reasoning_request" USING btree ("workspace_id","status","created_at");