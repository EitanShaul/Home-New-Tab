// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

globalThis.window = globalThis;
globalThis.G = globalThis;

window.ITEM_SEPARATOR = "\\c";
window.FIELD_SEPARATOR = "\\a";

window.SECONDS = 1000;
window.MINUTES = 60*SECONDS;
window.HOURS   = 60*MINUTES;
window.DAYS    = 24*HOURS;
window.MINS    = MINUTES;
window.SECS    = SECONDS;


(async () => {

  await stored;

  window.default_settings = {
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

  //var stored = localStorage;

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
  window.APP_URL    = chrome.runtime.getURL('/');


  if (localStorage.cf_test_review == 'true') {
    window.SEARCH_URL = window.SEARCH_ORIGIN + "/cf/?instant";
  }

  window.settings = {};
  try {
    if (stored.settings) settings = JSON.parse(stored.settings);
  } catch (e) {
    console.log('ERROR: settings has invalid JSON: ' + stored.settings);
    logError(new Error('ERROR: stored settings has invalid JSON: '));
    //  + e + '\n' + stored.settings
  }
  settings = {...default_settings, ...settings};
  stored.settings = JSON.stringify(settings);
})();

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
  window.ga_cb = function () { // last arg can be the callback function
    var args, cb;
    var lastArg = [].slice.call(arguments).pop();
    if ('function' == typeof lastArg) {
      args = [].slice.call(arguments, 0, -1);
      cb = createFunctionWithTimeout(lastArg, 1000);
    } else {
      args = [].slice.call(arguments);
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

/*
function include_js_once(url, callback) {
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
*/

function include_js(url, callback) {
  try {
    importScripts(url);
    callback && callback?.();
  } catch (e) {
    console.error('Error including script', url, e);
  }
}

function include_js_once(url, callback) {
  include_js_once.loaded = include_js_once.loaded || {};
  if (!include_js_once.loaded[url]) {
    try {
      importScripts(url);
      include_js_once.loaded[url] = true;
    } catch (e) {
      console.error('Error including script', url, e);
      return;
    }
  }
  callback && callback?.();
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





// we call it offscreen_call cause rpc means the other way (from bg to ext pages)
async function offscreen_call(method, ...args) {
  return chrome.runtime.sendMessage({
      type: 'offscreen_call',
      name: method,
      args: args,
  });
}


// periodic only for now
class Scheduler {
  constructor(params = {}) {
    if (typeof params !== 'object') {
      throw new Error('Scheduler params must be an object');
    }

    if (!Scheduler.#isTopLevel) {
      throw new Error('Scheduler must be created in top level code (no promise, no await, no microtask)');
    }

    const config = { ...params };

    if (config.periodInMinutes < 1) {
      throw new Error('periodInMinutes must be at least 1 minute');
    }

    this.alarmName = config.name;
    this.periodInMinutes = config.periodInMinutes;
    this.handlers = [];

    chrome.alarms.onAlarm.addListener(this.executeHandlers.bind(this));
    this.start();
  }

  addHandlerFromTopLevelOnly(handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    if (!Scheduler.#isTopLevel) {
      throw new Error('Handlers must be added in top level code (no promise, no await, no microtask)');
    }

    this.handlers.push(handler);
    return this;
  }

  async start() {
    const isValid = await this.hasExistingAndValidInstance();
    if (!isValid) {
      chrome.alarms.create(this.alarmName, {
        periodInMinutes: this.periodInMinutes
      });
    }
    return this;
  }

  async stop() {
    await chrome.alarms.clear(this.alarmName);
    return this;
  }

  setPeriodInMinutes(minutes) {
    if (minutes < 1) {
      throw new Error('periodInMinutes must be at least 1 minute');
    }
    this.periodInMinutes = minutes;
    // note: create can also replace existing alarm
    chrome.alarms.create(this.alarmName, {
      periodInMinutes: this.periodInMinutes
    });
  }

  executeHandlers(alarm) {
    if (alarm.name !== this.alarmName) {
      return;
    }
    this.handlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error(`Handler error in scheduler ${this.alarmName}:`, error);
      }
    });
  }

  getName() {
    return this.alarmName;
  }

  async hasExistingAndValidInstance() {
    const alarm = await chrome.alarms.get(this.alarmName);
    return alarm?.periodInMinutes === this.periodInMinutes;
  }

  // Ensureing that alarm handlers are added in top level code only
  static #isTopLevel = true;

  // Set up context tracking immediately when class is loaded
  static {
    Promise.resolve().then(() => {
      this.#isTopLevel = false;
    });

    queueMicrotask(() => {
      this.#isTopLevel = false;
    });
  }
}

window.fetchScheduler = new Scheduler({
  name: 'fetch-scheduler',
  periodInMinutes: 5,
});

function on_fetch_interval_change(fetch_interval_mins) {
  window.fetchScheduler.setPeriodInMinutes(
    +fetch_interval_mins || 5
  );
}

(async () => {
  await stored;
  window.fetchScheduler.setPeriodInMinutes(
    +window.settings.fetch_interval || 5
  );
})();

