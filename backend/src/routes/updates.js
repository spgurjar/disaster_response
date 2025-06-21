const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const updatesController = require('../controllers/updatesController');

router.use(auth);

// GET /disasters/:id/official-updates (Browse Page data)
router.get('/:id/official-updates', updatesController.getOfficialUpdates);

module.exports = router; 