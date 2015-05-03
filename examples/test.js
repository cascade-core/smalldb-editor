/**
 * performance test
 */

var atm0 = '{"states":{},"actions":{}}';
var atm1 = '{"states":{"a":{"state":"a"}},"actions":{}}';
var atm10 = '{"states":{"a":{"state":"a"},"b":{"state":"b"},"c":{"state":"c"}},"actions":{}}';

// generate ATM
var generate = function(N, E) {
	var atm = JSON.parse(atm0);
	for (var i = 0; i < N; i++) {
		var id = 'state_' + (i + 1);
		atm.states[id] = {state: id};
	}
	for (var j = 0; j < E; j++) {
		var i1 = Math.floor(Math.random() * N);
		var i2 = Math.floor(Math.random() * N);
		var id1 = 'state_' + (i1 + 1);
		var id2 = 'state_' + (i2 + 1);
		var trans = {};
		trans[id1] = {targets: [id2]};
		atm.actions['action_' + (j + 1)] = {transitions: trans};
	}
	return JSON.stringify(atm);
};

$(document).ready(function() {
	var el = $('textarea')[0];
	var editor = $('textarea').data('smalldbEditor');
	var canvas = editor.canvas;
	el.innerHTML = generate(60, 120);
	editor.refresh();
	var N = 0;
	var total = 0;

	for (var i = 0; i < N; i++) {
		var t0 = performance.now();
		editor.tarjan(true);
		var t1 = performance.now();
		total += t1 - t0;
		console.log(t1 - t0);
	}

	total /= N;
	console.log(total.toString().replace(/\./, ','));
});
