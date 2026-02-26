
// top of new.js
// DOMContentLoaded is usually before First paint
// DOMContentLoaded + RAF is usually safer

var starttt = performance.now();

requestAnimationFrame(function () {
	console.log(`requestAnimationFrame ${starttt-performance.now()}ms`);
});
setTimeout(function () {
	console.log(`setTimeout ${starttt-performance.now()}ms`);
}, 1);
window.addEventListener('DOMContentLoaded', function () {
	console.log(`DOMContentLoaded ${starttt-performance.now()}ms`);
	requestAnimationFrame(function () {
		console.log(`DOMContentLoaded + RAF ${starttt-performance.now()}ms`);
	});
	setTimeout(function () {
		console.log(`DOMContentLoaded + setTimeout ${starttt-performance.now()}ms`);
	}, 1);
});
window.addEventListener('load', function () {
	console.log(`load ${starttt-performance.now()}ms`);
	let performanceEntries = performance.getEntriesByType('paint');
	performanceEntries.forEach( (performanceEntry, i, entries) => {
	  console.log("The time to " + performanceEntry.name + " was " + performanceEntry.startTime + " milliseconds.");
	});
});
