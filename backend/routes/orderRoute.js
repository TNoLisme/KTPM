const express = require('express');
const { newOrder, getSingleOrderDetails, myOrders, getAllOrders, updateOrder, deleteOrder } = require('../controllers/orderController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const adminLimiter = require('../middlewares/limiters/adminLimiter');
const { spamThrottler, spamLimiter} = require("../middlewares/limiters/spamLimiter");
const router = express.Router();

router.route('/order/new').post(isAuthenticatedUser, spamThrottler, spamLimiter, newOrder);
router.route('/order/:id').get(isAuthenticatedUser, getSingleOrderDetails);
router.route('/orders/me').get(isAuthenticatedUser, myOrders);

router.route('/admin/orders').get(isAuthenticatedUser, authorizeRoles("admin"), getAllOrders);

router.route('/admin/order/:id')
    .put(isAuthenticatedUser, authorizeRoles("admin"), adminLimiter, updateOrder)
    .delete(isAuthenticatedUser, authorizeRoles("admin"), adminLimiter, deleteOrder);

module.exports = router;