// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

var default_settings = {
  fetch_interval:      '5',
  time_format:         '24',
  app_opener_tab:      'current',
  background_image:    '/img/backgrounds/21.jpg', // 21, 36
  background_image_provider: 'home',
  background_style:    'stretch',
  background_gradient: true,
  background_fadein:   true,
  notifications:       {},
  search_bar:          true,
  search_fullscreen:   true,
  search_provider:     'home',
  dim_at_night:        false,
}


// dont touch chrome.* APIs util DOM loaded 


var stored = localStorage;

if (window.location.pathname.endsWith('/background.html')) {
  delete stored.manifest;
}

var manifest;
try { if (stored.manifest) manifest = JSON.parse(stored.manifest); } catch (e) { }
if (!manifest) {
  manifest = chrome.runtime.getManifest();
  stored.manifest = JSON.stringify(manifest);
} 

window.APP_ID = stored.APP_ID || (stored.APP_ID = chrome.runtime.id);
window.APP_NAME = manifest.name;
window.APP_VERSION = manifest.version;
window.DEV = !manifest.update_url; //(window.APP_ID != 'ehhkfhegcenpfoanmgfpfhnmdmflkbgk');
window.SEARCH_ORIGIN = 'https://www.homenewtabsearch.com';
//window.SEARCH_ORIGIN = 'https://homenewtabsearch.com.s3-website-us-east-1.amazonaws.com';///
window.SEARCH_URL = window.SEARCH_ORIGIN + "/?instant";
window.APP_URL    = 'chrome-extension://' + window.APP_ID + '/';

var ITEM_SEPARATOR = "\\c";
var FIELD_SEPARATOR = "\\a";

if (localStorage.cf_test_review == 'true') {
  window.SEARCH_URL = window.SEARCH_ORIGIN + "/cf/?instant";
}

var SECONDS = 1000;
var MINUTES = 60*SECONDS;
var HOURS   = 60*MINUTES;
var DAYS    = 24*HOURS;
var MINS    = MINUTES;
var SECS    = SECONDS;

var settings = {};
try {
  if (stored.settings) settings = JSON.parse(stored.settings);
} catch (e) {
  console.log('ERROR: settings has invalid JSON: ' + stored.settings);
  logError(new Error('ERROR: stored settings has invalid JSON: '));
  //  + e + '\n' + stored.settings
}
settings = {...default_settings, ...settings};
stored.settings = JSON.stringify(settings);

function get_days_since_install() {
   return Math.floor((Date.now() - stored.install_time) / DAYS) || 0;
}

// main page (or other non background pages)
var isExtPage = !window.location.pathname.endsWith('background.html') && // old v2
                !window.location.pathname.endsWith('service_worker.js'); // new v3
if (isExtPage) {
  function createAnalFun(name) {
    return function () {
      chrome.runtime.sendMessage({ 
        name: name, arguments: [].slice.call(arguments) 
      });
    };  
  }
  window.ga_cb = function (...args) {
    var lastArg = args[args.length - 1];
    if ('function' === typeof lastArg) {
      lastArg();
    }
  }
  // this needs updating for GA4
  window.ga_cb_old = function (...args) { // last arg can be the callback function
    var cb;
    var lastArg = args[args.length - 1];
    if ('function' === typeof lastArg) {
      args = args.slice(0, -1);
      cb = createFunctionWithTimeout(lastArg, 1000);
    }
    chrome.runtime.sendMessage({ 
      name: 'ga_cb', 
      arguments: args
    }, cb);
  };
  window.ga  = createAnalFun('ga');
  window.fbq = createAnalFun('fbq');
  window.adw = createAnalFun('adw');
}

function change_options(changer) {
  try {  // default.js
    var settings_temp = JSON.parse(stored.settings);
    changer(settings_temp); // should apply changes
    stored.settings = JSON.stringify(settings_temp);
    settings = settings_temp; // overwrite our own settings with latest
    return settings_temp;
  } catch (e) {
    logError(new Error('ERROR: stored settings has invalid JSON: '));
    console.log('ERROR: stored settings has invalid JSON: ' + stored.settings);
    
    var errTxt = 'settings: ' + stored.settings + '\n' + e;
    ajax2('https://search.homenewtab.com/debug/settings.php' + 
          '?data=' + encodeURIComponent(errTxt), function(){}, function(){}, 'POST');
    ga('error.send', 'event', 'debug', 'error-wallpaper-home', errTxt);
  }
}
 
function save_options() { 
  throw ('Shouldnt call save_options from background page. ' +  
         'Use change_options instead.'); 
}

function createFunctionWithTimeout(callback, opt_timeout) {
  var called = false;
  function fn() {
    if (!called) {
      called = true;
      callback();
    }
  }
  setTimeout(fn, opt_timeout || 1000);
  return fn;
}

function include_js_once_callback(url, callback) {
  var script = document.getElementById(url);
  if (script) {
    if (script.dataset.loaded)
      if ('function' == typeof callback) callback()
    else 
      script.addEventListener('load', callback);
    return;
  }
  script = include_js(url, callback);
  script.id = url;
}

function include_js_once(url, callback) {
  if (callback) {
    return include_js_once_callback(url, callback);
  }
  return new Promise((resolve, reject) => {
    try {
      include_js_once(url, resolve);
    } catch (e) {
      reject(e);
    }
  });
}

function include_js(url, callback, dontRetry) {
  var script = document.createElement('script');
  script.onload = function () { script.dataset.loaded = true; };
  script.addEventListener('load', callback);
  //if (!dontRetry) 
  //  script.onerror = function () { include_js(url, callback, true); };
  script.onerror = function (e) {
    script.remove(); // it didn't run, we remove so we can add it again
    ga('error.send', 'event', 'debug', 'error-include-js', url);
  };
  script.src = url;
  document.head.appendChild(script);
  return script;
}

function preload(url, type) {
  var link = document.createElement('link');
  link.rel = 'preload'; 
  link.href = url;
  link.as = type;
  (document.head||document.documentElement).appendChild(link);
}

function isNumeric(num) {  return !isNaN(num) }

var valueForString = {
  'true'      : true,      // ok
  'false'     : false,     // ok
  'null'      : null,      // ok
  'undefined' : undefined, // JSON.parse cannot handle this!
};

function storageGet(key, defaultValue, label, extra) {
  var val = localStorage[key];
  if ('undefined' == typeof val)
    return defaultValue;
  if (isNumeric(val)) 
    return +val;
  if (valueForString[val]) 
    return valueForString[val];
  if ('string' == typeof val && val[0] == '{' || val[0] == '[')
    return jsonSafeParse(val, defaultValue, label || 'stored.' + key, extra);
  return val;
}

function storage(key, defaultValue, label, extra) {
  return storageGet(key, defaultValue, label, extra);
}

function storageGetNumber(key, defaultValue) {
  var num = Number(localStorage[key]);
  return isNaN(num) ? defaultValue : num;
}

function storageSet(key, val) {
  if ('undefined' == typeof val)
    // Don't try to stringify undefined, or bad things may happen 
    // (particularly in localStorageGet, so let's be consistent).
    delete localStorage[key];
  else if ('object' == typeof val)
    localStorage[key] = JSON.stringify(val);
  else 
    localStorage[key] = val;
}

function storageInc(key, incBy) {
  incBy = incBy || 1;
  return (localStorage[key] = (+localStorage[key]||0) + incBy);
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

var settingsListeners = {
  '*': [function (key, val) { 
    if (val == null) throw "settings value cannot be undefined"; 
    var keyParts = key.split('.');
    var ref = settings;
    keyParts.slice(0, -1).forEach(function (part) {
      ref[part] || (ref[part] = {});
      ref = ref[part];
    });
    ref[keyParts.pop()] = val; 
  }]
};

function addSettingsListener(key, fn) {
  settingsListeners[key] = settingsListeners[key] || [];
  settingsListeners[key].push(fn);
}

function publishSettingsChange(key, val) {
  var m = { name: 'settings-change', settingsKey: key, settingsValue: val };
  chrome.runtime.sendMessage(m);
}

window.addEventListener('load', function () {
  //gaPageSpeedTiming('DOMLoad', )
  setTimeout(function () {
    chrome.runtime.onMessage.addListener(function(m) {
      if (m.name != 'settings-change') return;
      var fns = settingsListeners['*'].concat(settingsListeners[m.settingsKey]);
      fns.forEach(function (fn) {
        if ('function' == typeof fn) {
          fn(m.settingsKey, m.settingsValue);
        }
      });
    });
  }, 300);
});

function gaPageSpeedTiming(vari, value, label) {
  gaSendTiming('PageSpeed', vari, value, label)
}
function gaSendTiming(cat, vari, value, label) { //  value must be int
  if (!value) return; // 0 doesn't make any sense
  label = label || Math.ceil(value/100)*100; // ceil cause it's every 100ms
  ga('send', 'timing', cat, vari,  Math.round(value), label); // round 1ms
}

/*
// TODO: check localStorage events
window.addEventListener('storage', function(e) {  
  e.key;
  de.oldValue;
  e.url;
   JSON.stringify(e.storageArea);
});
*/

// TEMP FOR DEBUG

// limitation: doesn't support mixed POST and GET
// grabs all ?param=value and turns them into a POST params
function ajax2(url, onSuccess, onError, method) {
  if ('POST' == method) {
    var postParams = url.split('?')[1];
    url = url.split('?')[0];
  }
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  if (/POST/i.test(method))
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  xhr.onload = function () {
    if (200 == xhr.status)
      onSuccess && onSuccess(xhr);
    else 
      onError && onError(xhr);
  };
  xhr.onerror = function () { 
    onError && onError(xhr);
  };
  xhr.send(postParams);
}


// we call it bg_call cause rpc means the other way (from bg to ext pages)
async function bg_call(method, ...args) {
  return chrome.runtime.sendMessage({
    type: 'bg_call',
    name: method,
    args: args,
  });
}

// get set global vars in bg
async function getBackgroundVars(keys = null) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get_background_vars', keys }, resolve);
  });
}

async function setBackgroundVars(data) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'set_background_vars', data }, resolve);
  });
}
