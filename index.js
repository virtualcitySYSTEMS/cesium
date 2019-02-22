/*eslint-env node,es6*/
'use strict';

var path = require('path');

// If not explicitly in development or test mode, use the combined/minified/optimized version of Cesium
if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    module.exports = require(path.join(__dirname, 'Build/Cesium/Cesium'));
    return;
}

// Otherwise, use un-optimized requirejs modules for improved error checking.
var requirejs = require('requirejs');
requirejs.config({
    paths: {
        'Cesium': path.join(__dirname, 'Source')
    },
    nodeRequire: require
});

module.exports = requirejs('Cesium/Cesium');
