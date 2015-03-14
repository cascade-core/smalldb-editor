/**
 * state Editor 2.0
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
		canvasOffset: 100, // px start rendering states from top left corner of diagram - canvasOffset
		canvasExtraWidth: 1500, // px added to each side of diagram bounding box
		canvasExtraHeight: 1500, // px added to each side of diagram bounding box
		canvasSpeed: 2, // Mouse pan multiplication (when mouse moves by 1 px, canvas scrolls for pan_speed px).
		canvasBackgroundColor: '#fff',
		canvasBackgroundLineColor: '#eef',
		canvasBackgroundLineStep: 10 // px
	};

	// create namespaced storages
	this.session = new Storage(sessionStorage, SmalldbEditor._namespace);
	this.storage = new Storage(localStorage, SmalldbEditor._namespace);

	// options stored in data attribute
	var meta = this.$el.data(this._namespace + '-opts');

	// merge all options together
	this.options = $.extend(this.defaults, options, meta);

	// reference to self
    this.$el.data(SmalldbEditor._namespace, this);

	// init state editor
	this._createContainer();
	this._init();
};

/** @property {string} _namespace plugin namespace */
SmalldbEditor._namespace = 'smalldb-editor';

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
 * Places states to some position on canvas
 */
SmalldbEditor.prototype.placeStates = function() {
	var a = 10, b = 10, c = 1;
	for (var i in this.states) {
		this.states[i].x = a;
		this.states[i].y = b;
		a += 100;
		b += c * 100;
		c *= -1;
	}
};

/**
 * Initialization, loads palette data via AJAX
 *
 * @private
 */
SmalldbEditor.prototype._init = function() {
	// reset undo & redo history when URL changed (new state loaded)
	if (this.session.get('url') !== location.href) {
		this.session.set('url', location.href);
		this.session.reset('undo');
		this.session.reset('redo');
	}

	// reset zoom
	this.session.set('zoom', 1.0);

	this.canvas = new Canvas(this); // create canvas
	this.toolbar = new Toolbar(this); // create toolbar
	this.toolbar.render(this.$container);
	this.processData(); // load and process data from textarea
	this.placeStates(); // find position for each state
	this.box = this.getBoundingBox();
	this.canvas.render(this.box);
	this.render();
	this.canvas.$container.scroll(); // force scroll event to save center of viewport

	// load palette data from cache and trigger reloading
	//var self = this;
	//var callback = function(data) {
	//	self.storage.set('palette', data, true);
	//	self.canvas = new Canvas(self); // create canvas
	//	self.palette = new Palette(self, data); // create states palette
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
	//		self.toolbar.$reload.click(); // and trigger reloading immediately
	//	}, 100);
	//} else {
	//	$.get(this.options.paletteData).done(callback);
	//}
};

/**
 * Parses textarea data and initializes machine properties, actions and states
 */
SmalldbEditor.prototype.processData = function() {
	this.data = JSON.parse(this.$el.val());
	this.states = {};
	this.actions = {};

	// machine properties
	this.properties = {};
	for (var opt in this.data) {
		if ($.inArray(opt, ['states', 'actions']) === -1) {
			this.properties[opt] = this.data[opt];
		}
	}

	// states
	this.states.__start__ = new State('start', {}, this);
	if (this.data.states) {
		for (var id in this.data.states) {
			this.states[id] = new State(id, this.data.states[id], this);
		}
	}
	this.states.__end__ = new State('end', {}, this);

	// actions
	if (this.data.actions) {
		for (var id in this.data.actions) {
			this.actions[id] = new Action(id, this.data.actions[id], this);
		}
	}
};

/**
 * Renders state editor
 */
SmalldbEditor.prototype.render = function() {
	// render all states first to get their offset
	for (var id in this.states) {
		this.states[id].render();
	}

	// then render all transitions
	var endFound = false;
	for (var id in this.actions) {
		endFound |= this.actions[id].renderTransitions(this.states);
	}
	if (!endFound) {
		this.states.__end__.remove();
		delete this.states.__end__;
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
 * @param {boolean} [active] - Process all or only active states
 * @returns {{minX: number, maxX: number, minY: number, maxY: number}}
 */
SmalldbEditor.prototype.getBoundingBox = function(active) {
	var minX = Infinity, maxX = -Infinity;
	var minY = Infinity, maxY = -Infinity;

	for (var id in this.states) {
		var s = this.states[id];
		if (active && !s.isActive()) {
			continue;
		}
		minX = Math.min(minX, s.x);
		maxX = Math.max(maxX, s.x + (s.$container ? s.$container.outerWidth() : 50));
		minY = Math.min(minY, s.y);
		maxY = Math.max(maxY, s.y + (s.$container ? s.$container.outerHeight() : 50));
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
	// remove old states
	for (var id in this.states) {
		this.states[id].$container.remove();
	}

	// update data
	this.processData();

	// redraw all states
	for (var id in this.states) {
		this.states[id].render();
	}

	// then re-render connections
	this.canvas.redraw();
};

/**
 * Adds new state to this editor instance
 *
 * @param {string} id - New state identification
 * @param {Object} data - JSON object with state data
 */
SmalldbEditor.prototype.addState = function(id, data) {
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
		var undo = this.session.get('undo', true);
		undo = undo || [];
		undo.push(oldData);
		if (undo.length > this.options.historyLimit) {
			undo.splice(0, undo.length - this.options.historyLimit);
		}
		this.session.set('undo', undo, true);
		this.session.reset('redo');
	}

	this.toolbar.updateDisabledClasses();

	// set data to textarea
	this.$el.val(newData);
};

/**
 * Serializes all states and parent state information to JSON string
 *
 * @returns {string}
 */
SmalldbEditor.prototype.serialize = function() {
	var states = {};
	for (var i in this.states) {
		var b = this.states[i];
		states[b.id] = b.serialize();
	}

	var ret = {
		'_': this.properties._, // security
		'states': states
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
