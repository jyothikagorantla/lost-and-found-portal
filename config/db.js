
require('dotenv').config();

const dns = require('node:dns');

// Use public DNS resolvers for MongoDB Atlas DNS lookups.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

let memoryServer = null;

/**
 * Connect to MongoDB Atlas or an in-memory database for tests.
 */
async function connectDB() {
  // Reuse an existing connection.
  if (mongoose.connection.readyState === 1) {
    console.log('[MongoDB] Already connected.');
    return mongoose.connection;
  }

  // Use in-memory MongoDB for tests or when explicitly enabled.
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.USE_MEMORY_DB === 'true'
  ) {
    const { MongoMemoryServer } = require('mongodb-memory-server');

    memoryServer = await MongoMemoryServer.create();

    await mongoose.connect(memoryServer.getUri());

    console.log('[MongoDB] Connected to in-memory database.');
    return mongoose.connection;
  }

  // Use the existing MongoDB Atlas URI from .env.
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is missing. Check your .env file.'
    );
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
  });

  console.log(
    `[MongoDB] Connected to database: ${mongoose.connection.name}`
  );

  return mongoose.connection;
}

/**
 * Return the current MongoDB connection status.
 */
function getStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    database: mongoose.connection.name || null,
  };
}

/**
 * Close MongoDB and stop the in-memory server if one was created.
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = {
  connectDB,
  getStatus,
  disconnectDB,
};
