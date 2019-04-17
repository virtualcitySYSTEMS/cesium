    /**
     * A queue that can enqueue items at the end, and dequeue items from the front.
     * @alias Queue
     * @constructor
     */
    function Cache(maxSize) {
        /** @type {number} */
        this._maxSize = maxSize;
        /** @type {Array<string>} */
        this._array = new Array(maxSize);
        /** @type {number} */
        this._index = 0;
        /** @type {Object} */
        this._map = {};
        /** @type {boolean} */
        this._full = false;
    }

    /**
     * adds an Item to the cache
     * @param {string} key
     * @param {Object} item The item to add.
     */
    Cache.prototype.add = function(key, item) {
        if (this.has(key)){
           this._map[key] = item;
           return;
        }
        if (this._index === this._maxSize) {
            this._full = true;
            this._index = 0;
        }
        if (this._full) {
            delete this._map[this._array[this._index]];
        }
        this._array[this._index] = key;
        this._map[key] = item;
        this._index += 1;
    };

    /**
     * returns an Item from the Cache if it exists.
     * @returns {Object|undefined}
     */
    Cache.prototype.get = function(key) {
        return this._map[key];
    };

    /**
     * returns an Item from the Cache if it exists.
     * @returns {boolean}
     */
    Cache.prototype.has = function(key) {
        return !!this._map[key];
    };

    /**
     * @param {number} maxSize
     */
    Cache.prototype.setMaxSize = function(maxSize) {
        /** @type {number} */
        this._maxSize = maxSize;
        /** @type {Array<string>} */
        this._array = new Array(maxSize);
        /** @type {number} */
        this._index = 0;
        /** @type {Object} */
        this._map = {};
        /** @type {boolean} */
        this._full = false;
    };
export default Cache;
