/**
 * Creates new state instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {string} id - state identification
 * @param {Object} data - state properties
 * @param {SmalldbEditor} editor - reference to plugin instance
 * @class
 */
var State = function(id, data, editor) {
	this.id = id;
	this.data = data;
	this.editor = editor;
	this.canvas = editor.canvas;

	this.x = data.x;
	this.y = data.y;
	this.connections = [];
};

/**
 * Renders state to canvas
 */
State.prototype.render = function() {
	// create DOM if not exists
	if (!this.$container) {
		this._create();
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
 * @param {Array} targets - array of target state ids
 */
State.prototype.addConnection = function(targets) {
	for (var t in targets) {
		if (this.connections.indexOf(targets[t]) === -1) {
			this.connections.push(targets[t]);
		}
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
			'mousemove.state-editor': $.proxy(function(e) {
				this._onDragOverFromOutput.call(this, e, $target);
			}, this),
			'mouseup.state-editor': $.proxy(function(e) {
				this._onDragEndFromOutput.call(this, e, $target);
			}, this)
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
 * renders connection from output of source state to current mouse position
 *
 * @param {MouseEvent} e - Event
 * @param {jQuery} $target
 * @private
 */
State.prototype._onDragOverFromOutput = function(e, $target) {
	var source = [this.id, $target.text()];
	// compute current mouse position
	var zoom = this.canvas.getZoom();
	var x = e.pageX
		  + this.canvas.$container[0].scrollLeft
		  - this.canvas.$container.offset().left;
	var y = e.pageY
		  + this.canvas.$container[0].scrollTop
		  - this.canvas.$container.offset().top
		  - $target.parent().position().top - 10;
	x /= zoom;
	y /= zoom;

	// highlight target
	$('.' + SmalldbEditor._namespace).find('.hover-valid, .hover-invalid').removeClass('hover-valid hover-invalid');
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state-output')) {
		$(e.target).addClass('hover-invalid');
	}
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state-input')) {
		$(e.target).addClass('hover-valid');
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-state')
			   .find('.' + SmalldbEditor._namespace + '-state-id').text();
		var state = this.editor.states[id];
		x = state.position().left - 3;
		y = state.position().top - 29
		  + $(e.target).position().top / zoom; // add position of variable
	}
	this.canvas.redraw();
	this._renderConnection(null, source, x, y, '#c60');
};

/**
 * Drag end handler - used on mouseup event
 * creates connection from output of source state to target
 *
 * @param {MouseEvent} e - Event
 * @param {jQuery} $target - source state output variable element
 * @private
 */
State.prototype._onDragEndFromOutput = function(e, $target) {
	var source = [this.id, $target.text()];
	// create connection
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state-input')) {
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-state')
							.find('.' + SmalldbEditor._namespace + '-state-id').text();
		var target = $(e.target).data('variable');
		this.editor.states[id].addConnection(source, target);
	}

	// clean up
	$('.' + SmalldbEditor._namespace + '-state-output.selecting').removeClass('selecting');
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
 * @private
 */
State.prototype._create = function() {
	// create container
	this.$container = $('<div class="' + SmalldbEditor._namespace + '-state">');

	// make it draggable
	this.$container.on('click', this._onClick.bind(this));
	this.$container.on('mousedown', this._onDragStart.bind(this));

	// header with state id and remove button
	var $header = this._createHeader();
	this.$container.append($header);
};

/**
 * Creates HTML header element of this state
 *
 * @returns {jQuery}
 * @private
 */
State.prototype._createHeader = function() {
	var $id = $('<div class="' + SmalldbEditor._namespace + '-state-id">');
	$id.on('dblclick', this._changeId.bind(this));

	var $removeButton = $('<a href="#remove" class="' + SmalldbEditor._namespace + '-state-remove"><i class="fa fa-fw fa-trash"></i> ×</a>');
	$removeButton.on('click', this._remove.bind(this));
	$removeButton.attr('title', 'Remove state');

	var $header = $('<div class="' + SmalldbEditor._namespace + '-state-header" />');
	$header.append($id.text(this.id));
	$header.append($removeButton);

	return $header;
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
 * @returns {?string}
 */
State.prototype.getNewId = function() {
	var old = this.id;
	var id = null;
	while (id === null) {
		id = window.prompt(_('New state ID:'), old);

		if (id === null) {
			return id;
		} else if (!id.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
			alert(_('Only letters, numbers and underscore are allowed in state ID and the first character must be a letter.'));
			old = id;
			id = null;
		} else if (id in this.editor.states) {
			alert(_('This state ID is already taken by another state.'));
			old = id;
			id = null;
		}
	}

	return id;
};

/**
 * Gets new aggregation function name
 *
 * @returns {?string}
 */
State.prototype.getNewAggregationFunc = function() {
	var old = 'and';
	var id = null;
	while (id === null) {
		id = window.prompt(_('Aggregation function:'), old);

		if (id === null) {
			return id;
		} else if (!id.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
			alert(_('Only letters, numbers and underscore are allowed in aggregation function name and the first character must be a letter.'));
			old = id;
			id = null;
		}
	}

	return id;
};

/**
 * Changes current state id
 * used as on click handler
 *
 * @returns {Boolean}
 * @private
 */
State.prototype._changeId = function() {
	var id = this.getNewId();

	if (id === null) {
		return;
	} else {
		this.id = id;
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
 * Renders connections to this state
 */
State.prototype.renderConnections = function() {
	var x2 = this.position().left - 3;
	var y2 = this.position().top;
	for (var id in this.connections) {
		var sources = this.connections[id];

		// aggregation (:and, :or, ...)
		var query = '.' + SmalldbEditor._namespace + '-invar-' + (id === '*' ? '_asterisk_' : id);
		var $input = $(query, this.$container);
		$input.find('span').remove();
		var i = 0;
		if (sources[0] === '') {
			$input.append('<span> (:' + sources[1] + ')</span>');
			i += 2;
		}

		for (; i < sources.length; i = i + 2) {
			this._renderConnection(id, sources.slice(i, i + 2), x2, y2);
		}
	}
};

/**
 * Renders single connection
 *
 * @param {string} id - input variable name
 * @param {Array} source - source state id and variable
 * @param {Number} x2 - target base x position
 * @param {Number} y2 - target base y position
 * @param {string} [color] - css color string starting with #
 * @returns {Boolean}
 * @private
 */
State.prototype._renderConnection = function(id, source, x2, y2, color) {
	var query = '.' + SmalldbEditor._namespace + '-invar-' + (id === '*' ? '_asterisk_' : id);
	var $input = $(query, this.$container);
	var state = this.editor.states[source[0]];
	var zoom = this.canvas.getZoom();
	if (state) {
		if ($input.length) {
			var yy2 = y2 // from top of state container
					+ 7	 // center of row
					+ $input.position().top / zoom; // add position of variable
		} else {
			var yy2 = y2 + 36; // state header height + center of row
		}
		query = '.' + SmalldbEditor._namespace + '-outvar-' + (source[1] === '*' ? '_asterisk_' : source[1]);
		var $output = $(query, state.$container);
		var missing = $output.hasClass('missing');

		if (state.$container.find(query).length === 0) {
			state.addOutput(source[1]);
			this.canvas.redraw();
			return false;
		}

		var offset = state.position();
		var x1 = offset.left // from left of state container
				+ 1			 // offset
				+ state.$container.outerWidth(); // add container width
		var y1 = offset.top // from top of state container
				+ 7			// center of row
				+ state.$container.find(query).position().top / zoom; // add position of variable
		var color = color || (missing ? '#f00' : '#000');
		this.canvas.drawConnection(new Point(x1, y1), new Point(x2, yy2), color);
	} else {
		// state outside of this scope or not exists
		this.$container.find(query).addClass('missing').attr('title', _('Source of this connection may be invalid'));
	}
};

/**
 * Serializes current state to JSON object
 *
 * @returns {Object}
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
