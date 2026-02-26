require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const helmet = require('helmet');
const morgan = require('morgan');

// Routes
const apiRoutes = require('./routes/apiRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Security and logging
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine (still used for admin panel)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session store
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

app.use(session({
  key: 'seat_booking_sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hours
}));

// Flash messages (used by admin EJS pages)
app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// ═══════════════════════════════════════════════════════════
//  API ROUTES (JSON endpoints for the SPA frontend)
// ═══════════════════════════════════════════════════════════
app.use('/api', apiRoutes);

// ═══════════════════════════════════════════════════════════
//  ADMIN (still EJS-based)
// ═══════════════════════════════════════════════════════════
app.use('/admin', adminRoutes);

// ═══════════════════════════════════════════════════════════
//  LEGACY ROUTES (kept for compatibility)
// ═══════════════════════════════════════════════════════════
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    // Serve a tiny page that clears SPA sessionStorage before redirecting
    res.send(`<!DOCTYPE html><html><head><title>Logging out…</title></head><body>
      <script>
        try { sessionStorage.removeItem('seatflow_user'); } catch(e) {}
        window.location.replace('/');
      </script>
    </body></html>`);
  });
});
app.use('/booking', bookingRoutes);
app.use('/leave', leaveRoutes);

// ═══════════════════════════════════════════════════════════
//  SPA FALLBACK — Serve index.html for all other routes
// ═══════════════════════════════════════════════════════════
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong. Please try again later.' });
});

module.exports = app;
