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

	// check whether points lies in transition bounding box
	if (0) {
		return false;
	}

	// divide spline into straight line segments
	var lines = []; // lines to check
	if (points.length === 2) { // straight line
		lines.push(new Line(points[0], points[1]));
	} else if ('cps' in this.path) { // cubic bezier line - 3 points with 2 control points - divide curve into 4 segments
		var cps = this.path.cps;

		// segment 1
		var l1 = new Line(points[0], cps[0]);
		l1.to = l1.middle();
		lines.push(l1);

		// segment 2
		var l2 = new Line(l1.to, points[1]);
		lines.push(l2);

		// segment 3 & 4
		var l4 = new Line(cps[1], points[2]);
		l4.from = l4.middle();
		var l3 = new Line(l2.to, l4.from);
		lines.push(l3);
		lines.push(l4);
	}

	// check each segment line
	var offset = this.editor.options.edgeClickOffset; // px to both sides from line
	for (var l in lines) {
		if (lines[l].dist(point) < offset) {
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
