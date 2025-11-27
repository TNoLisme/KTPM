const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
// THAY ĐỔI Ở ĐÂY: Import từ workerManager mới
const { entryQueue } = require('../workers/workerManager');

// Giữ nguyên các import model cũ nếu cần cho các hàm get/update bên dưới
const Order = require('../models/orderModel');
const Product = require('../models/productModel');

// Create New Order (ASYNC SEDA ENTRY POINT)
exports.newOrder = asyncErrorHandler(async (req, res, next) => {

    // 1. Chuẩn bị Payload
    const jobData = {
        traceId: `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email
        },
        input: {
            shippingInfo: req.body.shippingInfo,
            orderItems: req.body.orderItems,
            // --- QUAN TRỌNG: Lấy paymentInfo từ Frontend gửi lên ---
            paymentInfo: req.body.paymentInfo || {},
            // -------------------------------------------------------
            totalPrice: req.body.totalPrice
        }
    };

    // 2. Đẩy vào Queue đầu tiên (Validate)
    // Hệ thống sẽ tự chạy qua Validate -> Inventory -> Persist
    await entryQueue.add('start-pipeline', jobData);

    // 3. Trả lời ngay lập tức
    res.status(202).json({
        success: true,
        message: "Order request accepted. Processing pipeline started.",
        traceId: jobData.traceId,
        // Trả về một object order giả để Frontend OrderStatus.js không bị lỗi
        order: { _id: "PROCESSING_ID", orderStatus: "Processing" }
    });
});

// --- CÁC HÀM KHÁC (GET/UPDATE/DELETE) GIỮ NGUYÊN NHƯ CŨ ---
exports.getSingleOrderDetails = asyncErrorHandler(async (req, res, next) => {
    const order = await Order.findById(req.params.id).populate("user", "name email");
    if (!order) return next(new ErrorHandler("Order Not Found", 404));
    res.status(200).json({ success: true, order });
});

exports.myOrders = asyncErrorHandler(async (req, res, next) => {
    const orders = await Order.find({ user: req.user._id });
    res.status(200).json({ success: true, orders });
});

exports.getAllOrders = asyncErrorHandler(async (req, res, next) => {
    const orders = await Order.find();
    let totalAmount = 0;
    orders.forEach((order) => { totalAmount += order.totalPrice; });
    res.status(200).json({ success: true, orders, totalAmount });
});

exports.updateOrder = asyncErrorHandler(async (req, res, next) => {
    const order = await Order.findById(req.params.id);
    if (!order) return next(new ErrorHandler("Order Not Found", 404));
    if (order.orderStatus === "Delivered") return next(new ErrorHandler("Already Delivered", 400));
    if (req.body.status === "Shipped") { order.shippedAt = Date.now(); }
    order.orderStatus = req.body.status;
    if (req.body.status === "Delivered") order.deliveredAt = Date.now();
    await order.save({ validateBeforeSave: false });
    res.status(200).json({ success: true });
});

exports.deleteOrder = asyncErrorHandler(async (req, res, next) => {
    const order = await Order.findById(req.params.id);
    if (!order) return next(new ErrorHandler("Order Not Found", 404));
    await order.remove();
    res.status(200).json({ success: true });
});