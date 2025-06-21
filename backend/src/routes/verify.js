const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const verifyController = require('../controllers/verifyController');

router.use(auth);

// POST /disasters/:id/verify-image (Gemini API)
router.post('/:id/verify-image', verifyController.verifyImage);

module.exports = router; 