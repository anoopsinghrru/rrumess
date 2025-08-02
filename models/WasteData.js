const mongoose = require('mongoose');
const dateUtils = require('../utils/dateUtils');

const mealWasteSchema = new mongoose.Schema({
  wasteAmount: {
    type: Number,
    required: [true, 'Waste amount is required'],
    min: [0, 'Waste amount cannot be negative'],
    max: [1000, 'Waste amount cannot exceed 1000 kg']
  },
  totalPrepared: {
    type: Number,
    required: [true, 'Total prepared amount is required'],
    min: [0.1, 'Total prepared amount must be at least 0.1 kg'],
    max: [5000, 'Total prepared amount cannot exceed 5000 kg']
  },
  wastePercentage: {
    type: Number,
    min: [0, 'Waste percentage cannot be negative'],
    max: [100, 'Waste percentage cannot exceed 100%']
  }
});

// Method to calculate waste percentage
mealWasteSchema.methods.calculatePercentage = function() {
  if (this.wasteAmount !== undefined && this.totalPrepared !== undefined && this.totalPrepared > 0) {
    this.wastePercentage = Math.round((this.wasteAmount / this.totalPrepared) * 100 * 100) / 100;
  } else {
    this.wastePercentage = 0;
  }
  return this.wastePercentage;
};

const wasteDataSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Date is required'],
    unique: true,
    validate: {
      validator: function(value) {
        // Date should not be in the future (allow today)
        const today = dateUtils.getISTEndOfDay();
        return dateUtils.toIST(value) <= today;
      },
      message: 'Waste data date cannot be in the future'
    }
  },
  breakfast: {
    type: mealWasteSchema,
    required: [true, 'Breakfast waste data is required']
  },
  lunch: {
    type: mealWasteSchema,
    required: [true, 'Lunch waste data is required']
  },
  dinner: {
    type: mealWasteSchema,
    required: [true, 'Dinner waste data is required']
  },
  snacks: {
    type: mealWasteSchema,
    required: [true, 'Snacks waste data is required']
  },
  totalWaste: {
    type: Number,
    min: [0, 'Total waste cannot be negative']
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient querying by date
wasteDataSchema.index({ date: -1 });

// Pre-save middleware to calculate total waste and percentages
wasteDataSchema.pre('save', function() {
  // Calculate percentages for each meal
  this.breakfast.calculatePercentage();
  this.lunch.calculatePercentage();
  this.dinner.calculatePercentage();
  this.snacks.calculatePercentage();
  
  // Calculate total waste
  this.totalWaste = this.breakfast.wasteAmount + this.lunch.wasteAmount + this.dinner.wasteAmount + this.snacks.wasteAmount;
});

// Virtual for formatted date
wasteDataSchema.virtual('formattedDate').get(function() {
  return dateUtils.formatISTDate(this.date);
});

// Virtual for overall waste percentage
wasteDataSchema.virtual('overallWastePercentage').get(function() {
  const totalPrepared = this.breakfast.totalPrepared + this.lunch.totalPrepared + this.dinner.totalPrepared + this.snacks.totalPrepared;
  if (totalPrepared > 0) {
    return Math.round((this.totalWaste / totalPrepared) * 100 * 100) / 100;
  }
  return 0;
});

// Method to get waste summary
wasteDataSchema.methods.getWasteSummary = function() {
  return {
    date: this.formattedDate,
    totalWaste: this.totalWaste,
    overallPercentage: this.overallWastePercentage,
    breakdown: {
      breakfast: {
        waste: this.breakfast.wasteAmount,
        percentage: this.breakfast.wastePercentage
      },
      lunch: {
        waste: this.lunch.wasteAmount,
        percentage: this.lunch.wastePercentage
      },
      dinner: {
        waste: this.dinner.wasteAmount,
        percentage: this.dinner.wastePercentage
      },
      snacks: {
        waste: this.snacks.wasteAmount,
        percentage: this.snacks.wastePercentage
      }
    }
  };
};

// Static method to find waste data by date range
wasteDataSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    date: {
      $gte: dateUtils.getISTStartOfDay(startDate).toJSDate(),
      $lte: dateUtils.getISTEndOfDay(endDate).toJSDate()
    }
  }).sort({ date: -1 });
};

// Static method to get previous day's waste data
wasteDataSchema.statics.getPreviousDayWaste = function(referenceDate = dateUtils.getCurrentIST().toJSDate()) {
  const previousDay = dateUtils.subtractDays(referenceDate, 1);
  
  return this.findOne({
    date: dateUtils.toMongoDateRange(previousDay)
  });
};

// Static method to get waste statistics for a period
wasteDataSchema.statics.getWasteStats = function(days = 7) {
  const endDate = dateUtils.getCurrentIST();
  const startDate = dateUtils.subtractDays(endDate, days);
  
  return this.aggregate([
    {
      $match: {
        date: {
          $gte: startDate.toJSDate(),
          $lte: endDate.toJSDate()
        }
      }
    },
    {
      $group: {
        _id: null,
        avgTotalWaste: { $avg: '$totalWaste' },
        maxTotalWaste: { $max: '$totalWaste' },
        minTotalWaste: { $min: '$totalWaste' },
        totalWasteSum: { $sum: '$totalWaste' },
        avgBreakfastWaste: { $avg: '$breakfast.wastePercentage' },
        avgLunchWaste: { $avg: '$lunch.wastePercentage' },
        avgDinnerWaste: { $avg: '$dinner.wastePercentage' },
        avgSnacksWaste: { $avg: '$snacks.wastePercentage' },
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('WasteData', wasteDataSchema);