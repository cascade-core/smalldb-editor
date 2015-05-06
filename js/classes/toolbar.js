/**
 * Toolbar class
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {SmalldbEditor} editor - reference to plugin instance
 * @class
 * @todo select v properties TB / LR - fa-refresh ico
 * @todo select v properties na algoritmus tarjan / dagre
 * @todo select v properties na min padding mezi uzly - maly a stredni ctverec, velky obdelnik na sirku / vysku
 */
var Toolbar = function(editor) {
	this.editor = editor;
	this.canvas = editor.canvas;
	this._zoom = this.canvas.getZoom();
	this._zoomStep = 0.1;
	this._zoomMax = 3.0;
	this._zoomMin = 0.3;
};

/**
 * Creates button element
 *
 * @param {String} name
 * @param {String} icon
 * @param {String} title
 * @param {Boolean} [enable=false]
 * @param {String} [letter]
 * @returns {jQuery}
 * @private
 */
Toolbar.prototype._createButton = function (name, icon, title, enabled, letter) {
	var $btn = $('<a>');
	var className = SmalldbEditor._namespace + '-' + name;
	letter = letter || name.charAt(0).toUpperCase();
	$btn.html('<i class="fa fa-fw fa-' + icon + '"></i> ' + letter);
	$btn.attr('title', title);
	$btn.attr('href', '#' + name);
	$btn.addClass(className);
	if (!enabled) {
		$btn.addClass('disabled')
	}
	return $btn;
};

/**
 * Renders toolbar
 *
 * @param {jQuery} $container
 * @returns {void}
 */
Toolbar.prototype.render = function($container) {
	if (this._rendered) {
		// prevent multiple rendering
		return false;
	}

	this._rendered = true;
	this.$container = $container;
	this.$toolbar = $('<div>');
	this.$toolbar.addClass(SmalldbEditor._namespace + '-toolbar');

	var $divider = $('<div>').addClass(SmalldbEditor._namespace + '-toolbar-divider');

	// undo button
	this.$undo = $('<a>').addClass('disabled');
	var className = SmalldbEditor._namespace + '-undo';
	this.$undo.html('<i class="fa fa-fw fa-undo"></i> &larr;');
	this.$undo.attr('title', 'Redo [Ctrl + Z]');
	this.$undo.attr('href', '#undo');
	this.$undo.addClass(className);
	$(document).on('click', 'a.' + className, this._undo.bind(this));
	this.$toolbar.append(this.$undo);

	// redo button
	this.$redo = $('<a>').addClass('disabled');
	className = SmalldbEditor._namespace + '-redo';
	this.$redo.html('<i class="fa fa-fw fa-repeat"></i> &rarr;');
	this.$redo.attr('title', 'Undo [Ctrl + Shift + Z]');
	this.$redo.attr('href', '#redo');
	this.$redo.addClass(className);
	$(document).on('click', 'a.' + className, this._redo.bind(this));
	this.$toolbar.append(this.$redo);

	this.$toolbar.append($divider.clone());

	// copy button
	this.$copy = $('<a>').addClass('disabled');
	className = SmalldbEditor._namespace + '-copy';
	this.$copy.html('<i class="fa fa-fw fa-copy"></i> C');
	this.$copy.attr('title', 'Copy active state [Ctrl + C]');
	this.$copy.attr('href', '#copy');
	this.$copy.addClass(className);
	$(document).on('click', 'a.' + className, this._copy.bind(this));
	this.$toolbar.append(this.$copy);

	// cut button
	this.$cut = $('<a>').addClass('disabled');
	className = SmalldbEditor._namespace + '-cut';
	this.$cut.html('<i class="fa fa-fw fa-cut"></i> X');
	this.$cut.attr('title', 'Cut active state [Ctrl + X]');
	this.$cut.attr('href', '#cut');
	this.$cut.addClass(className);
	$(document).on('click', 'a.' + className, this._cut.bind(this));
	this.$toolbar.append(this.$cut);

	// paste button
	this.$paste = $('<a>').addClass('disabled');
	className = SmalldbEditor._namespace + '-paste';
	this.$paste.html('<i class="fa fa-fw fa-paste"></i> P');
	this.$paste.attr('title', 'Paste state [Ctrl + V]');
	this.$paste.attr('href', '#paste');
	this.$paste.addClass(className);
	$(document).on('click', 'a.' + className, this._paste.bind(this));
	this.$toolbar.append(this.$paste);

	this.$toolbar.append($divider.clone());

	// zoom in button
	this.$zoomIn = $('<a>').addClass('disabled');
	className = SmalldbEditor._namespace + '-zoom-in';
	this.$zoomIn.html('<i class="fa fa-fw fa-search-plus"></i> +');
	this.$zoomIn.attr('title', 'Zoom in [+ / =]');
	this.$zoomIn.attr('href', '#zoom-in');
	this.$zoomIn.addClass(className);
	$(document).on('click', 'a.' + className, this._zoomIn.bind(this));
	this.$toolbar.append(this.$zoomIn);

	// zoom out button
	this.$zoomOut = $('<a>').addClass('disabled');
	className = SmalldbEditor._namespace + '-zoom-out';
	this.$zoomOut.html('<i class="fa fa-fw fa-search-minus"></i> -');
	this.$zoomOut.attr('title', 'Zoom out [-]');
	this.$zoomOut.attr('href', '#zoom-out');
	this.$zoomOut.addClass(className);
	$(document).on('click', 'a.' + className, this._zoomOut.bind(this));
	this.$toolbar.append(this.$zoomOut);

	// zoom reset button
	this.$zoomReset = $('<a>').addClass('disabled');
	className = SmalldbEditor._namespace + '-zoom-reset';
	this.$zoomReset.html('<i class="fa fa-fw fa-desktop"></i> 0');
	this.$zoomReset.attr('title', 'Reset zoom [0]');
	this.$zoomReset.attr('href', '#zoom-reset');
	this.$zoomReset.addClass(className);
	$(document).on('click', 'a.' + className, this._zoomReset.bind(this));
	this.$toolbar.append(this.$zoomReset);

	this.$toolbar.append($divider.clone());

	// toggle cycles button
	this.$cycles = $('<a>');
	className = SmalldbEditor._namespace + '-cycles';
	this.$cycles.html('<i class="fa fa-fw fa-dot-circle-o"></i> C');
	this.$cycles.attr('title', 'Toggle cycles visibility [Ctrl + Shift + O]');
	this.$cycles.attr('href', '#toggle-cycles');
	this.$cycles.addClass(className);
	$(document).on('click', 'a.' + className, this._toggleCycles.bind(this));
	this.$toolbar.append(this.$cycles);

	// toggle control points button
	this.$controlPoints = $('<a>');
	className = SmalldbEditor._namespace + '-control-points';
	this.$controlPoints.html('<i class="fa fa-fw fa-eye-slash"></i> P');
	this.$controlPoints.attr('title', 'Toggle control points visibility [Ctrl + Shift + P]');
	this.$controlPoints.attr('href', '#toggle-cycles');
	this.$controlPoints.addClass(className);
	$(document).on('click', 'a.' + className, this._toggleControlPoints.bind(this));
	this.$toolbar.append(this.$controlPoints);

	// automatic layout button
	this.$layout = $('<a>');
	className = SmalldbEditor._namespace + '-layout';
	this.$layout.html('<i class="fa fa-fw fa-code-fork"></i> L');
	this.$layout.attr('title', 'Set automatic layout [Ctrl + L]');
	this.$layout.attr('href', '#layout');
	this.$layout.addClass(className);
	$(document).on('click', 'a.' + className, this._automaticLayout.bind(this));
	this.$toolbar.append(this.$layout);

	// automatic edge colors button
	this.$colors = $('<a>');
	className = SmalldbEditor._namespace + '-colors';
	this.$colors.html('<i class="fa fa-fw fa-flask"></i> C');
	this.$colors.attr('title', 'Assign random color to each action [Ctrl + O]');
	this.$colors.attr('href', '#action-colors');
	this.$colors.addClass(className);
	$(document).on('click', 'a.' + className, this._automaticEdgeColors.bind(this));
	this.$toolbar.append(this.$colors);

	// rotate button
	this.$rotate = this._createButton('rotate', 'refresh fa-flip-horizontal', 'Rotate automaton [Shift + R]', true);
	$(document).on('click', 'a.' + SmalldbEditor._namespace + '-rotate', this._rotate.bind(this));
	this.$toolbar.append(this.$rotate);

	$(document).off('keydown.toolbar').on('keydown.toolbar', this._keydown.bind(this));

	// disable selection
	$(document).off('click.disable-selection', this.canvas.$container)
		.on('click.disable-selection', this.canvas.$container, this.disableSelection.bind(this));

	// right toolbar
	this.$right = $('<div>');
	this.$right.addClass(SmalldbEditor._namespace + '-toolbar-right');

	// help button
	this.$help = this._createButton('help', 'lightbulb-o', 'Help [Ctrl + H]', true);
	$(document).on('click', 'a.' + SmalldbEditor._namespace + '-help', this._toggleHelp.bind(this));
	this.$right.append(this.$help);

	// fullscreen button
	this.$fullscreen = this._createButton('fullscreen-toggle', 'arrows-alt', 'Toggle fullscreen [Ctrl + Shift + F]', true);
	$(document).on('click', 'a.' + SmalldbEditor._namespace + '-fullscreen-toggle', this._toggleFullScreen.bind(this));
	this.$right.append(this.$fullscreen);

	this.$container.append(this.$toolbar);
	this.$container.append(this.$right);
	this.updateDisabledClasses();
};

/**
 * Disables state selection, used as on click handler
 *
 * @param {MouseEvent} [e] - Event
 */
Toolbar.prototype.disableSelection = function(e) {
	if (!e || ($(e.target).is('canvas') && !this.canvas.selection)) {
		for (var id in this.editor.states) {
			this.editor.states[id].deactivate();
		}
	}
	this.canvas.selection = false;
};

/**
 * Toggles cycles visibility
 *
 * @private
 */
Toolbar.prototype._toggleCycles = function() {
	var $i = this.$cycles.find('i');
	$i.toggleClass('fa-dot-circle-o');
	$i.toggleClass('fa-circle-o');
	this.canvas.renderCycles = $i.hasClass('fa-dot-circle-o');
	this.canvas.redraw();
	return false;
};

/**
 * Toggles control points visibility
 *
 * @private
 */
Toolbar.prototype._toggleControlPoints = function() {
	var $i = this.$controlPoints.find('i');
	$i.toggleClass('fa-eye-slash');
	$i.toggleClass('fa-eye');
	this.editor.showControlPoints = $i.hasClass('fa-eye');
	$('.' + SmalldbEditor._namespace + '-control-point').remove();
	this.canvas.redraw();
	return false;
};

/**
 * Assigns action colors automatically
 *
 * @private
 */
Toolbar.prototype._automaticEdgeColors = function() {
	var colors = JSON.parse(JSON.stringify(Action.colors)); // copy to tmp array
	for (var a in this.editor.actions) {
		if (a === '__noaction__') {
			continue;
		}
		var c = Math.floor(Math.random() * colors.length);
		var act = this.editor.actions[a];
		act.color = colors[c];
		for (var t in act.transitions) {
			act.transitions[t].color = act.color;
		}
		colors.splice(c, 1);
	}
	this.editor.onChange();
	this.canvas.redraw();
	return false;
};

/**
 * Assigns state positions automatically
 *
 * @private
 */
Toolbar.prototype._automaticLayout = function() {
	this.editor.placeStates(true);
	return false;
};

/**
 * Keydown handler, binds keyboard shortcuts
 *
 * @param {KeyboardEvent} e - Event
 * @returns {Boolean}
 * @private
 */
Toolbar.prototype._keydown = function(e) {
	// set timeout for loosing hover
	setTimeout(function() {
		$('.' + SmalldbEditor._namespace + '-toolbar a.hover').removeClass('hover');
	}, 150);

	// ignore key binding when inside input / select / textarea
	if ($(e.target).is('input, select, textarea')) {
		return true;
	}

	var code = e.keyCode ? e.keyCode : e.which;
	if ((e.metaKey || e.ctrlKey) && code === 65) { // ctrl + a => select all states
		for (var id in this.editor.states) {
			this.editor.states[id].activate(true);
		}
		return false;
	} else if ((e.metaKey || e.ctrlKey) && code === 72) { // ctrl + h => help
		this.$help.addClass('hover');
		this._toggleHelp();
		return false;
	} else if (e.shiftKey && code === 82) { // shift + r => rotate
		this.$rotate.addClass('hover');
		this._rotate();
	} else if ((e.metaKey || e.ctrlKey) && code === 67) { // ctrl + c => copy
		this.$copy.addClass('hover');
		this._copy();
	} else if ((e.metaKey || e.ctrlKey) && code === 86) { // ctrl + v => paste
		this.$paste.addClass('hover');
		this._paste();
	} else if ((e.metaKey || e.ctrlKey) && code === 88) { // ctrl + x => cut
		this.$cut.addClass('hover');
		this._cut();
	} else if ((e.metaKey || e.ctrlKey) && e.shiftKey && code === 90) { // ctrl + shift + z => redo
		this.$redo.addClass('hover');
		this._redo();
	} else if ((e.metaKey || e.ctrlKey) && code === 90) { // ctrl + z => undo
		this.$undo.addClass('hover');
		this._undo();
	} else if ((e.metaKey || e.ctrlKey) && code === 76) { // ctrl + l => automatic layout
		this.$layout.addClass('hover');
		this._automaticLayout();
	} else if ((e.metaKey || e.ctrlKey) && e.shiftKey && code === 70) { // ctrl + shift + f => fullscreen
		this.$fullscreen.addClass('hover');
		this._toggleFullScreen();
		return false;
	} else if ((e.metaKey || e.ctrlKey) && e.shiftKey && code === 79) { // ctrl + shift + o => toggle cycles
		this.$cycles.addClass('hover');
		this._toggleCycles();
		return false;
	} else if ((e.metaKey || e.ctrlKey) && e.shiftKey && code === 80) { // ctrl + shift + o => toggle cycles
		this.$controlPoints.addClass('hover');
		this._toggleControlPoints();
		return false;
	} else if ((e.metaKey || e.ctrlKey) && code === 79) { // ctrl + o => automatic action colors
		this.$colors.addClass('hover');
		this._automaticEdgeColors();
		return false;
	} else if (code === 46 || ((e.metaKey || e.ctrlKey) && code === 8)) { // del / ctrl + backspace => remove selection
		if (!window.confirm(_('Do you realy want to delete selected states?'))) {
			return false;
		}
		for (var id in this.editor.states) {
			if (this.editor.states[id].isActive()) {
				this.editor.states[id].remove();
			}
		}
		this.canvas.redraw();
	} else if (code === 27) { // esc => disable selection
		for (var id in this.editor.states) {
			this.editor.states[id].deactivate();
		}
	} else if (code === 48) { // 0 => reset zoom
		this._zoomReset();
	} else if (code === 189) { // - => zoom out
		this._zoomOut();
	} else if (code === 187) { // = / + => zoom in
		this._zoomIn();
	}
};

/**
 * Toggles fullscreen mode
 *
 * @returns {Boolean}
 * @private
 */
Toolbar.prototype._toggleFullScreen = function() {
	var shift = this.editor.$container[0].getBoundingClientRect();
	var position = [this.canvas.$container.scrollLeft(), this.canvas.$container.scrollTop()];
	var $el = this.editor.$container.detach();
	$el.toggleClass(SmalldbEditor._namespace + '-fullscreen');

	if (this._fullscreen) {
		this.editor.$el.after($el);
		this.canvas.$container.css({
			width: this.editor.$container.width(),
			height: this.editor.$container.height()
		});
		position[0] += this._shift.left;
		position[1] += this._shift.top;
	} else {
		this._shift = {
			left: shift.left,
			top: shift.top
		};
		$('body').append($el);
		shift = this.editor.$container[0].getBoundingClientRect();
		this._shift.top -= shift.top;
		this._shift.left -= shift.left;
		this.canvas.$container.css({
			width: '100%',
			height: '100%'
		});
		position[0] -= this._shift.left;
		position[1] -= this._shift.top;
	}
	this.canvas.$container.scrollLeft(position[0]);
	this.canvas.$container.scrollTop(position[1]);

	this._fullscreen = !this._fullscreen;

	return false;
};

/**
 * Undo last action
 *
 * @returns {Boolean}
 * @private
 */
Toolbar.prototype._undo = function() {
	var undo = this.editor.session.get('undo', true) || [];
	if (undo.length) {
		// save current state to redo
		var oldData = JSON.stringify(JSON.parse(this.editor.getValue()));
		var redo = this.editor.session.get('redo', true) || [];
		var prev = undo.pop();
		redo.push(oldData);
		this.editor.setValue(prev);

		this.editor.session.set('undo', undo, true);
		this.editor.session.set('redo', redo, true);

		this.editor.refresh();

		this.updateDisabledClasses();
	}

	return false;
};

/**
 * Redo last reverted action
 *
 * @returns {Boolean}
 * @private
 */
Toolbar.prototype._redo = function() {
	var redo = this.editor.session.get('redo', true) || [];
	if (redo.length) {
		// save current state to undo
		var oldData = JSON.stringify(JSON.parse(this.editor.getValue()));
		var undo = this.editor.session.get('undo', true) || [];
		var next = redo.pop();
		undo.push(oldData);

		this.editor.setValue(next);
		this.editor.refresh();

		this.editor.session.set('undo', undo, true);
		this.editor.session.set('redo', redo, true);

		this.updateDisabledClasses();
	}

	return false;
};

/**
 * Copies active state(s)
 *
 * @returns {Boolean}
 * @private
 */
Toolbar.prototype._copy = function() {
	if (this.$copy.hasClass('disabled')) {
		return false;
	}
	var ret = {};
	var box = this.editor.getBoundingBox(true);
	var midX = box.minX + (box.maxX - box.minX) / 2;
	var midY = box.minY + (box.maxY - box.minY) / 2;
	for (var i in this.editor.states) {
		var b = this.editor.states[i];
		if (b.isActive()) {
			ret[b.id] = b.serialize();
			ret[b.id].x -= midX + this.canvas.options.canvasExtraWidth;
			ret[b.id].y -= midY + this.canvas.options.canvasExtraHeight;
		}
	}
	if (ret) {
		this.editor.storage.set('clipboard', ret, true);
		this.updateDisabledClasses();
	}

	return false;
};

/**
 * Cuts active state(s)
 *
 * @returns {Boolean}
 * @private
 */
Toolbar.prototype._cut = function() {
	if (this.$cut.hasClass('disabled')) {
		return false;
	}
	var ret = {};
	var box = this.editor.getBoundingBox(true);
	var midX = box.minX + (box.maxX - box.minX) / 2;
	var midY = box.minY + (box.maxY - box.minY) / 2;
	for (var id in this.editor.states) {
		var b = this.editor.states[id];
		if (b.isActive()) {
			ret[b.id] = b.remove();
			ret[b.id].x -= midX + this.canvas.options.canvasExtraWidth;
			ret[b.id].y -= midY + this.canvas.options.canvasExtraHeight;
		}
	}
	if (ret) {
		this.editor.storage.set('clipboard', ret, true);
		this.canvas.redraw();
		this.updateDisabledClasses();
	}

	return false;
};

/**
 * Pastes states from clipboard
 *
 * @returns {Boolean}
 * @private
 */
Toolbar.prototype._paste = function() {
	var states = this.editor.storage.get('clipboard', true);
	if (states) {
		var center = this.canvas.getCenter();
		this.disableSelection();
		for (var id in states) {
			var b = states[id];
			var exists = id in this.editor.states;
			if (exists) {
				alert(_('State with given name already exists, please select another one!'));
				id = this.editor.states[id].getNewLabel();
				if (!id) {
					continue;
				}
			}
			var state = new State(id, b, this.editor);
			this.editor.states[id] = state;
			if (exists) {
				state.x += 10;
				state.y += 10;
				b.x += 10;
				b.y += 10;
			}
			state.x += center.x;
			state.y += center.y;
			state.render();
			state.activate(true);
		}
		this.editor.storage.set('clipboard', states, true);
		this.canvas.redraw();
		this.editor.onChange();
		this.updateDisabledClasses();
	}

	return false;
};

/**
 * Updates disable state of all buttons inside toolbar
 */
Toolbar.prototype.updateDisabledClasses = function() {
	// set disabled class to toolbar buttons
	var active = false;
	for (var id in this.editor.states) {
		var s = this.editor.states[id];
		if (s.isActive() && s.id.indexOf('__') !== 0) {
			active = true;
			break;
		}
	}

	var undo = this.editor.session.get('undo', true);
	if (undo && undo.length) {
		this.$undo.removeClass('disabled');
	} else {
		this.$undo.addClass('disabled');
	}

	var redo = this.editor.session.get('redo', true);
	if (redo && redo.length) {
		this.$redo.removeClass('disabled');
	} else {
		this.$redo.addClass('disabled');
	}

	var clipboard = this.editor.storage.get('clipboard', true);
	if (clipboard) {
		this.$paste.removeClass('disabled');
	} else {
		this.$paste.addClass('disabled');
	}

	if (this._zoom < this._zoomMax) {
		this.$zoomIn.removeClass('disabled');
	} else {
		this.$zoomIn.addClass('disabled');
	}

	if (this._zoom > this._zoomMin) {
		this.$zoomOut.removeClass('disabled');
	} else {
		this.$zoomOut.addClass('disabled');
	}

	if (this._zoom !== 1.0) {
		this.$zoomReset.removeClass('disabled');
	} else {
		this.$zoomReset.addClass('disabled');
	}

	if (active) {
		this.$copy.removeClass('disabled');
		this.$cut.removeClass('disabled');
	} else {
		this.$copy.addClass('disabled');
		this.$cut.addClass('disabled');
	}
};

/**
 * Zooms to given scale
 *
 * @param {Number} scale
 * @private
 */
Toolbar.prototype._zoomTo = function(scale) {
	// 0.1 precision
	scale = Math.round(scale * 10) / 10;
	this._zoom = scale;
	this.editor.session.set('zoom', scale);
	var centerX = this.canvas.getCenter().x * scale;
	var centerY = this.canvas.getCenter().y * scale;
	this.canvas.$containerInner.css({
		'transform': 'scale(' + this._zoom + ')',
		'width': (this._zoom * 100) + '%',
		'height': (this._zoom * 100) + '%'
	});

	// compensate scroll to preserve center point
	var $c = this.canvas.$container;
	this.canvas.$container.scrollLeft(centerX - ($c.width() - $c.next().outerWidth()) / 2);
	this.canvas.$container.scrollTop(centerY - $c.height() / 2);

	// force browser to re-render inner container
	var inner = this.canvas.$containerInner.detach();
	this.canvas.$container.append(inner);
	this.canvas.redraw();

	this.updateDisabledClasses();
};

/**
 * Zooms in
 *
 * @private
 */
Toolbar.prototype._zoomIn = function() {
	if (this._zoom < this._zoomMax) {
		this._zoomTo(this._zoom + this._zoomStep);
	}
	return false;
};

/**
 * Zooms out
 *
 * @private
 */
Toolbar.prototype._zoomOut = function() {
	if (this._zoom > this._zoomMin) {
		this._zoomTo(this._zoom - this._zoomStep);
	}
	return false;
};

/**
 * Resets zoom
 *
 * @private
 */
Toolbar.prototype._zoomReset = function() {
	this._zoomTo(1);
	return false;
};

/**
 * Toggles help modal
 *
 * @private
 */
Toolbar.prototype._toggleHelp = function() {
	this.editor.toggleHelp();
	return false;
};

/**
 * Rotates whole entity in counter-clockwise direction
 *
 * @private
 */
Toolbar.prototype._rotate = function() {
	this.editor.rotate();
	return false;
};
