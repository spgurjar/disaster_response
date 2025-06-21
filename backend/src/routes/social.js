// src/routes/social.js
const express        = require('express');
const auth           = require('../middleware/auth');
const socialController = require('../controllers/socialController');
const router         = express.Router();

router.use(auth);

// GET /disasters/:id/social-media
router.get('/:id/social-media', socialController.getSocialMedia);

module.exports = router;


// const express = require('express');
// const router = express.Router();
// const auth = require('../middleware/auth');
// const socialController = require('../controllers/socialController');

// router.use(auth);

// // GET /disasters/:id/social-media (mock Twitter API)
// router.get('/:id/social-media', socialController.getSocialMedia);

// module.exports = router; 