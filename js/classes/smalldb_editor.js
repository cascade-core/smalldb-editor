/**
 * state Editor 2.0
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {HTMLElement} el - textarea element
 * @class
 */
var SmalldbEditor = function(el) {
	/** @property {jQuery} $el plugin data variable name */
    this.$el = $(el);

	/** @property {string} defaults default options */
	this.defaults = {
		viewOnly: false, // view only mode - no interaction allowed
		scrollLeft: 0, // px to scroll from left - used for view only mode
		scrollTop: 0, // px to scroll from top - used for view only mode
		historyLimit: 1000, // count of remembered changes,
		splineTension: 0.3, // used to render connections, more means higher elasticity of connections
		edgeClickOffset: 5, // px to both sides from line
		canvasOffset: 75, // px start rendering states from top left corner of diagram - canvasOffset
		canvasExtraWidth: 1500, // px added to each side of diagram bounding box
		canvasExtraHeight: 1500, // px added to each side of diagram bounding box
		canvasSpeed: 2, // Mouse pan multiplication (when mouse moves by 1 px, canvas scrolls for pan_speed px).
		canvasBackgroundColor: '#fff',
		canvasBackgroundLineColor: '#eef',
		canvasBackgroundLineStep: 10 // px
	};
};

/** @property {string} _namespace plugin namespace */
SmalldbEditor._namespace = 'smalldb-editor';

/**
 * Initialize options map
 *
 * @param {Array} options
 * @private
 */
SmalldbEditor.prototype.setOptions = function(options) {
	// options stored in data attribute
	var meta = this.$el.data(SmalldbEditor._namespace + '-opts');

	// merge all options together
	this.options = $.extend(this.defaults, options, meta);
};

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
	if (this.options.viewOnly) {
		this.$container.addClass(SmalldbEditor._namespace + '-view-only');
	}
	this.$el.after(this.$container).hide();
};

/**
 * Places states to some position on canvas
 * uses tarjan's algorithm and renders states based on topological order
 *
 * @param {Boolean} [force] - override current coordinates? default to false
 */
SmalldbEditor.prototype.placeStates = function(force) {
	force = force || false;

	// create nodes
	var nodes = [], indexed = {}, end = null;
	for (var id in this.states) {
		if (id === '__end__' && this.states[id].notFound) {
			end = new Node(id);
			continue;
		}
		var node = new Node(id);
		nodes.push(node);
		indexed[id] = node;
	}

	// create edges and compute rank for each state (total number of connected edges)
	for (var id in this.actions) {
		var action = this.actions[id];
		for (var t in action.transitions) {
			var s = t.split('-')[0];
			var from = indexed[s];
			var to = indexed[action.transitions[t].target];
			from.connections.push(to);
			if (!from.equals(to)) { // ignore cycles
				from.rank++;
				to.rank++;
			}
		}
	}

	// find strongly connected components
	var graph = new Graph(nodes);
	var tarjan = new Tarjan(graph);
	var components = tarjan.run();

	if (end) {
		components.unshift([end]);
	}

	// compute max width of each component
	var max = 0, stepX = 100, stepY = 100;
	for (var i in components) {
		var scc = components[i];
		var width = scc.length * stepX;
		max = Math.max(max, width);
	}

	var dx, dy = 10, sign = 1;
	// components are sorted in reverse topological order
	for (var i = components.length - 1; i >= 0; i--) {
		var scc = components[i];
		var width = scc.length * stepX;
		dx = 10 + (max - width) / 2;
		scc = this._sortComponent(scc);
		for (var j = scc.length - 1; j >= 0; j--) {
			var state = this.states[scc[j].name];
			if (force || (!state.x && !state.y)) {
				state.x = dx;
				state.y = dy;
				state.redraw();
			}
			dx += stepX;
			if (scc.length > 1) {
				dy += sign * stepY;
				sign *= -1;
			}
		}
		dy += stepY * (scc.length > 1 ? 2 : 1);
	}
};

/**
 * Sorts strongly connected component by its rank
 * preserve first item (stored in the end of array)
 *
 * @param {Array} component
 * @returns {Array}
 * @private
 */
SmalldbEditor.prototype._sortComponent = function(component) {
	// preserve first item
	component[component.length - 1].first = true;
	return component.sort(function(a, b) {
		if (a.first || b.first) {
			return b.first ? -1 : 1;
		}
		return a.rank - b.rank;
	});
};

/**
 * Initialization, loads palette data via AJAX
 *
 * @private
 */
SmalldbEditor.prototype.init = function() {
	// create html container
	this._createContainer();

	// create namespaced storages
	this.session = new Storage(sessionStorage, SmalldbEditor._namespace);
	this.storage = new Storage(localStorage, SmalldbEditor._namespace);

	// reference to self
	this.$el.data(SmalldbEditor._namespace, this);

	// reset undo & redo history when URL changed (new state loaded)
	if (this.session.get('url') !== location.href) {
		this.session.set('url', location.href);
		this.session.reset('undo');
		this.session.reset('redo');
	}

	this.session.set('zoom', 1.0); // reset zoom
	this.canvas = new Canvas(this); // create canvas
	this.toolbar = new Toolbar(this); // create toolbar
	this.editor = new Editor(this); // create editor panel
	this.toolbar.render(this.$container);
	this.processData(); // load and process data from textarea
	this.placeStates(); // find position for each state
	this.box = this.getBoundingBox();
	this.canvas.render(this.box);
	this.editor.render();
	this.render();
	this.canvas.$container.scroll(); // force scroll event to save center of viewport
};

/**
 * Parses textarea data and initializes machine properties, actions and states
 */
SmalldbEditor.prototype.processData = function() {
	this.data = JSON.parse(this.$el[0].innerHTML);
	this.states = {};
	this.actions = {};

	// placeholder for rendering temporary transitions without proper action
	this.actions.__noaction__ = new Action('__noaction__', {}, this);

	// machine properties
	this.properties = {};
	for (var opt in this.data) {
		if ($.inArray(opt, ['states', 'actions']) === -1) {
			this.properties[opt] = this.data[opt];
		}
	}

	// states
	this.states.__start__ = new State('__start__', { label: '', color: '#000' }, this);
	if (this.data.states) {
		for (var id in this.data.states) {
			this.states[id] = new State(id, this.data.states[id], this);
		}
	}
	this.states.__end__ = new State('__end__', { label: '', color: '#000' }, this);

	// actions
	var endFound = false;
	if (this.data.actions) {
		for (var id in this.data.actions) {
			var a = new Action(id, this.data.actions[id], this);
			endFound |= a.usesEndNode();
			this.actions[id] = a;
		}
	}

	// remove end node when never used (only in view mode)
	if (!endFound) {
		if (this.options.viewOnly) {
			this.states.__end__.remove();
			delete this.states.__end__;
		} else {
			// mark node as not found to force its position in the end of machine
			this.states.__end__.notFound = true;
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
	this.index = {};
	for (var id in this.actions) {
		this.actions[id].renderTransitions(this.states, this.index);
	}

	// scroll to top left corner of diagram bounding box
	var top = this.box.minY
			- this.options.canvasOffset
			+ this.canvas.options.canvasExtraWidth
			- this.canvas.options.scrollTop;
	var left = this.box.minX
			- this.options.canvasOffset
			+ this.canvas.options.canvasExtraHeight
			- this.canvas.options.scrollLeft;
	this.canvas.$container.scrollTop(top);
	this.canvas.$container.scrollLeft(left);
};

/**
 * Finds diagram bounding box
 *
 * @param {Boolean} [active] - Process all or only active states
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

	// refresh editor panel
	this.editor.refresh();
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
