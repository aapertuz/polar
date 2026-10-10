import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const timestampColumn = (name: string) => timestamp(name, { withTimezone: true });

export const authUser = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestampColumn("created_at").notNull().defaultNow(),
  updatedAt: timestampColumn("updated_at").notNull().defaultNow(),
});

export const authSession = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestampColumn("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestampColumn("created_at").notNull().defaultNow(),
    updatedAt: timestampColumn("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const authAccount = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestampColumn("access_token_expires_at"),
    refreshTokenExpiresAt: timestampColumn("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestampColumn("created_at").notNull().defaultNow(),
    updatedAt: timestampColumn("updated_at").notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const authVerification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestampColumn("expires_at").notNull(),
    createdAt: timestampColumn("created_at").defaultNow(),
    updatedAt: timestampColumn("updated_at").defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const authDeviceCode = pgTable(
  "device_code",
  {
    id: text("id").primaryKey(),
    deviceCode: text("device_code").notNull().unique(),
    userCode: varchar("user_code", { length: 191 }).notNull().unique(),
    userId: text("user_id").references(() => authUser.id, { onDelete: "cascade" }),
    clientId: text("client_id"),
    scope: text("scope"),
    status: text("status").notNull(),
    expiresAt: timestampColumn("expires_at").notNull(),
    lastPolledAt: timestampColumn("last_polled_at"),
    pollingInterval: integer("polling_interval"),
  },
  (table) => [index("device_code_user_id_idx").on(table.userId)],
);

export const polarUser = pgTable("polar_user", {
  id: text("id").primaryKey(),
  authUserId: text("auth_user_id")
    .notNull()
    .unique()
    .references(() => authUser.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestampColumn("created_at").notNull().defaultNow(),
});

export const workspace = pgTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .unique()
    .references(() => polarUser.id, { onDelete: "cascade" }),
  createdAt: timestampColumn("created_at").notNull().defaultNow(),
});

export const workspaceMembership = pgTable(
  "workspace_membership",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => polarUser.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestampColumn("created_at").notNull().defaultNow(),
  },
  (table) => [
    check("workspace_membership_role_check", sql`${table.role} in ('owner', 'member')`),
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("workspace_membership_user_id_idx").on(table.userId),
  ],
);

export const workspaceContext = pgTable("workspace_context", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspace.id, { onDelete: "cascade" }),
  brief: text("brief").notNull().default(""),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestampColumn("updated_at").notNull().defaultNow(),
});

export const workspaceContextSource = pgTable(
  "workspace_context_source",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    fileName: text("file_name"),
    contentHash: text("content_hash"),
    extractedText: text("extracted_text").notNull(),
    revision: integer("revision").notNull().default(1),
    createdBy: text("created_by")
      .notNull()
      .references(() => polarUser.id, { onDelete: "cascade" }),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => polarUser.id, { onDelete: "cascade" }),
    createdAt: timestampColumn("created_at").notNull().defaultNow(),
    updatedAt: timestampColumn("updated_at").notNull().defaultNow(),
    archivedAt: timestampColumn("archived_at"),
  },
  (table) => [
    index("workspace_context_source_active_idx").on(table.workspaceId, table.archivedAt),
    uniqueIndex("workspace_context_source_hash_uq")
      .on(table.workspaceId, table.contentHash)
      .where(sql`${table.archivedAt} is null`),
    check("workspace_context_source_kind_check", sql`${table.kind} in ('document', 'note')`),
  ],
);

export const registeredDevice = pgTable(
  "registered_device",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => polarUser.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    label: text("label").notNull(),
    createdAt: timestampColumn("created_at").notNull().defaultNow(),
    lastSeenAt: timestampColumn("last_seen_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("registered_device_user_device_uq").on(table.userId, table.deviceId),
    index("registered_device_user_id_idx").on(table.userId),
  ],
);

export const missionDraft = pgTable("mission_draft", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => polarUser.id, { onDelete: "cascade" }),
  goal: text("goal").notNull(),
  status: text("status").notNull().default("draft"),
  proposalRevision: integer("proposal_revision").notNull().default(0),
  createdAt: timestampColumn("created_at").notNull().defaultNow(),
  updatedAt: timestampColumn("updated_at").notNull().defaultNow(),
});

export const missionMessage = pgTable(
  "mission_message",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => missionDraft.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestampColumn("created_at").notNull().defaultNow(),
  },
  (table) => [index("mission_message_draft_created_idx").on(table.draftId, table.createdAt)],
);

export const missionSource = pgTable(
  "mission_source",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => missionDraft.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    contentHash: text("content_hash").notNull(),
    extractedText: text("extracted_text").notNull(),
    provenance: text("provenance").notNull(),
    createdAt: timestampColumn("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("mission_source_draft_hash_uq").on(table.draftId, table.contentHash)],
);

export const reasoningRequest = pgTable(
  "reasoning_request",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => missionDraft.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => polarUser.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    contextManifest: jsonb("context_manifest"),
    status: text("status").notNull().default("queued"),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestampColumn("lease_expires_at"),
    errorMessage: text("error_message"),
    createdAt: timestampColumn("created_at").notNull().defaultNow(),
    updatedAt: timestampColumn("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("reasoning_request_workspace_status_idx").on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const missionProposal = pgTable(
  "mission_proposal",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => missionDraft.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    revisionHash: text("revision_hash").notNull(),
    content: jsonb("content").notNull(),
    contextManifest: jsonb("context_manifest"),
    citationReferences: jsonb("citation_references").notNull().default([]),
    status: text("status").notNull().default("current"),
    createdAt: timestampColumn("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("mission_proposal_draft_revision_uq").on(table.draftId, table.revision)],
);

export const mission = pgTable("mission", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => polarUser.id, { onDelete: "cascade" }),
  proposalId: text("proposal_id")
    .notNull()
    .unique()
    .references(() => missionProposal.id),
  content: jsonb("content").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: timestampColumn("created_at").notNull().defaultNow(),
});

export const missionAction = pgTable(
  "mission_action",
  {
    id: text("id").primaryKey(),
    missionId: text("mission_id")
      .notNull()
      .references(() => mission.id, { onDelete: "cascade" }),
    checkpointName: text("checkpoint_name").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    priority: text("priority").notNull(),
    dependencies: jsonb("dependencies").notNull().default([]),
    position: integer("position").notNull(),
    status: text("status").notNull().default("upcoming"),
    dueOn: date("due_on", { mode: "string" }),
  },
  (table) => [index("mission_action_next_idx").on(table.missionId, table.status, table.position)],
);

export const missionActionMember = pgTable(
  "mission_action_member",
  {
    actionId: text("action_id")
      .notNull()
      .references(() => missionAction.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => polarUser.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.actionId, table.userId] })],
);

export const missionActionContext = pgTable(
  "mission_action_context",
  {
    actionId: text("action_id")
      .notNull()
      .references(() => missionAction.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.actionId, table.sourceId] })],
);

export const attentionItem = pgTable("attention_item", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => polarUser.id, { onDelete: "cascade" }),
  missionId: text("mission_id")
    .notNull()
    .references(() => mission.id, { onDelete: "cascade" }),
  actionId: text("action_id")
    .notNull()
    .references(() => missionAction.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestampColumn("created_at").notNull().defaultNow(),
});

export const domainEvent = pgTable("domain_event", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => polarUser.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestampColumn("created_at").notNull().defaultNow(),
});

export const outbox = pgTable("outbox", {
  id: text("id").primaryKey(),
  eventName: text("event_name").notNull(),
  payload: jsonb("payload").notNull(),
  deliveredAt: timestampColumn("delivered_at"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestampColumn("created_at").notNull().defaultNow(),
});
