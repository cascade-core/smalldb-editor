/**
 * Smooth curved line
 *
 * @param {Array} points
 * @param {Number} tension
 * @param {CanvasRenderingContext2D} context
 * @constructor
 */
var Spline = function(points, tension, context) {
	this.points = points;
	this.tension = tension;
	this.context = context;
	this.showPoints = false; // for debugging
	this.showControlPoints = false; // for debugging
};

/**
 * Computes vector from two points
 *
 * @param {Point} p1
 * @param {Point} p2
 * @returns {Point}
 * @private
 */
Spline.prototype._vector = function(p1, p2) {
	return new Point(p2.x - p1.x, p2.y - p1.y);
};

/**
 * Computes bezier curve control points based on 3 following points
 *
 * @param {Point} p1
 * @param {Point} p2
 * @param {Point} p3
 * @returns {Array}
 * @private
 */
Spline.prototype._controlPoints = function(p1, p2, p3) {
	var t = this.tension;
	var v = this._vector(p1, p3);
	var d12 = p1.dist(p2);
	var d23 = p2.dist(p3);
	var d123 = d12 + d23;
	return [
		new Point(p2.x - v.x * t * d12 / d123, p2.y - v.y * t * d12 / d123),
		new Point(p2.x + v.x * t * d23 / d123, p2.y + v.y * t * d23 / d123)
	];
};

/**
 * Renders curve to canvas
 */
Spline.prototype.render = function() {
	this.cps = []; // control points
	for (var i = 0; i < this.points.length - 2; i++) {
		this.cps = this.cps.concat(this._controlPoints(this.points[i], this.points[i + 1], this.points[i + 2]));
	}
	this._drawCurvedPath();
};

/**
 * Internal rendering method
 *
 * @private
 */
Spline.prototype._drawCurvedPath = function() {
	var len = this.points.length;
	var ctx = this.context;
	var cps = this.cps;
	if (len < 2) {
		return;
	}

	this._debug();

	if (len === 2) {
		ctx.beginPath();
		ctx.moveTo(this.points[0].x, this.points[0].y);
		ctx.lineTo(this.points[1].x, this.points[1].y);
		ctx.stroke();
	} else {
		ctx.beginPath();
		ctx.moveTo(this.points[0].x, this.points[0].y);
		ctx.quadraticCurveTo(cps[0].x, cps[0].y, this.points[1].x, this.points[1].y);
		for (var i = 2; i < len - 1; i += 1) {
			var k = 2 * (i - 1);
			ctx.bezierCurveTo(cps[k - 1].x, cps[k - 1].y, cps[k].x, cps[k].y, this.points[i].x, this.points[i].y);
		}
		if (!k) { // 3 points only -> no middle part with bezier
			k = cps.length - 2;
		}
		ctx.quadraticCurveTo(cps[k + 1].x, cps[k + 1].y, this.points[i].x, this.points[i].y);
		ctx.stroke();
	}
};

/**
 * Renders points and control points for debugging
 *
 * @private
 */
Spline.prototype._debug = function() {
	// render points
	var color = this.context.strokeStyle;
	if (this.showPoints) {
		for (var i in this.points) {
			this.context.beginPath();
			this.context.arc(this.points[i].x, this.points[i].y, 5, 0, 2 * Math.PI);
			this.context.closePath();
			this.context.stroke();
		}
	}
	if (this.showControlPoints) {
		for (var i in this.cps) {
			this.context.beginPath();
			this.context.strokeStyle = 'red';
			this.context.arc(this.cps[i].x, this.cps[i].y, 5, 0, 2 * Math.PI);
			if (i > 0 && i % 2 === 1) {
				this.context.moveTo(this.cps[i - 1].x, this.cps[i - 1].y);
				this.context.lineTo(this.cps[i].x, this.cps[i].y);
			}
			this.context.closePath();
			this.context.stroke();
		}
		this.context.strokeStyle = color;
	}

};
