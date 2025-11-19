'use strict';

class CookieManager {
    constructor(logger) {
        this.logger = logger; // Může být null
        this.cookie = null;
        this.lastUpdate = null;

        // Debug log pouze pokud máme logger
        if (this.logger) {
            this.logger.debug('CookieManager inicializován');
        }
    }

    async getCookie(baseUrl) {
        const maxRetries = 3;
        let attempt = 0;

        // Headers shodné s API pro konzistenci a prevenci blokování
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
                if (this.isValidCookie()) {
                    this.logger.debug('Použita existující platná cookie:', {
                        cookie: this.cookie,
                        lastUpdate: new Date(this.lastUpdate).toISOString(),
                        age: Math.round((Date.now() - this.lastUpdate) / 1000) + 's'
                    });
                    return this.cookie;
                }

                this.logger.debug(`Získávám novou cookie z URL (pokus ${attempt + 1}/${maxRetries}):`, `${baseUrl}/battery_management/settings`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                let response;
                try {
                    response = await fetch(`${baseUrl}/battery_management/settings`, {
                        method: 'GET',
                        headers: headers,
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

                this.logger.debug('Odpověď serveru:', {
                    status: response.status,
                    headers: responseHeaders,
                    cookies: cookies
                });

                if (!cookies || cookies.length === 0) {
                    throw new Error('Žádné cookie nebyly získány');
                }

                this.cookie = cookies[0].split(';')[0].replace('session=', '');
                this.lastUpdate = Date.now();

                this.logger.debug('Nastavena nová cookie:', {
                    cookie: this.cookie,
                    timestamp: new Date(this.lastUpdate).toISOString()
                });

                return this.cookie;

            } catch (error) {
                const isLastAttempt = attempt === maxRetries - 1;
                const logMethod = isLastAttempt ? 'error' : 'debug';

                this.logger[logMethod](`Chyba při získávání cookie (pokus ${attempt + 1}/${maxRetries}):`, {
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

    isValidCookie() {
        const COOKIE_VALIDITY = 3600000; // 1 hodina
        const isValid = this.cookie && this.lastUpdate &&
            (Date.now() - this.lastUpdate) < COOKIE_VALIDITY;

        this.logger.debug('Kontrola platnosti cookie:', {
            cookie: this.cookie,
            lastUpdate: this.lastUpdate ? new Date(this.lastUpdate).toISOString() : null,
            age: this.lastUpdate ? Math.round((Date.now() - this.lastUpdate) / 1000) + 's' : 'N/A',
            isValid
        });

        return isValid;
    }

    clearCookie() {
        const oldCookie = this.cookie;
        this.cookie = null;
        this.lastUpdate = null;
        this.logger.debug('Cookie vymazána:', { oldCookie });
    }
}

module.exports = CookieManager;