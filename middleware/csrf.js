const crypto = require('crypto');

/**
 * Session-based CSRF protection middleware
 */
const csrfProtection = (req, res, next) => {
  // Ensure a CSRF token exists on the session
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Make the token available to all templates
  res.locals.csrfToken = req.session.csrfToken;

  // Safe HTTP methods do not mutate state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // For state-changing methods, verify token
  const clientToken =
    (req.body && req.body._csrf) ||
    (req.query && req.query._csrf) ||
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'];

  if (!clientToken || clientToken !== req.session.csrfToken) {
    console.warn(`[CSRF] Invalid or missing CSRF token on ${req.method} ${req.originalUrl}`);
    req.flash('error', 'Security check failed (CSRF token expired or invalid). Please try again.');
    return res.status(403).redirect(req.get('Referrer') || '/');
  }

  next();
};

module.exports = csrfProtection;
