/**
 * Creates new placeholder instance
 *
 * @copyright Martin Adamek <adamek@projectisimo.com>, 2015
 *
 * @param {string} id - block name
 * @param {Array} data - block properties
 * @param {SmalldbEditor} editor - reference to plugin instance
 * @extends State
 * @class
 */
var Placeholder = function(id, data, editor) {
	// extends Block
	State.apply(this, arguments);

	this.type = id;
	var s = id.split('/');
	this.id = s[s.length - 1];

	this.defaults = data;
};

/** @extends State */
Placeholder.prototype = Object.create(State.prototype);
Placeholder.prototype.constructor = Placeholder;

/**
 * Creates HTML container
 *
 * @param e
 * @private
 */
Placeholder.prototype._create = function(e) {
	State.prototype._create.call(this);
	var t = this.type.replace(/\/[^\/]*$/, '').replace(/\//g, '-');
	this.$container.addClass(SmalldbEditor._namespace + '-filter-' + t);
	this.$container.off('click');
};

/**
 * Moves block placeholder to editor canvas - binds move events
 * used as mousedown handler
 *
 * @param {MouseEvent} e - Event
 * @private
 */
Placeholder.prototype._onDragStart = function(e) {
	this._dragging = true;
	this._moved = false;
	this._cursor = {
		x: e.pageX
			- this.position().left
			- this.$container.parent()[0].offsetLeft
			+ this.$container.parent()[0].scrollLeft,
		y: e.pageY
			- this.position().top
			- this.$container.parent()[0].offsetTop
			+ this.$container.parent()[0].scrollTop
	};

	$('body').on({
		'mousemove.block-editor': this._onDragOver.bind(this),
		'mouseup.block-editor': this._onDragEnd.bind(this)
	});
};

/**
 * Moves block placeholder to editor canvas
 * used as mousemove handler
 *
 * @param {MouseEvent} e - Event
 * @private
 */
Placeholder.prototype._onDragOver = function(e) {
	if (this._dragging) {
		if (!this.$clone) {
			this.$clone = this.$container.clone().addClass(SmalldbEditor._namespace + '-clone');
			this.canvas.$container.append(this.$clone);
		}

		var left = e.pageX - this._cursor.x + this.canvas.$container.scrollLeft();
		var top = e.pageY - this._cursor.y + this.canvas.$container.scrollTop();
		this._moved = this.position().left !== left || this.position().top !== top;
		this.$clone.css({
			left: left < 0 ? 0 : left,
			top: top < 0 ? 0 : top
		});
		this.canvas.redraw();
	}
};

/**
 * Moves block placeholder to editor canvas - create block instance from placeholder
 * used as mouseup handler
 *
 * @private
 */
Placeholder.prototype._onDragEnd = function() {
	if (this.$clone && this._moved) {
		var id = this.getNewId();
		if (id) {
			// zoom correction to preserve center position after scaling dropped block
			var zoom = this.canvas.getZoom();
			var correction = {
				x: this.$clone.outerWidth() * (1 - zoom) / 2,
				y: this.$clone.outerHeight() * (1 - zoom) / 2
			};
			// create new block
			var data = {
				block: this.type,
				in_con: {},
				in_val: {},
				x: (this.$clone[0].offsetLeft + correction.x) / zoom - this.editor.options.canvasExtraWidth,
				y: (this.$clone[0].offsetTop + correction.y) / zoom - this.editor.options.canvasExtraHeight
			};
			this.editor.addBlock(id, data);
		}
		this.$clone.remove();
		delete this.$clone;
	}
	this._dragging = false;
	$('body').off('mousemove.block-editor mouseup.block-editor');
};
