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
	var c = Math.floor(Math.random() * (Action.colors.length - 1));
	this.color = Action.colors[c];
	Action.colors.splice(c, 1);
	this._processData(data);
};

/**
 * @type {string[]} automatic colors
 */
Action.colors = ['#362d64', '#366669', '#682032', '#4122d3', '#632349', '#456086', '#146076', '#302259', '#664557', '#162525',
				'#525846', '#524162', '#162264', '#4266d2', '#134066', '#582830', '#228431', '#172092', '#382828', '#347d7d'];

Action.prototype._processData = function(data) {
	this.transitions = {};
	if ('transitions' in data) {
		for (var id in data.transitions) {
			var key = id === '' ? '__start__' : id;
			// todo optional, prefer transition value over action value
			data.transitions[id].color = this.color;
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
				this.canvas.drawCycleConnection(label, from, new Point(to.x - w, to.y), index[key]++, color);
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
