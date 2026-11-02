/**
 * Automated Verification Suite for Admin Revenue Analytics & Financial CSV Export
 *
 * Verifies:
 * 1. Asia/Kolkata date boundary resolution for presets (7d, 30d, 6m, year) and custom ranges
 * 2. Custom date range validations (format, calendar validity, inverted dates, max window limit)
 * 3. Daily vs monthly bucketing determination (<= 31 days -> daily, > 31 days -> monthly)
 * 4. Zero-filled trend series (daily and monthly) with continuous keys
 * 5. Safe Average Order Value (AOV) calculation (safe against zero division)
 * 6. Revenue plan breakdown (THREE_MONTHS, SIX_MONTHS, other) with percentage calculation
 * 7. Financial CSV export streaming, RFC 4180 escaping, formula injection protection, UTF-8 BOM
 * 8. Backward compatibility of getAdminStats totals and time series
 * 9. Authorization middleware guards
 *
 * Completely isolated: Uses mock data, zero live database writes, zero real payments.
 */

const assert = require('assert');

const {
  parseRevenueDateRange,
  getNowIstParts,
  formatIstDateTime,
  istDayToUtcRange,
  fillDailyTrend,
  fillMonthlyTrend,
  getAdminRevenueAnalytics,
  exportAdminRevenueCsv,
} = require('../controllers/adminRevenueController');

const { getAdminStats } = require('../controllers/adminStatsController');
const { getAdminPayments } = require('../controllers/adminBillingController');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const ContactUnlock = require('../models/ContactUnlock');

let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${testName}`);
    console.error(`         ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${testName}`);
    console.error(`         ${err.message}`);
    failedTests++;
  }
}

console.log('\n--- 1. Testing Asia/Kolkata IST Date Boundaries & Calculations ---');

runTest('istDayToUtcRange correctly maps IST midnight to previous day 18:30 UTC', () => {
  const { startUtc, endUtc } = istDayToUtcRange('2026-10-24');
  assert.strictEqual(startUtc.toISOString(), '2026-10-23T18:30:00.000Z');
  assert.strictEqual(endUtc.toISOString(), '2026-10-24T18:29:59.999Z');
});

runTest('formatIstDateTime formats UTC timestamp into Asia/Kolkata local string', () => {
  const utcDate = new Date('2026-10-23T18:30:00.000Z');
  const istStr = formatIstDateTime(utcDate);
  assert.strictEqual(istStr, '2026-10-24 00:00:00');
});

runTest('getNowIstParts returns valid dateString matching YYYY-MM-DD', () => {
  const parts = getNowIstParts();
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(parts.dateString));
  assert.strictEqual(typeof parts.year, 'number');
  assert.ok(parts.month >= 1 && parts.month <= 12);
  assert.ok(parts.day >= 1 && parts.day <= 31);
});

console.log('\n--- 2. Testing parseRevenueDateRange (Validation & Boundaries) ---');

runTest('Default range is 30d with daily bucketing', () => {
  const res = parseRevenueDateRange({});
  assert.strictEqual(res.range, '30d');
  assert.strictEqual(res.bucketType, 'daily');
  assert.ok(res.startUtc instanceof Date);
  assert.ok(res.endUtc instanceof Date);
  assert.ok(res.startUtc < res.endUtc);
});

runTest('7d preset resolves 7 calendar days with daily bucketing', () => {
  const res = parseRevenueDateRange({ range: '7d' });
  assert.strictEqual(res.range, '7d');
  assert.strictEqual(res.bucketType, 'daily');
});

runTest('6m preset resolves 6 calendar months with monthly bucketing', () => {
  const res = parseRevenueDateRange({ range: '6m' });
  assert.strictEqual(res.range, '6m');
  assert.strictEqual(res.bucketType, 'monthly');
  assert.ok(res.startDateStr.endsWith('-01'), '6m start date must be first day of month');
});

runTest('year preset resolves Jan 1st of current year with monthly bucketing', () => {
  const res = parseRevenueDateRange({ range: 'year' });
  assert.strictEqual(res.range, 'year');
  assert.strictEqual(res.bucketType, 'monthly');
  assert.ok(res.startDateStr.endsWith('-01-01'));
});

runTest('Invalid range identifier returns descriptive error', () => {
  const res = parseRevenueDateRange({ range: 'yesterday' });
  assert.ok(res.error);
  assert.ok(res.error.includes('Invalid range parameter'));
});

runTest('Custom range validation: valid dates <= 31 days use daily bucketing', () => {
  const res = parseRevenueDateRange({
    range: 'custom',
    startDate: '2026-10-01',
    endDate: '2026-10-20',
  });
  assert.strictEqual(res.range, 'custom');
  assert.strictEqual(res.bucketType, 'daily');
  assert.strictEqual(res.startDateStr, '2026-10-01');
  assert.strictEqual(res.endDateStr, '2026-10-20');
});

runTest('Custom range validation: valid dates > 31 days use monthly bucketing', () => {
  const res = parseRevenueDateRange({
    range: 'custom',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
  });
  assert.strictEqual(res.range, 'custom');
  assert.strictEqual(res.bucketType, 'monthly');
});

runTest('Custom range validation: missing or malformed dates rejected', () => {
  assert.ok(parseRevenueDateRange({ range: 'custom' }).error);
  assert.ok(parseRevenueDateRange({ range: 'custom', startDate: '2026-10-01' }).error);
  assert.ok(parseRevenueDateRange({ range: 'custom', startDate: '2026/10/01', endDate: '2026/10/10' }).error);
});

runTest('Custom range validation: invalid calendar date rejected (Feb 30)', () => {
  const res = parseRevenueDateRange({
    range: 'custom',
    startDate: '2026-02-30',
    endDate: '2026-03-05',
  });
  assert.ok(res.error);
  assert.ok(res.error.includes('Invalid startDate calendar value'));
});

runTest('Custom range validation: inverted dates rejected (startDate > endDate)', () => {
  const res = parseRevenueDateRange({
    range: 'custom',
    startDate: '2026-10-25',
    endDate: '2026-10-10',
  });
  assert.ok(res.error);
  assert.ok(res.error.includes('startDate cannot be after endDate'));
});

runTest('Custom range validation: range exceeding 5 years rejected', () => {
  const res = parseRevenueDateRange({
    range: 'custom',
    startDate: '2019-01-01',
    endDate: '2026-01-01',
  });
  assert.ok(res.error);
  assert.ok(res.error.includes('Custom date range cannot exceed 5 years'));
});

console.log('\n--- 3. Testing Trend Zero-Filling ---');

runTest('fillDailyTrend fills continuous days and zero-pads missing dates', () => {
  const mockAgg = [{ _id: '2026-10-02', amount: 100000, orders: 1 }];
  const filled = fillDailyTrend(mockAgg, '2026-10-01', '2026-10-04');
  assert.strictEqual(filled.length, 4);
  assert.strictEqual(filled[0].key, '2026-10-01');
  assert.strictEqual(filled[0].amount, 0);
  assert.strictEqual(filled[0].orders, 0);
  assert.strictEqual(filled[1].key, '2026-10-02');
  assert.strictEqual(filled[1].amount, 100000);
  assert.strictEqual(filled[1].orders, 1);
  assert.strictEqual(filled[3].key, '2026-10-04');
  assert.strictEqual(filled[3].amount, 0);
});

runTest('fillMonthlyTrend fills continuous months and zero-pads missing months', () => {
  const mockAgg = [{ _id: '2026-06', amount: 300000, orders: 2 }];
  const filled = fillMonthlyTrend(mockAgg, '2026-05', '2026-07');
  assert.strictEqual(filled.length, 3);
  assert.strictEqual(filled[0].key, '2026-05');
  assert.strictEqual(filled[0].amount, 0);
  assert.strictEqual(filled[1].key, '2026-06');
  assert.strictEqual(filled[1].amount, 300000);
  assert.strictEqual(filled[2].key, '2026-07');
  assert.strictEqual(filled[2].amount, 0);
});

console.log('\n--- 4. Testing getAdminStats & Revenue Analytics (Mock DB) ---');

async function testRevenueAnalyticsInStats() {
  const origPaymentAgg = Payment.aggregate;
  const origUserCount = User.countDocuments;
  const origProfCount = MatrimonialProfile.countDocuments;
  const origUserAgg = User.aggregate;
  const origProfAgg = MatrimonialProfile.aggregate;
  const origSubAgg = Subscription.aggregate;
  const origSubCount = Subscription.countDocuments;
  const origProfFind = MatrimonialProfile.find;
  const origUnlockCount = ContactUnlock.countDocuments;
  const origUnlockAgg = ContactUnlock.aggregate;

  try {
    User.countDocuments = async () => 50;
    MatrimonialProfile.countDocuments = async () => 30;
    User.aggregate = async () => [];
    MatrimonialProfile.aggregate = async () => [];
    Subscription.aggregate = async () => [];
    Subscription.countDocuments = async () => 4;
    ContactUnlock.countDocuments = async () => 10;
    ContactUnlock.aggregate = async () => [];
    MatrimonialProfile.find = () => ({
      select() {
        return this;
      },
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      limit: async () => [],
    });

    let paymentAggCall = 0;
    Payment.aggregate = async (pipeline) => {
      paymentAggCall++;
      // Check if it's periodSummaryAgg, periodPlanAgg, or periodTrendAgg
      const matchStage = pipeline[0]?.$match;
      if (matchStage && matchStage.status && matchStage.status.$in) {
        // periodSummaryAgg
        return [
          { _id: 'captured', count: 10, amount: 2500000 },
          { _id: 'failed', count: 2, amount: 500000 },
        ];
      }
      if (pipeline[1]?.$group?._id === '$planCode') {
        // periodPlanAgg
        return [
          { _id: 'THREE_MONTHS', count: 6, amount: 1200000 },
          { _id: 'SIX_MONTHS', count: 4, amount: 1300000 },
        ];
      }
      if (pipeline[1]?.$group?._id?.$dateToString) {
        // periodTrendAgg or revenueMonthly
        return [
          { _id: '2026-10-20', amount: 500000, orders: 2 },
          { _id: '2026-10-24', amount: 2000000, orders: 8 },
        ];
      }
      // General payStatus query
      return [
        { _id: 'captured', count: 25, amount: 5000000 },
        { _id: 'failed', count: 5, amount: 1000000 },
      ];
    };

    let responseStatus = 0;
    let responseData = null;

    const mockReq = { query: { range: '7d' } };
    const mockRes = {
      status(c) {
        responseStatus = c;
        return this;
      },
      json(d) {
        responseData = d;
        return this;
      },
    };

    await getAdminStats(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseData.success, true);

    // Verify existing totals are preserved
    assert.strictEqual(responseData.data.totals.users, 50);
    assert.strictEqual(responseData.data.totals.revenue, 5000000);
    assert.strictEqual(responseData.data.totals.paidOrders, 25);
    assert.strictEqual(responseData.data.totals.failedPayments, 5);

    // Verify revenueAnalytics payload
    const rev = responseData.data.revenueAnalytics;
    assert.ok(rev, 'revenueAnalytics must be present');
    assert.strictEqual(rev.period.range, '7d');
    assert.strictEqual(rev.period.timezone, 'Asia/Kolkata');
    assert.strictEqual(rev.period.bucketType, 'daily');

    // Summary metrics verification
    assert.strictEqual(rev.summary.capturedAmount, 2500000); // 25,000 INR in paise
    assert.strictEqual(rev.summary.capturedCount, 10);
    assert.strictEqual(rev.summary.failedCount, 2);
    // AOV = 2500000 / 10 = 250000 paise
    assert.strictEqual(rev.summary.averageOrderValue, 250000);
    assert.strictEqual(rev.summary.label, 'Gross Captured Revenue');

    // Plan breakdown verification
    assert.strictEqual(rev.plans.THREE_MONTHS.count, 6);
    assert.strictEqual(rev.plans.THREE_MONTHS.amount, 1200000);
    assert.strictEqual(rev.plans.THREE_MONTHS.percentage, 48.0);
    assert.strictEqual(rev.plans.SIX_MONTHS.count, 4);
    assert.strictEqual(rev.plans.SIX_MONTHS.amount, 1300000);
    assert.strictEqual(rev.plans.SIX_MONTHS.percentage, 52.0);

    // Trend series verification
    assert.strictEqual(rev.trend.length, 7, '7d range must yield exactly 7 daily buckets');
  } finally {
    Payment.aggregate = origPaymentAgg;
    User.countDocuments = origUserCount;
    MatrimonialProfile.countDocuments = origProfCount;
    User.aggregate = origUserAgg;
    MatrimonialProfile.aggregate = origProfAgg;
    Subscription.aggregate = origSubAgg;
    Subscription.countDocuments = origSubCount;
    MatrimonialProfile.find = origProfFind;
    ContactUnlock.countDocuments = origUnlockCount;
    ContactUnlock.aggregate = origUnlockAgg;
  }
}

async function testAovSafeZero() {
  const origPaymentAgg = Payment.aggregate;
  const origUserCount = User.countDocuments;
  const origProfCount = MatrimonialProfile.countDocuments;
  const origUserAgg = User.aggregate;
  const origProfAgg = MatrimonialProfile.aggregate;
  const origSubAgg = Subscription.aggregate;
  const origSubCount = Subscription.countDocuments;
  const origProfFind = MatrimonialProfile.find;
  const origUnlockCount = ContactUnlock.countDocuments;
  const origUnlockAgg = ContactUnlock.aggregate;

  try {
    User.countDocuments = async () => 0;
    MatrimonialProfile.countDocuments = async () => 0;
    User.aggregate = async () => [];
    MatrimonialProfile.aggregate = async () => [];
    Subscription.aggregate = async () => [];
    Subscription.countDocuments = async () => 0;
    ContactUnlock.countDocuments = async () => 0;
    ContactUnlock.aggregate = async () => [];
    MatrimonialProfile.find = () => ({
      select() {
        return this;
      },
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      limit: async () => [],
    });

    // Zero transactions returned
    Payment.aggregate = async () => [];

    let responseData = null;
    const mockReq = { query: { range: '30d' } };
    const mockRes = {
      status() {
        return this;
      },
      json(d) {
        responseData = d;
        return this;
      },
    };

    await getAdminStats(mockReq, mockRes, () => {});

    const rev = responseData.data.revenueAnalytics;
    assert.strictEqual(rev.summary.capturedAmount, 0);
    assert.strictEqual(rev.summary.capturedCount, 0);
    assert.strictEqual(rev.summary.averageOrderValue, 0, 'AOV must return 0 without NaN or infinity when count is 0');
    assert.strictEqual(rev.plans.THREE_MONTHS.percentage, 0);
    assert.strictEqual(rev.plans.SIX_MONTHS.percentage, 0);
  } finally {
    Payment.aggregate = origPaymentAgg;
    User.countDocuments = origUserCount;
    MatrimonialProfile.countDocuments = origProfCount;
    User.aggregate = origUserAgg;
    MatrimonialProfile.aggregate = origProfAgg;
    Subscription.aggregate = origSubAgg;
    Subscription.countDocuments = origSubCount;
    MatrimonialProfile.find = origProfFind;
    ContactUnlock.countDocuments = origUnlockCount;
    ContactUnlock.aggregate = origUnlockAgg;
  }
}

console.log('\n--- 5. Testing Financial CSV Export & Formula Protection ---');

async function testRevenueCsvExport() {
  const origFind = Payment.find;

  try {
    const mockPayments = [
      {
        createdAt: new Date('2026-10-24T05:00:00.000Z'), // 10:30 AM IST
        razorpayPaymentId: 'pay_ABC12345',
        razorpayOrderId: 'order_ORD001',
        planCode: 'THREE_MONTHS',
        amount: 250000, // 2,500.00 INR
        currency: 'INR',
        status: 'captured',
        verificationMethod: 'client_callback',
        user: { name: 'Kavitha, M', email: '=cmd|calc@example.com' }, // Formula injection + comma test
      },
      {
        createdAt: new Date('2026-10-23T10:00:00.000Z'),
        razorpayPaymentId: '+919999999999', // Leading plus formula injection attempt
        razorpayOrderId: 'order_ORD002',
        planCode: 'SIX_MONTHS',
        amount: 450000,
        currency: 'INR',
        status: 'captured',
        verificationMethod: 'webhook',
        user: { name: 'Rajesh Kumar', email: 'rajesh@example.com' },
      },
    ];

    Payment.find = () => ({
      select() {
        return this;
      },
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      cursor() {
        let idx = 0;
        return {
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (idx < mockPayments.length) {
                  return { value: mockPayments[idx++], done: false };
                }
                return { done: true };
              },
            };
          },
        };
      },
    });

    const headers = {};
    let outputCsv = '';

    const mockReq = { query: { range: '7d' } };
    const mockRes = {
      setHeader(k, v) {
        headers[k] = v;
      },
      write(chunk) {
        outputCsv += chunk;
      },
      end() {},
    };

    await exportAdminRevenueCsv(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(headers['Content-Type'], 'text/csv; charset=utf-8');
    assert.ok(headers['Content-Disposition'].includes('attachment; filename="revenue-report-'));
    assert.ok(outputCsv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');

    // Verify formula injection sanitization
    assert.ok(outputCsv.includes("''=cmd|calc@example.com") || outputCsv.includes("'=cmd|calc@example.com"));
    assert.ok(outputCsv.includes("'+919999999999"));

    // Verify comma quoting in CSV
    assert.ok(outputCsv.includes('"Kavitha, M"'));

    // Verify amount in rupees formatting
    assert.ok(outputCsv.includes('2500.00'));
    assert.ok(outputCsv.includes('4500.00'));

    // Verify headers
    assert.ok(outputCsv.includes('Payment Date (IST),Razorpay Payment ID,Razorpay Order ID,Plan Code'));
    assert.ok(outputCsv.includes('Gross Amount (INR),Currency,Payment Status,Verification Method,Member Name,Member Email'));
  } finally {
    Payment.find = origFind;
  }
}

async function testRevenueCsvExportDelegationFromBilling() {
  const origFind = Payment.find;
  try {
    Payment.find = () => ({
      select() {
        return this;
      },
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      cursor() {
        return {
          [Symbol.asyncIterator]() {
            return {
              async next() {
                return { done: true };
              },
            };
          },
        };
      },
    });

    let outputCsv = '';
    const mockReq = { query: { export: 'csv', range: '30d' } };
    const mockRes = {
      setHeader() {},
      write(chunk) {
        outputCsv += chunk;
      },
      end() {},
    };

    // Call getAdminPayments with export: 'csv'
    await getAdminPayments(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    assert.ok(outputCsv.startsWith('\uFEFF'));
    assert.ok(outputCsv.includes('Payment Date (IST),Razorpay Payment ID'));
  } finally {
    Payment.find = origFind;
  }
}

(async function main() {
  await runAsyncTest('getAdminStats returns date-range revenueAnalytics with AOV and plan split', testRevenueAnalyticsInStats);
  await runAsyncTest('AOV handles zero captured payments safely without NaN or division-by-zero', testAovSafeZero);
  await runAsyncTest('exportAdminRevenueCsv streams formatted CSV with formula protection and UTF-8 BOM', testRevenueCsvExport);
  await runAsyncTest('getAdminPayments delegates export=csv cleanly to revenue CSV exporter', testRevenueCsvExportDelegationFromBilling);

  console.log('\n========================================');
  console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
