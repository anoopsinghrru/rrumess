// Mess TV Menu Display System - Main Server File
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const methodOverride = require('method-override');
const fileUpload = require('express-fileupload');
const path = require('path');
const { DateTime } = require('luxon');
const cron = require('node-cron');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection with enhanced error handling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mess-tv-menu-display');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.log('Server will continue running without database connection');
    console.log('Please ensure MongoDB is running and accessible');
  }
};

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed through app termination');
  process.exit(0);
});

// Initialize database connection
connectDB();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Trust proxy for production deployment
app.set('trust proxy', 1);

// Middleware setup
// Static files middleware
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload middleware
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true,
  createParentPath: true
}));

// Method override middleware for PUT and DELETE requests
app.use(methodOverride('_method'));

// Session configuration with enhanced security
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'mess-tv-session',
  cookie: { 
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd HH:mm:ss')} - ${req.method} ${req.url}`);
  next();
});

// Import routes
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const displayRoutes = require('./routes/display');

// Basic route - redirect to display
app.get('/', (req, res) => {
  res.redirect('/display');
});

// Redirect /login to /admin/login
app.get('/login', (req, res) => {
  res.redirect('/admin/login');
});

// Favicon route to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Routes
app.use('/display', displayRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// 404 Error Handler
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
});

// Global Error Handler
app.use((error, req, res, next) => {
  const statusCode = error.status || 500;
  
  // Log error details
  console.error(`Error ${statusCode}: ${error.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  
  // Send error response
  res.status(statusCode);
  
  // Check if request expects JSON
  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
    res.json({
      error: {
        message: error.message,
        status: statusCode,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      }
    });
  } else {
    // Render error page (will be created later)
    res.render('error', {
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error : {},
      status: statusCode
    });
  }
});

// Self-ping function to keep Render app alive
const selfPing = () => {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const protocol = url.startsWith('https') ? https : http;
  
  const options = {
    method: 'GET',
    timeout: 30000 // 30 second timeout
  };
  
  const req = protocol.get(`${url}/health`, options, (res) => {
    if (res.statusCode === 200) {
      console.log(`✅ Self-ping successful at ${DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd HH:mm:ss')}`);
    } else {
      console.log(`⚠️ Self-ping returned status: ${res.statusCode}`);
    }
  });
  
  req.on('error', (error) => {
    console.log(`❌ Self-ping failed: ${error.message}`);
  });
  
  req.on('timeout', () => {
    console.log(`⏰ Self-ping timeout`);
    req.destroy();
  });
};

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/mess-tv-menu-display'}`);
  
  // Only start self-ping in production (Render)
  if (process.env.NODE_ENV === 'production' || process.env.RENDER_EXTERNAL_URL) {
    // Schedule self-ping every 14 minutes to keep app alive
    cron.schedule('*/14 * * * *', () => {
      console.log('🔄 Running scheduled self-ping...');
      selfPing();
    });
    
    console.log('🚀 Self-ping scheduler activated - pinging every 14 minutes');
    
    // Initial ping after 2 minutes to ensure everything is working
    setTimeout(() => {
      console.log('🔄 Running initial self-ping...');
      selfPing();
    }, 120000); // 2 minutes
  }
});

// Handle server errors
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});

module.exports = app;