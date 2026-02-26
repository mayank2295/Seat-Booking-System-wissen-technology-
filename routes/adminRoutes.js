const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

router.get('/', isLoggedIn, isAdmin, adminController.getAdmin);
router.post('/add-user', isLoggedIn, isAdmin, adminController.addUser);
router.post('/delete-user', isLoggedIn, isAdmin, adminController.deleteUser);

module.exports = router;
