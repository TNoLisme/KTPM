const express = require('express');
const { getAllProducts, getProductDetails, updateProduct, deleteProduct, getProductReviews, deleteReview, createProductReview, createProduct, getAdminProducts, getProducts } = require('../controllers/productController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const { publicReadLimiter, adminLimiter, spamThrottler, spamLimiter } = require("../middlewares/limiter");
const router = express.Router();

router.route('/products').get(publicReadLimiter, getAllProducts);
router.route('/products/all').get(getProducts);

router.route('/admin/products').get(isAuthenticatedUser, authorizeRoles("admin"), getAdminProducts);
router.route('/admin/product/new').post(isAuthenticatedUser, authorizeRoles("admin"),adminLimiter, createProduct);

router.route('/admin/product/:id')
    .put(isAuthenticatedUser, authorizeRoles("admin"), adminLimiter, updateProduct)
    .delete(isAuthenticatedUser, authorizeRoles("admin"), adminLimiter, deleteProduct);

router.route('/product/:id').get(publicReadLimiter,spamThrottler, spamLimiter, getProductDetails);

router.route('/review').put(isAuthenticatedUser, createProductReview);

router.route('/admin/reviews')
    .get(getProductReviews)
    .delete(isAuthenticatedUser, deleteReview);

module.exports = router;