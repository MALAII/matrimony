const mongoose = require('mongoose');
const Notification = require('../models/Notification');

/**
 * Validates pagination parameters safely.
 * @param {object} query
 * @returns {{ page: number, limit: number, skip: number }}
 */
const parsePagination = (query = {}) => {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) page = 1;

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) limit = 15;
  if (limit > 50) limit = 50;

  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * @route   GET /api/notifications
 * @desc    Get paginated notifications for the authenticated regular user
 * @access  Private (Authenticated users only)
 */
const getUserNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {
      recipient: req.user._id,
      recipientRole: 'user',
    };

    const [total, unreadCount, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page,
          pages,
          limit,
          unreadCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get fast unread notifications count for the authenticated regular user
 * @access  Private (Authenticated users only)
 */
const getUserUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      recipientRole: 'user',
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a single notification as read for the authenticated regular user
 * @access  Private (Authenticated users only)
 */
const markUserNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: req.user._id,
        recipientRole: 'user',
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied',
      });
    }

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/notifications/mark-all-read
 * @desc    Mark all unread notifications as read for the authenticated regular user
 * @access  Private (Authenticated users only)
 */
const markAllUserNotificationsAsRead = async (req, res, next) => {
  try {
    const now = new Date();
    const result = await Notification.updateMany(
      {
        recipient: req.user._id,
        recipientRole: 'user',
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: now,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/admin/notifications
 * @desc    Get paginated admin notifications for the authenticated administrator
 * @access  Private (Admin only)
 */
const getAdminNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {
      recipient: req.user._id,
      recipientRole: 'admin',
    };

    const [total, unreadCount, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page,
          pages,
          limit,
          unreadCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/admin/notifications/unread-count
 * @desc    Get fast unread admin notifications count for the authenticated administrator
 * @access  Private (Admin only)
 */
const getAdminUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      recipientRole: 'admin',
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/admin/notifications/:id/read
 * @desc    Mark a single admin notification as read for the authenticated administrator
 * @access  Private (Admin only)
 */
const markAdminNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: req.user._id,
        recipientRole: 'admin',
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Admin notification not found or access denied',
      });
    }

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/admin/notifications/mark-all-read
 * @desc    Mark all unread admin notifications as read for the authenticated administrator
 * @access  Private (Admin only)
 */
const markAllAdminNotificationsAsRead = async (req, res, next) => {
  try {
    const now = new Date();
    const result = await Notification.updateMany(
      {
        recipient: req.user._id,
        recipientRole: 'admin',
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: now,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'All admin notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUserNotifications,
  getUserUnreadCount,
  markUserNotificationAsRead,
  markAllUserNotificationsAsRead,
  getAdminNotifications,
  getAdminUnreadCount,
  markAdminNotificationAsRead,
  markAllAdminNotificationsAsRead,
};
