const AdminUser = require('../models/AdminUser');

/**
 * Authentication middleware to check if user is logged in
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAuth = (req, res, next) => {
  // Check if user is authenticated
  if (req.session && req.session.userId) {
    return next();
  }
  
  // If request expects JSON, send JSON error
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }
  
  // Store the original URL for redirect after login
  req.session.returnTo = req.originalUrl;
  
  // Redirect to login page
  res.redirect('/admin/login');
};

/**
 * Middleware to check if user is already authenticated
 * Redirects to admin dashboard if already logged in
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/admin/dashboard');
  }
  next();
};

/**
 * Middleware to check if user has admin role (Super Admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = async (req, res, next) => {
  try {
    // First check if user is authenticated
    if (!req.session || !req.session.userId) {
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please log in to access this resource'
        });
      }
      req.session.returnTo = req.originalUrl;
      return res.redirect('/admin/login');
    }
    
    // Get user from database
    const user = await AdminUser.findById(req.session.userId);
    if (!user || !user.isActive) {
      // Clear invalid session
      req.session.destroy();
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({
          error: 'Invalid session',
          message: 'Please log in again'
        });
      }
      return res.redirect('/admin/login');
    }
    
    // Check if user has admin role
    if (user.role !== 'admin') {
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Super Admin access required'
        });
      }
      return res.status(403).render('error', {
        message: 'Access denied. Super Admin privileges required.',
        error: {},
        status: 403
      });
    }
    
    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({
        error: 'Authentication error',
        message: 'An error occurred during authentication'
      });
    }
    next(error);
  }
};

/**
 * Middleware to check if user has specific permission
 * @param {string|Array} permission - Permission(s) to check
 * @returns {Function} Express middleware function
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      // First check if user is authenticated
      if (!req.session || !req.session.userId) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'Please log in to access this resource'
          });
        }
        req.session.returnTo = req.originalUrl;
        return res.redirect('/admin/login');
      }
      
      // Get user from database
      const user = await AdminUser.findById(req.session.userId);
      if (!user || !user.isActive) {
        // Clear invalid session
        req.session.destroy();
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
          return res.status(401).json({
            error: 'Invalid session',
            message: 'Please log in again'
          });
        }
        return res.redirect('/admin/login');
      }
      
      // Check permissions
      let hasPermission = false;
      if (Array.isArray(permission)) {
        hasPermission = user.hasAnyPermission(permission);
      } else {
        hasPermission = user.hasPermission(permission);
      }
      
      if (!hasPermission) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            message: 'You do not have permission to access this resource'
          });
        }
        return res.status(403).render('error', {
          message: 'Access denied. You do not have permission to access this resource.',
          error: {},
          status: 403
        });
      }
      
      // Add user to request object
      req.user = user;
      next();
    } catch (error) {
      console.error('Permission auth middleware error:', error);
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(500).json({
          error: 'Authentication error',
          message: 'An error occurred during authentication'
        });
      }
      next(error);
    }
  };
};

/**
 * Middleware to check if user has menu management permissions
 */
const requireMenuPermission = requirePermission('menu_management');

/**
 * Middleware to check if user has waste management permissions
 */
const requireWastePermission = requirePermission('waste_management');

/**
 * Middleware to check if user has nutrition management permissions
 */
const requireNutritionPermission = requirePermission('nutrition_management');

/**
 * Middleware to check if user has special menu management permissions
 */
const requireSpecialMenuPermission = requirePermission('special_menu_management');

/**
 * Middleware to check if user has user management permissions
 */
const requireUserManagementPermission = requirePermission('manage_users');

/**
 * Middleware to add user information to request if authenticated
 * Does not block access if not authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const addUserToRequest = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await AdminUser.findById(req.session.userId);
      if (user && user.isActive) {
        req.user = user;
        // Make user available to templates
        res.locals.user = user;
        // Add permissions to res.locals for template access
        res.locals.userPermissions = user.getPermissions();
        res.locals.userRole = user.getRoleDisplayName();
      } else {
        // Clear invalid session
        req.session.destroy();
      }
    }
    next();
  } catch (error) {
    console.error('Add user to request error:', error);
    // Don't block the request, just continue without user
    next();
  }
};

/**
 * Login function to authenticate user
 * @param {string} identifier - Username or email
 * @param {string} password - User password
 * @param {Object} session - Express session object
 * @returns {Object} - Result object with success status and user/error
 */
const loginUser = async (identifier, password, session) => {
  try {
    // Find user by username or email
    const user = await AdminUser.findByUsernameOrEmail(identifier);
    
    if (!user) {
      return {
        success: false,
        error: 'Invalid username/email or password'
      };
    }
    
    // Check if user is active
    if (!user.isActive) {
      return {
        success: false,
        error: 'Account is deactivated. Please contact administrator.'
      };
    }
    
    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return {
        success: false,
        error: 'Invalid username/email or password'
      };
    }
    
    // Update last login
    await user.updateLastLogin();
    
    // Set session
    session.userId = user._id;
    session.username = user.username;
    session.role = user.role;
    session.fullName = user.fullName;
    
    return {
      success: true,
      user: user
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'An error occurred during login. Please try again.'
    };
  }
};

/**
 * Logout function to clear session
 * @param {Object} session - Express session object
 * @returns {Promise} - Promise that resolves when session is destroyed
 */
const logoutUser = (session) => {
  return new Promise((resolve, reject) => {
    session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

module.exports = {
  requireAuth,
  redirectIfAuthenticated,
  requireAdmin,
  requirePermission,
  requireMenuPermission,
  requireWastePermission,
  requireNutritionPermission,
  requireSpecialMenuPermission,
  requireUserManagementPermission,
  addUserToRequest,
  loginUser,
  logoutUser
};