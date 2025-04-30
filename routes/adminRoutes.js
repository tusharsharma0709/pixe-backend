const express = require('express');
const admin = require('../controllers/adminControllers');
const {adminAuth, superAdminAuth} = require('../middlewares/auth')

const router = express.Router();

// Defines the route for register admin
router.post('/register',superAdminAuth,admin.register);
// Defines the route for login admin panel
router.post('/login', admin.login);
// Defines the route for logout from admin panel
router.post('/logout' , adminAuth , admin.logout);
// Defines the route for get profile of a particular admin
router.get('/profile' , adminAuth , admin.Profile);
// Defines the route for update profile of an admin
router.patch('/update-profile' , adminAuth , admin.updateProfile);
// Defines the route for change the password of an admin
router.post('/change-password', adminAuth , admin.changePassword);
// Defines the route to get all users
router.get('/users', adminAuth , admin.getAllUsers);
// Defines the route to get particular users
router.get('/user/:id', adminAuth , admin.getUserById);
// Defines the route to update user status
router.patch('/user-status/:id', adminAuth , admin.updateUserStatus);



module.exports = router
