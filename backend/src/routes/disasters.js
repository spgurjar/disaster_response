const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const disastersController = require('../controllers/disastersController');

router.use(auth);

router.post('/', disastersController.createDisaster);
router.get('/', disastersController.getDisasters);
router.put('/:id', disastersController.updateDisaster);
router.delete('/:id', disastersController.deleteDisaster);

module.exports = router; 