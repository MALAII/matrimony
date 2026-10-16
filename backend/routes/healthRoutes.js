const express = require('express');
const router = express.Router();
const { getDBStatus, getDBHost } = require('../config/db');

/**
 * @route   GET /api/health
 * @desc    Health check endpoint to verify backend status
 * @access  Public
 */
router.get('/health', (req, res) => {
  const dbHost = getDBHost();

  res.status(200).json({
    success: true,
    message: 'Matrimony API is running',
    environment: process.env.NODE_ENV || 'development',
    database: getDBStatus(),
    ...(dbHost && { databaseHost: dbHost }),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
