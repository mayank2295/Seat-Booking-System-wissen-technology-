const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

router.get('/', isLoggedIn, dashboardController.getDashboard);

module.exports = router;
