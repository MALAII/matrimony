const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to authenticate requests via JWT cookie or Bearer token header
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Check for token in HttpOnly cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback to Authorization: Bearer <token> header for flexible client testing
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 3. Reject if no token is provided
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no authentication token provided',
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Auth Error] JWT_SECRET is not configured in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    // 4. Verify token signature and expiry
    const decoded = jwt.verify(token, jwtSecret);

    // 5. Look up user by decoded ID in MongoDB Atlas (never trusting client-supplied ID or role)
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user account no longer exists',
      });
    }

    // 6. Ensure user account is active
    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.accountStatus || 'inactive'}. Access denied.`,
      });
    }

    // 7. Attach authenticated user document to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token verification failed or expired',
    });
  }
};

/**
 * Middleware to restrict route access strictly to administrator accounts
 * Must be executed after the protect middleware
 */
const adminOnly = (req, res, next) => {
  // 1. Verify user was authenticated by protect middleware
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no user session found',
    });
  }

  // 2. Enforce administrator role check
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: administrator privileges required',
    });
  }

  // 3. User is authorized administrator
  next();
};

module.exports = {
  protect,
  adminOnly,
};

