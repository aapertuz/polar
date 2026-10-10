import { asc, eq } from "drizzle-orm";
import type { PolarDatabase } from "../db/client.js";
import {
  polarUser,
  registeredDevice,
  workspace,
  workspaceMembership,
  workspacePreference,
} from "../db/schema.js";
import { WorkspaceSummarySchema } from "@polar/contracts";
import type {
  BootstrapResponse,
  DeviceRegistrationRequest,
  DeviceRegistrationResponse,
} from "@polar/contracts";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export async function bootstrapAccount(
  db: PolarDatabase,
  authUser: AuthenticatedUser,
): Promise<BootstrapResponse> {
  return db.transaction(async (tx) => {
    const [insertedPolar] = await tx
      .insert(polarUser)
      .values({
        id: crypto.randomUUID(),
        authUserId: authUser.id,
        email: authUser.email,
        displayName: authUser.name,
      })
      .onConflictDoNothing({ target: polarUser.authUserId })
      .returning({ id: polarUser.id });

    const [polar] = await tx
      .select()
      .from(polarUser)
      .where(eq(polarUser.authUserId, authUser.id))
      .limit(1);
    if (!polar) throw new Error("Polar user bootstrap did not produce a user.");

    if (insertedPolar) {
      const initialWorkspaceId = crypto.randomUUID();
      await tx.insert(workspace).values({
        id: initialWorkspaceId,
        name: "My workspace",
        privacy: "private",
        ownerUserId: polar.id,
      });
      await tx.insert(workspaceMembership).values({
        workspaceId: initialWorkspaceId,
        userId: polar.id,
        role: "owner",
      });
    }

    const workspaces = await tx
      .select({
        id: workspace.id,
        name: workspace.name,
        privacy: workspace.privacy,
        role: workspaceMembership.role,
        createdAt: workspace.createdAt,
      })
      .from(workspaceMembership)
      .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
      .where(eq(workspaceMembership.userId, polar.id))
      .orderBy(asc(workspace.createdAt), asc(workspace.id));
    const [preference] = await tx
      .select({ defaultWorkspaceId: workspacePreference.defaultWorkspaceId })
      .from(workspacePreference)
      .where(eq(workspacePreference.userId, polar.id))
      .limit(1);
    const defaultWorkspaceId = workspaces.some((item) => item.id === preference?.defaultWorkspaceId)
      ? preference!.defaultWorkspaceId
      : null;

    return {
      user: { id: polar.id, email: polar.email, name: polar.displayName },
      workspaces: workspaces.map((item) =>
        WorkspaceSummarySchema.parse({ ...item, createdAt: item.createdAt.toISOString() }),
      ),
      defaultWorkspaceId,
    };
  });
}

export async function registerDevice(
  db: PolarDatabase,
  userId: string,
  device: DeviceRegistrationRequest,
): Promise<DeviceRegistrationResponse> {
  const now = new Date();
  const [registered] = await db
    .insert(registeredDevice)
    .values({
      id: crypto.randomUUID(),
      userId,
      deviceId: device.deviceId,
      label: device.label,
      createdAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [registeredDevice.userId, registeredDevice.deviceId],
      set: { label: device.label, lastSeenAt: now },
    })
    .returning();
  if (!registered) throw new Error("Device registration did not return a record.");
  return {
    id: registered.id,
    label: registered.label,
    createdAt: registered.createdAt.toISOString(),
  };
}
