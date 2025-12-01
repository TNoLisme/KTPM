const express = require('express');
const { getAllProducts, getProductDetails, updateProduct, deleteProduct, getProductReviews, deleteReview, createProductReview, createProduct, getAdminProducts, getProducts } = require('../controllers/productController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const productReadThrottler = require('../middlewares/limiters/productLimiter');
const adminLimiter = require('../middlewares/limiters/adminLimiter');

const router = express.Router();

router.route('/products').get(productReadThrottler, getAllProducts);
router.route('/products/all').get(getProducts);

router.route('/admin/products').get(isAuthenticatedUser, authorizeRoles("admin"), getAdminProducts);
router.route('/admin/product/new').post(isAuthenticatedUser, authorizeRoles("admin"), adminLimiter, createProduct);

router.route('/admin/product/:id')
    .put(isAuthenticatedUser, authorizeRoles("admin"), adminLimiter, updateProduct)
    .delete(isAuthenticatedUser, authorizeRoles("admin"), adminLimiter, deleteProduct);

router.route('/product/:id').get(productReadThrottler, getProductDetails);

router.route('/review').put(isAuthenticatedUser, createProductReview);

router.route('/admin/reviews')
    .get(getProductReviews)
    .delete(isAuthenticatedUser, deleteReview);

module.exports = router;