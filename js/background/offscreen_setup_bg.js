
async function ensureOffscreenDocument() {
  // create the offscreen document
  const offscreenUrl = '/pages/offscreen.html';
  const existingContext = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  })[0]; // there can be only one offscreen doc
  if (existingContext) {
    const existingContextIsGood = existingContext.url === offscreenUrl;
    if (!existingContextIsGood) {
      throw new Error('Offscreen document already exists but is ' + 
                      'not the expected one ' + existingContext.url);
    }
    return; // already created and good
  }
  try {
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
    reasons: ['LOCAL_STORAGE'],
      justification: 'Page needs access to localStorage APIs'
    });
  } catch (e) {
    // Don't ask me why this is thrown when we already checked getContexts
    // But it happens. So to be sure we ignore errors about already existing
    // Uncaught Error: Only a single offscreen document may be created.
    if (e.message.includes('single offscreen document') || 
        e.message.includes('already exists')) {
      return; // already created and good
    }
    throw e;
  }
}

async function createLocalStoragePromise() {
  const cache = new Map();
  let isReady = false;
  
  function checkReady() {
    if (!isReady) throw new Error('Storage not ready');
  }
  
  function offscreenMessage(op, key, value) {
    if (!op) throw new Error('Operation required');
    return chrome.runtime.sendMessage({ 
      target: 'offscreen_storage', 
      operation: op, 
      key: String(key),
      value: String(value)
    });
  }

  await ensureOffscreenDocument();

  try {
    const values = await offscreenMessage('_getAll_');
    Object.entries(values || {}).forEach(([k, v]) => {
      cache.set(String(k), String(v));
    });
    isReady = true;
  } catch (e) {
    throw new Error('Failed to initialize storage: ' + e.message);
  }

  const methods = {
    setItem: function (k, v) {
      checkReady();
      if (arguments.length < 2) {
        throw new TypeError('setItem requires 2 arguments');
      }
      const key = String(k);
      const value = String(v);
      cache.set(key, value);
      offscreenMessage('setItem', key, value);
    },
    getItem: function (k) {
      checkReady();
      if (arguments.length < 1) {
        throw new TypeError('getItem requires 1 argument');
      }
      const key = String(k);
      return cache.has(key) ? cache.get(key) : null;
    },
    removeItem: function (k) {
      checkReady();
      const key = String(k);
      cache.delete(key);
      offscreenMessage('removeItem', key);
    },
    clear: function () {
      checkReady();
      cache.clear();
      offscreenMessage('clear');
    },
    key: function (i) {
      checkReady();
      if (arguments.length === 0) {
        throw new TypeError('key requires 1 argument');
      }
      return Array.from(cache.keys())[i] ?? null;
    },
    get length() { 
      checkReady();
      return cache.size; 
    },
    _updateCache: function(key, newValue) {
      if (newValue === null) {
        cache.delete(String(key));
      } else {
        cache.set(String(key), String(newValue));
      }
    }
  };

  return new Proxy(methods, {
    get: (target, name) => {
      return target[name] || cache.get(String(name));
    },
    set: (_, prop, value) => {
      methods.setItem(prop, value);
      return true;
    },
    deleteProperty: (_, prop) => {
      methods.removeItem(prop);
      return true;
    }
  });
}

// Firefox background pages have native localStorage access, so the offscreen
// proxy is only needed in Chrome service workers where localStorage is absent.
var _hasNativeLocalStorage = (function () {
  try { return typeof localStorage !== 'undefined' && localStorage !== null &&
               typeof localStorage.getItem === 'function'; }
  catch (e) { return false; }
})();

if (_hasNativeLocalStorage) {
  // Firefox (or any context with direct localStorage): resolve immediately
  globalThis.stored = Promise.resolve(localStorage);
  globalThis.stored.then(function () {
    globalThis.stored = localStorage;
  });
  function on_localStorage_change() { /* native storage, no cache to refresh */ }
} else {
  // Chrome service worker: use offscreen document proxy
  // it's first a promise, then a proxy value. both can be awaited
  // after awaited it can be used sync (becuse guaranteed to be replaced by val)
  globalThis.localStorage = createLocalStoragePromise();
  globalThis.stored = globalThis.localStorage;
  globalThis.localStorage.then(proxy => {
    globalThis.localStorage = proxy;
    globalThis.stored = proxy;
    console.log('local storage proxy ready', proxy)
  });

  // need to refresh local cache
  function on_localStorage_change(e) {
    globalThis.localStorage._updateCache(e.key, e.newValue);
  }
}

// testing
(async () => {
  await stored;
  stored.setItem('test', 'test val')
  console.log(stored.getItem('test'));
})();

