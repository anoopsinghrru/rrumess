const express = require('express');
const router = express.Router();
const MenuItem = require('../../models/MenuItem');
const { requireAuth, requireMenuPermission } = require('../../middleware/auth');
const dateUtils = require('../../utils/dateUtils');
const { DateTime } = require('luxon');

// Input validation middleware
const validateMenuItemInput = (req, res, next) => {
  const { name, category, date, nutritionalInfo } = req.body;
  const errors = [];

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters long');
  }

  if (!category || !['breakfast', 'lunch', 'snacks', 'dinner'].includes(category)) {
    errors.push('Category must be one of: breakfast, lunch, snacks, dinner');
  }

  if (!date) {
    errors.push('Valid date is required');
  } else {
    const parsedDate = dateUtils.parseISTDate(date);
    if (!parsedDate.isValid) {
      errors.push('Valid date is required');
    }
  }

  // Validate nutritional info
  if (!nutritionalInfo || typeof nutritionalInfo !== 'object') {
    errors.push('Nutritional information is required');
  } else {
    const { calories, protein, carbohydrates, fat } = nutritionalInfo;
    
    if (typeof calories !== 'number' || calories < 0 || calories > 2000) {
      errors.push('Calories must be a number between 0 and 2000');
    }
    
    if (typeof protein !== 'number' || protein < 0 || protein > 200) {
      errors.push('Protein must be a number between 0 and 200g');
    }
    
    if (typeof carbohydrates !== 'number' || carbohydrates < 0 || carbohydrates > 500) {
      errors.push('Carbohydrates must be a number between 0 and 500g');
    }
    
    if (typeof fat !== 'number' || fat < 0 || fat > 200) {
      errors.push('Fat must be a number between 0 and 200g');
    }
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
 * GET /api/menu-items
 * Get menu items with optional filtering
 * Query params: date, category, active
 */
router.get('/', async (req, res) => {
  try {
    const { date, category, active } = req.query;
    let query = {};

    // Date filtering
    if (date) {
      const targetDate = dateUtils.parseISTDate(date);
      if (!targetDate.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }
      
      query.date = dateUtils.toMongoDateRange(targetDate);
    }

    // Category filtering
    if (category) {
      if (!['breakfast', 'lunch', 'snacks', 'dinner'].includes(category)) {
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

    const menuItems = await MenuItem.find(query)
      .sort({ date: -1, category: 1, name: 1 })
      .limit(100); // Limit results for performance

    res.json({
      success: true,
      data: menuItems,
      count: menuItems.length
    });

  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu items'
    });
  }
});

/**
 * GET /api/menu-items/daily/:date
 * Get complete daily menu for a specific date
 */
router.get('/daily/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = dateUtils.parseISTDate(date);
    
    if (!targetDate.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    const dailyMenu = await MenuItem.getDailyMenu(targetDate);
    
    // Group by category
    const groupedMenu = {
      breakfast: [],
      lunch: [],
      snacks: [],
      dinner: []
    };

    dailyMenu.forEach(item => {
      if (groupedMenu[item.category]) {
        groupedMenu[item.category].push(item);
      }
    });

    res.json({
      success: true,
      data: {
        date: dateUtils.formatDateForInput(targetDate),
        menu: groupedMenu,
        totalItems: dailyMenu.length
      }
    });

  } catch (error) {
    console.error('Error fetching daily menu:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch daily menu'
    });
  }
});

/**
 * GET /api/menu-items/:id
 * Get a specific menu item by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid menu item ID'
      });
    }

    const menuItem = await MenuItem.findById(id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: menuItem
    });

  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu item'
    });
  }
});

/**
 * POST /api/menu-items
 * Create a new menu item
 */
router.post('/', requireAuth, validateMenuItemInput, async (req, res) => {
  try {
    const menuItemData = {
      name: req.body.name.trim(),
      category: req.body.category,
      description: req.body.description ? req.body.description.trim() : '',
      date: dateUtils.parseISTDate(req.body.date),
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      nutritionalInfo: req.body.nutritionalInfo
    };

    const menuItem = new MenuItem(menuItemData);
    await menuItem.save();

    res.status(201).json({
      success: true,
      data: menuItem,
      message: 'Menu item created successfully'
    });

  } catch (error) {
    console.error('Error creating menu item:', error);
    
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
      error: 'Failed to create menu item'
    });
  }
});

/**
 * PUT /api/menu-items/:id
 * Update a menu item
 */
router.put('/:id', requireAuth, validateMenuItemInput, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid menu item ID'
      });
    }

    const updateData = {
      name: req.body.name.trim(),
      category: req.body.category,
      description: req.body.description ? req.body.description.trim() : '',
      date: dateUtils.parseISTDate(req.body.date),
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      nutritionalInfo: req.body.nutritionalInfo
    };

    const menuItem = await MenuItem.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: menuItem,
      message: 'Menu item updated successfully'
    });

  } catch (error) {
    console.error('Error updating menu item:', error);
    
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
      error: 'Failed to update menu item'
    });
  }
});

/**
 * DELETE /api/menu-items/:id
 * Delete a menu item
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid menu item ID'
      });
    }

    const menuItem = await MenuItem.findByIdAndDelete(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      message: 'Menu item deleted successfully',
      data: { id: menuItem._id, name: menuItem.name }
    });

  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete menu item'
    });
  }
});

/**
 * PATCH /api/menu-items/:id/toggle-active
 * Toggle active status of a menu item
 */
router.patch('/:id/toggle-active', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid menu item ID'
      });
    }

    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    menuItem.isActive = !menuItem.isActive;
    await menuItem.save();

    res.json({
      success: true,
      data: menuItem,
      message: `Menu item ${menuItem.isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Error toggling menu item status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle menu item status'
    });
  }
});

/**
 * POST /api/menu-items/bulk-import
 * Bulk import menu items from CSV file
 */
router.post('/bulk-import', requireMenuPermission, async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.files || !req.files.csvFile) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is required'
      });
    }

    const csvFile = req.files.csvFile;
    
    // Validate file type
    if (!csvFile.mimetype.includes('csv') && !csvFile.name.endsWith('.csv')) {
      return res.status(400).json({
        success: false,
        error: 'File must be a CSV file'
      });
    }

    // Parse CSV content
    const csvContent = csvFile.data.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'CSV file must contain at least a header row and one data row'
      });
    }

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['name', 'category', 'date'];
    const optionalNutritionHeaders = ['calories', 'protein', 'carbohydrates', 'fat', 'fiber'];
    
    // Validate required headers
    const missingRequiredHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingRequiredHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required headers: ${missingRequiredHeaders.join(', ')}`,
        expectedRequiredHeaders: requiredHeaders,
        expectedOptionalHeaders: optionalNutritionHeaders
      });
    }

    const results = {
      total: lines.length - 1,
      successful: 0,
      failed: 0,
      withNutrition: 0,
      withoutNutrition: 0,
      errors: []
    };

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = line.split(',').map(v => v.trim());
        const rowData = {};
        
        // Map values to headers
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        // Validate and transform data
        const parsedDate = dateUtils.parseISTDate(rowData.date);
        
        // Base menu item data
        const menuItemData = {
          name: rowData.name.trim(),
          category: rowData.category.toLowerCase(),
          description: rowData.description ? rowData.description.trim() : '',
          date: parsedDate.toJSDate(), // Convert DateTime to JS Date for MongoDB
          isActive: rowData.isactive !== undefined ? rowData.isactive.toLowerCase() === 'true' : true,
          nutritionStatus: 'pending', // Default to pending
          nutritionalInfo: undefined // Will be set only if complete nutrition data is provided
        };

        // Validate the basic data
        if (!menuItemData.name || menuItemData.name.length < 2) {
          throw new Error('Name must be at least 2 characters long');
        }

        if (!['breakfast', 'lunch', 'snacks', 'dinner'].includes(menuItemData.category)) {
          throw new Error('Category must be one of: breakfast, lunch, snacks, dinner');
        }

        if (!parsedDate.isValid) {
          throw new Error('Invalid date format');
        }

        // Check if nutrition data is provided
        const hasNutritionData = optionalNutritionHeaders.some(header => 
          headers.includes(header) && rowData[header] && rowData[header].trim() !== ''
        );

        if (hasNutritionData) {
          // Validate that all required nutrition fields are present
          const missingNutritionFields = optionalNutritionHeaders.filter(header => 
            !headers.includes(header) || !rowData[header] || rowData[header].trim() === ''
          );

          if (missingNutritionFields.length > 0) {
            throw new Error(`Incomplete nutrition data. Missing: ${missingNutritionFields.join(', ')}`);
          }

          // Parse and validate nutrition data
          const nutritionData = {
            calories: parseFloat(rowData.calories) || 0,
            protein: parseFloat(rowData.protein) || 0,
            carbohydrates: parseFloat(rowData.carbohydrates) || 0,
            fat: parseFloat(rowData.fat) || 0,
            fiber: parseFloat(rowData.fiber) || 0
          };

          // Validate nutrition ranges
          if (nutritionData.calories < 0 || nutritionData.calories > 2000) {
            throw new Error('Calories must be between 0 and 2000');
          }
          if (nutritionData.protein < 0 || nutritionData.protein > 200) {
            throw new Error('Protein must be between 0 and 200g');
          }
          if (nutritionData.carbohydrates < 0 || nutritionData.carbohydrates > 500) {
            throw new Error('Carbohydrates must be between 0 and 500g');
          }
          if (nutritionData.fat < 0 || nutritionData.fat > 200) {
            throw new Error('Fat must be between 0 and 200g');
          }
          if (nutritionData.fiber < 0 || nutritionData.fiber > 100) {
            throw new Error('Fiber must be between 0 and 100g');
          }

          // Set nutrition data and status
          menuItemData.nutritionalInfo = nutritionData;
          menuItemData.nutritionStatus = 'completed';
          menuItemData.nutritionAddedBy = req.user._id;
          menuItemData.nutritionAddedAt = new Date();
          results.withNutrition++;
        } else {
          results.withoutNutrition++;
        }

        // Create menu item
        const menuItem = new MenuItem(menuItemData);
        await menuItem.save();
        results.successful++;

      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error.message,
          data: line
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk import completed. ${results.successful} items imported successfully, ${results.failed} failed.`,
      data: {
        ...results,
        summary: {
          totalProcessed: results.total,
          successful: results.successful,
          failed: results.failed,
          withNutrition: results.withNutrition,
          withoutNutrition: results.withoutNutrition,
          pendingNutrition: results.withoutNutrition
        }
      }
    });

  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk import'
    });
  }
});





module.exports = router;