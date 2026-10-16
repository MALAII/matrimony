const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration from backend/.env if present
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { connectDB } = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_ADMIN_PASSWORD_LENGTH = 12;

/**
 * Validates and provisions initial administrator account.
 * Safe and idempotent to execute multiple times.
 */
async function seedAdmin() {
  const name = process.env.INITIAL_ADMIN_NAME;
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  // 1. Validate environment configuration
  if (!name || typeof name !== 'string' || !name.trim()) {
    console.error('[Seed Admin Error] INITIAL_ADMIN_NAME environment variable is required and must not be empty.');
    process.exit(1);
  }

  if (name.trim().length < 2) {
    console.error('[Seed Admin Error] INITIAL_ADMIN_NAME must be at least 2 characters long.');
    process.exit(1);
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    console.error('[Seed Admin Error] INITIAL_ADMIN_EMAIL environment variable is required and must not be empty.');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    console.error('[Seed Admin Error] INITIAL_ADMIN_EMAIL must be a valid email address format.');
    process.exit(1);
  }

  if (!password || typeof password !== 'string') {
    console.error('[Seed Admin Error] INITIAL_ADMIN_PASSWORD environment variable is required.');
    process.exit(1);
  }

  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    console.error(
      `[Seed Admin Error] INITIAL_ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters long for administrator accounts.`
    );
    process.exit(1);
  }

  let dbConnection = null;

  try {
    // 2. Establish database connection using existing configuration
    dbConnection = await connectDB();
    if (!dbConnection || mongoose.connection.readyState !== 1) {
      console.error('[Seed Admin Error] Failed to connect to MongoDB Atlas. Please verify MONGODB_URI.');
      process.exit(1);
    }

    // 3. Inspect existing account under configured email
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (existingUser.role === 'admin') {
        console.log(`[Seed Admin] Administrator account already exists for '${normalizedEmail}'. No changes were made.`);
        await mongoose.connection.close();
        process.exit(0);
      } else {
        console.error(
          `[Seed Admin Error] An account with email '${normalizedEmail}' already exists as a normal user (role: '${existingUser.role}'). For security, normal accounts are never automatically promoted. Aborting.`
        );
        await mongoose.connection.close();
        process.exit(1);
      }
    }

    // 4. Secure password hashing with bcryptjs (10 salt rounds)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 5. Create new User with role 'admin'
    await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'admin',
    });

    console.log(`[Seed Admin] Initial administrator account successfully provisioned for '${normalizedEmail}'.`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`[Seed Admin Error] Failed to provision administrator account: ${error.message}`);
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      try {
        await mongoose.connection.close();
      } catch (closeErr) {
        // Suppress secondary close errors
      }
    }
    process.exit(1);
  }
}

// Execute script
seedAdmin();
