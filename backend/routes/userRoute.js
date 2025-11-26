const express = require('express');
const { registerUser, loginUser, logoutUser, getUserDetails, forgotPassword, resetPassword, updatePassword, updateProfile, getAllUsers, getSingleUser, updateUserRole, deleteUser } = require('../controllers/userController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

const { authLimiter, spamThrottler, spamLimiter, adminLimiter } = require("../middlewares/limiter");
const router = express.Router();

router.route('/register').post(authLimiter, registerUser);
router.route('/login').post(authLimiter, loginUser);
router.route('/logout').get(logoutUser);

router.route('/me').get(isAuthenticatedUser, getUserDetails);

router.route('/password/forgot').post(authLimiter,forgotPassword);
router.route('/password/reset/:token').put(authLimiter, resetPassword);

router.route('/password/update').put(isAuthenticatedUser, spamThrottler, updatePassword);

router.route('/me/update').put(isAuthenticatedUser, spamThrottler, spamLimiter, updateProfile);

router.route("/admin/users").get(isAuthenticatedUser, authorizeRoles("admin"), getAllUsers);

router.route("/admin/user/:id")
    .get(isAuthenticatedUser, adminLimiter, authorizeRoles("admin"), getSingleUser)
    .put(isAuthenticatedUser, adminLimiter, authorizeRoles("admin"), updateUserRole)
    .delete(isAuthenticatedUser, adminLimiter, authorizeRoles("admin"), deleteUser);

module.exports = router;