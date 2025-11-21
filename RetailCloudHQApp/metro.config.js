const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

console.log('🏗️  Loading Metro Config...');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
    maxWorkers: 1,
    projectRoot: __dirname,
    watchFolders: [path.resolve(__dirname, '..')],
    resolver: {
        unstable_enableSymlinks: true,
        blockList: [
            // Exclude backend and frontend directories to prevent Metro from crawling them
            new RegExp(`^${path.resolve(__dirname, '../backend')}($|/)`),
            new RegExp(`^${path.resolve(__dirname, '../frontend')}($|/)`),
        ],
    },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
