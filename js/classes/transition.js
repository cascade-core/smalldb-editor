/**
 * Creates new Transition instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {Action} action
 * @param {Object} data
 * @param {String} target
 * @class
 */
var Transition = function(action, data, target) {
	data = data || {};
	this.editor = action.editor;
	this.canvas = this.editor.canvas;
	this.action = action;
	this.data = data;
	this.target = target;
	this.label = data.label || action.id;
	this.color = data.color || '#000';
};

/**
 * Sets path information for this transition
 *
 * @param {Spline|Array} path - spline object or simple array or points
 * @param {Boolean} [cycle] - defaults to false
 * @param {Boolean} [bidirectional] - defaults to false
 */
Transition.prototype.setPath = function(path, cycle, bidirectional) {
	this.path = path;
	this.cycle = cycle || false;
	this.bidirectional = bidirectional || false;
};

/**
 * Is given point on this transition's curve?
 *
 * @param {Point} point - mouse click position
 * @returns {Boolean}
 */
Transition.prototype.contains = function(point) {
	var points = 'points' in this.path ? this.path.points : this.path;
	var offset = 5; // px to both sides from line
	if (points.length === 2) { // straight line
		if (new Line(points[0], points[1]).dist(point) < offset) {
			return true;
		}
	}
	return false;
};

/**
 * Activates current transition
 */
Transition.prototype.activate = function() {
	this._active = true;
	this.editor.editor.create('edge', this);
	this.canvas.redraw();
};

/**
 * Deactivates current state
 */
Transition.prototype.deactivate = function() {
	this._active = false;
	this.canvas.redraw();
};

/**
 * Is current transition selected?
 *
 * @returns {Boolean}
 */
Transition.prototype.isActive = function() {
	return !!this._active; // cast as bool
};

/**
 * Renders transition to canvas
 *
 * @param {Array} states
 * @param {Object} index - how many same connections did we rendered, stored by key "{source.id}-{target.id}"
 * @param {String} id - source id
 */
Transition.prototype.render = function(states, index, id) {
	var s = id.split('-')[0];
	if (this.target === '') {
		this.target = '__end__';
	}
	var from = states[s].getBorderPoint(states[this.target].center());
	var to = states[this.target].getBorderPoint(states[s].center());
	var key = from.toString() + '-' + to.toString();
	if (!index[key]) {
		index[key] = 1;
	}
	if (s === this.target) {
		var w = states[s].$container.outerWidth();
		this.setPath([from, new Point(to.x - w, to.y)], true);
		this.canvas.drawCycleConnection(this.label, from, new Point(to.x - w, to.y), index[key]++, this.color);
	} else {
		var bidirectional = states[this.target].isConnected(s);
		if (bidirectional) {
			var from = states[s].center();
			from.id = s;
			var to = states[this.target].center();
			to.id = this.target;
		}
		var path = this.canvas.drawConnection(this.label, from, to, index[key]++, this.color, bidirectional, this.isActive());
		this.setPath(path, false, bidirectional);
	}
};
