import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase.js";

const parseBearer = (header?: string): string | null => {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
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
    req.user = {
      id: data.user.id,
      email: data.user.email,
      role: (appMeta.role || userMeta.role) as string | undefined,
      permissions:
        (appMeta.permissions || userMeta.permissions) as
          | Record<string, boolean>
          | string[]
          | undefined,
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

