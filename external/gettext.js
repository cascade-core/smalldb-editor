/*
 * Copyright (c) 2011, Josef Kufner  <jk@frozen-doe.net>
 * Copyright (c) 2015, Martin Adamek <adamek@projectisimo.com>
 * All rights reserved.
 *
 * Licensed under MIT license.
 */

if (typeof(_) == 'undefined') {
	function _(str, params) {
		if (params) {
			for (var p in params) {
				str = str.replace(/%s/, params[p]);
			}
		}
		return str;
	}
}
