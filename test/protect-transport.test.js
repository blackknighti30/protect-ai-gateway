'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
    ProtectCertificateStore,
    ProtectTransport,
    decodeFrames,
    encodeClientFrame,
    websocketAccept
} = require('../src/transports/protect');

test('computes the RFC 6455 accept value', () => {
    assert.equal(
        websocketAccept('dGhlIHNhbXBsZSBub25jZQ=='),
        's3pPLMBiTxaQ9kYGzzhZRbK+xOo='
    );
});

test('encodes masked client text frames and decodes them', () => {
    const frame = encodeClientFrame('hello', 0x1, Buffer.from([1, 2, 3, 4]));
    assert.equal(Boolean(frame[1] & 0x80), true);
    const decoded = decodeFrames(frame);
    assert.equal(decoded.remainder.length, 0);
    assert.equal(decoded.frames.length, 1);
    assert.equal(decoded.frames[0].opcode, 0x1);
    assert.equal(decoded.frames[0].payload.toString(), 'hello');
});

test('supports extended WebSocket frame lengths', () => {
    for (const length of [126, 70000]) {
        const payload = Buffer.alloc(length, 0x61);
        const decoded = decodeFrames(encodeClientFrame(payload, 0x2, Buffer.alloc(4)));
        assert.equal(decoded.frames[0].payload.length, length);
        assert.equal(decoded.frames[0].payload.equals(payload), true);
    }
});

test('loads Protect credentials from buffers and files', async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'protect-cert-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const certPath = path.join(directory, 'client.crt');
    const keyPath = path.join(directory, 'client.key');
    await fs.writeFile(certPath, 'CERT');
    await fs.writeFile(keyPath, 'KEY');

    const loaded = await new ProtectCertificateStore({
        certPath,
        keyPath,
        ca: Buffer.from('CA')
    }).load();
    assert.equal(loaded.cert.toString(), 'CERT');
    assert.equal(loaded.key.toString(), 'KEY');
    assert.equal(loaded.ca.toString(), 'CA');
});

test('connects once and sends JSON envelopes through secure_transfer', async () => {
    const calls = [];
    const socket = {
        connected: false,
        on() {},
        async connect() { this.connected = true; calls.push('connect'); },
        async sendText(text) { calls.push(['send', text]); },
        async close() { this.connected = false; calls.push('close'); }
    };
    const transport = new ProtectTransport({ host: 'protect.local' }, {
        certificateStore: { async load() {
            return { cert: Buffer.from('CERT'), key: Buffer.from('KEY') };
        } },
        createWebSocket(options) {
            calls.push(['options', options]);
            return socket;
        }
    });

    const envelope = { function_name: 'EventSmartDetect', payload: { eventId: 1 } };
    await transport.send(envelope);
    await transport.send(envelope);
    await transport.close();

    assert.equal(calls.filter(call => call === 'connect').length, 1);
    assert.equal(calls[0][0], 'options');
    assert.equal(calls[0][1].protocol, 'secure_transfer');
    assert.equal(calls[0][1].path, '/camera/1.0/ws');
    assert.deepEqual(JSON.parse(calls[2][1]), envelope);
    assert.equal(calls.at(-1), 'close');
});
