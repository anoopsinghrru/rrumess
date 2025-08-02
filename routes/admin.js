const express = require('express');
const router = express.Router();
const dateUtils = require('../utils/dateUtils');
const { 
  requireAuth, 
  redirectIfAuthenticated, 
  requireAdmin, 
  requireMenuPermission,
  requireWastePermission,
  requireNutritionPermission,
  requireSpecialMenuPermission,
  requireUserManagementPermission,
  addUserToRequest,
  loginUser,
  logoutUser 
} = require('../middleware/auth');

// Apply user middleware to all admin routes
router.use(addUserToRequest);

/**
 * GET /admin/login
 * Display login form
 */
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('admin/login', {
    title: 'Admin Login',
    error: null,
    success: null,
    formData: {}
  });
});

/**
 * POST /admin/login
 * Process login form
 */
router.post('/login', redirectIfAuthenticated, async (req, res) => {
  const { identifier, password, rememberMe } = req.body;
  
  // Basic validation
  if (!identifier || !password) {
    return res.status(400).render('admin/login', {
      title: 'Admin Login',
      error: 'Username/email and password are required',
      success: null,
      formData: { identifier }
    });
  }

  try {
    // Attempt login
    const result = await loginUser(identifier, password, req.session);
    
    if (!result.success) {
      return res.status(401).render('admin/login', {
        title: 'Admin Login',
        error: result.error,
        success: null,
        formData: { identifier }
      });
    }

    // Set extended session if remember me is checked
    if (rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    // Redirect to intended page or dashboard
    const redirectTo = req.session.returnTo || '/admin/dashboard';
    delete req.session.returnTo;
    
    res.redirect(redirectTo);
    
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).render('admin/login', {
      title: 'Admin Login',
      error: 'An error occurred during login. Please try again.',
      success: null,
      formData: { identifier }
    });
  }
});

/**
 * GET /admin/logout
 * Process logout
 */
router.get('/logout', requireAuth, async (req, res) => {
  try {
    await logoutUser(req.session);
    res.redirect('/admin/login?message=logged_out');
  } catch (error) {
    console.error('Logout error:', error);
    // Even if logout fails, redirect to login
    res.redirect('/admin/login');
  }
});

/**
 * POST /admin/logout
 * Process logout (for AJAX requests)
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await logoutUser(req.session);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'An error occurred during logout' 
    });
  }
});

/**
 * GET /admin/dashboard
 * Admin dashboard with statistics
 */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    // Import models
    const MenuItem = require('../models/MenuItem');
    const WasteData = require('../models/WasteData');
    const SpecialMenu = require('../models/SpecialMenu');
    const Quote = require('../models/Quote');

    // Get current date in IST
    const today = dateUtils.getCurrentIST();
    const yesterday = dateUtils.subtractDays(today, 1);

    // Get statistics
    const [
      totalMenuItems,
      todayMenuItems,
      totalQuotes,
      activeSpecialMenus,
      yesterdayWaste,
      recentWasteStats
    ] = await Promise.all([
      MenuItem.countDocuments({ isActive: true }),
      MenuItem.countDocuments({ 
        date: dateUtils.toMongoDateRange(today),
        isActive: true 
      }),
      Quote.countDocuments({ isActive: true }),
      SpecialMenu.countDocuments({ isActive: true }),
      WasteData.getPreviousDayWaste(today),
      WasteData.getWasteStats(7)
    ]);

    // Calculate waste statistics
    let wasteStats = {
      yesterdayTotal: 0,
      weeklyAverage: 0,
      trend: 'stable'
    };

    if (yesterdayWaste) {
      wasteStats.yesterdayTotal = yesterdayWaste.totalWaste;
    }

    if (recentWasteStats && recentWasteStats.length > 0) {
      wasteStats.weeklyAverage = Math.round(recentWasteStats[0].avgTotalWaste * 100) / 100;
    }

    // Get recent activity (last 5 menu items added)
    const recentMenuItems = await MenuItem.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name category date createdAt');

    const stats = {
      menuItems: {
        total: totalMenuItems,
        today: todayMenuItems
      },
      quotes: {
        total: totalQuotes
      },
      specialMenus: {
        active: activeSpecialMenus
      },
      waste: wasteStats,
      recentActivity: recentMenuItems
    };

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.user,
      stats: stats,
      currentPage: 'dashboard'
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.user,
      stats: {
        menuItems: { total: 0, today: 0 },
        quotes: { total: 0 },
        specialMenus: { active: 0 },
        waste: { yesterdayTotal: 0, weeklyAverage: 0, trend: 'stable' },
        recentActivity: []
      },
      currentPage: 'dashboard'
    });
  }
});

/**
 * GET /admin
 * Redirect to dashboard
 */
router.get('/', requireAuth, (req, res) => {
  res.redirect('/admin/dashboard');
});

/**
 * GET /admin/profile
 * User profile page
 */
router.get('/profile', requireAuth, (req, res) => {
  res.render('admin/profile', {
    title: 'Profile',
    user: req.user,
    currentPage: 'profile'
  });
});

/**
 * Middleware to handle admin-only routes
 * Apply this to routes that require admin privileges
 */
router.use('/admin-only/*', requireAdmin);

/**
 * GET /admin/menu
 * Menu management table overview
 */
router.get('/menu', requireMenuPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get date range (default: from 7 days ago, 60 days forward) in IST
    const today = dateUtils.getCurrentIST();
    const startDate = dateUtils.subtractDays(today, 7); // Start from 7 days ago to include past menu items
    const endDate = dateUtils.addDays(today, 60); // 60 days forward
    
    // Custom date range from query params
    const customStartDate = req.query.startDate ? dateUtils.parseISTDate(req.query.startDate) : startDate;
    const customEndDate = req.query.endDate ? dateUtils.parseISTDate(req.query.endDate) : endDate;
    
    // Generate date range array in IST
    const dateRange = dateUtils.getISTDateRange(customStartDate, customEndDate);
    
    // Get menu overview data using aggregation
    const menuOverview = await MenuItem.aggregate([
      {
        $match: {
          date: {
            $gte: customStartDate.toJSDate(),
            $lte: customEndDate.toJSDate()
          },
          isActive: true
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$date",
                timezone: "+05:30"
              }
            },
            category: "$category"
          },
          count: { $sum: 1 },
          nutritionCompleted: { $sum: { $cond: [{ $eq: ["$nutritionStatus", "completed"] }, 1, 0] } }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          categories: {
            $push: {
              category: "$_id.category",
              count: "$count",
              nutritionCompleted: "$nutritionCompleted"
            }
          },
          totalItems: { $sum: "$count" },
          totalNutritionCompleted: { $sum: "$nutritionCompleted" }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);
    
    // Create a map for easy lookup
    const menuMap = {};
    menuOverview.forEach(item => {
      const categoryMap = {};
      const nutritionMap = {};
      item.categories.forEach(cat => {
        categoryMap[cat.category] = cat.count;
        nutritionMap[cat.category] = cat.nutritionCompleted;
      });
      menuMap[item._id] = {
        breakfast: categoryMap.breakfast || 0,
        lunch: categoryMap.lunch || 0,
        snacks: categoryMap.snacks || 0,
        dinner: categoryMap.dinner || 0,
        total: item.totalItems,
        nutritionCompleted: item.totalNutritionCompleted,
        nutritionBreakfast: nutritionMap.breakfast || 0,
        nutritionLunch: nutritionMap.lunch || 0,
        nutritionSnacks: nutritionMap.snacks || 0,
        nutritionDinner: nutritionMap.dinner || 0
      };
    });
    
    // Filter dates to only include those with menu items
    const datesWithMenu = dateRange.filter(date => {
      const istDate = dateUtils.toIST(date);
      const dateStr = istDate.toFormat('yyyy-MM-dd');
      const menuData = menuMap[dateStr];
      return menuData && menuData.total > 0;
    });
    
    // Prepare table data with pagination (only for dates with menu)
    const paginatedDates = datesWithMenu.slice(skip, skip + limit);
    const tableData = paginatedDates.map(date => {
      // Convert JS Date to IST DateTime and then format as YYYY-MM-DD
      const istDate = dateUtils.toIST(date);
      const dateStr = istDate.toFormat('yyyy-MM-dd'); // Use same format as menuMap keys
      const menuData = menuMap[dateStr];
      
      return {
        date: date,
        dateStr: dateStr,
        formattedDate: dateUtils.formatISTDate(date),
        dayName: dateUtils.getDayName(date),
        isToday: dateUtils.isToday(date),
        isPast: dateUtils.isPastDate(date),
        ...menuData,
        status: 'complete', // All filtered dates have menu items
        nutritionStatus: menuData.nutritionCompleted === menuData.total ? 'complete' : 'pending'
      };
    });
    
    // Calculate pagination info based on dates with menu
    const totalPages = Math.ceil(datesWithMenu.length / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.render('admin/menu-table', {
      title: 'Menu Management',
      user: req.user,
      currentPage: 'menu',
      tableData: tableData,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        limit: limit
      },
      dateRange: {
        startDate: dateUtils.formatDateForInput(customStartDate),
        endDate: dateUtils.formatDateForInput(customEndDate)
      },
      todayDate: dateUtils.formatDateForInput(today)
    });

  } catch (error) {
    console.error('Menu table error:', error);
    res.status(500).render('error', {
      message: 'Error loading menu management page',
      error: process.env.NODE_ENV === 'development' ? error : {},
      status: 500
    });
  }
});

/**
 * GET /admin/menu/date/:date
 * Individual date menu view
 */
router.get('/menu/date/:date', requireMenuPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    // Parse date in IST
    const selectedDate = dateUtils.parseISTDate(req.params.date);
    
    const today = dateUtils.getCurrentIST();
    
    // Check if date is in the past
    const isPastDate = dateUtils.isPastDate(selectedDate);
    const isReadOnly = req.query.readonly === 'true' || isPastDate;
    

    
    // Get menu items for the selected date
    const menuItems = await MenuItem.getDailyMenu(selectedDate);
    
    // Group by category
    const groupedItems = {
      breakfast: menuItems.filter(item => item.category === 'breakfast'),
      lunch: menuItems.filter(item => item.category === 'lunch'),
      snacks: menuItems.filter(item => item.category === 'snacks'),
      dinner: menuItems.filter(item => item.category === 'dinner')
    };

    res.render('admin/menu-date', {
      title: (isPastDate ? 'View Menu for ' : 'Menu for ') + dateUtils.formatISTDate(selectedDate),
      user: req.user,
      currentPage: 'menu',
      selectedDate: selectedDate.toJSDate(), // Convert to JS Date for template
      menuItems: groupedItems,
      formattedDate: dateUtils.formatDateForInput(selectedDate),
      todayDate: dateUtils.formatDateForInput(today),
      isPastDate: isPastDate,
      isReadOnly: isReadOnly
    });

  } catch (error) {
    console.error('Menu date view error:', error);
    res.status(500).render('error', {
      message: 'Error loading menu for selected date',
      error: process.env.NODE_ENV === 'development' ? error : {},
      status: 500
    });
  }
});

/**
 * POST /admin/menu
 * Add new menu item (without nutrition data)
 */
router.post('/menu', requireMenuPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    const {
      name,
      category,
      description,
      date
    } = req.body;

    // Create new menu item (nutrition data will be added later by nutrition manager)
    const menuItem = new MenuItem({
      name: name.trim(),
      category,
      description: description ? description.trim() : '',
      date: dateUtils.parseISTDate(date).toJSDate(), // Convert to JS Date for MongoDB
      nutritionStatus: 'pending' // Nutrition data pending
    });

    await menuItem.save();

    res.redirect(`/admin/menu/date/${date}?success=added`);

  } catch (error) {
    console.error('Add menu item error:', error);
    
    const selectedDate = req.body.date || dateUtils.formatDateForInput(dateUtils.getCurrentIST());
    res.redirect(`/admin/menu/date/${selectedDate}?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * PUT /admin/menu/:id
 * Update menu item
 */
router.put('/menu/:id', requireMenuPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    const {
      name,
      category,
      description,
      date,
      calories,
      protein,
      carbohydrates,
      fat,
      fiber
    } = req.body;

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    // Update menu item
    menuItem.name = name.trim();
    menuItem.category = category;
    menuItem.description = description ? description.trim() : '';
    menuItem.date = dateUtils.parseISTDate(date).toJSDate(); // Convert to JS Date for MongoDB
    menuItem.nutritionalInfo = {
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbohydrates: parseFloat(carbohydrates) || 0,
      fat: parseFloat(fat) || 0,
      fiber: parseFloat(fiber) || 0
    };

    await menuItem.save();

    res.json({ success: true, message: 'Menu item updated successfully' });

  } catch (error) {
    console.error('Update menu item error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /admin/menu/:id
 * Delete menu item
 */
router.delete('/menu/:id', requireMenuPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    await MenuItem.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Menu item deleted successfully' });

  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /admin/waste
 * Waste data management table overview
 */
router.get('/waste', requireWastePermission, async (req, res) => {
  try {
    const WasteData = require('../models/WasteData');
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get date range (default: 30 days back from today) in IST
    const today = dateUtils.getCurrentIST();
    const defaultStartDate = dateUtils.subtractDays(today, 30);
    const defaultEndDate = dateUtils.getISTStartOfDay(today);
    
    // Custom date range from query params
    const customStartDate = req.query.startDate ? dateUtils.parseISTDate(req.query.startDate) : defaultStartDate;
    const customEndDate = req.query.endDate ? dateUtils.parseISTDate(req.query.endDate) : defaultEndDate;
    
    // Get waste data for the date range
    let wasteDataList = await WasteData.find({
      date: {
        $gte: customStartDate,
        $lte: customEndDate
      }
    }).sort({ date: -1 });

    // Migration: Add snacks field to existing records that don't have it
    for (const wasteData of wasteDataList) {
      if (!wasteData.snacks) {
        wasteData.snacks = {
          wasteAmount: 0,
          totalPrepared: 0.1
        };
        await wasteData.save();
      }
    }
    
    // Create table data only for dates that have waste data
    const tableData = wasteDataList.map(item => {
      const date = item.date;
      const dateStr = dateUtils.formatDateForInput(date);
      
      return {
        date: date,
        dateStr: dateStr,
        formattedDate: dateUtils.formatISTDate(date),
        dayName: dateUtils.getDayName(date),
        isToday: dateUtils.isToday(date),
        isPast: dateUtils.isPastDate(date),
        wasteData: item,
        hasData: true,
        totalWaste: item.totalWaste,
        overallPercentage: item.overallWastePercentage,
        breakfastWaste: item.breakfast.wasteAmount,
        lunchWaste: item.lunch.wasteAmount,
        dinnerWaste: item.dinner.wasteAmount,
        snacksWaste: item.snacks.wasteAmount,
        breakfastPercentage: item.breakfast.wastePercentage,
        lunchPercentage: item.lunch.wastePercentage,
        dinnerPercentage: item.dinner.wastePercentage,
        snacksPercentage: item.snacks.wastePercentage,
        status: 'recorded'
      };
    });
    
    // Apply pagination to the filtered data
    const totalItems = tableData.length;
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    // Get paginated data
    const paginatedData = tableData.slice(skip, skip + limit);
    
    // Calculate statistics
    const recordedDays = totalItems;
    const missingDays = 0; // No missing days since we only show dates with data
    const totalWasteSum = tableData.reduce((sum, d) => sum + d.totalWaste, 0);
    const avgWastePerDay = recordedDays > 0 ? Math.round((totalWasteSum / recordedDays) * 100) / 100 : 0;

    res.render('admin/waste-table', {
      title: 'Waste Data Management',
      user: req.user,
      currentPage: 'waste',
      tableData: paginatedData,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        limit: limit
      },
      dateRange: {
        startDate: dateUtils.formatDateForInput(customStartDate),
        endDate: dateUtils.formatDateForInput(customEndDate)
      },
      todayDate: dateUtils.formatDateForInput(today),
      getPreviousDayDate: () => dateUtils.formatDateForInput(dateUtils.subtractDays(today, 1)),
      stats: {
        recordedDays,
        missingDays,
        totalWasteSum: Math.round(totalWasteSum * 100) / 100,
        avgWastePerDay
      }
    });

  } catch (error) {
    console.error('Waste table error:', error);
    res.status(500).render('error', {
      message: 'Error loading waste management page',
      error: process.env.NODE_ENV === 'development' ? error : {},
      status: 500
    });
  }
});

/**
 * GET /admin/waste/date/:date
 * Individual date waste data view
 */
router.get('/waste/date/:date', requireWastePermission, async (req, res) => {
  try {
    const WasteData = require('../models/WasteData');
    
    // Parse date in IST
    const selectedDate = dateUtils.parseISTDate(req.params.date);
    
    const today = dateUtils.getCurrentIST();
    
    // Check if date is in the future
    const isFutureDate = selectedDate > today;
    const isReadOnly = req.query.readonly === 'true' || isFutureDate;
    
    // Get waste data for the selected date
    let wasteData = await WasteData.findOne({
      date: dateUtils.toMongoDateRange(selectedDate)
    });

    // Migration: Add snacks field if it doesn't exist
    if (wasteData && !wasteData.snacks) {
      wasteData.snacks = {
        wasteAmount: 0,
        totalPrepared: 0.1
      };
      await wasteData.save();
    }

    // Get recent waste data for trend (last 7 days)
    const recentWasteData = await WasteData.find({
      date: { $lt: selectedDate.toJSDate() }
    })
      .sort({ date: -1 })
      .limit(7);

    res.render('admin/waste-date', {
      title: (isFutureDate ? 'Cannot Record Future Waste Data for ' : 'Waste Data for ') + dateUtils.formatISTDate(selectedDate),
      user: req.user,
      currentPage: 'waste',
      selectedDate: selectedDate.toJSDate(), // Convert to JS Date for template
      wasteData: wasteData,
      recentWasteData: recentWasteData,
      formattedDate: dateUtils.formatDateForInput(selectedDate),
      todayDate: dateUtils.formatDateForInput(today),
      getPreviousDayDate: () => dateUtils.formatDateForInput(dateUtils.subtractDays(today, 1)),
      isFutureDate: isFutureDate,
      isReadOnly: isReadOnly
    });

  } catch (error) {
    console.error('Waste date view error:', error);
    res.status(500).render('error', {
      message: 'Error loading waste data for selected date',
      error: process.env.NODE_ENV === 'development' ? error : {},
      status: 500
    });
  }
});

/**
 * POST /admin/waste
 * Add or update waste data
 */
router.post('/waste', requireWastePermission, async (req, res) => {
  try {
    const WasteData = require('../models/WasteData');
    
    const {
      date,
      breakfastWaste,
      breakfastTotal,
      lunchWaste,
      lunchTotal,
      dinnerWaste,
      dinnerTotal,
      snacksWaste,
      snacksTotal,
      notes
    } = req.body;

    const wasteDate = dateUtils.parseISTDate(date);

    // Check if waste data already exists for this date
    let wasteData = await WasteData.findOne({
      date: dateUtils.toMongoDateRange(wasteDate)
    });

    const wasteDataObj = {
      date: wasteDate.toJSDate(), // Convert to JS Date for MongoDB
      breakfast: {
        wasteAmount: parseFloat(breakfastWaste) || 0,
        totalPrepared: parseFloat(breakfastTotal) || 0.1
      },
      lunch: {
        wasteAmount: parseFloat(lunchWaste) || 0,
        totalPrepared: parseFloat(lunchTotal) || 0.1
      },
      dinner: {
        wasteAmount: parseFloat(dinnerWaste) || 0,
        totalPrepared: parseFloat(dinnerTotal) || 0.1
      },
      snacks: {
        wasteAmount: parseFloat(snacksWaste) || 0,
        totalPrepared: parseFloat(snacksTotal) || 0.1
      },
      notes: notes ? notes.trim() : ''
    };

    if (wasteData) {
      // Update existing data
      Object.assign(wasteData, wasteDataObj);
      await wasteData.save();
    } else {
      // Create new data
      wasteData = new WasteData(wasteDataObj);
      await wasteData.save();
    }

    res.redirect(`/admin/waste?date=${date}&success=saved`);

  } catch (error) {
    console.error('Save waste data error:', error);
    
    const selectedDate = req.body.date || dateUtils.formatDateForInput(dateUtils.getCurrentIST());
    res.redirect(`/admin/waste?date=${selectedDate}&error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /admin/special-menu
 * Special menu management interface
 */
router.get('/special-menu', requireSpecialMenuPermission, async (req, res) => {
  try {
    const SpecialMenu = require('../models/SpecialMenu');
    
    // Get all special menus, sorted by start date
    const specialMenus = await SpecialMenu.find()
      .sort({ startDate: -1 });

    res.render('admin/special-menu', {
      title: 'Special Menu Management',
      user: req.user,
      currentPage: 'special-menu',
      specialMenus: specialMenus
    });

  } catch (error) {
    console.error('Special menu management error:', error);
    res.status(500).render('error', {
      message: 'Error loading special menu management page',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

/**
 * POST /admin/special-menu
 * Add new special menu
 */
router.post('/special-menu', requireSpecialMenuPermission, async (req, res) => {
  try {
    const SpecialMenu = require('../models/SpecialMenu');
    
    const {
      name,
      state,
      description,
      startDate,
      endDate,
      items
    } = req.body;

    // Parse items (assuming they come as JSON string or array)
    let menuItems = [];
    if (typeof items === 'string') {
      try {
        menuItems = JSON.parse(items);
      } catch (e) {
        throw new Error('Invalid items format');
      }
    } else if (Array.isArray(items)) {
      menuItems = items;
    }

    // Create new special menu
    const specialMenu = new SpecialMenu({
      name: name.trim(),
      state: state.trim(),
      description: description ? description.trim() : '',
      startDate: dateUtils.parseISTDate(startDate).toJSDate(), // Convert to JS Date for MongoDB
      endDate: dateUtils.parseISTDate(endDate).toJSDate(), // Convert to JS Date for MongoDB
      items: menuItems
    });

    await specialMenu.save();

    res.redirect('/admin/special-menu?success=added');

  } catch (error) {
    console.error('Add special menu error:', error);
    res.redirect(`/admin/special-menu?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * PUT /admin/special-menu/:id
 * Update special menu
 */
router.put('/special-menu/:id', requireSpecialMenuPermission, async (req, res) => {
  try {
    const SpecialMenu = require('../models/SpecialMenu');
    
    const {
      name,
      state,
      description,
      startDate,
      endDate,
      items,
      isActive
    } = req.body;

    const specialMenu = await SpecialMenu.findById(req.params.id);
    if (!specialMenu) {
      return res.status(404).json({ success: false, error: 'Special menu not found' });
    }

    // Parse items
    let menuItems = [];
    if (typeof items === 'string') {
      try {
        menuItems = JSON.parse(items);
      } catch (e) {
        throw new Error('Invalid items format');
      }
    } else if (Array.isArray(items)) {
      menuItems = items;
    }

    // Update special menu
    specialMenu.name = name.trim();
    specialMenu.state = state.trim();
    specialMenu.description = description ? description.trim() : '';
    specialMenu.startDate = dateUtils.parseISTDate(startDate).toJSDate(); // Convert to JS Date for MongoDB
    specialMenu.endDate = dateUtils.parseISTDate(endDate).toJSDate(); // Convert to JS Date for MongoDB
    specialMenu.items = menuItems;
    specialMenu.isActive = isActive !== undefined ? Boolean(isActive) : true;

    await specialMenu.save();

    res.json({ success: true, message: 'Special menu updated successfully' });

  } catch (error) {
    console.error('Update special menu error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /admin/special-menu/:id
 * Delete special menu
 */
router.delete('/special-menu/:id', requireSpecialMenuPermission, async (req, res) => {
  try {
    const SpecialMenu = require('../models/SpecialMenu');
    
    const specialMenu = await SpecialMenu.findById(req.params.id);
    if (!specialMenu) {
      return res.status(404).json({ success: false, error: 'Special menu not found' });
    }

    await SpecialMenu.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Special menu deleted successfully' });

  } catch (error) {
    console.error('Delete special menu error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /admin/menu/api/overview
 * API endpoint for menu overview data
 */
router.get('/menu/api/overview', requireMenuPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    // Get date range parameters (default: from today, 60 days forward)
    const today = dateUtils.getCurrentIST().startOf('day').toJSDate();
    const defaultEndDate = dateUtils.addDays(today, 60).toJSDate();
    
    const startDate = req.query.startDate ? dateUtils.parseISTDate(req.query.startDate).toJSDate() : today;
    const endDate = req.query.endDate ? dateUtils.parseISTDate(req.query.endDate).toJSDate() : defaultEndDate;
    
    // Get menu overview data using aggregation
    const menuOverview = await MenuItem.aggregate([
      {
        $match: {
          date: {
            $gte: startDate,
            $lte: endDate
          },
          isActive: true
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$date",
                timezone: "+05:30"
              }
            },
            category: "$category"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          categories: {
            $push: {
              category: "$_id.category",
              count: "$count"
            }
          },
          totalItems: { $sum: "$count" }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    res.json({
      success: true,
      data: menuOverview,
      dateRange: {
        startDate: dateUtils.formatDateForInput(startDate),
        endDate: dateUtils.formatDateForInput(endDate)
      }
    });

  } catch (error) {
    console.error('Menu overview API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu overview data'
    });
  }
});

/**
 * GET /admin/quotes
 * Quote management interface
 */
router.get('/quotes', requireAuth, async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    
    // Get all quotes, sorted by creation date
    const quotes = await Quote.find()
      .sort({ createdAt: -1 });

    res.render('admin/quotes', {
      title: 'Quote Management',
      user: req.user,
      currentPage: 'quotes',
      quotes: quotes
    });

  } catch (error) {
    console.error('Quote management error:', error);
    res.status(500).render('error', {
      message: 'Error loading quote management page',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

/**
 * POST /admin/quotes
 * Add new quote
 */
router.post('/quotes', requireAuth, async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    
    const { text, author, category } = req.body;

    // Create new quote
    const quote = new Quote({
      text: text.trim(),
      author: author.trim(),
      category: category || 'motivational'
    });

    await quote.save();

    res.redirect('/admin/quotes?success=added');

  } catch (error) {
    console.error('Add quote error:', error);
    res.redirect(`/admin/quotes?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * PUT /admin/quotes/:id
 * Update quote
 */
router.put('/quotes/:id', requireAuth, async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    
    const { text, author, category, isActive } = req.body;

    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    // Update quote
    quote.text = text.trim();
    quote.author = author.trim();
    quote.category = category || 'motivational';
    quote.isActive = isActive !== undefined ? Boolean(isActive) : true;

    await quote.save();

    res.json({ success: true, message: 'Quote updated successfully' });

  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /admin/menu/copy
 * Copy menu from one date to another
 */
router.post('/menu/copy', requireMenuPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    const { fromDate, toDate } = req.body;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        error: 'Both source and target dates are required'
      });
    }

    const sourceDate = dateUtils.parseISTDate(fromDate).toJSDate();
    const targetDate = dateUtils.parseISTDate(toDate).toJSDate();
    
    // Get menu items from source date (allow copying from past dates)
    const sourceItems = await MenuItem.getDailyMenu(sourceDate);
    
    if (sourceItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No menu items found for the source date'
      });
    }

    // Check if target date is in the past (prevent copying to past dates)
    const today = dateUtils.getCurrentIST().startOf('day');
    const targetDateIST = dateUtils.toIST(targetDate).startOf('day');
    
    if (targetDateIST < today) {
      return res.status(400).json({
        success: false,
        error: 'Cannot copy menu items to past dates'
      });
    }

    // Check if target date already has menu items
    const existingItems = await MenuItem.getDailyMenu(targetDate);
    if (existingItems.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Target date already has menu items. Please clear them first.'
      });
    }

    // Copy items to target date
    const itemsToInsert = sourceItems.map(item => ({
      name: item.name,
      category: item.category,
      description: item.description,
      date: targetDate,
      nutritionalInfo: item.nutritionalInfo,
      nutritionStatus: item.nutritionStatus || 'pending',
      nutritionAddedBy: item.nutritionAddedBy,
      nutritionAddedAt: item.nutritionAddedAt,
      isActive: true
    }));

    const copiedItems = await MenuItem.insertMany(itemsToInsert);

    res.json({
      success: true,
      message: `Successfully copied ${copiedItems.length} menu items`,
      data: {
        fromDate: dateUtils.formatDateForInput(sourceDate),
        toDate: dateUtils.formatDateForInput(targetDate),
        itemCount: copiedItems.length
      }
    });

  } catch (error) {
    console.error('Menu copy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to copy menu items'
    });
  }
});

/**
 * DELETE /admin/quotes/:id
 * Delete quote
 */
router.delete('/quotes/:id', requireAuth, async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    await Quote.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Quote deleted successfully' });

  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /admin/nutrition
 * Nutrition management page - shows items pending nutrition data
 */
router.get('/nutrition', requireNutritionPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get date range (default: from 7 days ago, 60 days forward) in IST
    const today = dateUtils.getCurrentIST();
    const startDate = dateUtils.subtractDays(today, 7);
    const endDate = dateUtils.addDays(today, 60);
    
    // Custom date range from query params
    const customStartDate = req.query.startDate ? dateUtils.parseISTDate(req.query.startDate) : startDate;
    const customEndDate = req.query.endDate ? dateUtils.parseISTDate(req.query.endDate) : endDate;
    
    // Get items pending nutrition data
    const pendingItems = await MenuItem.find({
      date: {
        $gte: customStartDate.toJSDate(),
        $lte: customEndDate.toJSDate()
      },
      isActive: true,
      nutritionStatus: 'pending'
    })
    .sort({ date: -1, category: 1, name: 1 })
    .skip(skip)
    .limit(limit);
    
    // Get total count for pagination
    const totalPending = await MenuItem.countDocuments({
      date: {
        $gte: customStartDate.toJSDate(),
        $lte: customEndDate.toJSDate()
      },
      isActive: true,
      nutritionStatus: 'pending'
    });
    
    // Get completed items count for statistics
    const totalCompleted = await MenuItem.countDocuments({
      date: {
        $gte: customStartDate.toJSDate(),
        $lte: customEndDate.toJSDate()
      },
      isActive: true,
      nutritionStatus: 'completed'
    });
    
    const totalPages = Math.ceil(totalPending / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.render('admin/nutrition', {
      title: 'Nutrition Management',
      user: req.user,
      currentPage: 'nutrition',
      pendingItems: pendingItems,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        limit: limit
      },
      dateRange: {
        startDate: dateUtils.formatDateForInput(customStartDate),
        endDate: dateUtils.formatDateForInput(customEndDate)
      },
      stats: {
        pending: totalPending,
        completed: totalCompleted,
        total: totalPending + totalCompleted
      }
    });

  } catch (error) {
    console.error('Nutrition management error:', error);
    res.status(500).render('error', {
      message: 'Error loading nutrition management page',
      error: process.env.NODE_ENV === 'development' ? error : {},
      status: 500
    });
  }
});

/**
 * GET /admin/nutrition/date/:date
 * Nutrition management for a specific date
 */
router.get('/nutrition/date/:date', requireNutritionPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    // Parse date in IST
    const selectedDate = dateUtils.parseISTDate(req.params.date);
    
    if (!selectedDate.isValid) {
      return res.status(400).render('error', {
        message: 'Invalid date format',
        error: {},
        status: 400
      });
    }
    
    // Get all menu items for the selected date
    const allMenuItems = await MenuItem.getDailyMenu(selectedDate);
    
    // Separate pending and completed items
    const pendingItems = allMenuItems.filter(item => item.nutritionStatus === 'pending');
    const completedItems = allMenuItems.filter(item => item.nutritionStatus === 'completed');
    
    // Group by category
    const groupedPending = {
      breakfast: pendingItems.filter(item => item.category === 'breakfast'),
      lunch: pendingItems.filter(item => item.category === 'lunch'),
      snacks: pendingItems.filter(item => item.category === 'snacks'),
      dinner: pendingItems.filter(item => item.category === 'dinner')
    };
    
    const groupedCompleted = {
      breakfast: completedItems.filter(item => item.category === 'breakfast'),
      lunch: completedItems.filter(item => item.category === 'lunch'),
      snacks: completedItems.filter(item => item.category === 'snacks'),
      dinner: completedItems.filter(item => item.category === 'dinner')
    };

    res.render('admin/nutrition-date', {
      title: 'Nutrition Management - ' + dateUtils.formatISTDate(selectedDate),
      user: req.user,
      currentPage: 'nutrition',
      selectedDate: selectedDate.toJSDate(),
      pendingItems: groupedPending,
      completedItems: groupedCompleted,
      formattedDate: dateUtils.formatDateForInput(selectedDate),
      stats: {
        pending: pendingItems.length,
        completed: completedItems.length,
        total: allMenuItems.length
      }
    });

  } catch (error) {
    console.error('Nutrition date view error:', error);
    res.status(500).render('error', {
      message: 'Error loading nutrition for selected date',
      error: process.env.NODE_ENV === 'development' ? error : {},
      status: 500
    });
  }
});

/**
 * POST /admin/nutrition/:id
 * Add nutrition data to a menu item
 */
router.post('/nutrition/:id', requireNutritionPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    const {
      calories,
      protein,
      carbohydrates,
      fat,
      fiber
    } = req.body;

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        error: 'Menu item not found' 
      });
    }

    // Validate nutrition data
    const nutritionData = {
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbohydrates: parseFloat(carbohydrates) || 0,
      fat: parseFloat(fat) || 0,
      fiber: parseFloat(fiber) || 0
    };

    // Validate ranges
    if (nutritionData.calories < 0 || nutritionData.calories > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Calories must be between 0 and 2000'
      });
    }

    if (nutritionData.protein < 0 || nutritionData.protein > 200) {
      return res.status(400).json({
        success: false,
        error: 'Protein must be between 0 and 200g'
      });
    }

    if (nutritionData.carbohydrates < 0 || nutritionData.carbohydrates > 500) {
      return res.status(400).json({
        success: false,
        error: 'Carbohydrates must be between 0 and 500g'
      });
    }

    if (nutritionData.fat < 0 || nutritionData.fat > 200) {
      return res.status(400).json({
        success: false,
        error: 'Fat must be between 0 and 200g'
      });
    }

    if (nutritionData.fiber < 0 || nutritionData.fiber > 100) {
      return res.status(400).json({
        success: false,
        error: 'Fiber must be between 0 and 100g'
      });
    }

    // Add nutrition data
    await menuItem.addNutrition(nutritionData, req.user._id);

    res.json({
      success: true,
      message: 'Nutrition data added successfully',
      data: menuItem
    });

  } catch (error) {
    console.error('Add nutrition error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add nutrition data'
    });
  }
});

/**
 * PUT /admin/nutrition/:id
 * Update nutrition data for a menu item
 */
router.put('/nutrition/:id', requireNutritionPermission, async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    
    const {
      calories,
      protein,
      carbohydrates,
      fat,
      fiber
    } = req.body;

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        error: 'Menu item not found' 
      });
    }

    // Validate nutrition data
    const nutritionData = {
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbohydrates: parseFloat(carbohydrates) || 0,
      fat: parseFloat(fat) || 0,
      fiber: parseFloat(fiber) || 0
    };

    // Validate ranges
    if (nutritionData.calories < 0 || nutritionData.calories > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Calories must be between 0 and 2000'
      });
    }

    if (nutritionData.protein < 0 || nutritionData.protein > 200) {
      return res.status(400).json({
        success: false,
        error: 'Protein must be between 0 and 200g'
      });
    }

    if (nutritionData.carbohydrates < 0 || nutritionData.carbohydrates > 500) {
      return res.status(400).json({
        success: false,
        error: 'Carbohydrates must be between 0 and 500g'
      });
    }

    if (nutritionData.fat < 0 || nutritionData.fat > 200) {
      return res.status(400).json({
        success: false,
        error: 'Fat must be between 0 and 200g'
      });
    }

    if (nutritionData.fiber < 0 || nutritionData.fiber > 100) {
      return res.status(400).json({
        success: false,
        error: 'Fiber must be between 0 and 100g'
      });
    }

    // Update nutrition data
    menuItem.nutritionalInfo = nutritionData;
    menuItem.nutritionStatus = 'completed';
    menuItem.nutritionAddedBy = req.user._id;
    menuItem.nutritionAddedAt = new Date();
    
    await menuItem.save();

    res.json({
      success: true,
      message: 'Nutrition data updated successfully',
      data: menuItem
    });

  } catch (error) {
    console.error('Update nutrition error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update nutrition data'
    });
  }
});

/**
 * USER MANAGEMENT ROUTES
 * Only accessible by Super Admin
 */

/**
 * GET /admin/users
 * User management page
 */
router.get('/users', requireUserManagementPermission, async (req, res) => {
  try {
    const AdminUser = require('../models/AdminUser');
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get search parameters
    const search = req.query.search || '';
    const roleFilter = req.query.role || '';
    const statusFilter = req.query.status || '';
    
    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (roleFilter) {
      query.role = roleFilter;
    }
    
    if (statusFilter === 'active') {
      query.isActive = true;
    } else if (statusFilter === 'inactive') {
      query.isActive = false;
    }
    
    // Get total count
    const totalUsers = await AdminUser.countDocuments(query);
    
    // Get users with pagination
    const users = await AdminUser.find(query)
      .select('-password')
      .populate('createdBy', 'username fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get roles for filter
    const roles = AdminUser.getRoles();
    
    res.render('admin/users', {
      title: 'User Management',
      user: req.user,
      currentUser: req.user, // Add current user for comparison
      users,
      roles,
      currentPage: 'users',
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      },
      filters: {
        search,
        role: roleFilter,
        status: statusFilter
      }
    });
    
  } catch (error) {
    console.error('User management error:', error);
    res.status(500).render('error', {
      message: 'Failed to load user management page',
      error: error,
      status: 500
    });
  }
});

/**
 * GET /admin/users/new
 * Create new user form
 */
router.get('/users/new', requireUserManagementPermission, (req, res) => {
  const AdminUser = require('../models/AdminUser');
  const roles = AdminUser.getRoles();
  
  res.render('admin/user-form', {
    title: 'Create New User',
    user: req.user,
    currentUser: req.user,
    roles,
    formData: {},
    isEdit: false,
    currentPage: 'users'
  });
});

/**
 * POST /admin/users
 * Create new user
 */
router.post('/users', requireUserManagementPermission, async (req, res) => {
  try {
    const AdminUser = require('../models/AdminUser');
    const { username, email, password, confirmPassword, role, fullName } = req.body;
    
    // Validation
    if (!username || !email || !password || !role || !fullName) {
      return res.status(400).render('admin/user-form', {
        title: 'Create New User',
        user: req.user,
        roles: AdminUser.getRoles(),
        formData: req.body,
        isEdit: false,
        error: 'All fields are required'
      });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).render('admin/user-form', {
        title: 'Create New User',
        user: req.user,
        roles: AdminUser.getRoles(),
        formData: req.body,
        isEdit: false,
        error: 'Passwords do not match'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).render('admin/user-form', {
        title: 'Create New User',
        user: req.user,
        roles: AdminUser.getRoles(),
        formData: req.body,
        isEdit: false,
        error: 'Password must be at least 6 characters long'
      });
    }
    
    // Create user
    const newUser = await AdminUser.createAdmin({
      username,
      email,
      password,
      role,
      fullName
    }, req.user._id);
    
    res.redirect('/admin/users?success=user_created');
    
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).render('admin/user-form', {
      title: 'Create New User',
      user: req.user,
      roles: AdminUser.getRoles(),
      formData: req.body,
      isEdit: false,
      error: error.message
    });
  }
});

/**
 * GET /admin/users/:id/edit
 * Edit user form
 */
router.get('/users/:id/edit', requireUserManagementPermission, async (req, res) => {
  try {
    const AdminUser = require('../models/AdminUser');
    
    const user = await AdminUser.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).render('error', {
        message: 'User not found',
        error: {},
        status: 404
      });
    }
    
    const roles = AdminUser.getRoles();
    
    res.render('admin/user-form', {
      title: 'Edit User',
      user: req.user,
      currentUser: req.user,
      roles,
      formData: user,
      isEdit: true,
      currentPage: 'users'
    });
    
  } catch (error) {
    console.error('Edit user error:', error);
    res.status(500).render('error', {
      message: 'Failed to load user edit page',
      error: error,
      status: 500
    });
  }
});

/**
 * PUT /admin/users/:id
 * Update user
 */
router.put('/users/:id', requireUserManagementPermission, async (req, res) => {
  try {
    const AdminUser = require('../models/AdminUser');
    const { username, email, password, confirmPassword, role, fullName, isActive } = req.body;
    
    const userToUpdate = await AdminUser.findById(req.params.id);
    if (!userToUpdate) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Validation
    if (!username || !email || !role || !fullName) {
      return res.status(400).json({ success: false, error: 'Username, email, role, and full name are required' });
    }
    
    // Check if password is being updated
    if (password) {
      if (password !== confirmPassword) {
        return res.status(400).json({ success: false, error: 'Passwords do not match' });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
      }
      userToUpdate.password = password;
    }
    
    // Update user
    userToUpdate.username = username;
    userToUpdate.email = email;
    userToUpdate.role = role;
    userToUpdate.fullName = fullName;
    userToUpdate.isActive = isActive === 'true';
    
    await userToUpdate.save();
    
    res.json({ success: true, message: 'User updated successfully' });
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /admin/users/:id
 * Delete user
 */
router.delete('/users/:id', requireUserManagementPermission, async (req, res) => {
  try {
    const AdminUser = require('../models/AdminUser');
    
    const user = await AdminUser.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Prevent deleting self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }
    
    await AdminUser.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /admin/users/:id/toggle-status
 * Toggle user active status
 */
router.post('/users/:id/toggle-status', requireUserManagementPermission, async (req, res) => {
  try {
    const AdminUser = require('../models/AdminUser');
    
    const user = await AdminUser.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Prevent deactivating self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
    }
    
    user.isActive = !user.isActive;
    await user.save();
    
    res.json({ 
      success: true, 
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: user.isActive
    });
    
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Example admin-only route
 * GET /admin/admin-only/users
 */
router.get('/admin-only/users', (req, res) => {
  res.render('admin/users', {
    title: 'User Management',
    user: req.user
  });
});

module.exports = router;