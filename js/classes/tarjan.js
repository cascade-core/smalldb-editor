/**
 * Graph representation
 *
 * @param {Array} nodes
 * @constructor
 */
var Graph = function(nodes) {
	this.nodes = nodes || [];
};

/**
 * Graph node representation
 *
 * @param {String} name
 * @constructor
 */
var Node = function(name) {
	this.name = name;
	this.connections = [];
	this.rank = 0;
	this.index = -1;
	this.lowlink = -1;
};

/**
 * Are nodes equal?
 *
 * @param {Node} node
 * @returns {Boolean}
 */
Node.prototype.equals = function(node) {
	return this.name === node.name;
};

/**
 * Simple stack implementation
 *
 * @param {Array} nodes
 * @constructor
 */
var Stack = function(nodes) {
	this.nodes = nodes || [];
};

/**
 * Is given node already on stack?
 *
 * @param {Node} node
 * @returns {Boolean}
 */
Stack.prototype.contains = function(node) {
	for (var i in this.nodes) {
		if (this.nodes[i].equals(node)) {
			return true;
		}
	}
	return false;
};

/**
 * Tarjan's algorithm for finding strongly connected components
 *
 * @param {Graph} graph
 * @constructor
 */
var Tarjan = function(graph) {
	this.index = 0;
	this.stack = new Stack();
	this.graph = graph;
	this.scc = [];
};

/**
 * Find strongly connected components!
 *
 * @returns {Array}
 */
Tarjan.prototype.run = function() {
	for (var i in this.graph.nodes) {
		if (this.graph.nodes[i].index < 0) {
			this._strongConnect(this.graph.nodes[i]);
		}
	}
	return this.scc;
};

/**
 * Finds strongly connected components for given node
 *
 * @param {Node} node
 * @private
 */
Tarjan.prototype._strongConnect = function(node) {
	// Set the depth index for v to the smallest unused index
	node.index = this.index;
	node.lowlink = this.index;
	this.index = this.index + 1;
	this.stack.nodes.push(node);

	for (var i in node.connections) {
		var v = node;
		var w = node.connections[i];
		if (w.index < 0) {
			// Successor w has not yet been visited; recurse on it
			this._strongConnect(w);
			v.lowlink = Math.min(v.lowlink, w.lowlink);
		} else if (this.stack.contains(w)) {
			// Successor w is in stack S and hence in the current SCC
			v.lowlink = Math.min(v.lowlink, w.index);
		}
	}

	// If v is a root node, pop the stack and generate an SCC
	if (node.lowlink === node.index) {
		// start a new strongly connected component
		var nodes = [];
		var w = null;
		if (this.stack.nodes.length>0) {
			do {
				w = this.stack.nodes.pop();
				nodes.push(w); // add w to current strongly connected component
			} while (!node.equals(w));
		}
		if (nodes.length > 0) {
			this.scc.push(nodes);
		}
	}
};
