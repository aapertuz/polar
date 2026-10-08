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
export declare const contractJsonSchemas: Readonly<Record<string, Record<string, unknown>>>;

export type ApiFailure = z.infer<typeof ApiFailureSchema>;
export type BootstrapResponse = z.infer<typeof BootstrapResponseSchema>;
export type DeviceRegistrationRequest = z.infer<typeof DeviceRegistrationRequestSchema>;
export type DeviceRegistrationResponse = z.infer<typeof DeviceRegistrationResponseSchema>;
