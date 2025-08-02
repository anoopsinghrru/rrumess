const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Quote text is required'],
    trim: true,
    minlength: [10, 'Quote text must be at least 10 characters long'],
    maxlength: [500, 'Quote text cannot exceed 500 characters']
  },
  author: {
    type: String,
    required: [true, 'Quote author is required'],
    trim: true,
    minlength: [2, 'Author name must be at least 2 characters long'],
    maxlength: [100, 'Author name cannot exceed 100 characters']
  },
  category: {
    type: String,
    enum: {
      values: ['motivational', 'food', 'health', 'general'],
      message: 'Category must be one of: motivational, food, health, general'
    },
    default: 'motivational'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
quoteSchema.index({ isActive: 1, category: 1 });

// Static method to get random active quote
quoteSchema.statics.getRandomQuote = function(category = null) {
  const query = { isActive: true };
  if (category) {
    query.category = category;
  }
  
  return this.aggregate([
    { $match: query },
    { $sample: { size: 1 } }
  ]).then(quotes => quotes[0] || null);
};

// Static method to get all active quotes
quoteSchema.statics.getActiveQuotes = function(category = null) {
  const query = { isActive: true };
  if (category) {
    query.category = category;
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

// Method to format quote for display
quoteSchema.methods.getFormattedQuote = function() {
  return {
    text: `"${this.text}"`,
    author: `- ${this.author}`,
    category: this.category
  };
};

module.exports = mongoose.model('Quote', quoteSchema);