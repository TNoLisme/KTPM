class BaseFilter {
    /**
     * Hàm xử lý chính
     * @param {Object} data - Dữ liệu đầu vào (Job Data)
     * @returns {Object} - Dữ liệu đầu ra để chuyển sang bước tiếp theo
     */
    async execute(data) {
        throw new Error("Method 'execute' must be implemented.");
    }
}
module.exports = BaseFilter;