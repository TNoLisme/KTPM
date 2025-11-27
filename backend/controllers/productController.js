const Product = require('../models/productModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const SearchFeatures = require('../utils/searchFeatures');
const ErrorHandler = require('../utils/errorHandler');
const cloudinary = require('cloudinary');

// Get All Products
exports.getAllProducts = asyncErrorHandler(async (req, res, next) => {

    const resultPerPage = 12;
    const productsCount = await Product.countDocuments();

    const searchFeature = new SearchFeatures(Product.find(), req.query)
        .search()
        .filter();

    let products = await searchFeature.query;
    let filteredProductsCount = products.length;

    searchFeature.pagination(resultPerPage);

    products = await searchFeature.query.clone();

    res.status(200).json({
        success: true,
        products,
        productsCount,
        resultPerPage,
        filteredProductsCount,
    });
});

// Get All Products ---Product Sliders
exports.getProducts = asyncErrorHandler(async (req, res, next) => {
    const products = await Product.find();

    res.status(200).json({
        success: true,
        products,
    });
});

// Get Product Details
exports.getProductDetails = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    res.status(200).json({
        success: true,
        product,
    });
});

// Get All Products ---ADMIN
exports.getAdminProducts = asyncErrorHandler(async (req, res, next) => {
    const products = await Product.find();

    res.status(200).json({
        success: true,
        products,
    });
});

// Create Product ---ADMIN (đã dùng valet key)
exports.createProduct = asyncErrorHandler(async (req, res, next) => {
    // FE gửi images: [{public_id, url}, ...]
    const imagesFromClient = Array.isArray(req.body.images) ? req.body.images : [];

    const imagesLink = imagesFromClient.map((img) => ({
        public_id: img.public_id,
        url: img.url,
    }));

    // FE gửi brandLogo: {public_id, url}
    const brandLogoFromClient = req.body.brandLogo;

    const brandLogo = brandLogoFromClient
        ? {
            public_id: brandLogoFromClient.public_id,
            url: brandLogoFromClient.url,
        }
        : undefined;

    req.body.brand = {
        name: req.body.brandname,
        logo: brandLogo,
    };
    req.body.images = imagesLink;
    req.body.user = req.user.id;

    // specs: FE mới gửi dạng object; giữ fallback cho dạng cũ (string JSON)
    let specs = [];
    if (Array.isArray(req.body.specifications)) {
        specs = req.body.specifications;
    } else if (req.body.specifications) {
        req.body.specifications.forEach((s) => {
            specs.push(JSON.parse(s));
        });
    }
    req.body.specifications = specs;

    const product = await Product.create(req.body);

    res.status(201).json({
        success: true,
        product,
    });
});

// Update Product ---ADMIN (đã sửa block specifications)
exports.updateProduct = asyncErrorHandler(async (req, res, next) => {

    let product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    // Xử lý images mới nếu có: FE gửi [{public_id, url}]
    if (req.body.images && req.body.images.length > 0) {
        // Xoá ảnh cũ trên Cloudinary
        for (let i = 0; i < product.images.length; i++) {
            await cloudinary.v2.uploader.destroy(product.images[i].public_id);
        }

        const imagesFromClient = Array.isArray(req.body.images) ? req.body.images : [];

        req.body.images = imagesFromClient.map((img) => ({
            public_id: img.public_id,
            url: img.url,
        }));
    }

    // Logo mới, FE gửi brandLogo: {public_id, url}
    if (req.body.brandLogo && req.body.brandLogo.public_id) {
        if (product.brand && product.brand.logo && product.brand.logo.public_id) {
            await cloudinary.v2.uploader.destroy(product.brand.logo.public_id);
        }

        const brandLogoFromClient = req.body.brandLogo;

        req.body.brand = {
            name: req.body.brandname,
            logo: {
                public_id: brandLogoFromClient.public_id,
                url: brandLogoFromClient.url,
            },
        };
    }

    // Specifications: chấp nhận cả dạng array object (mới) lẫn string JSON (cũ)
    let specs = [];
    if (Array.isArray(req.body.specifications)) {
        specs = req.body.specifications;
    } else if (req.body.specifications) {
        req.body.specifications.forEach((s) => {
            specs.push(JSON.parse(s));
        });
    }
    req.body.specifications = specs;

    req.body.user = req.user.id;

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });

    res.status(201).json({
        success: true,
        product,
    });
});

// Delete Product ---ADMIN
exports.deleteProduct = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    for (let i = 0; i < product.images.length; i++) {
        await cloudinary.v2.uploader.destroy(product.images[i].public_id);
    }

    await product.remove();

    res.status(201).json({
        success: true,
    });
});

// Create OR Update Reviews
exports.createProductReview = asyncErrorHandler(async (req, res, next) => {

    const { rating, comment, productId } = req.body;

    const review = {
        user: req.user._id,
        name: req.user.name,
        rating: Number(rating),
        comment,
    };

    const product = await Product.findById(productId);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    const isReviewed = product.reviews.find(
        (review) => review.user.toString() === req.user._id.toString()
    );

    if (isReviewed) {
        product.reviews.forEach((rev) => {
            if (rev.user.toString() === req.user._id.toString()) {
                rev.rating = rating;
                rev.comment = comment;
            }
        });
    } else {
        product.reviews.push(review);
        product.numOfReviews = product.reviews.length;
    }

    let avg = 0;

    product.reviews.forEach((rev) => {
        avg += rev.rating;
    });

    product.ratings = avg / product.reviews.length;

    await product.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
    });
});

// Get All Reviews of Product
exports.getProductReviews = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.query.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    res.status(200).json({
        success: true,
        reviews: product.reviews,
    });
});

// Delete Reviews
exports.deleteReview = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.query.productId);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    const reviews = product.reviews.filter(
        (rev) => rev._id.toString() !== req.query.id.toString()
    );

    let avg = 0;

    reviews.forEach((rev) => {
        avg += rev.rating;
    });

    let ratings = 0;

    if (reviews.length === 0) {
        ratings = 0;
    } else {
        ratings = avg / reviews.length;
    }

    const numOfReviews = reviews.length;

    await Product.findByIdAndUpdate(
        req.query.productId,
        {
            reviews,
            ratings: Number(ratings),
            numOfReviews,
        },
        {
            new: true,
            runValidators: true,
            useFindAndModify: false,
        }
    );

    res.status(200).json({
        success: true,
    });
});
