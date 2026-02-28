import { Router } from "express";
import { supabaseAdmin } from "../../config/supabase.js";
import { requireAuth } from "../../middlewares/auth.js";

export const systemRoutes = Router();
systemRoutes.use(requireAuth);

const toRoleId = (profile: any): string | undefined =>
  profile?.roleId || profile?.role_id || profile?.role?.id || undefined;

systemRoutes.get("/bootstrap", async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [profileRes, rolesRes, settingsRes, tenantRes] = await Promise.all([
      supabaseAdmin.from("users").select("*").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("roles").select("*"),
      supabaseAdmin.from("system_settings").select("*").limit(1).maybeSingle(),
      supabaseAdmin.from("tenants").select("*").limit(1).maybeSingle(),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (rolesRes.error) throw rolesRes.error;
    if (settingsRes.error && settingsRes.status !== 406) throw settingsRes.error;
    if (tenantRes.error && tenantRes.status !== 406) throw tenantRes.error;

    const profile = profileRes.data;
    const roles = rolesRes.data ?? [];
    const roleId = toRoleId(profile);
    const role = roles.find((r) => r.id === roleId) ?? null;

    return res.json({
      currentUser: req.user,
      userProfile: profile,
      roles,
      permissions: role?.permissions ?? req.user?.permissions ?? {},
      initialSettings: settingsRes.data ?? null,
      tenantConfig: tenantRes.data ?? null,
    });
  } catch (err) {
    return next(err);
  }
});

