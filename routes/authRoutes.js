const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { ensureAuthenticated, ensureGuest } = require('../middleware/auth');
const {
  registerValidationRules,
  loginValidationRules,
} = require('../middleware/validation');

// Rate limiting for authentication routes to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
});

router.get('/register', ensureGuest, authController.showRegister);
router.post('/register', ensureGuest, authLimiter, registerValidationRules, authController.handleRegister);

router.get('/login', ensureGuest, authController.showLogin);
router.post('/login', ensureGuest, authLimiter, loginValidationRules, authController.handleLogin);

router.post('/logout', ensureAuthenticated, authController.handleLogout);
router.get('/logout', ensureAuthenticated, authController.handleLogout);

module.exports = router;
