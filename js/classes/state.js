/**
 * Creates new Block instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {string} id - Block identification
 * @param {Object} data - Block properties
 * @param {SmalldbEditor} editor - reference to plugin instance
 * @class
 */
var State = function(id, data, editor) {
	this.id = id;
	this.editor = editor;
	this.palette = editor.palette;
	this.canvas = editor.canvas;
	this.values = data.in_val || {};
	this.connections = data.in_con ? this._processConnections(data.in_con) : {};
	this.type = data.block;

	this.x = data.x;
	this.y = data.y;

	console.log(data);
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
 * Renders block to canvas
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
 * Gets current block container position inside canvas
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
 * Removes block from canvas
 *
 * @returns {Object} Block data in JSON object
 */
State.prototype.remove = function() {
	this.$container.remove();
	delete this.$container;
	delete this.editor.blocks[this.id];
	this.editor.onChange();
	return this.serialize();
};

/**
 * Redraw this block
 */
State.prototype.redraw = function() {
	this.$container.remove();
	delete this.$container;
	this.render();
	this.canvas.redraw();
};

/**
 * Adds connection to this block
 *
 * @param {Array} source - Source block id and variable name
 * @param {string} target -
 * @returns {?boolean} false when source block not present inside canvas or no name for wildcard variable provided
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
	if ((e.metaKey || e.ctrlKey) && $(e.target).hasClass(SmalldbEditor._namespace + '-state-output')) {
		$target.addClass('selecting');
		$('body').on({
			'mousemove.block-editor': $.proxy(function(e) {
				this._onDragOverFromOutput.call(this, e, $target);
			}, this),
			'mouseup.block-editor': $.proxy(function(e) {
				this._onDragEndFromOutput.call(this, e, $target);
			}, this)
		});
	} else if ((e.metaKey || e.ctrlKey) && $(e.target).hasClass(SmalldbEditor._namespace + '-state-input')) {
		$target.addClass('selecting');
		$('body').on({
			'mousemove.block-editor': $.proxy(function(e) {
				this._onDragOverFromInput.call(this, e, $target);
				return false;
			}, this),
			'mouseup.block-editor': $.proxy(function(e) {
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
			'mousemove.block-editor': this._onDragOver.bind(this),
			'mouseup.block-editor': this._onDragEnd.bind(this)
		});
	}
};

/**
 * Drag over handler - used on mousemove event
 * renders connection from output of source block to current mouse position
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
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-block')
			   .find('.' + SmalldbEditor._namespace + '-state-id').text();
		var block = this.editor.blocks[id];
		x = block.position().left - 3;
		y = block.position().top - 29
		  + $(e.target).position().top / zoom; // add position of variable
	}
	this.canvas.redraw();
	this._renderConnection(null, source, x, y, '#c60');
};

/**
 * Drag end handler - used on mouseup event
 * creates connection from output of source block to target
 *
 * @param {MouseEvent} e - Event
 * @param {jQuery} $target - source block output variable element
 * @private
 */
State.prototype._onDragEndFromOutput = function(e, $target) {
	var source = [this.id, $target.text()];
	// create connection
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state-input')) {
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-block')
							.find('.' + SmalldbEditor._namespace + '-state-id').text();
		var target = $(e.target).data('variable');
		this.editor.blocks[id].addConnection(source, target);
	}

	// clean up
	$('.' + SmalldbEditor._namespace + '-state-output.selecting').removeClass('selecting');
	$('.' + SmalldbEditor._namespace).find('.hover-valid, .hover-invalid').removeClass('hover-valid hover-invalid');
	this.canvas.redraw();
	$('body').off('mousemove.block-editor mouseup.block-editor');
};

/**
 * Drag over handler - used on mousemove event
 * renders connection from output of source block to current mouse position
 *
 * @param {MouseEvent} e - Event
 * @param {jQuery} $target - target block input variable element
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
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state-input')) {
		$(e.target).addClass('hover-invalid');
	}
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state-output')) {
		$(e.target).addClass('hover-valid');
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-block')
							.find('.' + SmalldbEditor._namespace + '-state-id').text();
		var block = this.editor.blocks[id];
		x = block.position().left + 1
		  + block.$container.outerWidth();
		y = block.position().top + 7
		  + $(e.target).position().top / zoom; 	// add position of variable
	}

	this.canvas.redraw();
	this.canvas._drawConnection(x, y, x2, y2, '#c60');
};

/**
 * Drag end handler - used on mouseup event
 * creates connection from output of source block
 *
 * @param {MouseEvent} e - Event
 * @param {jQuery} $target - target block input variable element
 * @private
 */
State.prototype._onDragEndFromInput = function(e, $target) {
	// create connection
	if ($(e.target).hasClass(SmalldbEditor._namespace + '-state-output')) {
		var id = $(e.target).closest('.' + SmalldbEditor._namespace + '-block')
							.find('.' + SmalldbEditor._namespace + '-state-id').text();
		var target = $(e.target).text();
		this.editor.blocks[this.id].addConnection([id, target], $target.data('variable'));
	}

	// clean up
	$('.' + SmalldbEditor._namespace + '-state-input.selecting').removeClass('selecting');
	$('.' + SmalldbEditor._namespace).find('.hover-valid, .hover-invalid').removeClass('hover-valid hover-invalid');
	this.canvas.redraw();
	$('body').off('mousemove.block-editor mouseup.block-editor');
};

/**
 * Drag over handler - used on mousemove event
 * moves block over canvas
 *
 * @param {MouseEvent} e - Event
 * @private
 */
State.prototype._onDragOver = function(e) {
	if (this._dragging) {
		if (!this._active) {
			this.palette.toolbar.disableSelection();
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
			for (var id in this.editor.blocks) {
				if (this !== this.editor.blocks[id] && this.editor.blocks[id].isActive()) {
					this.editor.blocks[id].updatePosition(dx, dy);
				}
			}
			this.canvas.redraw();
		}
	}
};

/**
 * Drag end handler - used on mouseup event
 * saves new block position
 *
 * @param {MouseEvent} e - Event
 * @private
 */
State.prototype._onDragEnd = function(e) {
	setTimeout(function() {
		this._dragging = false;
	}, 0);
	$('body').off('mousemove.block-editor mouseup.block-editor');
	this.editor.onChange();
};

/**
 * Updates current block position
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
 * Click handler, sets active state to current block, or toggles it when CTRL pressed
 *
 * @param {MouseEvent} e - Event
 * @private
 */
State.prototype._onClick = function(e) {
	if (!(e.metaKey || e.ctrlKey) && !this._moved) {
		this.palette.toolbar.disableSelection();
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
 * Is current block selected?
 *
 * @returns {boolean}
 */
State.prototype.isActive = function() {
	return !!this._active; // cast as bool
};

/**
 * Toggles active state of current block
 */
State.prototype.toggle = function() {
	if (!this._active) {
		this.activate();
	} else {
		this.deactivate();
	}
};

/**
 * Activates current block
 */
State.prototype.activate = function() {
	this._active = true;
	var className = SmalldbEditor._namespace + '-active';
	this.$container.addClass(className);
	this.palette.toolbar.updateDisabledClasses();
};

/**
 * Deactivates current block
 */
State.prototype.deactivate = function() {
	this._active = false;
	var className = SmalldbEditor._namespace + '-active';
	this.$container.removeClass(className);
	this.palette.toolbar.updateDisabledClasses();
};

/**
 * Creates HTML container for current block
 * @private
 */
State.prototype._create = function() {
	// create table container
	this.$container = $('<table class="' + SmalldbEditor._namespace + '-block">');

	// make it draggable
	this.$container.on('click', this._onClick.bind(this));
	this.$container.on('mousedown', this._onDragStart.bind(this));

	// header with block id and block type
	var $header = this._createHeader();

	// inputs
	this.$inputs = $('<td class="' + SmalldbEditor._namespace + '-state-inputs" />');
	for (var variable in this.values) {
		this.addInput(variable);
	}
	for (var conn in this.connections) {
		this.addInput(conn);
	}

	// outputs
	//this.$outputs = $('<td class="' + SmalldbEditor._namespace + '-state-outputs" />');
	//for (var variable in this.defaults.outputs) {
	//	this.addOutput(variable);
	//}

	this.$container.append($('<tr />').append($header));
	this.$container.append($('<tr />').append(this.$inputs).append(this.$outputs));
};

/**
 * Creates HTML header element of this block
 *
 * @returns {jQuery}
 * @private
 */
State.prototype._createHeader = function() {
	var $id = $('<div class="' + SmalldbEditor._namespace + '-state-id">');
	$id.on('dblclick', this._changeId.bind(this));
	var $type = $('<div class="' + SmalldbEditor._namespace + '-state-type">');
	$type.text(this.type);
	$type.on('dblclick', this._changeType.bind(this));

	var $removeButton = $('<a href="#remove" class="' + SmalldbEditor._namespace + '-state-remove"><i class="fa fa-fw fa-trash"></i> ×</a>');
	$removeButton.on('click', this._remove.bind(this));
	$removeButton.attr('title', 'Remove block');

	var $header = $('<th colspan="2" class="' + SmalldbEditor._namespace + '-state-header" />');
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
	var selector = 'a.' + SmalldbEditor._namespace + '-state-input[data-variable="' + variable + '"]';
	if ($(selector, this.$inputs).length) {
		return; // already exists
	}

	var $input = $('<a href="#settings" class="' + SmalldbEditor._namespace + '-state-input" />');
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
	var $output = $('<div class="' + SmalldbEditor._namespace + '-state-output" />');

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
		var selector = '.' + SmalldbEditor._namespace + '-state-input';
		var editor = new Editor(this, this.editor, $(e.target).closest(selector).data('variable'));
		editor.render();
	}

	return false;
};

/**
 * Gets new block id from user via window.prompt()
 *
 * @returns {?string}
 */
State.prototype.getNewId = function() {
	var old = this.id;
	var id = null;
	while (id === null) {
		id = window.prompt(_('New block ID:'), old);

		if (id === null) {
			return id;
		} else if (!id.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
			alert(_('Only letters, numbers and underscore are allowed in block ID and the first character must be a letter.'));
			old = id;
			id = null;
		} else if (id in this.editor.blocks) {
			alert(_('This block ID is already taken by another block.'));
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
 * Changes current block id
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
 * Changes current block type
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
		type = window.prompt(_('New block ID:'), old);

		if (type === null) {
			break;
		} else if (!type.match(/^[a-zA-Z][a-zA-Z0-9_/]*$/)) {
			alert(_('Only letters, numbers and underscore are allowed in block type and the first character must be a letter.'));
			old = type;
			type = null;
		} else if (!(type in this.palette.blocks)) {
			alert(_('This block type does not exist.'));
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
 * Removes current block
 * used as on click handler
 *
 * @returns {boolean}
 * @private
 */
State.prototype._remove = function() {
	if (confirm(_('Do you wish to remove block "%s"?', [this.id]))) {
		for (var i in this.connections) {
			delete this.connections[i];
		}
		this.$container.remove();
		delete this.editor.blocks[this.id];
		this.canvas.redraw();
		this.editor.onChange();
	}

	return false;
};

/**
 * Renders connections to this block
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
 * @param {Array} source - source block id and variable
 * @param {number} x2 - target base x position
 * @param {number} y2 - target base y position
 * @param {string} [color] - css color string starting with #
 * @returns {boolean}
 * @private
 */
State.prototype._renderConnection = function(id, source, x2, y2, color) {
	var query = '.' + SmalldbEditor._namespace + '-invar-' + (id === '*' ? '_asterisk_' : id);
	var $input = $(query, this.$container);
	var block = this.editor.blocks[source[0]];
	var zoom = this.canvas.getZoom();
	if (block) {
		if ($input.length) {
			var yy2 = y2 // from top of block container
					+ 7	 // center of row
					+ $input.position().top / zoom; // add position of variable
		} else {
			var yy2 = y2 + 36; // block header height + center of row
		}
		query = '.' + SmalldbEditor._namespace + '-outvar-' + (source[1] === '*' ? '_asterisk_' : source[1]);
		var $output = $(query, block.$container);
		var missing = $output.hasClass('missing');

		if (block.$container.find(query).length === 0) {
			block.addOutput(source[1]);
			this.canvas.redraw();
			return false;
		}

		var offset = block.position();
		var x1 = offset.left // from left of block container
				+ 1			 // offset
				+ block.$container.outerWidth(); // add container width
		var y1 = offset.top // from top of block container
				+ 7			// center of row
				+ block.$container.find(query).position().top / zoom; // add position of variable
		var color = color || (missing ? '#f00' : '#000');
		this.canvas._drawConnection(x1, y1, x2, yy2, color);
	} else {
		// block outside of this scope or not exists
		this.$container.find(query).addClass('missing').attr('title', _('Source of this connection may be invalid'));
	}
};

/**
 * Serializes current block to JSON object
 *
 * @returns {Object}
 */
State.prototype.serialize = function() {
	var B = {
		block: this.type,
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
