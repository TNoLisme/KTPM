const BaseFilter = require('./BaseFilter');
const sendEmail = require('../utils/sendEmail');

class NotificationFilter extends BaseFilter {
    async execute(data) {
        const { input, user, orderId } = data;
        // console.log(`[Filter: Notify] Sending Email...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        await sendEmail({
            email: user.email,
            templateId: process.env.SENDGRID_ORDER_TEMPLATEID,
            data: {
                name: user.name,
                totalPrice: input.totalPrice,
                oid: orderId,
            }
        });

        data.status = "COMPLETED";
        return data;
    }
}
module.exports = NotificationFilter;