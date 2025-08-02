const express = require('express');
const router = express.Router();
const WasteData = require('../../models/WasteData');
const { requireAuth } = require('../../middleware/auth');
const dateUtils = require('../../utils/dateUtils');
const { DateTime } = require('luxon');

// Input validation middleware
const validateWasteDataInput = (req, res, next) => {
  const { date, breakfast, lunch, dinner, snacks } = req.body;
  const errors = [];

  // Validate date
  if (!date) {
    errors.push('Valid date is required');
  } else {
    const wasteDate = dateUtils.parseISTDate(date);
    if (!wasteDate.isValid) {
      errors.push('Valid date is required');
    } else {
      const today = dateUtils.getISTEndOfDay();
      
      if (wasteDate > today) {
        errors.push('Waste data date cannot be in the future');
      }
    }
  }

  // Validate meal waste data
  const validateMealData = (mealData, mealName) => {
    if (!mealData || typeof mealData !== 'object') {
      errors.push(`${mealName} waste data is required`);
      return;
    }

    const { wasteAmount, totalPrepared } = mealData;

    if (typeof wasteAmount !== 'number' || wasteAmount < 0 || wasteAmount > 1000) {
      errors.push(`${mealName} waste amount must be a number between 0 and 1000 kg`);
    }

    if (typeof totalPrepared !== 'number' || totalPrepared < 0.1 || totalPrepared > 5000) {
      errors.push(`${mealName} total prepared amount must be a number between 0.1 and 5000 kg`);
    }

    if (typeof wasteAmount === 'number' && typeof totalPrepared === 'number' && wasteAmount > totalPrepared) {
      errors.push(`${mealName} waste amount cannot exceed total prepared amount`);
    }
  };

  validateMealData(breakfast, 'Breakfast');
  validateMealData(lunch, 'Lunch');
  validateMealData(dinner, 'Dinner');
  validateMealData(snacks, 'Snacks');

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
 * GET /api/waste-data
 * Get waste data with optional filtering
 * Query params: date, startDate, endDate, limit
 */
router.get('/', async (req, res) => {
  try {
    const { date, startDate, endDate, limit = 30 } = req.query;
    let query = {};

    if (date) {
      // Single date query
      const targetDate = dateUtils.parseISTDate(date);
      if (!targetDate.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }
      
      query.date = dateUtils.toMongoDateRange(targetDate);
    } else if (startDate || endDate) {
      // Date range query
      query.date = {};
      
      if (startDate) {
        const start = dateUtils.parseISTDate(startDate);
        if (!start.isValid) {
          return res.status(400).json({
            success: false,
            error: 'Invalid start date format'
          });
        }
        query.date.$gte = start.toJSDate();
      }
      
      if (endDate) {
        const end = dateUtils.parseISTDate(endDate);
        if (!end.isValid) {
          return res.status(400).json({
            success: false,
            error: 'Invalid end date format'
          });
        }
        query.date.$lte = dateUtils.getISTEndOfDay(end).toJSDate();
      }
    }

    const wasteData = await WasteData.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: wasteData,
      count: wasteData.length
    });

  } catch (error) {
    console.error('Error fetching waste data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch waste data'
    });
  }
});

/**
 * GET /api/waste-data/previous-day
 * Get previous day's waste data
 */
router.get('/previous-day', async (req, res) => {
  try {
    const { referenceDate } = req.query;
    const refDate = referenceDate ? dateUtils.parseISTDate(referenceDate) : dateUtils.getISTEndOfDay();
    
    if (!refDate.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference date format'
      });
    }

    const previousDayWaste = await WasteData.getPreviousDayWaste(refDate.toJSDate());

    if (!previousDayWaste) {
      return res.status(404).json({
        success: false,
        error: 'No waste data found for previous day'
      });
    }

    res.json({
      success: true,
      data: previousDayWaste
    });

  } catch (error) {
    console.error('Error fetching previous day waste data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch previous day waste data'
    });
  }
});

/**
 * GET /api/waste-data/stats
 * Get waste statistics for a period
 * Query params: days (default: 7)
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const numDays = parseInt(days);
    
    if (isNaN(numDays) || numDays < 1 || numDays > 365) {
      return res.status(400).json({
        success: false,
        error: 'Days must be a number between 1 and 365'
      });
    }

    const stats = await WasteData.getWasteStats(numDays);

    res.json({
      success: true,
      data: stats.length > 0 ? stats[0] : null,
      period: `${numDays} days`
    });

  } catch (error) {
    console.error('Error fetching waste statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch waste statistics'
    });
  }
});

/**
 * GET /api/waste-data/:id
 * Get specific waste data by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid waste data ID'
      });
    }

    const wasteData = await WasteData.findById(id);
    
    if (!wasteData) {
      return res.status(404).json({
        success: false,
        error: 'Waste data not found'
      });
    }

    res.json({
      success: true,
      data: wasteData
    });

  } catch (error) {
    console.error('Error fetching waste data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch waste data'
    });
  }
});

/**
 * POST /api/waste-data
 * Create new waste data entry
 */
router.post('/', requireAuth, validateWasteDataInput, async (req, res) => {
  try {
    const { date, breakfast, lunch, dinner, notes } = req.body;
    
    const wasteDate = dateUtils.parseISTDate(date);
    
    // Check if waste data already exists for this date
    const existingData = await WasteData.findOne({
      date: dateUtils.toMongoDateRange(wasteDate)
    });

    if (existingData) {
      return res.status(409).json({
        success: false,
        error: 'Waste data already exists for this date',
        existingId: existingData._id
      });
    }

    const wasteDataEntry = new WasteData({
      date: wasteDate.toJSDate(),
      breakfast,
      lunch,
      dinner,
      notes: notes ? notes.trim() : ''
    });

    await wasteDataEntry.save();

    res.status(201).json({
      success: true,
      data: wasteDataEntry,
      message: 'Waste data created successfully'
    });

  } catch (error) {
    console.error('Error creating waste data:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Waste data already exists for this date'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create waste data'
    });
  }
});

/**
 * PUT /api/waste-data/:id
 * Update waste data entry
 */
router.put('/:id', requireAuth, validateWasteDataInput, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid waste data ID'
      });
    }

    const { date, breakfast, lunch, dinner, notes } = req.body;
    const wasteDate = dateUtils.parseISTDate(date);

    // Check if another entry exists for the new date (if date is being changed)
    const existingData = await WasteData.findOne({
      _id: { $ne: id },
      date: dateUtils.toMongoDateRange(wasteDate)
    });

    if (existingData) {
      return res.status(409).json({
        success: false,
        error: 'Waste data already exists for this date',
        existingId: existingData._id
      });
    }

    const updateData = {
      date: wasteDate.toJSDate(),
      breakfast,
      lunch,
      dinner,
      notes: notes ? notes.trim() : ''
    };

    const wasteData = await WasteData.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!wasteData) {
      return res.status(404).json({
        success: false,
        error: 'Waste data not found'
      });
    }

    res.json({
      success: true,
      data: wasteData,
      message: 'Waste data updated successfully'
    });

  } catch (error) {
    console.error('Error updating waste data:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Waste data already exists for this date'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update waste data'
    });
  }
});

/**
 * DELETE /api/waste-data/:id
 * Delete waste data entry
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid waste data ID'
      });
    }

    const wasteData = await WasteData.findByIdAndDelete(id);

    if (!wasteData) {
      return res.status(404).json({
        success: false,
        error: 'Waste data not found'
      });
    }

    res.json({
      success: true,
      message: 'Waste data deleted successfully',
      data: { 
        id: wasteData._id, 
        date: wasteData.formattedDate 
      }
    });

  } catch (error) {
    console.error('Error deleting waste data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete waste data'
    });
  }
});



module.exports = router;