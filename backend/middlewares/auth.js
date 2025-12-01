const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const ErrorHandler = require('../utils/errorHandler');
const asyncErrorHandler = require('./asyncErrorHandler');

exports.isAuthenticatedUser = asyncErrorHandler(async (req, res, next) => {

    // ⚡ 1) Load test mode (cho JMeter)
    if (process.env.LOAD_TEST_MODE === 'TRUE') {
        req.user = {
            _id: "6926c22be29cc78d066f840d",
            name: "thinh",
            email: "thinh01092005@gmail.com",
            role: "user"
        };
        return next();
    }

    // ⚡ 2) Chuẩn hóa token
    let token = null;

    // Từ cookie
    if (req.cookies?.token) {
        token = req.cookies.token;
    }

    // Từ Authorization header
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }
    }

    // Không có token → báo lỗi
    if (!token) {
        return next(new ErrorHandler("Please Login to Access", 401));
    }

    // ⚡ 3) Verify token
    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decodedData.id);

    next();
});

exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {

        if (!roles.includes(req.user.role)) {
            return next(new ErrorHandler(`Role: ${req.user.role} is not allowed`, 403));
        }
        next();
    }
}