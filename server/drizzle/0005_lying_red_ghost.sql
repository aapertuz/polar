CREATE TABLE "mission_action_context" (
	"action_id" text NOT NULL,
	"source_id" text NOT NULL,
	CONSTRAINT "mission_action_context_action_id_source_id_pk" PRIMARY KEY("action_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "mission_action_member" (
	"action_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "mission_action_member_action_id_user_id_pk" PRIMARY KEY("action_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "mission_action" ADD COLUMN "due_on" date;--> statement-breakpoint
ALTER TABLE "mission_action_context" ADD CONSTRAINT "mission_action_context_action_id_mission_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."mission_action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_action_member" ADD CONSTRAINT "mission_action_member_action_id_mission_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."mission_action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_action_member" ADD CONSTRAINT "mission_action_member_user_id_polar_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."polar_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "mission_action" AS action
SET "due_on" = NULLIF(action_json.value ->> 'dueOn', '')::date
FROM "mission" AS saved
CROSS JOIN LATERAL jsonb_array_elements(saved.content -> 'checkpoints') AS checkpoint(value)
CROSS JOIN LATERAL jsonb_array_elements(checkpoint.value -> 'actions') AS action_json(value)
WHERE saved.id = action.mission_id
	AND checkpoint.value ->> 'name' = action.checkpoint_name
	AND action_json.value ->> 'title' = action.title;--> statement-breakpoint
INSERT INTO "mission_action_member" ("action_id", "user_id")
SELECT action.id, saved.owner_user_id
FROM "mission_action" AS action
JOIN "mission" AS saved ON saved.id = action.mission_id;--> statement-breakpoint
INSERT INTO "mission_action_context" ("action_id", "source_id")
SELECT DISTINCT action.id, source_reference.value ->> 'id'
FROM "mission_action" AS action
JOIN "mission" AS saved ON saved.id = action.mission_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(saved.content -> 'sourceReferences', '[]'::jsonb)) AS source_reference(value)
WHERE source_reference.value ->> 'id' IS NOT NULL;
