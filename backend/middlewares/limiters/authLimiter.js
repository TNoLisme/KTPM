const { client } = require('../../utils/redisClient');
const ErrorHandler = require('../../utils/errorHandler');
const asyncErrorHandler = require('../asyncErrorHandler');

const slidingWindowAuthLimiter = (limit, windowSeconds) => asyncErrorHandler(async (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const key = `auth_limit:${ip}`;
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    try {
        const multi = client.multi();

        multi.zRemRangeByScore(key, 0, windowStart);

        multi.zCard(key);

        multi.expire(key, windowSeconds + 10);

        const results = await multi.exec();
        
        const requestCount = results[1]; 

        if (requestCount >= limit) {
            return next(new ErrorHandler(`Bạn đã thử quá nhiều lần (${requestCount}/${limit}). Vui lòng thử lại sau ${windowSeconds} giây.`, 429));
        }

        await client.zAdd(key, { score: now, value: `${now}-${Math.random()}` });

        next();
    } catch (error) {
        console.error("Redis Rate Limiter Error:", error);
        next(); 
    }
});

module.exports = slidingWindowAuthLimiter(5, 60);