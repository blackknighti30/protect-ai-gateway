'use strict';

const ReolinkTransport = require('./reolink-transport');
const ReolinkSession = require('./reolink-session');
const DEFAULTS = Object.freeze({
    port: 80,
    channel: 0,
    timeoutMs: 5000
});

/**
 * Shared Reolink HTTP/API client.
 *
 * This class owns high-level Reolink CGI commands. HTTP transport and
 * authenticated session state are delegated to focused collaborators. Camera
 * capabilities such as PTZ, presets, and events remain in their dedicated
 * controllers.
 */
class ReolinkClient {
    constructor(logger, config) {
        this.logger = logger;
        this.config = { ...DEFAULTS, ...(config || {}) };
        this.validateConfig();
        this.transport = new ReolinkTransport(this.config);
        this.session = new ReolinkSession(this.transport, this.config);
    }

    validateConfig() {
        const required = ['host', 'username', 'password'];
        const missing = required.filter(key =>
            this.config[key] === undefined ||
            this.config[key] === null ||
            this.config[key] === ''
        );

        if (missing.length > 0) {
            throw new Error(
                `Reolink configuration missing required field(s): ${missing.join(', ')}`
            );
        }

        for (const key of ['port', 'channel', 'timeoutMs']) {
            const value = Number(this.config[key]);

            if (!Number.isFinite(value))
                throw new Error(`Reolink configuration field ${key} must be numeric`);

            this.config[key] = value;
        }

        if (this.config.port < 1 || this.config.port > 65535)
            throw new Error('Reolink configuration field port must be between 1 and 65535');
        if (this.config.channel < 0)
            throw new Error('Reolink configuration field channel must be zero or greater');
        if (this.config.timeoutMs < 1)
            throw new Error('Reolink configuration field timeoutMs must be greater than zero');
    }

    request(path, body) {
        return this.transport.requestJson(path, body);
    }


    async login(force = false) {
        return this.session.getToken(force);
    }

    isExpiredToken(result) {
        return this.session.isExpiredToken(result);
    }


    async sendApiCommand(cmd, param) {
        const send = async token => {
            const payload = [{
                cmd,
                action: 0,
                param
            }];

            return this.request(
                `/cgi-bin/api.cgi?cmd=${encodeURIComponent(cmd)}&token=${encodeURIComponent(token)}`,
                payload
            );
        };

        let token = await this.login();
        let response = await send(token);
        let result = response && response[0];

        if (this.isExpiredToken(result)) {
            this.session.invalidate();
            token = await this.login(true);
            response = await send(token);
            result = response && response[0];
        }

        if (!result || result.code !== 0)
            throw new Error(`Reolink API command ${cmd} failed`);

        return result.value || {};
    }

    async getSnapshot(channel = this.config.channel) {
        const token = await this.login();
        const query = new URLSearchParams({
            cmd: 'Snap',
            channel: String(Number(channel)),
            rs: String(Date.now()),
            token
        });

        return this.transport.requestJpeg({
            hostname: this.config.host,
            port: this.config.port,
            path: `/cgi-bin/api.cgi?${query.toString()}`,
            method: 'GET',
            headers: {
                Accept: 'image/jpeg,image/*;q=0.9,*/*;q=0.1',
                'Cache-Control': 'no-cache'
            }
        });
    }

    async getMotionState(channel = this.config.channel) {
        return this.sendApiCommand('GetMdState', {
            channel: Number(channel)
        });
    }

    async getAiState(channel = this.config.channel) {
        return this.sendApiCommand('GetAiState', {
            channel: Number(channel)
        });
    }

    async sendPtzCommand(op, speed) {
        await this.sendApiCommand('PtzCtrl', {
            channel: this.config.channel,
            op,
            ...(speed === undefined ? {} : { speed })
        });

        this.logger.debug(`PTZ: Reolink command ${op} accepted`);
    }
}

module.exports = ReolinkClient;
