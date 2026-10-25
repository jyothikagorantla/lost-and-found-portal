const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/', ensureAuthenticated, notificationController.getNotifications);
router.post('/:id/read', ensureAuthenticated, notificationController.markRead);
router.post('/read-all', ensureAuthenticated, notificationController.markAllRead);

module.exports = router;
