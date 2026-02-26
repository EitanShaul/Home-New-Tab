//'use strict';

// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

log_bug_drag.bgstart = Date.now();
log_bug_drag.list = [];
function log_bug_drag(txt) { log_bug_drag.list.push(txt); }
chrome.runtime.onMessage.addListener(function(message) {
  return; // not debugging rn
  if (message.name != 'log_bug_drag') return;
  var list = log_bug_drag.list.concat(message.content);
  log_bug_drag('bg elapsed: ' + (Date.now() - log_bug_drag.bgstart) + ' ms');
  log_bug_drag('install elapsed: ' + (Date.now() - stored.install_time) + ' ms');
  var errTxt = list.join('\n');
  console.log(errTxt);
  ga('send', 'event', 'debug', 'error-draggable', errTxt);
  ajax2('https://search.homenewtab.com/debug/draggable.php' + 
        '?data=' + encodeURIComponent(errTxt), function(){}, function(){}, 'POST');
});


//console.profile();
//setTimeout(function ( ){ console.profileEnd(); }, 10000)
var g_update_time = Math.max(+new Date, 1490038398000);
var apps;
var stored = localStorage; ///v3  localStorage
var ordered = [];
var isMac =  /mac/i.test(navigator.userAgent);
function byId(id, base) { return (base||document).getElementById(id); }

var custom_apps = {};
try {  // id -> bool (enabled state)
  if (stored.custom_apps) custom_apps = JSON.parse(stored.custom_apps);
} catch (e) {
  logError(new Error("ERROR: stored custom_apps has invalid JSON: "));
  console.log('ERROR: stored custom_apps has invalid JSON: ' + stored.custom_apps);
  // throw new Error('...');
}

var user_apps = {};
try {  // id -> bool (enabled state)
  if (stored.user_apps) user_apps = JSON.parse(stored.user_apps);
} catch (e) {
  logError(new Error('ERROR: stored user_apps has invalid JSON: '));
  console.log('ERROR: stored user_apps has invalid JSON: ' + stored.user_apps);
  // throw new Error('...');
}

var hidden_apps = {};
try {  // id -> bool (enabled state)
  if (stored.hidden_apps) hidden_apps = JSON.parse(stored.hidden_apps);
} catch (e) {
  logError(new Error('ERROR: stored hidden_apps has invalid JSON: '));
  console.log('ERROR: stored hidden_apps has invalid JSON: ' + stored.hidden_apps);
  // throw new Error('...');
}

if (null == stored.user_app_id_inc) stored.user_app_id_inc = 0;
if (null == stored.user_app_ids) stored.user_app_ids = '';

// stored.user_app_ids list of user app IDs
// stored.user_app_id_inc auto increment index
// stored.user_app_<ID> => { ... }

stored.install_time || (stored.install_time = g_update_time);


// INSTALL & ENABLE

function remove_custom_app() {

}

chrome.management.onInstalled.addListener(function(app) {
  ///stored.icons_order += "," + app.id;

  if (!app.isApp) return;

  apps[app.id] = app;

  // all views should update the UI
  chrome.runtime.sendMessage({ name: "add_new_app", id: app.id });

  // active view should scroll to show the newly installed app
  chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {name: "go_last_page"})
  });
});

chrome.management.onEnabled.addListener(function(app) {
  if (app.isApp)
    stored.icons_order += "," + app.id;
});


// UNINSTALL & DISABLE
function removeAppFromIcons(id) {
  var ordered = stored.icons_order.split(',');
  for (var i = 0; i < ordered.length; i++)
    if (ordered[i] == id)
      ordered.splice(i, 1);
  stored.icons_order = ordered.join(',');
  if (id.indexOf('user_app') == 0)
    remove_user_app(id);
}

function onUninstalled(id) {
  removeAppFromIcons(id);
  if (custom_apps[id]) {
    apps[id].enabled = false;
    custom_apps[id] = false;
    stored.custom_apps = JSON.stringify(custom_apps);
  }
}

function onDisabled(id) {
  removeAppFromIcons(id);
  apps[id].enabled = false;
}
function hideChromeApp(id) {
  hidden_apps[id] = 1;
  stored.hidden_apps = JSON.stringify(hidden_apps);
  removeAppFromIcons(id);
}
function unhideChromeApp(id) {
  delete hidden_apps[id];
  stored.hidden_apps = JSON.stringify(hidden_apps);
  stored.icons_order = stored.icons_order.replace(id, '').replace(/,,+/g, ',');
  stored.icons_order += "," + id;
  ordered.push(id);
  chrome.runtime.sendMessage({name: 'add_new_app', id:id});
}



// callded in main.js because of custom apps
///chrome.management.onUninstalled.addListener(onUninstalled);

chrome.management.onDisabled.addListener(function(app) {
  if (app.isApp) onDisabled(app.id);
});

var FETCH_INTERVAL = settings.fetch_interval ? settings.fetch_interval*MINUTES : 5*MINUTES;
var ITEM_SEPARATOR = "\\c";
var FIELD_SEPARATOR = "\\a";
var MAX_NOTIFICATIONS = 10; // shown / stored

var ICONS = {
  'tweet':      '/icons/twitter.png',/// TODO remove later
  'twitter':    '/icons/twitter.png',
  'mail':       '/icons/mail.png',
  'gmail':      '/icons/gmail.png',
  'yahoo-mail': '/icons/yahoo-mail.png',
  'hotmail':    '/icons/hotmail.png',
  'news':       '/icons/news.png',
  'facebook':   '/icons/facebook.png'
};

var indicators = {
  'pjkljhegncpnkpknbcohdijeoejaedia': 'gmail',
  'pjjhlfkghdhmijklfnahfkpgmhcmfgcm': 'greader',
  'dlppkpafhbajpcmmoheippocdidnckmm': 'gplus',
  'yahoo-mail': 'yahoo-mail',
  'hotmail':    'hotmail',
  'facebook':   'facebook'
};

stored.notifications || (stored.notifications = "");


function set_indicator(id, count) {
  // broadcast indicator change
  chrome.runtime.sendMessage({
    name: "set_indicator",
    args: [id, count],
    type: "rpc",
  });
  // store indicator change
  var key = "indicator-" + id;
  stored[key] = count;
}

function is_notification_enabled(i) {
  return ("undefined" == typeof settings.notifications[i] || settings.notifications[i]);
}

var notificationLinkForId = {};

function create_notification(icon, title, body) {

  if (!icon || !title) return;

  if (icon == 'gmail'      && !is_notification_enabled('pjkljhegncpnkpknbcohdijeoejaedia')) return;
  if (icon == 'news'       && !is_notification_enabled('pjjhlfkghdhmijklfnahfkpgmhcmfgcm')) return;
  if (icon == 'yahoo-mail' && !is_notification_enabled('yahoo-mail')) return;
  if (icon == 'hotmail'    && !is_notification_enabled('hotmail')) return;
  if (icon == 'facebook'   && !is_notification_enabled('facebook')) return;
  if (icon == 'twitter'    && !is_notification_enabled('twitter')) return;

  // broadcast new notification
  chrome.runtime.sendMessage({
    name: "create_notification",
    args: [icon, title, body],
    type: "rpc",
  });

  /*
  if (icon == 'tweet' && +new Date - last_sound > 1000)  {
    last_sound = +new Date;
    byId('twittersound', bg.document).currentTime = 0;
    byId('twittersound', bg.document).play();
  }
  */

  icon = ICONS[icon] || icon;
  var new_item = icon + FIELD_SEPARATOR + title + FIELD_SEPARATOR + body;

  // fetch stored notifications and refresh list
  var notifications = stored.notifications ? stored.notifications.split(ITEM_SEPARATOR) : [];
  notifications.unshift(new_item);
  if (notifications.length > MAX_NOTIFICATIONS) {
    notifications.pop();
  }

  // update storage
  stored.notifications = notifications.join(ITEM_SEPARATOR);

  // Native Chrome notifications 
  return ;

  var id = String(Date.now());
  var dummy = document.createElement('div');
  dummy.innerHTML = title;
  var titleText = dummy.textContent;
  try {
    id = dummy.getElementsByTagName('a')[0].href;
    notificationLinkForId[id] = dummy.getElementsByTagName('a')[0].href;
  } catch (e) { }
  var opt = {
    type: 'basic',
    iconUrl: icon,
    title: titleText,
    message: body,
    //buttons: [{title: read}],// eventTime,
    /*buttons:[{title: 'Turn Off [Facebook] notifications', 
              iconUrl: icon}, 
             {title: 'Turn Off ALL [Home New Tab] notifications', 
              iconUrl:'/icons/home.png'}],*/

  };
  chrome.notifications.create(id, opt, function (){});
}

chrome.notifications.onClicked.addListener(function (id) {
  var link = notificationLinkForId[id];
  delete notificationLinkForId[id];
  chrome.notifications.clear(id);
  if (!link) return;
  chrome.tabs.create({ url: link, active: true });
});


function play_notification_sound(type) {
}



function build_apps_list(chrome_apps_arr) {
  ///bench('build start');///

  log_bug_drag('build_apps_list start: ' + (chrome_apps_arr||[]).length);

  // save default custom apps' states upon first launch
  if ("undefined" == typeof custom_apps["webstore"]) {
    custom_apps = {"contacts":true,"webstore":true,"yahoo-mail":true,"hotmail":true,"facebook":true,"twitter":true,"ebay":true,"booking":true,"aliexpress":true}; // ,"amazon":true
    stored.custom_apps = JSON.stringify(custom_apps);
  }

  // existing users (but only ones that are new additions to test group 3)
  if ("undefined" == typeof custom_apps["ebay"] && 'true' == stored.testing_tiles_active) {
    custom_apps.ebay = true;
    custom_apps.booking = true;
    custom_apps.aliexpress = true;
    stored.custom_apps = JSON.stringify(custom_apps);
  }

  if ("undefined" == typeof custom_apps["ebay"]) {
    custom_apps.ebay = true;
    stored.custom_apps = JSON.stringify(custom_apps);
  }

  //if (custom_apps.booking && stored.GEO_country_code == 'US') {
  //  custom_apps.booking = false;
  //  stored.custom_apps = JSON.stringify(custom_apps);
  //}
  

  // youtube: blpcfgokakmgnkcojhhkbfbldkacnbeo
  //custom_apps.amazon = true;


  // if you want to change any of the links don't forget to purhe html cache
  var sys_apps_arr = []; 

  sys_apps_arr.unshift({
    name: "Contacts",
    id:   "contacts",
    icons: [{size: 128, url: "/icons/app/contacts.png", "borderRadius":16}],
    appLaunchUrl: "https://www.google.com/contacts/#contacts",
    isApp:   true,
    enabled: custom_apps["contacts"]
  });

  sys_apps_arr.unshift({
    name: "AliExpress",
    id:   "aliexpress",
    icons: [{size: 128, url: "/icons/app/aliexpress.png","borderRadius":16}],
    appLaunchUrl: "https://alitems.com/g/1e8d1144941b31890c7516525dc3e8/",
    isApp:   true,
    enabled: custom_apps["aliexpress"]
  });

  sys_apps_arr.unshift({
    name: "Booking.com",
    id:   "booking",
    icons: [{size: 128, url: "/icons/app/booking.png","borderRadius":16}],
    appLaunchUrl: "https://www.booking.com/index.html?aid=1195117",
    isApp:   true,
    enabled: custom_apps["booking"]
  });

  sys_apps_arr.unshift({
    name: "Ebay",
    id:   "ebay",
    icons: [{size: 128, url: "/icons/app/ebay.png","borderRadius":16}],
    appLaunchUrl: "https://www.ebay.com/",
    isApp:   true,
    enabled: custom_apps["ebay"]
  });

  sys_apps_arr.unshift({
    name: "Store",
    id:   "webstore",
    icons: [{size: 128, url: "/icons/app/webstore.png"}],
    appLaunchUrl: "https://chrome.google.com/webstore/category/popular",
    isApp:   true,
    enabled: custom_apps["webstore"]
  });

  sys_apps_arr.push({
    name: "Yahoo! Mail",
    id:   "yahoo-mail",
    icons: [{size: 128, url: "/icons/app/yahoo-mail.png", "borderRadius":16}],
    appLaunchUrl: "https://us.mg40.mail.yahoo.com/neo/launch?.rand=" + (+new Date),
    isApp:   true,
    enabled: custom_apps["yahoo-mail"]
  });

  sys_apps_arr.push({
    name: "Outlook Mail",
    id:   "hotmail",
    icons: [{size: 128, url: "/icons/app/outlook.png", "borderRadius":16}],
    appLaunchUrl: "https://mail.live.com/default.aspx?rru=inbox", /// http vs https
    optionsUrl: "https://mail.live.com/P.mvc#!/mail/options.aspx",
    isApp:   true,
    enabled: custom_apps["hotmail"]
  });

  sys_apps_arr.push({
    name: "Facebook",
    id:   "facebook",
    icons: [{size: 128, url: "/icons/app/facebook.png", "borderRadius":16}],
    appLaunchUrl: "https://www.facebook.com/",
    optionsUrl: "https://www.facebook.com/settings",
    isApp:   true,
    enabled: custom_apps["facebook"]
  });

  sys_apps_arr.push({
    name: "Twitter",
    id:   "twitter",
    icons: [{size: 128, url: "/icons/app/twitter.png", "borderRadius":16}],
    appLaunchUrl: "https://twitter.com/",
    optionsUrl: "https://twitter.com/settings/account",
    isApp:   true,
    enabled: custom_apps["twitter"]
  });

  // if blpcfgokakmgnkcojhhkbfbldkacnbeo is not installed
  sys_apps_arr.push({
    name: "YouTube",
    id:   "youtube",
    icons: [{size: 128, url: "/icons/app/youtube.png", "borderRadius":16}],
    appLaunchUrl: "https://www.youtube.com/",
    optionsUrl: "https://www.youtube.com/account",
    isApp:   true,
    enabled: custom_apps["youtube"]
  });

  function add_amazon_user_app() {
    return add_user_app(
      'Amazon', 
      'https://www.amazon.com/', 
      [{size: 128, url: "/icons/app/amazon.png", "borderRadius":16}]
    );
  }



  var in_ordered = {};

  // stored list of apps in custom order
  for (var j = 0; j < ordered.length; j++) {
    in_ordered[ordered[j]] = true;
  }

  apps = {};

  log_bug_drag('apps = {}');

  // check for missing system apps (recently added)
  for (var i = sys_apps_arr.length; i--;) {
    var app = sys_apps_arr[i];
    if (!app.isApp) continue;
    apps[app.id] = app;
    app.isHomeDefaultApp = true;
    if (!in_ordered[app.id] && app.enabled)
      ordered.unshift(app.id);
  }

  // check for missing chrome apps (recently added)
  for (var i = 0; i < chrome_apps_arr.length; i++) {
    var app = chrome_apps_arr[i];
    if (!app.isApp) continue;
    apps[app.id] = app;
    if (!in_ordered[app.id] && app.enabled)
      ordered.push(app.id);
  }

  // check for missing user apps (after purge)
  var user_app_ids = stored.user_app_ids.split(',');
  for (var j = 0; j < user_app_ids.length; j++) {
    var id = user_app_ids[j];
    if (!id) continue;
    if (!stored[id]) continue;
    if (in_ordered[id]) continue;
    ordered.push(id);
  }

  // user apps data
  for (var j = 0; j < ordered.length; j++) {
    var id = ordered[j];
    if (id.indexOf('user_app') != 0) 
      continue;
    if (!stored[id]) 
      continue;
    try { 
      apps[id] = JSON.parse(stored[id]);
      on_user_app_init(apps[id]);
    } catch(e) {
      logError(new Error('ERROR: stored app has invalid JSON: ' + id));
    }
  }

  // add amazon if not exists
  /*
  try { 
    if (!stored.AMZN_app_added) {
      var amazonIDs = ordered.filter(function (id) {
        if (id.indexOf('user_app') != 0) return false;
        if (is_amazon_url(apps[id].appLaunchUrl)) return id;
      });
      if (!amazonIDs.length) {
        var newAmazonID = add_amazon_user_app().id;
        if (ordered[0] == 'webstore')
          ordered.splice(1, 0, newAmazonID);
        else
          ordered.unshift(newAmazonID);
      }
      stored.AMZN_app_added = 'true';
    }
  } catch(e) {
    logError(e);
  }
  */

  var appKeys = Object.keys(apps);
  log_bug_drag('app keys len: ' + appKeys.length);
  log_bug_drag('app keys: ' + appKeys.join(','));
  log_bug_drag('ordered: ' + ordered.join(','));

  stored.icons_order = ordered.join(',')///JSON.stringify(ordered);

  setTimeout(saveIconPreloadURLs, 1);
}

function saveIconPreloadURLs() {
  if (!apps) return;
  var ordered = stored.icons_order.split(',');
  var urls = [];
  function size128(icon) { return icon.size == 128 }
  for (var j = 0; j < ordered.length; j++) {
      var id  = ordered[j];
      var app = apps[id];
      if (app && app.icons) { //  && id.length != 32
        var icon = app.icons.filter(size128)[0] || app.icons[0];
        urls.push(icon.url);
      }
  }
  stored.PERF_preload_urls = urls.join(ITEM_SEPARATOR);
}

////////////
// TEMP: fix old draggable bug
/*
if (stored.icons_order) {
  if (stored.icons_order[0] == '[') {
    ga('send', 'event', 'debug', 'error-stored_icons_order', '#startsWith [');
    stored.icons_order = stored.icons_order.replace(/\[\],/g, '');
    if (stored.icons_order.slice(-1) == ']') {
      try {
        stored.icons_order = JSON.parse(stored.icons_order).join(',');
      } catch (e) {
        ga('send', 'event', 'debug', 'error-stored_icons_order', stored.icons_order);
      }
    } 
  }
}
*/
////////////

if (stored.icons_order) {
  ordered = stored.icons_order.split(',');
}

if (stored.TEMP_icons_v3 != 'true') {
  if (ordered && ordered.length) {
    stored.TEMP_icons_v3 = 'true';
    for (var i = 0; i < ordered.length; i++)
      delete stored['app_html_' + ordered[i]];
  }
}

chrome.management.getAll(function(array) {
  build_apps_list(array);
  include_3rd_party_services();
});


var custom_gmail, custom_facebook;

function on_user_app_init(app) {
  var url = app.appLaunchUrl;
  if (url.indexOf('facebook.com') > -1)
    custom_facebook = app.id;
  else (url.indexOf('gmail.com') > -1 || 
        url.indexOf('google.com/mail') > -1 ||
        url.indexOf('mail.google.com') > -1) 
    custom_gmail = app.id;
}


function add_user_app(name, url, icons) {
  var id = 'user_app_' + stored.user_app_id_inc++;
  stored.icons_order += "," + id;
  apps[id] = {
      name: name,
      id: id,
      icons: icons,
      appLaunchUrl: url,
      isApp: true,
      enabled: true
  };
  stored[id] = JSON.stringify(apps[id]);
  stored.user_app_ids += id + ',';
  chrome.runtime.sendMessage({name: 'add_new_app', id:id});
  // active view should scroll to show the newly installed app
  chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {name: "go_last_page"})
  });
  return apps[id];
}

function edit_user_app(id, name, url, icons) {
  apps[id] = {
      name: name,
      id: id,
      icons: icons,
      appLaunchUrl: url,
      isApp: true,
      enabled: true
  };
  stored[id] = JSON.stringify(apps[id]);
  chrome.runtime.sendMessage({name: 'edit_app', id:id});
}

function remove_user_app(id) {
  var user_app_ids = stored.user_app_ids.split(',');
  for (var i = 0; i < user_app_ids.length; i++)
    if (user_app_ids[i] == id)
      user_app_ids.splice(i, 1);
  stored.user_app_ids = user_app_ids.join(',');
  delete stored[id];
  if (apps[id].icons) {
    apps[id].icons.forEach(function (icon) {
      remove_file(extract_filename(icon.url));
    });
  }
}

 // TODO: merge this and handle_file_select
function save_new_background(url, callback) {
  imageURLToBlob(url, function (blob) {
    save_file_blob('/background.jpg', blob, callback);
    var protocol = 'filesystem:chrome-extension://';
    var url = protocol + window.APP_ID + '/persistent/background.jpg';
    change_options(function (settings_temp) {
      settings_temp.background_image = url;
    });
  });
}

function include_3rd_party_services() {

    include_js("/3rd-party/closed-tab/bg.js");

    // TODO: check settings.notifications['facebook'] etc.

    // optional services

    if (apps['pjkljhegncpnkpknbcohdijeoejaedia'] &&
        apps['pjkljhegncpnkpknbcohdijeoejaedia'].enabled ||
        custom_gmail) {
      include_js("/3rd-party/gmail/gmail.js");
    }

    //if (apps['dlppkpafhbajpcmmoheippocdidnckmm'] &&
    //    apps['dlppkpafhbajpcmmoheippocdidnckmm'].enabled) {
    //  include_js("3rd-party/gplus/gplus.js");
    //}

    if (apps['yahoo-mail'].enabled) {
      include_js("/3rd-party/yahoo-mail/yahoo-mail.js");
    }

    if (apps['facebook'].enabled || custom_facebook) {
      include_js("/3rd-party/facebook/facebook.js");
    }

    if (apps['hotmail'].enabled) {
      include_js("/3rd-party/hotmail/hotmail.js");
    }

    //if (apps['ejjicmeblgpmajnghnpcppodonldlgfn'] &&
    //    apps['ejjicmeblgpmajnghnpcppodonldlgfn'].enabled) {
      //window.GCAL_LOADED = function() {
      include_js("/3rd-party/gcalendar/gcalendar.js", function () {
        window.GCAL_checkAuth();
      });
      //};
      //include_js("/apis.google.com/js/client.js?onload=GCAL_LOADED");
    //}  
}

// temporary force update
var hotmail_html = stored.app_html_hotmail
if (hotmail_html && hotmail_html.indexOf('col002') > -1) {
  delete stored.app_html_hotmail;
}

if (chrome.runtime.setUninstallURL && !window.DEV) 
  chrome.runtime.setUninstallURL("https://s.homenewtab.com/farewell.html");


function receiveMessage(message) {
  if (message.name == "fbq" && message.arguments) {
    fbq.apply(window, message.arguments);
  } 
}

chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse) {
    //if (window.DEV) return;
    if (message.name == "ga" && message.arguments) {
      ga.apply(window, message.arguments);
    } else if (message.name == "ga_cb" && message.arguments) {
      ga.apply(window, message.arguments);
      if ('function' == typeof sendResponse)
        sendResponse();
    } else if (message.name == "fbq" && message.arguments) {
      fbq.apply(window, message.arguments);
    } else if (message.name == "fbq_cb" && message.arguments) {
      fbq.apply(window, message.arguments);
      if ('function' == typeof sendResponse)
        sendResponse();
    } else if (message.name == "adw" && message.arguments) {
      adw.apply(window, message.arguments);
    } else if (message.name == "pageview") {
      ga('set', 'page', message.page || 'main.html');
      ga('set', 'dimension1', settings.search_bar);
      ga('set', 'dimension2', settings.search_bar ? settings.search_fullscreen : -1); 
      if (settings.search_bar)
         ga('set', 'dimension3', settings.search_provider || 'N/A');
      ga('set', 'dimension4', isMac ? stored.SS_discrete_mouse_wheel == 'true' : -1); 
      ga('set', 'dimension5', stored.GEO_country_code || 'N/A'); 
      //ga('set',  'dimension6', !!settings.focus_mode); 
      var widgets = [];
      if (stored.WGS_notifications == 'true') widgets.push('noti');
      if (stored.WGS_quicknotes == 'true')    widgets.push('qnote');
      if (settings.focus_mode)                widgets = ['focus'];
      ga('set', 'dimension7', widgets.join(',') || 'N/A'); 
      ga('set', 'dimension8', get_wallpaper_provider());
      ga('set', 'dimension9', stored.GEO_custom_city != null ? 'custom' : 'auto');
      var effects = [];
      if (settings.background_gradient) effects.push('vignette');
      if (settings.background_fadein)   effects.push('fadein');
      ga('set', 'dimension10', effects.join(',') || 'N/A'); 
      ga('send', 'pageview');
    } else if (message.name == "search-event") {
      ga('search.send', 'event', 'search', 'click', message.term);
    } else if (message.name == "search-timeout") {
      ga('search.send', 'event', 'search', 'timeout');
    } else if (message.name == "search-slow") {
      ga('search.send', 'event', 'search', 'slow');
    }  else if (message.name == "search-event-url") {
      ga('search.send', 'event', 'search', 'url', message.url);
    } else if (message.name == "search-event-url-suggested") {
      ga('search.send', 'event', 'search', 'url-suggested', message.url);
    } else if (message.name == "new-tab-exception") {
      gaException(message.message, message.file, message.line, message.stack);
    }
  });

chrome.runtime.onInstalled.addListener(function (details) {
  //if (window.DEV) return;
  if ('install' == details.reason) {
    ga('send', 'pageview', { page: 'install.html' });
    ga('send', 'event', 'install', 'install');
    fbq('track', 'Install');
    adw('Install');
    stored.install_time = g_update_time;
    checkInstallConversion();
    show_thank_you_page();
  } else if ('update' == details.reason) {
    var version = chrome.runtime.getManifest().version;
    ga('update.send', 'event', 'update', 'update', version);
  }
});

function show_thank_you_page() {
  chrome.tabs.create({
    url: chrome.extension.getURL('pages/thank_you.html'), 
    active: true
  });
}

// check for connection errors
function testConnectionToSearch() {
  testConnectionToURL(window.SEARCH_ORIGIN + '/blank.gif');
}

(function () {
if (Math.random() > 0.01) return;
window.DEV ? testConnectionToSearch()
           : setTimeout(testConnectionToSearch, 10*SECONDS);
});

function checkInstallConversion() {
  if (!chrome.cookies) return;
  var url = "https://chrome.google.com/webstore/"; // detail/ehhkfhegcenpfoanmgfpfhnmdmflkbgk
  //"73091649.1441531513.921.486.utmcsr=sscr|utmccn=sscr-cmp|utmcmd=(not%20set)"
  var map = {'utmcsr': 'source', 'utmccn': 'name', 'utmcmd': 'medium'}; // campaign
  chrome.cookies.get({ url: url, name: "__utmz" }, function (cookie) { 
    if (!cookie) return;
    cookie = cookie.value;
    cookie = cookie.slice(cookie.indexOf('utm'));
    var campaign = {};
    var parts = cookie.split('|');
    parts.forEach(function (part) {
      var key   = part.split('=')[0];
      var value = part.split('=')[1];
      campaign[map[key]] = decodeURIComponent(value);
    });
    ga('send', 'event', 'conversion', 'install', campaign.source);
    ga('set', 'campaignName',   campaign.name   || '(direct)');
    ga('set', 'campaigSource',  campaign.source || '(direct)');
    ga('set', 'campaignMedium', campaign.medium || 'organic');
  });
}

window.is_notification_enabled = is_notification_enabled;


chrome.runtime.onInstalled.addListener(function (details) {
  if ('install' == details.reason)
    stored.TEST_search_fullscreen = true;
});

chrome.browserAction.onClicked.addListener(function (tab) {
  //chrome.tabs.create({url: "index.html"});
  chrome.tabs.create({url: "about:newtab"});
});

if (/mac/i.test(navigator.userAgent)) {
  chrome.webNavigation.onCompleted.addListener(function(details) {
    if (!details.url) return;
    if (!/^https?:\/\/www\.google\./.test(details.url)) return;
    if (details.url.contains('/chrome/newtab/')) return;
    chrome.tabs.executeScript(details.tabId, { file: "/js/temp/sscr_detect.js" });
  });
  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.to != 'bg') return;
    if (msg.name == "SS_discreteMouseWheel") {
      stored.SS_discrete_mouse_wheel = true;
    }
  });
}

(function () {


var valid_install = +stored.install_time && +stored.SRV_conf_new_install_time;
var already_new_install = +stored.install_time < +stored.SRV_conf_new_install_time;
if (valid_install && already_new_install) return;

var last_fetch = stored.SRV_conf_last_fetch || 0;
if (Date.now() - last_fetch < 12 * 60 * 60 * 1000) return;
stored.SRV_conf_last_fetch = Date.now();

ajax('https://search.homenewtab.com/conf/conf.php', function (xhr) {
  var res = xhr.responseText;
  if (!res) return;
  if (res.startsWith('<') && res.includes('permission')) return; 
  var conf  = JSON.parse(res);
  if (conf.error) return; 
  stored.SRV_conf = xhr.responseText;
  var new_install_time = +new Date(conf.new_install_time);
  if (new_install_time) // avoid NaN in case of date parse errors
    stored.SRV_conf_new_install_time = new_install_time;
}, function (xhr) { });

})();


async function ajax(url, onSuccess, onError) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const xhr = {
        status: response.status,
        responseText: await response.text()
      };
      onSuccess?.(xhr);
    } else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    onError?.({ status: 0, statusText: error.message });
  }
}




/*
if (chrome.idle)
chrome.idle.onStateChanged.addListener(onIdleStateChanged);
function onIdleStateChanged(newState) {
  if (newState == "idle") {
    chrome.runtime.sendMessage({"action": "idle"});
  }
}
*/




function is_amazon_url(url) { // com.au, com.br, com.mx
  return /^https?:\/\/(www\.|smile\.)?amazon\.(com|ca|cn|co.uk|co.jp|fr|de|it|in|nl|es)(\.|\/|$)/i
         .test(url);
}


// ebay codes are in main.js
"https://www.booking.com/index.html?aid=1195117";
"https://s.click.aliexpress.com/e/yNnuBeeQf";

///https://www.booking.com/index.en-us.html?aid=1195117;sid=30b7e29c69a1d719f0560d4fbf6fc746;click_from_logo=1

//if ('undefined' == typeof stored.SD_ublock)
stored.SD_ublock = 'false';

//cjpalhdlnbpafiamejdnhcphjbkeiagm // ublock origin
//ocifcklkibdehekfnmflempfgjhbedch // adblock pro
chrome.management.get('cjpalhdlnbpafiamejdnhcphjbkeiagm', function (ext) {
  if (!chrome.runtime.lastError && ext && ext.enabled) stored.SD_ublock = 'true';
});
chrome.management.get('ocifcklkibdehekfnmflempfgjhbedch', function (ext) {
  if (!chrome.runtime.lastError && ext && ext.enabled) stored.SD_ublock = 'true';
});


// TEMP: fixing shit about disappearing apps
ordered.forEach(function (id) {
  //if (id.indexOf('user_app_') != 0) return;
  var html = stored['app_html_' + id] || "";
  if (html.indexOf('visibility: hidden;') != -1) {
    stored['app_html_' + id] = html.replace('visibility: hidden;', '');
  }
  if (html.indexOf('test-item pressed') != -1) {
    stored['app_html_' + id] = html.replace('test-item pressed', 'test-item');
  }
});



// TEMP FOR DEBUG

// limitation: doesn't support mixed POST and GET
// grabs all ?param=value and turns them into a POST params

async function ajax2(url, onSuccess, onError, method = 'GET') {
  try {
    const [baseUrl, queryString] = url.split('?');
    const options = {
      method,
      headers: {},
    };

    if (method.toUpperCase() === 'POST') {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = queryString;
    } else {
      url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }

    const response = await fetch(url, options);
    
    if (response.ok) {
      onSuccess?.(response);
    } else {
      onError?.(response);
    }
  } catch (error) {
    onError?.(error);
  }
}

//
// Stat
//

// pagespeed

function delayedLogPageSpeedStats(nav, nav_val, nav_label) {

  return; // generating too many events?

  if (!nav) return;

  // browser starting up or extension just updated, load times will be tainted
  if (performance.now() < 30 * 1000) return;

  setTimeout(function () {
      var v = '5';

      if (nav.constructor.name == 'PerformanceNavigationTiming') {
        /*///
        gaPageSpeedTiming('domInteractive', nav.domInteractive);
        gaPageSpeedTiming('domContentLoadedEventEnd', nav.domContentLoadedEventEnd);
        gaPageSpeedTiming('domComplete', nav.domComplete);
        */
        gaPageSpeedTiming('domInteractive'+v, nav.domInteractive);
        gaPageSpeedTiming('domContentLoadedEventEnd'+v, nav.domContentLoadedEventEnd);
        gaPageSpeedTiming('domComplete'+v, nav.domComplete);

        window.postMessage({ name: 'newTab.pageLoad', time: nav.domComplete }, '*');
      } else {
        ///gaPageSpeedTiming(nav, nav_val, nav_label);
        gaPageSpeedTiming(nav +v, nav_val, nav_label);

        if (nav == 'domComplete') {
          window.postMessage({ name: 'newTab.pageLoad', time: nav_val }, '*');
        }
      }
  }, 1000);
}

//v3 removed during manifest v3 migration
/*
setTimeout(function () {
  var SLOW_THRESHOLD = 800; // ms
  var STACK_SIZE = 10;
  var loadTimes = storageGet('PERF_loadTimes10') || Array(STACK_SIZE).fill(0);
  function storePageLoadTime(newTime) {
    loadTimes.unshift(Math.round(newTime));
    if (loadTimes.length > STACK_SIZE) loadTimes.pop();
    var slowCnt = 0;
    for (var i = 0; i < loadTimes.length; i++) 
      if (loadTimes[i] > SLOW_THRESHOLD) 
        slowCnt++;
    storageSet('PERF_disableFadeIn', (slowCnt > loadTimes.length/2));
    storageSet('PERF_loadTimes10', loadTimes);
  }
  window.addEventListener('message', function (e) {
    if (e.data.name != 'newTab.pageLoad') return;
    storePageLoadTime(e.data.time);
  });
}, 1);
*/

(function () {

chrome.runtime.onMessage.addListener(function(m) {
  if (m.name != "pageview") return;
  var today       = getDateString(new Date);
  var lastSendDay = getDateString(new Date(+stored.STAT_ga_date));
  if (today == lastSendDay) return;
  stored.STAT_ga_date = Date.now();
  var events = JSON.parse(stored.GCAL_eventList||'[]');
  events = events.slice(0, 1); // first one only
  var enabled = settings.notifications && 
                settings.notifications.ejjicmeblgpmajnghnpcppodonldlgfn !== false;
  calendar_check_auth(function (isCalAuthorized) {
    var type = isCalAuthorized ? ('auth,has-event:' + !!events.length) : 'forbidden';
    type = (enabled ? 'enabled' : 'disabled') + ',' + type;
    ga('stats.send', 'event', 'stats', 'gcal-event-exists-3', type);
    events.forEach(function (e) {
      // only interested in the lengths to see how big the UI should accomodate
      var titsLen = (e.title||'').length       || 'nada'; 
      var locLen  = (e.location||'').length    || 'nada';
      var descLen = (e.description||'').length || 'nada';
      ga('stats.send', 'event', 'stats', 'gcal-title-len', 'len:'+titsLen, titsLen);
      ga('stats.send', 'event', 'stats', 'gcal-location-len', 'len:'+locLen, locLen);
      ga('stats.send', 'event', 'stats', 'gcal-description-len', 'len:'+descLen, descLen);
      // remindersLen
    });
  });

  // TEMP REMOVE: individual clicks are sent, this is unneccesary
  //sendButtonStats();

  //sendWeatherAndGeoStats();
});

if (ordered) {
  //ga('stats.send', 'event', 'stats', 'apps-count-2', ordered.length, ordered.length);
}

var btns = ['qnotes-button', 'notifications-button', 'bookmarks-button',
 'recently-closed-button', 'focus-button', 'background-button', 
 'review-button', 'info-button', 'settings-button'];

function sendButtonStats() {
  btns.forEach(sendButtonStatForId); 
}

function sendWeatherAndGeoStats() {
  var weatherCnt = storageGet('STAT_weather_fetch_cnt');
  var geoCnt = storageGet('STAT_geo_fetch_cnt');
  storageSet('STAT_weather_fetch_cnt', 0);
  storageSet('STAT_geo_fetch_cnt', 0);
  ga('stats.send', 'event', 'cnt-daily', 'fetch-weather', weatherCnt, weatherCnt);
  ga('stats.send', 'event', 'cnt-daily', 'fetch-geo', geoCnt, geoCnt);
}

function sendButtonStatForId(id) {
  var name           = id.replace(/-/g, '_');
  var storedDailyKey = 'STAT_click_cnt_daily_' + name;
  var storedAllKey   = 'STAT_click_cnt_all_'   + name;
  var cntDaily       = storageGet(storedDailyKey, 0); 
  var cntAll         = storageInc(storedAllKey, cntDaily);
  ga('stats.send', 'event', 'click-cnt-daily', name, cntDaily, cntDaily);
  ga('stats.send', 'event', 'click-cnt-all',   name, cntAll,   cntAll);
  storedSet(storedDailyKey, 0);
  //stored[storedAllKey] = cntAll; done by Inc
}

/*function sendDefaultFontSize() {
  var defFontSize = compStyle(document.documentElement, 'font-size');
  ga('stats.send', 'event', 'style', 'default-font-size-2', defFontSize);
}

function compStyle(el, style) {
  return window.getComputedStyle(el, null).getPropertyValue(style);
}

if ('true' != stored.STAT_sent_def_font_size) {
  stored.STAT_sent_def_font_size = 'true';
  sendDefaultFontSize();
}*/

})();


function getCurrentDateString() {
  return getDateString(new Date);
}
function getDateString(d) {
  if (d == null) d = new Date;
  if (d.constructor != Date) throw 'Cannot stringify non-Date';
  return d.getFullYear() + '-' + 
        (d.getMonth()+1) + '-' +
         d.getDate();
}

// Update Check
(function () {
  if (stored.VER_next_fetch && Date.now() < stored.VER_next_fetch) 
    return;
  stored.VER_next_fetch = Date.now() + 3*DAYS;
  // status: "throttled", "no_update", or "update_available"
  chrome.runtime.requestUpdateCheck(function (status, details) {
    stored.VER_version = details.version;
    stored.VER_status  = status;
  });
})();


// Airfind ping

// check for connection errors
function testConnectionToURL(url, onload, onerror, ontimeout) {
  if (!navigator.onLine) return; // setTimeout one hour
  var start = Date.now();
  var searchErrorTimeout;
  searchErrorTimeout = setTimeout(function () {
    ga('send', 'event', 'test-connection', url, 'timeout');
    ontimeout && ontimeout();
  }, 5*SECONDS);

  function onAjaxError() {
    ga('send', 'event', 'test-connection', url, 'failed');
    onerror && onerror();
    clearTimeout(searchErrorTimeout);
  }
  function onAjaxSuccess() {
    ga('send', 'event', 'test-connection', url, 'passed', Date.now()-start);
    onload && onload();
    clearTimeout(searchErrorTimeout);
  }
  ajax(url, onAjaxSuccess, onAjaxError);
}



(function () {

  if (!is_facebook_country() || is_ublock()) {
    delete stored.TILE_promo_airfind_conn;
    return;
  }

  stored.TILE_promo_airfind_conn = 'true';

  function is_facebook_country() {
    var cc = stored.GEO_country_code;
    return cc == null || ({'US': 1, 'CA': 1})[cc];
  }

  function is_ublock() { return 'true' == stored.SD_ublock; }

  function success() {  }
  function fail() {
    stored.TILE_promo_airfind_conn = 'false';
  }
  function makeAirfindTester(url) {
    return function () {
        testConnectionToURL(url, success, fail, fail);
    };
  }
  var delay = window.DEV ? 1 : 5*SECONDS; // unused as of yet
  setTimeout(makeAirfindTester('https://airfind.com/favicon.ico'), delay);
  setTimeout(makeAirfindTester('https://c.adclickthru.net/'), delay);
  setTimeout(makeAirfindTester('https://11167599.pathroutes.com/'), delay);
})();


//
// Testing
//

//v3 Code not updated for manifest v3
/*
(function () {
if (!window.DEV) return;
var audio = document.createElement('audio');
audio.src = '/sound/hour_chime.mp3';
audio.volume = 0.04;
//play_sound();
function play_sound() {
  if (+new Date - play_sound.last < 1000)  return;
  play_sound.last = +new Date;
  audio.currentTime = 0;
  audio.play();
}
function refresh_date_loop() {
  var date = refresh_date();
  setTimeout(refresh_date_loop, (60 - date.getSeconds()) * SECONDS);
}
function refresh_date() {
  var date = new Date;
  if (date.getMinutes() == 0) play_sound();
  return date;
}
refresh_date_loop();
})();
*/

