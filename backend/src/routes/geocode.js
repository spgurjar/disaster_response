const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const geocodeController = require('../controllers/geocodeController');

router.use(auth);

// POST /geocode (extract location with Gemini, convert to lat/lng with mapping service)
router.post('/geocode', geocodeController.geocode);

module.exports = router; 