/**
 * Creates new Transition instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {Action} action
 * @param {Object} data
 * @param {String} source
 * @param {String} target
 * @class
 */
var Transition = function(action, data, source, target) {
	data = data || {};
	this.editor = action.editor;
	this.canvas = this.editor.canvas;
	this.action = action;
	this.data = data;
	this.source = source;
	this.target = target;
	this.cycle = source.split('-')[0] === target.split('-')[0];
	this.label = 'label' in data ? data.label : action.id;
	if ('dagrePath' in data) {
		var path = [];
		for (var p in data.dagrePath) {
			path[p] = new Point(data.dagrePath[p].x, data.dagrePath[p].y);
		}
		this.dagrePath = path;
	}
	this.color = data.color || action.color || '#000000';
};

/**
 * Is given point on this transition's curve?
 *
 * @param {Point} point - mouse click position
 * @returns {Boolean}
 */
Transition.prototype.contains = function(point) {
	if (!this.path) {
		return false;
	}

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
			points.reverse();
			cps.reverse();
			if (points.length === 6) { // add line segment in the middle
				lines.push(new Line(points[2], points[3]));
			} else if (points.length > 6) { // find segments in the middle
				lines = lines.concat(this._segmentize(points.slice(3), cps.slice(2)));
			}
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
 * Divides bezier curve to segments, uses first 3 points + 2 control points
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
	// bind keydown event to catch delete key
	// todo
};

/**
 * Deactivates current transition
 */
Transition.prototype.deactivate = function() {
	this._active = false;
	this.canvas.redraw();
	// unbind keydown event
	// todo
};

/**
 * Removes this transition
 */
Transition.prototype.remove = function() {
	this.action.removeTransition(this);
	this.editor.states[this.source.split('-')[0]].removeConnection(this.target);
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
 * Attach this transition to different action
 *
 * @param {Action} action
 */
Transition.prototype.setAction = function(action) {
	if (this.label === '' || this.label === this.action.label) {
		this.label = action.label;
	}
	if (this.color === '' || this.color === this.action.color) {
		this.color = action.color;
	}
	this.action.removeTransition(this);
	this.action = action;
	this.action.addTransition(this.source, this);
	this.canvas.redraw();
};

/**
 * Renders transition to canvas
 *
 * @param {Array} states
 * @param {Object} index - how many same connections did we rendered, stored by key "{source.id}-{target.id}"
 */
Transition.prototype.render = function(states, index) {
	var s = this.source.split('-')[0];
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
		if (this.dagrePath && 'dagre' in window) {
			this._renderDagrePath(states, s, index[key], false, true);
			return;
		}
		var w = states[s].$container.outerWidth();
		from.x -= 1; // correction
		this.path = this.canvas.drawCycleConnection(this.label, from, new Point(to.x - w, to.y), index[key]++, this.color, this.isActive());
	} else {
		var bidirectional = states[this.target].isConnected(s);
		if (this.dagrePath && 'dagre' in window) {
			this._renderDagrePath(states, s, index[key], bidirectional);
			return;
		}
		if (bidirectional) {
			var from = states[s].center();
			from.id = s;
			var to = states[this.target].center();
			to.id = this.target;
		}
		this.path = this.canvas.drawConnection(this.label, from, to, index[key]++, this.color, bidirectional, this.isActive());
	}
};

/**
 * Renders path computed by dagre
 *
 * @param {Object} states
 * @param {String} s
 * @param {Object} index
 * @param {Boolean} bidirectional
 * @param {Boolean} cycle
 * @private
 */
Transition.prototype._renderDagrePath = function(states, s, index, bidirectional, cycle) {
	// render dagre path if available, adjust start and end points
	var p = this.dagrePath;
	this.dagrePath[0] = states[s].getBorderPoint(p[1]);
	this.dagrePath[p.length - 1] = states[this.target].getBorderPoint(p[p.length - 2]);
	this.path = this.canvas.drawDagreConnection(this.label, this.dagrePath, index, cycle, this.color, this.isActive());
};

/**
 * Serializes current transition to JSON object
 *
 * @returns {Object}
 */
Transition.prototype.serialize = function() {
	var T = {
		label: this.label,
		color: this.color,
		targets: [this.target === '__end__' ? '' : this.target]
	};
	if (this.dagrePath) {
		T.dagrePath = this.dagrePath;
	}
	for (var t in this.data) {
		if (['label', 'color', 'targets'].indexOf(t) === -1) {
			T[t] = this.data[t];
		}
	}
	return T;
};
