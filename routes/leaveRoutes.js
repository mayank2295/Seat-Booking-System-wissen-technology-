const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/authMiddleware');
const leaveController = require('../controllers/leaveController');

router.post('/declare', isLoggedIn, leaveController.declareLeave);
router.post('/cancel', isLoggedIn, leaveController.cancelLeave);

module.exports = router;
