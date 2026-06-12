function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
    }
    next();
  };
}

function requireOwnOrAdmin(paramName = 'id') {
  return (req, res, next) => {
    const targetId = parseInt(req.params[paramName], 10);
    if (req.user.role === 'admin' || req.user.userId === targetId) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
  };
}

module.exports = { requireRole, requireOwnOrAdmin };
