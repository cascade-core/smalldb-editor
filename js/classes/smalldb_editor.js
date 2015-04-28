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
		canvasSpeed: 2 // Mouse pan multiplication (when mouse moves by 1 px, canvas scrolls for pan_speed px).
	};
};

/** @property {string} _namespace plugin namespace */
SmalldbEditor._namespace = 'smalldb-editor';

/**
 * Initialize options map
 *
 * @param {Array} options
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
 * if dagre is loaded, use it, otherwise use tarjan
 *
 * @param {Boolean} [force] - override current states coordinates? default to false
 */
SmalldbEditor.prototype.placeStates = function(force) {
	force = force || false;

	// is dagre loaded?
	if ("dagre" in window) {
		this.dagre(force);
	} else {
		this.tarjan(force);
	}

	this.onChange();
	if (force) {
		this.canvas.redraw();
	}
};

/**
 * Places states to some position on canvas
 * uses tarjan's algorithm and renders states based on topological order
 *
 * @param {Boolean} [force] - override current coordinates? default to false
 */
SmalldbEditor.prototype.tarjan = function(force) {
	// create nodes
	var nodes = [], indexed = {};
	for (var id in this.states) {
		var node = new Node(id);
		nodes.push(node);
		indexed[id] = node;
	}

	// create node connections
	for (var id in this.actions) {
		var action = this.actions[id];
		for (var t in action.transitions) {
			var s = t.split('-')[0];
			var from = indexed[s];
			var to = indexed[action.transitions[t].target];
			// ignore multi-edges and cycles
			if (from.connections.indexOf(to) === -1 && !from.equals(to)) {
				from.connections.push(to);
			}
		}
	}

	// find strongly connected components
	var graph = new Graph(nodes);
	var tarjan = new Tarjan(graph);
	var components = tarjan.run();

	if (!this.options.viewOnly && this.states.__end__.notFound) {
		// end is not used, move it to the end of list (list is reversed, so move it to the beginning)
		for (var c in components) {
			for (var n in components[c]) {
				if (components[c][n].name === '__end__') {
					var end = components.splice(c, 1);
					components.unshift(end[0]);
					break;
				}
			}
		}
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
				state.redraw(true);
			}
			if (scc.length !== 2) {
				dx += stepX;
			}
			if (scc.length > 1) {
				dy += sign * stepY;
				sign *= -1;
			}
		}
		dy += stepY * (scc.length > 1 ? 2 : 1);
	}
};

SmalldbEditor.prototype.dagre = function(force) {
	// create graph
	var g = new dagre.graphlib.Graph();
	g.setGraph({});

	// create nodes
	for (var id in this.states) {
		if (id === '__end__' && this.states[id].notFound) {
			continue;
		}
		var s = this.states[id];
		g.setNode(id, {
			width: s.width || 30,
			height: s.height || 30
		});
	}

	// create node connections
	for (var id in this.actions) {
		var action = this.actions[id];
		var temp = [];
		for (var t in action.transitions) {
			var trans = action.transitions[t];
			if (trans.cycle && trans.action.id === '__noaction__') {
				continue;
			}
			var s = t.split('-')[0];
			temp.push([s, trans]);
		}
		// add transitions in reversed order to prevent rendering overlapping multi-edges
		temp.reverse();
		for (var i in temp) {
			g.setEdge(temp[i][0], temp[i][1].target, { transition: temp[i][1] });
		}
	}

	// compute layout
	dagre.layout(g);

	// update state positions
	var states = this.states;
	var endPos = { y: 0 };
	g.nodes().forEach(function(v) {
		var state = states[v];
		if (force || (!state.x && !state.y)) {
			var meta = g.node(v);
			state.x = meta.x - meta.width / 2;
			state.y = meta.y - meta.height / 2;
			state.redraw(true);
		}
		if (state.id === '__start__') {
			endPos.x = state.x;
		}
		endPos.y = Math.max(endPos.y, meta.y);
	});

	if (!this.options.viewOnly && this.states.__end__.notFound) {
		// end is not used, position it to the end with same x coordinate as start node
		this.states.__end__.x = endPos.x;
		this.states.__end__.y = endPos.y + 65;
	}

	// update transition positions
	var opts = this.options;
	g.edges().forEach(function(e) {
		var meta =  g.edge(e);
		var points = [];
		for (var p in meta.points) {
			var x = meta.points[p].x;
			var y = meta.points[p].y;
			x += opts.canvasExtraWidth;
			y += opts.canvasExtraHeight;
			points[p] = new Point(x, y);
		}
		meta.transition.dagrePath = points;
	});
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
	// compute rank for each node - number of undirected connections
	// for each node inside SCC (ignore outside connections)
	for (var n in component) {
		var node = component[n];
		for (var t in node.connections) {
			var target = node.connections[t];
			var bidirectional = target.connections.indexOf(node) > -1;
			if (node.lowlink === target.lowlink) {
				node.rank += bidirectional ? 1 : 2;
				target.rank += bidirectional ? 1 : 2;
			}
		}
	}

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
	// create temp <div> to render states (we need to know state dimensions for dagre)
	var $temp = $('<div>').css({
		'visibility': 'hidden',
		'position': 'absolute',
		'z-index': -1
	});
	this.$container.append($temp);

	this.data = JSON.parse(this.getValue());
	this.states = {};
	this.actions = {};

	// known machine properties
	this.properties = {};
	for (var opt in this.data) {
		if ($.inArray(opt, ['states', 'actions']) === -1) {
			this.properties[opt] = this.data[opt];
		}
	}

	// states
	if (this.data.states) {
		for (var id in this.data.states) {
			this.states[id] = new State(id, this.data.states[id], this).render($temp);
		}
	}

	// virtual states (metadata for internal states)
	if (this.data.virtualStates) {
		for (var id in this.data.virtualStates) {
			this.states[id] = new State(id, this.data.virtualStates[id], this).render($temp);
		}
	} else {
		// add start and end states when not present
		this.states.__start__ = new State('__start__', { label: '', color: '#000' }, this).render($temp);
		this.states.__end__ = new State('__end__', { label: '', color: '#000' }, this).render($temp);
	}
	$temp.remove();

	// actions
	var endFound = false;
	if (this.data.actions) {
		for (var id in this.data.actions) {
			var a = new Action(id, this.data.actions[id], this);
			endFound |= a.usesEndNode();
			this.actions[id] = a;
		}
	}

	// placeholder for rendering temporary transitions without proper action
	this.actions.__noaction__ = new Action('__noaction__', { label: '' }, this);

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
	this.canvas.redraw();
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
 *
 * @param {Boolean} [dontRefreshEditor]
 */
SmalldbEditor.prototype.onChange = function(dontRefreshEditor) {
	// normalize string from textarea
	var oldData = JSON.stringify(JSON.parse(this.getValue()));
	var newData = this.serialize();
	if (oldData !== newData) {
		// set data to textarea
		this.setValue(newData);

		// do not save history when no state position given
		if (oldData.indexOf(',"x":') > 0) {
			// save new history state
			var undo = this.session.get('undo', true);
			undo = undo || [];
			undo.push(oldData);
			if (undo.length > this.options.historyLimit) {
				undo.splice(0, undo.length - this.options.historyLimit);
			}
			this.session.set('undo', undo, true);
			this.session.reset('redo');

			this.toolbar.updateDisabledClasses();
		}

		// refresh editor panel
		if (!dontRefreshEditor) {
			this.editor.refresh();
		}
	}
};

/**
 * Serializes all states and parent state information to JSON string
 *
 * @param {Boolean} [history] - when true, appends also internal information (start, end, noaction), defaults to false
 * @returns {string}
 */
SmalldbEditor.prototype.serialize = function(history) {
	var states = {};
	for (var i in this.states) {
		if (history || i.indexOf('__') !== 0) {
			var s = this.states[i];
			states[s.id] = s.serialize();
		}
	}

	var actions = {};
	for (var i in this.actions) {
		if (history || i.indexOf('__') !== 0) {
			var a = this.actions[i];
			actions[a.id] = a.serialize();
		}
	}

	var ret = {
		'_': this.properties._, // security
		'states': states,
		'virtualStates': {
			'__start__': this.states.__start__.serialize(),
			'__end__': this.states.__end__.serialize()
		},
		'actions': actions
	};
	for (var t in this.properties) {
		ret[t] = this.properties[t];
	}

	return JSON.stringify(ret);
};

/**
 * Sets textarea value
 *
 * @param {String} value
 */
SmalldbEditor.prototype.setValue = function(value) {
	this.$el[0].innerHTML = value;
};

/**
 * Gets textarea value
 */
SmalldbEditor.prototype.getValue = function() {
	return this.$el[0].innerHTML;
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
