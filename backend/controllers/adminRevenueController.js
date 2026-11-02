const Payment = require('../models/Payment');
const { escapeCsvCell } = require('./adminController');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in milliseconds (19,800,000 ms)

const VALID_RANGES = ['7d', '30d', '6m', 'year', 'custom'];

/**
 * Returns the current date in Asia/Kolkata timezone with year, month, day components
 * @param {Date} date
 * @returns {{ year: number, month: number, day: number, dateString: string }}
 */
const getNowIstParts = (date = new Date()) => {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth() + 1; // 1-12
  const day = istDate.getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    year,
    month,
    day,
    dateString: `${year}-${pad(month)}-${pad(day)}`,
  };
};

/**
 * Formats a Date object to an IST string "YYYY-MM-DD HH:mm:ss"
 * @param {Date} date
 * @returns {string}
 */
const formatIstDateTime = (date) => {
  if (!date) return '';
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  const y = ist.getUTCFullYear();
  const m = pad(ist.getUTCMonth() + 1);
  const d = pad(ist.getUTCDate());
  const h = pad(ist.getUTCHours());
  const min = pad(ist.getUTCMinutes());
  const s = pad(ist.getUTCSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
};

/**
 * Converts an IST date string (YYYY-MM-DD) to start-of-day and end-of-day UTC Date objects
 * @param {string} dateStr
 * @returns {{ startUtc: Date, endUtc: Date }}
 */
const istDayToUtcRange = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endUtcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - IST_OFFSET_MS;
  return {
    startUtc: new Date(startUtcMs),
    endUtc: new Date(endUtcMs),
  };
};

/**
 * Resolves date boundaries in Asia/Kolkata for preset or custom ranges
 * @param {object} query
 * @returns {{ range: string, startDateStr: string, endDateStr: string, startUtc: Date, endUtc: Date, bucketType: string, error?: string }}
 */
const parseRevenueDateRange = (query = {}) => {
  const rawRange = (query.range || '30d').toLowerCase().trim();
  const pad = (n) => String(n).padStart(2, '0');

  if (!VALID_RANGES.includes(rawRange)) {
    return {
      error: `Invalid range parameter: "${rawRange}". Allowed ranges: ${VALID_RANGES.join(', ')}`,
    };
  }

  const nowIst = getNowIstParts();

  if (rawRange === 'custom') {
    const { startDate, endDate } = query;
    if (!startDate || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
      return { error: 'startDate is required for custom range and must be in YYYY-MM-DD format' };
    }
    if (!endDate || typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
      return { error: 'endDate is required for custom range and must be in YYYY-MM-DD format' };
    }

    const sStr = startDate.trim();
    const eStr = endDate.trim();

    const [sy, sm, sd] = sStr.split('-').map(Number);
    const [ey, em, ed] = eStr.split('-').map(Number);

    const sDateCheck = new Date(Date.UTC(sy, sm - 1, sd));
    const eDateCheck = new Date(Date.UTC(ey, em - 1, ed));

    if (
      sDateCheck.getUTCFullYear() !== sy ||
      sDateCheck.getUTCMonth() + 1 !== sm ||
      sDateCheck.getUTCDate() !== sd
    ) {
      return { error: `Invalid startDate calendar value: ${sStr}` };
    }

    if (
      eDateCheck.getUTCFullYear() !== ey ||
      eDateCheck.getUTCMonth() + 1 !== em ||
      eDateCheck.getUTCDate() !== ed
    ) {
      return { error: `Invalid endDate calendar value: ${eStr}` };
    }

    if (sStr > eStr) {
      return { error: 'startDate cannot be after endDate' };
    }

    // Limit maximum custom date window to 5 years (1826 days) to prevent unbounded queries
    const diffDays = Math.round((eDateCheck.getTime() - sDateCheck.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays > 1826) {
      return { error: 'Custom date range cannot exceed 5 years' };
    }

    const { startUtc } = istDayToUtcRange(sStr);
    const { endUtc } = istDayToUtcRange(eStr);
    const bucketType = diffDays <= 31 ? 'daily' : 'monthly';

    return {
      range: 'custom',
      startDateStr: sStr,
      endDateStr: eStr,
      startUtc,
      endUtc,
      bucketType,
    };
  }

  // Preset ranges
  let startDateStr = '';
  const endDateStr = nowIst.dateString;
  let bucketType = 'daily';

  if (rawRange === '7d') {
    // 7 calendar days including today in IST (today - 6 days)
    const d = new Date(Date.UTC(nowIst.year, nowIst.month - 1, nowIst.day - 6));
    startDateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    bucketType = 'daily';
  } else if (rawRange === '30d') {
    // 30 calendar days including today in IST (today - 29 days)
    const d = new Date(Date.UTC(nowIst.year, nowIst.month - 1, nowIst.day - 29));
    startDateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    bucketType = 'daily';
  } else if (rawRange === '6m') {
    // Past 6 calendar months: 5 full months prior on 1st of month to today
    const d = new Date(Date.UTC(nowIst.year, nowIst.month - 1 - 5, 1));
    startDateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
    bucketType = 'monthly';
  } else if (rawRange === 'year') {
    // Jan 1st of current IST year to today
    startDateStr = `${nowIst.year}-01-01`;
    bucketType = 'monthly';
  }

  const { startUtc } = istDayToUtcRange(startDateStr);
  const { endUtc } = istDayToUtcRange(endDateStr);

  return {
    range: rawRange,
    startDateStr,
    endDateStr,
    startUtc,
    endUtc,
    bucketType,
  };
};

/**
 * Generates continuous daily buckets between startDateStr and endDateStr (YYYY-MM-DD in IST)
 * and fills missing dates with 0 values
 */
const fillDailyTrend = (aggregatedRows, startDateStr, endDateStr) => {
  const map = new Map(aggregatedRows.map((r) => [r._id, r]));
  const pad = (n) => String(n).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);

  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  const result = [];
  const curr = new Date(start);

  while (curr <= end) {
    const y = curr.getUTCFullYear();
    const m = curr.getUTCMonth() + 1;
    const d = curr.getUTCDate();
    const key = `${y}-${pad(m)}-${pad(d)}`;

    const row = map.get(key);
    const amount = row ? row.amount : 0;
    const orders = row ? row.orders : 0;
    const label = `${d} ${monthNames[m - 1]}`;
    const full = `${pad(d)} ${monthNames[m - 1]} ${y} · ${orders} order${orders === 1 ? '' : 's'}`;

    result.push({
      key,
      label,
      full,
      amount, // in paise
      orders,
    });

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return result;
};

/**
 * Generates continuous monthly buckets between startMonth and endMonth (YYYY-MM in IST)
 * and fills missing months with 0 values
 */
const fillMonthlyTrend = (aggregatedRows, startMonthStr, endMonthStr) => {
  const map = new Map(aggregatedRows.map((r) => [r._id, r]));
  const pad = (n) => String(n).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const [sy, sm] = startMonthStr.slice(0, 7).split('-').map(Number);
  const [ey, em] = endMonthStr.slice(0, 7).split('-').map(Number);

  const result = [];
  let currY = sy;
  let currM = sm;

  while (currY < ey || (currY === ey && currM <= em)) {
    const key = `${currY}-${pad(currM)}`;
    const row = map.get(key);
    const amount = row ? row.amount : 0;
    const orders = row ? row.orders : 0;
    const label = `${monthNames[currM - 1]} ${String(currY).slice(-2)}`;
    const full = `${monthNames[currM - 1]} ${currY} · ${orders} order${orders === 1 ? '' : 's'}`;

    result.push({
      key,
      label,
      full,
      amount, // in paise
      orders,
    });

    currM++;
    if (currM > 12) {
      currM = 1;
      currY++;
    }
  }

  return result;
};

/**
 * @route   GET /api/admin/revenue/analytics
 * @desc    Detailed revenue analytics with date-range filtering, plan breakdown, AOV, and trends
 * @access  Private (Admin only)
 */
const getAdminRevenueAnalytics = async (req, res, next) => {
  try {
    const rangeResult = parseRevenueDateRange(req.query);
    if (rangeResult.error) {
      return res.status(400).json({
        success: false,
        message: rangeResult.error,
      });
    }

    const { range, startDateStr, endDateStr, startUtc, endUtc, bucketType } = rangeResult;

    // Filter by createdAt timestamp within the resolved UTC boundaries
    const dateFilter = { createdAt: { $gte: startUtc, $lte: endUtc } };

    // Parallel aggregate queries:
    // 1. Summary of captured and failed payments within the period
    // 2. Breakdown by subscription plan for captured payments
    // 3. Trend buckets (daily or monthly) in Asia/Kolkata
    const [summaryAgg, planAgg, trendAgg] = await Promise.all([
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

    // Parse summary
    let capturedAmount = 0;
    let capturedCount = 0;
    let failedCount = 0;

    summaryAgg.forEach((row) => {
      if (row._id === 'captured') {
        capturedAmount = row.amount || 0;
        capturedCount = row.count || 0;
      } else if (row._id === 'failed') {
        failedCount = row.count || 0;
      }
    });

    // Calculate Average Order Value (AOV in paise). Safely returns 0 when no captured transactions.
    const averageOrderValue = capturedCount > 0 ? Math.round(capturedAmount / capturedCount) : 0;

    // Parse plan breakdown (THREE_MONTHS, SIX_MONTHS, OTHER)
    const planMap = new Map(planAgg.map((p) => [p._id, p]));
    const threeMonths = planMap.get('THREE_MONTHS');
    const sixMonths = planMap.get('SIX_MONTHS');

    let otherCount = 0;
    let otherAmount = 0;
    planAgg.forEach((p) => {
      if (p._id !== 'THREE_MONTHS' && p._id !== 'SIX_MONTHS') {
        otherCount += p.count || 0;
        otherAmount += p.amount || 0;
      }
    });

    const calcPct = (amt) => (capturedAmount > 0 ? Number(((amt / capturedAmount) * 100).toFixed(1)) : 0);

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
        ? fillDailyTrend(trendAgg, startDateStr, endDateStr)
        : fillMonthlyTrend(trendAgg, startDateStr, endDateStr);

    return res.status(200).json({
      success: true,
      data: {
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
          capturedAmount, // in paise
          capturedCount,
          failedCount,
          averageOrderValue, // in paise
          currency: 'INR',
          label: 'Gross Captured Revenue',
        },
        plans,
        trend,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/admin/revenue/export
 * @desc    Streaming CSV export of financial payment records for the selected date range
 * @access  Private (Admin only)
 */
const exportAdminRevenueCsv = async (req, res, next) => {
  try {
    const rangeResult = parseRevenueDateRange(req.query);
    if (rangeResult.error) {
      return res.status(400).json({
        success: false,
        message: rangeResult.error,
      });
    }

    const { startDateStr, endDateStr, startUtc, endUtc } = rangeResult;

    // Filter by date range; optionally filter status if provided (defaulting to captured for financial revenue audit)
    const filter = {
      createdAt: { $gte: startUtc, $lte: endUtc },
    };

    const statusParam = (req.query.status || '').trim();
    if (statusParam && ['captured', 'failed', 'created', 'authorized', 'refunded'].includes(statusParam)) {
      filter.status = statusParam;
    } else if (!statusParam) {
      // Default to captured payments for authoritative revenue report
      filter.status = 'captured';
    }

    const filename = `revenue-report-${startDateStr}-to-${endDateStr}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Emit UTF-8 BOM so spreadsheet editors like Excel render special characters correctly
    res.write('\uFEFF');

    const csvHeaders = [
      'Payment Date (IST)',
      'Razorpay Payment ID',
      'Razorpay Order ID',
      'Plan Code',
      'Plan Duration (Months)',
      'Gross Amount (INR)',
      'Currency',
      'Payment Status',
      'Verification Method',
      'Member Name',
      'Member Email',
    ];

    res.write(csvHeaders.map(escapeCsvCell).join(',') + '\r\n');

    // Stream cursor with chunked writing
    const cursor = Payment.find(filter)
      .select('createdAt razorpayPaymentId razorpayOrderId planCode amount currency status verificationMethod user')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .cursor();

    for await (const payment of cursor) {
      const planDuration = payment.planCode === 'THREE_MONTHS' ? '3' : payment.planCode === 'SIX_MONTHS' ? '6' : 'N/A';
      const amountInRupees = (payment.amount / 100).toFixed(2);

      const row = [
        formatIstDateTime(payment.createdAt),
        payment.razorpayPaymentId || 'N/A',
        payment.razorpayOrderId || '',
        payment.planCode || '',
        planDuration,
        amountInRupees,
        payment.currency || 'INR',
        payment.status || '',
        payment.verificationMethod || 'client_callback',
        payment.user ? payment.user.name || '' : 'Deleted User',
        payment.user ? payment.user.email || '' : '',
      ];

      res.write(row.map(escapeCsvCell).join(',') + '\r\n');
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      res.end();
    }
  }
};

module.exports = {
  getAdminRevenueAnalytics,
  exportAdminRevenueCsv,
  parseRevenueDateRange,
  getNowIstParts,
  formatIstDateTime,
  istDayToUtcRange,
  fillDailyTrend,
  fillMonthlyTrend,
};
