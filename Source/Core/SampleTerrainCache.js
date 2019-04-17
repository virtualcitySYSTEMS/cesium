define([
        './Cache',
    ], function (
        Cache
    ) {
    'use strict';
    /**
     * @exports TerrainCache
     * @type {Cache}
     */
    var SampleTerrainCache = new Cache(100);
    return SampleTerrainCache;
});
