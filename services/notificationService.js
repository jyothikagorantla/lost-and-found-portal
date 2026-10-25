const Notification = require('../models/Notification');

const notificationService = {
  /**
   * Create a notification for a user
   */
  async create({ recipient, message, type = 'system', relatedItem = null, relatedClaim = null }) {
    try {
      if (!recipient) return null;
      const notification = await Notification.create({
        recipient,
        message,
        type,
        relatedItem,
        relatedClaim,
      });
      return notification;
    } catch (err) {
      console.error('[NotificationService] Error creating notification:', err.message);
      return null;
    }
  },

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId) {
    if (!userId) return 0;
    try {
      return await Notification.countDocuments({ recipient: userId, isRead: false });
    } catch (err) {
      return 0;
    }
  },

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId, limit = 30) {
    if (!userId) return [];
    try {
      return await Notification.find({ recipient: userId })
        .populate('relatedItem', 'title type category imageUrl status')
        .populate('relatedClaim', 'status explanation')
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (err) {
      console.error('[NotificationService] Error getting notifications:', err.message);
      return [];
    }
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      return await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isRead: true },
        { new: true }
      );
    } catch (err) {
      console.error('[NotificationService] Error marking as read:', err.message);
      return null;
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    try {
      return await Notification.updateMany(
        { recipient: userId, isRead: false },
        { isRead: true }
      );
    } catch (err) {
      console.error('[NotificationService] Error marking all as read:', err.message);
      return null;
    }
  },
};

module.exports = notificationService;
