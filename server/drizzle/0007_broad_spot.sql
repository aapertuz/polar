CREATE TABLE "action_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"action_id" text NOT NULL,
	"submitted_by" text,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"reference_url" text,
	"evaluation" text DEFAULT 'pending' NOT NULL,
	"evaluation_reason" text,
	"idempotency_key" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_follow_up" (
	"id" text PRIMARY KEY NOT NULL,
	"action_id" text NOT NULL,
	"kind" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "action_message" (
	"id" text PRIMARY KEY NOT NULL,
	"action_id" text NOT NULL,
	"author_user_id" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"conclusion" boolean DEFAULT false NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_assessment" (
	"mission_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"reason" text NOT NULL,
	"next_action_id" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_plan_change" (
	"id" text PRIMARY KEY NOT NULL,
	"mission_id" text NOT NULL,
	"requested_by" text,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"expected_revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "mission_action" ADD COLUMN "completion_criteria" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "mission_action" ADD COLUMN "evidence_status" text DEFAULT 'awaiting_evidence' NOT NULL;--> statement-breakpoint
ALTER TABLE "mission_action" ADD COLUMN "evidence_reason" text;--> statement-breakpoint
ALTER TABLE "mission_action" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
UPDATE "mission_action" SET "completion_criteria" = "detail" WHERE "completion_criteria" = '';--> statement-breakpoint
UPDATE "mission_action" SET "evidence_status" = 'accepted', "evidence_reason" = 'This action was completed before evidence tracking was introduced; its historical completion is preserved.' WHERE "status" = 'completed';--> statement-breakpoint
ALTER TABLE "action_evidence" ADD CONSTRAINT "action_evidence_action_id_mission_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."mission_action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_evidence" ADD CONSTRAINT "action_evidence_submitted_by_polar_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."polar_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_follow_up" ADD CONSTRAINT "action_follow_up_action_id_mission_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."mission_action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_message" ADD CONSTRAINT "action_message_action_id_mission_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."mission_action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_message" ADD CONSTRAINT "action_message_author_user_id_polar_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."polar_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_assessment" ADD CONSTRAINT "mission_assessment_mission_id_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_assessment" ADD CONSTRAINT "mission_assessment_next_action_id_mission_action_id_fk" FOREIGN KEY ("next_action_id") REFERENCES "public"."mission_action"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_plan_change" ADD CONSTRAINT "mission_plan_change_mission_id_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_plan_change" ADD CONSTRAINT "mission_plan_change_requested_by_polar_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."polar_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_evidence_action_idempotency_uq" ON "action_evidence" USING btree ("action_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "action_evidence_action_created_idx" ON "action_evidence" USING btree ("action_id","created_at");--> statement-breakpoint
CREATE INDEX "action_follow_up_due_idx" ON "action_follow_up" USING btree ("status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "action_message_action_idempotency_uq" ON "action_message" USING btree ("action_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "action_message_action_created_idx" ON "action_message" USING btree ("action_id","created_at");--> statement-breakpoint
CREATE INDEX "mission_plan_change_mission_status_idx" ON "mission_plan_change" USING btree ("mission_id","status");
