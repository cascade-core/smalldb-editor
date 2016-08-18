/**
 * Creates new Action instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 * @copyright Josef Kufner <josef@kufner.cz>, 2016
 *
 * @param {State} state
 * @class
 */
var Action = function(id, data, editor) {
	data = data || {};
	this.id = id;
	this.data = data;
	this.color = (id === '__noaction__' ? '#dd0000' : ('color' in data ? data.color : '#000000'));
	this.editor = editor;

	// Process data
	this.transitions = {};
	if ('transitions' in data) {
		for (var id in data.transitions) {
			var key = id || '__start__';
			if (key in this.editor.states) {
				this.addTransition(key, new Transition(this, key, data.transitions[id]));
			}
		}
	}
};


/**
 * @type {String[]} automatic colors
 */
Action.colors = ['#009900', '#003D00', '#6B8F00', '#522900', '#754719', '#A32900', '#7A003D', '#D11975', '#3D0099', '#000000',
				'#1B0A33', '#0000CC', '#003333', '#0C3A3A', '#008080', '#00B200', '#991F00', '#A31947', '#003366', '#444444'];


/**
 * Finds out whether this action uses end node
 *
 * @returns {Boolean} is there any transition to __end__ state?
 */
Action.prototype.usesEndNode = function() {
	for (var t in this.transitions) {
		for (var a in this.transitions[t].arrows) {
			var arrow = this.transitions[t].arrows[a];
			if (arrow.target === '__end__') {
				return true;
			}
		}
	}
	return false;
};


/**
 * Serializes current action to JSON object
 *
 * @returns {Object}
 */
Action.prototype.serialize = function() {
	var A = {
		color: this.color,
		transitions: {}
	};
	for (var id in this.transitions) {
		var trans = this.transitions[id];
		id = id === '__start__' ? '' : id;
		A.transitions[id] = trans.serialize();
	}
	for (var t in this.data) {
		if (['color', 'transitions'].indexOf(t) === -1) {
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
	for (var t in this.transitions) {
		this.transitions[t].render(states, index);
	}
};


/**
 * Assigns transition to this action
 *
 * @param {String} source
 * @param {Transition} transition
 */
Action.prototype.addTransition = function(source, transition) {
	this.transitions[source] = transition;
};


/**
 * Removes transition from this action
 *
 * @param {Transition} transition
 */
Action.prototype.removeTransition = function(transition) {
	delete this.transitions[transition.key];
};

