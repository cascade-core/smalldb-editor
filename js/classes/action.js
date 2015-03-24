/**
 * Creates new Action instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {State} state
 * @class
 */
var Action = function(id, data, editor) {
	this.id = id;
	this.data = data;
	this.editor = editor;
	this.canvas = editor.canvas;
	this.states = editor.states;
	this._processData(data);
};

Action.prototype._processData = function(data) {
	this.transitions = {};
	if ('transitions' in data) {
		for (var id in data.transitions) {
			var key = id === '' ? '__start__' : id;
			var trans = new Transition(this, data.transitions[id]);
			this.transitions[key] = trans;
			this.states[key].addConnection(trans.getTargets());
		}
	}
};

/**
 * Finds out whether this action uses end node
 *
 * @returns {Boolean} is there any transition to __end__ state?
 */
Action.prototype.usesEndNode = function() {
	var endFound = false;
	for (var id in this.transitions) {
		var targets = this.transitions[id].getTargets();
		for (var t in targets) {
			if (targets[t] === '') {
				endFound = true;
			}
		}
	}
	return endFound;
};

/**
 * Renders transitions to canvas
 *
 * @param {Array} states
 * @param {Object} index - how many same connections did we rendered, stored by key "{source.id}-{target.id}"
 */
Action.prototype.renderTransitions = function(states, index) {
	for (var id in this.transitions) {
		var trans = this.transitions[id];
		var targets = trans.getTargets();
		var color = trans.color;
		var label = trans.label;
		for (var t in targets) {
			if (targets[t] === '') {
				targets[t] = '__end__';
			}
			var from = states[id].getBorderPoint(states[targets[t]].center());
			var to = states[targets[t]].getBorderPoint(states[id].center());
			var key = from.toString() + '-' + to.toString();
			if (!index[key]) {
				index[key] = 1;
			}
			if (id === targets[t]) {
				var w = states[id].$container.outerWidth();
				this.canvas.drawCycleConnection(label, from, new Point(to.x - w, to.y), index[key]++);
			} else {
				var bidirectional = this.states[targets[t]].isConnected(id);
				if (bidirectional) {
					var from = states[id].center();
					from.id = id;
					var to = states[targets[t]].center();
					to.id = targets[t];
				}
				this.canvas.drawConnection(label, from, to, index[key]++, color, bidirectional);
			}
		}
	}
};
