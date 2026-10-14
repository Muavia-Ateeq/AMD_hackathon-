// backend/src/server.js
// Starts the Express application and manages database connection. Owned by Ammar

require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/supplier-docs';

async function start() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000
    });
    logger.info(`Connected to MongoDB at ${MONGODB_URI}`);
  } catch (err) {
    logger.warn(`Could not connect to MongoDB (${err.message}). Starting server in offline/mock mode.`);
  }

  const server = app.listen(PORT, () => {
    logger.info(`Supplier Document Desk API listening on port ${PORT}`);
  });

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
