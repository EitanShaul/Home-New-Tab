
var logger = {
	options: { elapsed: false },
	last: null,
	start: function () {
		console.log('Log session started');
		this.last = +new Date;
	},
	log: function (text) {
		var now = +new Date;
		var elapsed = numberWithCommas(now-this.last);
		var postfix = this.options.elapsed ? '(' + elapsed + ' ms)' : '';
		postfix && console.log(postfix);
		console.log(text); // + ' ' + postfix
		this.last = now;
	}
}

var isDbReady = false;
onDbReady.listeners = [];

function onDbReady(listener) {
	if (isDbReady) return listener(window.db);
	else onDbReady.listeners.push(listener);
}

function onDbReadyBefore(timeout, onReady, onTimeout) {
	if (isDbReady) return onReady(window.db);
	var dbtimer = setTimeout(function () {
		var index = onDbReady.listeners.indexOf(onReadyWrapped);
		if (index !== -1) onDbReady.listeners.splice(index, 1);
		onTimeout(new Error('db ready timeout'));
	}, timeout);
	function onReadyWrapped(db) {
		clearTimeout(dbtimer);
		onReady(db);
	}
	onDbReady.listeners.push(onReadyWrapped);
}

function runDbReadyListeners() {
	isDbReady = true;
	onDbReady.listeners.forEach(listener => listener(window.db));
	onDbReady.listeners = [];
}

//
// Initialize/create the database
function openDb(force) {
	if (window.db) return true;

	/*
	// Hopefully prevent issue #47 from happening... 
	// don't try to load the database if the page isn't ready
	if (!isDocumentReady()) {
		if (Math.random() < 0.01 && window.ga) {
			ga('send', 'event', 'debug', 'openDb called before domReady', (new Error()).stack);
		}	
		window.addEventListener('DOMContentLoaded', runDbReadyListeners);
		console.error('openDb called before domReady');
		return false;
	}
	*/

	var name = 'home';
	var size = 100 * 1024 * 1024;
	var displayName = 'Home - New Tab Page data'; 
	//try {
		var db = openDatabase('home', '1.0', displayName, size);
	//} catch (e) {
	//	console.error(e);
		// ga('error.send', 'event', 'debug', 'openDb failed', (new Error()).stack);
	//} 

	if (!db) {
		console.error("Database error: Unable to create or open SQLite database.");
		ga('error.send', 'event', 'debug', 'openDb failed', (new Error()).stack);
		return false;
	}

	window.db = db;
	
	runDbReadyListeners();

	/*
	db._transactionNative     = db.transaction;
	db._readTransactionNative = db.readTransaction;
	function forcedErrorHandler(err) { 
		errorHandlerDatabase(err); 
	}
	db.transaction = function (onTx, onError, onSuccess) {
		db._transactionNative(onTx, function (err) {
			forcedErrorHandler(err);
			onError && onError(err);
		}, onSuccess);
	}
	db.readTransaction = function (onTx, onError, onSuccess) {
		db._readTransactionNative(onTx, function (err) {
			forcedErrorHandler(err);
			onError && onError(err);
		}, onSuccess);
	}
	*/

	return true;
}

function isDocumentReady() {
	return /interactive|complete/i.test(document.readyState);
}

// SQLite errors: https://www.sqlite.org/rescode.html#ioerr_write

// errorHandler catches errors when SQL statements don't work.
// transaction error contains the SQL error code and message (no stack!)
function errorHandlerDatabase(transactionError) {
	if (window.goingToUrl) return;

	if (!transactionError) {
		transactionError = new Error();
	} else {
		transactionError.stack = (new Error()).stack;
	}

	var customErrorMessage = '';

	if (transactionError.code || transactionError.message) {
		if (transactionError.code == 0) {
			sendReloadEvent('db-error', function () {
				location.reload();
			});
			return;
		}

		// we have to reindex (reload background page?)
		if (transactionError.code == 5 && 
				transactionError.message.indexOf('no such table') != -1) {
			localStorage.FB_index_base_time = '';
			localStorage.FB_index_ready = 'false';
			chrome.runtime.getBackgroundPage(function (bg) { bg.startIndexing(); })
		}

		var errorNameForCode = [
			"unknown",    // 0
			"database",   // 1
			"version",    // 2
			"too large",  // 3
			"quota",      // 4
			"syntax",     // 5
			"constraint", // 6
			"timeout",    // 7
		];

		var errorName = errorNameForCode[transactionError.code] || '';
		customErrorMessage = 'SQL '+ errorName +' error: "'+ transactionError.message +'"';
	} else {
		customErrorMessage = 'Generic SQL error (no transaction)';
	}

	transactionError.message = customErrorMessage;
	logError(transactionError);
}

function numberWithCommas(x) { return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function repeat(v, n) { for (var a = [], i = 0; i < n; i++) a.push(v); return arr;	}
