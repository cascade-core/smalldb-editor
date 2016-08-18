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
	this.renderCycles = true;
};

/**
 * Renders canvas and its container, computes width and height based on diagram bounding box
 *
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
 * Creates container and canvas element
 * @private
 */
Canvas.prototype.create = function() {
	// create canvas element
	var $el = $('<canvas>');
	if (!this.options.viewOnly) {
		$el.addClass('smalldb-editor-bg');
	}
	this.canvas = $el[0];
	this.canvas.width = this.width;
	this.canvas.height = this.height;
	if (this.options.viewOnly && 'C2S' in window) {
		this.context = new C2S(this.width, this.height);
	} else {
		this.context = this.canvas.getContext('2d');
	}

	// create scroll container
	this.$container = $('<div>');
	this.$container.attr('class', SmalldbEditor._namespace + '-container');
	if (!this.options.viewOnly) {
		this.$container.on({
			mousedown: this._onMouseDown.bind(this),
			mouseup: this._onMouseUp.bind(this),
			mousemove: this._onMouseMove.bind(this),
			scroll: this._onScroll.bind(this),
			dblclick: this._onDblClick.bind(this)
		});
	}
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
	var zoom = this.getZoom();
	this._center = {
		x: ($c.scrollLeft() + ($c.width() - 250) / 2) / zoom,
		y: ($c.scrollTop() + $c.height() / 2) / zoom
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
	if (!(e.metaKey || e.ctrlKey) && $(e.target).is('canvas')) { // selecting states
		this.editor.toolbar.disableSelection();
		this._cursor = {
			x: e.pageX - this.$container.offset().left + this.$container.scrollLeft(),
			y: e.pageY - this.$container.offset().top + this.$container.scrollTop()
		};
		this._$selection = $('<div class="' + SmalldbEditor._namespace + '-selection">');
		this._$selection.css({
			left: this._cursor.x,
			top: this._cursor.y
		});
		return;
	}

	var state = $(e.target).closest('div.' + SmalldbEditor._namespace + '-state')[0];
	var cp = $(e.target).closest('a.' + SmalldbEditor._namespace + '-control-point')[0];
	if (!state && !cp) {
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
		if (!this._$selection.is(':visible')) {
			this.$container.append(this._$selection);
		}

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
	var id = label.toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^-|-$/g, '');
	this._cursor = this.clickPosition(e);
	var state = new State(id, { label: label }, this.editor);
	state.x = this._cursor.x;
	state.y = this._cursor.y;
	state.render();
	state.activate();
	// shift position of state to center
	state.updatePosition(state.$container.outerWidth() / 2, state.$container.outerHeight() / 2);
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
	withoutOffset = withoutOffset || false;
	var $c = this.$container;
	var zoom = this.getZoom();
	return new Point(
		(e.pageX - $c.offset().left + $c.scrollLeft()) / zoom - (withoutOffset ? 0 : this.options.canvasExtraWidth),
		(e.pageY - $c.offset().top + $c.scrollTop()) / zoom - (withoutOffset ? 0 : this.options.canvasExtraHeight)
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
	var $panel = $c.next();
	this._center = {
		x: ($c.scrollLeft() + ($c.width() - $panel.outerWidth()) / 2) / zoom,
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
			var stateXW = stateX + s.$container.outerWidth();
			var stateY = s.position().top;
			var stateYH = stateY + s.$container.outerHeight();

			if (currX - this._cursor.x < 0) { // right to left selection => allow selecting just part of state
				if (currX < stateXW && this._cursor.x > stateX &&
					((currY > stateY && this._cursor.y < stateYH) || (this._cursor.y > stateY && currY < stateYH))) {
					s.activate(true);
				}
			} else { // left to right selection => select only whole state
				if (currX > stateXW && this._cursor.x < stateX &&
					((currY > stateYH && this._cursor.y < stateY) || this._cursor.y > stateYH && currY < stateY)) {
					s.activate(true);
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
 *
 * @param {Transition} trans
 * @param {Object} index
 * @param {Boolean} cycle
 * @returns {Spline|Boolean}
 */
Canvas.prototype.drawDagreConnection = function(trans, index, cycle) {
	var points = trans.dagrePath;

	if (cycle && !this.renderCycles) {
		for (var p = 1; p < points.length - 1; p++) {
			if (points[p].cpid) {
				$('#' + points[p].cpid).remove();
			}
		}
		return;
	}

	index = index || 1;
	var path = this._drawPath(points, trans.color, trans.isActive(), trans.action.id === '');

	// draw action label
	var mid = points[Math.floor(points.length / 2)];
	this._writeText(trans.action.id, mid.x + 15, mid.y + 5, path, trans.color, trans.isActive(), !this.editor.dragging);

	// render control point buttons
	if (this.editor.showControlPoints || trans.isActive()) {
		for (var p = 1; p < points.length - 1; p++) {
			if (!points[p].cpid) {
				points[p].cpid = 'cp-' + Math.random().toString(36).slice(10); // generate random id
			} else {
				$('#' + points[p].cpid).remove();
			}
			var $btn = $('<a href="#remove">');
			$btn.attr('title', _('Double click to remove this control point'));
			$btn.attr('id', points[p].cpid);
			$btn.html('<i class="fa fa-certificate"></i> &times;</a>');
			var className = SmalldbEditor._namespace + '-control-point';
			$btn.addClass(className);
			$btn.css({
				top: points[p].y,
				left: points[p].x
			});
			$btn.on('click', function() {
				return false;
			});
			$btn.on('dblclick', this._removeControlPoint(trans, points, p));
			$btn.on('mousedown', this._onDragStartCP(points, p));
			this.$containerInner.append($btn);
		}
	}

	return path;
};

/**
 * Drag start handler - used on mousedown event
 * starts dragging of control point
 *
 * @param {Array} points
 * @param {Number} point
 * @returns {function(this:Canvas)}
 * @private
 */
Canvas.prototype._onDragStartCP = function(points, p) {
	return function() {
		this._dragging = true;
		this.editor.dragging = true;

		$('body').on({
			'mousemove.state-editor': this._onDragOverCP(points, p),
			'mouseup.state-editor': this._onDragEndCP.bind(this)
		});
		return false;
	}.bind(this);
};

/**
 * Drag over handler - used on mousemove event
 * moves control point over canvas
 *
 * @param {Array} points
 * @param {Number} point
 * @returns {function(this:Canvas)}
 * @private
 */
Canvas.prototype._onDragOverCP = function(points, p) {
	return function(e) {
		if (this._dragging) {
			var $c = this.$container;
			var zoom = this.getZoom();
			points[p].x = (e.pageX - $c.offset().left + $c.scrollLeft()) / zoom;
			points[p].y = (e.pageY - $c.offset().top + $c.scrollTop()) / zoom;
			this.redraw();
		}
	}.bind(this);
};

/**
 * Drag end handler - used on mouseup event
 * saves new control point position
 *
 * @returns {void}
 * @private
 */
Canvas.prototype._onDragEndCP = function() {
	$('body').off('mousemove.state-editor mouseup.state-editor');
	this._dragging = false;
	this.editor.dragging = false;
	this.editor.onChange();
};

/**
 * Creates callback for removing control point from path
 *
 * @param {Transition} trans
 * @param {Array} points
 * @param {Number} point
 * @returns {function(this:Canvas)}
 * @private
 */
Canvas.prototype._removeControlPoint = function(trans, points, point) {
	return function(e) {
		$(e.target).closest('a').remove();
		points.splice(point, 1);
		if (points.length < (trans.cycle ? 4 : 3)) {
			for (var p in points) {
				if (points[p].cpid) {
					$('#' + points[p].cpid).remove();
				}
			}
			delete trans.dagrePath;
		}
		this.redraw();
		return false;
	}.bind(this);
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

	// line points with starting point
	var points = [from];

	// add extra points to distinguish bidirectional connections - creates ellipsis from connecting lines
	var mid = new Line(from, to).middle();
	if (index > 1 || bidirectional) {
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
		mid = new Point(from.x + dx, from.y + dy);
		points.push(mid);
	}

	if (bidirectional) {
		// adjust start and end position
		var states = this.editor.states;
		from = states[from.id].getBorderPoint(mid);
		to = states[to.id].getBorderPoint(mid);
		points[0] = from;
	}

	points.push(to);

	var path = this._drawPath(points, color, highlight, label === '');

	// draw action label
	this._writeText(label, mid.x + 5, mid.y - 5, path, color, highlight, !this.editor.dragging);

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
	if (!this.renderCycles) {
		return;
	}

	index = index || 1;

	// line points with starting point
	var points = [from];
	var line = new Line(from, to);
	var len = line.length();
	var mid = line.middle();

	// control points
	points.push(new Point(mid.x + 0.65 * len + 5 * (index - 1), mid.y - 15 - 20 * (index - 1)));
	points.push(new Point(mid.x, mid.y - 25 - 20 * (index - 1)));
	points.push(new Point(mid.x - 0.65 * len - 5 * (index - 1), mid.y - 15 - 20 * (index - 1)));
	points.push(to);

	var path = this._drawPath(points, color, highlight, label === '');
	this._writeText(label, mid.x, mid.y - 30 - 20 * (index - 1), path, color, highlight, !this.editor.dragging);

	return path;
};

/**
 * Draws given path
 *
 * @param {Point[]} points
 * @param {String} [color='#000'] defaults to black
 * @param {Boolean} [highlight] defaults false, when true, renders thicker line
 * @private
 */
Canvas.prototype._drawPath = function(points, color, highlight, dashed) {
	// line style
	color = color || '#000';
	this.context.save();
	this.context.beginPath();
	this.context.fillStyle = color;
	this.context.strokeStyle = color;
	this.context.lineWidth = highlight ? 2.8 : 1.4;

	if (dashed) {
		if (!this.context.setLineDash) {
			this.context.setLineDash = function() { };
		}
		this.context.setLineDash([10]);
	}

	// draw curved line
	var path = new Spline(points, this.options.splineTension, this.context);
	path.render();

	if (dashed) {
		this.context.setLineDash([0]);
	}

	// draw arrow in the end point
	var to = points[points.length - 1];
	var angle = Point.angle(points[points.length - 2], to);
	this._drawArrow(to.x, to.y, angle);

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

	this.context.moveTo(0, 0);
	this.context.lineTo(-6, -3);
	this.context.lineTo(-4, 0);
	this.context.lineTo(-6, 3);
	this.context.lineTo(0, 0);

	this.context.closePath();
	this.context.stroke();
	this.context.fill();
	this.context.restore();
};

/**
 * Writes text to canvas
 *
 * @param {String} text
 * @param {Number} x - horizontal position of text
 * @param {Number} y - vertical position of text
 * @param {Object} path - for saving label bounding box
 * @param {String} [color='#000'] - color of rendered text
 * @param {Boolean} [highlight=false] - highlight rendered text (make it bold)
 * @param {Boolean} [postpone] render with small delay, defaults to false
 * @private
 */
Canvas.prototype._writeText = function(text, x, y, path, color, highlight, postpone) {
	// postpone text rendering to draw all curves first (render twice actually to prevent blinking)
	if (postpone) {
		var that = this;
		setTimeout(function() {
			that._writeText(text, x, y, path, color, highlight);
		}, 0);
	}
	color = color || '#000';
	this.context.save();
	this.context.lineWidth = 1.4;
	this.context.shadowColor = '#fff';
	this.context.shadowOffsetX = 0;
	this.context.shadowOffsetY = 0;
	this.context.shadowBlur = 2;
	this.context.strokeStyle = '#fff';
	this.context.fillStyle = color;
	this.context.font = '11px Arial';
	if (highlight) {
		this.context.font = 'bold 11px Arial';
	}
	this.context.textAlign = 'center';
	this.context.strokeText(text, x, y);
	this.context.fillText(text, x, y);
	this.context.restore();

	// save label bounding box
	var width = this.context.measureText(text).width;
	path.labelBox = [x - width / 2 - 3, y - 10, x + width / 2 + 3, y + 3];
};

/**
 * Redraws canvas
 */
Canvas.prototype.redraw = function() {
	if (this.context) {
		this.context.clearRect(0, 0, this.width, this.height);
		this.editor.index = {};
		for (var id in this.editor.actions) {
			this.editor.actions[id].renderTransitions(this.editor.states, this.editor.index);
		}
	}
	if (this.options.viewOnly && 'C2S' in window) {
		var svg = this.context.getSerializedSvg(true); //true here will replace any named entities with numbered ones.
		this.$containerInner.find('svg, canvas').remove();
		this.$containerInner.append(svg);
		this.$containerInner.find('svg rect').remove();
		this.context = new C2S(this.width, this.height);
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
