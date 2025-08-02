const mongoose = require('mongoose');
const dateUtils = require('../utils/dateUtils');

const specialMenuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Special menu item name is required'],
    trim: true,
    minlength: [2, 'Item name must be at least 2 characters long'],
    maxlength: [100, 'Item name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Item description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters long'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    type: String,
    trim: true,
    maxlength: [255, 'Image path cannot exceed 255 characters'],
    validate: {
      validator: function(value) {
        if (!value) return true; // Optional field
        // Basic URL validation for image
        const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        return urlRegex.test(value) || value.startsWith('/');
      },
      message: 'Image must be a valid URL or path'
    }
  }
});

const specialMenuSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Special menu name is required'],
    trim: true,
    minlength: [3, 'Menu name must be at least 3 characters long'],
    maxlength: [100, 'Menu name cannot exceed 100 characters']
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    minlength: [2, 'State name must be at least 2 characters long'],
    maxlength: [50, 'State name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Menu description cannot exceed 1000 characters']
  },
  items: {
    type: [specialMenuItemSchema],
    required: [true, 'Special menu must have at least one item'],
    validate: {
      validator: function(items) {
        return items && items.length > 0 && items.length <= 10;
      },
      message: 'Special menu must have at least one item'
    }
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    validate: {
      validator: function(value) {
        // Start date should not be more than 1 year in the past
        const oneYearAgo = dateUtils.subtractDays(dateUtils.getCurrentIST(), 365);
        return dateUtils.toIST(value) >= oneYearAgo;
      },
      message: 'Start date cannot be more than one year in the past'
    }
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: [
      {
        validator: function(value) {
          // End date should not be more than 2 years in the future
          const twoYearsFromNow = dateUtils.addDays(dateUtils.getCurrentIST(), 730);
          return dateUtils.toIST(value) <= twoYearsFromNow;
        },
        message: 'End date cannot be more than two years in the future'
      },
      {
        validator: function(value) {
          // End date must be after start date
          return !this.startDate || value > this.startDate;
        },
        message: 'End date must be after start date'
      },
      {
        validator: function(value) {
          // Date range should not exceed 1 year
          if (this.startDate) {
            const oneYearFromStart = dateUtils.addDays(this.startDate, 365);
            return dateUtils.toIST(value) <= oneYearFromStart;
          }
          return true;
        },
        message: 'Special menu duration cannot exceed one year'
      }
    ]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for efficient querying by date range and state
specialMenuSchema.index({ startDate: 1, endDate: 1, isActive: 1 });
specialMenuSchema.index({ state: 1, isActive: 1 });
specialMenuSchema.index({ startDate: 1, endDate: 1, state: 1 });

// Virtual for formatted date range
specialMenuSchema.virtual('formattedDateRange').get(function() {
  const startFormatted = dateUtils.formatISTDate(this.startDate);
  const endFormatted = dateUtils.formatISTDate(this.endDate);
  return `${startFormatted} - ${endFormatted}`;
});

// Virtual for formatted start date
specialMenuSchema.virtual('formattedStartDate').get(function() {
  return dateUtils.formatISTDate(this.startDate);
});

// Virtual for formatted end date
specialMenuSchema.virtual('formattedEndDate').get(function() {
  return dateUtils.formatISTDate(this.endDate);
});

// Virtual for duration in days
specialMenuSchema.virtual('durationDays').get(function() {
  if (!this.startDate || !this.endDate) return 0;
  
  const startIST = dateUtils.toIST(this.startDate);
  const endIST = dateUtils.toIST(this.endDate);
  const timeDiff = endIST.getTime() - startIST.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end days
});

// Virtual to check if menu is currently active based on dates
specialMenuSchema.virtual('isCurrentlyActive').get(function() {
  if (!this.isActive) return false;
  
  const now = dateUtils.getCurrentIST();
  const startIST = dateUtils.toIST(this.startDate);
  const endIST = dateUtils.toIST(this.endDate);
  return now >= startIST && now <= endIST;
});

// Method to validate date range
specialMenuSchema.methods.validateDateRange = function() {
  const errors = [];
  
  if (!this.startDate || !this.endDate) {
    errors.push('Both start date and end date are required');
    return errors;
  }
  
  if (this.endDate <= this.startDate) {
    errors.push('End date must be after start date');
  }
  
  const now = dateUtils.getCurrentIST().toJSDate();
  const oneYearAgo = dateUtils.subtractDays(now, 365).toJSDate();
  const twoYearsFromNow = dateUtils.addDays(now, 730).toJSDate();
  
  if (this.startDate < oneYearAgo) {
    errors.push('Start date cannot be more than one year in the past');
  }
  
  if (this.endDate > twoYearsFromNow) {
    errors.push('End date cannot be more than two years in the future');
  }
  
  // Check if duration exceeds one year
  const oneYearFromStart = dateUtils.addDays(this.startDate, 365).toJSDate();
  if (this.endDate > oneYearFromStart) {
    errors.push('Special menu duration cannot exceed one year');
  }
  
  return errors;
};

// Method to check if menu is available on a specific date
specialMenuSchema.methods.isAvailableOnDate = function(date) {
  if (!this.isActive) return false;
  
  const checkDate = dateUtils.getISTStartOfDay(date).toJSDate();
  const startDate = dateUtils.getISTStartOfDay(this.startDate).toJSDate();
  const endDate = dateUtils.getISTEndOfDay(this.endDate).toJSDate();
  
  return checkDate >= startDate && checkDate <= endDate;
};

// Method to get menu summary
specialMenuSchema.methods.getMenuSummary = function() {
  return {
    name: this.name,
    state: this.state,
    startDate: this.formattedStartDate,
    endDate: this.formattedEndDate,
    duration: this.durationDays,
    itemCount: this.items ? this.items.length : 0,
    isCurrentlyActive: this.isCurrentlyActive
  };
};

// Static method to find active special menus for a specific date
specialMenuSchema.statics.findActiveForDate = function(date) {
  const checkDate = dateUtils.getISTStartOfDay(date).toJSDate();
  const endOfDay = dateUtils.getISTEndOfDay(date).toJSDate();
  
  return this.find({
    isActive: true,
    startDate: { $lte: endOfDay },
    endDate: { $gte: checkDate }
  }).sort({ startDate: 1 });
};

// Static method to find special menu for a specific date
specialMenuSchema.statics.findSpecialMenuForDate = function(referenceDate = dateUtils.getCurrentIST().toJSDate()) {
  return this.findActiveForDate(referenceDate);
};

// Static method aliases for test compatibility
specialMenuSchema.statics.findActiveMenusForDate = function(date) {
  return this.findActiveForDate(date);
};

specialMenuSchema.statics.findFridaySpecialMenu = function(referenceDate) {
  return this.findSpecialMenuForDate(referenceDate);
};

specialMenuSchema.statics.findByState = function(state) {
  return this.find({ state: state, isActive: true }).sort({ startDate: 1 });
};

specialMenuSchema.statics.findOverlappingMenus = function(startDate, endDate, excludeId = null) {
  return this.findOverlapping(startDate, endDate, excludeId);
};

// Static method to find overlapping menus (for validation)
specialMenuSchema.statics.findOverlapping = function(startDate, endDate, excludeId = null) {
  const query = {
    $or: [
      // New menu starts during existing menu
      {
        startDate: { $lte: startDate },
        endDate: { $gte: startDate }
      },
      // New menu ends during existing menu
      {
        startDate: { $lte: endDate },
        endDate: { $gte: endDate }
      },
      // New menu completely contains existing menu
      {
        startDate: { $gte: startDate },
        endDate: { $lte: endDate }
      }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return this.find(query);
};

// Pre-save middleware for additional validation
specialMenuSchema.pre('save', function() {
  // Ensure dates are properly set to start/end of day
  if (this.startDate) {
    this.startDate.setHours(0, 0, 0, 0);
  }
  if (this.endDate) {
    this.endDate.setHours(23, 59, 59, 999);
  }
});

module.exports = mongoose.model('SpecialMenu', specialMenuSchema);