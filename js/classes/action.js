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
	this.label = 'label' in data ? data.label : id;
	this.color = (id === '__noaction__' ? '#dd0000' : ('color' in data ? data.color : '#000000'));
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
 * Serializes current action to JSON object
 *
 * @todo merge transitions with same source
 * @returns {Object}
 */
Action.prototype.serialize = function() {
	var A = {
		label: this.label,
		color: this.color,
		transitions: {}
	};
	for (var id in this.transitions) {
		var trans = this.transitions[id];
		A.transitions[trans.source] = trans.serialize();
	}
	for (var t in this.data) {
		if (['label', 'color', 'transitions'].indexOf(t) === -1) {
			A[t] = this.data[t];
		}
	}
	return A;
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
 * @param {String} source
 * @param {Transition} transition
 */
Action.prototype.addTransition = function(source, transition) {
	// key - append random hash to allow multiple transitions from same source
	var key = source + '-' + Math.random().toString(36).slice(10);
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
