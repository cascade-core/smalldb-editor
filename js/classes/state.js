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
	this.label = 'label' in data ? data.label : id;
	this.color = 'color' in data ? data.color.toLowerCase() : '#eeeeee';
	this.data = data || {};
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
		if (this.isActive()) {
			var className = SmalldbEditor._namespace + '-active';
			this.$container.addClass(className);
		}
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
 * todo remove transitions connected to this state
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
 *
 * @param {Boolean} [noCanvasRedraw] - do not redraw canvas
 */
State.prototype.redraw = function(noCanvasRedraw) {
	if (this.$container) {
		this.$container.remove();
		delete this.$container;
		this.render();
		if (!noCanvasRedraw) {
			this.canvas.redraw();
		}
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
		this.editor.states.__end__.notFound = false;
		this.redraw();
		this.editor.onChange();
	}
};

/**
 * Removes connection from this state
 *
 * @param {Array} target - target state id
 */
State.prototype.removeConnection = function(target) {
	var index = this.connections.indexOf(target);
	if (index !== -1) {
		delete this.connections[index];
		this.redraw();
		this.editor.onChange();
	}
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
		this.editor.dragging = true;
	} else {
		var zoom = this.canvas.getZoom();
		this._cursor = {
			x: e.clientX / zoom - this.position().left,
			y: e.clientY / zoom - this.position().top
		};
		this._dragging = true;
		this.editor.dragging = true;
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
	this.canvas.redraw();

	// highlight target
	$('.' + SmalldbEditor._namespace).find('.hover-valid, .hover-invalid').removeClass('hover-valid hover-invalid');
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state')) {
		$(e.target).addClass('hover-valid');
		var id = $(e.target).data(SmalldbEditor._namespace + '-id');
		var state = this.editor.states[id];
		target = state.getBorderPoint(this.center());
		target.id = id;
		var trans = new Transition(this.editor.actions.__noaction__, { label: '', color: '#c60', dashed: true }, this.id, target.id, this.id === id);
		trans.render(this.editor.states, this.editor.index);
	} else {
		this._renderConnection(target, '#c60');
	}
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
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state')) {
		var target = $(e.target).data(SmalldbEditor._namespace + '-id');
		var action = this.editor.actions.__noaction__;
		var trans = new Transition(action, {}, source, target);
		trans.label = '';
		trans.activate();
		trans.render(this.editor.states, this.editor.index);
		action.addTransition(source, trans);
		this.addConnection(target);
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
	var that = this;
	setTimeout(function() {
		that._dragging = false;
		that.editor.dragging = false;
		that.canvas.redraw();
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
 *
 * @param {Boolean} [multiple] - allow selection of multiple states, defaults to false (removes selection first)
 */
State.prototype.activate = function(multiple) {
	this._active = true;
	var className = SmalldbEditor._namespace + '-active';
	this.$container.addClass(className);
	this.editor.toolbar.updateDisabledClasses();
	this.editor.editor.dontClose = true; // prevent setting default view when clicking on state or edge
	this.editor.editor.create('state', this, multiple);
};

/**
 * Deactivates current state
 */
State.prototype.deactivate = function() {
	this._active = false;
	if (this.$container) {
		var className = SmalldbEditor._namespace + '-active';
		this.$container.removeClass(className);
		this.editor.toolbar.updateDisabledClasses();
	}
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
	if (this.color) {
		this.$container.css('background', this.color);
	}

	// state id and remove button
	this.$container.text(this.label);
	this.$container.data(SmalldbEditor._namespace + '-id', this.id);
	var title = this.id;
	if (this.id === '__start__') {
		title = _('Initial state');
	}
	if (this.id === '__end__') {
		title = _('Final state');
	}
	this.$container.attr('title', title);

	if (!this.editor.options.viewOnly) {
		// make it draggable
		this.$container.on({
			'click': this._onClick.bind(this),
			'mousedown': this._onDragStart.bind(this),
			'dblclick': this._changeLabel.bind(this)
		});

		// remove state button
		if (this.id.indexOf('__') !== 0) { // do not display for internal states (start & end)
			var $removeButton = $('<a href="#remove" class="' + SmalldbEditor._namespace + '-state-remove"><i class="fa fa-fw fa-trash"></i> &times;</a>');
			$removeButton.on('click', this.removeHandler.bind(this));
			$removeButton.attr('title', 'Remove state');
			this.$container.append($removeButton);
		}
	}
};

/**
 * Gets new state id from user via window.prompt()
 *
 * @returns {?String}
 */
State.prototype.getNewLabel = function() {
	var old = this.label;
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
		this.label = label;
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
State.prototype.removeHandler = function() {
	if (window.confirm(_('Do you wish to remove state "%s"?', [this.id]))) {
		this.remove();
		this.editor.editor.create();
		this.canvas.redraw();
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
 * Renders single connection to target point
 *
 * @param {Point} target - target position
 * @param {String} [color='#000'] - css color string starting with #
 * @returns {Boolean}
 * @private
 */
State.prototype._renderConnection = function(target, color) {
	var from = this.getBorderPoint(target);
	var color = color || '#000';
	var key = from.toString() + '-' + from.toString();
	if (!this.editor.index[key]) {
		this.editor.index[key] = 1;
	}
	this.canvas.drawConnection('', from, target, this.editor.index[key]++, color);
};

/**
 * Serializes current state to JSON object
 *
 * @returns {Object}
 */
State.prototype.serialize = function() {
	var S = {
		state: this.id,
		label: this.label,
		color: this.color,
		x: this.x,
		y: this.y
	};
	for (var t in this.data) {
		if (['state', 'label', 'color', 'x', 'y'].indexOf(t) === -1) {
			S[t] = this.data[t];
		}
	}
	return S;
};
