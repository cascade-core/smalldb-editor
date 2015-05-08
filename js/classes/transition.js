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

	// check click on edge label
	var box = this.path.labelBox;
	if (box[0] <= point.x && box[1] <= point.y && box[2] >= point.x && box[3] >= point.y) {
		return true;
	}

	// divide spline into straight line segments
	var lines = []; // lines to check
	if (points.length === 2) { // straight line
		lines.push(new Line(points[0], points[1]));
	} else if (points.length > 2) { // quadratic bezier curve on both sides of path - divide curve into straight line segments
		var cps = this.path.cps;
		var bez = [points[0], cps[0], points[1]];
		var split = this._segmentize(bez);
		var prev = split(0);
		for (var t = 1; t <= 3; t++) {
			var cp = split(t / 3);
			lines = lines.concat(new Line(prev, cp));
			prev = cp;
		}
		var len = points.length;
		bez = [points[len - 1], cps[cps.length - 1], points[len - 2]];
		split = this._segmentize(bez);
		prev = split(0);
		for (var t = 1; t <= 3; t++) {
			var cp = split(t / 3);
			lines = lines.concat(new Line(prev, cp));
			prev = cp;
		}
		if (points.length > 3) { // cubic bezier line - divide curve into straight line segments
			for (var i = 2; i < len - 1; i++) {
				var k = 2 * (i - 1);
				bez = [points[i - 1], cps[k - 1], cps[k], points[i]];
				split = this._segmentize(bez);
				prev = split(0);
				for (var t = 1; t <= 5; t++) {
					var cp = split(t / 5);
					lines = lines.concat(new Line(prev, cp));
					prev = cp;
				}
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
 * Creates bezier curve split callback, uses de Casteljau's algorithm
 *
 * @param {Array} points
 * @returns {Function}
 * @private
 */
Transition.prototype._segmentize = function(points) {
	var pts = [];
	for (var i = 0; i < points.length; i++) {
		var p = points[i];
		pts.push([p.x, p.y]);
	}
	return function (t) {
		for (var a = pts; a.length > 1; a = b) { // do..while loop in disguise
			for (var i = 0, b = [], j; i < a.length - 1; i++) { // cycle over control points
				for (b[i] = [], j = 0; j < a[i].length; j++) { // cycle over dimensions
					b[i][j] = a[i][j] * (1 - t) + a[i + 1][j] * t;  // interpolation
				}
			}
		}
		return new Point(a[0][0], a[0][1]);
	};
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
 * Deactivates current transition
 */
Transition.prototype.deactivate = function() {
	this._active = false;
	$('.' + SmalldbEditor._namespace + '-control-point').remove();
	this.canvas.redraw();
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
	this.path = this.canvas.drawDagreConnection(this, index, cycle);
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
