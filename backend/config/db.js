const mongoose = require('mongoose');

/**
 * Establishes connection to MongoDB database (supports MongoDB Atlas and standard URIs)
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  // Validate that MONGODB_URI is provided
  if (!mongoUri || !mongoUri.trim() || mongoUri.includes('<username>')) {
    console.error(
      '\n========================================================================' +
      '\n[MongoDB Configuration Error]' +
      '\nMONGODB_URI is not configured in backend/.env.' +
      '\nPlease provide a valid MongoDB Atlas connection string:' +
      '\nFormat: mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority' +
      '\n========================================================================\n'
    );
    return null;
  }

  try {
    // Explicitly disable automatic index creation globally to enforce controlled migrations
    mongoose.set('autoIndex', false);

    // Connect using Mongoose with serverSelectionTimeoutMS to prevent hanging on network/firewall issues
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: false,
    });

    // Masked logging - only display host and database name, NEVER credentials or URI string
    const host = conn.connection.host || 'remote-cluster';
    const dbName = conn.connection.name || 'matrimony_db';
    console.log(`[MongoDB] Connected successfully to host: ${host} | Database: ${dbName}`);

    return conn;
  } catch (error) {
    // Safe error reporting without exposing connection credentials
    console.error(`[MongoDB] Connection error: ${error.message}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

/**
 * Returns current database connection status
 */
const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

/**
 * Returns current database host name (safe host identifier, e.g. Atlas cluster host or null)
 */
const getDBHost = () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection.host || null;
  }
  return null;
};

module.exports = { connectDB, getDBStatus, getDBHost };
