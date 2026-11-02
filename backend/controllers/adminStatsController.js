const User = require('../models/User');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const ContactUnlock = require('../models/ContactUnlock');
const {
  parseRevenueDateRange,
  fillDailyTrend,
  fillMonthlyTrend,
} = require('./adminRevenueController');

const DAY = 24 * 60 * 60 * 1000;
const dayKey = (d) => d.toISOString().slice(0, 10);

/** Fill a continuous series of the last `n` days, merging aggregated counts. */
const fillDays = (rows, n, field = 'count') => {
  const map = new Map(rows.map((r) => [r._id, r[field]]));
  const out = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const key = dayKey(new Date(today.getTime() - i * DAY));
    out.push({ date: key, value: map.get(key) || 0 });
  }
  return out;
};

/** Last `n` calendar months, oldest first, merging aggregated rows keyed YYYY-MM. */
const fillMonths = (rows, n, field) => {
  const map = new Map(rows.map((r) => [r._id, r[field]]));
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    out.push({ month: key, value: map.get(key) || 0 });
  }
  return out;
};

const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id || 'unknown', r.count]));

/**
 * @route   GET /api/admin/stats
 * @desc    Aggregated numbers and time series for the admin dashboard
 */
const getAdminStats = async (req, res, next) => {
  try {
    const rangeResult = parseRevenueDateRange(req.query.range ? req.query : { range: '30d' });
    if (rangeResult.error) {
      return res.status(400).json({
        success: false,
        message: rangeResult.error,
      });
    }

    const { range, startDateStr, endDateStr, startUtc, endUtc, bucketType } = rangeResult;
    const dateFilter = { createdAt: { $gte: startUtc, $lte: endUtc } };

    const since30 = new Date(Date.now() - 30 * DAY);
    const since6m = new Date();
    since6m.setUTCMonth(since6m.getUTCMonth() - 5, 1);
    since6m.setUTCHours(0, 0, 0, 0);
    const now = new Date();

    const [
      totalUsers,
      totalProfiles,
      signups,
      profileApproval,
      profileActivity,
      profileSource,
      genderRows,
      subStatus,
      expiring7,
      revenueMonthly,
      payStatus,
      topLocations,
      unlocks30,
      unlockSeries,
      newUsers7,
      pendingList,
      periodSummaryAgg,
      periodPlanAgg,
      periodTrendAgg,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      MatrimonialProfile.countDocuments(),
      User.aggregate([
        { $match: { createdAt: { $gte: since30 }, role: { $ne: 'admin' } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      MatrimonialProfile.aggregate([{ $group: { _id: '$approvalStatus', count: { $sum: 1 } } }]),
      MatrimonialProfile.aggregate([{ $group: { _id: '$profileStatus', count: { $sum: 1 } } }]),
      MatrimonialProfile.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
      MatrimonialProfile.aggregate([{ $group: { _id: '$personalDetails.gender', count: { $sum: 1 } } }]),
      Subscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Subscription.countDocuments({ status: 'active', endDate: { $gte: now, $lte: new Date(Date.now() + 7 * DAY) } }),
      Payment.aggregate([
        { $match: { status: 'captured', createdAt: { $gte: since6m } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
      MatrimonialProfile.aggregate([
        { $match: { 'personalDetails.location': { $nin: [null, ''] } } },
        { $group: { _id: '$personalDetails.location', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      ContactUnlock.countDocuments({ unlockedAt: { $gte: since30 } }),
      ContactUnlock.aggregate([
        { $match: { unlockedAt: { $gte: since30 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$unlockedAt' } }, count: { $sum: 1 } } },
      ]),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * DAY) }, role: { $ne: 'admin' } }),
      MatrimonialProfile.find({ approvalStatus: 'pending_approval' })
        .select('candidateName source createdAt user')
        .populate('user', 'name')
        .sort({ createdAt: 1 })
        .limit(6),
      // Date-range period aggregations
      Payment.aggregate([
        { $match: { ...dateFilter, status: { $in: ['captured', 'failed'] } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { ...dateFilter, status: 'captured' } },
        {
          $group: {
            _id: '$planCode',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { ...dateFilter, status: 'captured' } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: bucketType === 'daily' ? '%Y-%m-%d' : '%Y-%m',
                date: '$createdAt',
                timezone: 'Asia/Kolkata',
              },
            },
            amount: { $sum: '$amount' },
            orders: { $sum: 1 },
          },
        },
      ]),
    ]);

    const pay = {};
    for (const r of payStatus) pay[r._id] = r;
    const revenueSeries = fillMonths(revenueMonthly, 6, 'amount');
    const ordersSeries = fillMonths(revenueMonthly, 6, 'count');

    // Parse period summary metrics
    let periodCapturedAmount = 0;
    let periodCapturedCount = 0;
    let periodFailedCount = 0;

    periodSummaryAgg.forEach((row) => {
      if (row._id === 'captured') {
        periodCapturedAmount = row.amount || 0;
        periodCapturedCount = row.count || 0;
      } else if (row._id === 'failed') {
        periodFailedCount = row.count || 0;
      }
    });

    const averageOrderValue =
      periodCapturedCount > 0 ? Math.round(periodCapturedAmount / periodCapturedCount) : 0;

    // Parse plan breakdown
    const planMap = new Map(periodPlanAgg.map((p) => [p._id, p]));
    const threeMonths = planMap.get('THREE_MONTHS');
    const sixMonths = planMap.get('SIX_MONTHS');

    let otherCount = 0;
    let otherAmount = 0;
    periodPlanAgg.forEach((p) => {
      if (p._id !== 'THREE_MONTHS' && p._id !== 'SIX_MONTHS') {
        otherCount += p.count || 0;
        otherAmount += p.amount || 0;
      }
    });

    const calcPct = (amt) =>
      periodCapturedAmount > 0 ? Number(((amt / periodCapturedAmount) * 100).toFixed(1)) : 0;

    const plans = {
      THREE_MONTHS: {
        code: 'THREE_MONTHS',
        name: '3 Months',
        count: threeMonths ? threeMonths.count : 0,
        amount: threeMonths ? threeMonths.amount : 0,
        percentage: calcPct(threeMonths ? threeMonths.amount : 0),
      },
      SIX_MONTHS: {
        code: 'SIX_MONTHS',
        name: '6 Months',
        count: sixMonths ? sixMonths.count : 0,
        amount: sixMonths ? sixMonths.amount : 0,
        percentage: calcPct(sixMonths ? sixMonths.amount : 0),
      },
      other: {
        count: otherCount,
        amount: otherAmount,
        percentage: calcPct(otherAmount),
      },
    };

    // Parse continuous trend series with zero-filling
    const trend =
      bucketType === 'daily'
        ? fillDailyTrend(periodTrendAgg, startDateStr, endDateStr)
        : fillMonthlyTrend(periodTrendAgg, startDateStr, endDateStr);

    return res.status(200).json({
      success: true,
      data: {
        totals: {
          users: totalUsers,
          profiles: totalProfiles,
          newUsers7,
          revenue: pay.captured?.amount || 0,
          paidOrders: pay.captured?.count || 0,
          failedPayments: pay.failed?.count || 0,
          expiring7,
          unlocks30,
        },
        revenueAnalytics: {
          period: {
            range,
            startDate: startDateStr,
            endDate: endDateStr,
            startUtc: startUtc.toISOString(),
            endUtc: endUtc.toISOString(),
            timezone: 'Asia/Kolkata',
            bucketType,
          },
          summary: {
            capturedAmount: periodCapturedAmount, // in paise
            capturedCount: periodCapturedCount,
            failedCount: periodFailedCount,
            averageOrderValue, // in paise
            currency: 'INR',
            label: 'Gross Captured Revenue',
          },
          plans,
          trend,
        },
        signups: fillDays(signups, 30),
        unlocks: fillDays(unlockSeries, 30),
        revenueMonthly: revenueSeries.map((r, i) => ({ ...r, orders: ordersSeries[i].value })),
        approval: toMap(profileApproval),
        activity: toMap(profileActivity),
        source: toMap(profileSource),
        gender: toMap(genderRows),
        subscriptions: toMap(subStatus),
        topLocations: topLocations.map((l) => ({ label: l._id, value: l.count })),
        pending: pendingList,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAdminStats };
