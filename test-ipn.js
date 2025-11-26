// test-ipn.js
const axios = require('axios');
const crypto = require('crypto');

// 1. CẤU HÌNH (Lấy từ file .env của bạn)
const config = {
    partnerCode: "MOMO", // Thay bằng MOMO_PARTNER_CODE trong .env
    accessKey: "F8BBA842ECF85", // Thay bằng MOMO_ACCESS_KEY trong .env
    secretKey: "K951B6PE1waDMi640xX08PD3vg6EkVlz", // Thay bằng MOMO_SECRET_KEY trong .env
    targetUrl: "http://localhost:4000/api/v1/callback" // URL Backend đang chạy local
};

// 2. DỮ LIỆU GIẢ LẬP (Thay orderId mỗi lần test nếu cần)
const orderId = "MOMO1764153585364709"; // <--- PASTE ORDER ID BẠN VỪA TẠO Ở ĐÂY
const amount = "1400"; // Phải khớp với số tiền đơn hàng lúc tạo
const resultCode = 0; // 0 = Thành công, khác 0 = Thất bại

// Các thông số khác (thường cố định)
const requestId = orderId;
const orderInfo = "Thanh toán đơn hàng E-Commerce";
const orderType = "momo_wallet";
const transId = "2943284328"; // Mã giao dịch giả của MoMo
const message = "Success";
const responseTime = Date.now();
const extraData = "";
const payType = "qr";

// 3. TẠO CHỮ KÝ (SIGNATURE)
// MoMo yêu cầu chữ ký phải đúng chuẩn HMAC-SHA256 thì Backend mới nhận
const rawSignature = `accessKey=${config.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${config.partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

const signature = crypto.createHmac('sha256', config.secretKey)
    .update(rawSignature)
    .digest('hex');

// 4. GỬI REQUEST POST
const requestBody = {
    partnerCode: config.partnerCode,
    accessKey: config.accessKey,
    requestId: requestId,
    amount: amount,
    orderId: orderId,
    orderInfo: orderInfo,
    orderType: orderType,
    transId: transId,
    resultCode: resultCode,
    message: message,
    payType: payType,
    responseTime: responseTime,
    extraData: extraData,
    signature: signature
};

console.log("---------------------------------------------------");
console.log(`Sending Fake IPN for Order: ${orderId}`);
console.log(`Target URL: ${config.targetUrl}`);
console.log("---------------------------------------------------");

axios.post(config.targetUrl, requestBody)
    .then(res => {
        console.log("✅ IPN Sent Successfully!");
        console.log("Status Code:", res.status);
        // Backend thường trả về 204 No Content
    })
    .catch(err => {
        console.error("❌ IPN Failed!");
        if (err.response) {
            console.error("Response:", err.response.data);
            console.error("Status:", err.response.status);
        } else {
            console.error("Error:", err.message);
        }
    });