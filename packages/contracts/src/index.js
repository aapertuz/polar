import { z } from "zod";

export const ApiFailureSchema = z
  .object({
    error: z.string().min(1).max(80),
    message: z.string().min(1).max(500),
  })
  .strict();

export const BootstrapResponseSchema = z
  .object({
    user: z
      .object({
        id: z.string().min(1).max(200),
        email: z.email().max(320),
        name: z.string().min(1).max(120),
      })
      .strict(),
    workspace: z
      .object({
        id: z.string().min(1).max(200),
        name: z.string().min(1).max(120),
        role: z.literal("owner"),
      })
      .strict(),
  })
  .strict();

export const DeviceRegistrationRequestSchema = z
  .object({
    deviceId: z.uuid(),
    label: z.string().trim().min(1).max(80),
  })
  .strict();

export const DeviceRegistrationResponseSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string().min(1).max(80),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const MissionPlanSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    outcome: z.string().trim().min(1).max(4000),
    successCriteria: z.array(z.string().trim().min(1).max(500)).max(20),
    constraints: z.array(z.string().trim().min(1).max(500)).max(20),
    deadlineAt: z.iso.datetime({ offset: true }).nullable(),
    scheduledAt: z.iso.datetime({ offset: true }).optional(),
    assessment: z.string().trim().min(1).max(2000),
    recommendation: z.string().trim().min(1).max(1000),
    checkpoints: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(160),
            detail: z.string().trim().min(1).max(1000),
            dueOn: z.iso.date().nullable().optional(),
            actions: z
              .array(
                z
                  .object({
                    title: z.string().trim().min(1).max(180),
                    detail: z.string().trim().min(1).max(1000),
                    priority: z.enum(["High", "Medium", "Low"]),
                    dueOn: z.iso.date().nullable().optional(),
                    dependsOn: z.array(z.string().trim().min(1).max(180)).max(40),
                  })
                  .strict(),
              )
              .max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    risks: z.array(z.string().trim().min(1).max(500)).max(20),
    assumptions: z.array(z.string().trim().min(1).max(500)).max(20),
  })
  .strict();

export const MissionInterpreterOutputSchema = z
  .object({
    reply: z.string().trim().min(1).max(4000),
    questions: z.array(z.string().trim().min(1).max(1000)).max(12),
    proposal: MissionPlanSchema.nullable(),
    citations: z
      .array(
        z
          .object({
            scope: z.enum(["workspace", "mission"]),
            sourceId: z.uuid(),
            revision: z.number().int().positive(),
            excerptId: z.string().min(1).max(120),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

export const MissionDraftCreateSchema = z.object({ goal: z.string().trim().max(4000) }).strict();
export const MissionMessageSchema = z
  .object({ content: z.string().trim().min(1).max(8000) })
  .strict();
export const MissionSourceSchema = z
  .object({
    id: z.uuid(),
    fileName: z.string().trim().min(1).max(255),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    extractedText: z.string().trim().min(1).max(1_000_000),
    provenance: z.enum(["pdf", "docx", "markdown", "text", "pasted"]),
  })
  .strict();
export const ReasoningClaimSchema = z.object({ deviceId: z.uuid() }).strict();
export const ReasoningResultSchema = z
  .object({
    deviceId: z.uuid(),
    leaseToken: z.uuid(),
    output: MissionInterpreterOutputSchema,
    provider: z.literal("chatgpt"),
    model: z.string().trim().min(1).max(256),
  })
  .strict();
export const MissionActivationSchema = z
  .object({ proposalId: z.uuid(), revisionHash: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();

export const WorkspaceContextBriefUpdateSchema = z
  .object({ brief: z.string().max(8000), expectedRevision: z.number().int().positive() })
  .strict();
const workspaceSourceBase = {
  id: z.uuid(),
  title: z.string().trim().min(1).max(255),
};
export const WorkspaceContextSourceInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...workspaceSourceBase,
      kind: z.literal("document"),
      fileName: z.string().trim().min(1).max(255),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      extractedText: z.string().trim().min(1).max(1_000_000),
    })
    .strict(),
  z
    .object({
      ...workspaceSourceBase,
      kind: z.literal("note"),
      fileName: z.null(),
      contentHash: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable(),
      extractedText: z.string().trim().min(1).max(100_000),
    })
    .strict(),
]);
export const WorkspaceContextSourceMutationSchema = z
  .object({
    source: WorkspaceContextSourceInputSchema,
    expectedRevision: z.number().int().positive().optional(),
  })
  .strict();

export const contractJsonSchemas = Object.freeze({
  apiFailure: z.toJSONSchema(ApiFailureSchema),
  bootstrapResponse: z.toJSONSchema(BootstrapResponseSchema),
  deviceRegistrationRequest: z.toJSONSchema(DeviceRegistrationRequestSchema),
  deviceRegistrationResponse: z.toJSONSchema(DeviceRegistrationResponseSchema),
  missionPlan: z.toJSONSchema(MissionPlanSchema),
  missionInterpreterOutput: z.toJSONSchema(MissionInterpreterOutputSchema),
  missionDraftCreate: z.toJSONSchema(MissionDraftCreateSchema),
  missionMessage: z.toJSONSchema(MissionMessageSchema),
  missionSource: z.toJSONSchema(MissionSourceSchema),
  reasoningClaim: z.toJSONSchema(ReasoningClaimSchema),
  reasoningResult: z.toJSONSchema(ReasoningResultSchema),
  missionActivation: z.toJSONSchema(MissionActivationSchema),
  workspaceContextBriefUpdate: z.toJSONSchema(WorkspaceContextBriefUpdateSchema),
  workspaceContextSourceInput: z.toJSONSchema(WorkspaceContextSourceInputSchema),
  workspaceContextSourceMutation: z.toJSONSchema(WorkspaceContextSourceMutationSchema),
});
