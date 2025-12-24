// middlewares/authorize.js
module.exports = (requiredRolesOrPermissions = []) => {
  const required = Array.isArray(requiredRolesOrPermissions)
    ? requiredRolesOrPermissions
    : [requiredRolesOrPermissions];

  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { roles = [], permissions = [] } = req.user;

    const allowed =
      required.some(r => roles.includes(r)) ||
      required.some(p => permissions.includes(p));

    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
};


