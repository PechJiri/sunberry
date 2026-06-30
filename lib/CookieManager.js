'use strict';

class CookieManager {
    constructor(logger) {
        this.logger = logger || {
            debug: () => {},
            error: () => {}
        };
        this.cookie = null;
        this.lastUpdate = null;
        this.cookiePath = null;

        this.logger.debug('CookieManager initialized');
    }

    async getCookie(baseUrl, cookiePath = '/battery_management/settings') {
        const maxRetries = 3;
        const normalizedCookiePath = cookiePath.startsWith('/') ? cookiePath : `/${cookiePath}`;
        let attempt = 0;

        const headers = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Cache-Control': 'max-age=0',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0',
            'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
            'Connection': 'close'
        };

        while (attempt < maxRetries) {
            try {
                if (this.isValidCookie(normalizedCookiePath)) {
                    this.logger.debug('Using existing valid cookie:', {
                        cookie: this.maskCookie(this.cookie),
                        lastUpdate: new Date(this.lastUpdate).toISOString(),
                        age: `${Math.round((Date.now() - this.lastUpdate) / 1000)}s`,
                        cookiePath: this.cookiePath
                    });
                    return this.cookie;
                }

                const cookieUrl = `${baseUrl}${normalizedCookiePath}`;
                this.logger.debug(`Getting new cookie from URL (attempt ${attempt + 1}/${maxRetries}):`, {
                    url: cookieUrl
                });

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                let response;
                try {
                    response = await fetch(cookieUrl, {
                        method: 'GET',
                        headers,
                        signal: controller.signal,
                        redirect: 'manual'
                    });
                } finally {
                    clearTimeout(timeoutId);
                }

                const responseHeaders = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });

                let cookies = [];
                if (typeof response.headers.getSetCookie === 'function') {
                    cookies = response.headers.getSetCookie();
                } else {
                    const setCookieHeader = response.headers.get('set-cookie');
                    if (setCookieHeader) {
                        cookies = [setCookieHeader];
                    }
                }

                this.logger.debug('Server response:', {
                    status: response.status,
                    headers: this.sanitizeHeaders(responseHeaders),
                    cookies: cookies.map(cookie => this.maskCookie(cookie))
                });

                if (!cookies || cookies.length === 0) {
                    throw new Error('No cookies were returned');
                }

                this.cookie = cookies[0].split(';')[0].replace('session=', '');
                this.lastUpdate = Date.now();
                this.cookiePath = normalizedCookiePath;

                this.logger.debug('New cookie stored:', {
                    cookie: this.maskCookie(this.cookie),
                    timestamp: new Date(this.lastUpdate).toISOString(),
                    cookiePath: this.cookiePath
                });

                return this.cookie;
            } catch (error) {
                const isLastAttempt = attempt === maxRetries - 1;
                const logMethod = isLastAttempt ? 'error' : 'debug';

                this.logger[logMethod](`Failed to get cookie (attempt ${attempt + 1}/${maxRetries}):`, {
                    message: error.message,
                    cause: error.cause,
                    stack: error.stack
                });

                if (isLastAttempt) {
                    throw error;
                }

                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                attempt++;
            }
        }
    }

    isValidCookie(cookiePath = this.cookiePath) {
        const COOKIE_VALIDITY = 3600000;
        const isValid = this.cookie && this.lastUpdate &&
            this.cookiePath === cookiePath &&
            (Date.now() - this.lastUpdate) < COOKIE_VALIDITY;

        this.logger.debug('Checking cookie validity:', {
            cookie: this.maskCookie(this.cookie),
            lastUpdate: this.lastUpdate ? new Date(this.lastUpdate).toISOString() : null,
            age: this.lastUpdate ? `${Math.round((Date.now() - this.lastUpdate) / 1000)}s` : 'N/A',
            isValid,
            cookiePath: this.cookiePath,
            requestedCookiePath: cookiePath
        });

        return isValid;
    }

    clearCookie() {
        const oldCookie = this.cookie;
        this.cookie = null;
        this.lastUpdate = null;
        this.cookiePath = null;
        this.logger.debug('Cookie cleared:', { oldCookie: this.maskCookie(oldCookie) });
    }

    maskCookie(cookie) {
        return cookie ? '[REDACTED]' : cookie;
    }

    sanitizeHeaders(headers) {
        return Object.fromEntries(Object.entries(headers).map(([key, value]) => {
            return /cookie|authorization|token|session/i.test(key)
                ? [key, '[REDACTED]']
                : [key, value];
        }));
    }
}

module.exports = CookieManager;
