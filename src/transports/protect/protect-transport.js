'use strict';

const { ProtectCertificateStore } = require('./certificate-store');
const { SecureWebSocket } = require('./secure-websocket');

class ProtectTransport {
    constructor(config = {}, dependencies = {}) {
        if (!config.host) throw new TypeError('Protect transport host is required');
        this.config = config;
        this.logger = dependencies.logger || { debug() {}, info() {}, error() {} };
        this.certificateStore = dependencies.certificateStore ||
            new ProtectCertificateStore(config.tls || config);
        this.createWebSocket = dependencies.createWebSocket ||
            (options => new SecureWebSocket(options));
        this.webSocket = null;
        this.connectPromise = null;
    }

    async connect() {
        if (this.webSocket?.connected) return;
        if (this.connectPromise) return this.connectPromise;
        this.connectPromise = this.#connect();
        try {
            await this.connectPromise;
        } finally {
            this.connectPromise = null;
        }
    }

    async #connect() {
        const credentials = await this.certificateStore.load();
        const webSocket = this.createWebSocket({
            host: this.config.host,
            port: this.config.port || 7442,
            path: this.config.path || '/camera/1.0/ws',
            protocol: 'secure_transfer',
            servername: this.config.servername,
            rejectUnauthorized: this.config.rejectUnauthorized !== false,
            handshakeTimeoutMs: this.config.handshakeTimeoutMs || 10000,
            ...credentials
        });
        webSocket.on?.('message', message => this.logger.debug?.('Protect transport message', { message }));
        webSocket.on?.('error', error => this.logger.error?.('Protect transport error', { error }));
        webSocket.on?.('close', () => this.logger.info?.('Protect transport disconnected'));
        await webSocket.connect();
        this.webSocket = webSocket;
        this.logger.info?.('Protect transport connected', {
            host: this.config.host,
            port: this.config.port || 7442,
            path: this.config.path || '/camera/1.0/ws'
        });
    }

    async send(envelope) {
        await this.connect();
        await this.webSocket.sendText(JSON.stringify(envelope));
    }

    async close() {
        const webSocket = this.webSocket;
        this.webSocket = null;
        this.connectPromise = null;
        await webSocket?.close();
    }
}

module.exports = ProtectTransport;
