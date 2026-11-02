const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getUserNotifications,
  getUserUnreadCount,
  markUserNotificationAsRead,
  markAllUserNotificationsAsRead,
} = require('../controllers/notificationController');

// All regular user notification endpoints require an authenticated user session
router.use(protect);

// Specific routes before parameterized :id route
router.get('/', getUserNotifications);
router.get('/unread-count', getUserUnreadCount);
router.patch('/mark-all-read', markAllUserNotificationsAsRead);
router.patch('/:id/read', markUserNotificationAsRead);

module.exports = router;
