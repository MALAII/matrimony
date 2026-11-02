const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Creates an in-app notification idempotently.
 * If a duplicate key error occurs due to an existing (recipient, dedupKey) pair,
 * the error is handled gracefully without crashing or throwing to the caller.
 *
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.recipient
 * @param {'user'|'admin'} [params.recipientRole='user']
 * @param {string} params.type
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.link='']
 * @param {object} [params.metadata={}]
 * @param {string|null} [params.dedupKey=null]
 * @returns {Promise<{ created: boolean, duplicate: boolean, notification: object|null }>}
 */
const createNotification = async ({
  recipient,
  recipientRole = 'user',
  type,
  title,
  message,
  link = '',
  metadata = {},
  dedupKey = null,
}) => {
  if (!recipient) {
    return { created: false, duplicate: false, notification: null, error: 'Recipient is required' };
  }

  // Pre-check for duplicate if dedupKey is specified
  if (dedupKey) {
    try {
      const existing = await Notification.findOne({
        recipient,
        dedupKey,
      });
      if (existing) {
        return { created: false, duplicate: true, notification: existing };
      }
    } catch {
      // Continue to create attempt if query check fails
    }
  }

  try {
    const notification = await Notification.create({
      recipient,
      recipientRole,
      type,
      title,
      message,
      link,
      metadata,
      dedupKey,
    });
    return { created: true, duplicate: false, notification };
  } catch (err) {
    // E11000 duplicate key error code in MongoDB
    if (err && (err.code === 11000 || (err.message && err.message.includes('E11000')))) {
      const existing = await Notification.findOne({ recipient, dedupKey });
      return { created: false, duplicate: true, notification: existing };
    }
    throw err;
  }
};

/**
 * Dispatches an in-website notification individually to each active administrator.
 * Each admin receives their own copy with an independent unread status.
 *
 * @param {object} params
 * @param {string} params.type
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.link='']
 * @param {object} [params.metadata={}]
 * @param {string} [params.dedupKeyPrefix]
 * @returns {Promise<Array<{ adminId: string, result: object }>>}
 */
const notifyActiveAdmins = async ({
  type,
  title,
  message,
  link = '',
  metadata = {},
  dedupKeyPrefix = null,
}) => {
  try {
    const activeAdmins = await User.find({
      role: 'admin',
      accountStatus: 'active',
    }).select('_id email');

    const results = [];
    for (const admin of activeAdmins || []) {
      const adminDedupKey = dedupKeyPrefix ? `${dedupKeyPrefix}_${admin._id}` : null;
      try {
        const result = await createNotification({
          recipient: admin._id,
          recipientRole: 'admin',
          type,
          title,
          message,
          link,
          metadata,
          dedupKey: adminDedupKey,
        });
        results.push({ adminId: String(admin._id), result });
      } catch (err) {
        results.push({ adminId: String(admin._id), error: err.message });
      }
    }
    return results;
  } catch (err) {
    console.error('[Notification Service] Failed to dispatch admin notifications:', err.message);
    return [];
  }
};

/**
 * Dispatches an in-website notification to a specific regular user.
 *
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string} params.type
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.link='']
 * @param {object} [params.metadata={}]
 * @param {string} [params.dedupKey=null]
 * @returns {Promise<object>}
 */
const notifyUser = async ({
  userId,
  type,
  title,
  message,
  link = '',
  metadata = {},
  dedupKey = null,
}) => {
  return createNotification({
    recipient: userId,
    recipientRole: 'user',
    type,
    title,
    message,
    link,
    metadata,
    dedupKey,
  });
};

module.exports = {
  createNotification,
  notifyActiveAdmins,
  notifyUser,
};
