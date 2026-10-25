require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const helmet = require('helmet');
const methodOverride = require('method-override');
const mongoose = require('mongoose');

const { connectDB, disconnectDB, getClientPromise, DB_NAME } = require('./config/db');
const { setCurrentUser } = require('./middleware/auth');
const csrfProtection = require('./middleware/csrf');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const itemController = require('./controllers/itemController');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
        ],
        fontSrc: [
          "'self'",
          'https://cdn.jsdelivr.net',
          'https://fonts.gstatic.com',
          'data:',
        ],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://images.unsplash.com',
        ],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Body parsers
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Method override for RESTful PUT and DELETE from forms
app.use(methodOverride('_method'));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Configure Session Store
// IMPORTANT: do not pass `mongoUrl` here. That makes connect-mongo open its own,
// separate connection to the configured URI (127.0.0.1:27017 by default) at
// require-time, before the in-memory fallback exists. Instead, reuse the active
// MongoClient that config/db.js hands out once the connection is established.
const sessionStore = MongoStore.create({
  clientPromise: getClientPromise(),
  dbName: DB_NAME,
  collectionName: 'sessions',
  ttl: 14 * 24 * 60 * 60, // 14 days
  autoRemove: 'native',
});

// If the database never connects, avoid an unhandled rejection inside the store.
sessionStore.collectionP.catch((err) => {
  console.warn('[Session Store Warning]', err.message);
});

sessionStore.on('error', (err) => {
  // Gracefully handle session store errors without crashing
  console.warn('[Session Store Warning]', err.message);
});

app.use(
  session({
    // Unique cookie name: browsers share cookies across ALL localhost ports, so the
    // default name ("connect.sid") gets overwritten by any other Express app you run
    // on localhost, which breaks the session and causes CSRF "Security check failed".
    name: 'lostfound.sid',
    secret: process.env.SESSION_SECRET || 'lost_and_found_default_session_secret_2026',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    },
  })
);

// Connect Flash messages
app.use(flash());

// CSRF Protection
app.use(csrfProtection);

// Populate res.locals with current user and flash messages
app.use(setCurrentUser);

// Static / informational pages
app.get('/', itemController.showHome);

app.get('/about', (req, res) => {
  res.render('about', { title: 'About Us - Lost & Found Portal' });
});

app.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact Us - Lost & Found Portal' });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { title: 'Privacy Policy - Lost & Found Portal' });
});

app.get('/terms', (req, res) => {
  res.render('terms', { title: 'Terms of Service - Lost & Found Portal' });
});

// Mount Routes
app.use('/auth', authRoutes);
app.get('/dashboard', require('./middleware/auth').ensureAuthenticated, require('./controllers/authController').showDashboard);
app.use('/items', itemRoutes);
app.use('/claims', claimRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Report listen errors (e.g. port already in use by an old, still-running copy of
// this app) clearly, and clean up the in-memory MongoDB instead of failing silently.
const attachServerErrorHandler = (server) => {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. An older copy of the app is probably still running.`);
      console.error('   Close the other terminal, or run in PowerShell: taskkill /F /IM node.exe');
    } else {
      console.error('❌ Server error:', err.message);
    }
    if (require.main === module) {
      disconnectDB().finally(() => process.exit(1));
    }
  });
  return server;
};

// Start server function
const startServer = async () => {
  try {
    await connectDB();
    const server = attachServerErrorHandler(app.listen(PORT, () => {
      console.log(`======================================================`);
      console.log(`🚀 Lost & Found Portal is live!`);
      console.log(`🌐 Local URL: http://localhost:${PORT}`);
      console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`======================================================`);
    }));
    return server;
  } catch (err) {
    console.error('Fatal: Could not initialize database.', err.message);
    // Still start Express server so helpful error page or landing diagnostics can show
    const server = attachServerErrorHandler(app.listen(PORT, () => {
      console.log(`⚠️  Server started on port ${PORT} with database disconnected.`);
      console.log(`🌐 Local URL: http://localhost:${PORT}`);
    }));
    return server;
  }
};

if (require.main === module) {
  startServer();

  // Stop the in-memory MongoDB (if any) so no mongod process is left behind.
  // On Windows, Ctrl+C is delivered to the child mongod process as well, so the
  // shutdown must never wait forever: force-exit after 3 seconds.
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received. Shutting down...`);
    const forceExit = setTimeout(() => process.exit(0), 3000);
    try {
      await disconnectDB();
    } catch (err) {
      console.warn('[Shutdown Warning]', err.message);
    } finally {
      clearTimeout(forceExit);
      process.exit(0);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGBREAK', () => shutdown('SIGBREAK'));
}

module.exports = { app, startServer };