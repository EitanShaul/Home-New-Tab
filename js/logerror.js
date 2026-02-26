// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

"use strict";

/////////////////////////////////////////////////////////////////////////
//window.ga || (window.ga = function() {});
/*var gaException = window.ga || (function (send, exception, data) {
	if (send == 'send' && exception == 'exception') {
		chrome.runtime.sendMessage({ name: 'new-tab-exception', data: data });
	}
	// 'exDescription': msg + ' | ' + file + ':' + line,
});*/
var gaException = function (message, file, line, stack) {
	var extra = (file + ':' + line + '\n' + (stack||'')).trim();
	if (window.ga) { // background page
		ga('error.send', 'event', 'JS Error', message, extra);
		ga('error.send', 'exception', {
		  'exDescription': message,
		  'exFatal': false
		});
	} else // extension pages
		chrome.runtime.sendMessage({ 
			name    : 'new-tab-exception', 
			message : message,
			file    : file,
			line    : line,
			stack   : stack
		});
}
// at onRemoved (chrome-extension://extid_.../3rd-party/closed-tab/bg.js:44:12)
// at EventImpl.dispatchToListener (extensions::event_bindings:388:22)

// Do a bit of stack tracing and return filename, line # and column #
function getLineInfo(error) {
	if (!error || !error.stack) 
		error = new Error();
	var lines = error.stack.split("\n");
	//console.log(lines[0] + ': ' + lines.slice(2).join('\n').trim());
	var file;
	var baseURL = chrome.runtime.getURL("");
	for (var i = lines.length; i--;) {
		var splitLine = lines[i].split(baseURL, 2);
		file = splitLine[1]
		if (file) break;
	}
	var parts = file ? file.split(":") : ['UNKNOWN', 0, 0];
	return {
		file : parts[0], 
		line : parseInt(parts[1], 10), 
		col  : parseInt(parts[2], 10)
	};
}

// Add an error to the database, to keep track of them
// ('message')
// ({Error})
// ({ErrorEvent})
function logError(arg0, label, details) {

  var msg, file, line, col, error;

  //var isSQLError = (arg0.constructor.name == "SQLError");

	// called by window.onerror
	if (arg0 instanceof ErrorEvent) {
		msg   = arg0.message;
		error = arg0.error || error;
		file  = arg0.filename;
		line  = arg0.lineno;
	}
	// called by us with new Error  
	// SQLError not instance of Error (check for .message too)
	else if (arg0 instanceof Error || arg0.message) {
		msg   = arg0.message;
		error = arg0;
		// We parse cause Error.fileName, Error.lineNumber are not available in Chrome 
		var lineInfo = getLineInfo(error);
		file = file || lineInfo.file; // second arg can be used for custom GA event label
		line = lineInfo.line;
	}
	// else arg0 was a string
	else {
		msg = arg0;
		file = line = col = error = '';
	}

	var url = location.href;
	var base = chrome.runtime.getURL("");
	if (file.substring(0, base.length) == base)
		file = file.substring(base.length);
	if (url.substring(0, base.length) == base)
		url = url.substring(base.length);

	// otherwise somebody else called us (like database error handler)
	if (!(arg0 instanceof ErrorEvent)) {
		console.error(msg +'\n'+file+', line '+line);
		//console.log(msg+'\n'+file+', line '+line);
	}

	var stack = error ? error.stack : '';

	details || (details = '');

	if ('string' == typeof label) {
		if (!/^error/i.test(label)) {
			label = 'Error: ' + label;
		}
		//message = label + '\n' + err.message;
		details = label + '\n' + details;
	}

	if (details)
		details = stack + '\nDetails: ' + details;
	else
		details = stack;

	gaException(msg, file, line, details);

	var version = window.APP_VERSION; // localStorage.FB_db_current_version;
	if (!localStorage.unreadErrors) {
		localStorage.unreadErrors = 0;
	}
	localStorage.unreadErrors++;
	localStorage.latestError = JSON.stringify({
		version:version, file:file, line:line, msg:msg, date:+new Date, count:1, url:url
	});

	// I think this happens *after* a runtime.reload, but only *sometimes*
	// Basically we "try again" with a simple page reload (hopefully without errors)
	if (file == 'background.html' && line == 1 && /Unexpected (end|token)/i.test(msg)) {
		sendReloadEvent('exception', function () {
			location.reload();
		});
	}

	// currently tied to FB database
	if (localStorage.FB_index_ready != 'true') return; 

	onDbReady(function () {
		window.db.transaction(function (tx) {
			var today = +new Date;
			tx.executeSql('SELECT * FROM errors ORDER BY id DESC LIMIT 1', [], function(tx, results){
				var action = 'insert';
				if (results.rows.length == 1) {
					var item = results.rows.item(0);
					if (item.version == version && item.file == file && item.line == line && item.message == msg && item.date == today && item.url == url) {
						action = 'update';
					}
				}
				if (action == 'insert') {
					tx.executeSql('INSERT INTO errors (version, file, line, message, date, count, url) VALUES (?, ?, ?, ?, ?, ?, ?)', [version, file, line, msg, today, 1, url]);
				} else {
					tx.executeSql('UPDATE errors SET count = count+1 WHERE id = ?', [item.id]);
				}
			});
		}, function txError(err) {
			// Prevent recursion if the database operation fails
			window.removeEventListener('error', logError);
			setTimeout(function(){
				window.addEventListener('error', logError);
			}, 1000);
			console.log('Such Meta, error handler encountered an error:\n"'+err.message+'"');
		}, function txSuccess() {
			delete localStorage.latestError;
		});
	});
}
window.addEventListener('error', logError);

window.addEventListener('DOMContentLoaded', function () {
	if (localStorage.latestError && localStorage.latestError.length) {

		var e;
		try {
		  e = JSON.parse(localStorage.latestError);
		} catch (e) {
		  console.log('ERROR: stored latestError has invalid JSON: ' + stored.hotmail);
		  /// TODO: log error, kinda meta :) don't call logError or jsonSafeParse here 
		  return;
		}

		if (openDb()) {
			window.db.transaction(function (tx) {
				tx.executeSql('CREATE TABLE IF NOT EXISTS errors (id INTEGER PRIMARY KEY, date NUMERIC, version TEXT, url TEXT, file TEXT, line NUMERIC, message TEXT, count NUMERIC)');
				tx.executeSql('INSERT INTO errors (date, version, url, file, line, message, count) VALUES (?, ?, ?, ?, ?, ?, ?)', [e.date, e.version, e.url, e.file, e.line, e.msg, e.count]);
			}, function txError(err) {
				errorHandlerDatabase(err);
			}, function txSuccess() {
				delete localStorage.latestError;
			});
		}
	}
})

function sendReloadEvent(reason, callback) {
	ga('send', 'event', {
	  category    : reason,
	  action      : 'reload',
	  label       : 'reload',
	  hitCallback : createHitCallback(callback)
	});
}

function createHitCallback(fn) {
	var done = false;
	function callbackIfNotDone() { !done && fn && fn(); done = true; }
	function callbackNextTick()  { setTimeout(callbackIfNotDone, 2000); } // 1
	setTimeout(callbackIfNotDone, 5000); // 2000
	return callbackNextTick;
}

function jsonSafeParse(jsonText, defaultValue, label, extra) {
	if (!jsonText) 
		return defaultValue;
  try {
    return JSON.parse(jsonText);
  } catch (e) {
  	extra = extra || '';
  	label = label || 'Unlabeled JSON parsing';
    logError(e, 'JSON Parse Error: ' + label);
    console.error(`JSON Parse Error: ${label} ${extra}\n`+
    						  `${e.stack}\n`+
    						  `Input: ${jsonText}`);
    return defaultValue;
  }
}

