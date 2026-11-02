/**
 * Automated Test Suite: Phase 1 Security Hardening
 *
 * Verifies:
 * 1. Helmet security headers presence and API-safe CSP configuration.
 * 2. CORS origin validation rules across production and development environments.
 * 3. Rate limiting token-bucket mechanics, header generation, and HTTP 429 payload.
 * 4. Topology-aware IP resolution (anti-spoofing behavior).
 * 5. Route-level mounting on POST /api/auth/register and POST /api/auth/login.
 * 6. Non-regression of existing authentication validation pipelines under the limit.
 *
 * ZERO DATABASE SIDE EFFECTS:
 * All tests execute in-memory or against mock requests without writing to MongoDB.
 */

const assert = require('assert');
const http = require('http');
const { getAllowedOrigins, isLocalhostOrigin, createCorsOptions } = require('../config/cors');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimiter');
const app = require('../app');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failedTests++;
  }
}

/**
 * Helper to make HTTP requests against a local ephemeral test server.
 */
function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const port = address.port;

    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path || '/',
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runSuite() {
  console.log('====================================================');
  console.log('  Phase 1 Security Hardening Test Suite');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // Group 1: CORS Policy and Origin Rules
  // --------------------------------------------------------------------------
  console.log('--- Group 1: CORS Rules and Origin Validation ---');

  runTest('CORS: isLocalhostOrigin correctly identifies loopback hostnames', () => {
    assert.strictEqual(isLocalhostOrigin('http://localhost:3000'), true);
    assert.strictEqual(isLocalhostOrigin('http://127.0.0.1:3000'), true);
    assert.strictEqual(isLocalhostOrigin('http://[::1]:3000'), true);
    assert.strictEqual(isLocalhostOrigin('http://localhost'), true);
    assert.strictEqual(isLocalhostOrigin('https://sub.localhost:8080'), true);
    assert.strictEqual(isLocalhostOrigin('https://matrimony.example.com'), false);
    assert.strictEqual(isLocalhostOrigin('https://evil-localhost.com'), false);
    assert.strictEqual(isLocalhostOrigin(''), false);
    assert.strictEqual(isLocalhostOrigin(null), false);
  });

  runTest('CORS: Development environment permits configured and localhost origins', () => {
    const origins = getAllowedOrigins('development', {
      CLIENT_URL: 'http://localhost:3000',
      ALLOWED_ORIGINS: 'http://localhost:3001,https://dev.preview.local',
    });
    assert(origins.includes('http://localhost:3000'));
    assert(origins.includes('http://127.0.0.1:3000'));
    assert(origins.includes('http://localhost:3001'));
    assert(origins.includes('https://dev.preview.local'));
  });

  runTest('CORS: Production environment strictly excludes localhost and loopback origins', () => {
    const origins = getAllowedOrigins('production', {
      CLIENT_URL: 'http://localhost:3000', // accidental localhost in CLIENT_URL
      ALLOWED_ORIGINS: 'https://matrimony.example.com,http://127.0.0.1:3000',
    });
    // Localhost and 127.0.0.1 must be purged from production origins
    assert.strictEqual(origins.includes('http://localhost:3000'), false);
    assert.strictEqual(origins.includes('http://127.0.0.1:3000'), false);
    assert.strictEqual(origins.includes('https://matrimony.example.com'), true);
    assert.strictEqual(origins.length, 1);
  });

  runTest('CORS: createCorsOptions blocks unauthorized origins in production with 403 error', () => {
    const options = createCorsOptions('production', {
      ALLOWED_ORIGINS: 'https://matrimony.example.com',
    });

    let allowedResult = null;
    options.origin('https://matrimony.example.com', (err, allow) => {
      allowedResult = { err, allow };
    });
    assert.strictEqual(allowedResult.err, null);
    assert.strictEqual(allowedResult.allow, true);

    let rejectedResult = null;
    options.origin('http://localhost:3000', (err, allow) => {
      rejectedResult = { err, allow };
    });
    assert(rejectedResult.err instanceof Error);
    assert.strictEqual(rejectedResult.err.statusCode, 403);
    assert.match(rejectedResult.err.message, /CORS policy: Access denied for origin/);

    // Requests with no origin (curl, mobile app, webhook callbacks) must be allowed
    let noOriginResult = null;
    options.origin(undefined, (err, allow) => {
      noOriginResult = { err, allow };
    });
    assert.strictEqual(noOriginResult.err, null);
    assert.strictEqual(noOriginResult.allow, true);
  });

  // --------------------------------------------------------------------------
  // Group 2: Rate Limiter Mechanics and IP Resolution
  // --------------------------------------------------------------------------
  console.log('\n--- Group 2: Rate Limiter Mechanics and IP Resolution ---');

  runTest('RateLimiter: getClientIp respects Express req.ip and falls back to socket', () => {
    // When Express trust proxy is configured, req.ip is populated
    const mockReqWithIp = { ip: '203.0.113.195', headers: { 'x-forwarded-for': '10.0.0.1' } };
    assert.strictEqual(getClientIp(mockReqWithIp), '203.0.113.195');

    // When req.ip is unset, socket address is used
    const mockReqWithSocket = { socket: { remoteAddress: '192.168.1.50' }, headers: {} };
    assert.strictEqual(getClientIp(mockReqWithSocket), '192.168.1.50');

    // Untrusted fallback
    const mockReqEmpty = { headers: { 'x-forwarded-for': '198.51.100.1' } };
    assert.strictEqual(getClientIp(mockReqEmpty), 'unknown');
  });

  runTest('RateLimiter: Limits requests, sets headers, and returns 429 with Retry-After', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 3,
      message: 'Rate limit exceeded for test',
    });

    const headers = {};
    const mockRes = () => {
      const res = {
        statusCode: 200,
        headers: {},
        setHeader(name, val) {
          this.headers[name] = val;
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };
      return res;
    };

    const mockReq = { ip: '198.51.100.5' };
    let nextCalled = 0;
    const next = () => { nextCalled++; };

    // Request 1: allowed
    let res = mockRes();
    limiter(mockReq, res, next);
    assert.strictEqual(nextCalled, 1);
    assert.strictEqual(res.headers['X-RateLimit-Limit'], 3);
    assert.strictEqual(res.headers['X-RateLimit-Remaining'], 2);

    // Request 2: allowed
    res = mockRes();
    limiter(mockReq, res, next);
    assert.strictEqual(nextCalled, 2);
    assert.strictEqual(res.headers['X-RateLimit-Remaining'], 1);

    // Request 3: allowed (hits limit)
    res = mockRes();
    limiter(mockReq, res, next);
    assert.strictEqual(nextCalled, 3);
    assert.strictEqual(res.headers['X-RateLimit-Remaining'], 0);

    // Request 4: blocked (exceeds limit)
    res = mockRes();
    limiter(mockReq, res, next);
    assert.strictEqual(nextCalled, 3, 'next() must NOT be called on blocked request');
    assert.strictEqual(res.statusCode, 429);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Rate limit exceeded for test');
    assert(Number(res.headers['Retry-After']) >= 1);

    // Independent IP should not be blocked
    const otherReq = { ip: '198.51.100.6' };
    res = mockRes();
    limiter(otherReq, res, next);
    assert.strictEqual(nextCalled, 4, 'Different IP must have independent rate quota');
    assert.strictEqual(res.headers['X-RateLimit-Remaining'], 2);

    limiter.destroy();
  });

  // --------------------------------------------------------------------------
  // Group 3: Integrated HTTP Server & Security Headers
  // --------------------------------------------------------------------------
  console.log('\n--- Group 3: Integrated HTTP Server & Security Headers ---');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    await runAsyncTest('Helmet: Response contains essential security headers and disables API-breaking CSP', async () => {
      const res = await makeRequest(server, { path: '/api/health', method: 'GET' });
      assert.strictEqual(res.statusCode, 200);

      // Verify essential Helmet security headers
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
      assert.strictEqual(res.headers['x-download-options'], 'noopen');
      assert.strictEqual(res.headers['x-permitted-cross-domain-policies'], 'none');
      assert.strictEqual(res.headers['cross-origin-resource-policy'], 'cross-origin');

      // Verify that HTML-oriented Content-Security-Policy is disabled so it doesn't break API clients
      assert.strictEqual(res.headers['content-security-policy'], undefined);
    });

    await runAsyncTest('RateLimiting: POST /api/auth/register enforces rate limit and returns 429', async () => {
      if (app.registerLimiter && app.registerLimiter.reset) {
        app.registerLimiter.reset();
      }

      // Configure a temporary small limit by mocking or making repeated requests up to the max
      // The default limit is 10. Let's make 10 requests followed by the 11th.
      let lastRes = null;
      for (let i = 1; i <= 10; i++) {
        lastRes = await makeRequest(server, {
          path: '/api/auth/register',
          method: 'POST',
        }, {
          // Missing required fields intentionally triggers 400 validation error inside route handler,
          // proving request passed through rate limiter to route
        });
        // Before limit is exceeded, status is 400 (Bad Request from validation), NOT 429
        assert.strictEqual(lastRes.statusCode, 400);
        assert.strictEqual(Number(lastRes.headers['x-ratelimit-remaining']), 10 - i);
      }

      // 11th request must be rejected with 429 by registerLimiter
      const blockedRes = await makeRequest(server, {
        path: '/api/auth/register',
        method: 'POST',
      }, {});
      assert.strictEqual(blockedRes.statusCode, 429);
      assert.strictEqual(blockedRes.body.success, false);
      assert.match(blockedRes.body.message, /Too many registration attempts/);
      assert(Number(blockedRes.headers['retry-after']) >= 1);

      // Reset limiter for test cleanup
      if (app.registerLimiter && app.registerLimiter.reset) {
        app.registerLimiter.reset();
      }
    });

    await runAsyncTest('RateLimiting: POST /api/auth/login enforces rate limit and returns 429', async () => {
      if (app.loginLimiter && app.loginLimiter.reset) {
        app.loginLimiter.reset();
      }

      // Default login limit is 15. Make 15 requests followed by the 16th.
      let lastRes = null;
      for (let i = 1; i <= 15; i++) {
        lastRes = await makeRequest(server, {
          path: '/api/auth/login',
          method: 'POST',
        }, {
          // Missing email/password triggers 400 from login validation
        });
        assert.strictEqual(lastRes.statusCode, 400);
        assert.strictEqual(Number(lastRes.headers['x-ratelimit-remaining']), 15 - i);
      }

      // 16th request must be rejected with 429 by loginLimiter
      const blockedRes = await makeRequest(server, {
        path: '/api/auth/login',
        method: 'POST',
      }, {});
      assert.strictEqual(blockedRes.statusCode, 429);
      assert.strictEqual(blockedRes.body.success, false);
      assert.match(blockedRes.body.message, /Too many login attempts/);
      assert(Number(blockedRes.headers['retry-after']) >= 1);

      // Reset limiter for test cleanup
      if (app.loginLimiter && app.loginLimiter.reset) {
        app.loginLimiter.reset();
      }
    });

    await runAsyncTest('Non-Regression: Normal authentication validation pipelines function normally under the limit', async () => {
      if (app.registerLimiter && app.registerLimiter.reset) {
        app.registerLimiter.reset();
      }
      if (app.loginLimiter && app.loginLimiter.reset) {
        app.loginLimiter.reset();
      }

      // Test invalid login payload returns standard 400 validation error
      const loginRes = await makeRequest(server, {
        path: '/api/auth/login',
        method: 'POST',
      }, {
        email: 'invalid-email-format',
      });
      assert.strictEqual(loginRes.statusCode, 400);
      assert.strictEqual(loginRes.body.success, false);
      assert(loginRes.headers['x-ratelimit-limit']);
      assert(loginRes.headers['x-ratelimit-remaining']);

      // Test invalid registration payload returns standard 400 validation error
      const registerRes = await makeRequest(server, {
        path: '/api/auth/register',
        method: 'POST',
      }, {
        email: 'invalid-email',
      });
      assert.strictEqual(registerRes.statusCode, 400);
      assert.strictEqual(registerRes.body.success, false);
    });

  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (app.registerLimiter && app.registerLimiter.reset) {
      app.registerLimiter.reset();
    }
    if (app.loginLimiter && app.loginLimiter.reset) {
      app.loginLimiter.reset();
    }
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Tests completed: ${passedTests + failedTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${failedTests}`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
