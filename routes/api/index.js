const express = require('express');
const router = express.Router();

// Import API route modules
const menuItemsRoutes = require('./menuItems');
const wasteDataRoutes = require('./wasteData');
const specialMenusRoutes = require('./specialMenus');
const quotesRoutes = require('./quotes');
const displayRoutes = require('./display');

// Mount API routes
router.use('/menu-items', menuItemsRoutes);
router.use('/waste-data', wasteDataRoutes);
router.use('/special-menus', specialMenusRoutes);
router.use('/quotes', quotesRoutes);
router.use('/display', displayRoutes);

// API health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      menuItems: '/api/menu-items',
      wasteData: '/api/waste-data',
      specialMenus: '/api/special-menus',
      quotes: '/api/quotes',
      display: '/api/display'
    }
  });
});

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Mess TV Menu Display API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
              menuItems: {
          list: 'GET /api/menu-items',
          daily: 'GET /api/menu-items/daily/:date',
          get: 'GET /api/menu-items/:id',
          create: 'POST /api/menu-items',
          update: 'PUT /api/menu-items/:id',
          delete: 'DELETE /api/menu-items/:id',
          toggleActive: 'PATCH /api/menu-items/:id/toggle-active',
          bulkImport: 'POST /api/menu-items/bulk-import'
        },
      wasteData: {
        list: 'GET /api/waste-data',
        previousDay: 'GET /api/waste-data/previous-day',
        stats: 'GET /api/waste-data/stats',
        get: 'GET /api/waste-data/:id',
        create: 'POST /api/waste-data',
        update: 'PUT /api/waste-data/:id',
        delete: 'DELETE /api/waste-data/:id'
      },
      specialMenus: {
        list: 'GET /api/special-menus',
        current: 'GET /api/special-menus/current',
        active: 'GET /api/special-menus/active/:date',
        get: 'GET /api/special-menus/:id',
        create: 'POST /api/special-menus',
        update: 'PUT /api/special-menus/:id',
        delete: 'DELETE /api/special-menus/:id',
        toggleActive: 'PATCH /api/special-menus/:id/toggle-active'
      },
      quotes: {
        list: 'GET /api/quotes',
        random: 'GET /api/quotes/random',
        active: 'GET /api/quotes/active',
        get: 'GET /api/quotes/:id',
        create: 'POST /api/quotes',
        update: 'PUT /api/quotes/:id',
        delete: 'DELETE /api/quotes/:id',
        toggleActive: 'PATCH /api/quotes/:id/toggle-active',
        bulk: 'POST /api/quotes/bulk'
      },
      display: {
        all: 'GET /api/display/all',
        menu: 'GET /api/display/menu',
        nutrition: 'GET /api/display/nutrition',
        waste: 'GET /api/display/waste',
        specialMenu: 'GET /api/display/special-menu',
        quote: 'GET /api/display/quote',
        health: 'GET /api/display/health'
      }
    }
  });
});

module.exports = router;