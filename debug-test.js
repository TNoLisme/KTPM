// debug-test.js
const axios = require('axios');
const crypto = require('crypto');

// Cấu hình (Dùng token cũ)
const TARGET_URL = "http://localhost:4000/api/v1";
const USER_TOKEN = "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjZjMjJiZTI5Y2M3OGQwNjZmODQwZCIsImlhdCI6MTc2NDE1NDY5NSwiZXhwIjoxNzY0NzU5NDk1fQ.z59Kq2I3OF-XME5g9i8Y9R2GHouE7zeiahte9qyajjg";
const MOMO_CONFIG = {
    partnerCode: "MOMO", accessKey: "F8BBA842ECF85", secretKey: "K951B6PE1waDMi640xX08PD3vg6EkVlz"
};

const runDebug = async () => {
    try {
        console.log("--- DEBUG START ---");
        // Gọi API tạo thanh toán
        await axios.post(`${TARGET_URL}/payment/process`, {
            amount: 1400,
            phoneNo: `09${Math.floor(10000000 + Math.random() * 90000000)}`
        }, {
            headers: {
                'Content-Type': 'application/json',
                // Gửi token (Lưu ý: phải là 'Cookie')
                'Cookie': USER_TOKEN
            }
        });

        console.log("DEBUG: Giao dịch thành công (Lỗi không phải ở xác thực)");
    } catch (error) {
        if (error.response) {
            console.error(`\n❌ LỖI GIAO DỊCH: HTTP ${error.response.status}`);
            console.error("Thông báo Server:", error.response.data.message);
        } else {
            console.error(`\n❌ LỖI KẾT NỐI: ${error.message}`);
        }
    }
};

runDebug();