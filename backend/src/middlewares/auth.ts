import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase.js";

const parseBearer = (header?: string): string | null => {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
};

const toRoleId = (profile: any): string | undefined =>
  profile?.roleId || profile?.role_id || profile?.role?.id || undefined;

const resolvePermissions = async (
  userId: string,
  fallback: Record<string, boolean> | string[] | undefined,
) => {
  const profileRes = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (profileRes.error && profileRes.status !== 406) throw profileRes.error;

  const profile = profileRes.data;
  const roleId = toRoleId(profile);
  if (!roleId) return { profile, permissions: fallback };

  const roleRes = await supabaseAdmin
    .from("roles")
    .select("*")
    .eq("id", roleId)
    .maybeSingle();
  if (roleRes.error && roleRes.status !== 406) throw roleRes.error;

  const role = roleRes.data;
  return {
    profile,
    permissions: (role?.permissions as Record<string, boolean> | string[] | undefined) ?? fallback,
    roleName: role?.name as string | undefined,
  };
};

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = parseBearer(req.header("authorization"));
    if (!token) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const appMeta = data.user.app_metadata ?? {};
    const userMeta = data.user.user_metadata ?? {};
    const metaFallback =
      (appMeta.permissions || userMeta.permissions) as
        | Record<string, boolean>
        | string[]
        | undefined;

    const resolved = await resolvePermissions(data.user.id, metaFallback);

    req.user = {
      id: data.user.id,
      email: data.user.email,
      role:
        resolved.roleName ||
        (appMeta.role || userMeta.role) as string | undefined,
      permissions: resolved.permissions,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

export const requirePermission =
  (permission: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    const perms = req.user?.permissions;
    if (!perms) return res.status(403).json({ error: "Forbidden" });

    if (Array.isArray(perms)) {
      if (perms.includes(permission)) return next();
      return res.status(403).json({ error: "Forbidden" });
    }

    if (perms[permission] === true) return next();
    return res.status(403).json({ error: "Forbidden" });
  };

