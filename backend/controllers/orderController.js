const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const ErrorHandler = require('../utils/errorHandler');
const sendEmail = require('../utils/sendEmail');
const orderQueue = require('../utils/orderQueue'); // Import Queue đã tạo

// Create New Order (Queue-Based Load Leveling)
// Logic: Nhận request -> Validate sơ bộ -> Đẩy vào Queue -> Trả về 202 Accepted ngay lập tức
exports.newOrder = asyncErrorHandler(async (req, res, next) => {

    // Chuẩn bị Payload (Job Data)
    const traceId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Validate input cơ bản trước khi đẩy vào Queue
    // Giúp loại bỏ các request rác ngay từ đầu mà không tốn resource của Worker
    if (!orderItems || orderItems.length === 0) {
        return next(new ErrorHandler("No order items", 400));
    }

    // Đẩy job vào hàng đợi 'process-order'
    // Dữ liệu trong job bao gồm tất cả thông tin cần thiết để Worker tạo đơn hàng sau này
    await orderQueue.add('process-order', {
        user: req.user._id, // User ID từ auth middleware
        userEmail: req.user.email,
        userName: req.user.name,
        shippingInfo,
        orderItems,
        paymentInfo,
        totalPrice,
        createdAt: Date.now()
    }, {
        removeOnComplete: true, // Tự động xóa job khỏi Redis khi hoàn thành để tiết kiệm bộ nhớ
        attempts: 3, // Tự động thử lại 3 lần nếu Worker gặp lỗi (ví dụ: DB timeout)
        backoff: { type: 'exponential', delay: 1000 } // Thời gian chờ giữa các lần thử lại tăng dần: 1s, 2s, 4s...
    });

    // Trả về mã 202 (Accepted) thay vì 201 (Created)
    // Ý nghĩa: "Tôi đã nhận yêu cầu của bạn và sẽ xử lý, nhưng chưa xong ngay đâu"
    res.status(202).json({
        success: true,
        message: "Order request received and queued for processing.",
    });
});

// Get Single Order Details
exports.getSingleOrderDetails = asyncErrorHandler(async (req, res, next) => {

    const order = await Order.findById(req.params.id).populate("user", "name email");

    if (!order) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    res.status(200).json({
        success: true,
        order,
    });
});


// Get Logged In User Orders
exports.myOrders = asyncErrorHandler(async (req, res, next) => {

    const orders = await Order.find({ user: req.user._id });

    if (!orders) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    res.status(200).json({
        success: true,
        orders,
    });
});


// Get All Orders ---ADMIN
exports.getAllOrders = asyncErrorHandler(async (req, res, next) => {

    const orders = await Order.find();

    if (!orders) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    let totalAmount = 0;
    orders.forEach((order) => {
        totalAmount += order.totalPrice;
    });

    res.status(200).json({
        success: true,
        orders,
        totalAmount,
    });
});

// Update Order Status ---ADMIN
exports.updateOrder = asyncErrorHandler(async (req, res, next) => {

    const order = await Order.findById(req.params.id);

    if (!order) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    if (order.orderStatus === "Delivered") {
        return next(new ErrorHandler("Already Delivered", 400));
    }

    if (req.body.status === "Shipped") {
        order.shippedAt = Date.now();
        order.orderItems.forEach(async (i) => {
            await updateStock(i.product, i.quantity)
        });
    }

    order.orderStatus = req.body.status;
    if (req.body.status === "Delivered") {
        order.deliveredAt = Date.now();
    }

    await order.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true
    });
});

async function updateStock(id, quantity) {
    const product = await Product.findById(id);
    product.stock -= quantity;
    await product.save({ validateBeforeSave: false });
}

// Delete Order ---ADMIN
exports.deleteOrder = asyncErrorHandler(async (req, res, next) => {

    const order = await Order.findById(req.params.id);

    if (!order) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    await order.remove();

    res.status(200).json({
        success: true,
    });
});