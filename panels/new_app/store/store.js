
// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

var stored = localStorage;
window.APP_ID  = stored.APP_ID || (stored.APP_ID = chrome.runtime.id);
window.APP_URL = chrome.runtime.getURL('/');

//if (window.DEV) 
  document.documentElement.classList.add('show-chrome');
  
var appForId = {};
var apps = [];
var appTemplate = document.getElementById('TEMPLATE-app').innerHTML;

function byId(id, base) { return (base||document).getElementById(id); }
function bySelector(sel, base) { return (base||document).querySelector(sel); }
function bySelectorAll(sel, base) { return (base||document).querySelectorAll(sel); }

function loadLazyImages(root) {
  function loadLazyImg(img) { img.src = img.dataset.src; }
  root = root || document;
  var imgs = [].slice.call(root.querySelectorAll('img[data-src]'));
  imgs.slice(0, 6).forEach(loadLazyImg);
  setTimeout(function () {
     imgs.slice(6).forEach(loadLazyImg);
  }, 500);
}

function handleStateChange() {
  if (this.readyState != XMLHttpRequest.DONE) return;
  var a = JSON.parse(this.responseText);
  var iconBase = a.iconBaseURL;

  a = a.apps;

  if (!a.length) {
    a = Object.keys(a).map(k => a[k]);
  }

  a = a.map(app => {
    if (app.icon)
      app.icon = iconBase + app.icon;
    return app;
  })

  //console.log(a);
  
  apps = a;

  for (var i = 0; i < a.length; i++) {
    var x = a[i];
    appForId[x.uid] = x;
    if (popularLookup[x.url]) popularLookup[x.url] = x;
  }

  var popularApps = popularURLs.map(function (url) {
    return popularLookup[url]; 
  });

  byId('popular-message').style.display = '';
  byId('custom-link').style.display = 'none';

  showApps(popularApps, 'home', 20);
  setTimeout(loadLazyImages, 100)
}

function showApps(a, type, limit) {
  document.getElementById('results').innerHTML = getAppsHTML(a, type, limit);
}

function getAppsHTML(a, type, limit) {
  var allhtml = '';
  a = a.slice(0, limit);
  var dummyLink = document.createElement('a');
  for (var i = 0; i < a.length; i++) {
    var x = a[i];
    var html = appTemplate.slice();
    dummyLink.href = x.url; 
    var link = dummyLink.hostname.replace('www.', '');
    html = html.replace(/\$\{fullLink\}/g, x.url);
    html = html.replace(/\$\{link\}/g, link);
    html = html.replace(/\$\{name\}/g, x.shortName || x.name);
    html = html.replace(/\$\{icon\}/g, x.icon);
    html = html.replace(/\$\{type\}/g, type || '');
    html = html.replace(/\$\{id\}/g, x.id || '');
    allhtml += html
  }
  return allhtml;
}

function processJSON() {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = handleStateChange; 
  xhr.open("GET", APP_URL + 'panels/new_app/store/apps.json', true);
  xhr.send(); // topListDetailed
}

processJSON();

document.getElementById('search-form').onsubmit = function (e) {
  e.preventDefault();

  byId('popular-message').style.display = 'none';
  byId('custom-link').style.display = '';

  var results = search(document.getElementById('search-term').value);
  //results = results.sort((a,b) => (b.rate - a.rate));

  showApps(results, 'home', 10);
  loadLazyImages();
  //console.log(results)
}

var fuse;

function search(term) {
  var options = {
    shouldSort: true,
    threshold: 0.6,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 2,
    keys: [ "name", "description", "url" ],
  };
  fuse = fuse || new Fuse(apps, options); // "list" is the item array
  return fuse.search(term);
}

function switchToCustomViewWithApp(app) {
  var parent = window.parent;
  parent.postMessage({name: 'switchToCustomView', app: app}, '*');
}

document.addEventListener('click', function (e) {
  if (!e.target.closest('.add-button')) return;
  var app = e.target.closest('.app');
  if (!app) return;
  console.log(app)

  if (app.classList.contains('home')) {
    includeCustomScripts(function () {
      initCustomEditor({
        name: app.dataset.name,
        link: app.dataset.link,    
        icon: app.dataset.icon,
      });
    });
  } else if (app.classList.contains('chrome')) {
    if (window.chromeAppClick) window.chromeAppClick(app);
    bg_call('unhideChromeApp', app.dataset.id);
    //window.location.reload();
  }
}, true);

byId('custom-link').addEventListener('click', function (e) {
  includeCustomScripts(function () {
    initCustomEditor({});
  });
});

var popularURLs = [
"https://www.youtube.com",
"https://www.reddit.com",
"https://www.instagram.com",
"https://www.twitch.tv",
"https://www.netflix.com",
"https://amazon.com",
"https://www.cnn.com",
"https://tumblr.com",
"https://www.spotify.com",
"https://www.linkedin.com",
"https://m.facebook.com/messages",
"https://www.9gag.com",
"https://docs.google.com/spreadsheets",
"https://drive.google.com",
"https://map.google.com",
"https://classroom.google.com",
]
var popularLookup = {};
popularURLs.forEach(function (pop) {
  popularLookup[pop] = 1;
})

var menuActions = {
  'menu-item-store': switchToStore,
  'menu-item-custom': switchToCustom,
  'menu-item-chrome': switchToChrome,
}

byId('menu').addEventListener('click', function (e) {
  var act = menuActions[e.target.id];
  if (act) act();
});

function switchToStore() {
    bySelector('#menu > .active').classList.remove('active');
    bySelector('#menu-item-store').classList.add('active');
    bySelector('#store').style.display = 'block';
    bySelector('#custom').style.display = 'none';
    bySelector('#chrome').style.display = 'none';
    bySelector('#search-term').focus(); 
}

function switchToCustom() {
    bySelector('#menu > .active').classList.remove('active');
    bySelector('#menu-item-custom').classList.add('active');
    bySelector('#store').style.display = 'none';
    bySelector('#custom').style.display = 'block';
    bySelector('#chrome').style.display = 'none';
    bySelector('#url').focus(); 
    includeCustomScripts();
}

function switchToChrome() {
    bySelector('#menu > .active').classList.remove('active');
    bySelector('#menu-item-chrome').classList.add('active');
    bySelector('#store').style.display = 'none';
    bySelector('#custom').style.display = 'none';
    bySelector('#chrome').style.display = 'block';
    include_js_once('chrome.js');
}

function preload(url, type) {
  var link = document.createElement('link');
  link.rel = 'preload'; 
  link.href = url;
  link.as = type;
  (document.head||document.documentElement).appendChild(link);
}

setTimeout(function () {
  preload('/js/lib/jquery.min.js', 'script');
  preload('jquery.mousewheel.js', 'script');
  preload('jquery.cropbox.js', 'script');
  preload('cropinit.js', 'script');
  preload('new_app_panel.js', 'script');
  preload('/js/lib/filesystem.js', 'script');
}, 300);

function includeCustomScripts(callback) {
  include_js_once('/js/lib/jquery.min.js', function () {
    include_js_once('jquery.mousewheel.js')
    include_js_once('jquery.cropbox.js')
    include_js_once('new_app_panel.js', callback)
  });
  include_js_once('cropinit.js');
  include_js_once('/js/lib/filesystem.js');
}

if (window.location.hash == '#edit') {
  switchToCustom();
  document.body.classList.add('page-edit-app');
}

window.addEventListener('message', function (event) {
  if ('startEditingApp' != event.data.name) return;
  includeCustomScripts(function() {
    startEditingApp(event.data.app);
  });
});


