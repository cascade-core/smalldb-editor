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
	this._processData(data);
};

Action.prototype._processData = function(data) {
	this.transitions = {};
	if ('transitions' in data) {
		for (var id in data.transitions) {
			var key = id === '' ? '__start__' : id;
			this.transitions[key] = new Transition(this, data.transitions[id]);
		}
	}
};

/**
 * Finds out whether this action uses end node
 *
 * @param {array} states
 * @returns {boolean} is there any transition to __end__ state?
 */
Action.prototype.usesEndNode = function(states) {
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
 * @param {array} states
 */
Action.prototype.renderTransitions = function(states) {
	for (var id in this.transitions) {
		var from = states[id].position();
		from.top += states[id].$container.outerHeight() / 2;
		from.left += states[id].$container.outerWidth();
		var targets = this.transitions[id].getTargets();
		for (var t in targets) {
			if (targets[t] === '') {
				targets[t] = '__end__';
			}
			var to = states[targets[t]].position();
			to.top += states[targets[t]].$container.outerHeight() / 2;
			var label = this.transitions[id].action.id;
			if (id === targets[t]) {
				this.canvas._drawCycleConnection(label, new Point(from.left, from.top), new Point(to.left, to.top));
			} else {
				this.canvas.drawConnection(label, new Point(from.left, from.top), new Point(to.left, to.top));
			}
		}
	}
};
