'use strict';

const ReolinkCameraPlugin = require('./reolink-camera-plugin');

const manifest = Object.freeze({
    apiVersion: '1',
    kind: 'camera',
    name: 'reolink',
    version: '0.1.0'
});

function create(context, config) {
    return new ReolinkCameraPlugin(context, config);
}

module.exports = { manifest, create, ReolinkCameraPlugin };
