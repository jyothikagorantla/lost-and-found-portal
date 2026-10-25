const User = require('../models/User');
const notificationService = require('../services/notificationService');

/**
 * Middleware to ensure the user is logged in
 */
const ensureAuthenticated = async (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.session.returnTo = req.originalUrl;
    req.flash('error', 'Please log in to access this page.');
    return res.redirect('/auth/login');
  }

  // Refresh user status from DB to ensure account isn't suspended mid-session
  try {
    const freshUser = await User.findById(req.session.user._id).select('-passwordHash');
    if (!freshUser) {
      req.session.destroy();
      return res.redirect('/auth/login');
    }

    if (freshUser.accountStatus === 'suspended') {
      req.session.destroy(() => {
        res.status(403).render('auth/login', {
          title: 'Account Suspended - Lost & Found Portal',
          error: 'Your account has been suspended by an administrator. Please contact support.',
          formData: {},
        });
      });
      return;
    }

    // Keep session user up to date
    req.session.user = {
      _id: freshUser._id.toString(),
      name: freshUser.name,
      email: freshUser.email,
      role: freshUser.role,
      accountStatus: freshUser.accountStatus,
    };
    req.user = freshUser;
    next();
  } catch (err) {
    console.error('[Auth Middleware] Error checking fresh user:', err.message);
    next();
  }
};

/**
 * Middleware to ensure the user is a guest (not logged in)
 */
const ensureGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
};

/**
 * Middleware to populate res.locals with currentUser and notifications for all views
 */
const setCurrentUser = async (req, res, next) => {
  res.locals.currentUser = req.session && req.session.user ? req.session.user : null;
  res.locals.currentPath = req.path;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.info = req.flash('info');

  if (res.locals.currentUser) {
    try {
      res.locals.unreadNotificationCount = await notificationService.getUnreadCount(
        res.locals.currentUser._id
      );
    } catch (err) {
      res.locals.unreadNotificationCount = 0;
    }
  } else {
    res.locals.unreadNotificationCount = 0;
  }

  next();
};

module.exports = {
  ensureAuthenticated,
  ensureGuest,
  setCurrentUser,
};
