/**
 * Creates new state instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {String} id - state identification
 * @param {Object} data - state properties
 * @param {SmalldbEditor} editor - reference to plugin instance
 * @class
 */
var State = function(id, data, editor) {
	this.id = id;
	this.data = data;
	this.data.color = data.color || '#eee';
	this.editor = editor;
	this.canvas = editor.canvas;

	this.x = data.x;
	this.y = data.y;
	this.connections = []; // outgoing connections
	this.rank = 0; // total number of connected edges
};

/**
 * Renders state to canvas
 */
State.prototype.render = function() {
	// create DOM if not exists
	if (!this.$container) {
		this.create();
		this.canvas.$containerInner.append(this.$container);
	}

	// update position
	this.$container.css({
		top: this.y + this.canvas.options.canvasExtraWidth,
		left: this.x + this.canvas.options.canvasExtraHeight
	});
};

/**
 * Gets current state container position inside canvas
 *
 * @returns {?Object} with top and left offset values, null when container not rendered
 */
State.prototype.position = function() {
	if (!this.$container) {
		return null;
	}

	return {
		top: this.$container[0].offsetTop,
		left: this.$container[0].offsetLeft
	};
};

/**
 * Gets current state container center position inside canvas
 *
 * @returns {?Point}
 */
State.prototype.center = function() {
	if (!this.$container) {
		return null;
	}

	var position = this.position();
	position.top += this.$container.outerHeight() / 2;
	position.left += this.$container.outerWidth() / 2;
	return new Point(position.left, position.top);
};

/**
 * Gets point on ellipses
 *
 * @param {Point} other - starting point
 * @returns {Point}
 */
State.prototype.getBorderPoint = function(other) {
	if (!this.$container) {
		return new Point(this.x, this.y);
	}

	var pos = this.center();
	var a = this.$container.outerWidth() / 2;
	var b = this.$container.outerHeight() / 2;
	var alfa = Point.angle(pos, other) || 0;
	var signX = (alfa < Math.PI / 2 || alfa > 3 * Math.PI / 2) ? 1 : -1;
	var signY = (alfa > Math.PI || alfa > 3 * Math.PI / 2) ? 1 : -1;
	pos.x += signX * (a * b) / Math.sqrt(b * b + a * a * Math.pow(Math.tan(alfa), 2));
	pos.y += signY * (a * b) / Math.sqrt(a * a + (b * b) / Math.pow(Math.tan(alfa), 2));
	return pos;
};

/**
 * Removes state from canvas
 *
 * @returns {Object} state data in JSON object
 */
State.prototype.remove = function() {
	if (this.$container) {
		this.$container.remove();
		delete this.$container;
	}
	delete this.editor.states[this.id];
	this.editor.onChange();
	return this.serialize();
};

/**
 * Redraw this state
 */
State.prototype.redraw = function() {
	if (this.$container) {
		this.$container.remove();
		delete this.$container;
		this.render();
		this.canvas.redraw();
	}
};

/**
 * Adds connection to this state
 *
 * @param {Array} target - target state id
 */
State.prototype.addConnection = function(target) {
	if (this.connections.indexOf(target) === -1) {
		this.connections.push(target);
	}
	this.redraw();
	this.editor.onChange();
};

/**
 * Is there a connection from this state to given target state?
 *
 * @param {State} target
 * @returns {Boolean}
 */
State.prototype.isConnected = function(target) {
	return this.connections.indexOf(target) !== -1;
};

/**
 * Drag start handler - used on mousedown event
 * when CTRL is pressed, creates new connections
 *
 * @param {MouseEvent} e - Event
 * @private
 */
State.prototype._onDragStart = function(e) {
	var $target = $(e.target);
	if ((e.metaKey || e.ctrlKey)) {
		$target.addClass('selecting');
		$('body').on({
			'mousemove.state-editor': this._onDragOverConnect.bind(this),
			'mouseup.state-editor': this._onDragEndConnect.bind(this)
		});
	} else {
		var zoom = this.canvas.getZoom();
		this._cursor = {
			x: e.clientX / zoom - this.position().left,
			y: e.clientY / zoom - this.position().top
		};
		this._dragging = true;
		this._moved = false;

		$('body').on({
			'mousemove.state-editor': this._onDragOver.bind(this),
			'mouseup.state-editor': this._onDragEnd.bind(this)
		});
	}
};

/**
 * Drag over handler - used on mousemove event
 * renders connection from this state to current mouse position
 *
 * @param {MouseEvent} e - Event
 * @private
 */
State.prototype._onDragOverConnect = function(e) {
	// compute current mouse position
	var zoom = this.canvas.getZoom();
	var x = e.pageX
		  + this.canvas.$container[0].scrollLeft
		  - this.canvas.$container.offset().left;
	var y = e.pageY
		  + this.canvas.$container[0].scrollTop
		  - this.canvas.$container.offset().top;
	x /= zoom;
	y /= zoom;
	var target = new Point(x, y);
	var bidirectional = false;

	// highlight target
	$('.' + SmalldbEditor._namespace).find('.hover-valid, .hover-invalid').removeClass('hover-valid hover-invalid');
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state')) {
		$(e.target).addClass('hover-valid');
		var id = $(e.target).data(SmalldbEditor._namespace + '-id');
		var state = this.editor.states[id];
		target = state.getBorderPoint(this.center());
	}
	this.canvas.redraw();
	this._renderConnection(target, '#c60', bidirectional);
};

/**
 * Drag end handler - used on mouseup event
 * creates connection from output of source state to target
 *
 * @param {MouseEvent} e - Event
 * @private
 */
State.prototype._onDragEndConnect = function(e) {
	var source = this.id;
	// create connection
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state-input')) {
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-state')
							.find('.' + SmalldbEditor._namespace + '-state-id').text();
		var target = $(e.target).data('variable');
		this.editor.states[id].addConnection(source, target);
	}

	// clean up
	$('.' + SmalldbEditor._namespace + '-state.selecting').removeClass('selecting');
	$('.' + SmalldbEditor._namespace).find('.hover-valid, .hover-invalid').removeClass('hover-valid hover-invalid');
	this.canvas.redraw();
	$('body').off('mousemove.state-editor mouseup.state-editor');
};

/**
 * Drag over handler - used on mousemove event
 * moves state over canvas
 *
 * @param {MouseEvent} e - Event
 * @private
 */
State.prototype._onDragOver = function(e) {
	if (this._dragging) {
		if (!this._active) {
			this.editor.toolbar.disableSelection();
			this.activate();
		}

		var zoom = this.canvas.getZoom();
		var left = e.clientX / zoom - this._cursor.x;
		var top = e.clientY / zoom - this._cursor.y;

		this._moved = this.position().left !== left || this.position().top !== top;
		if (this._moved) {
			var dx = this.position().left - left;
			var dy = this.position().top - top;
			this.updatePosition(dx, dy);
			for (var id in this.editor.states) {
				if (this !== this.editor.states[id] && this.editor.states[id].isActive()) {
					this.editor.states[id].updatePosition(dx, dy);
				}
			}
			this.canvas.redraw();
		}
	}
};

/**
 * Drag end handler - used on mouseup event
 * saves new state position
 *
 * @param {MouseEvent} e - Event
 * @private
 */
State.prototype._onDragEnd = function(e) {
	setTimeout(function() {
		this._dragging = false;
	}, 0);
	$('body').off('mousemove.state-editor mouseup.state-editor');
	this.editor.onChange();
};

/**
 * Updates current state position
 *
 * @param {Number} dx - horizontal difference in px
 * @param {Number} dy - vertical difference in px
 */
State.prototype.updatePosition = function(dx, dy) {
	this.x -= dx;
	this.y -= dy;
	this.$container.css({
		left: parseInt(this.$container.css('left')) - dx,
		top: parseInt(this.$container.css('top')) - dy
	});
};

/**
 * Click handler, sets active state to current state, or toggles it when CTRL pressed
 *
 * @param {MouseEvent} e - Event
 * @private
 */
State.prototype._onClick = function(e) {
	if (!(e.metaKey || e.ctrlKey) && !this._moved) {
		this.editor.toolbar.disableSelection();
	}
	if (!this._moved && !$(e.target).is('a')) {
		if ((e.metaKey || e.ctrlKey)) {
			this.toggle();
		} else {
			this.activate();
		}
	}
};

/**
 * Is current state selected?
 *
 * @returns {Boolean}
 */
State.prototype.isActive = function() {
	return !!this._active; // cast as bool
};

/**
 * Toggles active state of current state
 */
State.prototype.toggle = function() {
	if (!this._active) {
		this.activate();
	} else {
		this.deactivate();
	}
};

/**
 * Activates current state
 */
State.prototype.activate = function() {
	this._active = true;
	var className = SmalldbEditor._namespace + '-active';
	this.$container.addClass(className);
	this.editor.toolbar.updateDisabledClasses();
	this.editor.editor.dontClose = true; // prevent setting default view when clicking on state or edge
	this.editor.editor.create('state', this);
};

/**
 * Deactivates current state
 */
State.prototype.deactivate = function() {
	this._active = false;
	var className = SmalldbEditor._namespace + '-active';
	this.$container.removeClass(className);
	this.editor.toolbar.updateDisabledClasses();
};

/**
 * Creates HTML container for current state
 *
 * @private
 */
State.prototype.create = function() {
	// create container
	this.$container = $('<div class="' + SmalldbEditor._namespace + '-state">');
	this.$container.addClass(SmalldbEditor._namespace + '-id-' + this.id);
	if (this.data.color) {
		this.$container.css('background', this.data.color);
	}

	// make it draggable
	this.$container.on('click', this._onClick.bind(this));
	this.$container.on('mousedown', this._onDragStart.bind(this));

	// state id and remove button
	this.$container.text(this.data.label);
	this.$container.data(SmalldbEditor._namespace + '-id', this.id);
	this.$container.attr('title', this.id);
	this.$container.on('dblclick', this._changeLabel.bind(this));

	var $removeButton = $('<a href="#remove" class="' + SmalldbEditor._namespace + '-state-remove"><i class="fa fa-fw fa-trash"></i> ×</a>');
	$removeButton.on('click', this._remove.bind(this));
	$removeButton.attr('title', 'Remove state');
	this.$container.append($removeButton);
};

/**
 * Toggles input variable editor
 * used as on click handler for input variables
 *
 * @param {MouseEvent} e - Event
 * @returns {Boolean}
 * @private
 */
State.prototype._toggleInputEditor = function(e) {
	if (!this._moved) {
		var selector = '.' + SmalldbEditor._namespace + '-state-input';
		var editor = new Editor(this, this.editor, $(e.target).closest(selector).data('variable'));
		editor.render();
	}

	return false;
};

/**
 * Gets new state id from user via window.prompt()
 *
 * @returns {?String}
 */
State.prototype.getNewLabel = function() {
	var old = this.data.label;
	return window.prompt(_('New state label:'), old);
};

/**
 * Changes current state label
 * used as on click handler
 *
 * @returns {Boolean}
 * @private
 */
State.prototype._changeLabel = function() {
	var label = this.getNewLabel();

	if (label === null) {
		return label;
	} else {
		this.data.label = label;
		this.redraw();
		this.editor.onChange();
	}

	return false;
};

/**
 * Removes current state
 * used as on click handler
 *
 * @returns {Boolean}
 * @private
 */
State.prototype._remove = function() {
	if (confirm(_('Do you wish to remove state "%s"?', [this.id]))) {
		for (var i in this.connections) {
			delete this.connections[i];
		}
		this.$container.remove();
		delete this.editor.states[this.id];
		this.canvas.redraw();
		this.editor.onChange();
	}

	return false;
};

/**
 * Gets current state container bounding box
 *
 * @returns {?Object} with bounding box points
 */
State.prototype.getBoundingBox = function() {
	if (!this.$container) {
		return null;
	}
	var $c = this.$container;
	return {
		'topLeft': new Point($c[0].offsetLeft, $c[0].offsetTop),
		'topRight': new Point($c[0].offsetLeft + $c.outerWidth(), $c[0].offsetTop),
		'bottomLeft': new Point($c[0].offsetLeft, $c[0].offsetTop + $c.outerHeight()),
		'bottomRight': new Point($c[0].offsetLeft + $c.outerWidth(), $c[0].offsetTop + $c.outerHeight())
	};
};

/**
 * Renders single connection
 *
 * @param {Point} target - target position
 * @param {String} [color='#000'] - css color string starting with #
 * @returns {Boolean}
 * @private
 */
State.prototype._renderConnection = function(target, color) {
	var from = this.getBorderPoint(target);
	var color = color || '#000';
	this.canvas.drawConnection('', from, target, {}, color);
};

/**
 * Serializes current state to JSON object
 *
 * @returns {Object}
 * @todo
 */
State.prototype.serialize = function() {
	var B = {
		state: this.type,
		x: this.x,
		y: this.y
	};
	if (this.force_exec !== null) {
		B.force_exec = this.force_exec;
	}
	for (var input in this.connections) {
		if (input !== '*' && this.connections[input] !== undefined) {
			if (this.connections[input] instanceof Array && this.connections[input].length > 0) {
				if (!('in_con' in B)) {
					B.in_con = {};
				}
				var conn = [];
				var i = 0;
				if (this.connections[input][0] === '') {
					conn.push(':' + this.connections[input][1]); // aggregation func
					i = 2;
				}
				for (; i < this.connections[input].length; i++) {
					conn.push(this.connections[input][i]);
				}
				B.in_con[input] = conn;
			}
		}
	}
	for (var input in this.values) {
		if (input !== '*' && this.values[input] !== undefined) {
			if (!('in_val' in B)) {
				B.in_val = {};
			}
			B.in_val[input] = this.values[input];
		}
	}
	return B;
};
