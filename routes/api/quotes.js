const express = require('express');
const router = express.Router();
const Quote = require('../../models/Quote');
const { requireAuth } = require('../../middleware/auth');

// Input validation middleware
const validateQuoteInput = (req, res, next) => {
  const { text, author, category } = req.body;
  const errors = [];

  // Validate required fields
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    errors.push('Quote text is required and must be at least 10 characters long');
  }

  if (!author || typeof author !== 'string' || author.trim().length < 2) {
    errors.push('Author name is required and must be at least 2 characters long');
  }

  // Validate category if provided
  if (category && !['motivational', 'food', 'health', 'general'].includes(category)) {
    errors.push('Category must be one of: motivational, food, health, general');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

/**
 * GET /api/quotes
 * Get quotes with optional filtering
 * Query params: category, active, limit
 */
router.get('/', async (req, res) => {
  try {
    const { category, active, limit = 50 } = req.query;
    let query = {};

    // Category filtering
    if (category) {
      if (!['motivational', 'food', 'health', 'general'].includes(category)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category'
        });
      }
      query.category = category;
    }

    // Active status filtering
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    const quotes = await Quote.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: quotes,
      count: quotes.length
    });

  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quotes'
    });
  }
});

/**
 * GET /api/quotes/random
 * Get a random active quote
 * Query params: category (optional)
 */
router.get('/random', async (req, res) => {
  try {
    const { category } = req.query;
    
    // Validate category if provided
    if (category && !['motivational', 'food', 'health', 'general'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    const randomQuote = await Quote.getRandomQuote(category);

    if (!randomQuote) {
      return res.status(404).json({
        success: false,
        error: 'No active quotes found'
      });
    }

    res.json({
      success: true,
      data: randomQuote
    });

  } catch (error) {
    console.error('Error fetching random quote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch random quote'
    });
  }
});

/**
 * GET /api/quotes/active
 * Get all active quotes
 * Query params: category (optional)
 */
router.get('/active', async (req, res) => {
  try {
    const { category } = req.query;
    
    // Validate category if provided
    if (category && !['motivational', 'food', 'health', 'general'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    const activeQuotes = await Quote.getActiveQuotes(category);

    res.json({
      success: true,
      data: activeQuotes,
      count: activeQuotes.length
    });

  } catch (error) {
    console.error('Error fetching active quotes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active quotes'
    });
  }
});

/**
 * GET /api/quotes/:id
 * Get specific quote by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid quote ID'
      });
    }

    const quote = await Quote.findById(id);
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found'
      });
    }

    res.json({
      success: true,
      data: quote
    });

  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quote'
    });
  }
});

/**
 * POST /api/quotes
 * Create new quote
 */
router.post('/', requireAuth, validateQuoteInput, async (req, res) => {
  try {
    const { text, author, category, isActive } = req.body;

    const quoteData = {
      text: text.trim(),
      author: author.trim(),
      category: category || 'motivational',
      isActive: isActive !== undefined ? isActive : true
    };

    const quote = new Quote(quoteData);
    await quote.save();

    res.status(201).json({
      success: true,
      data: quote,
      message: 'Quote created successfully'
    });

  } catch (error) {
    console.error('Error creating quote:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create quote'
    });
  }
});

/**
 * PUT /api/quotes/:id
 * Update quote
 */
router.put('/:id', requireAuth, validateQuoteInput, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid quote ID'
      });
    }

    const { text, author, category, isActive } = req.body;

    const updateData = {
      text: text.trim(),
      author: author.trim(),
      category: category || 'motivational',
      isActive: isActive !== undefined ? isActive : true
    };

    const quote = await Quote.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found'
      });
    }

    res.json({
      success: true,
      data: quote,
      message: 'Quote updated successfully'
    });

  } catch (error) {
    console.error('Error updating quote:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update quote'
    });
  }
});

/**
 * DELETE /api/quotes/:id
 * Delete quote
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid quote ID'
      });
    }

    const quote = await Quote.findByIdAndDelete(id);

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found'
      });
    }

    res.json({
      success: true,
      message: 'Quote deleted successfully',
      data: { 
        id: quote._id, 
        text: quote.text.substring(0, 50) + '...',
        author: quote.author
      }
    });

  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete quote'
    });
  }
});

/**
 * PATCH /api/quotes/:id/toggle-active
 * Toggle active status of quote
 */
router.patch('/:id/toggle-active', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid quote ID'
      });
    }

    const quote = await Quote.findById(id);

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found'
      });
    }

    quote.isActive = !quote.isActive;
    await quote.save();

    res.json({
      success: true,
      data: quote,
      message: `Quote ${quote.isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Error toggling quote status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle quote status'
    });
  }
});

/**
 * POST /api/quotes/bulk
 * Create multiple quotes at once
 */
router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const { quotes } = req.body;

    if (!Array.isArray(quotes) || quotes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Quotes array is required and must not be empty'
      });
    }

    if (quotes.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Cannot create more than 50 quotes at once'
      });
    }

    // Validate each quote
    const validationErrors = [];
    const validQuotes = [];

    quotes.forEach((quote, index) => {
      const errors = [];
      
      if (!quote.text || typeof quote.text !== 'string' || quote.text.trim().length < 10) {
        errors.push(`Quote ${index + 1}: Text is required and must be at least 10 characters long`);
      }
      
      if (!quote.author || typeof quote.author !== 'string' || quote.author.trim().length < 2) {
        errors.push(`Quote ${index + 1}: Author is required and must be at least 2 characters long`);
      }
      
      if (quote.category && !['motivational', 'food', 'health', 'general'].includes(quote.category)) {
        errors.push(`Quote ${index + 1}: Invalid category`);
      }

      if (errors.length > 0) {
        validationErrors.push(...errors);
      } else {
        validQuotes.push({
          text: quote.text.trim(),
          author: quote.author.trim(),
          category: quote.category || 'motivational',
          isActive: quote.isActive !== undefined ? quote.isActive : true
        });
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const createdQuotes = await Quote.insertMany(validQuotes);

    res.status(201).json({
      success: true,
      data: createdQuotes,
      message: `${createdQuotes.length} quotes created successfully`,
      count: createdQuotes.length
    });

  } catch (error) {
    console.error('Error creating bulk quotes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create quotes'
    });
  }
});

module.exports = router;