const axios = require('axios');
const crypto = require('crypto');

// 1. CẤU HÌNH
const TARGET_URL = "http://localhost:4000/api/v1";
const MOMO_CONFIG = {
    partnerCode: "MOMO",
    accessKey: "F8BBA842ECF85",
    secretKey: "K951B6PE1waDMi640xX08PD3vg6EkVlz"
};

// 2. NHẬP ORDER ID BẠN THẤY TRÊN WEB/CONSOLE VÀO ĐÂY
const ORDER_ID_TO_CONFIRM = "MOMO1764211780283164"; // <--- PASTE ORDER ID VÀO ĐÂY
const AMOUNT = "100"; // Phải khớp số tiền trên web

const confirmPayment = async () => {
    try {
        console.log(`🚀 Đang giả lập thanh toán cho đơn: ${ORDER_ID_TO_CONFIRM}...`);

        // Tạo chữ ký IPN
        const requestId = ORDER_ID_TO_CONFIRM;
        const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${AMOUNT}&extraData=&message=Success&orderId=${ORDER_ID_TO_CONFIRM}&orderInfo=Thanh toán đơn hàng E-Commerce&orderType=momo_wallet&partnerCode=${MOMO_CONFIG.partnerCode}&payType=qr&requestId=${requestId}&responseTime=${Date.now()}&resultCode=0&transId=${Date.now()}`;

        const signature = crypto.createHmac('sha256', MOMO_CONFIG.secretKey)
            .update(rawSignature)
            .digest('hex');

        // Gửi IPN Callback
        const res = await axios.post(`${TARGET_URL}/callback`, {
            partnerCode: MOMO_CONFIG.partnerCode,
            accessKey: MOMO_CONFIG.accessKey,
            requestId: requestId,
            amount: AMOUNT,
            orderId: ORDER_ID_TO_CONFIRM,
            orderInfo: "Thanh toán đơn hàng E-Commerce",
            orderType: "momo_wallet",
            transId: Date.now(),
            resultCode: 0,
            message: "Success",
            payType: "qr",
            responseTime: Date.now(),
            extraData: "",
            signature: signature
        });

        console.log("✅ Đã gửi xác nhận thành công! (Status: 204)");
        console.log("👉 Kiểm tra lại trình duyệt, đơn hàng sẽ tự động chuyển sang thành công.");

    } catch (error) {
        console.error("❌ Lỗi:", error.message);
        if (error.response) console.error("Server Response:", error.response.data);
    }
};

confirmPayment();