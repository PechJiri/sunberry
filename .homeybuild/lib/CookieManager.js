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
        try {
            if (this.isValidCookie()) {
                this.logger.debug('Použita existující platná cookie:', {
                    cookie: this.cookie,
                    lastUpdate: new Date(this.lastUpdate).toISOString(),
                    age: Math.round((Date.now() - this.lastUpdate) / 1000) + 's'
                });
                return this.cookie;
            }

            this.logger.debug('Získávám novou cookie z URL:', `${baseUrl}/battery_management/settings`);

            const response = await fetch(`${baseUrl}/battery_management/settings`, {
                method: 'GET',
                redirect: 'manual'
            });

            const headers = {};
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });

            // Fetch API handles Set-Cookie differently, we need to access it carefully
            // In Node.js fetch, headers.getSetCookie() is available in newer versions or we can try get('set-cookie')
            let cookies = [];
            if (typeof response.headers.getSetCookie === 'function') {
                cookies = response.headers.getSetCookie();
            } else {
                // Fallback or if getSetCookie is not available (though it should be in Node 22)
                const setCookieHeader = response.headers.get('set-cookie');
                if (setCookieHeader) {
                    cookies = [setCookieHeader]; // This might be comma separated if multiple, but usually we just need one session
                }
            }

            this.logger.debug('Odpověď serveru:', {
                status: response.status,
                headers: headers,
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
            this.logger.error('Chyba při získávání cookie:', {
                error: error.message,
                stack: error.stack,
                response: error.response?.status,
                headers: error.response?.headers
            });
            throw error;
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