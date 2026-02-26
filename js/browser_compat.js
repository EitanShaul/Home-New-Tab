// Browser compatibility shim for Firefox support.
// Loaded before all other background scripts to stub Chrome-only APIs.

(function () {
  'use strict';

  var isFirefox = typeof browser !== 'undefined' &&
                  typeof chrome !== 'undefined' &&
                  chrome.runtime && chrome.runtime.getURL &&
                  chrome.runtime.getURL('').startsWith('moz-extension://');

  // importScripts is only available in service workers (Chrome MV3).
  // In Firefox background scripts, all scripts are loaded via manifest,
  // so importScripts should be a no-op.
  if (typeof importScripts === 'undefined') {
    self.importScripts = function () { /* no-op: scripts loaded via manifest */ };
  }

  // chrome.offscreen — Chrome-only API for creating offscreen documents.
  // Firefox background pages already have DOM/localStorage access.
  if (!chrome.offscreen) {
    chrome.offscreen = {
      createDocument: function () { return Promise.resolve(); }
    };
  }

  // chrome.runtime.getContexts — Chrome 116+, not available in Firefox.
  if (!chrome.runtime.getContexts) {
    chrome.runtime.getContexts = function () { return Promise.resolve([]); };
  }

  // chrome.management — not available in Firefox MV3.
  if (!chrome.management) {
    chrome.management = {
      getAll: function (cb) { if (cb) cb([]); },
      get: function (id, cb) { if (cb) cb(null); },
      uninstall: function () {},
      onInstalled: { addListener: function () {} },
      onEnabled:   { addListener: function () {} },
      onDisabled:  { addListener: function () {} },
      onUninstalled: { addListener: function () {} }
    };
  }

  // chrome.system.cpu / chrome.system.memory — not in Firefox.
  if (!chrome.system) {
    chrome.system = {};
  }
  if (!chrome.system.cpu) {
    chrome.system.cpu = {
      getInfo: function (cb) { if (cb) cb({ numOfProcessors: 0, processors: [] }); }
    };
  }
  if (!chrome.system.memory) {
    chrome.system.memory = {
      getInfo: function (cb) { if (cb) cb({ capacity: 1, availableCapacity: 1 }); }
    };
  }

  // chrome.action — Firefox MV3 supports browser.action but also aliases chrome.action.
  // Stub only if completely missing.
  if (!chrome.action) {
    chrome.action = {
      onClicked: { addListener: function () {} },
      setIcon: function () {},
      setTitle: function () {},
      setBadgeText: function () {},
      setBadgeBackgroundColor: function () {}
    };
  }

  // chrome.identity — Firefox has a different identity model.
  // Stub getAuthToken (Google-specific) with a graceful rejection.
  if (!chrome.identity) {
    chrome.identity = {
      getAuthToken: function (opts, cb) {
        var callback = cb || opts;
        if (typeof callback === 'function') callback(undefined);
      },
      launchWebAuthFlow: function (opts, cb) {
        if (typeof cb === 'function') cb(undefined);
      },
      getRedirectURL: function () { return ''; },
      removeCachedAuthToken: function (opts, cb) {
        if (typeof cb === 'function') cb();
      }
    };
  }

  // chrome.extension.getBackgroundPage — deprecated in MV3, not in Firefox MV3.
  if (!chrome.extension) {
    chrome.extension = {};
  }
  if (!chrome.extension.getBackgroundPage) {
    chrome.extension.getBackgroundPage = function () { return null; };
  }
  if (!chrome.extension.getViews) {
    chrome.extension.getViews = function () { return []; };
  }

  // chrome.runtime.getBackgroundPage — not in Firefox MV3.
  if (!chrome.runtime.getBackgroundPage) {
    chrome.runtime.getBackgroundPage = function (cb) {
      if (typeof cb === 'function') cb(null);
    };
  }

  // chrome.tabs.executeScript — removed in MV3 (replaced by scripting.executeScript).
  // Stub to prevent errors on Firefox where scripting API differs.
  if (chrome.tabs && !chrome.tabs.executeScript) {
    chrome.tabs.executeScript = function () {};
  }

  // Replace chrome-extension:// URL scheme references at runtime.
  // Firefox uses moz-extension:// but chrome.runtime.getURL handles this.
  // This is informational — no patching needed for getURL.

})();
