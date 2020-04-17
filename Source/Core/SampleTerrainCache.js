define([
        './Cache',
    ], function (
        Cache
    ) {
    'use strict';

    /**
     * @param {number} maxSize
     * @constructor
     */
    function SampleTerrainCache(maxSize) {
        this._maxSize = maxSize || 100;
        /** @type {Array<TerrainProvider>} */
        this._providers = [];
        /** @type {Array<Cache>} */
        this._caches = [];
    }

    SampleTerrainCache.prototype.add = function(request, item) {
        const index = this._providers.indexOf(request.terrainProvider);
        let cache;
        if (index === -1) {
            this._providers.push(request.terrainProvider);
            cache = new Cache(this._maxSize);
            this._caches.push(cache);
        } else {
            cache = this._caches[index];
        }
        cache.add(request.key, item);
    };

    SampleTerrainCache.prototype.get = function(request) {
        const index = this._providers.indexOf(request.terrainProvider);
        if (index > -1) {
            return this._caches[index].get(request.key);
        }
    };

    SampleTerrainCache.prototype.has = function(request) {
        const index = this._providers.indexOf(request.terrainProvider);
        if (index > -1) {
            return this._caches[index].has(request.key);
        }
    };

    SampleTerrainCache.prototype.setMaxSize = function(maxSize) {
        this._maxSize = maxSize;
        const length = this._caches.length;
        for (let i = 0; i < length; i++) {
            this._caches[i].setMaxSize(maxSize);
        }
    };

    /**
     * @exports TerrainCache
     * @type {SampleTerrainCache}
     */
    var sampleTerrainCache = new SampleTerrainCache(100);
    return sampleTerrainCache;
});
