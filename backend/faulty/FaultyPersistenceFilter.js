const PersistenceFilter = require('../pipeline/PersistenceFilter');
const chaosManager = require('../utils/ChaosManager');

class FaultyPersistenceFilter extends PersistenceFilter {
    async execute(data) {
        const behavior = data.input.behavior || 'SUCCESS';
        if (chaosManager.shouldThrowError(data.traceId, 'PersistenceFilter', behavior)) {
            throw new Error("Simulated Database Deadlock");
        }
        return super.execute(data);
    }
}
module.exports = FaultyPersistenceFilter;