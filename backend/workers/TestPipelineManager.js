// backend/workers/TestPipelineManager.js
const PipelineQueue = require('../pipeline/Pipeline'); // Dùng lại core engine cũ

// Import các Faulty Filters
const ValidationFilter = require('../filters/ValidationFilter'); // Validation giữ nguyên k cần lỗi
const FaultyInventoryFilter = require('../filters/faulty/FaultyInventoryFilter');
const FaultyPersistenceFilter = require('../filters/faulty/FaultyPersistenceFilter');
const FaultyPaymentFilter = require('../filters/faulty/FaultyPaymentFilter');

// Import Rollback Filters (Giữ nguyên)
const RollbackInventoryFilter = require('../filters/RollbackInventoryFilter');
const RollbackOrderFilter = require('../filters/RollbackOrderFilter');

// Cấu hình Pipeline
const filters = [
    new ValidationFilter(),
    new FaultyInventoryFilter(),    // Dùng bản lỗi
    new FaultyPersistenceFilter(),  // Dùng bản lỗi
    new FaultyPaymentFilter()       // Dùng bản lỗi
];

const rollbackFilters = [
    new RollbackOrderFilter(),
    new RollbackInventoryFilter()
];

// Cấu hình ít worker thôi để dễ soi log
const workerConfig = {
    ValidationFilter: 2,
    FaultyInventoryFilter: 2,
    FaultyPersistenceFilter: 2,
    FaultyPaymentFilter: 2
};

// Tạo pipeline với maxRetries = 5 (để đảm bảo vượt qua được 2 lần lỗi)
const testPipeline = new PipelineQueue(filters, rollbackFilters, workerConfig, 5);

module.exports = testPipeline;