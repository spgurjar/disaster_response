const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const resourcesController = require('../controllers/resourcesController');

router.use(auth);

// GET /disasters/:id/resources?lat=...&lon=... (Supabase geospatial lookup)
router.get('/:id/resources', resourcesController.getNearbyResources);

module.exports = router; 