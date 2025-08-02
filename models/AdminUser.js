const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Define role permissions
const ROLE_PERMISSIONS = {
  admin: {
    name: 'Super Admin',
    permissions: [
      'manage_users',
      'menu_management',
      'waste_management', 
      'nutrition_management',
      'special_menu_management',
      'system_settings',
      'view_reports'
    ]
  },
  menu_waste_manager: {
    name: 'Menu & Waste Manager',
    permissions: [
      'menu_management',
      'waste_management',
      'view_reports'
    ]
  },
  nutrition_special_manager: {
    name: 'Nutrition & Special Manager',
    permissions: [
      'nutrition_management',
      'special_menu_management',
      'view_reports'
    ]
  }
};

const adminUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  role: {
    type: String,
    enum: {
      values: Object.keys(ROLE_PERMISSIONS),
      message: `Role must be one of: ${Object.keys(ROLE_PERMISSIONS).join(', ')}`
    },
    default: 'menu_waste_manager'
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  lastLogin: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient querying
adminUserSchema.index({ isActive: 1, role: 1 });

// Pre-save middleware to hash password
adminUserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
adminUserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Method to update last login
adminUserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Method to check if user has specific permission
adminUserSchema.methods.hasPermission = function(permission) {
  const roleConfig = ROLE_PERMISSIONS[this.role];
  return roleConfig && roleConfig.permissions.includes(permission);
};

// Method to check if user has any of the given permissions
adminUserSchema.methods.hasAnyPermission = function(permissions) {
  return permissions.some(permission => this.hasPermission(permission));
};

// Method to check if user has all of the given permissions
adminUserSchema.methods.hasAllPermissions = function(permissions) {
  return permissions.every(permission => this.hasPermission(permission));
};

// Method to get user's role display name
adminUserSchema.methods.getRoleDisplayName = function() {
  const roleConfig = ROLE_PERMISSIONS[this.role];
  return roleConfig ? roleConfig.name : this.role;
};

// Method to get user's permissions
adminUserSchema.methods.getPermissions = function() {
  const roleConfig = ROLE_PERMISSIONS[this.role];
  return roleConfig ? roleConfig.permissions : [];
};

// Static method to find user by username or email
adminUserSchema.statics.findByUsernameOrEmail = function(identifier) {
  return this.findOne({
    $or: [
      { username: identifier },
      { email: identifier }
    ],
    isActive: true
  });
};

// Static method to create admin user with validation
adminUserSchema.statics.createAdmin = async function(userData, createdBy = null) {
  const { username, email, password, role = 'menu_waste_manager', fullName } = userData;
  
  // Check if user already exists
  const existingUser = await this.findOne({
    $or: [
      { username: username },
      { email: email }
    ]
  });
  
  if (existingUser) {
    throw new Error('User with this username or email already exists');
  }
  
  // Validate role
  if (!ROLE_PERMISSIONS[role]) {
    throw new Error(`Invalid role: ${role}`);
  }
  
  // Create new user
  const user = new this({
    username,
    email,
    password,
    role,
    fullName,
    createdBy
  });
  
  return await user.save();
};

// Static method to get all roles
adminUserSchema.statics.getRoles = function() {
  return ROLE_PERMISSIONS;
};

// Virtual for user display name
adminUserSchema.virtual('displayName').get(function() {
  return this.fullName || this.username;
});

// Transform output to exclude password
adminUserSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Export the permissions for use in middleware
module.exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;

module.exports = mongoose.model('AdminUser', adminUserSchema);