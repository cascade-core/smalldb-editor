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

	// canvas click - check for click on edge
	var ns = SmalldbEditor._namespace + '-editor-panel';
	$(document).off('click.' + ns).on('click.' + ns, $.proxy(function(e) {
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
};

/**
 * Creates action & edge options view
 * called by create()
 *
 * @private
 */
Editor.prototype._createEdgeView = function() {
	// action options
	var $title = $('<div class="' + this._namespace + '-title">');
	$title.text(_('Action options'));
	this.$container.append($title);

	// todo
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
		$select.find('option:first').after($('<option>').text(_('* Change action name')).val('__rename__'));
		$select.find('option:first').after($('<option>').text(_('* Create new action')).val('__create__'));
	} else {
		$select.prepend($('<option>').text(_('* Change action name')).val('__rename__'));
		$select.prepend($('<option>').text(_('* Create new action')).val('__create__'));
	}
	$name.append($select.val(this.item.action.id));
	this.$container.append($name);
	var act = this.item.action;
	var that = this;
	$select.on('change.' + this._namespace, function() {
		var val = $(this).val();
		if (val === '__rename__') {
			// todo not working, add unique constraint
			var name = window.prompt(_('New action name:'), act.id);
			if (act.id === name) {
				act.label = name;
			}
			if (that.item.label === name) {
				that.item.label = name;
			}
			act.id = name;
			that.editor.onChange();
		} else if (val === '__create__') {
			var name = window.prompt(_('Create new action:'));
			var a = new Action(name, { label: name }, that.editor);
			that.item.action.removeTransition(that.item);
			that.item.action = a;
			a.addTransition(name, that.item);
			that.item.color = a.color;
			that.item.label = a.label;
			that.editor.actions[name] = a;
			that.canvas.redraw();
			that.editor.onChange();
		}
	});
	$select.focus();

	var $label = $('<div class="' + this._namespace + '-row">');
	$label.append($('<label>').text(_('Label')));
	$label.append($('<input type="text">').val(this.item.action.label));
	this.$container.append($label);

	var $color = $('<div class="' + this._namespace + '-row">');
	$color.append($('<label>').text(_('Color')));
	$color.append($('<input type="text">').val(this.item.action.color));
	$color.append($('<div>').addClass(this._namespace + '-color').css('background', this.item.action.color));
	this.$container.append($color);

	// edge options
	$title = $('<div class="' + this._namespace + '-title">');
	$title.text(_('Edge options'));
	this.$container.append($title);

	// todo select
	var $source = $('<div class="' + this._namespace + '-row">');
	$source.append($('<label>').text(_('Source')));
	$source.append($('<input type="text">').val(this.item.source.split('-')[0]));
	this.$container.append($source);

	// todo select
	var $target = $('<div class="' + this._namespace + '-row">');
	$target.append($('<label>').text(_('Target')));
	$target.append($('<input type="text">').val(this.item.target));
	this.$container.append($target);

	var $label = $('<div class="' + this._namespace + '-row">');
	$label.append($('<label>').text(_('Label')));
	$label.append($('<input type="text">').val(this.item.label));
	this.$container.append($label);

	var $color = $('<div class="' + this._namespace + '-row">');
	$color.append($('<label>').text(_('Color')));
	$color.append($('<input type="text">').val(this.item.color));
	$color.append($('<div>').addClass(this._namespace + '-color').css('background', this.item.color));
	this.$container.append($color);
};

/**
 * Creates state options view
 * called by create()
 *
 * @private
 */
Editor.prototype._createStateView = function() {
	var $title = $('<div class="' + this._namespace + '-title">');
	$title.text(_('State options'));
	this.$container.append($title);

	var $name = $('<div class="' + this._namespace + '-row">');
	$name.append($('<label>').text(_('Name')));
	$name.append($('<input type="text">').val(this.item.id));
	this.$container.append($name);

	var $label = $('<div class="' + this._namespace + '-row">');
	$label.append($('<label>').text(_('Label')));
	$label.append($('<input type="text">').val(this.item.data.label));
	this.$container.append($label);

	var $color = $('<div class="' + this._namespace + '-row">');
	$color.append($('<label>').text(_('Color')));
	$color.append($('<input type="text">').val(this.item.data.color));
	$color.append($('<div>').addClass(this._namespace + '-color').css('background', this.item.data.color));
	this.$container.append($color);
};

/**
 * Checks whether string is valid JSON string
 *
 * @param {string} str
 * @returns {boolean}
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
 * @returns {boolean}
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
 * @returns {boolean}
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
