'use strict';

const TOKEN_REFRESH_MARGIN_MS = 30000;
const DEFAULT_LEASE_SECONDS = 3600;

class ReolinkSession {
    constructor(transport, config) {
        this.transport = transport;
        this.config = config;
        this.token = null;
        this.tokenExpiresAt = 0;
    }

    async getToken(force = false) {
        const now = Date.now();

        if (
            !force &&
            this.token &&
            now < this.tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS
        ) {
            return this.token;
        }

        const response = await this.transport.requestJson(
            '/cgi-bin/api.cgi?cmd=Login',
            [{
                cmd: 'Login',
                action: 0,
                param: {
                    User: {
                        userName: this.config.username,
                        password: this.config.password
                    }
                }
            }]
        );

        const result = response && response[0];

        if (
            !result ||
            result.code !== 0 ||
            !result.value ||
            !result.value.Token
        ) {
            throw new Error('Reolink login failed');
        }

        this.token = result.value.Token.name;
        this.tokenExpiresAt =
            now +
            Number(
                result.value.Token.leaseTime || DEFAULT_LEASE_SECONDS
            ) * 1000;

        return this.token;
    }

    invalidate() {
        this.token = null;
        this.tokenExpiresAt = 0;
    }

    isExpiredToken(result) {
        return Boolean(
            result &&
            result.code === 1 &&
            result.error &&
            result.error.rspCode === -6
        );
    }
}

module.exports = ReolinkSession;
