
const dns = require('node:dns');

// DNS workaround for MongoDB Atlas SRV lookup failures.
// If your network blocks these resolvers, fix DNS at the network level.
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const helmet = require('helmet');
const methodOverride = require('method-override');

const { connectDB } = require('./config/db');

const {
  setCurrentUser,
  ensureAuthenticated,
} = require('./middleware/auth');

const csrfProtection = require('./middleware/csrf');

const {
  notFoundHandler,
  errorHandler,
} = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');

const itemController = require('./controllers/itemController');
const authController = require('./controllers/authController');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Render's HTTPS reverse proxy in production.
// This must be configured before session middleware.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers
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

// EJS views
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Request body parsing
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// HTML form method override
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Validate environment configuration
const mongoUri = process.env.MONGODB_URI;
const sessionSecret = process.env.SESSION_SECRET;

if (!mongoUri) {
  throw new Error('MONGODB_URI is missing from environment variables.');
}

if (
  process.env.NODE_ENV === 'production' &&
  !sessionSecret
) {
  throw new Error('SESSION_SECRET must be configured in production.');
}

// Persistent MongoDB session store
const sessionStore = MongoStore.create({
  mongoUrl: mongoUri,
  collectionName: 'sessions',
  ttl: 14 * 24 * 60 * 60,
  autoRemove: 'native',
});

sessionStore.on('error', (err) => {
  console.error('[Session Store Error]', err.message);
});

// Sessions
app.use(
  session({
    name: 'lostfound.sid',
    secret:
      sessionSecret ||
      'development-only-secret-change-before-deployment',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// Flash messages
app.use(flash());

// CSRF protection must run after session middleware
app.use(csrfProtection);

// Make user and flash information available to views
app.use(setCurrentUser);

// Informational pages
app.get('/', itemController.showHome);

app.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Us - Lost & Found Portal',
  });
});

app.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us - Lost & Found Portal',
  });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', {
    title: 'Privacy Policy - Lost & Found Portal',
  });
});

app.get('/terms', (req, res) => {
  res.render('terms', {
    title: 'Terms of Service - Lost & Found Portal',
  });
});

// Authentication
app.use('/auth', authRoutes);

// Dashboard
app.get(
  '/dashboard',
  ensureAuthenticated,
  authController.showDashboard
);

// Lost and found items
app.use('/items', itemRoutes);

// Claims
app.use('/claims', claimRoutes);

// Notifications
app.use('/notifications', notificationRoutes);

// Admin
app.use('/admin', adminRoutes);

// Handle unknown routes
app.use(notFoundHandler);

// Central error handler
app.use(errorHandler);

// Start only after MongoDB connects
async function startServer() {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log('==============================================');
    console.log('Lost & Found Portal is running.');
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('MongoDB connection initialized.');
    console.log('==============================================');
  });

  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(
      '[Startup Error] Application could not start:',
      err.message
    );
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
};
