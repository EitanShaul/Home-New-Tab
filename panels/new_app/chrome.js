// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

// Add All
// Check: automatically add Chrome apps to New Tab

var blankSrc = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
function byId(id, base) { return (base||document).getElementById(id); }
function bySelector(sel, base) { return (base||document).querySelector(sel); }
function bySelectorAll(sel, base) { return (base||document).querySelectorAll(sel); }

var abcSort = createFieldSorter('name');
var bg = chrome.extension.getBackgroundPage();
var hidden_apps;

(async () => {
  const bg = await getBackgroundVars(['hidden_apps']);
  hidden_apps = bg.hidden_apps;

  chrome.management.getAll(onGetAll);
})();


function onGetAll(array) {
  array = array.filter(function (app) {
    return app.isApp;
  });    
  array = array.map(function (app) {
    if (!app.isApp)
    app.url = app.launchUrl;
    var icon = app.icons.filter(icon128);
    if (icon[0] && icon[0].url)
      app.icon = icon[0].url;
    return app;
  });
  var visibles = array.filter(function (app) {
    return !hidden_apps[app.id];
  });
  var hiddens = array.filter(function (app) {
    return hidden_apps[app.id];
  });

  byId('chrome-hidden').innerHTML = 
    getAppsHTML(hiddens.sort(abcSort), 'chrome');
  byId('chrome-visible').innerHTML = 
    getAppsHTML(visibles.sort(abcSort), 'chrome');

  loadLazyImages(byId('chrome'));
}

function chromeAppClick(appEl) {
  var visibles = byId('chrome-visible');
  visibles.insertBefore(appEl, visibles.firstChild);
}

function createFieldSorter(key) {
  return function(a, b) {
    if (a[key] < b[key]) { return -1; }
    if (a[key] > b[key]) { return 1; }
    return 0;
  };
}

function icon128(a) { return a.size == 128 }
