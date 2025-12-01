// routes/loadTestRoute.js

const express = require('express');
const router = express.Router();
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const { isAuthenticatedUser } = require('../middlewares/auth');

// Import Filters
const ValidationFilter = require('../pipeline/ValidationFilter');
const InventoryFilter = require('../pipeline/InventoryFilter');
const PersistenceFilter = require('../pipeline/PersistenceFilter');
const PaymentFilter = require('../pipeline/PaymentFilter');
const RollbackInventoryFilter = require('../pipeline/RollbackInventoryFilter');
const RollbackOrderFilter = require('../pipeline/RollbackOrderFilter');
const pipeline = require('../pipeline/Pipeline');

// --- CẤU HÌNH PIPELINE (CHỈ CHẠY 1 LẦN KHI FILE ĐƯỢC LOAD) ---
if (!pipeline.isStarted) {
    // 1. Cấu hình Filters
    pipeline.filters = [
        new ValidationFilter(),
        new InventoryFilter(),
        new PersistenceFilter(),
        new PaymentFilter()
    ];

    // 2. Cấu hình Rollback
    pipeline.rollbackFilters = [
        new RollbackOrderFilter(),
        new RollbackInventoryFilter()
    ];

    // 3. Cấu hình Worker
    pipeline.workerConfig = {
        ValidationFilter: 20,
        InventoryFilter: 40,
        PersistenceFilter: 40,
        PaymentFilter: 100
    };

    // 4. Khởi tạo Queue lại theo số lượng Filter mới
    pipeline.queues = pipeline.filters.map(() => []);

    // 5. Start Workers
    pipeline.start();
}
// ------------------------------------------------

router.post('/loadtest/fullflow', isAuthenticatedUser, asyncErrorHandler(async (req, res) => {
    const user = req.user;
    // Xử lý input: Nếu là mảng thì map, nếu object đơn thì gói vào mảng
    const bodyData = req.body;

    // Tạo Job Data chuẩn
    const jobData = {
        input: bodyData,
        user: user
    };

    try {
        // Đẩy vào Queue và chờ kết quả (Async)
        // Worker đã chạy sẵn rồi, chỉ việc nhận job từ queue này
        const result = await pipeline.addJob(jobData);

        res.status(200).json({
            success: true,
            orderId: result.orderId,
            paymentResult: result.paymentResult,
            status: result.status
        });

    } catch (err) {
        // Lỗi đã được catch từ Saga Rollback trả về đây
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}));

module.exports = router;