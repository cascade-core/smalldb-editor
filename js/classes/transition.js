/**
 * Creates new Transition instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 * @copyright Josef Kufner <josef@kufner.cz>, 2016
 *
 * @param {Action} action
 * @param {Object} data
 * @param {String} source
 * @param {String} target
 * @class
 */
var Transition = function(action, source, data) {
	data = data || {};
	this.action = action;
	this.arrows = {};
	this.data = data;
	this.source = source;
	this.color = data.color || action.color || '#000000';

	// Process data
	var targets = data.targets || [];
	var arrows = data.arrows || {};
	for (var t in targets) {
		var target = targets[t] || '__end__';
		if (target in this.action.editor.states) {
			this.addArrow(target, new Arrow(this, arrows[t] || {}, this.source, target, this.source === target));
			this.action.editor.states[this.source].addConnection(target);
		}
	}
}


Transition.prototype.render = function(states, index) {
	for (var a in this.arrows) {
		this.arrows[a].render(states, index);
	}
};


/**
 * Register arrow within transition
 */
Transition.prototype.addArrow = function(target, arrow) {
	if (this.arrows[target]) {
		throw "Duplicate arrow to \"" + target + "\".";
	}
	this.arrows[target] = arrow;
};


/**
 * Collect list of targets from arrows.
 */
Transition.prototype.getTargets = function() {
	var targets = [];
	for (var a in this.arrows) {
		targets.push(this.arrows[a].target);
	}
	return targets;
};


/**
 * Activates current transition
 */
Transition.prototype.activate = function() {
	this._active = true;
	this.action.editor.editor.create('edge', this);
	this.action.editor.canvas.redraw();
};

/**
 * Deactivates current transition
 */
Transition.prototype.deactivate = function() {
	this._active = false;
	$('.' + SmalldbEditor._namespace + '-control-point').remove();
	this.action.editor.canvas.redraw();
};

/**
 * Removes this transition
 */
Transition.prototype.remove = function() {
	this.action.removeTransition(this);
	this.action.editor.states[this.source.split('-')[0]].removeConnection(this.target);
	this.action.editor.canvas.redraw();
};

/**
 * Is current transition selected?
 *
 * @returns {Boolean}
 */
Transition.prototype.isActive = function() {
	return !!this._active; // cast as bool
};

/**
 * Attach this transition to different action
 *
 * @param {Action} action
 */
Transition.prototype.setAction = function(action) {
	if (this.color === '' || this.color === this.action.color) {
		this.color = action.color;
	}
	this.action.removeTransition(this);
	this.action = action;
	this.action.addTransition(this.source, this);
	this.action.editor.canvas.redraw();
};


/**
 * Serializes current transition to JSON object
 *
 * @returns {Object}
 */
Transition.prototype.serialize = function() {
	var T = {
		color: this.color,
		targets: this.getTargets()
	};

	var arrows = {};
	var has_arrows = false;
	for (var a in this.arrows) {
		var ad = this.arrows[a].serialize();
		if (ad) {
			arrows[a] = ad;
			has_arrows = true;
		}
	}
	if (has_arrows) {
		T.arrows = arrows;
	}

	for (var t in this.data) {
		if (['color', 'targets', 'arrows'].indexOf(t) === -1) {
			T[t] = this.data[t];
		}
	}
	return T;
};
