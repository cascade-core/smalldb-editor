/**
 * Smalldb Editor 1.0
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
		canvasOffset: 25, // px start rendering states from top left corner of diagram - canvasOffset
		canvasExtraWidth: 1500, // px added to each side of diagram bounding box
		canvasExtraHeight: 1500, // px added to each side of diagram bounding box
		canvasSpeed: 2 // Mouse pan multiplication (when mouse moves by 1 px, canvas scrolls for pan_speed px).
	};

	this.showControlPoints = false;
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
 * Places states to some position on canvas;
 * if dagre is loaded, use it, otherwise use tarjan
 *
 * @param {Boolean} [force] - override current states coordinates? default to false
 */
SmalldbEditor.prototype.placeStates = function(force) {
	force = force || false;

	// remove all control point buttons
	$('a.' + SmalldbEditor._namespace + '-control-point').remove();

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
 * Places states to some position on canvas,
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
			if (to && from.connections.indexOf(to) === -1 && !from.equals(to)) {
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

/**
 * Places states to some position on canvas using dagre
 *
 * @param {Boolean} [force] - override current coordinates? default to false
 */
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
		// make state square
		var w = s.width || 30;
		var h = s.height || 30;
		var max = Math.max(w, h);
		g.setNode(id, {
			width: max,
			height: max
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
			state.x = meta.x;
			state.y = meta.y;
			state.redraw(true);
		}
		if (state.id === '__start__') {
			endPos.x = state.x;
		}
		if (meta && 'y' in meta) {
			endPos.y = Math.max(endPos.y, meta.y);
		}
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
 * Sorts strongly connected component by its rank,
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
 * Initialization
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
	this.box = this.getBoundingBox(false, true);
	this.canvas.render(this.box);
	this.editor.render();
	this.render();
	this.canvas.$container[0].scrollLeft = (this.box);
	this.canvas.$container.scroll(); // force scroll event to save center of viewport
	this.setValue(this.serialize()); // update textarea with state positions
};

/**
 * Parses <textarea> data and initializes machine properties, actions and states
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
		if ($.inArray(opt, ['states', 'actions', 'virtualStates']) === -1) {
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
			if (id === '') {
				id = '__noaction__';
			}
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
			this.states.__end__.remove(true);
			delete this.states.__end__;
		} else {
			// mark node as not found to force its position in the end of machine
			this.states.__end__.notFound = true;
		}
	}
};

/**
 * Renders Smalldb editor
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

	if (this.options.viewOnly && 'C2S' in window) {
		this.canvas.redraw();
	}
};

/**
 * Finds diagram bounding box
 *
 * @param {Boolean} [active=false] - Process all or only active states
 * @param {Boolean} [square=false] - return squared bounding box (expand smaller side)
 * @returns {{minX: number, maxX: number, minY: number, maxY: number}}
 */
SmalldbEditor.prototype.getBoundingBox = function(active, square) {
	var minX = Infinity, maxX = -Infinity;
	var minY = Infinity, maxY = -Infinity;

	for (var id in this.states) {
		var s = this.states[id];
		if (active && !s.isActive()) {
			continue;
		}
		var w = s.$container ? s.$container.outerWidth() : 50;
		var h = s.$container ? s.$container.outerHeight() : 50;
		minX = Math.min(minX, s.x - w / 2);
		maxX = Math.max(maxX, s.x + w / 2);
		minY = Math.min(minY, s.y - h / 2);
		maxY = Math.max(maxY, s.y + h / 2);
	}

	var box = {
		minX: minX, maxX: maxX,
		minY: minY, maxY: maxY
	};

	if (square) {
		// make bounding box square
		var max = Math.max(box.maxX - box.minX, box.maxY - box.minY);
		if (box.maxX - box.minX < max) {
			var step = (max - box.maxX + box.minX) / 2;
			box.minX -= step;
			box.maxX += step;
		} else {
			var step = (max - box.maxY + box.minY) / 2;
			box.minY -= step;
			box.maxY += step;
		}
	}

	return box;
};

/**
 * Refreshes editor based on <textarea> data
 */
SmalldbEditor.prototype.refresh = function() {
	// remove old states
	for (var id in this.states) {
		this.states[id].$container.remove();
	}

	// remove control point buttons
	$('a.' + SmalldbEditor._namespace + '-control-point').remove();

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
 * On change handler, propagates changes to <textarea>
 *
 * @param {Boolean} [dontRefreshEditor]
 */
SmalldbEditor.prototype.onChange = function(dontRefreshEditor) {
	if (this.options.viewOnly) {
		return;
	}
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
 * @returns {string}
 */
SmalldbEditor.prototype.serialize = function() {
	if (this.options.viewOnly) {
		return '';
	}
	var states = {};
	for (var i in this.states) {
		if (i.indexOf('__') !== 0) {
			var s = this.states[i];
			states[s.id] = s.serialize();
		}
	}

	var actions = {};
	for (var i in this.actions) {
		var a = this.actions[i];
		actions[i === '__noaction__' ? '' : a.id] = a.serialize();
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
 * Sets <textarea> value
 *
 * @param {String} value
 */
SmalldbEditor.prototype.setValue = function(value) {
	this.$el[0].innerHTML = value;
};

/**
 * Gets <textarea> value
 */
SmalldbEditor.prototype.getValue = function() {
	return this.$el[0].innerHTML;
};

/**
 * Creates help modal window
 *
 * @private
 */
SmalldbEditor.prototype._createHelp = function() {
	var html = '<h2>Smalldb Editor Help</h2>';
	html += '<ul>';
	html += '<li>Hold <kbd>ctrl</kbd> and drag canvas with mouse to move around</li>';
	html += '<li>To create new state just double click on canvas</li>';
	html += '<li>To change state label, you can just double click on state</li>';
	html += '<li>When you select edge, you can add more control points just by clicking on it again</li>';
	html += '<li>You can move control points just by dragging them</li>';
	html += '<li>To move state, select it first</li>';
	html += '<li>When selecting multiple states, selection from left to right will select only fully overlapping states. Selection from right to left will also select partially overlapping states. </li>';
	html += '</ul>';
	this.$help = $('<div>').addClass(SmalldbEditor._namespace + '-help-modal');
	this.$help.html(html);
	var $close = $('<a href="#close">&times;</a>');
	$close.addClass(SmalldbEditor._namespace + '-close');
	$close.on('click', function() {
		this.$help.remove();
		delete this.$help;
		return false;
	}.bind(this));
	this.$help.append($close);
	this.$container.append(this.$help);
};

/**
 * Toggles help modal window
 */
SmalldbEditor.prototype.toggleHelp = function() {
	if (this.$help) {
		this.$help.remove();
		delete this.$help;
	} else {
		this._createHelp();
	}
};

/**
 * Rotates whole entity in counter-clockwise direction
 */
SmalldbEditor.prototype.rotate = function() {
	var box = this.getBoundingBox(false, true);
	var center = new Point(box.minX + (box.maxX - box.minX) / 2, box.minY + (box.maxY - box.minY) / 2);

	// rotate states
	for (var id in this.states) {
		var s = this.states[id];
		// get direction vector from center to state
		var direction = new Point(s.x, s.y).minus(center);
		// rotate it by 90deg (x,y) -> (y,-x)
		var dx = direction.x;
		direction.x = direction.y;
		direction.y = -dx;
		// add it to center to get new coordinates
		var pos = center.plus(direction);
		s.x = pos.x;
		s.y = pos.y;
		s.redraw(true);
	}

	// rotate transition control points
	for (var id in this.actions) {
		var a = this.actions[id];
		for (var t in a.transitions) {
			var trans = a.transitions[t];
			if (trans.dagrePath) {
				for (var p in trans.dagrePath) {
					var cp = trans.dagrePath[p];
					cp.x -= this.options.canvasExtraWidth;
					cp.y -= this.options.canvasExtraHeight;
					// get direction vector from center to CP
					var direction = cp.minus(center);
					// rotate it by 90deg (x,y) -> (y,-x)
					var dx = direction.x;
					direction.x = direction.y;
					direction.y = -dx;
					// add it to center to get new coordinates
					var pos = center.plus(direction);
					cp.x = pos.x + this.options.canvasExtraWidth;
					cp.y = pos.y + this.options.canvasExtraHeight;
				}
			}
		}
	}
	setTimeout(function() {
		this.canvas.redraw();
	}.bind(this));
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
