'use strict';

const crypto = require('node:crypto');
const tls = require('node:tls');
const { EventEmitter } = require('node:events');

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function websocketAccept(key) {
    return crypto.createHash('sha1').update(key + WEBSOCKET_GUID).digest('base64');
}

function encodeClientFrame(payload, opcode = 0x1, maskKey = crypto.randomBytes(4)) {
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const length = body.length;
    let headerLength = 2;
    if (length >= 126 && length <= 0xffff) headerLength += 2;
    else if (length > 0xffff) headerLength += 8;

    const frame = Buffer.allocUnsafe(headerLength + 4 + length);
    frame[0] = 0x80 | (opcode & 0x0f);
    let offset = 2;
    if (length < 126) {
        frame[1] = 0x80 | length;
    } else if (length <= 0xffff) {
        frame[1] = 0x80 | 126;
        frame.writeUInt16BE(length, offset);
        offset += 2;
    } else {
        frame[1] = 0x80 | 127;
        frame.writeBigUInt64BE(BigInt(length), offset);
        offset += 8;
    }
    maskKey.copy(frame, offset);
    offset += 4;
    for (let index = 0; index < length; index++)
        frame[offset + index] = body[index] ^ maskKey[index % 4];
    return frame;
}

function decodeFrames(buffer) {
    const frames = [];
    let offset = 0;
    while (buffer.length - offset >= 2) {
        const first = buffer[offset];
        const second = buffer[offset + 1];
        let length = second & 0x7f;
        let headerLength = 2;
        if (length === 126) {
            if (buffer.length - offset < 4) break;
            length = buffer.readUInt16BE(offset + 2);
            headerLength = 4;
        } else if (length === 127) {
            if (buffer.length - offset < 10) break;
            const bigLength = buffer.readBigUInt64BE(offset + 2);
            if (bigLength > BigInt(Number.MAX_SAFE_INTEGER))
                throw new RangeError('WebSocket frame is too large');
            length = Number(bigLength);
            headerLength = 10;
        }
        const masked = Boolean(second & 0x80);
        const maskLength = masked ? 4 : 0;
        const total = headerLength + maskLength + length;
        if (buffer.length - offset < total) break;
        let payloadOffset = offset + headerLength;
        let mask;
        if (masked) {
            mask = buffer.subarray(payloadOffset, payloadOffset + 4);
            payloadOffset += 4;
        }
        const payload = Buffer.from(buffer.subarray(payloadOffset, payloadOffset + length));
        if (mask) {
            for (let index = 0; index < payload.length; index++)
                payload[index] ^= mask[index % 4];
        }
        frames.push({
            fin: Boolean(first & 0x80),
            opcode: first & 0x0f,
            payload
        });
        offset += total;
    }
    return { frames, remainder: buffer.subarray(offset) };
}

class SecureWebSocket extends EventEmitter {
    constructor(options = {}, dependencies = {}) {
        super();
        if (!options.host) throw new TypeError('Secure WebSocket host is required');
        this.options = {
            port: 7442,
            path: '/camera/1.0/ws',
            protocol: 'secure_transfer',
            rejectUnauthorized: true,
            handshakeTimeoutMs: 10000,
            ...options
        };
        this.connectTls = dependencies.connectTls || tls.connect;
        this.randomBytes = dependencies.randomBytes || crypto.randomBytes;
        this.socket = null;
        this.connected = false;
        this.receiveBuffer = Buffer.alloc(0);
        this.handshakeBuffer = Buffer.alloc(0);
    }

    async connect() {
        if (this.connected) return;
        if (this.socket) throw new Error('Secure WebSocket connection is already in progress');
        const key = this.randomBytes(16).toString('base64');
        const expectedAccept = websocketAccept(key);

        await new Promise((resolve, reject) => {
            let settled = false;
            const socket = this.connectTls({
                host: this.options.host,
                port: this.options.port,
                servername: this.options.servername || this.options.host,
                cert: this.options.cert,
                key: this.options.key,
                ca: this.options.ca,
                rejectUnauthorized: this.options.rejectUnauthorized
            });
            this.socket = socket;
            const timer = setTimeout(() => fail(new Error('Protect WebSocket handshake timed out')),
                this.options.handshakeTimeoutMs);

            const cleanupHandshake = () => {
                clearTimeout(timer);
                socket.off('error', fail);
            };
            const fail = error => {
                if (settled) return;
                settled = true;
                cleanupHandshake();
                this.socket = null;
                socket.destroy?.();
                reject(error);
            };
            const onData = chunk => {
                if (settled) return;
                this.handshakeBuffer = Buffer.concat([this.handshakeBuffer, chunk]);
                const marker = this.handshakeBuffer.indexOf('\r\n\r\n');
                if (marker < 0) return;
                const header = this.handshakeBuffer.subarray(0, marker).toString('utf8');
                const remainder = this.handshakeBuffer.subarray(marker + 4);
                const lines = header.split('\r\n');
                if (!/^HTTP\/1\.1 101\b/.test(lines[0]))
                    return fail(new Error(`Protect WebSocket upgrade failed: ${lines[0]}`));
                const headers = new Map(lines.slice(1).map(line => {
                    const separator = line.indexOf(':');
                    return [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()];
                }));
                if (headers.get('sec-websocket-accept') !== expectedAccept)
                    return fail(new Error('Protect WebSocket returned an invalid accept key'));
                if (this.options.protocol && headers.get('sec-websocket-protocol') !== this.options.protocol)
                    return fail(new Error('Protect WebSocket did not accept secure_transfer'));

                settled = true;
                cleanupHandshake();
                socket.off('data', onData);
                socket.on('data', data => this.#handleData(data));
                socket.on('close', () => this.#handleClose());
                socket.on('error', error => this.emit('error', error));
                this.connected = true;
                this.handshakeBuffer = Buffer.alloc(0);
                if (remainder.length) this.#handleData(remainder);
                resolve();
            };
            socket.on('error', fail);
            socket.on('data', onData);
            socket.once('secureConnect', () => {
                const host = this.options.host.includes(':')
                    ? `[${this.options.host}]:${this.options.port}`
                    : `${this.options.host}:${this.options.port}`;
                const request = [
                    `GET ${this.options.path} HTTP/1.1`,
                    `Host: ${host}`,
                    'Upgrade: websocket',
                    'Connection: Upgrade',
                    `Sec-WebSocket-Key: ${key}`,
                    'Sec-WebSocket-Version: 13',
                    `Sec-WebSocket-Protocol: ${this.options.protocol}`,
                    '', ''
                ].join('\r\n');
                socket.write(request);
            });
        });
    }

    async sendText(text) {
        if (!this.connected || !this.socket)
            throw new Error('Protect WebSocket is not connected');
        const frame = encodeClientFrame(String(text), 0x1, this.randomBytes(4));
        await new Promise((resolve, reject) =>
            this.socket.write(frame, error => error ? reject(error) : resolve()));
    }

    async close(code = 1000, reason = '') {
        if (!this.socket) return;
        const socket = this.socket;
        if (this.connected) {
            const reasonBytes = Buffer.from(reason).subarray(0, 123);
            const payload = Buffer.allocUnsafe(2 + reasonBytes.length);
            payload.writeUInt16BE(code, 0);
            reasonBytes.copy(payload, 2);
            socket.write(encodeClientFrame(payload, 0x8, this.randomBytes(4)));
        }
        this.connected = false;
        this.socket = null;
        socket.end?.();
    }

    #handleData(chunk) {
        this.receiveBuffer = Buffer.concat([this.receiveBuffer, chunk]);
        const decoded = decodeFrames(this.receiveBuffer);
        this.receiveBuffer = decoded.remainder;
        for (const frame of decoded.frames) {
            if (!frame.fin) {
                this.emit('error', new Error('Fragmented Protect WebSocket frames are unsupported'));
                continue;
            }
            if (frame.opcode === 0x1) this.emit('message', frame.payload.toString('utf8'));
            else if (frame.opcode === 0x2) this.emit('binary', frame.payload);
            else if (frame.opcode === 0x8) {
                this.connected = false;
                this.socket?.end?.();
                this.emit('close');
            } else if (frame.opcode === 0x9 && this.socket) {
                this.socket.write(encodeClientFrame(frame.payload, 0xA, this.randomBytes(4)));
            }
        }
    }

    #handleClose() {
        const wasConnected = this.connected;
        this.connected = false;
        this.socket = null;
        if (wasConnected) this.emit('close');
    }
}

module.exports = {
    SecureWebSocket,
    decodeFrames,
    encodeClientFrame,
    websocketAccept
};
