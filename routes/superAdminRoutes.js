const express = require('express');
const superAdmin = require('../controllers/superadminControllers');
const {adminAuth, superAdminAuth} = require('../middlewares/auth');

const router = express.Router();

// Defines the route for register superAdmin
router.post('/register',superAdmin.register);
// Defines the route for login superAdmin panel
router.post('/login', superAdmin.login);
// Defines the route for logout from superAdmin panel
router.post('/logout' , superAdminAuth , superAdmin.logout);
// Defines the route for get profile of a particular superAdmin
router.get('/profile' , superAdminAuth , superAdmin.getProfile);
// Defines the route for update profile of an superAdmin
router.patch('/update-profile' , superAdminAuth , superAdmin.updateProfile);
// Defines the route for change the password of an superAdmin
router.post('/change-password', superAdminAuth , superAdmin.changePassword);
// Defines the route to get all admins
router.get('/admin/:id', superAdminAuth , superAdmin.getAllAdmins);
// Defines the route to get particular admin
router.get('/admin/:id', superAdminAuth , superAdmin.getAdminById);
// Defines the route to get all users of an admin
router.get('/users/:id', superAdminAuth , superAdmin.getAllUsers);
// Defines the route to get particular user
router.get('/user/:id', superAdminAuth , superAdmin.getUserById);
// Defines the route to update user status
router.patch('/admin-status/:id', superAdminAuth , superAdmin.updateAdminStatus);



module.exports = router
