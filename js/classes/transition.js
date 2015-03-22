/**
 * Creates new Transition instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {Action} action
 * @param {Object} data
 * @class
 */
var Transition = function(action, data) {
	this.action = action;
	data = data || {};
	this.data = data;
	this.label = data.label || action.id;
	this.color = data.color || '#000';
};

/**
 * Gets targets of this transition
 *
 * @returns {Array}
 */
Transition.prototype.getTargets = function() {
	if ('targets' in this.data) {
		return this.data.targets;
	}
	return [];
};
