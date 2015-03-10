/**
 * Block Editor 2.0
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {HTMLElement} el - textarea element
 * @param {Array} [options]
 * @class
 */
var SmalldbEditor = function(el, options) {
	/** @property {jQuery} $el plugin data variable name */
    this.$el = $(el);

	/** @property {string} defaults default options */
	this.defaults = {
		historyLimit: 1000, // count of remembered changes,
		canvasOffset: 30, // px start rendering blocks from top left corner of diagram - canvasOffset
		canvasExtraWidth: 1500, // px added to each side of diagram bounding box
		canvasExtraHeight: 1500, // px added to each side of diagram bounding box
		canvasSpeed: 2, // Mouse pan multiplication (when mouse moves by 1 px, canvas scrolls for pan_speed px).
		canvasBackgroundColor: '#fff',
		canvasBackgroundLineColor: '#eef',
		canvasBackgroundLineStep: 10 // px
	};

	// options stored in data attribute
	var meta = this.$el.data(this._namespace + '-opts');

	// merge all options together
	this.options = $.extend(this.defaults, options, meta);

	// reference to self
    this.$el.data(SmalldbEditor._namespace, this);

	// init block editor
	this._createContainer();
	this._init();
};

/** @property {string} _namespace plugin namespace */
SmalldbEditor._namespace = 'block-editor';

/**
 * Creates container
 */
SmalldbEditor.prototype._createContainer = function() {
	this.$container = $('<div>');
	this.$container.attr('class', SmalldbEditor._namespace);
	this.$container.css({
		width: this.$el.width(),
		height: this.$el.height()
	});
	this.$el.after(this.$container).hide();
};

/**
 * Initialization, loads palette data via AJAX
 *
 * @private
 */
SmalldbEditor.prototype._init = function() {
	// reset undo & redo history when URL changed (new block loaded)
	if (sessionStorage.url !== location.href) {
		sessionStorage.url = location.href;
		sessionStorage.removeItem('undo');
		sessionStorage.removeItem('redo');
	}

	// reset zoom
	sessionStorage.zoom = 1.0;

	this.canvas = new Canvas(this); // create canvas
	this.processData(); // load and process data from textarea
	this.box = this.getBoundingBox();
	this.canvas.render(this.box);
	this.render();
	this.canvas.$container.scroll(); // force scroll event to save center of viewport


	// load palette data from cache and trigger reloading
	//var self = this;
	//var callback = function(data) {
	//	localStorage.palette = JSON.stringify(data);
	//	self.canvas = new Canvas(self); // create canvas
	//	self.palette = new Palette(self, data); // create blocks palette
	//	self.processData(); // load and process data from textarea
	//	self.box = self.getBoundingBox();
	//	self.canvas.render(self.box);
	//	self.palette.render();
	//	self.render();
	//	self.canvas.$container.scroll(); // force scroll event to save center of viewport
	//};
	//if (localStorage.palette) {
	//	callback(JSON.parse(localStorage.palette)); // load instantly from cache
	//	setTimeout(function() {
	//		self.palette.toolbar.$reload.click(); // and trigger reloading immediately
	//	}, 100);
	//} else {
	//	$.get(this.options.paletteData).done(callback);
	//}
};

/**
 * Parses textarea data and initializes parent block properties and child blocks
 */
SmalldbEditor.prototype.processData = function() {
	this.data = JSON.parse(this.$el.val());
	this.states = {};
	console.log(this.data);

	// states
	if (this.data.states) {
		for (var id in this.data.states) {
			this.states[id] = new State(id, this.data.states[id], this);
		}
	}
};

/**
 * Renders block editor
 */
SmalldbEditor.prototype.render = function() {
	// render all blocks first to get their offset
	for (var id in this.states) {
		this.states[id].render();
	}

	// then render connections
	for (var id in this.states) {
		this.states[id].renderConnections();
	}

	// scroll to top left corner of diagram bounding box
	var top = this.box.minY - this.options.canvasOffset + this.canvas.options.canvasExtraWidth;
	var left = this.box.minX - this.options.canvasOffset + this.canvas.options.canvasExtraHeight;
	this.canvas.$container.scrollTop(top);
	this.canvas.$container.scrollLeft(left);
};

/**
 * Finds diagram bounding box
 *
 * @param {boolean} [active] - Process all or only active blocks
 * @returns {{minX: number, maxX: number, minY: number, maxY: number}}
 */
SmalldbEditor.prototype.getBoundingBox = function(active) {
	var minX = Infinity, maxX = -Infinity;
	var minY = Infinity, maxY = -Infinity;

	for (var id in this.states) {
		var b = this.states[id];
		if (active && !b.isActive()) {
			continue;
		}
		minX = Math.min(minX, b.x);
		maxX = Math.max(maxX, b.x + (b.$container ? b.$container.outerWidth() : 100));
		minY = Math.min(minY, b.y);
		maxY = Math.max(maxY, b.y + (b.$container ? b.$container.outerHeight() : 100));
	}

	return {
		minX: minX, maxX: maxX,
		minY: minY, maxY: maxY
	};
};

/**
 * Refreshes editor based on textarea data
 */
SmalldbEditor.prototype.refresh = function() {
	// remove old blocks
	for (var id in this.states) {
		this.states[id].$container.remove();
	}

	// update data
	this.processData();

	// redraw all blocks
	for (var id in this.states) {
		this.states[id].render();
	}

	// then re-render connections
	this.canvas.redraw();
};

/**
 * Adds new block to this editor instance
 *
 * @param {string} id - New block identification
 * @param {Object} data - JSON object with block data
 */
SmalldbEditor.prototype.addBlock = function(id, data) {
	this.states[id] = new State(id, data, this);
	this.states[id].render();
	this.onChange();
};

/**
 * On change handler, propagates changes to textarea
 */
SmalldbEditor.prototype.onChange = function() {
	// normalize string from textarea
	var oldData = JSON.stringify(JSON.parse(this.$el.val()));
	var newData = this.serialize();
	if (oldData !== newData) {
		// save new history state
		var undo = sessionStorage.undo ? JSON.parse(sessionStorage.undo) : [];
		undo.push(oldData);
		if (undo.length > this.options.historyLimit) {
			undo.splice(0, undo.length - this.options.historyLimit);
		}
		sessionStorage.undo = JSON.stringify(undo);
		sessionStorage.removeItem('redo');
	}

	this.palette.toolbar.updateDisabledClasses();

	// set data to textarea
	this.$el.val(newData);
};

/**
 * Serializes all blocks and parent block information to JSON string
 *
 * @returns {string}
 */
SmalldbEditor.prototype.serialize = function() {
	var blocks = {};
	for (var i in this.states) {
		var b = this.states[i];
		blocks[b.id] = b.serialize();
	}

	var ret = {
		'_': this.properties._, // security
		'blocks': blocks
	};
	for (var t in this.properties) {
		ret[t] = this.properties[t];
	}

	return JSON.stringify(ret);
};

/**
 * Removes editor instance
 *
 * @fixme fails when editor was not properly initialized (e.g. ajax load of palette not done yet)
 */
SmalldbEditor.prototype.destroy = function() {
	this.$container.remove();
	delete this.$container;
	$(document).off('keydown.palette');
	$(document).off('keydown.editor');
	this.$el.find('*').off('.' + this._namespace);
	this.$el.removeData(this._namespace);
	this.$el.show();
	this.$el = null;
};
