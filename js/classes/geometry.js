/**
 * Point representation in 2D space
 *
 * @param {Number} x
 * @param {Number} y
 * @constructor
 * @class
 */
var Point = function(x, y) {
	this.x = x;
	this.y = y;
};

/**
 * @param {Point} p
 * @returns {Boolean}
 */
Point.prototype.equals = function(p) {
	return this.x === p.x && this.y === p.y;
};

/**
 * @param {Point} p
 * @returns {Point}
 */
Point.prototype.plus = function(p) {
	return new Point(this.x + p.x, this.y + p.y);
};

/**
 * @param {Point} p
 * @returns {Point} resulting vector
 */
Point.prototype.minus = function(p) {
	return new Point(this.x - p.x, this.y - p.y);
};

/**
 * Calculates the dot product of the two points.
 *
 * @param {Point} p
 * @returns {Number} dot product
 */
Point.prototype.dot = function(p) {
	return this.x * p.x + this.y * p.y;
};

/**
 * Computes norm of vector
 *
 * @returns {Number}
 */
Point.prototype.norm = function() {
	return Math.sqrt(this.dot(this));
};

/**
 * Computes distance between to points in euclidean space
 *
 * @param {Point} p
 * @returns {Number}
 */
Point.prototype.dist = function(p) {
	var dx = (p.x - this.x) * (p.x - this.x);
	var dy = (p.y - this.y) * (p.y - this.y);
	return Math.sqrt(dx + dy);
};

Point.prototype.toString = function() {
	return '[' + parseInt(this.x) + ';' + parseInt(this.y) + ']';
};

/**
 * Calculates the angle between two points using atan2 (in radians)
 *
 * @param {Point} a
 * @param {Point} b
 * @returns {Number} angle in radians, normalized to interval [0;2pi)
 * @static
 */
Point.angle = function(a, b) {
	var v = b.minus(a);
	return (2 * Math.PI - Math.atan2(v.y, v.x)) % (2 * Math.PI);
};

/**
 * Line representation in 2D space
 *
 * @param {Point} from
 * @param {Point} to
 * @constructor
 * @class
 */
var Line = function(from, to) {
	this.from = from;
	this.to = to;
};

/**
 * Computes line length
 *
 * @returns {Number}
 */
Line.prototype.length = function() {
	return this.from.dist(this.to);
};

/**
 * Computes middle point on this line
 *
 * @returns {Point}
 */
Line.prototype.middle = function() {
	var ret = this.from.plus(this.to);
	ret.x /= 2;
	ret.y /= 2;
	return ret;
};

/**
 * Computes shortest distance from this line segment to given point
 *
 * @param {Point} p
 * @returns {Number}
 */
Line.prototype.dist = function(p) {
	var u = p.minus(this.from);
	var w = this.to.minus(this.from);

	var dot = u.dot(w);
	var lenSqr = w.dot(w);
	var param = -1;
	if (lenSqr !== 0) { // in case of 0 length line
		param = dot / lenSqr;
	}

	if (param < 0) {
		var other = this.from;
	} else if (param > 1) {
		var other = this.to;
	} else {
		var other = new Point(
			this.from.x + param * w.x,
			this.from.y + param * w.y
		);
	}

	return p.dist(other);
};

/**
 * Do lines intersects with each other?
 *
 * @param {Line} line
 * @private
 */
Line.prototype.intersection = function(line) {
	var r = this.to.minus(this.from);
	var s = line.to.minus(line.from);
	var w = line.from.minus(this.from);

	var product1 = w.dot(r);
	var product2 = r.dot(s);

	if (product2 === 0) { // lines are parallel
		return false;
	}

	var u = product1 / product2;
	var t = w.dot(s) / product2;

	if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
		return this.from.plus(new Point(t * r.x, t * r.y));
	} else {
		return false;
	}
};
