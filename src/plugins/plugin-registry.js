'use strict';

const {
    validatePluginModule
} = require('./plugin-contracts');

class PluginRegistry {
    constructor(context = {}) {
        this.context = Object.freeze({ ...context });
        this.plugins = new Map();
        this.instances = new Map();
    }

    register(pluginModule) {
        const plugin = validatePluginModule(pluginModule);
        const { id } = plugin.manifest;

        if (this.plugins.has(id))
            throw new Error(`plugin is already registered: ${id}`);

        this.plugins.set(id, plugin);
        return plugin.manifest;
    }

    has(id) {
        return this.plugins.has(id);
    }

    getManifest(id) {
        const plugin = this.plugins.get(id);
        return plugin ? plugin.manifest : null;
    }

    list(kind) {
        const manifests = [...this.plugins.values()]
            .map(plugin => plugin.manifest)
            .filter(manifest => kind === undefined || manifest.kind === kind)
            .sort((left, right) => left.id.localeCompare(right.id));

        return manifests;
    }

    async start(id, config = {}) {
        const plugin = this.plugins.get(id);
        if (!plugin)
            throw new Error(`plugin is not registered: ${id}`);

        if (this.instances.has(id))
            throw new Error(`plugin is already started: ${id}`);

        const instance = await plugin.create(Object.freeze({
            ...this.context,
            plugin: plugin.manifest,
            config
        }));

        if (!instance || typeof instance !== 'object')
            throw new TypeError(`plugin ${id} create() must return an object`);

        if (typeof instance.start === 'function')
            await instance.start();

        this.instances.set(id, instance);
        return instance;
    }

    async stop(id) {
        const instance = this.instances.get(id);
        if (!instance)
            return false;

        try {
            if (typeof instance.stop === 'function')
                await instance.stop();
            else if (typeof instance.close === 'function')
                await instance.close();
        } finally {
            this.instances.delete(id);
        }

        return true;
    }

    async close() {
        const ids = [...this.instances.keys()].reverse();
        const errors = [];

        for (const id of ids) {
            try {
                await this.stop(id);
            } catch (error) {
                errors.push(error);
            }
        }

        if (errors.length > 0)
            throw new AggregateError(errors, 'one or more plugins failed to stop');
    }
}

module.exports = PluginRegistry;
