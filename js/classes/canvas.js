/**
 * canvas class
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {SmalldbEditor} editor - reference to plugin instance
 * @class
 */
var Canvas = function(editor) {
	this.editor = editor;
	this.options = this.editor.options;
};

/**
 * Renders canvas and its container, computes width and height based on diagram bounding box

 * @param {Object} box
 */
Canvas.prototype.render = function(box) {
	this.width = box.maxX - box.minX + 2 * this.options.canvasExtraWidth;
	this.height = box.maxY - box.minY + 2 * this.options.canvasExtraHeight;
	this.create();
};

/**
 * Draws straight line to this canvas
 *
 * @param {Number} fromX
 * @param {Number} fromY
 * @param {Number} toX
 * @param {Number} toY
 * @private
 */
Canvas.prototype._drawLine = function(fromX, fromY, toX, toY) {
	this.context.save();
	this.context.beginPath();
	this.context.translate(0.5, 0.5);
	this.context.moveTo(fromX, fromY);
	this.context.lineTo(toX, toY);
	this.context.closePath();
	this.context.stroke();
	this.context.restore();
};

/**
 * Draws canvas background
 * @private
 */
Canvas.prototype._drawBackground = function() {
	$(this.canvas).css('background', this.options.canvasBackgroundColor);
	this.context.strokeStyle = this.options.canvasBackgroundLineColor;
	this.context.lineWidth = 1;
	var step = this.options.canvasBackgroundLineStep;

	// vertical lines
	var max = this.width / step;
	for (var i = 0; i < max; i++) {
		this._drawLine(i * step, 0, i * step, this.height);
	}

	// horizontal lines
	max = this.height / step;
	for (var i = 0; i < max; i++) {
		this._drawLine(0, i * step, this.width, i * step);
	}

	this.context.fillStyle = '#000';
};

/**
 * Creates container and canvas element
 * @private
 */
Canvas.prototype.create = function() {
	// create canvas element
	this.canvas = $('<canvas>')[0];
	this.canvas.width = this.width;
	this.canvas.height = this.height;
	this.context = this.canvas.getContext('2d');
	this._drawBackground();

	// create scroll container
	this.$container = $('<div>');
	this.$container.attr('class', SmalldbEditor._namespace + '-container');
	this.$container.css({
		width: this.editor.$container.width(),
		height: this.editor.$container.height()
	});
	this.$container.on({
		mousedown: this._onMouseDown.bind(this),
		mouseup: this._onMouseUp.bind(this),
		mousemove: this._onMouseMove.bind(this),
		scroll: this._onScroll.bind(this),
		dblclick: this._onDblClick.bind(this)
	});
	// disable text selection, forces default cursor when selecting
	this.$container[0].onselectstart = function() {
		return false;
	};

	// create inner container - used to scale transformation (zoom)
	this.$containerInner = $('<div>');
	this.$containerInner.css('width', this.width);
	this.$containerInner.css('height', this.height);
	this.$containerInner.attr('class', SmalldbEditor._namespace + '-container-inner');
	this.$containerInner.append(this.canvas);
	this.$container.append(this.$containerInner);
	this.editor.$container.append(this.$container);

	// save initial center position of viewport
	var $c = this.$container;
	this._center = {
		x: ($c.scrollLeft() + $c.width() / 2),
		y: ($c.scrollTop() + $c.height() / 2)
	};
};

/**
 * Move canvas or start making selection
 * used as mouse down handler
 *
 * @param {MouseEvent} e - Event
 * @private
 */
Canvas.prototype._onMouseDown = function(e) {
	if ((e.metaKey || e.ctrlKey) && $(e.target).is('canvas')) { // selecting states
		this._cursor = {
			x: e.pageX - this.$container.offset().left + this.$container.scrollLeft(),
			y: e.pageY - this.$container.offset().top + this.$container.scrollTop()
		};
		this._$selection = $('<div class="' + SmalldbEditor._namespace + '-selection">');
		this._$selection.css({
			left: this._cursor.x,
			top: this._cursor.y
		});
		this.$container.append(this._$selection);
		return;
	}

	var state = $(e.target).closest('div.' + SmalldbEditor._namespace + '-state')[0];
	if (!state) {
		var zoom = this.getZoom();
		var speed = this.options.canvasSpeed / zoom;
		this._moving = true;
		this._cursor = {
			x: (this.canvas.width - speed * e.pageX) - this.$container.scrollLeft(),
			y: (this.canvas.height - speed * e.pageY) - this.$container.scrollTop()
		};
	}
};

/**
 * Moves canvas - used as mousemove handler
 *
 * @param {MouseEvent} e - Event
 * @private
 */
Canvas.prototype._onMouseMove = function(e) {
	var $c = this.$container;

	if (this._$selection) {
		var currX = e.pageX - $c.offset().left + $c.scrollLeft();
		var currY = e.pageY - $c.offset().top + $c.scrollTop();
		var width = currX - this._cursor.x;
		var height = currY - this._cursor.y;
		this._$selection.css({
			width: Math.abs(width),
			height: Math.abs(height)
		});
		if (width < 0) {
			this._$selection.css('left', currX);
		}
		if (height < 0) {
			this._$selection.css('top', currY);
		}
	}

	if (this._moving) {
		var zoom = this.getZoom();
		var speed = this.options.canvasSpeed / zoom;
		$c.scrollLeft((this.canvas.width - speed * e.pageX) - this._cursor.x);
		$c.scrollTop((this.canvas.height - speed * e.pageY) - this._cursor.y);
	}
};

/**
 * On double click handler, used to create new state
 *
 * @param {ScrollEvent} e - Event
 * @private
 */
Canvas.prototype._onDblClick = function(e) {
	// save center of viewport
	var label = window.prompt(_('New state label:'));
	if (!label) {
		return;
	}
	var id = label.replace(/[^a-z0-9_]+/g, '-').replace(/^-|-$/g, '');
	console.log(this);
	this._cursor = this.clickPosition(e);
	var state = new State(id, { label: label }, this.editor);
	state.x = this._cursor.x;
	state.y = this._cursor.y;
	state.render();
	state.updatePosition(state.$container.outerWidth() / 2, state.$container.outerHeight() / 2); // shift position of state to center
	this.editor.states[id] = state;
	this.editor.onChange();
	this.redraw();
};

/**
 * Gets position of click event
 *
 * @param {MouseEvent} e - event with mouse coordinates
 * @param {Boolean} [withoutOffset] - defaults to false
 * @returns {Point}
 */
Canvas.prototype.clickPosition = function(e, withoutOffset) {
	withoutOffset = withoutOffset || false
	var $c = this.$container;
	return new Point(
		(e.pageX - $c.offset().left + $c.scrollLeft()) - (withoutOffset ? 0 : this.options.canvasExtraWidth),
		(e.pageY - $c.offset().top + $c.scrollTop()) - (withoutOffset ? 0 : this.options.canvasExtraHeight)
	);
};

/**
 * On scroll handler, used to save current center of viewport (used when zooming)
 *
 * @param {ScrollEvent} e - Event
 * @private
 */
Canvas.prototype._onScroll = function(e) {
	// save center of viewport
	var zoom = this.getZoom();
	var $c = this.$container;
	this._center = {
		x: ($c.scrollLeft() + $c.width() / 2) / zoom,
		y: ($c.scrollTop() + $c.height() / 2) / zoom
	};
};

/**
 * Completes selection of states
 *
 * @param {MouseEvent} e - Event
 * @private
 */
Canvas.prototype._onMouseUp = function(e) {
	if (this._$selection) {
		var zoom = this.getZoom();
		this._cursor.x /= zoom;
		this._cursor.y /= zoom;
		for (var id in this.editor.states) {
			var s = this.editor.states[id];
			var currX = e.pageX - this.$container.offset().left + this.$container.scrollLeft();
			var currY = e.pageY - this.$container.offset().top + this.$container.scrollTop();
			currX /= zoom;
			currY /= zoom;
			var stateX = s.position().left;
			var stateXW = s.position().left + s.$container.width();
			var stateY = s.position().top;
			var stateYH = s.position().top + s.$container.height();

			if (currX - this._cursor.x < 0) { // right to left selection => allow selecting just part of state
				if (currX < stateXW && this._cursor.x > stateX &&
					((currY > stateY && this._cursor.y < stateYH) || (this._cursor.y > stateY && currY < stateYH))) {
					s.activate();
				}
			} else { // left to right selection => select only whole state
				if (currX > stateXW && this._cursor.x < stateX &&
					((currY > stateYH && this._cursor.y < stateY) || this._cursor.y > stateYH && currY < stateY)) {
					s.activate();
				}
			}
		}

		this._$selection.remove();
		delete this._$selection;
		this.selection = true; // prevent disabling selection by click event on canvas

		return false;
	}
	this._moving = false;
};

/**
 * Draws connection line with arrow pointing to end
 *
 * @param {Point} from
 * @param {Point} to
 * @param {Number} [index=1] when multiple connections are drawn
 * @param {String} [color='#000'] defaults to black
 * @param {Boolean} [bidirectional] defaults false, when true, both points need to contain id property with state id
 * @param {Boolean} [highlight] defaults false, when true, renders thicker line
 * @private
 */
Canvas.prototype.drawConnection = function(label, from, to, index, color, bidirectional, highlight) {
	index = index || 1;
	// line style
	color = color || '#000';
	this.context.save();
	this.context.beginPath();
	this.context.fillStyle = color;
	this.context.strokeStyle = color;
	this.context.lineWidth = highlight ? 2.8 : 1.4;

	// line points with starting point
	var points = [from];

	// add extra points to distinguish bidirectional connections - creates ellipsis from connecting lines
	if (bidirectional) {
		var v = from.minus(to); // vector to get direction
		var angle = Point.angle(from, to); // to get direction of deviation
		var dist = v.norm(); // distance between start & end
		var offset = index * Math.min(dist / 8, 20); // perpendicular offset to straight connection
		var alfa = Math.atan(2 * offset / dist); // angle inside rotated ellipsis
		var beta = Math.asin(Math.abs(from.y - to.y) / dist); // angle of ellipsis rotation
		var gamma = alfa + beta; // total angle between control point and horizontal axis
		var hypotenuse = Math.sqrt(dist * dist / 4 + offset * offset); // of control point on ellipsis
		var signX = ((angle >= 0 && angle < Math.PI / 2) || angle > 3 * Math.PI / 2) ? 1 : -1;
		var signY = (angle >= Math.PI || angle > 3 * Math.PI / 2) ? 1 : -1;
		var dx = hypotenuse * Math.cos(gamma) * signX;
		var dy = hypotenuse * Math.sin(gamma) * signY;
		var extra = new Point(from.x + dx, from.y + dy);
		points.push(extra);
		this._writeText(label, extra.x + 15, extra.y + 15, color);

		// adjust start and end position to
		var states = this.editor.states;
		from = states[from.id].getBorderPoint(extra);
		to = states[to.id].getBorderPoint(extra);
		points[0] = from;
	}

	points.push(to);

	// draw curved line
	var path = new Spline(points, this.options.splineTension, this.context);
	path.render();

	// draw action label
	if (!bidirectional) {
		var diff = to.minus(from);
		this._writeText(label, from.x + diff.x * 2 / 5, from.y + diff.y * 2 / 5, color)
	}

	// draw arrow in the end point
	var angle = Point.angle(points[points.length - 2], to);
	this._drawArrow(to.x, to.y, angle);

	return path;
};

/**
 * Draws cycle connection line with arrow pointing to end
 *
 * @param {Point} from
 * @param {Point} to
 * @param {String} [color='#000'] defaults to black
 * @param {Number} [index=1] when multiple connections are drawn
 * @param {Boolean} [highlight] defaults false, when true, renders thicker line
 * @private
 */
Canvas.prototype.drawCycleConnection = function(label, from, to, index, color, highlight) {
	index = index || 1;
	// line style
	color = color || '#000';
	this.context.save();
	this.context.beginPath();
	this.context.fillStyle = color;
	this.context.strokeStyle = color;
	this.context.lineWidth = highlight ? 2.8 : 1.4;

	// line points with starting point
	var points = [from];
	var line = new Line(from, to);
	var len = line.length();
	var mid = line.middle();

	// control points
	points.push(new Point(mid.x + 0.65 * len + len * 0.25 * (index - 1), mid.y - 15 - 20 * (index - 1)));
	points.push(new Point(mid.x, mid.y - 25 - 20 * (index - 1)));
	points.push(new Point(mid.x - 0.65 * len - len * 0.25 * (index - 1), mid.y - 15 - 20 * (index - 1)));
	points.push(to);

	// draw curved line
	var path = new Spline(points, this.options.splineTension, this.context);
	path.render();

	// draw arrow in the end point
	var angle = Point.angle(points[points.length - 2], to);
	this._drawArrow(to.x, to.y, angle);

	this._writeText(label, mid.x, mid.y - 30 - 20 * (index - 1), color);

	return path;
};

/**
 * Draws arrow pointing to the right
 *
 * @param {Number} x - horizontal position of the peak of arrow
 * @param {Number} y - vertical position of the peak of arrow
 * @param {Number} angle - angle in radians to rotate the arrow
 * @private
 */
Canvas.prototype._drawArrow = function(x, y, angle) {
	this.context.save();
	this.context.beginPath();
	this.context.lineWidth = 2;
	this.context.translate(x, y);
	this.context.rotate(-angle);

	this.context.lineTo(-6, -3);
	this.context.lineTo(-4, 0);
	this.context.lineTo(-6, 3);
	this.context.lineTo(0, 0);

	this.context.closePath();
	this.context.fill();
	this.context.stroke();
	this.context.restore();
};

/**
 * Writes text to canvas
 *
 * @param {string} text
 * @param {Number} x
 * @param {Number} y
 * @param {String} [color='#000']
 * @private
 */
Canvas.prototype._writeText = function(text, x, y, color) {
	color = color || '#000';
	this.context.save();
	this.context.fillStyle = color;
	this.context.font = "11px Arial";
	this.context.textAlign = 'center';
	this.context.fillText(text, x, y);
	this.context.restore();
};

/**
 * Redraws canvas
 */
Canvas.prototype.redraw = function() {
	this.context.clearRect(0, 0, this.width, this.height);
	this._drawBackground();
	this.editor.index = {};
	for (var id in this.editor.actions) {
		this.editor.actions[id].renderTransitions(this.editor.states, this.editor.index);
	}
};

/**
 * Gets center of viewport
 *
 * @returns {Object}
 */
Canvas.prototype.getCenter = function() {
	return this._center;
};

/**
 * Gets current zoom
 *
 * @returns {Object}
 */
Canvas.prototype.getZoom = function() {
	var zoom = this.editor.session.get('zoom');
	return Math.round(parseFloat(zoom) * 10) / 10;
};
