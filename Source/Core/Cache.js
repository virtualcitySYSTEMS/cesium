/**
 * A queue that can enqueue items at the end, and dequeue items from the front.
 * @alias Cache
 * @constructor
 *
 * @param {Number} maxSize the maximum Size of the cache
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
Cache.prototype.add = function (key, item) {
  if (this.has(key)) {
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
 * @param {string} key
 * @returns {Object|undefined}
 */
Cache.prototype.get = function (key) {
  return this._map[key];
};

/**
 * returns an Item from the Cache if it exists.
 * @param {string} key
 * @returns {boolean}
 */
Cache.prototype.has = function (key) {
  return !!this._map[key];
};

/**
 * @param {number} maxSize
 */
Cache.prototype.setMaxSize = function (maxSize) {
  this._maxSize = maxSize;
  this._array = new Array(maxSize);
  this._index = 0;
  this._map = {};
  this._full = false;
};
export default Cache;
