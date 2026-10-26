
const crypto = require('crypto');

const csrfProtection = (req, res, next) => {
  if (!req.session) {
    return next(
      new Error('Session middleware must run before CSRF middleware.')
    );
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;

  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  if (safeMethods.includes(req.method)) {
    return next();
  }

  const clientToken =
    (req.body && req.body._csrf) ||
    (req.query && req.query._csrf) ||
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'];

  const sessionToken = req.session.csrfToken;

  const isValid =
    typeof clientToken === 'string' &&
    typeof sessionToken === 'string' &&
    clientToken.length === sessionToken.length &&
    clientToken.length > 0 &&
    crypto.timingSafeEqual(
      Buffer.from(clientToken, 'utf8'),
      Buffer.from(sessionToken, 'utf8')
    );

  if (!isValid) {
    console.warn(
      '[CSRF] Token validation failed for ' +
      req.method +
      ' ' +
      req.originalUrl
    );

    if (typeof req.flash === 'function') {
      req.flash(
        'error',
        'Your security token expired or is invalid. Please refresh the page and try again.'
      );
    }

    return res.status(403).redirect(req.get('Referrer') || '/');
  }

  return next();
};

module.exports = csrfProtection;
