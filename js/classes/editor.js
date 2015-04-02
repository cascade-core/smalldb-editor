/**
 * state / transition editor
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
};

/**
 * Renders variable editor
 */
Editor.prototype.render = function() {
	// remove existing editors
	$('div.' + this._namespace).remove();

	// create new editor element
	this.create();
	this._bind();
	this.editor.$container.append(this.$container);
};

/**
 * Refresh editor
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
 * Creates variable editor container
 *
 * @param {String} [view] - mode of editor, defaults to 'summary', other options are 'edge' and 'state'
 * @param {State|Transition} [item] - item to edit (State or Transition instance)
 */
Editor.prototype.create = function(view, item) {
	view = view || 'summary';

	// create / wipe editor container
	if (this.$container) {
		this.$container.empty();
	} else {
		this.$container = $('<div class="' + this._namespace + '">');
	}

	// deactivate previous item
	if (this.item && this.item !== item) {
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
 * Creates summary view
 * called by create()
 *
 * @private
 */
Editor.prototype._createSummaryView = function() {
	var $title = $('<div class="' + this._namespace + '-title">');
	$title.text(_('Summary'));
	this.$container.append($title);

	// basic summary
	var $statesCount = $('<div class="' + this._namespace + '-row">');
	$statesCount.text(_('Total states count: '));
	$statesCount.append($('<strong>').text(this.countObject(this.editor.states)));
	this.$container.append($statesCount);

	var $actionsCount = $('<div class="' + this._namespace + '-row">');
	$actionsCount.text(_('Total actions count: '));
	$actionsCount.append($('<strong>').text(this.countObject(this.editor.actions) - 1));
	this.$container.append($actionsCount);
};

/**
 * Creates action & edge options view
 * called by create('edge')
 *
 * @private
 */
Editor.prototype._createEdgeView = function() {
	// action options
	var $title = $('<div class="' + this._namespace + '-title">');
	$title.text(_('Action options'));
	this.$container.append($title);

	this._createChangeActionSelect();

	if (this.item.action.id.indexOf('__') !== 0) { // do not display for internal states (start & end) and actions (noaction)
		this._addTextInputRow('label', 'Label', this.item.action.label);
		this._addColorInputRow('color', 'Color', this.item.action.color);
	}

	// edge options
	$title = $('<div class="' + this._namespace + '-title">');
	$title.text(_('Edge options'));
	this.$container.append($title);

	// rows
	this._addTextInputRow('source', 'Source', this.item.source.split('-')[0]); // todo select
	this._addTextInputRow('target', 'Target', this.item.target); // todo select
	this._addTextInputRow('label', 'Label', this.item.label);
	this._addColorInputRow('color', 'Color', this.item.color);
};

/**
 * Creates change action select
 *
 * @private
 */
Editor.prototype._createChangeActionSelect = function() {
	var $name = $('<div class="' + this._namespace + '-row">');
	$name.append($('<label>').text(_('Name')));
	var $select = $('<select></select>');
	for (var a in this.editor.actions) {
		var text = this.editor.actions[a].id;
		if (text === '__noaction__') {
			if (this.item.action.id === '__noaction__') {
				text = _('* Select action');
			} else {
				continue;
			}
		}
		$select.append($('<option>').text(text).val(a));
	}
	if (this.item.action.id === '__noaction__') {
		$select.find('option:first').after($('<option>').text(_('* Create new action')).val('__create__'));
	} else {
		$select.prepend($('<option>').text(_('* Rename action "%s"', [this.item.action.id])).val('__rename__'));
		$select.prepend($('<option>').text(_('* Create new action')).val('__create__'));
	}
	$name.append($select.val(this.item.action.id));
	this.$container.append($name);
	$select.on('change.' + this._namespace, this._changeAction.bind(this));
	$select.focus();
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
		if (act.id.toLowerCase() === act.label.toLowerCase) {
			// action name corresponds with transition label, change both
			act.label = name;
		}
		if (this.item.label === name) {
			this.item.label = name;
		}
		act.id = name;
	} else if (val === '__create__') {
		var name = this.getNewName(_('Create new action:'), '', this.editor.actions);
		var a = new Action(name, { label: name }, this.editor);
		act.removeTransition(this.item);
		this.item.action = a;
		a.addTransition(name, this.item);
		this.item.color = a.color;
		this.item.label = a.label;
		this.editor.actions[name] = a;
		this.canvas.redraw();
	} else { // change to existing action

	}
	this.editor.onChange();
};

/**
 * Creates state options view
 * called by create('state')
 *
 * @private
 */
Editor.prototype._createStateView = function() {
	// title
	var $title = $('<div class="' + this._namespace + '-title">');
	$title.text(_('State options'));
	this.$container.append($title);

	// rows
	if (this.item.id.indexOf('__') !== 0) { // do not display for internal states (start & end)
		this._addTextInputRow('name', 'Name', this.item.id);
		this._addTextInputRow('label', 'Label', this.item.data.label);
		this._addColorInputRow('color', 'Color', this.item.data.color);
	}

	// x / y position
	var $position = $('<div class="' + this._namespace + '-row">');
	$position.append($('<label>').text(_('Position')));
	$position.append($('<input type="text" class="small">').val(this.item.x).attr('title', _('X position')));
	$position.append($('<input type="text" class="small">').val(this.item.y).attr('title', _('Y position')));
	this.$container.append($position);
};

Editor.prototype._addColorInputRow = function(name, label, value) {
	var $row = this._addTextInputRow(name, label, value);
	$row.append($('<div>').addClass(this._namespace + '-' + name).css('background', value));
};

Editor.prototype._addTextInputRow = function(name, label, value) {
	var id = this._namespace + '-' + name;
	var $row = $('<div class="' + this._namespace + '-row">');
	$row.append($('<label>').attr('for', id).text(_(label)));
	$row.append($('<input type="text">').attr('id', id).val(value));
	this.$container.append($row);
	return $row;
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
	if (!e.shiftKey && code === 9) { // tab without shift => allow adding tabs to textarea
		return this._fixTabs(e);
	} else if ((e.metaKey || e.ctrlKey) && code === 13) { // ctrl + enter => save form
		return this._save();
	} else if (e.shiftKey && code === 9) { // shift + tab => focus type select
		var $type = this.$type;
		// wait for other events to propagate (changeType event focuses textarea, we need to focus after that)
		setTimeout(function() {
			$type.focus();
		}, 0);
		return false;
	}
};

/**
 * Allows sending tabs to textarea
 *
 * @param {KeyboardEvent} e - Event
 * @returns {Boolean}
 * @private
 */
Editor.prototype._fixTabs = function(e) {
	// get caret position
	var pos, r, re, rc;
	if (e.target.selectionStart) {
		pos = e.target.selectionStart;
	} else if (document.selection) {
		r = document.selection.createRange();
		if (r === null) {
			return true;
		}
		re = e.target.createTextRange();
		rc = re.duplicate();
		re.moveToBookmark(r.getBookmark());
		rc.setEndPoint('EndToStart', re);
		pos = rc.text.length;
	} else {
		pos = 0;
	}

	// update value
	var str = $(e.target).val();
	str = str.slice(0, pos) + '\t' + str.slice(pos);
	pos += 1;
	$(e.target).val(str);

	// set caret position
	if (e.target.selectionStart) {
		e.target.selectionStart = pos;
		e.target.selectionEnd = pos;
	} else if (document.selection) {
		var start = offsetToRangeCharacterMove(e.target, pos);
		re.move("character", start);
	}
	return false;
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
