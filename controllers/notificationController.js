const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');

const notificationController = {
  /**
   * Display notifications list
   */
  async getNotifications(req, res) {
    try {
      const userId = req.session.user._id;
      const notifications = await notificationService.getUserNotifications(userId, 50);

      res.render('notifications', {
        title: 'Notifications - Lost & Found Portal',
        notifications,
      });
    } catch (err) {
      console.error('[NotificationController.getNotifications]', err);
      req.flash('error', 'Could not load notifications.');
      res.redirect('/dashboard');
    }
  },

  /**
   * Mark single notification as read
   */
  async markRead(req, res) {
    try {
      const userId = req.session.user._id;
      await notificationService.markAsRead(req.params.id, userId);

      // Support AJAX response or redirect
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.json({ success: true });
      }
      return res.redirect('/notifications');
    } catch (err) {
      console.error('[NotificationController.markRead]', err);
      res.redirect('/notifications');
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllRead(req, res) {
    try {
      const userId = req.session.user._id;
      await notificationService.markAllAsRead(userId);

      req.flash('success', 'All notifications marked as read.');
      return res.redirect('/notifications');
    } catch (err) {
      console.error('[NotificationController.markAllRead]', err);
      res.redirect('/notifications');
    }
  },
};

module.exports = notificationController;
