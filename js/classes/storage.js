/**
 * Simple storage wrapper
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 * @param {Object} storage
 * @param {string} namespace
 * @class
 */
var Storage = function(storage, namespace) {
	this._storage = storage;
	this._namespace = namespace;
};

/**
 * Gets namespaced key name
 *
 * @param {string} key
 * @returns {string}
 * @private
 */
Storage.prototype._key = function(key) {
	return this._namespace + ':' + key;
};

/**
 * @param {string} key
 * @param {Boolean} json - return JSON object
 * @returns {Object}
 * @private
 */
Storage.prototype.get = function(key, json) {
	var item = this._storage.getItem(this._key(key));
	if (json) {
		return item ? JSON.parse(item) : false;
	}
	return item;
};

/**
 * Sets variable {key} to value {value}
 *
 * @param {string} key
 * @param {mixed} value
 * @param {Boolean} json - save JSON string of {value}
 * @returns {Object}
 */
Storage.prototype.set = function(key, value, json) {
	if (json) {
		value = JSON.stringify(value);
	}
	this._storage.setItem(this._key(key), value);
	return value;
};

/**
 * Resets variable key
 *
 * @param {string} key
 */
Storage.prototype.reset = function(key) {
	this._storage.removeItem(this._key(key));
};
