const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

/**
 * Generate signed JWT token
 */
const generateToken = (id) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }
  return jwt.sign({ id }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Get environment-appropriate cookie options
 */
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // 1. Required field validations
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required and must be a valid text string',
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters long',
      });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Email format validation
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address format',
      });
    }

    // 3. Password validations
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
      });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      });
    }

    // 4. Duplicate email check
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists',
      });
    }

    // 5. Secure password hashing
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 6. Create user in MongoDB Atlas (role is strictly enforced as "user")
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'user',
    });

    // 7. Return HTTP 201 with sanitized user data (no password or hash)
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists',
      });
    }
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and set JWT in HttpOnly cookie
 * @access  Public
 */
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Required-field validation
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    // 2. Email normalization consistent with registration
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Find registered user in MongoDB Atlas
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 4. Verify password with bcryptjs
    if (!user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Account password has not been configured. Please complete your password setup invitation.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 5. Account status gatekeeper
    if (user.accountStatus !== 'active') {
      if (user.accountStatus === 'invited') {
        return res.status(403).json({
          success: false,
          message: 'Your account is pending password activation. Please check your email for the invitation link.',
        });
      }
      return res.status(403).json({
        success: false,
        message: `Your account is currently ${user.accountStatus}. Please contact support.`,
      });
    }

    // 5. Generate token and set in HttpOnly cookie
    const token = generateToken(user._id);
    res.cookie('token', token, getCookieOptions());

    // 6. Return HTTP 200 with sanitized user info (never password or passwordHash)
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user's profile
 * @access  Private (requires protect middleware)
 */
const getCurrentUser = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
    },
  });
};

/**
 * @route   POST /api/auth/logout
 * @desc    Clear authentication cookie and log user out
 * @access  Public / Private
 */
const logoutUser = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

const crypto = require('crypto');

/**
 * Hash raw token using SHA-256 for database lookup
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
};

/**
 * @route   GET /api/auth/setup-password/verify?token=...
 * @desc    Verify invitation token validity without consuming it (safe against email scanners)
 * @access  Public
 */
const verifySetupToken = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is missing or malformed',
      });
    }

    const tokenHash = hashToken(token.trim());

    // Find invited user with matching token and unexpired timestamp
    const user = await User.findOne({
      invitationTokenHash: tokenHash,
      accountStatus: 'invited',
      invitationExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This invitation link is invalid, expired, or has already been used.',
      });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    return res.status(200).json({
      success: true,
      message: 'Invitation token is valid',
      data: {
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/setup-password
 * @desc    Submit chosen password, consume invitation token, and activate candidate account
 * @access  Public
 */
const setupPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is required',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
      });
    }

    // Enforce strong minimum password length (12 characters)
    if (password.length < 12) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 12 characters long for security',
      });
    }

    const tokenHash = hashToken(token.trim());

    // 1. Hash the chosen password with bcryptjs (10 salt rounds)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 2. Atomically find and consume token to prevent race conditions or replay attacks
    const updatedUser = await User.findOneAndUpdate(
      {
        invitationTokenHash: tokenHash,
        accountStatus: 'invited',
        invitationExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          passwordHash,
          accountStatus: 'active',
          emailVerifiedAt: new Date(),
          invitationTokenHash: null,
          invitationExpiresAt: null,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedUser) {
      return res.status(400).json({
        success: false,
        message: 'This invitation link is invalid, expired, or has already been used.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password configured successfully. You may now log in to your account.',
      data: {
        id: updatedUser._id,
        email: updatedUser.email,
        accountStatus: updatedUser.accountStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  verifySetupToken,
  setupPassword,
};
