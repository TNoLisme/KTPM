const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    txnId: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMode: {
        type: String,
        default: "MoMo"
    },
    status: {
        type: String,
        required: true
    },
    resultCode: {
        type: Number
    },
    message: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Payment", paymentSchema);