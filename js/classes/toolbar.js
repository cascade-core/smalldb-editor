/**
 * Toolbar class
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {SmalldbEditor} editor - reference to plugin instance
 * @class
 */
var Toolbar = function(editor, palette) {
	this.editor = editor;
	this.palette = palette;
	this.canvas = editor.canvas;
	this._zoom = this.canvas.getZoom();
	this._zoomStep = 0.1;
	this._zoomMax = 3.0;
	this._zoomMin = 0.3;
};

/**
 * Renders toolbar
 *
 * @param {jQuery} $container
 * @returns {jQuery}
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

	// fullscreen button
	var $divider = $('<div>').addClass(SmalldbEditor._namespace + '-toolbar-divider');
	this.$fullscreen = $('<a>');
	var className = SmalldbEditor._namespace + '-fullscreen-toggle';
	this.$fullscreen.html('<i class="fa fa-fw fa-arrows-alt"></i> F');
	this.$fullscreen.attr('title', 'Toggle fullscreen [Ctrl + Shift + F]');
	this.$fullscreen.attr('href', '#fullscreen');
	this.$fullscreen.addClass(className);
	$(document).on('click', 'a.' + className, this._toggleFullScreen.bind(this));
	this.$toolbar.append(this.$fullscreen);

	// parent block properties button
	this.$parent = $('<a>');
	className = SmalldbEditor._namespace + '-parent-properties-toggle';
	this.$parent.html('<i class="fa fa-fw fa-cogs"></i> P');
	this.$parent.attr('title', 'Edit parent block properties [Ctrl + Shift + P]');
	this.$parent.attr('href', '#parent-properties');
	this.$parent.addClass(className);
	$(document).on('click', 'a.' + className, this._toggleParentProperties.bind(this));
	this.$toolbar.append(this.$parent);

	// palette refresh button
	this.$reload = $('<a>');
	className = SmalldbEditor._namespace + '-palette-reload';
	this.$reload.html('<i class="fa fa-fw fa-refresh"></i> R');
	this.$reload.attr('title', 'Reload palette data [Ctrl + Shift + R]');
	this.$reload.attr('href', '#reload-palette');
	this.$reload.addClass(className);
	$(document).on('click', 'a.' + className, this._reloadPalette.bind(this));
	this.$toolbar.append(this.$reload);

	this.$toolbar.append($divider.clone());

	// undo button
	this.$undo = $('<a>').addClass('disabled');
	className = SmalldbEditor._namespace + '-undo';
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
	this.$copy.attr('title', 'Copy active block [Ctrl + C]');
	this.$copy.attr('href', '#copy');
	this.$copy.addClass(className);
	$(document).on('click', 'a.' + className, this._copy.bind(this));
	this.$toolbar.append(this.$copy);

	// cut button
	this.$cut = $('<a>').addClass('disabled');
	className = SmalldbEditor._namespace + '-cut';
	this.$cut.html('<i class="fa fa-fw fa-cut"></i> X');
	this.$cut.attr('title', 'Cut active block [Ctrl + X]');
	this.$cut.attr('href', '#cut');
	this.$cut.addClass(className);
	$(document).on('click', 'a.' + className, this._cut.bind(this));
	this.$toolbar.append(this.$cut);

	// paste button
	this.$paste = $('<a>').addClass('disabled');
	className = SmalldbEditor._namespace + '-paste';
	this.$paste.html('<i class="fa fa-fw fa-paste"></i> P');
	this.$paste.attr('title', 'Paste block [Ctrl + V]');
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

	$(document).off('keydown.toolbar').on('keydown.toolbar', this._keydown.bind(this));

	// disable selection
	$(document).off('click.disable-selection', this.canvas.$container)
			   .on('click.disable-selection', this.canvas.$container, this.disableSelection.bind(this));

	this.$container.append(this.$toolbar);
	this.updateDisabledClasses();

	return this.$toolbar;
};

/**
 * Disables block selection, used as on click handler
 *
 * @param {MouseEvent} [e] - Event
 */
Toolbar.prototype.disableSelection = function(e) {
	if (!e || ($(e.target).is('canvas') && !this.canvas.selection)) {
		for (var id in this.editor.blocks) {
			this.editor.blocks[id].deactivate();
		}
	}
	this.canvas.selection = false;
};

/**
 * Reloads palette data via ajax
 *
 * @private
 */
Toolbar.prototype._reloadPalette = function() {
	if (this.$reload.hasClass('disabled')) {
		return false;
	}
	this.$reload.addClass('disabled');
	this.$reload.find('i.fa').addClass('fa-spin');
	var self = this;
	this.palette.reload(function() {
		self.$reload.find('i.fa').removeClass('fa-spin');
		self.$reload.removeClass('disabled');
	});
	return false;
};

/**
 * Keydown handler, binds keyboard shortcuts
 *
 * @param {KeyboardEvent} e - Event
 * @returns {boolean}
 * @private
 */
Toolbar.prototype._keydown = function(e) {
	// set timeout for loosing hover
	setTimeout(function() {
		$('.' + SmalldbEditor._namespace + '-toolbar a.hover').removeClass('hover');
	}, 150);

	// ignore key binding when variable editor opened
	var editorClass = SmalldbEditor._namespace + '-variable-editor';
	if (this.editor.$container.find('.' + editorClass).length) {
		return true;
	}

	var code = e.keyCode ? e.keyCode : e.which;
	if ((e.metaKey || e.ctrlKey) && code === 65) { // ctrl + a => select all blocks
		for (var id in this.editor.blocks) {
			this.editor.blocks[id].activate();
		}
		return false;
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
	} else if ((e.metaKey || e.ctrlKey) && e.shiftKey && code === 70) { // ctrl + shift + f => fullscreen
		this.$fullscreen.addClass('hover');
		this._toggleFullScreen();
		return false;
	} else if ((e.metaKey || e.ctrlKey) && e.shiftKey && code === 82) { // ctrl + shift + r => reload palette data
		this.$reload.addClass('hover');
		this._reloadPalette();
		return false;
	} else if ((e.metaKey || e.ctrlKey) && e.shiftKey && code === 80) { // ctrl + shift + p => parent block properties
		this.$parent.addClass('hover');
		this._toggleParentProperties();
	} else if (code === 46 || ((e.metaKey || e.ctrlKey) && code === 8)) { // del / ctrl + backspace => remove selection
		if (!window.confirm(_('Do you realy want to delete selected blocks?'))) {
			return false;
		}
		for (var id in this.editor.blocks) {
			if (this.editor.blocks[id].isActive()) {
				this.editor.blocks[id].remove();
			}
		}
		this.canvas.redraw();
	} else if (code === 27) { // esc => disable selection
		for (var id in this.editor.blocks) {
			this.editor.blocks[id].deactivate();
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
 * @returns {boolean}
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
 * Toggles parent block properties editor
 *
 * @returns {boolean}
 * @private
 */
Toolbar.prototype._toggleParentProperties = function() {
	var editor = new ParentEditor(this.editor);
	editor.render();

	return false;
};

/**
 * Undo last action
 *
 * @returns {boolean}
 * @private
 */
Toolbar.prototype._undo = function() {
	if (sessionStorage.undo && JSON.parse(sessionStorage.undo).length) {
		// save current state to redo
		var oldData = JSON.stringify(JSON.parse(this.editor.$el.val()));
		var redo = sessionStorage.redo ? JSON.parse(sessionStorage.redo) : [];
		var undo = JSON.parse(sessionStorage.undo);
		var prev = undo.pop();
		redo.push(oldData);
		this.editor.$el.val(prev);

		sessionStorage.undo = JSON.stringify(undo);
		sessionStorage.redo = JSON.stringify(redo);

		this.editor.refresh();

		this.updateDisabledClasses();
	}

	return false;
};

/**
 * Redo last reverted action
 *
 * @returns {boolean}
 * @private
 */
Toolbar.prototype._redo = function() {
	if (sessionStorage.redo && JSON.parse(sessionStorage.redo).length) {
		// save current state to undo
		var oldData = JSON.stringify(JSON.parse(this.editor.$el.val()));
		var undo = sessionStorage.undo ? JSON.parse(sessionStorage.undo) : [];
		var redo = JSON.parse(sessionStorage.redo);
		var next = redo.pop();
		undo.push(oldData);

		this.editor.$el.val(next);
		this.editor.refresh();

		sessionStorage.undo = JSON.stringify(undo);
		sessionStorage.redo = JSON.stringify(redo);

		this.updateDisabledClasses();
	}

	return false;
};

/**
 * Copies active block(s)
 *
 * @returns {boolean}
 * @private
 */
Toolbar.prototype._copy = function() {
	var ret = {};
	var box = this.editor.getBoundingBox(true);
	var midX = box.minX + (box.maxX - box.minX) / 2;
	var midY = box.minY + (box.maxY - box.minY) / 2;
	for (var i in this.editor.blocks) {
		var b = this.editor.blocks[i];
		if (b.isActive()) {
			ret[b.id] = b.serialize();
			ret[b.id].x -= midX + this.canvas.options.canvasExtraWidth;
			ret[b.id].y -= midY + this.canvas.options.canvasExtraHeight;
		}
	}
	if (ret) {
		localStorage.clipboard = JSON.stringify(ret);
		this.updateDisabledClasses();
	}

	return false;
};

/**
 * Cuts active block(s)
 *
 * @returns {boolean}
 * @private
 */
Toolbar.prototype._cut = function() {
	var ret = {};
	var box = this.editor.getBoundingBox(true);
	var midX = box.minX + (box.maxX - box.minX) / 2;
	var midY = box.minY + (box.maxY - box.minY) / 2;
	for (var id in this.editor.blocks) {
		var b = this.editor.blocks[id];
		if (b.isActive()) {
			ret[b.id] = b.remove();
			ret[b.id].x -= midX + this.canvas.options.canvasExtraWidth;
			ret[b.id].y -= midY + this.canvas.options.canvasExtraHeight;
		}
	}
	if (ret) {
		localStorage.clipboard = JSON.stringify(ret);
		this.canvas.redraw();
		this.updateDisabledClasses();
	}

	return false;
};

/**
 * Pastes blocks from clipboard
 *
 * @returns {boolean}
 * @private
 */
Toolbar.prototype._paste = function() {
	var blocks;
	if (localStorage.clipboard && (blocks = JSON.parse(localStorage.clipboard))) {
		var center = this.canvas.getCenter();
		this.disableSelection();
		for (var id in blocks) {
			var b = blocks[id];
			var exists = id in this.editor.blocks;
			if (exists) {
				id = this.editor.blocks[id].getNewId();
				if (!id) {
					continue;
				}
			}
			var block = new State(id, b, this.editor);
			this.editor.blocks[id] = block;
			if (exists) {
				block.x += 10;
				block.y += 10;
				b.x += 10;
				b.y += 10;
			}
			block.x += center.x;
			block.y += center.y;
			block.render();
			block.activate();
		}
		localStorage.clipboard = JSON.stringify(blocks);
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
	for (var id in this.editor.blocks) {
		if (this.editor.blocks[id].isActive()) {
			active = true;
			break;
		}
	}

	if (sessionStorage.undo && JSON.parse(sessionStorage.undo).length) {
		this.$undo.removeClass('disabled');
	} else {
		this.$undo.addClass('disabled');
	}

	if (sessionStorage.redo && JSON.parse(sessionStorage.redo).length) {
		this.$redo.removeClass('disabled');
	} else {
		this.$redo.addClass('disabled');
	}

	if (localStorage.clipboard && JSON.parse(localStorage.clipboard)) {
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
 * @param {number} scale
 * @private
 */
Toolbar.prototype._zoomTo = function(scale) {
	// 0.1 precision
	scale = Math.round(scale * 10) / 10;
	sessionStorage.zoom = this._zoom = scale;
	var centerX = this.canvas.getCenter().x * scale;
	var centerY = this.canvas.getCenter().y * scale;
	this.canvas.$containerInner.css({
		'transform': 'scale(' + this._zoom + ')',
		'width': (this._zoom * 100) + '%',
		'height': (this._zoom * 100) + '%'
	});

	// compensate scroll to preserve center point
	var $c = this.canvas.$container;
	this.canvas.$container.scrollLeft(centerX - $c.width() / 2);
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
