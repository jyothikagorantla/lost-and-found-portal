/**
 * Middleware to restrict access to administrator users only
 */
const ensureAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.session.returnTo = req.originalUrl;
    req.flash('error', 'Please log in with an administrator account.');
    return res.redirect('/auth/login');
  }

  if (req.session.user.role !== 'admin') {
    req.flash('error', 'Access denied. You do not have administrator permissions.');
    return res.redirect('/dashboard');
  }

  next();
};

module.exports = {
  ensureAdmin,
};
