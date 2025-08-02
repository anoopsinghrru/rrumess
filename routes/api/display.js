const express = require('express');
const router = express.Router();
const MenuItem = require('../../models/MenuItem');
const WasteData = require('../../models/WasteData');
const SpecialMenu = require('../../models/SpecialMenu');
const Quote = require('../../models/Quote');
const dateUtils = require('../../utils/dateUtils');
const { DateTime } = require('luxon');
// const cacheService = require('../../services/cacheService');
// const { 
//   displayCache, 
//   menuCache, 
//   nutritionCache, 
//   wasteCache, 
//   specialMenuCache, 
//   quoteCache,
//   cacheStatsMiddleware 
// } = require('../../middleware/cache');

/**
 * GET /api/display/all
 * Get all display data in a single request for optimal performance
 */
router.get('/all', async (req, res) => {
  try {
    const today = dateUtils.getCurrentIST();
    const todayStr = dateUtils.formatDateForInput(today);
    
    // Get all data in parallel for better performance
    const [dailyMenu, wasteData, specialMenus, randomQuote] = await Promise.allSettled([
      MenuItem.getDailyMenu(today),
      WasteData.getPreviousDayWaste(today),
      SpecialMenu.findSpecialMenuForDate(today),
      Quote.getRandomQuote()
    ]);

    // Process daily menu data
    const menuData = dailyMenu.status === 'fulfilled' ? dailyMenu.value : [];
    const groupedMenu = {
      breakfast: [],
      lunch: [],
      snacks: [],
      dinner: []
    };

    menuData.forEach(item => {
      if (groupedMenu[item.category]) {
        groupedMenu[item.category].push({
          name: item.name,
          description: item.description,
          nutritionalInfo: item.nutritionalInfo
        });
      }
    });

    // Process waste data
    const wasteInfo = wasteData.status === 'fulfilled' && wasteData.value ? {
      date: wasteData.value.formattedDate,
      breakfast: wasteData.value.breakfast,
      lunch: wasteData.value.lunch,
      dinner: wasteData.value.dinner,
      totalWaste: wasteData.value.totalWaste
    } : null;

    // Process special menu data
    const specialMenuInfo = specialMenus.status === 'fulfilled' ? specialMenus.value : [];

    // Process quote data
    const quoteInfo = randomQuote.status === 'fulfilled' && randomQuote.value ? {
      text: randomQuote.value.text,
      author: randomQuote.value.author
    } : null;

    res.json({
      success: true,
      data: {
        date: todayStr,
        menu: groupedMenu,
        nutrition: menuData.map(item => ({
          name: item.name,
          meal: item.category,
          calories: item.nutritionalInfo?.calories || 0,
          protein: item.nutritionalInfo?.protein || 0,
          carbohydrates: item.nutritionalInfo?.carbohydrates || 0,
          fat: item.nutritionalInfo?.fat || 0,
          fiber: item.nutritionalInfo?.fiber || 0
        })),
        waste: wasteInfo,
        specialMenu: specialMenuInfo.length > 0 ? {
          name: specialMenuInfo[0].name,
          state: specialMenuInfo[0].state,
          description: specialMenuInfo[0].description,
          items: specialMenuInfo[0].items,
          startDate: specialMenuInfo[0].formattedStartDate,
          endDate: specialMenuInfo[0].formattedEndDate
        } : null,
        quote: quoteInfo
      },
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });

  } catch (error) {
    console.error('Error fetching display data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch display data',
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });
  }
});

/**
 * GET /api/display/menu
 * Get today's menu data
 */
router.get('/menu', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? dateUtils.parseISTDate(date) : dateUtils.getCurrentIST();
    
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
        groupedMenu[item.category].push({
          name: item.name,
          description: item.description,
          nutritionalInfo: item.nutritionalInfo
        });
      }
    });

    res.json({
      success: true,
      data: {
        date: dateUtils.formatDateForInput(targetDate),
        menu: groupedMenu,
        totalItems: dailyMenu.length
      },
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });

  } catch (error) {
    console.error('Error fetching menu data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu data',
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });
  }
});

/**
 * GET /api/display/nutrition
 * Get nutritional information for today's menu
 */
router.get('/nutrition', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? dateUtils.parseISTDate(date) : dateUtils.getCurrentIST();
    
    if (!targetDate.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    const dailyMenu = await MenuItem.getDailyMenu(targetDate);
    
    const nutritionData = dailyMenu.map(item => ({
      name: item.name,
      category: item.category,
      calories: item.nutritionalInfo?.calories || 0,
      protein: item.nutritionalInfo?.protein || 0,
      carbohydrates: item.nutritionalInfo?.carbohydrates || 0,
      fat: item.nutritionalInfo?.fat || 0,
      fiber: item.nutritionalInfo?.fiber || 0
    }));

    res.json({
      success: true,
      data: {
        date: dateUtils.formatDateForInput(targetDate),
        nutrition: nutritionData
      },
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });

  } catch (error) {
    console.error('Error fetching nutrition data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nutrition data',
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });
  }
});

/**
 * GET /api/display/waste
 * Get previous day's waste data
 */
router.get('/waste', async (req, res) => {
  try {
    const { referenceDate } = req.query;
    const refDate = referenceDate ? dateUtils.parseISTDate(referenceDate) : dateUtils.getCurrentIST();
    
    if (!refDate.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference date format'
      });
    }

    const wasteData = await WasteData.getPreviousDayWaste(refDate);

    if (!wasteData) {
      return res.json({
        success: true,
        data: null,
        message: 'No waste data available for previous day',
        timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
      });
    }

    res.json({
      success: true,
      data: {
        date: wasteData.formattedDate,
        breakfast: wasteData.breakfast,
        lunch: wasteData.lunch,
        dinner: wasteData.dinner,
        totalWaste: wasteData.totalWaste
      },
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });

  } catch (error) {
    console.error('Error fetching waste data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch waste data',
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });
  }
});

/**
 * GET /api/display/special-menu
 * Get special menu for current date
 */
router.get('/special-menu', async (req, res) => {
  try {
    const { referenceDate } = req.query;
    const refDate = referenceDate ? dateUtils.parseISTDate(referenceDate) : dateUtils.getCurrentIST();
    
    if (!refDate.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference date format'
      });
    }

    const specialMenus = await SpecialMenu.findSpecialMenuForDate(refDate);

    if (!specialMenus || specialMenus.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No special menu available for the current date',
        timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
      });
    }

    const specialMenu = specialMenus[0];

    res.json({
      success: true,
      data: {
        name: specialMenu.name,
        state: specialMenu.state,
        description: specialMenu.description,
        items: specialMenu.items,
        startDate: specialMenu.formattedStartDate,
        endDate: specialMenu.formattedEndDate
      },
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });

  } catch (error) {
    console.error('Error fetching special menu data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special menu data',
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });
  }
});

/**
 * GET /api/display/quote
 * Get a random motivational quote
 */
router.get('/quote', async (req, res) => {
  try {
    const { category } = req.query;
    
    // Validate category if provided
    if (category && !['motivational', 'food', 'health', 'general'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    const quote = await Quote.getRandomQuote(category);

    if (!quote) {
      return res.json({
        success: true,
        data: null,
        message: 'No quotes available',
        timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
      });
    }

    res.json({
      success: true,
      data: {
        text: quote.text,
        author: quote.author,
        category: quote.category
      },
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });

  } catch (error) {
    console.error('Error fetching quote data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quote data',
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });
  }
});

/**
 * GET /api/display/health
 * Health check endpoint for display interface
 */
router.get('/health', async (req, res) => {
  try {
    // Test database connectivity by running simple queries
    const [menuCount, wasteCount, specialMenuCount, quoteCount] = await Promise.allSettled([
      MenuItem.countDocuments(),
      WasteData.countDocuments(),
      SpecialMenu.countDocuments(),
      Quote.countDocuments()
    ]);

    const dbStatus = {
      menuItems: menuCount.status === 'fulfilled' ? 'connected' : 'error',
      wasteData: wasteCount.status === 'fulfilled' ? 'connected' : 'error',
      specialMenus: specialMenuCount.status === 'fulfilled' ? 'connected' : 'error',
      quotes: quoteCount.status === 'fulfilled' ? 'connected' : 'error'
    };

    const allConnected = Object.values(dbStatus).every(status => status === 'connected');

    res.json({
      success: true,
      status: allConnected ? 'healthy' : 'degraded',
      database: dbStatus,
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO(),
      uptime: process.uptime()
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: DateTime.now().setZone('Asia/Kolkata').toISO()
    });
  }
});

module.exports = router;