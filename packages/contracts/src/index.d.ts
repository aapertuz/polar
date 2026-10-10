import type { z } from "zod";

export declare const ApiFailureSchema: z.ZodObject<{
  error: z.ZodString;
  message: z.ZodString;
}>;
export declare const BootstrapResponseSchema: z.ZodObject<{
  user: z.ZodObject<{ id: z.ZodString; email: z.ZodEmail; name: z.ZodString }>;
  workspace: z.ZodObject<{ id: z.ZodString; name: z.ZodString; role: z.ZodLiteral<"owner"> }>;
}>;
export declare const DeviceRegistrationRequestSchema: z.ZodObject<{
  deviceId: z.ZodUUID;
  label: z.ZodString;
}>;
export declare const DeviceRegistrationResponseSchema: z.ZodObject<{
  id: z.ZodUUID;
  label: z.ZodString;
  createdAt: z.ZodISODateTime;
}>;
export type MissionActionUpdate = {
  dueOn?: string | null;
  priority?: "High" | "Medium" | "Low";
  status?: "upcoming" | "completed";
  assigneeIds?: string[];
  contextSourceIds?: string[];
};
export type MissionPlan = {
  name: string;
  outcome: string;
  successCriteria: string[];
  constraints: string[];
  deadlineAt: string | null;
  scheduledAt?: string;
  assessment: string;
  recommendation: string;
  checkpoints: {
    name: string;
    detail: string;
    dueOn?: string | null;
    actions: {
      title: string;
      detail: string;
      priority: "High" | "Medium" | "Low";
      dueOn?: string | null;
      dependsOn: string[];
    }[];
  }[];
  risks: string[];
  assumptions: string[];
};
export type MissionInterpreterOutput = {
  reply: string;
  questions: string[];
  proposal: MissionPlan | null;
  citations: {
    scope: "workspace" | "mission";
    sourceId: string;
    revision: number;
    excerptId: string;
  }[];
};
export type MissionDraftCreate = { goal: string };
export type MissionMessage = { content: string };
export type MissionSource = {
  id: string;
  fileName: string;
  contentHash: string;
  extractedText: string;
  provenance: "pdf" | "docx" | "markdown" | "text" | "pasted";
};
export type ReasoningClaim = { deviceId: string };
export type ReasoningResult = {
  deviceId: string;
  leaseToken: string;
  output: MissionInterpreterOutput;
  provider: "chatgpt";
  model: string;
};
export type MissionActivation = { proposalId: string; revisionHash: string };
export type WorkspaceContextBriefUpdate = { brief: string; expectedRevision: number };
export type WorkspaceContextSourceInput = {
  id: string;
  kind: "document" | "note";
  title: string;
  fileName: string | null;
  contentHash: string | null;
  extractedText: string;
};
export type WorkspaceContextSourceMutation = {
  source: WorkspaceContextSourceInput;
  expectedRevision?: number;
};
export declare const MissionPlanSchema: z.ZodType<MissionPlan>;
export declare const MissionInterpreterOutputSchema: z.ZodType<MissionInterpreterOutput>;
export declare const MissionDraftCreateSchema: z.ZodType<MissionDraftCreate>;
export declare const MissionMessageSchema: z.ZodType<MissionMessage>;
export declare const MissionSourceSchema: z.ZodType<MissionSource>;
export declare const ReasoningClaimSchema: z.ZodType<ReasoningClaim>;
export declare const ReasoningResultSchema: z.ZodType<ReasoningResult>;
export declare const MissionActivationSchema: z.ZodType<MissionActivation>;
export declare const MissionActionUpdateSchema: z.ZodType<MissionActionUpdate>;
export declare const WorkspaceContextBriefUpdateSchema: z.ZodType<WorkspaceContextBriefUpdate>;
export declare const WorkspaceContextSourceInputSchema: z.ZodType<WorkspaceContextSourceInput>;
export declare const WorkspaceContextSourceMutationSchema: z.ZodType<WorkspaceContextSourceMutation>;
export declare const contractJsonSchemas: Readonly<Record<string, Record<string, unknown>>>;

export type ApiFailure = z.infer<typeof ApiFailureSchema>;
export type BootstrapResponse = z.infer<typeof BootstrapResponseSchema>;
export type DeviceRegistrationRequest = z.infer<typeof DeviceRegistrationRequestSchema>;
export type DeviceRegistrationResponse = z.infer<typeof DeviceRegistrationResponseSchema>;
