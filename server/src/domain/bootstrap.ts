import { and, eq } from "drizzle-orm";
import type { PolarDatabase } from "../db/client.js";
import { polarUser, registeredDevice, workspace, workspaceMembership } from "../db/schema.js";
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

export class WorkspaceMembershipError extends Error {
  constructor() {
    super("The authenticated Polar user no longer belongs to their default workspace.");
  }
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

    const [insertedWorkspace] = await tx
      .insert(workspace)
      .values({ id: crypto.randomUUID(), name: "Personal workspace", ownerUserId: polar.id })
      .onConflictDoNothing({ target: workspace.ownerUserId })
      .returning({ id: workspace.id });
    const [defaultWorkspace] = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.ownerUserId, polar.id))
      .limit(1);
    if (!defaultWorkspace)
      throw new Error("Polar workspace bootstrap did not produce a workspace.");

    if (insertedPolar || insertedWorkspace) {
      await tx
        .insert(workspaceMembership)
        .values({ workspaceId: defaultWorkspace.id, userId: polar.id, role: "owner" })
        .onConflictDoNothing({
          target: [workspaceMembership.workspaceId, workspaceMembership.userId],
        });
    }
    const [membership] = await tx
      .select()
      .from(workspaceMembership)
      .where(
        and(
          eq(workspaceMembership.workspaceId, defaultWorkspace.id),
          eq(workspaceMembership.userId, polar.id),
        ),
      )
      .limit(1);
    if (!membership) {
      throw new WorkspaceMembershipError();
    }
    if (membership.role !== "owner") {
      throw new Error("Polar default workspace owner role is inconsistent.");
    }

    return {
      user: { id: polar.id, email: polar.email, name: polar.displayName },
      workspace: { id: defaultWorkspace.id, name: defaultWorkspace.name, role: "owner" },
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
