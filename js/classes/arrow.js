/**
 * Creates new Arrow instance
 *
 * @copyright Josef Kufner <josef@kufner.cz>, 2016
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * Transition is can lead to many target states, so Arrow represents
 * connections between source state of the transition and one of its 
 * target states. Each Arrow has own path, but shares other attributes 
 * with the Transition.
 *
 * @class
 */
var Arrow = function(transition, data, source, target) {
	this.transition = transition;
	this.data = data;
	this.source = source;
	this.target = target;
	this.cycle = source === target;

	if ('dagrePath' in data) {
		var path = [];
		for (var p in data.dagrePath) {
			path[p] = new Point(data.dagrePath[p].x, data.dagrePath[p].y);
		}
		this.dagrePath = path;
	}
};


/**
 * Serializes current transition to JSON object
 *
 * @returns {Object}
 */
Arrow.prototype.serialize = function() {
	var T = {};
	var is_empty = true;

	if (this.dagrePath) {
		T.dagrePath = this.dagrePath;
		is_empty = false;
	}

	for (var t in this.data) {
		if (['dagrePath'].indexOf(t) === -1) {
			T[t] = this.data[t];
			is_empty = false;
		}
	}

	return is_empty ? null : T;
};


/**
 * Is given point on this transition's curve?
 *
 * @param {Point} point - mouse click position
 * @returns {Boolean}
 */
Arrow.prototype.contains = function(point) {
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
	var offset = this.transition.action.editor.options.edgeClickOffset; // px to both sides from line
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
Arrow.prototype._segmentize = function(points) {
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
 * Renders transition to canvas
 *
 * @param {Array} states
 * @param {Object} index - how many same connections did we rendered, stored by key "{source.id}-{target.id}"
 */
Arrow.prototype.render = function(states, index) {
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
		this.path = this.transition.action.editor.canvas.drawCycleConnection(
				this.transition.action.id, from, new Point(to.x - w, to.y), index[key]++,
				this.transition.color, this.transition.isActive());
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
		this.path = this.transition.action.editor.canvas.drawConnection(
				this.transition.action.id, from, to, index[key]++,
				this.transition.color, bidirectional, this.transition.isActive());
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
Arrow.prototype._renderDagrePath = function(states, s, index, bidirectional, cycle) {
	// render dagre path if available, adjust start and end points
	var p = this.dagrePath;
	this.dagrePath[0] = states[s].getBorderPoint(p[1]);
	this.dagrePath[p.length - 1] = states[this.target].getBorderPoint(p[p.length - 2]);
	this.path = this.canvas.drawDagreConnection(this, index, cycle);
};

