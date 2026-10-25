// config/db.js
//
// Single source of truth for the MongoDB connection.
//  - connectDB() connects Mongoose to MONGODB_URI, or falls back to an in-memory
//    MongoDB (mongodb-memory-server) when allowed.
//  - getClientPromise() resolves to the *active* MongoClient so connect-mongo
//    (the session store) always shares the same connection as Mongoose.
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');

const DB_NAME = process.env.MONGODB_DB_NAME || 'lost_found_portal';
const DEFAULT_URI = `mongodb://127.0.0.1:27017/${DB_NAME}`;

let memoryServer = null;
let usingMemoryDb = false;
let connectPromise = null;
let stoppingMemoryDb = false;
let memoryDbPath = null; // data directory of the in-memory mongod
let restartTimes = [];
const recentMongodLines = [];

const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 2 * 60 * 1000;

// --- Deferred "active client" promise (used by the session store) -----------
let resolveClient;
let rejectClient;
const clientPromise = new Promise((resolve, reject) => {
  resolveClient = resolve;
  rejectClient = reject;
});
// Avoid an unhandled-rejection crash if nobody is listening when it rejects.
clientPromise.catch(() => {});

// Resolves for any successful Mongoose connection, including one opened
// externally (e.g. by the test suite) before or after this module is loaded.
mongoose.connection.on('open', () => resolveClient(mongoose.connection.getClient()));
if (mongoose.connection.readyState === 1) {
  resolveClient(mongoose.connection.getClient());
}

const getClientPromise = () => clientPromise;

const rememberMongodLine = (line) => {
  recentMongodLines.push(String(line));
  if (recentMongodLines.length > 15) recentMongodLines.shift();
};

// If the in-memory mongod process dies on its own, the web server would keep
// running and every request would fail with "ECONNREFUSED 127.0.0.1:<port>".
// Instead: report why, then restart mongod on the SAME port with the SAME data
// directory, so the existing Mongoose / session-store connections recover by
// themselves. Gives up after MAX_RESTARTS restarts within RESTART_WINDOW_MS.
const handleUnexpectedExit = async (code, signal, opts) => {
  console.error(
    `❌ The in-memory MongoDB process exited unexpectedly (code: ${code}, signal: ${signal}).`
  );
  if (recentMongodLines.length) {
    console.error('   Last mongod output:');
    recentMongodLines.slice(-8).forEach((l) => console.error(`   | ${l.slice(0, 300)}`));
  }

  const now = Date.now();
  restartTimes = restartTimes.filter((t) => now - t < RESTART_WINDOW_MS);
  if (restartTimes.length >= MAX_RESTARTS) {
    console.error('❌ Too many in-memory MongoDB crashes. Not restarting again; please run npm start.');
    return;
  }
  restartTimes.push(now);

  console.log('🔄 Restarting in-memory MongoDB on the same port with the same data...');
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const next = await MongoMemoryServer.create({
      instance: {
        port: opts.port,
        dbPath: opts.dbPath,
        storageEngine: opts.storageEngine,
        portGeneration: false,
      },
      spawn: { timeout: 60000 },
    });
    memoryServer = next;
    watchMemoryInstance(next);
    console.log('✅ In-memory MongoDB restarted.');
  } catch (err) {
    console.error('❌ Could not restart the in-memory MongoDB:', err.message);
  }
};

const watchMemoryInstance = (server) => {
  const info = server && server.instanceInfo;
  const instance = info && info.instance;
  if (!instance) return;
  memoryDbPath = info.dbPath || memoryDbPath;
  const opts = { port: info.port, dbPath: info.dbPath, storageEngine: info.storageEngine };

  instance.on('instanceSTDOUT', rememberMongodLine);
  instance.on('instanceSTDERR', rememberMongodLine);
  instance.on('instanceClosed', (code, signal) => {
    // Small delay: on Windows, Ctrl+C reaches mongod slightly before our own
    // shutdown handler runs, and that is a normal exit, not a failure.
    setTimeout(() => {
      if (stoppingMemoryDb || server !== memoryServer) return;
      handleUnexpectedExit(code, signal, opts).catch((err) =>
        console.error('[MongoDB Supervisor]', err.message)
      );
    }, 500).unref();
  });
};

const startMemoryDb = async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create({ spawn: { timeout: 60000 } });
  usingMemoryDb = true;
  watchMemoryInstance(memoryServer);
  // Mongoose 8 + a fresh connect: DB name is passed via options, not the URI.
  await mongoose.connect(memoryServer.getUri(), { dbName: DB_NAME });
  console.log('🧪 Using in-memory MongoDB (data is lost when the app stops).');
};

const stopMemoryDb = async () => {
  stoppingMemoryDb = true;
  if (memoryServer) {
    await memoryServer.stop().catch(() => {});
    memoryServer = null;
  }
  // Remove the temporary data directory (only if it is one of ours/MMS's temp dirs).
  if (memoryDbPath && path.dirname(memoryDbPath) === os.tmpdir() && path.basename(memoryDbPath).startsWith('mongo-mem-')) {
    await fs.promises.rm(memoryDbPath, { recursive: true, force: true }).catch(() => {});
  }
  memoryDbPath = null;
  usingMemoryDb = false;
};

const doConnect = async () => {
  // Already connected (e.g. the test suite connected first): reuse it as-is.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection.getClient();
  }

  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  const forceMemory = process.env.USE_MEMORY_DB === 'true' || process.env.NODE_ENV === 'test';

  try {
    if (forceMemory) {
      await startMemoryDb();
    } else {
      await mongoose.connect(uri, { dbName: DB_NAME, serverSelectionTimeoutMS: 3000 });
      console.log('✅ Connected to MongoDB.');
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production' || forceMemory) {
      throw error;
    }
    console.warn(`⚠️  Could not connect to MongoDB (${error.message}). Falling back to in-memory MongoDB.`);
    // Fully discard the failed attempt before reconnecting to the in-memory server.
    await mongoose.disconnect().catch(() => {});
    await startMemoryDb();
  }
  return mongoose.connection.getClient();
};

const connectDB = async () => {
  if (!connectPromise) {
    connectPromise = doConnect()
      .then((client) => {
        resolveClient(client);
        return client;
      })
      .catch((err) => {
        connectPromise = null;
        // Make the session store fail fast instead of hanging forever.
        rejectClient(err);
        throw err;
      });
  }
  return connectPromise;
};

const disconnectDB = async () => {
  stoppingMemoryDb = true;
  try {
    await mongoose.disconnect();
  } finally {
    connectPromise = null;
    await stopMemoryDb();
  }
};

const getStatus = () => ({
  connected: mongoose.connection.readyState === 1,
  readyState: mongoose.connection.readyState,
  usingMemoryDb,
  dbName: mongoose.connection.name || DB_NAME,
});

module.exports = { connectDB, disconnectDB, getStatus, getClientPromise, DB_NAME };