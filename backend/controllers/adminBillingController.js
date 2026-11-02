const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const CreditCycle = require('../models/CreditCycle');
const ContactUnlock = require('../models/ContactUnlock');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const { parsePaginationParams, escapeRegex } = require('./adminController');
const { exportAdminRevenueCsv, parseRevenueDateRange } = require('./adminRevenueController');

const DAY_MS = 24 * 60 * 60 * 1000;

const userIdsMatching = async (search) => {
  const rx = new RegExp(escapeRegex(search), 'i');
  const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id');
  return users.map((u) => u._id);
};

/**
 * @route   GET /api/admin/payments
 * @desc    Paginated payments with revenue summary
 */
const getAdminPayments = async (req, res, next) => {
  try {
    // If CSV export is requested, delegate to streaming revenue exporter
    if (req.query.export === 'csv' || req.query.format === 'csv') {
      return exportAdminRevenueCsv(req, res, next);
    }

    const { page, limit, search, error } = parsePaginationParams(req.query);
    if (error) return res.status(400).json({ success: false, message: error });

    const filter = {};
    if (['created', 'authorized', 'captured', 'failed', 'refunded'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.range) {
      const rangeResult = parseRevenueDateRange(req.query);
      if (rangeResult.error) {
        return res.status(400).json({ success: false, message: rangeResult.error });
      }
      filter.createdAt = { $gte: rangeResult.startUtc, $lte: rangeResult.endUtc };
    }
    if (search) {
      const ids = await userIdsMatching(search);
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ user: { $in: ids } }, { razorpayOrderId: rx }, { razorpayPaymentId: rx }];
    }

    const [totalRecords, data, byStatus] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter)
        .select('-razorpaySignature')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Payment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
    ]);

    const summary = { capturedAmount: 0, capturedCount: 0, failedCount: 0, pendingCount: 0, refundedCount: 0 };
    for (const row of byStatus) {
      if (row._id === 'captured') {
        summary.capturedAmount = row.amount;
        summary.capturedCount = row.count;
      } else if (row._id === 'failed') summary.failedCount = row.count;
      else if (row._id === 'refunded') summary.refundedCount = row.count;
      else summary.pendingCount += row.count;
    }

    return res.status(200).json({
      success: true,
      data,
      summary,
      pagination: { page, limit, totalRecords, totalPages: Math.ceil(totalRecords / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/admin/subscriptions
 * @desc    Paginated subscriptions with status counts
 */
const getAdminSubscriptions = async (req, res, next) => {
  try {
    const { page, limit, search, error } = parsePaginationParams(req.query);
    if (error) return res.status(400).json({ success: false, message: error });

    const filter = {};
    if (['pending', 'active', 'grace_period', 'expired', 'cancelled'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.expiringDays) {
      const d = Math.min(Math.max(parseInt(req.query.expiringDays, 10) || 0, 1), 90);
      filter.status = 'active';
      filter.endDate = { $gte: new Date(), $lte: new Date(Date.now() + d * DAY_MS) };
    }
    if (search) filter.user = { $in: await userIdsMatching(search) };

    const [totalRecords, data, counts] = await Promise.all([
      Subscription.countDocuments(filter),
      Subscription.find(filter)
        .populate('user', 'name email')
        .populate('payment', 'amount status razorpayPaymentId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Subscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const statusCounts = {};
    for (const c of counts) statusCounts[c._id] = c.count;

    return res.status(200).json({
      success: true,
      data,
      statusCounts,
      pagination: { page, limit, totalRecords, totalPages: Math.ceil(totalRecords / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/admin/subscriptions/:id
 * @desc    Manual subscription actions: { action: 'extend', days } or { action: 'cancel' }
 */
const updateAdminSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid subscription ID format' });
    }
    const sub = await Subscription.findById(id);
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    if (action === 'extend') {
      const days = parseInt(req.body.days, 10);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return res.status(400).json({ success: false, message: 'days must be a whole number between 1 and 365' });
      }
      if (sub.status === 'pending' || sub.status === 'cancelled') {
        return res.status(409).json({ success: false, message: `A ${sub.status} subscription cannot be extended` });
      }
      const base = sub.endDate && sub.endDate > new Date() ? sub.endDate : new Date();
      sub.endDate = new Date(base.getTime() + days * DAY_MS);
      if (sub.gracePeriodEndDate && sub.gracePeriodEndDate < sub.endDate) sub.gracePeriodEndDate = null;
      sub.status = 'active';
      // Invalidate previous 7-day reminder tracking since expiration date has changed
      sub.expiryReminder7d = null;
      sub.adminExpiryReminder7d = null;
      await sub.save();
      // Restore member visibility if the profile was hidden because this subscription lapsed
      await MatrimonialProfile.updateMany(
        { user: sub.user, profileStatus: 'inactive', deactivationReason: 'subscription_expired' },
        { $set: { profileStatus: 'active', deactivationReason: null, deactivatedAt: null } }
      );
      return res.status(200).json({ success: true, message: `Extended by ${days} days`, data: sub });
    }

    if (action === 'cancel') {
      if (sub.status === 'cancelled') {
        return res.status(409).json({ success: false, message: 'Subscription is already cancelled' });
      }
      sub.status = 'cancelled';
      await sub.save();
      return res.status(200).json({ success: true, message: 'Subscription cancelled', data: sub });
    }

    return res.status(400).json({ success: false, message: "action must be 'extend' or 'cancel'" });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/admin/users/:id
 * @desc    Single user with profile, subscriptions, payments and credit usage
 */
const getAdminUserDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }
    const user = await User.findById(id).select(
      'name email role accountStatus registrationSource emailVerifiedAt invitationSentAt createdAt'
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const [profile, subscriptions, payments, cycle, unlockCount] = await Promise.all([
      MatrimonialProfile.findOne({ user: id }).select(
        'candidateName approvalStatus profileStatus source personalDetails.gender personalDetails.location profilePhoto createdAt'
      ),
      Subscription.find({ user: id }).sort({ createdAt: -1 }).limit(20),
      Payment.find({ user: id }).select('-razorpaySignature').sort({ createdAt: -1 }).limit(20),
      CreditCycle.findOne({ user: id }).sort({ cycleStart: -1 }),
      ContactUnlock.countDocuments({ viewerUser: id }),
    ]);

    return res.status(200).json({
      success: true,
      data: { user, profile, subscriptions, payments, creditCycle: cycle, unlockCount },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAdminPayments, getAdminSubscriptions, updateAdminSubscription, getAdminUserDetail };
