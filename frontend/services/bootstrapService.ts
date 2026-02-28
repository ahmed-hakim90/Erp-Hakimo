import apiClient from "./api";
import type { FirestoreRole, FirestoreUser, SystemSettings } from "../types";

interface BootstrapPayload {
  currentUser?: { id?: string; email?: string } | null;
  userProfile?: Partial<FirestoreUser> | null;
  roles?: Array<Partial<FirestoreRole>> | null;
  permissions?: Record<string, boolean> | string[] | null;
  initialSettings?: Partial<SystemSettings> | null;
  tenantConfig?: Record<string, unknown> | null;
}

const normalizePermissions = (
  value: Record<string, boolean> | string[] | undefined | null,
): Record<string, boolean> => {
  if (!value) return {};
  if (Array.isArray(value)) {
    return value.reduce<Record<string, boolean>>((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
  }
  return value;
};

export const bootstrapService = {
  async get() {
    const data = await apiClient.get<BootstrapPayload>("/bootstrap");

    const roles: FirestoreRole[] = (data.roles ?? []).map((r, idx) => ({
      id: r.id || `role-${idx}`,
      name: r.name || "Unknown Role",
      color: r.color || "#64748b",
      permissions: normalizePermissions(r.permissions as any),
    }));

    const userProfile = data.userProfile
      ? ({
          id: data.userProfile.id,
          email: data.userProfile.email || data.currentUser?.email || "",
          displayName: data.userProfile.displayName || "User",
          roleId: data.userProfile.roleId || roles[0]?.id || "",
          isActive: data.userProfile.isActive !== false,
          tenantId: data.userProfile.tenantId,
        } as FirestoreUser)
      : null;

    return {
      currentUser: data.currentUser ?? null,
      userProfile,
      roles,
      permissions: normalizePermissions(data.permissions),
      initialSettings: (data.initialSettings ?? null) as Partial<SystemSettings> | null,
      tenantConfig: data.tenantConfig ?? null,
    };
  },
};

