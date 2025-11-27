const BaseFilter = require('./BaseFilter');
const { createMoMoPayment } = require('../utils/momoClient');

class PaymentFilter extends BaseFilter {
    async execute(data) {
        const { input, orderId } = data;
        console.log(`[Filter: Payment] Calling MoMo API for Order ${orderId}...`);

        // Tạo mã giao dịch unique cho MoMo
        const requestId = `MOMO${Date.now()}_${orderId}`;

        const momoRes = await createMoMoPayment(
            requestId,
            input.totalPrice,
            "Thanh toán đơn hàng"
        );

        // --- LOG THEO YÊU CẦU CỦA BẠN ---
        console.log("------------------------------------------------");
        console.log("✅ [MOMO RESPONSE LOG]");
        console.log(JSON.stringify(momoRes, null, 2)); // In đẹp object JSON
        console.log("------------------------------------------------");
        // --------------------------------

        if (!momoRes || momoRes.resultCode !== 0) {
            throw new Error(`Lỗi từ cổng thanh toán MoMo: ${momoRes ? momoRes.message : 'No Response'}`);
        }

        // Output: Link thanh toán
        data.paymentUrl = momoRes.payUrl;
        data.qrCodeUrl = momoRes.qrCodeUrl;
        data.deeplink = momoRes.deeplink;
        data.status = "PAYMENT_INITIATED";

        return data;
    }
}
module.exports = PaymentFilter;