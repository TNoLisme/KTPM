const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('../models/orderModel');
const sendEmail = require('../utils/sendEmail');

dotenv.config({ path: "config.env" });

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Worker DB Connected"))
    .catch(err => console.error("Worker DB Connection Failed", err));

const orderWorker = new Worker('order-queue', async (job) => {
    const { user, userEmail, userName, shippingInfo, orderItems, paymentInfo, totalPrice, createdAt } = job.data;

    const orderExist = await Order.findOne({ "paymentInfo.id": paymentInfo.id });
    if (orderExist) {
        console.log(`Order ${paymentInfo.id} already exists. Skipping.`);
        return;
    }

    const order = await Order.create({
        shippingInfo,
        orderItems,
        paymentInfo,
        totalPrice,
        paidAt: createdAt || Date.now(),
        user: user,
    });

    console.log(`Order Created: ${order._id}`);

    try {
        await sendEmail({
            email: userEmail,
            templateId: process.env.SENDGRID_ORDER_TEMPLATEID,
            data: {
                name: userName,
                shippingInfo,
                orderItems,
                totalPrice,
                oid: order._id,
            }
        });
    } catch (emailError) {
        console.error("Email send failed for order:", order._id);
    }

    return order;
}, { 
    connection: { host: '127.0.0.1', port: 6379 },
    concurrency: 5 
});

orderWorker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
});

orderWorker.on('failed', (job, err) => {
    console.error(`Job ${job.id} has failed with ${err.message}`);
});

console.log("Order Worker started listening...");