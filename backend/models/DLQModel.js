// backend/models/DLQModel.js
const mongoose = require('mongoose');

const dlqSchema = new mongoose.Schema({
    // ID duy nhất của request (ví dụ: [USER_SAGA_PAY])
    // Index: true giúp tìm kiếm nhanh hơn
    traceId: {
        type: String,
        required: true,
        index: true
    },

    // Lưu lại toàn bộ dữ liệu đầu vào để Dev có thể debug hoặc chạy lại (Replay)
    inputPayload: {
        type: Object
    },

    // Tên bước bị lỗi (ví dụ: FaultyPaymentFilter)
    failedAtStep: {
        type: String,
        required: true
    },

    // Lý do lỗi (ví dụ: Simulated Payment Gateway Timeout)
    errorReason: {
        type: String,
        required: true
    },

    // Danh sách các bước đã chạy thành công trước khi chết
    // Ví dụ: ["ValidationFilter", "InventoryFilter"]
    stepsCompleted: [
        { type: String }
    ],

    // Trạng thái rollback (SUCCESS: đã hoàn tác sạch sẽ / PARTIAL_FAILED: hoàn tác lỗi)
    rollbackStatus: {
        type: String,
        default: "UNKNOWN"
    },

    // Thời gian xảy ra lỗi
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// MongoDB sẽ tự tạo collection tên là 'dlqs' (số nhiều của DLQ)
module.exports = mongoose.model('DLQ', dlqSchema);