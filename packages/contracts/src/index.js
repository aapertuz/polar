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

export const contractJsonSchemas = Object.freeze({
  apiFailure: z.toJSONSchema(ApiFailureSchema),
  bootstrapResponse: z.toJSONSchema(BootstrapResponseSchema),
  deviceRegistrationRequest: z.toJSONSchema(DeviceRegistrationRequestSchema),
  deviceRegistrationResponse: z.toJSONSchema(DeviceRegistrationResponseSchema),
});
