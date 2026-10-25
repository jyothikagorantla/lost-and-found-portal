const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');

const authController = {
  /**
   * Render registration page
   */
  showRegister(req, res) {
    res.render('auth/register', {
      title: 'Register - Lost & Found Portal',
      errors: [],
      formData: {},
    });
  },

  /**
   * Handle user registration
   */
  async handleRegister(req, res) {
    const errors = validationResult(req);
    const { name, email, phone, password } = req.body;

    if (!errors.isEmpty()) {
      return res.status(422).render('auth/register', {
        title: 'Register - Lost & Found Portal',
        errors: errors.array(),
        formData: { name, email, phone },
      });
    }

    try {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).render('auth/register', {
          title: 'Register - Lost & Found Portal',
          errors: [{ msg: 'An account with this email address already exists. Please log in.' }],
          formData: { name, email, phone },
        });
      }

      const passwordHash = await User.hashPassword(password);
      const newUser = await User.create({
        name,
        email: email.toLowerCase(),
        phone: phone || '',
        passwordHash,
        role: 'user',
        accountStatus: 'active',
      });

      // Auto-login newly registered user
      req.session.user = {
        _id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        accountStatus: newUser.accountStatus,
      };

      req.flash('success', `Welcome to Lost & Found Portal, ${newUser.name}! Your account has been created.`);
      return res.redirect('/dashboard');
    } catch (err) {
      console.error('[AuthController.handleRegister]', err);
      req.flash('error', 'An error occurred during registration. Please try again.');
      return res.status(500).render('auth/register', {
        title: 'Register - Lost & Found Portal',
        errors: [{ msg: 'Server error. Please try again later.' }],
        formData: { name, email, phone },
      });
    }
  },

  /**
   * Render login page
   */
  showLogin(req, res) {
    res.render('auth/login', {
      title: 'Login - Lost & Found Portal',
      errors: [],
      formData: {},
    });
  },

  /**
   * Handle user login
   */
  async handleLogin(req, res) {
    const errors = validationResult(req);
    const { email, password } = req.body;

    if (!errors.isEmpty()) {
      return res.status(422).render('auth/login', {
        title: 'Login - Lost & Found Portal',
        errors: errors.array(),
        formData: { email },
      });
    }

    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).render('auth/login', {
          title: 'Login - Lost & Found Portal',
          errors: [{ msg: 'Invalid email or password.' }],
          formData: { email },
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).render('auth/login', {
          title: 'Login - Lost & Found Portal',
          errors: [{ msg: 'Invalid email or password.' }],
          formData: { email },
        });
      }

      if (user.accountStatus === 'suspended') {
        return res.status(403).render('auth/login', {
          title: 'Login - Lost & Found Portal',
          errors: [{ msg: 'Your account has been suspended. Please contact the administrator.' }],
          formData: { email },
        });
      }

      // Store in session
      req.session.user = {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
      };

      req.flash('success', `Welcome back, ${user.name}!`);

      const redirectUrl = req.session.returnTo || (user.role === 'admin' ? '/admin' : '/dashboard');
      delete req.session.returnTo;
      return res.redirect(redirectUrl);
    } catch (err) {
      console.error('[AuthController.handleLogin]', err);
      return res.status(500).render('auth/login', {
        title: 'Login - Lost & Found Portal',
        errors: [{ msg: 'Server error during login. Please try again.' }],
        formData: { email },
      });
    }
  },

  /**
   * Handle user logout
   */
  handleLogout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        console.error('[AuthController.handleLogout]', err);
      }
      res.clearCookie('lostfound.sid');
      return res.redirect('/auth/login');
    });
  },

  /**
   * User dashboard view
   */
  async showDashboard(req, res) {
    const userId = req.session.user._id;

    try {
      const [
        totalReports,
        lostCount,
        foundCount,
        resolvedCount,
        pendingClaimsCount,
        recentReports,
        myClaims,
      ] = await Promise.all([
        Item.countDocuments({ reportedBy: userId }),
        Item.countDocuments({ reportedBy: userId, type: 'lost' }),
        Item.countDocuments({ reportedBy: userId, type: 'found' }),
        Item.countDocuments({ reportedBy: userId, status: 'resolved' }),
        Claim.countDocuments({ claimant: userId, status: 'pending' }),
        Item.find({ reportedBy: userId }).sort({ createdAt: -1 }).limit(5),
        Claim.find({ claimant: userId }).populate('item').sort({ createdAt: -1 }).limit(5),
      ]);

      res.render('dashboard', {
        title: 'My Dashboard - Lost & Found Portal',
        stats: {
          totalReports,
          lostCount,
          foundCount,
          resolvedCount,
          pendingClaimsCount,
        },
        recentReports,
        myClaims,
      });
    } catch (err) {
      console.error('[AuthController.showDashboard]', err);
      req.flash('error', 'Error loading dashboard details.');
      res.redirect('/');
    }
  },
};

module.exports = authController;