// backend/pipeline/Pipeline.js
const DLQ = require('../models/DLQModel'); // Import Model DLQ

class PipelineQueue {
    constructor(filters = [], rollbackFilters = [], workerConfig = {}, maxRetries = 3) {
        this.filters = filters;
        this.rollbackFilters = rollbackFilters;
        this.workerConfig = workerConfig;
        this.maxRetries = maxRetries;

        this.queues = this.filters.map(() => []);
        this.pendingRequests = new Map();
        this.isStarted = false;
    }

    start() {
        if (this.isStarted) return;
        this.isStarted = true;
        console.log("[Pipeline] Starting Workers...");

        this.filters.forEach((filter, index) => {
            const filterName = filter.constructor.name;
            const numWorkers = this.workerConfig[filterName] || 1;
            console.log(`[Pipeline] Spawning ${numWorkers} workers for stage: [${filterName}]`);

            for (let i = 1; i <= numWorkers; i++) {
                this.runWorker(index, filter, i);
            }
        });
    }

    async runWorker(filterIndex, filter, workerId) {
        const inputQueue = this.queues[filterIndex];
        const isLastFilter = filterIndex === this.filters.length - 1;
        const filterName = filter.constructor.name;

        while (true) {
            if (inputQueue.length === 0) {
                await new Promise(r => setTimeout(r, 20));
                continue;
            }

            const job = inputQueue.shift();
            const traceId = job.data.traceId || 'UNKNOWN';

            try {
                // Thực thi Filter
                const resultData = await this.retryFilter(filter, job.data, traceId, workerId);

                // Cập nhật data
                job.data = resultData;

                // --- TRACKING: Ghi nhận bước này đã xong ---
                if (!job.history) job.history = [];
                job.history.push(filterName);
                // -------------------------------------------

                if (isLastFilter) {
                    this.finalizeJob(job, true);
                } else {
                    this.queues[filterIndex + 1].push(job);
                }

            } catch (err) {
                // Truyền filterName vào để biết lỗi ở đâu
                await this.handleFailure(job, err, traceId, filterName);
            }
        }
    }

    async retryFilter(filter, data, traceId, workerId) {
        let attempt = 0;
        const filterName = filter.constructor.name;

        while (attempt < this.maxRetries) {
            try {
                const dataClone = JSON.parse(JSON.stringify(data));
                return await filter.execute(dataClone);
            } catch (err) {
                attempt++;
                if (attempt < this.maxRetries) {
                    console.warn(`[Pipeline] [${traceId}] [Worker-${workerId}] Retry ${attempt}/${this.maxRetries} at ${filterName}: ${err.message}`);
                }

                if (attempt >= this.maxRetries) throw err;
                await new Promise(r => setTimeout(r, 50 * attempt));
            }
        }
    }

    // Xử lý lỗi, Rollback và Ghi DLQ
    async handleFailure(job, originalError, traceId, failedStage) {
        console.error(`[Pipeline] [${traceId}] FAILED at [${failedStage}]. Triggering SAGA...`);
        console.error(`   Reason: ${originalError.message}`);

        let rollbackStatus = "SUCCESS";

        // 1. Chạy Saga Rollback
        for (const rollbackFilter of this.rollbackFilters) {
            try {
                await rollbackFilter.execute(job.data);
            } catch (err) {
                console.error(`[Pipeline] [${traceId}] Rollback Error: ${err.message}`);
                rollbackStatus = "PARTIAL_FAILED"; // Đánh dấu nếu rollback cũng lỗi
            }
        }

        // 2. GHI VÀO DLQ (Dead Letter Queue)
        try {
            await DLQ.create({
                traceId: traceId,
                inputPayload: job.data.input, // Lưu lại input gốc
                failedAtStep: failedStage,    // Lỗi ở bước nào
                errorReason: originalError.message,
                stepsCompleted: job.history || [], // Nó đã đi qua những đâu
                rollbackStatus: rollbackStatus
            });
            console.log(`[Pipeline] [${traceId}] Saved to DLQ [MongoDB]`);
        } catch (dlqError) {
            console.error(`!!! CRITICAL: Failed to save to DLQ: ${dlqError.message}`);
        }

        this.finalizeJob(job, false, originalError);
    }

    finalizeJob(job, success, error = null) {
        const resolver = this.pendingRequests.get(job.id);
        if (resolver) {
            if (success) resolver.resolve(job.data);
            else resolver.reject(error);
            this.pendingRequests.delete(job.id);
        }
    }

    addJob(data) {
        return new Promise((resolve, reject) => {
            const jobId = `JOB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.pendingRequests.set(jobId, { resolve, reject });

            // Khởi tạo history rỗng
            const jobPayload = {
                id: jobId,
                data: data,
                history: []
            };

            this.queues[0].push(jobPayload);
        });
    }
}
const pipelineInstance = new PipelineQueue();

module.exports = pipelineInstance;