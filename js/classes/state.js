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
};

/**
 * Normalizes connections to internal format, where aggregation
 * function is stored as pair ["", "func"] instead of [":func"]
 *
 * @param {Object} connections
 * @returns {Object}
 * @private
 */
State.prototype._processConnections = function(connections) {
	if (connections) {
		for (var id in connections) {
			if (connections[id].length > 1 && connections[id][0][0] === ':') {
				connections[id][0] = connections[id][0].substr(1);
				connections[id].unshift('');
			}
		}
	}
	return connections;
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
 * Removes state from canvas
 *
 * @returns {Object} state data in JSON object
 */
State.prototype.remove = function() {
	this.$container.remove();
	delete this.$container;
	delete this.editor.states[this.id];
	this.editor.onChange();
	return this.serialize();
};

/**
 * Redraw this state
 */
State.prototype.redraw = function() {
	this.$container.remove();
	delete this.$container;
	this.render();
	this.canvas.redraw();
};

/**
 * Adds connection to this state
 *
 * @param {Array} source - Source state id and variable name
 * @param {string} target -
 * @returns {?boolean} false when source state not present inside canvas or no name for wildcard variable provided
 */
State.prototype.addConnection = function(source, target) {
	// create new input variable
	if (target === '*') {
		var editor = new Editor(this, this.editor, target);
		target = editor.getNewName();
		if (target === null) {
			return false;
		}
	}

	// create new output variable
	if (source[1] === '*') {
		var editor = new Editor(this, this.editor, target);
		source[1] = editor.getNewName(true, source[0]);
		if (source[1] === null) {
			return false;
		}
	}

	if (this.connections[target]) {
		// check if connection not exists
		for	(var i = 0; i < this.connections[target].length; i += 2) {
			if (this.connections[target][i] === source[0] && this.connections[target][i + 1] === source[1]) {
				return false;
			}
		}

		// connection to this target already exists, prompt for aggregation func
		if (this.connections[target][0] !== '') {
			var func = this.getNewAggregationFunc();
			if (!func) {
				return false;
			}
			this.connections[target].unshift('', func);
		}
	} else {
		this.connections[target] = [];
	}
	this.connections[target].push(source[0], source[1]);
	this.redraw();
	this.$container.find('.' + SmalldbEditor._namespace + '-invar-' + (target === '*' ? '_asterisk_' : target)).removeClass('default');
	this.editor.onChange();
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
	if ((e.metaKey || e.ctrlKey) && $(e.target).hasClass(SmalldbEditor._namespace + '-smalldb-output')) {
		$target.addClass('selecting');
		$('body').on({
			'mousemove.state-editor': $.proxy(function(e) {
				this._onDragOverFromOutput.call(this, e, $target);
			}, this),
			'mouseup.state-editor': $.proxy(function(e) {
				this._onDragEndFromOutput.call(this, e, $target);
			}, this)
		});
	} else if ((e.metaKey || e.ctrlKey) && $(e.target).hasClass(SmalldbEditor._namespace + '-smalldb-input')) {
		$target.addClass('selecting');
		$('body').on({
			'mousemove.state-editor': $.proxy(function(e) {
				this._onDragOverFromInput.call(this, e, $target);
				return false;
			}, this),
			'mouseup.state-editor': $.proxy(function(e) {
				this._onDragEndFromInput.call(this, e, $target);
				return false;
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
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-smalldb-output')) {
		$(e.target).addClass('hover-invalid');
	}
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-smalldb-input')) {
		$(e.target).addClass('hover-valid');
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-state')
			   .find('.' + SmalldbEditor._namespace + '-smalldb-id').text();
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
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-smalldb-input')) {
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-state')
							.find('.' + SmalldbEditor._namespace + '-smalldb-id').text();
		var target = $(e.target).data('variable');
		this.editor.states[id].addConnection(source, target);
	}

	// clean up
	$('.' + SmalldbEditor._namespace + '-smalldb-output.selecting').removeClass('selecting');
	$('.' + SmalldbEditor._namespace).find('.hover-valid, .hover-invalid').removeClass('hover-valid hover-invalid');
	this.canvas.redraw();
	$('body').off('mousemove.state-editor mouseup.state-editor');
};

/**
 * Drag over handler - used on mousemove event
 * renders connection from output of source state to current mouse position
 *
 * @param {MouseEvent} e - Event
 * @param {jQuery} $target - target state input variable element
 * @private
 */
State.prototype._onDragOverFromInput = function(e, $target) {
	// compute current mouse position
	var x = e.pageX
		  + this.canvas.$container[0].scrollLeft
		  - this.canvas.$container.offset().left;
	var y = e.pageY
		  + this.canvas.$container[0].scrollTop
		  - this.canvas.$container.offset().top;
	var zoom = this.canvas.getZoom();
	x /= zoom;
	y /= zoom;
	var x2 = this.position().left - 3;
	var y2 = this.position().top
		   + 7 // center of row
		   + $target.position().top / zoom; // add position of variable

	// highlight target
	$('.' + SmalldbEditor._namespace).find('.hover-valid, .hover-invalid').removeClass('hover-valid hover-invalid');
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-smalldb-input')) {
		$(e.target).addClass('hover-invalid');
	}
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-smalldb-output')) {
		$(e.target).addClass('hover-valid');
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-state')
							.find('.' + SmalldbEditor._namespace + '-smalldb-id').text();
		var state = this.editor.states[id];
		x = state.position().left + 1
		  + state.$container.outerWidth();
		y = state.position().top + 7
		  + $(e.target).position().top / zoom; 	// add position of variable
	}

	this.canvas.redraw();
	this.canvas._drawConnection(x, y, x2, y2, '#c60');
};

/**
 * Drag end handler - used on mouseup event
 * creates connection from output of source state
 *
 * @param {MouseEvent} e - Event
 * @param {jQuery} $target - target state input variable element
 * @private
 */
State.prototype._onDragEndFromInput = function(e, $target) {
	// create connection
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-smalldb-output')) {
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-state')
							.find('.' + SmalldbEditor._namespace + '-smalldb-id').text();
		var target = $(e.target).text();
		this.editor.states[this.id].addConnection([id, target], $target.data('variable'));
	}

	// clean up
	$('.' + SmalldbEditor._namespace + '-smalldb-input.selecting').removeClass('selecting');
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
 * @param {number} dx - horizontal difference in px
 * @param {number} dy - vertical difference in px
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
 * @returns {boolean}
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
	// create table container
	this.$container = $('<table class="' + SmalldbEditor._namespace + '-state">');

	// make it draggable
	this.$container.on('click', this._onClick.bind(this));
	this.$container.on('mousedown', this._onDragStart.bind(this));

	// header with state id and state type
	var $header = this._createHeader();

	// inputs
	this.$inputs = $('<td class="' + SmalldbEditor._namespace + '-smalldb-inputs" />');
	for (var variable in this.values) {
		this.addInput(variable);
	}
	for (var conn in this.connections) {
		this.addInput(conn);
	}

	// outputs
	//this.$outputs = $('<td class="' + SmalldbEditor._namespace + '-smalldb-outputs" />');
	//for (var variable in this.defaults.outputs) {
	//	this.addOutput(variable);
	//}

	this.$container.append($('<tr />').append($header));
	this.$container.append($('<tr />').append(this.$inputs).append(this.$outputs));
};

/**
 * Creates HTML header element of this state
 *
 * @returns {jQuery}
 * @private
 */
State.prototype._createHeader = function() {
	var $id = $('<div class="' + SmalldbEditor._namespace + '-smalldb-id">');
	$id.on('dblclick', this._changeId.bind(this));
	var $type = $('<div class="' + SmalldbEditor._namespace + '-smalldb-type">');
	$type.text(this.type);
	$type.on('dblclick', this._changeType.bind(this));

	var $removeButton = $('<a href="#remove" class="' + SmalldbEditor._namespace + '-smalldb-remove"><i class="fa fa-fw fa-trash"></i> ×</a>');
	$removeButton.on('click', this._remove.bind(this));
	$removeButton.attr('title', 'Remove state');

	var $header = $('<th colspan="2" class="' + SmalldbEditor._namespace + '-smalldb-header" />');
	$header.append($id.text(this.id));
	$header.append($type);
	$header.append($removeButton);

	return $header;
};

/**
 * Adds input variable
 *
 * @param {string} variable
 */
State.prototype.addInput = function(variable) {
	var selector = 'a.' + SmalldbEditor._namespace + '-smalldb-input[data-variable="' + variable + '"]';
	if ($(selector, this.$inputs).length) {
		return; // already exists
	}

	var $input = $('<a href="#settings" class="' + SmalldbEditor._namespace + '-smalldb-input" />');
	$input.attr('data-variable', variable);
	$input.text(variable);
	$input.on('click', this._toggleInputEditor.bind(this));
	$input.addClass(SmalldbEditor._namespace + '-invar-' + (variable === '*' ? '_asterisk_' : variable));
	if ((!this.values || !this.values[variable]) && !this.connections[variable]) {
		$input.addClass('default');
	}
	this.$inputs.append($input);
};

/**
 * Adds output variable
 *
 * @param {string} variable
 */
State.prototype.addOutput = function (variable) {
	var $output = $('<div class="' + SmalldbEditor._namespace + '-smalldb-output" />');

	if (!(variable in this.defaults.outputs) && !('*' in this.defaults.outputs)) {
		$output.addClass('missing');
	}

	$output.text(variable);
	$output.addClass(SmalldbEditor._namespace + '-outvar-' + (variable === '*' ? '_asterisk_' : variable));
	this.$outputs.append($output);
};

/**
 * Toggles input variable editor
 * used as on click handler for input variables
 *
 * @param {MouseEvent} e - Event
 * @returns {boolean}
 * @private
 */
State.prototype._toggleInputEditor = function(e) {
	if (!this._moved) {
		var selector = '.' + SmalldbEditor._namespace + '-smalldb-input';
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
 * @returns {boolean}
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
 * Changes current state type
 * used as on click handler
 *
 * @returns {boolean}
 * @private
 */
State.prototype._changeType = function() {
	// todo selectbox?
	var old = this.type;
	var type = null;
	while (type === null) {
		type = window.prompt(_('New state ID:'), old);

		if (type === null) {
			break;
		} else if (!type.match(/^[a-zA-Z][a-zA-Z0-9_/]*$/)) {
			alert(_('Only letters, numbers and underscore are allowed in state type and the first character must be a letter.'));
			old = type;
			type = null;
		} else if (!(type in this.palette.states)) {
			alert(_('This state type does not exist.'));
			old = type;
			type = null;
		}
	}

	if (type === null) {
		return;
	} else {
		this.type = type;
		this.redraw();
		this.editor.onChange();
	}

	return false;
};

/**
 * Removes current state
 * used as on click handler
 *
 * @returns {boolean}
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
 * @param {number} x2 - target base x position
 * @param {number} y2 - target base y position
 * @param {string} [color] - css color string starting with #
 * @returns {boolean}
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
		this.canvas._drawConnection(x1, y1, x2, yy2, color);
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
