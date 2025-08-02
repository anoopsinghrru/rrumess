const mongoose = require('mongoose');
const dateUtils = require('../utils/dateUtils');

const nutritionalInfoSchema = new mongoose.Schema({
  calories: {
    type: Number,
    required: true,
    min: [0, 'Calories cannot be negative'],
    max: [2000, 'Calories per item cannot exceed 2000']
  },
  protein: {
    type: Number,
    required: true,
    min: [0, 'Protein cannot be negative'],
    max: [200, 'Protein per item cannot exceed 200g']
  },
  carbohydrates: {
    type: Number,
    required: true,
    min: [0, 'Carbohydrates cannot be negative'],
    max: [500, 'Carbohydrates per item cannot exceed 500g']
  },
  fat: {
    type: Number,
    required: true,
    min: [0, 'Fat cannot be negative'],
    max: [200, 'Fat per item cannot exceed 200g']
  },
  fiber: {
    type: Number,
    default: 0,
    min: [0, 'Fiber cannot be negative'],
    max: [100, 'Fiber per item cannot exceed 100g']
  }
});

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Menu item name is required'],
    trim: true,
    minlength: [2, 'Menu item name must be at least 2 characters long'],
    maxlength: [100, 'Menu item name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['breakfast', 'lunch', 'snacks', 'dinner'],
      message: 'Category must be one of: breakfast, lunch, snacks, dinner'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    validate: {
      validator: function(value) {
        // Allow dates from today onwards up to 1 year in the future
        // Also allow up to 7 days in the past for flexibility
        const today = dateUtils.getCurrentIST();
        const sevenDaysAgo = dateUtils.subtractDays(today, 7);
        const oneYearFromNow = dateUtils.addDays(today, 365);
        const inputDate = dateUtils.toIST(value);
        
        return inputDate >= sevenDaysAgo && inputDate <= oneYearFromNow;
      },
      message: 'Date must be from today onwards (up to 1 year in future). Past dates allowed only up to 7 days ago.'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  nutritionalInfo: {
    type: nutritionalInfoSchema,
    required: false // Made optional - nutrition can be added later
  },
  nutritionStatus: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  nutritionAddedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: false
  },
  nutritionAddedAt: {
    type: Date,
    required: false
  }
}, {
  timestamps: true
});

// Index for efficient querying by date and category
menuItemSchema.index({ date: 1, category: 1 });
menuItemSchema.index({ date: 1, isActive: 1 });
menuItemSchema.index({ nutritionStatus: 1 }); // New index for nutrition status

// Virtual for formatted date
menuItemSchema.virtual('formattedDate').get(function() {
  return dateUtils.formatISTDate(this.date);
});

// Virtual to check if nutrition is complete
menuItemSchema.virtual('hasNutrition').get(function() {
  return this.nutritionalInfo && this.nutritionStatus === 'completed';
});

// Method to get total macronutrients
menuItemSchema.methods.getTotalMacros = function() {
  if (!this.nutritionalInfo) {
    return {
      totalMacros: 0,
      proteinCalories: 0,
      carbCalories: 0,
      fatCalories: 0
    };
  }
  
  const { protein, carbohydrates, fat } = this.nutritionalInfo;
  return {
    totalMacros: protein + carbohydrates + fat,
    proteinCalories: protein * 4,
    carbCalories: carbohydrates * 4,
    fatCalories: fat * 9
  };
};

// Method to add nutrition data
menuItemSchema.methods.addNutrition = function(nutritionData, addedBy) {
  this.nutritionalInfo = nutritionData;
  this.nutritionStatus = 'completed';
  this.nutritionAddedBy = addedBy;
  this.nutritionAddedAt = new Date();
  return this.save();
};

// Static method to find menu items by date and category
menuItemSchema.statics.findByDateAndCategory = function(date, category) {
  return this.find({
    date: dateUtils.toMongoDateRange(date),
    category: category,
    isActive: true
  });
};

// Static method to get daily menu (using IST)
menuItemSchema.statics.getDailyMenu = function(date) {
  return this.find({
    date: dateUtils.toMongoDateRange(date),
    isActive: true
  }).sort({ category: 1, name: 1 });
};

// Static method to find items pending nutrition data
menuItemSchema.statics.findPendingNutrition = function(date) {
  return this.find({
    date: dateUtils.toMongoDateRange(date),
    isActive: true,
    nutritionStatus: 'pending'
  }).sort({ category: 1, name: 1 });
};

// Static method to find items with nutrition data
menuItemSchema.statics.findWithNutrition = function(date) {
  return this.find({
    date: dateUtils.toMongoDateRange(date),
    isActive: true,
    nutritionStatus: 'completed'
  }).sort({ category: 1, name: 1 });
};

module.exports = mongoose.model('MenuItem', menuItemSchema);