const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAuthenticated } = require('../middleware/auth');
const { ensureAdmin } = require('../middleware/admin');

// All admin routes require login + admin role
router.use(ensureAuthenticated, ensureAdmin);

router.get('/', adminController.showDashboard);

// User management
router.get('/users', adminController.listUsers);
router.post('/users/:userId/toggle-status', adminController.toggleUserStatus);

// Item moderation
router.get('/items', adminController.listItems);
router.post('/items/:itemId/status', adminController.updateItemStatus);
router.post('/items/:itemId/delete', adminController.deleteItem);

// Claim review across portal
router.get('/claims', adminController.listClaims);

module.exports = router;
