/**
 * Creates new Transition instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {Action} action
 * @param {Object} data
 * @param {String} target
 * @param {Boolean} cycle
 * @class
 */
var Transition = function(action, data, target, cycle) {
	data = data || {};
	this.editor = action.editor;
	this.canvas = this.editor.canvas;
	this.action = action;
	this.data = data;
	this.target = target;
	this.cycle = cycle;
	this.label = data.label || action.id;
	this.color = data.color || '#000';
};

/**
 * Is given point on this transition's curve?
 *
 * @param {Point} point - mouse click position
 * @returns {Boolean}
 */
Transition.prototype.contains = function(point) {
	var points = 'points' in this.path ? this.path.points : this.path;

	if (!this.cycle && 0) { // todo
		return false;
	}

	// divide spline into straight line segments
	var lines = []; // lines to check
	if (points.length === 2) { // straight line
		lines.push(new Line(points[0], points[1]));
	} else if ('cps' in this.path) { // cubic bezier line - divide curve into straight line segments
		var cps = this.path.cps;
		lines = lines.concat(this._segmentize(points, cps));
		if (cps.length > 2) { // cycle has 2 extra points, add lines from the other side of path
			lines = lines.concat(this._segmentize(points.reverse(), cps.reverse()));
		}
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
 * Divides bezier curve to segments
 *
 * @param {Array} points
 * @param {Array} cps
 * @returns {Array}
 * @private
 */
Transition.prototype._segmentize = function(points, cps) {
	var lines = [];
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

	return lines;
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
		from.x -= 1; // correction
		this.path = this.canvas.drawCycleConnection(this.label, from, new Point(to.x - w, to.y), index[key]++, this.color, this.isActive());
	} else {
		var bidirectional = states[this.target].isConnected(s);
		if (bidirectional) {
			var from = states[s].center();
			from.id = s;
			var to = states[this.target].center();
			to.id = this.target;
		}
		this.path = this.canvas.drawConnection(this.label, from, to, index[key]++, this.color, bidirectional, this.isActive());
	}
};
