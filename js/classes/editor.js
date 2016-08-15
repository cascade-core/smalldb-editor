/**
 * Editor panel, with state, transition and machine summary views
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {SmalldbEditor} editor - plugin instance
 * @class
 */
var Editor = function(editor) {
	this.editor = editor;
	this.canvas = editor.canvas;
	this.dontClose = false; // prevent setting default view when clicking on state or edge
	this._namespace = SmalldbEditor._namespace + '-editor-panel';
	// todo split reserver words into 3 categories (state, action, transition)
	this._reservedWords = ['state', 'x', 'y', 'id', 'name', 'label', 'source', 'target', 'targets', 'color', 'transitions', 'virtualStates', 'dagrePath'];
};

/**
 * Renders editor panel
 */
Editor.prototype.render = function() {
	// remove existing editors
	$('div.' + this._namespace).remove();

	// create new editor element
	this.create();
	this._bind();
	this.editor.$container.append(this.$containerHolder);
};

/**
 * Refresh editor panel
 */
Editor.prototype.refresh = function() {
	if (this.item instanceof Transition) {
		this.create('edge', this.item);
	} else if (this.item instanceof State) {
		this.create('state', this.item);
	} else {
		this.create();
	}
};

/**
 * Creates new control points, finds correct position in path
 *
 * @param {Transition} trans
 * @param {Point} pos
 * @private
 */
Editor.prototype._createNewCP = function(trans, pos) {
	var dist = [];
	if (!trans.dagrePath) {
		var states = this.editor.states;
		var s = trans.source.split('-')[0];
		var from = states[s].getBorderPoint(states[trans.target].center());
		var to = states[trans.target].getBorderPoint(states[s].center());
		trans.dagrePath = [from, to];
	}
	var path = trans.dagrePath;
	var min = Number.POSITIVE_INFINITY;
	var minPos = -1;
	for (var p in path) {
		dist[p] = pos.dist(path[p]);
		if (dist[p] < min) {
			min = dist[p];
			minPos = parseInt(p);
		}
	}

	// do not add points to the first place in path
	minPos = Math.max(minPos, 1);

	// fix position for edge cases
	if (minPos < path.length - 1) {
		var p1 = path[minPos - 1], p2 = path[minPos], p3 = path[minPos + 1];
		var l1 = new Line(p1, p2), l2 = new Line(p2, p3);
		var d1 = l1.dist(pos), d2 = l2.dist(pos);
		if (d1 > d2) {
			minPos++;
		}
	}

	// insert new point to path
	trans.dagrePath.splice(minPos, 0, pos);
};

/**
 * Binds close handler to close button and ESC key
 *
 * @returns {void}
 * @private
 */
Editor.prototype._bind = function() {
	// summary on escape
	$(document).off('keydown.editor').on('keydown.editor', $.proxy(function(e) {
		var code = e.keyCode ? e.keyCode : e.which;
		if (code === 27) {
			return this.create();
		} else if (code === 8 && (e.metaKey || e.ctrlKey)) {
			this._removeTransition();
		} else {
			return true;
		}
	}, this));

	if (!this.editor.options.viewOnly) {
		// canvas click - check for click on edge
		var ns = SmalldbEditor._namespace + '-editor-panel';
		$(document).off('click.' + ns).on('click.' + ns, $.proxy(function (e) {
			if (this.dontClose || !$(e.target).is('canvas')) {
				this.dontClose = false;
				return true;
			} else {
				// check for click on edge
				var pos = this.canvas.clickPosition(e, true);
				for (var a in this.editor.actions) {
					var act = this.editor.actions[a];
					for (var t in act.transitions) {
						var trans = act.transitions[t];
						if (trans.contains(pos)) {
							if (trans.isActive()) { // transition already active, create new control point
								this._createNewCP(trans, pos);
							}
							return trans.activate();
						}
					}
				}
				return this.create(); // otherwise show summary
			}
		}, this));
	}
};

/**
 * Creates editor panel container
 *
 * @param {String} [view] - mode of editor, defaults to 'summary', other options are 'edge' and 'state'
 * @param {State|Transition} [item] - item to edit (State or Transition instance)
 * @param {Boolean} [multiple] - allow selection of multiple states, defaults to false (removes selection first)
 */
Editor.prototype.create = function(view, item, multiple) {
	view = view || 'summary';
	this.multiple = multiple || false;

	if (!this.$containerHolder) {
		this.$containerHolder = $('<div class="' + this._namespace + '">');
	}

	// create / wipe editor container
	if (this.$container) {
		this.$container.empty();
	} else {
		this.$container = $('<table class="' + this._namespace + '-content">');
		this.$containerHolder.append(this.$container);
	}

	// set column widths
	this.$container.append('<col width="30%">');
	this.$container.append('<col width="70%">');
	this.$container.append('<col>');

	// deactivate previous item
	if (!this.multiple && this.item && this.item !== item) {
		this.item.deactivate();
		delete this.item;
	}

	// create view method name
	var method = view.charAt(0).toUpperCase() + view.slice(1); // capitalize first letter
	method = '_create' + method + 'View';
	this.item = item;
	this[method]();
};

/**
 * Creates summary view,
 * called by create()
 *
 * @private
 */
Editor.prototype._createSummaryView = function() {
	// Summary
	this.$container.append(
			$('<tr class="' + this._namespace + '-title">').append(
				$('<th colspan="3">').text(_('Summary'))
			),
			$('<tr>').append(
				$('<td colspan="3">').append(
					$('<p>')
						.text(_('Total states count: '))
						.append($('<strong>').text(this.countObject(this.editor.states)))
				)
			),
			$('<tr>').append(
				$('<td colspan="3">').append(
					$('<p>')
						.text(_('Total actions count: '))
						.append($('<strong>').text(this.countObject(this.editor.actions) - 1)) // do not count __noaction__
				)
			)
		);

	// Machine properties
	$title = $('<tr class="' + this._namespace + '-title">');
	$title.append($('<th colspan="3">').text(_('Machine properties')));
	this.$container.append($title);

	for (var key in this.editor.properties) {
		if (['_', 'actions', 'states', 'virtualStates'].indexOf(key) === -1) {
			var value = this.editor.properties[key];
			var label = key;
			this._addTextInputRow(key, label, value);
		}
	}

	// add new machine property button
	var $addProp = $('<a href="#add-property">');
	$addProp.text(_('Add new property'));
	$addProp.addClass(this._namespace + '-add-prop');
	$addProp.on('click', this._addNewProperty(this.editor.properties));
	this.$container.append($('<tr>').append($('<td colspan="3">').append($addProp)));
};

/**
 * Creates action & edge options view,
 * called by create('edge')
 *
 * @private
 */
Editor.prototype._createEdgeView = function() {
	// action options
	var $title = $('<tr class="' + this._namespace + '-title">');
	var $add = $('<a href="#add-new-action">');
	var className = SmalldbEditor._namespace + '-create-action';
	$add.html('<i class="fa fa-fw fa-plus-circle"></i> +');
	$add.attr('title', 'Create new action');
	$add.attr('href', '#fullscreen');
	$add.addClass(className);
	$add.on('click', function() {
		this.$container.find('select').val('__create__').change();
		return false;
	}.bind(this));
	var $edit = $('<a href="#add-new-action">');
	var className = SmalldbEditor._namespace + '-rename-action';
	$edit.html('<i class="fa fa-fw fa-edit"></i> E');
	$edit.attr('title', _('Rename action "%s"', [this.item.action.id]));
	$edit.attr('href', '#fullscreen');
	$edit.addClass(className);
	$edit.on('click', function() {
		this.$container.find('select').val('__rename__').change();
		return false;
	}.bind(this));
	$title.append($('<th colspan="3">')
		.text(_('Action options'))
		.append($add)
		.append($edit));
	this.$container.append($title);

	this._createChangeActionSelect();

	if (this.item.action.id.indexOf('__') !== 0) { // do not display for internal states (start & end) and actions (noaction)
		// change both action and transition labes when equal (for all attached transitions)
		this._addTextInputRow('label', 'Label', this.item.action.label, this.item.action, true, function(e) {
			var val = $(e.target).val();
			var tr = this.item.action.transitions;
			for (var t in tr) {
				if (this.item.action.label === tr[t].label) {
					tr[t].label = val;
					if (this.item === tr[t]) {
						$('#smalldb-editor-editor-panel-label-' + this.item.key).val(val);
					}
				}
			}
		});
		this._addColorInputRow('color', 'Color', this.item.action.color, this.item.action, function(e) {
			var val = $(e.target).val();
			var tr = this.item.action.transitions;
			for (var t in tr) {
				if (this.item.action.color === tr[t].color) {
					tr[t].color = val;
					if (this.item === tr[t]) {
						var id = '#' + this._namespace + '-color-' + this.item.key;
						$(id).val(val);
						//$(id).next().css('background', val);
						if (val.length === 4) {
							// #xyz => #xxyyzz
							val = '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
						}
						if (val.length === 7) {
							$(id).find('+ div > input[type=color]').val(val);
						}
					}
				}
			}
		});

		// rest of action's properties
		for (var key in this.item.action.data) {
			if (this._reservedWords.indexOf(key) === -1) {
				var value = this.item.action.data[key];
				var label = key;
				this._addTextInputRow(key, label, value, this.item.action);
			}
		}

		// add new action property button
		var $addProp = $('<a href="#add-property">');
		$addProp.text(_('Add new property'));
		$addProp.addClass(this._namespace + '-add-prop');
		$addProp.on('click', this._addNewProperty(this.item.action.data));
		this.$container.append($('<tr class="' + this._namespace + '-row">').append($('<td colspan="3">').append($addProp)));
	}

	// edge options
	this.$container.append($('<tr class="' + this._namespace + '-title">')
			.append($('<th colspan="3">')
			.text(_('Transition options'))));

	// rows
	var src = this.item.source.split('-')[0];
	if (src.indexOf('__') === 0) {
		src = src.substring(2, src.length - 2);
	}
	var tgt = this.item.target.split('-')[0];
	if (tgt.indexOf('__') === 0) {
		tgt = tgt.substring(2, tgt.length - 2);
	}
	var $row = this._addTextInputRow('source', 'Source', src, this.item);
	$row.find('input').prop('disabled', true);
	$row = this._addTextInputRow('target', 'Target', tgt, this.item);
	$row.find('input').prop('disabled', true);
	this._addTextInputRow('label', 'Label', this.item.label, this.item, true);
	this._addColorInputRow('color', 'Color', this.item.color, this.item);

	// rest of transition's properties
	for (var key in this.item.data) {
		if (this._reservedWords.indexOf(key) === -1) {
			var value = this.item.data[key];
			var label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '); // capitalize first letter
			this._addTextInputRow(key, label, value, this.item);
		}
	}

	// add new edge property button
	$addProp = $('<a href="#add-property">');
	$addProp.text(_('Add new property'));
	$addProp.addClass(this._namespace + '-add-prop');
	$addProp.on('click', this._addNewProperty(this.item.data));

	// remove button
	var $remove = $('<a href="#remove">');
	$remove.text(_('Remove transition'));
	$remove.addClass(this._namespace + '-remove');
	$remove.on('click', this._removeTransition.bind(this));

	this.$container.append($('<tr class="' + this._namespace + '-row">')
			.append($('<td colspan="3">')
			.append($addProp)
			.append($remove)));
};

/**
 * Creates new property
 *
 * @param {State|Action|Transition} object
 * @private
 */
Editor.prototype._addNewProperty = function(object) {
	return function() {
		var name = '';
		do {
			name = window.prompt('Property name:', name);
			if (!name || this._reservedWords.indexOf(name) === -1) {
				break
			} else {
				alert(_('\'%s\' is a reserved word, please choose another one!', [name]));
			}
		} while (true);
		if (name) {
			var key = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
			object[key] = "";
			this.refresh();
			$('#' + this._namespace + '-' + key).focus();
		}
		return false;
	}.bind(this);
};

/**
 * Removes active transition, used as onclick handler
 *
 * @private
 */
Editor.prototype._removeTransition = function() {
	if (this.item.label) {
		var text = _('Do you wish to remove transition "%s"?', [this.item.label]);
	} else {
		var text = _('Do you wish to remove this transition?');
	}
	if (window.confirm(text)) {
		this.item.remove();
		this.create();
	}
};

/**
 * Creates change action <select>
 *
 * @private
 */
Editor.prototype._createChangeActionSelect = function() {
	var id = this._namespace + '-action_name';
	var $select = $('<select>');
	$select.attr('id', id);
	for (var a in this.editor.actions) {
		if (a === '__noaction__') {
			continue;
		}
		var text = this.editor.actions[a].id;
		$select.append($('<option>').text(text).val(a));
	}
	if (this.item.action.id === '__noaction__') {
		$select.prepend($('<option>').text(_('* Create new action')).val('__create__'));
		$select.prepend($('<option>').text(_('* Select action')).val('__noaction__'));
	} else {
		$select.prepend($('<option>').text(_('* Rename action "%s"', [this.item.action.id])).val('__rename__'));
		$select.prepend($('<option>').text(_('* Create new action')).val('__create__'));
	}
	$select.val(this.item.action.id);
	$select.on('change.' + this._namespace, this._changeAction.bind(this));
	$select.on('focus', this._onInputFocus.bind(this));
	$select.on('blur', this._onInputBlur.bind(this));

	this.$container.append(
		$('<tr>').append(
			$('<th>').append(
				$('<label>').attr('for', id).text(_('Name'))
			),
			$('<td colspan="2">').append($select)
		));

	if (this.item.action.id === '__noaction__') {
		$select.focus();
	}
};

/**
 * Change action handler
 *
 * @param {Event} e
 * @private
 */
Editor.prototype._changeAction = function(e) {
	var act = this.item.action;
	var val = $(e.target).val();
	if (val === '__rename__') {
		var name = this.getNewName(_('Rename action "%s":', [act.id]), act.id, this.editor.actions);
		var tr = act.transitions;
		for (var t in tr) {
			if (act.label === tr[t].label) {
				// action name corresponds with transition label, change both
				tr[t].label = name;
			}
		}
		if (act.id.toLowerCase() === act.label.toLowerCase()) {
			act.label = name;
		}

		var old = act.id;
		act.id = name;
		delete this.editor.actions[old];
		this.editor.actions[act.id] = act;
		this.refresh();
		this.$container.find('select').val(name);
		this.canvas.redraw();
	} else if (val === '__create__') {
		var name = this.getNewName(_('Create new action:'), '', this.editor.actions);
		var a = new Action(name, { label: name }, this.editor);
		act.removeTransition(this.item);
		this.item.action = a;
		a.addTransition(name, this.item);
		this.item.color = a.color;
		this.item.label = a.label;
		this.editor.actions[name] = a;
		this.$container.find('select').val(name);
		this.canvas.redraw();
	} else { // change to existing action
		this.item.setAction(this.editor.actions[val]);
		this.refresh();
	}
	this.editor.onChange();
};

/**
 * Creates state options view,
 * called by create('state')
 *
 * @private
 */
Editor.prototype._createStateView = function() {
	// Title
	this.$container.append(
			$('<tr class="' + this._namespace + '-title">').append(
				$('<th colspan="3">').text(_('State options'))
			)
		);

	// rows
	if (this.item.id.indexOf('__') !== 0) { // do not display for internal states (start & end)
		this._addTextInputRow('id', 'Name', this.item.id, this.item);
		this._addTextInputRow('label', 'Label', this.item.label, this.item, true);
		this._addColorInputRow('color', 'Color', this.item.color, this.item);
	}

	// x / y position
	this.$container.append($('<tr>').append(
			$('<th>').append(
				$('<label>').text(_('Position'))
			),
			$('<td>').append(
				$('<label>').append(
					$('<input type="text" class="small" disabled>').val(this.item.x).attr('title', _('X position')),
					$('<input type="text" class="small" disabled>').val(this.item.y).attr('title', _('Y position'))
				)
			),
			$('<td>')
		));

	// dynamic variables
	for (var key in this.item.data) {
		if (this._reservedWords.indexOf(key) === -1) {
			var value = this.item.data[key];
			var label = key;
			this._addTextInputRow(key, label, value, this.item);
		}
	}

	if (this.item.id.indexOf('__') !== 0) { // do not display for internal states (start & end)
		// add new state property button
		var $addProp = $('<a href="#add-property">')
			.text(_('Add new property'))
			.addClass(this._namespace + '-add-prop')
			.on('click', this._addNewProperty(this.item.data));

		// remove button
		var $remove = $('<a href="#remove">')
			.text(_('Remove state'))
			.addClass(this._namespace + '-remove')
			.on('click', this.item.removeHandler.bind(this.item));

		this.$container.append($('<tr>').append(
				$('<td colspan="3">').append(
					$addProp, $remove
				)
			));
	}
};

/**
 * Creates color input row with label and remove button
 *
 * @param {String} key
 * @param {String} label
 * @param {String} value
 * @param {Object} object
 * @param {Function} [cb] -  additional callback, executed before saving
 * @return {jQuery} - row <div> object
 * @private
 */
Editor.prototype._addColorInputRow = function(key, label, value, object, cb) {
	var $row = this._addTextInputRow(key, label, value, object, true, cb);
	$row.addClass(this._namespace + '-color');

	var $firstInput = $row.find('input:first');

	var $color = $('<input type="color">')
		.addClass(this._namespace + '-color-preview')
		.val(value)
		.on('focus', this._onInputFocus.bind(this))
		.on('blur', this._onInputBlur.bind(this))
		.on('change', function() {
			var val = $(this).val();
			$firstInput.val(val).keyup();
		})
		.change();

	$firstInput.on('keyup', function() {
		var val = $(this).val();
		if (val.length === 4) {
			// #xyz => #xxyyzz
			val = '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
		}
		if (val.length === 7) {
			$color.val(val);
		}
	});

	$firstInput.after($color);
	return $row;
};

/**
 * Creates handler for property removal
 *
 * @param {String} key
 * @param {Object} object
 * @return {Function(this:Editor)}
 * @private
 */
Editor.prototype._removeProperty = function(key, object) {
	return function() {
		if (window.confirm(_('Do you realy want to remove property \'%s\'?', [key]))) {
			delete object[key];
			if ('properties' in object) {
				delete object.properties[key];
			}
			if ('data' in object) {
				delete object.data[key];
			}
			this.editor.onChange();
			this.refresh();
		}
		return false;
	}.bind(this);
};

/**
 * Creates text input row with label and remove button
 *
 * @param {String} key
 * @param {String} label
 * @param {String} value
 * @param {Object} object
 * @param {Boolean} [live] - bind keyup event insted of change event defaults to false
 * @param {Function} [cb] -  additional callback, executed before saving
 * @return {jQuery} - row <div> object
 * @private
 */
Editor.prototype._addTextInputRow = function(key, label, value, object, live, cb) {
	var json = typeof(value) === 'object';
	value = json ? JSON.stringify(value) : value;
	object = object || this.item || this.editor.properties;

	// create unique id - append transition key suffix when available
	var id = this._namespace + '-' + key + (object instanceof Transition ? '-' + this.item.key : '');

	var $input = $('<input type="text">')
		.attr('id', id)
		.val(value)
		.on('keydown', this._keydown.bind(this))
		.on(live ? 'keyup' : 'change', this._createSaveCallback(object, key, json, live))
		.on('focus', this._onInputFocus.bind(this))
		.on('blur', this._onInputBlur.bind(this));
	if (cb) {
		$input.on(live ? 'keyup' : 'change', cb.bind(this));
	}

	var $remove = null;
	if (this._reservedWords.indexOf(key) === -1) {
		$remove = $('<a href="#remove-prop" tabindex="-1">')
			.addClass(this._namespace + '-remove-prop')
			.html(_('&times;'))
			.attr('title', _('Remove property \'%s\'', [key]))
			.on('click', this._removeProperty(key, object));
	}

	var $row = $('<tr>').append(
			$('<th>').append(
				$('<label>').attr('for', id).text(label)
			),
			$('<td>').append(
				$('<label>').append(
					$input
				)
			),
			$('<td>').append(
				$remove
			)
		);

	this.$container.append($row);
	return $row;
};

/**
 * Adds class to nearest <tr> parent on focus
 */
Editor.prototype._onInputFocus = function(ev) {
	$(ev.target).parents('tr:first').addClass(this._namespace + '-focus');
};

/**
 * Reverts effect of _onInputFocus
 */
Editor.prototype._onInputBlur = function(ev) {
	$(ev.target).parents('tr:first').removeClass(this._namespace + '-focus');
};

/**
 * Creates on change handler that instantly saves current value to given object
 *
 * @param {Object} object
 * @param {String} key
 * @param {Boolean} json
 * @param {Boolean} [live] - if true, the property influences visual representation of the element (default: false)
 * @return {Function}
 * @private
 */
Editor.prototype._createSaveCallback = function(object, key, json, live) {
	return function(e) {
		var value = $(e.target).val();
		console.log('Save:', value, "->", key);
		if (json) {
			try {
				value = JSON.parse(value);
			} catch (e) {
				alert(_('Provided string in property \'%s\' is not valid JSON!', [key]));
				// wait to blur event occur, then focus again the invalid input
				setTimeout(function() {
					$(e.target).focus();
				}, 0);
				return false;
			}
		}
		if (object[key] === value) {
			return false;
		}
		object[key] = value;
		if ('properties' in object) {
			object.properties[key] = value;
		}
		if ('data' in object) {
			object.data[key] = value;
		}
		this.editor.onChange(true);

		if (!live) {
			return false;
		}
		if ('redraw' in object) {
			object.redraw();
		}
		this.canvas.redraw();
	}.bind(this);
};

/**
 * Checks whether string is valid JSON string
 *
 * @param {String} str
 * @returns {Boolean}
 * @private
 */
Editor.prototype._isValidJson = function(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
};

/**
 * Keydown handler that allows adding tab keys and sending form with CTRL + enter
 *
 * @param {KeyboardEvent} e - Event
 * @returns {Boolean}
 * @private
 */
Editor.prototype._keydown = function(e) {
	var code = e.keyCode ? e.keyCode : e.which;
	if (code === 13) { // set focus to next input on enter
		var $next = $(e.target).parent().next().find('input:text:not(:disabled)');
		if (!$next[0]) { // skip disabled row
			$next = $(e.target).parent().next().next().find('input:text:not(:disabled)');
		}
		if (!$next[0]) { // end, go to add property button
			$next = $(e.target).parent().next().find('a.' + this._namespace + '-add-prop');
		}
		$next.focus();
	}
};

/**
 * Gets new state name
 *
 * @param {String} text - already translated text to prompt
 * @param {String} [value]
 * @param {String[]} [taken] - already taken names
 * @returns {?String}
 */
Editor.prototype.getNewName = function(text, value, taken) {
	var old = value;
	var name = null;
	while (name === null) {
		name = window.prompt(text, old);

		if (name === null) {
			return name;
		} else if (!name.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
			alert(_('Only letters, numbers and underscore are allowed and the first character must be a letter.'));
			old = name;
			name = null;
		} else if (taken && name in taken) {
			alert(_('This name is already taken.'));
			old = name;
			name = null;
		}
	}

	return name;
};

/**
 * Returns count of items defined in object
 *
 * @param {Object} obj
 * @return {Number}
 */
Editor.prototype.countObject = function(obj) {
	var size = 0, key;
	for (key in obj) {
		if (obj.hasOwnProperty(key)) {
			size++;
		}
	}
	return size;
};
