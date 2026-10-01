'use strict';

const REQUEST_TIMEOUT_MS = 10000;

async function withSunberryResponse(fetchImpl, url, options, handleResponse) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;

    try {
        response = await fetchImpl(url, { ...options, signal: controller.signal });
        return await handleResponse(response);
    } finally {
        try {
            // Unread bodies can pause Undici's parser when the peer closes the socket.
            if (response?.body && !response.bodyUsed) {
                let onAbort;
                const aborted = new Promise(resolve => {
                    onAbort = resolve;
                    if (controller.signal.aborted) resolve();
                    else controller.signal.addEventListener('abort', onAbort, { once: true });
                });
                try {
                    // Cancellation must not hold the request past its abort deadline.
                    await Promise.race([response.body.cancel(), aborted]);
                } finally {
                    controller.signal.removeEventListener('abort', onAbort);
                }
            }
        } catch (error) {
            // Abort the transport if cancellation fails, preserving the request's result/error.
            controller.abort();
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

module.exports = { withSunberryResponse };
