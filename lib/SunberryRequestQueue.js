'use strict';

const queues = new Map();
const lastRequestStartedAtByKey = new Map();
const MIN_REQUEST_GAP_MS = 250;

function normalizeQueueKey(key) {
    return String(key || '').replace(/\/$/, '');
}

function enqueueByKey(key, task) {
    const queueKey = normalizeQueueKey(key);
    const previous = queues.get(queueKey) || Promise.resolve();

    const next = previous
        .catch(() => {})
        .then(async () => {
            await waitForRequestGap(queueKey);
            lastRequestStartedAtByKey.set(queueKey, Date.now());
            return task();
        });

    const tracked = next.catch(() => {}).finally(() => {
        if (queues.get(queueKey) === tracked) {
            queues.delete(queueKey);
            lastRequestStartedAtByKey.delete(queueKey);
        }
    });

    queues.set(queueKey, tracked);

    return next;
}

async function waitForRequestGap(queueKey) {
    const lastStartedAt = lastRequestStartedAtByKey.get(queueKey);
    if (!lastStartedAt) return;

    const waitMs = MIN_REQUEST_GAP_MS - (Date.now() - lastStartedAt);
    if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
    }
}

function getQueueCount() {
    return queues.size;
}

module.exports = {
    MIN_REQUEST_GAP_MS,
    enqueueByKey,
    getQueueCount
};
