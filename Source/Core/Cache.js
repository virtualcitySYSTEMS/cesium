    /**
     * A queue that can enqueue items at the end, and dequeue items from the front.
     *
     * @alias Queue
     * @constructor
     */
    function Cache() {
        this._array = [];
    }

    /**
     * adds an Item to the cache
     *
     * @param {Object} item The item to add.
     */
    Cache.prototype.add = function(key, item) {
        this._array.push({key:key,item:item});
    };

    /**
     * returns an Item from the Cache if it exists.
     *
     *
     * @returns {Object}
     */
    Cache.prototype.get = function(key) {
        var index = this._array.findIndex( function(entry) {
            return entry.key === key;
        });
        if (index >= 0) {
            var entry = this._array[index];
            if(index !== this._array.length) {
                this._array.splice(index, 1);
                this._array.push(entry);
            }
            return entry.item;
        }
        return null;
    }

    /**
     * returns an Item from the Cache if it exists.
     *
     *
     * @returns {boolean}
     */
    Cache.prototype.has = function(key) {
        var index = this._array.findIndex( function(item) {
            return item.key === key;
        });
        return index >= 0;
    };


    /**
     * trims cache, only keeps the maxSize Items which have been accessed last.
     * @param {number} maxSize
     */
    Cache.prototype.trim = function(maxSize) {
        if (this._array.length > maxSize) {
            this._array.reverse();
            this._array.splice(maxSize, this._array.length  - maxSize);
            this._array.reverse();
        }
    };
export default Cache;
