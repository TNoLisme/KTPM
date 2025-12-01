const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const pipelineManager = require('../pipeline/Pipeline');
// Create New Order (ASYNC SEDA ENTRY POINT)
exports.newOrder = asyncErrorHandler(async (req, res, next) => {

    // Chuẩn bị Payload (Job Data)
    const traceId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const jobData = {
        traceId: traceId,
        user: {
            _id: req.user._id, // User lấy từ Middleware Auth
            name: req.user.name,
            email: req.user.email
        },
        input: {
            shippingInfo: req.body.shippingInfo,
            orderItems: req.body.orderItems,
            paymentInfo: req.body.paymentInfo || {}, // Mock ID từ frontend hoặc rỗng
            totalPrice: req.body.totalPrice,
            // Thêm cờ behavior nếu muốn test lỗi từ API (Optional)
            behavior: req.body.behavior || 'SUCCESS'
        }
    }

    try {
        console.log(`[API] Received Order Request ${traceId}. Pushing to Pipeline...`);

        // ĐẨY VÀO PIPELINE VÀ CHỜ KẾT QUẢ (Mode: Request-Response)
        // Chúng ta dùng 'await' ở đây để nhận về OrderID thật trả cho Frontend/JMeter
        // Nếu muốn chạy kiểu "Fire-and-Forget" (trả về ngay lập tức), bỏ 'await' đi.
        const result = await pipelineManager.addJob(jobData);

        // 4. Trả về kết quả thành công (Sau khi đã qua hết các Filter: Validate -> Kho -> DB -> Payment)
        res.status(201).json({
            success: true,
            message: "Order processed successfully via Pipeline.",
            traceId: traceId,
            orderId: result.orderId,        // ID thật từ DB
            paymentInfo: result.paymentResult, // Kết quả từ MoMo/Mock
            order: {                        // Trả về cấu trúc khớp với Frontend mong đợi
                _id: result.orderId,
                orderStatus: "Paid",        // Vì đã qua bước Payment thành công
                totalPrice: jobData.input.totalPrice
            }
        });

    } catch (error) {
        // Nếu lỗi xảy ra trong Pipeline (đã retry hết mức và Rollback), lỗi sẽ ném ra đây
        console.error(`[API] Request ${traceId} Failed: ${error.message}`);

        // Trả về lỗi 500 hoặc 400 tùy loại lỗi để Frontend biết
        return next(new ErrorHandler(error.message, 500));
    }
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