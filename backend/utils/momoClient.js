const axios = require('axios');
const crypto = require('crypto');

// Hàm tạo chữ ký HMAC SHA256
const signRawData = (rawData, secretKey) => {
    return crypto.createHmac('sha256', secretKey).update(rawData).digest('hex');
};

// Hàm gửi yêu cầu tạo thanh toán sang MoMo
const createMoMoPayment = async (orderId, amount, orderInfo) => {
    try {
        const partnerCode = process.env.MOMO_PARTNER_CODE;
        const accessKey = process.env.MOMO_ACCESS_KEY;
        const secretKey = process.env.MOMO_SECRET_KEY;
        const endpoint = process.env.MOMO_ENDPOINT; // https://test-payment.momo.vn/v2/gateway/api/create

        // Return URL: Nơi user được redirect về (fallback nếu không dùng polling)
        const redirectUrl = process.env.FRONTEND_RETURN_URL;
        const ipnUrl = process.env.MOMO_IPN_URL;

        const requestId = orderId;
        const requestType = "captureWallet";
        const extraData = "";

        // Tạo chuỗi raw signature theo thứ tự alphabet của key (quy định MoMo)
        const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

        const signature = signRawData(rawSignature, secretKey);

        const requestBody = {
            partnerCode,
            accessKey,
            requestId,
            amount: amount.toString(),
            orderId,
            orderInfo,
            redirectUrl,
            ipnUrl,
            ipnUrl,
            lang: 'vi',
            requestType,
            extraData,
            signature
        };

        const response = await axios.post(endpoint, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });

        return response.data;
    } catch (error) {
        console.error("MoMo Create Payment Error:", error.response ? error.response.data : error.message);
        throw error;
    }
};

// Hàm kiểm tra trạng thái giao dịch (Query Status)
const checkTransactionStatus = async (orderId) => {
    try {
        const partnerCode = process.env.MOMO_PARTNER_CODE;
        const accessKey = process.env.MOMO_ACCESS_KEY;
        const secretKey = process.env.MOMO_SECRET_KEY;
        const requestId = Date.now().toString(); // Random requestId mới cho request này

        const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}`;
        const signature = signRawData(rawSignature, secretKey);

        const requestBody = {
            partnerCode,
            accessKey,
            requestId,
            orderId,
            signature,
            lang: 'vi'
        };

        // Endpoint Query Status (Lưu ý: Endpoint này khác endpoint create)
        // Môi trường Test:
        const statusEndpoint = "https://test-payment.momo.vn/v2/gateway/api/query";

        const response = await axios.post(statusEndpoint, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });

        return response.data;
    } catch (error) {
        console.error("MoMo Check Status Error:", error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { createMoMoPayment, checkTransactionStatus };