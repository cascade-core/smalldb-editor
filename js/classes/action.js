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
	this.label = data.label;
	this.color = id === '__noaction__' ? '#d00' : data.color;
	this.editor = editor;
	this.canvas = editor.canvas;
	this.states = editor.states;
	this._processData(data);
};

/**
 * @type {String[]} automatic colors
 */
Action.colors = ['#009900', '#003D00', '#6B8F00', '#522900', '#754719', '#A32900', '#7A003D', '#D11975', '#3D0099', '#000000',
				'#1B0A33', '#0000CC', '#003333', '#0C3A3A', '#008080', '#00B200', '#991F00', '#A31947', '#003366', '#444444'];

Action.prototype._processData = function(data) {
	this.transitions = {};
	if ('transitions' in data) {
		for (var id in data.transitions) {
			var key = id === '' ? '__start__' : id;
			var targets = data.transitions[id].targets || [];
			for (var t in targets) {
				// todo optional, prefer transition value over action value
				data.transitions[id].color = this.color;
				var trans = new Transition(this, data.transitions[id], key + '-' + t, targets[t], key === targets[t]);
				this.transitions[key + '-' + t] = trans;
				this.states[key].addConnection(targets[t]);
			}
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
		if (this.transitions[id].target === '') {
			endFound = true;
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
		trans.render(states, index);
	}
};

/**
 * Assigns transition to this action
 *
 * @param {String} key
 * @param {Transition} transition
 */
Action.prototype.addTransition = function(key, transition) {
	transition.key = key;
	this.transitions[key] = transition;
};

/**
 * Removes transition from this action
 *
 * @param {Transition} transition
 */
Action.prototype.removeTransition = function(transition) {
	delete this.transitions[transition.key];
};
