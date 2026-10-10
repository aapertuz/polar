CREATE TABLE "workspace_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"default_workspace_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace" DROP CONSTRAINT "workspace_owner_user_id_unique";--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "privacy" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_preference" ADD CONSTRAINT "workspace_preference_user_id_polar_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."polar_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_preference" ADD CONSTRAINT "workspace_preference_default_workspace_id_workspace_id_fk" FOREIGN KEY ("default_workspace_id") REFERENCES "public"."workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_privacy_check" CHECK ("workspace"."privacy" in ('private', 'shared'));--> statement-breakpoint
UPDATE "workspace" AS target
SET "privacy" = 'shared'
WHERE EXISTS (
  SELECT 1
  FROM "workspace_membership" AS member
  WHERE member."workspace_id" = target."id"
    AND member."role" = 'member'
);--> statement-breakpoint
INSERT INTO "workspace_preference" ("user_id", "default_workspace_id")
SELECT owner_membership."user_id", target."id"
FROM "workspace" AS target
INNER JOIN "workspace_membership" AS owner_membership
  ON owner_membership."workspace_id" = target."id"
  AND owner_membership."user_id" = target."owner_user_id"
  AND owner_membership."role" = 'owner'
ON CONFLICT ("user_id") DO NOTHING;--> statement-breakpoint
CREATE FUNCTION polar_enforce_workspace_membership_privacy() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  current_privacy text;
  current_owner text;
BEGIN
  SELECT "privacy", "owner_user_id"
  INTO current_privacy, current_owner
  FROM "workspace"
  WHERE "id" = NEW."workspace_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace does not exist' USING ERRCODE = '23503';
  END IF;
  IF NEW."role" = 'owner' AND NEW."user_id" <> current_owner THEN
    RAISE EXCEPTION 'workspace owner membership must match its owner' USING ERRCODE = '23514';
  END IF;
  IF NEW."role" = 'member' AND current_privacy = 'private' THEN
    RAISE EXCEPTION 'private workspaces cannot have members' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "workspace_membership_privacy_guard"
BEFORE INSERT OR UPDATE OF "workspace_id", "user_id", "role"
ON "workspace_membership"
FOR EACH ROW EXECUTE FUNCTION polar_enforce_workspace_membership_privacy();--> statement-breakpoint
CREATE FUNCTION polar_reject_private_workspace_with_members() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."privacy" = 'private' AND EXISTS (
    SELECT 1
    FROM "workspace_membership" AS member
    WHERE member."workspace_id" = NEW."id"
      AND member."role" = 'member'
  ) THEN
    RAISE EXCEPTION 'workspace has other members' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "workspace_privacy_members_guard"
BEFORE UPDATE OF "privacy"
ON "workspace"
FOR EACH ROW EXECUTE FUNCTION polar_reject_private_workspace_with_members();--> statement-breakpoint
CREATE FUNCTION polar_enforce_workspace_default_membership() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."default_workspace_id" IS NOT NULL THEN
    PERFORM 1
    FROM "workspace_membership" AS member
    WHERE member."workspace_id" = NEW."default_workspace_id"
      AND member."user_id" = NEW."user_id"
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'default workspace must be accessible to the account' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "workspace_default_membership_guard"
BEFORE INSERT OR UPDATE OF "default_workspace_id", "user_id"
ON "workspace_preference"
FOR EACH ROW EXECUTE FUNCTION polar_enforce_workspace_default_membership();--> statement-breakpoint
CREATE FUNCTION polar_clear_revoked_workspace_default() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "workspace_preference"
  SET "default_workspace_id" = NULL, "updated_at" = now()
  WHERE "user_id" = OLD."user_id"
    AND "default_workspace_id" = OLD."workspace_id";
  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "workspace_membership_default_clear"
AFTER DELETE ON "workspace_membership"
FOR EACH ROW EXECUTE FUNCTION polar_clear_revoked_workspace_default();
