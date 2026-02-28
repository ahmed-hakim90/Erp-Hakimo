const readPermissions = (user) => {
  const appMeta = user?.app_metadata || {};
  const direct = user?.permissions || appMeta?.permissions || {};
  if (Array.isArray(direct)) return new Set(direct);
  if (direct && typeof direct === 'object') {
    return new Set(Object.entries(direct).filter(([, allowed]) => !!allowed).map(([key]) => key));
  }
  return new Set();
};

export const requirePermission = (permission) => (req, res, next) => {
  const role = req.user?.role || req.user?.app_metadata?.role || '';
  if (role === 'admin') return next();

  const permissions = readPermissions(req.user);
  if (permissions.has(permission)) return next();

  return res.status(403).json({ error: `Forbidden: missing permission ${permission}` });
};

export const requireAnyPermission = (permissionsToMatch) => (req, res, next) => {
  const role = req.user?.role || req.user?.app_metadata?.role || '';
  if (role === 'admin') return next();

  const permissions = readPermissions(req.user);
  const allowed = permissionsToMatch.some((permission) => permissions.has(permission));
  if (allowed) return next();

  return res.status(403).json({ error: 'Forbidden: missing required permissions' });
};
