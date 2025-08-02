const express = require('express');
const router = express.Router();
const SpecialMenu = require('../../models/SpecialMenu');
const { requireAuth } = require('../../middleware/auth');
const dateUtils = require('../../utils/dateUtils');
const { DateTime } = require('luxon');

// Input validation middleware
const validateSpecialMenuInput = (req, res, next) => {
  const { name, state, items, startDate, endDate } = req.body;
  const errors = [];

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length < 3) {
    errors.push('Menu name is required and must be at least 3 characters long');
  }

  if (!state || typeof state !== 'string' || state.trim().length < 2) {
    errors.push('State is required and must be at least 2 characters long');
  }

  // Validate dates
  if (!startDate) {
    errors.push('Valid start date is required');
  } else {
    const start = dateUtils.parseISTDate(startDate);
    if (!start.isValid) {
      errors.push('Valid start date is required');
    }
  }

  if (!endDate) {
    errors.push('Valid end date is required');
  } else {
    const end = dateUtils.parseISTDate(endDate);
    if (!end.isValid) {
      errors.push('Valid end date is required');
    }
  }

  if (startDate && endDate) {
    const start = dateUtils.parseISTDate(startDate);
    const end = dateUtils.parseISTDate(endDate);
    
    if (end <= start) {
      errors.push('End date must be after start date');
    }

    // Check if duration exceeds one year
    const oneYearFromStart = start.plus({ years: 1 });
    if (end > oneYearFromStart) {
      errors.push('Special menu duration cannot exceed one year');
    }
  }

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push('At least one menu item is required');
  } else if (items.length > 10) {
    errors.push('Cannot have more than 10 menu items');
  } else {
    items.forEach((item, index) => {
      if (!item.name || typeof item.name !== 'string' || item.name.trim().length < 2) {
        errors.push(`Item ${index + 1}: Name is required and must be at least 2 characters long`);
      }
      
      if (!item.description || typeof item.description !== 'string' || item.description.trim().length < 10) {
        errors.push(`Item ${index + 1}: Description is required and must be at least 10 characters long`);
      }
    });
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
 * GET /api/special-menus
 * Get special menus with optional filtering
 * Query params: state, active, date, upcoming
 */
router.get('/', async (req, res) => {
  try {
    const { state, active, date, upcoming } = req.query;
    let query = {};

    // State filtering
    if (state) {
      query.state = new RegExp(state, 'i'); // Case-insensitive search
    }

    // Active status filtering
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    // Date filtering
    if (date) {
      const targetDate = dateUtils.parseISTDate(date);
      if (!targetDate.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }
      
      query.startDate = { $lte: targetDate.toJSDate() };
      query.endDate = { $gte: targetDate.toJSDate() };
    }

    // Upcoming menus (future start date)
    if (upcoming === 'true') {
      query.startDate = { $gt: dateUtils.getCurrentIST().toJSDate() };
    }

    const specialMenus = await SpecialMenu.find(query)
      .sort({ startDate: -1 })
      .limit(50);

    res.json({
      success: true,
      data: specialMenus,
      count: specialMenus.length
    });

  } catch (error) {
    console.error('Error fetching special menus:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special menus'
    });
  }
});

/**
 * GET /api/special-menus/current
 * Get special menu for current date
 */
router.get('/current', async (req, res) => {
  try {
    const { referenceDate } = req.query;
    const refDate = referenceDate ? dateUtils.parseISTDate(referenceDate) : dateUtils.getCurrentIST();
    
    if (!refDate.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference date format'
      });
    }

    const currentMenus = await SpecialMenu.findSpecialMenuForDate(refDate);

    res.json({
      success: true,
      data: currentMenus,
      count: currentMenus.length
    });

  } catch (error) {
    console.error('Error fetching current special menus:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current special menus'
    });
  }
});

/**
 * GET /api/special-menus/active/:date
 * Get active special menus for a specific date
 */
router.get('/active/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = dateUtils.parseISTDate(date);
    
    if (!targetDate.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    const activeMenus = await SpecialMenu.findActiveForDate(targetDate);

    res.json({
      success: true,
      data: activeMenus,
      count: activeMenus.length,
      date: dateUtils.formatDateForInput(targetDate)
    });

  } catch (error) {
    console.error('Error fetching active special menus:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active special menus'
    });
  }
});

/**
 * GET /api/special-menus/:id
 * Get specific special menu by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid special menu ID'
      });
    }

    const specialMenu = await SpecialMenu.findById(id);
    
    if (!specialMenu) {
      return res.status(404).json({
        success: false,
        error: 'Special menu not found'
      });
    }

    res.json({
      success: true,
      data: specialMenu
    });

  } catch (error) {
    console.error('Error fetching special menu:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special menu'
    });
  }
});

/**
 * POST /api/special-menus
 * Create new special menu
 */
router.post('/', requireAuth, validateSpecialMenuInput, async (req, res) => {
  try {
    const { name, state, description, items, startDate, endDate, isActive } = req.body;

    // Check for overlapping menus
    const overlappingMenus = await SpecialMenu.findOverlapping(
      dateUtils.parseISTDate(startDate).toJSDate(),
      dateUtils.parseISTDate(endDate).toJSDate()
    );

    if (overlappingMenus.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Special menu dates overlap with existing menu',
        overlapping: overlappingMenus.map(menu => ({
          id: menu._id,
          name: menu.name,
          state: menu.state,
          startDate: menu.formattedStartDate,
          endDate: menu.formattedEndDate
        }))
      });
    }

    const specialMenuData = {
      name: name.trim(),
      state: state.trim(),
      description: description ? description.trim() : '',
      items: items.map(item => ({
        name: item.name.trim(),
        description: item.description.trim(),
        image: item.image ? item.image.trim() : ''
      })),
      startDate: dateUtils.parseISTDate(startDate).toJSDate(),
      endDate: dateUtils.parseISTDate(endDate).toJSDate(),
      isActive: isActive !== undefined ? isActive : true
    };

    const specialMenu = new SpecialMenu(specialMenuData);
    await specialMenu.save();

    res.status(201).json({
      success: true,
      data: specialMenu,
      message: 'Special menu created successfully'
    });

  } catch (error) {
    console.error('Error creating special menu:', error);
    
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
      error: 'Failed to create special menu'
    });
  }
});

/**
 * PUT /api/special-menus/:id
 * Update special menu
 */
router.put('/:id', requireAuth, validateSpecialMenuInput, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid special menu ID'
      });
    }

    const { name, state, description, items, startDate, endDate, isActive } = req.body;

    // Check for overlapping menus (excluding current menu)
    const overlappingMenus = await SpecialMenu.findOverlapping(
      dateUtils.parseISTDate(startDate).toJSDate(),
      dateUtils.parseISTDate(endDate).toJSDate(),
      id
    );

    if (overlappingMenus.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Special menu dates overlap with existing menu',
        overlapping: overlappingMenus.map(menu => ({
          id: menu._id,
          name: menu.name,
          state: menu.state,
          startDate: menu.formattedStartDate,
          endDate: menu.formattedEndDate
        }))
      });
    }

    const updateData = {
      name: name.trim(),
      state: state.trim(),
      description: description ? description.trim() : '',
      items: items.map(item => ({
        name: item.name.trim(),
        description: item.description.trim(),
        image: item.image ? item.image.trim() : ''
      })),
      startDate: dateUtils.parseISTDate(startDate).toJSDate(),
      endDate: dateUtils.parseISTDate(endDate).toJSDate(),
      isActive: isActive !== undefined ? isActive : true
    };

    const specialMenu = await SpecialMenu.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!specialMenu) {
      return res.status(404).json({
        success: false,
        error: 'Special menu not found'
      });
    }

    res.json({
      success: true,
      data: specialMenu,
      message: 'Special menu updated successfully'
    });

  } catch (error) {
    console.error('Error updating special menu:', error);
    
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
      error: 'Failed to update special menu'
    });
  }
});

/**
 * DELETE /api/special-menus/:id
 * Delete special menu
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid special menu ID'
      });
    }

    const specialMenu = await SpecialMenu.findByIdAndDelete(id);

    if (!specialMenu) {
      return res.status(404).json({
        success: false,
        error: 'Special menu not found'
      });
    }

    res.json({
      success: true,
      message: 'Special menu deleted successfully',
      data: { 
        id: specialMenu._id, 
        name: specialMenu.name,
        state: specialMenu.state
      }
    });

  } catch (error) {
    console.error('Error deleting special menu:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete special menu'
    });
  }
});

/**
 * PATCH /api/special-menus/:id/toggle-active
 * Toggle active status of special menu
 */
router.patch('/:id/toggle-active', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid special menu ID'
      });
    }

    const specialMenu = await SpecialMenu.findById(id);

    if (!specialMenu) {
      return res.status(404).json({
        success: false,
        error: 'Special menu not found'
      });
    }

    specialMenu.isActive = !specialMenu.isActive;
    await specialMenu.save();

    res.json({
      success: true,
      data: specialMenu,
      message: `Special menu ${specialMenu.isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Error toggling special menu status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle special menu status'
    });
  }
});

module.exports = router;