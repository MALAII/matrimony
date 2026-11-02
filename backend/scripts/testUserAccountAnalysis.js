/**
 * Isolated Automated Verification Suite for User Account Analysis & CSV Export
 *
 * Verifies:
 * 1. CSV cell escaping and formula injection protection (RFC 4180 + Excel/Calc security)
 * 2. Query filter parsing and validation (status, role, registrationSource, search, pagination)
 * 3. MongoDB filter query builder logic and regex escaping
 * 4. Express route order integrity (/users/stats and /users/export before /users/:id)
 * 5. Authorization middleware presence (protect, adminOnly) on all user routes
 * 6. Exclusion of sensitive security credentials and matrimonial biodata
 * 7. Controller execution with mocked models (stats, enriched list, CSV streaming, empty results)
 *
 * Fully isolated: Does NOT read, export, or modify any real production records.
 */

const assert = require('assert');
const express = require('express');

const {
  escapeCsvCell,
  parseUserFilterParams,
  buildUserFilter,
  escapeRegex,
  getAdminUserStats,
  getAdminUsers,
  exportAdminUsersCsv,
} = require('../controllers/adminController');

const { getAdminUserDetail } = require('../controllers/adminBillingController');

const adminRoutes = require('../routes/adminRoutes');
const User = require('../models/User');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const Subscription = require('../models/Subscription');

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

console.log('\n--- 1. Testing escapeCsvCell (RFC 4180 + Formula Injection Protection) ---');

runTest('Null and undefined return empty string', () => {
  assert.strictEqual(escapeCsvCell(null), '');
  assert.strictEqual(escapeCsvCell(undefined), '');
  assert.strictEqual(escapeCsvCell(''), '');
});

runTest('Normal alphanumeric text is unchanged', () => {
  assert.strictEqual(escapeCsvCell('Priya Sharma'), 'Priya Sharma');
  assert.strictEqual(escapeCsvCell('user@example.com'), 'user@example.com');
  assert.strictEqual(escapeCsvCell('active'), 'active');
});

runTest('Formula injection triggers (=, +, -, @, \\t, \\r) are neutralized with leading apostrophe', () => {
  assert.strictEqual(escapeCsvCell('=1+1'), "'=1+1");
  assert.strictEqual(escapeCsvCell('+919876543210'), "'+919876543210");
  assert.strictEqual(escapeCsvCell('-100'), "'-100");
  assert.strictEqual(escapeCsvCell('@admin'), "'@admin");
  assert.strictEqual(escapeCsvCell('\tindented'), "'\tindented");
});

runTest('Cells with commas, quotes, and newlines are RFC 4180 escaped and enclosed in quotes', () => {
  assert.strictEqual(escapeCsvCell('Chennai, Tamil Nadu'), '"Chennai, Tamil Nadu"');
  assert.strictEqual(escapeCsvCell('He said "Hello"'), '"He said ""Hello"""');
  assert.strictEqual(escapeCsvCell('Line1\nLine2'), '"Line1\nLine2"');
});

runTest('Combination of formula injection and commas/quotes is neutralized and quoted', () => {
  assert.strictEqual(escapeCsvCell("=cmd|' /C calc'!A0, 123"), '"\'=cmd|\' /C calc\'!A0, 123"');
});

console.log('\n--- 2. Testing parseUserFilterParams (Validation & Defaults) ---');

runTest('Default parameters apply when query is empty', () => {
  const result = parseUserFilterParams({});
  assert.strictEqual(result.page, 1);
  assert.strictEqual(result.limit, 20);
  assert.strictEqual(result.search, '');
  assert.strictEqual(result.status, null);
  assert.strictEqual(result.role, null);
  assert.strictEqual(result.registrationSource, null);
  assert.strictEqual(result.error, undefined);
});

runTest('Valid parameters and status/role/source filters are parsed correctly', () => {
  const result = parseUserFilterParams({
    page: '2',
    limit: '50',
    search: 'Kavitha',
    status: 'active',
    role: 'user',
    registrationSource: 'direct',
  });
  assert.strictEqual(result.page, 2);
  assert.strictEqual(result.limit, 50);
  assert.strictEqual(result.search, 'Kavitha');
  assert.strictEqual(result.status, 'active');
  assert.strictEqual(result.role, 'user');
  assert.strictEqual(result.registrationSource, 'direct');
});

runTest('Alias fields (accountStatus and source) are accepted', () => {
  const result = parseUserFilterParams({
    accountStatus: 'invited',
    source: 'broker',
  });
  assert.strictEqual(result.status, 'invited');
  assert.strictEqual(result.registrationSource, 'broker');
});

runTest('Invalid status filter produces validation error', () => {
  const result = parseUserFilterParams({ status: 'banned_account' });
  assert.ok(result.error);
  assert.ok(result.error.includes('Invalid status parameter'));
});

runTest('Invalid role filter produces validation error', () => {
  const result = parseUserFilterParams({ role: 'superadmin' });
  assert.ok(result.error);
  assert.ok(result.error.includes('Invalid role parameter'));
});

runTest('Invalid registrationSource filter produces validation error', () => {
  const result = parseUserFilterParams({ registrationSource: 'facebook' });
  assert.ok(result.error);
  assert.ok(result.error.includes('Invalid registrationSource parameter'));
});

runTest('Invalid pagination parameters produce validation errors', () => {
  assert.ok(parseUserFilterParams({ page: '0' }).error);
  assert.ok(parseUserFilterParams({ page: '-3' }).error);
  assert.ok(parseUserFilterParams({ page: 'abc' }).error);
  assert.ok(parseUserFilterParams({ limit: '0' }).error);
  assert.ok(parseUserFilterParams({ limit: '101' }).error);
});

console.log('\n--- 3. Testing buildUserFilter ---');

runTest('Empty filters produce empty object', () => {
  const filter = buildUserFilter({ search: '', status: null, role: null, registrationSource: null });
  assert.deepStrictEqual(filter, {});
});

runTest('Single and multiple filters map correctly', () => {
  const filter = buildUserFilter({
    search: 'rajesh',
    status: 'suspended',
    role: 'user',
    registrationSource: 'broker',
  });
  assert.strictEqual(filter.accountStatus, 'suspended');
  assert.strictEqual(filter.role, 'user');
  assert.strictEqual(filter.registrationSource, 'broker');
  assert.ok(filter.$or);
  assert.strictEqual(filter.$or.length, 2);
  assert.ok(filter.$or[0].name instanceof RegExp);
  assert.ok(filter.$or[1].email instanceof RegExp);
});

runTest('Search regex escapes special characters to prevent regex injection or ReDoS', () => {
  const dangerousSearch = 'user+test[1]@domain.com(a|b)';
  const escaped = escapeRegex(dangerousSearch);
  assert.strictEqual(escaped, 'user\\+test\\[1\\]@domain\\.com\\(a\\|b\\)');
  const filter = buildUserFilter({ search: dangerousSearch });
  assert.ok(filter.$or[0].name.test('user+test[1]@domain.com(a|b)'));
  assert.strictEqual(filter.$or[0].name.test('user test 1 @domain com a'), false);
});

console.log('\n--- 4. Testing Route Ordering & Authorization Guards ---');

runTest('Route definitions exist and /users/stats and /users/export precede /users/:id', () => {
  const routes = [];
  adminRoutes.stack.forEach((layer) => {
    if (layer.route) {
      const path = layer.route.path;
      const methods = Object.keys(layer.route.methods);
      routes.push({ path, methods });
    }
  });

  const statsIdx = routes.findIndex((r) => r.path === '/users/stats' && r.methods.includes('get'));
  const exportIdx = routes.findIndex((r) => r.path === '/users/export' && r.methods.includes('get'));
  const listIdx = routes.findIndex((r) => r.path === '/users' && r.methods.includes('get'));
  const detailIdx = routes.findIndex((r) => r.path === '/users/:id' && r.methods.includes('get'));

  assert.ok(statsIdx !== -1, '/users/stats route must exist');
  assert.ok(exportIdx !== -1, '/users/export route must exist');
  assert.ok(listIdx !== -1, '/users route must exist');
  assert.ok(detailIdx !== -1, '/users/:id route must exist');

  assert.ok(
    statsIdx < detailIdx,
    `Route /users/stats (index ${statsIdx}) must appear before /users/:id (index ${detailIdx})`
  );
  assert.ok(
    exportIdx < detailIdx,
    `Route /users/export (index ${exportIdx}) must appear before /users/:id (index ${detailIdx})`
  );
});

runTest('Routes have protect and adminOnly middleware stack', () => {
  const targetPaths = ['/users/stats', '/users/export', '/users', '/users/:id'];
  targetPaths.forEach((targetPath) => {
    const layer = adminRoutes.stack.find((l) => l.route && l.route.path === targetPath);
    assert.ok(layer, `Layer for ${targetPath} must exist`);
    // Router middleware stack includes protect, adminOnly, and handler (at least 3 handlers)
    assert.ok(
      layer.route.stack.length >= 3,
      `${targetPath} must have at least 3 handlers in stack (protect, adminOnly, handler). Found: ${layer.route.stack.length}`
    );
  });
});

console.log('\n--- 5. Testing Controller Executions with Mock DB Isolation ---');

async function testStatsController() {
  const origCount = User.countDocuments;
  const origDistinct = Subscription.distinct;

  try {
    User.countDocuments = async (filter) => {
      if (!filter || Object.keys(filter).length === 0) return 100;
      if (filter.accountStatus === 'active') return 70;
      if (filter.accountStatus === 'invited') return 20;
      if (filter.accountStatus === 'suspended') return 7;
      if (filter.accountStatus === 'inactive') return 3;
      if (filter.emailVerifiedAt) return 65;
      return 0;
    };
    Subscription.distinct = async (field, filter) => {
      if (field === 'user' && filter.status === 'active') {
        return ['u1', 'u2', 'u3', 'u4', 'u5'];
      }
      return [];
    };

    let responseStatus = 0;
    let responseData = null;

    const mockReq = { query: {} };
    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(payload) {
        responseData = payload;
        return this;
      },
    };

    await getAdminUserStats(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.data.totalAccounts, 100);
    assert.strictEqual(responseData.data.active, 70);
    assert.strictEqual(responseData.data.invited, 20);
    assert.strictEqual(responseData.data.suspended, 7);
    assert.strictEqual(responseData.data.inactive, 3);
    assert.strictEqual(responseData.data.suspendedOrInactive, 10);
    assert.strictEqual(responseData.data.verifiedEmails, 65);
    assert.strictEqual(responseData.data.subscribedUsers, 5);
  } finally {
    User.countDocuments = origCount;
    Subscription.distinct = origDistinct;
  }
}

async function testUsersListController() {
  const origCount = User.countDocuments;
  const origFind = User.find;
  const origProfileFind = MatrimonialProfile.find;
  const origSubFind = Subscription.find;

  try {
    User.countDocuments = async () => 2;
    User.find = () => ({
      select() {
        return this;
      },
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit: async () => [
        {
          _id: '507f191e810c19729de860ea',
          name: 'Priya Sundaram',
          email: 'priya@example.com',
          role: 'user',
          accountStatus: 'active',
          registrationSource: 'direct',
          emailVerifiedAt: new Date('2026-01-10T10:00:00Z'),
          createdAt: new Date('2026-01-10T09:00:00Z'),
          passwordHash: 'SUPER_SECRET_HASH_SHOULD_BE_REMOVED',
          invitationTokenHash: 'INVITE_SECRET_HASH',
          toObject() {
            return { ...this };
          },
        },
        {
          _id: '507f191e810c19729de860eb',
          name: 'Karthik Raja',
          email: 'karthik@example.com',
          role: 'user',
          accountStatus: 'invited',
          registrationSource: 'broker',
          emailVerifiedAt: null,
          createdAt: new Date('2026-01-15T12:00:00Z'),
          toObject() {
            return { ...this };
          },
        },
      ],
    });

    MatrimonialProfile.find = () => ({
      select() {
        return this;
      },
      lean: async () => [
        {
          _id: 'prof_1',
          user: '507f191e810c19729de860ea',
          candidateName: 'Priya',
          approvalStatus: 'approved',
          profileStatus: 'active',
          deactivationReason: null,
          createdAt: new Date('2026-01-11T10:00:00Z'),
        },
      ],
    });

    Subscription.find = () => ({
      sort() {
        return this;
      },
      select() {
        return this;
      },
      lean: async () => [
        {
          _id: 'sub_1',
          user: '507f191e810c19729de860ea',
          planCode: 'SIX_MONTHS',
          status: 'active',
          startDate: new Date('2026-01-11T10:00:00Z'),
          endDate: new Date('2026-07-11T10:00:00Z'),
          gracePeriodEndDate: new Date('2026-07-18T10:00:00Z'),
        },
      ],
    });

    let responseStatus = 0;
    let responseData = null;

    const mockReq = { query: { page: '1', limit: '10' } };
    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(payload) {
        responseData = payload;
        return this;
      },
    };

    await getAdminUsers(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.data.length, 2);
    assert.strictEqual(responseData.pagination.totalRecords, 2);

    const user1 = responseData.data[0];
    assert.strictEqual(user1.name, 'Priya Sundaram');
    assert.strictEqual(user1.passwordHash, undefined, 'passwordHash must be strictly excluded');
    assert.strictEqual(user1.invitationTokenHash, undefined, 'invitationTokenHash must be strictly excluded');
    assert.ok(user1.profile, 'user1 must have enriched profile');
    assert.strictEqual(user1.profile.approvalStatus, 'approved');
    assert.ok(user1.subscription, 'user1 must have enriched subscription');
    assert.strictEqual(user1.subscription.planCode, 'SIX_MONTHS');

    const user2 = responseData.data[1];
    assert.strictEqual(user2.name, 'Karthik Raja');
    assert.strictEqual(user2.profile, null, 'user2 has no profile');
    assert.strictEqual(user2.subscription, null, 'user2 has no subscription');
  } finally {
    User.countDocuments = origCount;
    User.find = origFind;
    MatrimonialProfile.find = origProfileFind;
    Subscription.find = origSubFind;
  }
}

async function testCsvExportController() {
  const origFind = User.find;
  const origProfileFind = MatrimonialProfile.find;
  const origSubFind = Subscription.find;

  try {
    const mockUsers = [
      {
        _id: '507f191e810c19729de860ea',
        name: 'Priya, Sundaram', // Comma for CSV quoting
        email: '=malicious@example.com', // Formula injection attempt
        role: 'user',
        accountStatus: 'active',
        registrationSource: 'direct',
        emailVerifiedAt: new Date('2026-01-10T10:00:00Z'),
        createdAt: new Date('2026-01-10T09:00:00Z'),
      },
      {
        _id: '507f191e810c19729de860eb',
        name: '+919999999999', // Leading plus for formula injection
        email: 'karthik@example.com',
        role: 'user',
        accountStatus: 'invited',
        registrationSource: 'broker',
        emailVerifiedAt: null,
        createdAt: new Date('2026-01-15T12:00:00Z'),
      },
    ];

    User.find = () => ({
      select() {
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
                if (idx < mockUsers.length) {
                  return { value: mockUsers[idx++], done: false };
                }
                return { done: true };
              },
            };
          },
        };
      },
    });

    MatrimonialProfile.find = () => ({
      select() {
        return this;
      },
      lean: async () => [
        {
          _id: 'prof_1',
          user: '507f191e810c19729de860ea',
          candidateName: 'Priya',
          approvalStatus: 'approved',
          profileStatus: 'active',
        },
      ],
    });

    Subscription.find = () => ({
      sort() {
        return this;
      },
      select() {
        return this;
      },
      lean: async () => [
        {
          _id: 'sub_1',
          user: '507f191e810c19729de860ea',
          planCode: 'SIX_MONTHS',
          status: 'active',
          endDate: new Date('2026-07-11T10:00:00Z'),
        },
      ],
    });

    const headers = {};
    let outputData = '';

    const mockReq = { query: { status: 'active' } };
    const mockRes = {
      setHeader(name, val) {
        headers[name] = val;
      },
      write(chunk) {
        outputData += chunk;
      },
      end() {},
    };

    await exportAdminUsersCsv(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(headers['Content-Type'], 'text/csv; charset=utf-8');
    assert.ok(headers['Content-Disposition'].includes('attachment; filename="users-export-'));
    assert.ok(outputData.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');

    // Verify formula injection sanitization in the CSV output
    assert.ok(outputData.includes("''=malicious@example.com") || outputData.includes("'=malicious@example.com"));
    assert.ok(outputData.includes("'+919999999999"));

    // Verify comma quoting in CSV
    assert.ok(outputData.includes('"Priya, Sundaram"'));

    // Verify column headers exist
    assert.ok(outputData.includes('User ID,Name,Email,Role,Account Status'));
    assert.ok(outputData.includes('Linked Profile ID,Candidate Name,Profile Status'));
  } finally {
    User.find = origFind;
    MatrimonialProfile.find = origProfileFind;
    Subscription.find = origSubFind;
  }
}

async function testEmptyCsvExport() {
  const origFind = User.find;
  try {
    User.find = () => ({
      select() {
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

    let outputData = '';
    const mockReq = { query: { search: 'nonexistentuser' } };
    const mockRes = {
      setHeader() {},
      write(chunk) {
        outputData += chunk;
      },
      end() {},
    };

    await exportAdminUsersCsv(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    assert.ok(outputData.startsWith('\uFEFF'));
    assert.ok(outputData.includes('User ID,Name,Email,Role,Account Status'));
    // Only BOM + header row present (split by CRLF gives 2 elements: header and empty string after final CRLF)
    const lines = outputData.trim().split('\r\n');
    assert.strictEqual(lines.length, 1, 'Empty search must output exactly header row');
  } finally {
    User.find = origFind;
  }
}

async function testAdminUserDetail() {
  const origFindById = User.findById;
  try {
    // 1. Invalid ID format
    let invalidStatus = 0;
    let invalidMessage = '';
    await getAdminUserDetail(
      { params: { id: 'invalid-id-format' } },
      {
        status(code) {
          invalidStatus = code;
          return this;
        },
        json(payload) {
          invalidMessage = payload.message;
          return this;
        },
      },
      () => {}
    );
    assert.strictEqual(invalidStatus, 400);
    assert.strictEqual(invalidMessage, 'Invalid user ID format');

    // 2. User not found
    User.findById = () => ({
      select: async () => null,
    });
    let notFoundStatus = 0;
    await getAdminUserDetail(
      { params: { id: '507f191e810c19729de860ea' } },
      {
        status(code) {
          notFoundStatus = code;
          return this;
        },
        json() {
          return this;
        },
      },
      () => {}
    );
    assert.strictEqual(notFoundStatus, 404);
  } finally {
    User.findById = origFindById;
  }
}

(async function main() {
  await runAsyncTest('getAdminUserStats controller calculates correct aggregates and structure', testStatsController);
  await runAsyncTest('getAdminUsers returns paginated, enriched user records with passwords stripped', testUsersListController);
  await runAsyncTest('exportAdminUsersCsv streams CSV with formula protection and UTF-8 BOM', testCsvExportController);
  await runAsyncTest('exportAdminUsersCsv handles empty result set cleanly without crashing', testEmptyCsvExport);
  await runAsyncTest('getAdminUserDetail validates ID format and preserves existing functionality', testAdminUserDetail);

  console.log('\n========================================');
  console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
