'use strict';

const ProtectOutputPlugin = require('./protect-output-plugin');
const mapper = require('./protect-event-mapper');

const manifest = Object.freeze({
    apiVersion: '1',
    kind: 'output',
    name: 'protect',
    version: '0.1.0'
});

function create(context, config) {
    return new ProtectOutputPlugin(context, config);
}

module.exports = {
    manifest,
    create,
    ProtectOutputPlugin,
    ...mapper
};
