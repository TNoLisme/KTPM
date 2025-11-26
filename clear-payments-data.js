const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Payment = require('./backend/models/paymentModel.js'); // Import Payment Model
const path = require('path');

// 1. Cấu hình biến môi trường
// Giả định file .env nằm ở backend/config/config.env hoặc tương tự
dotenv.config();
// Hoặc chỉ cần dotenv.config() nếu file .env nằm ở thư mục gốc

// Lấy MONGO_URI
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ LỖI: MONGO_URI chưa được định nghĩa trong file .env. Vui lòng kiểm tra lại.");
    process.exit(1);
}

const clearPayments = async () => {
    try {
        console.log("-----------------------------------------");
        console.log("🛠️ BẮT ĐẦU DỌN DẸP DỮ LIỆU THANH TOÁN...");

        // 2. Kết nối Database
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("✅ Đã kết nối MongoDB thành công.");

        // 3. Thực hiện xóa dữ liệu
        const deleteResult = await Payment.deleteMany({});

        // 4. Báo cáo kết quả
        if (deleteResult.deletedCount === 0) {
            console.log("📝 Collection Payment hiện đã trống hoặc không có bản ghi nào để xóa.");
        } else {
            console.log(`🗑️ ĐÃ XÓA THÀNH CÔNG ${deleteResult.deletedCount} bản ghi khỏi collection Payment.`);
        }

        console.log("-----------------------------------------");

    } catch (error) {
        console.error("❌ LỖI TRONG QUÁ TRÌNH XÓA DỮ LIỆU:", error.message);

    } finally {
        // 5. Đóng kết nối
        await mongoose.disconnect();
        console.log("🔗 Đã ngắt kết nối MongoDB.");
        process.exit(0);
    }
}

// Chạy hàm xóa dữ liệu
clearPayments();