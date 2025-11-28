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
// Create Product ---ADMIN (VALET KEY VERSION + LOG)
exports.createProduct = asyncErrorHandler(async (req, res, next) => {
    // Bắt đầu đo thời gian toàn request
    const startAll = Date.now();

    // Lấy size body từ header (để so với oldVersion)
    const bodySizeBytes = Number(req.headers["content-length"] || 0);
    const bodySizeKB = bodySizeBytes / 1024;

    // FE gửi images: [{public_id, url}, ...]
    const imagesFromClient = Array.isArray(req.body.images)
        ? req.body.images
        : [];

    // FE gửi brandLogo: {public_id, url}
    const brandLogoFromClient = req.body.brandLogo;

    console.log("\n==================== [VALET_BE] /admin/product/new ====================");
    console.log(
        `[VALET_BE] bodySize = ${bodySizeKB.toFixed(1)} KB, images = ${
            imagesFromClient.length
        }, specs = ${
            Array.isArray(req.body.specifications)
                ? req.body.specifications.length
                : 0
        }`
    );
    console.log(
        `[VALET_BE] basic info: name="${req.body.name}", brand="${req.body.brandname}"`
    );

    // Chuẩn hoá images (nhưng KHÔNG upload Cloudinary ở backend nữa)
    const imagesLink = imagesFromClient.map((img) => ({
        public_id: img.public_id,
        url: img.url,
    }));

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

    // specs: FE gửi dạng object luôn
    let specs = [];
    if (Array.isArray(req.body.specifications)) {
        specs = req.body.specifications;
    } else if (req.body.specifications) {
        // fallback nếu BE vẫn nhận dạng string
        req.body.specifications.forEach((s) => {
            specs.push(JSON.parse(s));
        });
    }
    req.body.specifications = specs;

    // Đo thời gian insert DB
    const dbStart = Date.now();
    const product = await Product.create(req.body);
    const dbTimeSec = (Date.now() - dbStart) / 1000;

    const totalTimeSec = (Date.now() - startAll) / 1000;

    console.log(
        `[VALET_BE] MongoDB insert = ${dbTimeSec.toFixed(
            3
        )} s, TOTAL request = ${totalTimeSec.toFixed(3)} s`
    );
    console.log(
        `[VALET_BE] created product _id = ${product._id.toString()}`
    );
    console.log("================================================================\n");

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
