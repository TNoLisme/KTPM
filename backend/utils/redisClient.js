// --- Version 1-----
const { createClient } = require('redis');
const CircuitBreaker = require('opossum');

const client = createClient({
    url: 'redis://127.0.0.1:6379',
    socket: {
        connectTimeout: 1000,
        timeout: 1000,
        reconnectStrategy: (retries) => {
            return false;
        }
    }
});

client.on('error', (err) => {
    console.log('Redis Client Error', err);
});

async function connectRedis() {
    if (!client.isOpen) {
        await client.connect();
        console.log('Redis connected successfully!');
    }
}

// -- Circuit breaker cho tất cả Redis operations --
const redisOperation = async (operation, ...args) => {
    return await client[operation](...args);
};

const breakerOptions = {
    errorThresholdPercentage: 10, // Ngưỡng 10% lỗi mạng
    volumeThreshold: 20, // quan sát 20 request gần nhất
    timeout: 3000, 
    resetTimeout: 15000 // Chờ 30s ở open trước khi mở lại
}

const redisBreaker = new CircuitBreaker(redisOperation, breakerOptions);

redisBreaker.on('open', () => console.warn("WARNING: Redis circuit breaker is open"));
redisBreaker.on('close', () => console.log("OK: Redis circuit breaker closed"));

redisBreaker.on('halfOpen', async () => {
 
    if (!client.isOpen) {
        try {
            await client.connect(); 
            
            console.log('Redis Client reconnected successfully in Half-Open.');
        } catch (err) {
            console.error('Redis Client reconnection failed in Half-Open:', err.message);
        }
    }
});

// --- version 2--- Xử lý thundering herd

connectRedis().catch(err => {
    console.error("WARNING: Redis initial connection failed. The Circuit Breaker is active.");
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function exponentialBackoff(retryCount, baseDelay = 50) {
    return Math.min(baseDelay * Math.pow(2, retryCount), 1000); // Max 1 second
}

// Lấy Cache có Khóa Phân Tán
const getOrSetCacheWithLock = async (key, fetchFunction, ttlSeconds) => {
    const lockKey = `lock:${key}`;
    const maxRetry = 5;
    let retries = 0;

    while (retries < maxRetry) {
        let cachedData;
        try {
            // Thử lấy data từ cache với breaker
            cachedData = await redisBreaker.fire('get', key);
            if (cachedData) {
                return JSON.parse(cachedData)
            }
        } catch (error) {
            if (error.message && error.message.includes('Breaker is open')) {
                console.warn('Circuit breaker open, falling back to DB directly');
                return await fetchFunction();
            }
            console.error('Redis Get Error:', error.message);
            // Tiếp tục thử acquire lock
        }

        try {
            // Sử dụng breaker cho lock operation
            const lockTimeout = 5; 
            const acquiredLock = await redisBreaker.fire('set', 
                lockKey, 'locked', 'NX', 'EX', lockTimeout 
            );

            if (acquiredLock) {
                // console.log(`[LOCK AQUIRED] Key: ${key} is rebuilding cache...`);
                
                const freshData = await fetchFunction();

                await redisBreaker.fire('setEx', key, ttlSeconds, JSON.stringify(freshData));
                await redisBreaker.fire('del', lockKey).catch(() => {});
                
                return freshData;
            } else {
                // Không lấy được lock, sử dụng exponential backoff
                const backoffDelay = exponentialBackoff(retries);
                retries++;
                await sleep(backoffDelay);
            }
        } catch (error) {
            await redisBreaker.fire('del', [lockKey]).catch(() => {});
            
            if (error.message && error.message.includes('Breaker is open')) {
                console.warn('Circuit breaker open during lock operation, falling back to DB');
                return await fetchFunction();
            }
            
            console.error('Lock operation error:', error.message);
            retries++;
            
            if (retries >= maxRetry) {
                break;
            }
            
            const backoffDelay = exponentialBackoff(retries);
            await sleep(backoffDelay);
        }
    }
    
    // Fallback sau khi hết retry
    console.warn(`[MAX RETRY REACHED] Falling back to direct DB fetch for key: ${key}`);
    return await fetchFunction();
};

module.exports = { client, getOrSetCacheWithLock };