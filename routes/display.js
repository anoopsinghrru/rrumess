// Display routes for public TV interface
const express = require('express');
const router = express.Router();

/**
 * GET /display
 * Main display interface
 */
router.get('/', (req, res) => {
  res.render('display/index', {
    title: 'Mess TV Display'
  });
});

module.exports = router;