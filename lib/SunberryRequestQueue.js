'use strict';

const queues = new Map();

function normalizeQueueKey(key) {
    return String(key || '').replace(/\/$/, '');
}

function enqueueByKey(key, task) {
    const queueKey = normalizeQueueKey(key);
    const previous = queues.get(queueKey) || Promise.resolve();

    const next = previous
        .catch(() => {})
        .then(task);

    const tracked = next.catch(() => {}).finally(() => {
        if (queues.get(queueKey) === tracked) {
            queues.delete(queueKey);
        }
    });

    queues.set(queueKey, tracked);

    return next;
}

function getQueueCount() {
    return queues.size;
}

module.exports = {
    enqueueByKey,
    getQueueCount
};
