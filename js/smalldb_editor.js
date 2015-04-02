/*
 * SmallDB Editor Widget 1.0
 *
 * Copyright (c) 2015, Martin Adamek <adamek@projectisimo.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function($) {
	"use strict";

	/**
	 * Registers smalldb editor plugin to jQuery
	 *
	 * @param {Array} [options]
	 * @returns {jQuery} provides fluent interface
	 */
	$.fn.smalldbEditor = function(options) {
		return this.each(function() {
			var editor = $(this).data(SmalldbEditor._namespace);
			if (editor && typeof options === 'string' && typeof editor[options] === 'function') {
				editor[options]();
			} else {
				var editor = new SmalldbEditor(this);
				editor.setOptions(options);
				editor.init();
			}
		});
	};

})(jQuery);
