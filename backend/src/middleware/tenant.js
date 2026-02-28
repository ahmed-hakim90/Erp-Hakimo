import { env } from '../config/env.js';

export const tenantContext = (req, _res, next) => {
  const claimTenantId =
    req.user?.tenant_id ||
    req.user?.app_metadata?.tenant_id ||
    req.user?.user_metadata?.tenant_id;

  const headerTenantId = req.headers['x-tenant-id'];
  req.tenantId = (claimTenantId || headerTenantId || env.defaultTenantId || 'default').toString();
  next();
};
