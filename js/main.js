// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

chrome.runtime.sendMessage({name: 'search_autofocus'});

// errors
window.addEventListener('error', logError);
function logError(e) {
  include_js_once('js/search/common.js', function () {
    // remove old listener, logerror.js will add its own
    window.removeEventListener('error', logError); 
    include_js_once('js/logerror.js', function () { 
      logError(e); 
    });  
  }); 
}
// Note: localStorage.latestError not registered to errors WebSQL 
// inside logerror.js right now


// dragable bug
log_bug_drag.list = [];
log_bug_drag.send = function() { 
  chrome.runtime.sendMessage({name: 'log_bug_drag', content: log_bug_drag.list}); 
}
function log_bug_drag(txt) { log_bug_drag.list.push(txt); }

function byId(id, base) { return (base||document).getElementById(id); }
function bySelector(sel, base) { return (base||document).querySelector(sel); }
function bySelectorAll(sel, base) { return (base||document).querySelectorAll(sel); }
function bench(text) { console.log( (text||"") + ": " + (+new Date - start) ); }

var stored = localStorage;
var html = document.documentElement;
window.requestAnimationFrame = window.requestAnimationFrame || 
                               window.webkitRequestAnimationFrame;

//var bg = chrome.extension.getBackgroundPage();
// bg is not ready for a while on Chrome startup
//if (!bg) chrome.runtime.getBackgroundPage(bgNew => bg = bgNew); 
var apps, hidden_apps;
var ordered;
var page = byId("page");
var ITEM_SEPARATOR = "\\c";
var FIELD_SEPARATOR = "\\a";
var start = +new Date;
var MAX_NOTIFICATIONS = 10; // shown / stored
var MAX_NOTIFICATIONS_SHOWN = 10; // shown / stored
var LEFT_BUTTON   = 0;
var MIDDLE_BUTTON = 1;
var RIGHT_BUTTON  = 2;
var firstPaintListeners = [];


var ICONS = {
  'tweet':      'icons/twitter.png',/// TODO remove later
  'twitter':    'icons/twitter.png',
  'mail':       'icons/mail.png',
  'gmail':      'icons/gmail.png',
  'yahoo-mail': 'icons/yahoo-mail.png',
  'hotmail':    'icons/hotmail.png',
  'news':       'icons/news.png',
  'facebook':   'icons/facebook.png'
};

var indicators = {
  'pjkljhegncpnkpknbcohdijeoejaedia': 'gmail',
  'pjjhlfkghdhmijklfnahfkpgmhcmfgcm': 'greader',
  'dlppkpafhbajpcmmoheippocdidnckmm': 'gplus',
  'yahoo-mail': 'yahoo-mail',
  'hotmail':    'hotmail',
  'facebook':   'facebook'
};


window.$ = function (sel, ctx) { return (ctx||document).querySelectorAll(sel); }
NodeList.prototype.__proto__ = Array.prototype;

Node.prototype.on = window.on = function (name, fn, capture) {
  this.addEventListener(name, fn, capture)
};
Node.prototype.off = window.off = function (name, fn, capture) {
 this.removeEventListener(name, fn, capture)
};
Node.prototype.remove = function () { // Element.prototype.remove is the standard
 this.parentNode && this.parentNode.removeChild(this);
};
  
NodeList.prototype.on = 
NodeList.prototype.addEventListener = function (name, fn, capture) {
  this.forEach(function (elem, i) {
    elem.on(name, fn, capture)
  });
};
NodeList.prototype.off = 
NodeList.prototype.removeEventListener = function (name, fn, capture) {
  this.forEach(function (elem, i) {
    elem.off(name, fn, capture)
  });
};

// NOTE: also requestAnimationFrame is safe, 
// it's not called when tab is in background
/*var doVisualUpdates = true;
document.addEventListener('visibilitychange', function () {
  doVisualUpdates = !document.hidden;
});*/ // took 100ms wtf?


// always the latest bound gets executed first
function addEscHandler(fn, win, keepHandler) {
  win = win || window;
  function remove() {
    win.removeEventListener('keydown',  innerHandler, true);
  }
  function innerHandler(e) {
    if (e.keyCode == 27) {
      if ((e.target.isContentEditable || 
          /textarea|input/i.test(e.target.nodeName))
         && e.target.getAttribute('escfocus') == null) {
        return e.target.blur();
      }
      console.log('esc');
      if (!keepHandler) remove();
      e.stopPropagation();
      fn();
    }
  }
  win.addEventListener('keydown',  innerHandler, true);
  return remove;
}

function bindNextTick(fn, thisArg, args) {
  return function () { setTimeout(fn, 1) }; 
}

function select_tab(id) {
  chrome.tabs.update(id, {active: true});
}

function launch_app(el, opt) {

  opt = opt || {};
  var url   = turn_tags_in_url(el.dataset.url);
  var app   = apps[el.id];
  var newTabId = app.tabId;

  // we have a running tab for the app
  if (newTabId) {
    launch_app_animation(function(){
      select_tab(newTabId);
    });
    return;
  }

  function create_tab(url) {
    chrome.tabs.create({
      url: url,
      active: false
    }, function(tab) {
      newTabId = tab.id;
    });
  }

  // different ways to open the app
  logAppLaunchURLForApp(app, function () {
    if (!url)
      chrome.management.launchApp(app.id);
    else if (opt.new_tab)
      create_tab(url, {active: opt.active});
    else 
      chrome.tabs.update({url: url});
  });
}

chrome.runtime.onMessage.addListener(function(message) {
  if (message.type == 'rpc' && 'function' == typeof window[message.name])
    window[message.name].apply(window, message.args);
});

function create_notification(icon, title, body) {
  include_js_once('js/widgets/notifications.js', 
    function () { create_notification(icon, title, body); });
}

function show_recent_notifications() {
  include_js_once('js/widgets/notifications.js', 
    function () { show_recent_notifications(); });
}

function set_indicator(id, count) {
  include_js_once('js/widgets/notifications.js', 
    function () { set_indicator(id, count); });
}

function generate_indicator(name) {
  var count = +stored["indicator-"+name];
  var style = count ? "display:block" : "";
  return '<div class="indicator" id="indicator-'+name+'" style="'+style+'">'+ count +'</div>';
}

function reset_global_unread_notifications() {
  stored.NOTI_unread_global = 0;
  redisplay_global_unread_notifications();
}

function redisplay_global_unread_notifications() {
  var unread = Number(stored.NOTI_unread_global);
  byId('indicator-global').innerHTML = unread;
  byId('indicator-global').style.display = unread ? 'block' : 'none';
}

redisplay_global_unread_notifications();


if (stored.WGS_quicknotes == 'true') {
  load_quick_notes();
}

function load_quick_notes() {
  include_js_once('/js/widgets/notes.js');
}

function save_ordered() {
  stored.icons_order = ordered.join(',');
}

function load_ordered() {
  var ordered_string = stored.icons_order || '';
  return ordered_string.split(',');
}


var blankSrc = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function get_app_html(app, opt) {
  opt = opt || {};
  if (app.name.indexOf("Google ") > -1)
    app.name = app.name.replace('Google ', '');
  if (is_webstore(app)) {
    app.name = "Install apps";
    app.icons[0].url = '/icons/app/webstore.png';
    app.icons[0].borderRadius = 0.17 * 128;
  } 
  var name = app.name.length <  14 ? app.name : app.name.slice(0,12) + '.';
  //var name = app.name.length <  26 ? app.name : app.name.slice(0,24) + '.';
  var icon = (app.icons||[]).filter(function(icon){ return icon.size == 128; })[0];
  var iconHTML;
  //if (app.id == 'ejjicmeblgpmajnghnpcppodonldlgfn') {
  //  icon = get_calendar_icon() ;
  //} else if (icon)
  if (icon) {
    var iconStyle = '';
    var iconClass = is_chrome_app(app) ? 'chrome-app-ico' : '';
    if (icon.borderRadius) {
      var borderRadius = (icon.borderRadius / 128) * 100;
      iconStyle = 'style="border-radius:' + borderRadius + '%"';
      iconClass += ' bordered';
      // if (icon.borderRadius > 60) iconClass += ' circle';
    }
    iconClass = iconClass ? 'class="' + iconClass + '"' : '';
    if (opt.lazy_img) { // blank.gif
      iconHTML = '<img src="about:blank" data-src="'+ icon.url +'" '+ iconClass +' '+ iconStyle +'>';
    } else {
      iconHTML = '<img src="'+ icon.url +'" '+ iconClass +' '+ iconStyle +'>';
    }
  } else {
    //icon = '<img src="'+ blankSrc +'">';
    iconHTML = '<img src="'+ "/icons/app/blank/blank2.png" +'"" class="chrome-app-ico">';
  }
  var show_hide = opt.hidden ? ' style="display:none"' : '';
  //iconHTML = '<img src="'+ blankSrc +'">'; // display="none"
  return '<div class="test-item" id="'+ app.id +'" data-url="'+ app.appLaunchUrl +'"' + 
            show_hide + '>' + 
            (indicators[app.id] ? generate_indicator(indicators[app.id]) : '') +
            '<div class="test-item-launcher">' +
              iconHTML +
            '<\/div>' +
            '<div class="test-item-text">' + name + '<\/div>' +
         '<\/div>';
}

function is_chrome_app(app) {
  return app.id.length == 32;
}

function get_apps_page_html(limit) {
  log_bug_drag('get_apps_page_html');
  if (!ordered) return ''; 

  log_bug_drag('get_apps_page_html ordered ok len: ' + ordered.length);
  log_bug_drag('get_apps_page_html ordered: ' + ordered.join(','));

  // build html (ignoring disabled apps)
  var fragments = [];
  var page_items = ordered;
  limit = limit || page_items.length;
  var app_opts = { hidden: true, lazy_img: true };

  for (var j = 0; j < limit; j++) {
    var id  = page_items[j];
    var app = apps[id];
    // if the app got deleted (e.g.: Google removed it from the store)
    // we should ignore it
    if (!app)
      continue; //delete ordered[id]; 
    if (app.id == "pfpeapihoiogbcmdmnibeplnikfnhoge")
      continue; ///original hotmail
    if (hidden_apps && hidden_apps[app.id])
      continue; ///original hotmail
    //if (is_chrome_app(app))
    //  continue; 
    var html = '';/// = cache_get_app_html(app);
    if (!html) {
      var is_first_page = false; // j < 21;
      html = get_app_html(app, is_first_page ? null : app_opts);
      ///cache_set_app_html(app, html);
    }
    fragments.push(html);
  }

  return fragments.join('');
}

function cache_set_app_html(app, html) {
  return; /// TAKEN OUT

  var id = (typeof app == 'string') ? app : app.id;
  html || (html = get_app_html(apps[id]));
  stored['app_html_' + id] = html;

  /*
  var src = html.match(/src="([^"]+)"/)[1];
  if (src.indexOf('data:') === 0) return;
  getDataURL(src, function(dataURL) {
    stored['app_html_' + id] = html.replace(src, dataURL);
  });
  */
}

function getDataURL(url, callback) {
    var image = new Image();
    image.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = this.naturalWidth; // or 'width' if you want a special/scaled size
        canvas.height = this.naturalHeight; // or 'height' if you want a special/scaled size
        canvas.getContext('2d').drawImage(this, 0, 0);
        callback(canvas.toDataURL('image/png'));
    };
    image.src = url;
}



function is_webstore(app) {
  return (app.id == 'ahfgeienlihckogmohjhadlkjgocpleb' || app.id == 'webstore');
}

function cache_get_app_html(app) {
  ///get_app_html(app);
  /// cachin turned off currently

  /// no caching for webstore (temporary)
  //if (is_webstore(app))
  //  return get_app_html(app);

  // no caching for live Calendar icon
  //if (app.id == 'ejjicmeblgpmajnghnpcppodonldlgfn')
  //  return get_app_html(app);

  // everything else is fine
  var id = (typeof app == 'string') ? app : app.id;
  return stored['app_html_' + app.id];

}


apps_init.cnt = 0;

async function apps_init() {

  apps_init.cnt ++;

  // causes problems when just entering focus mode, draggable keeps the 3x5 layout
  //if (apps_init.done) return;
  //apps_init.done = true;

  // GA error: getBackgroundPage is not a function 
  ///if ('function' == typeof chrome.extension.getBackgroundPage)
  ///above fix temporarily removed
  //  bg = chrome.extension.getBackgroundPage();

  let bg;
  try {
    bg = await getBackgroundVars(['apps', 'hidden_apps']);
  } catch (e) {
    // ignore
  }

  // when launching the browser, wait for the bg page to be ready
  if (!bg || !bg.apps) {
    if (!byId('apps-loading'))
      byId('apps-pages-list').innerHTML = '<div id="apps-loading">Loading...</div>';
    setTimeout(apps_init, 10);
    return;
  }

  log_bug_drag('apps_init.cnt: ' + apps_init.cnt);

  apps = bg.apps;
  hidden_apps = bg.hidden_apps;

  ordered = load_ordered();

  build_apps_pages();
}


function build_apps_pages() {
  var apps_page = byId('apps-pages-list');
  var html = get_apps_page_html();

  //if (!html) return;

  //var frag = document.createDocumentFragment();
  //frag.innerHTML = html;
  //apps_page.innerHTML = html;
  //var parentNode = apps_page.parentNode;
  //apps_page.remove();
  //parentNode.appendChild(apps_page);

  apps_page.style.display = 'none';
  apps_page.innerHTML = html;

  log_bug_drag('get_apps_page_html.length: ' + apps_page.innerHTML.length);

  document.documentElement.style.display = '';

  var opt = make_draggable_options();
  if (window.draggable_init) {
    log_bug_drag('draggable_init Sync');
    window.draggable_init(opt);
  } else {
    log_bug_drag('draggable_init Async');
    window.draggable_should_init_async = true; 
    window.draggable_async_options = opt;
  }
}

function determine_grid_size() {
  if (in_widget_mode())
    return { rows: 4, cols: 5, apply_container_width: false };
  else 
    return { rows: 3, cols: 7, apply_container_width: true };
}

function make_draggable_options() {
  var opt = determine_grid_size();
  opt.page_height_max = calc_draggable_max_height();
  //opt.page_height_max_fn = calc_draggable_max_height;
  opt.page_height_max_percent = in_widget_mode() ? 0.9 : 0.8;
  return opt;
}

function refresh_apps_grid() {
  var opt = make_draggable_options();
  window.draggable_recalc(opt);
}

function calc_draggable_max_height() {
  if (!in_widget_mode()) {
    return byId('datetime-row').getBoundingClientRect().top
         - byId('apps-slider').getBoundingClientRect().top;
    //return byId('datetime-row').offsetTop
    //     - byId('apps-slider').offsetTop;
  }
  return Infinity;
}

window.on('resize', function () {
  var opt = make_draggable_options();
  if (window.draggable_schedule_recalc) 
    draggable_schedule_recalc(opt);
});

function purge_html_cache() {
  if (!ordered) return;
  for (var i = 0; i < ordered.length; i++)
    delete stored['app_html_' + ordered[i]];
  chrome.extension.getBackgroundPage().location.reload();
  location.reload();
}

function purge_html_cache_full() {
  delete stored.icons_order;
  purge_html_cache();
}

async function dom_ready() {
  ///bench('ready');///
  refresh_date_loop();
  refresh_event_start();

  if (!settings.focus_mode) {

    await apps_init();

    if (stored.WGS_notifications == "true")
      show_recent_notifications();
    //new ApplicationPanel(byId('apps-wrapper'));
  }

  requestAnimationFrame(function () {
    firstPaintListeners.forEach(function (fn) { fn(); });
  });
}

window.addEventListener('focus', refresh_date);
document.addEventListener('visibilityChange', function () {
  if (!document.hidden) refresh_date();
});
  
addSettingsListener('time_format', refresh_date);

var months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function refresh_date() {
  var date = new Date;
  var minutes = prefix_with_zero(date.getMinutes());
  var hours = date.getHours();
  if (settings.time_format == '12') {
    hours = ((hours + 11) % 12 + 1);
  }

  if (settings.time_format == '24') {
    hours = prefix_with_zero(hours);
  } else if (!settings.focus_mode && !in_widget_mode()) {
    hours = prefix_with_hidden_zero(hours);
  } 

  // date.toLocaleDateString().slice(0, -6);
  byId("time-text").innerHTML = fixKerning(hours + ':' + minutes); //  style='color:#e1e1e1'
  byId("date").innerHTML = getDayMonthDate(date);
  byId("date-reveal").innerHTML = getDayMonthDate(date); 
  return date;
}


function closer(txt) {
  return "<span class='closer'>" + txt + "</span>";
}

function fixKerning(txt) {
  return txt.replace(/1:/g, '<span class="closer">1</span>:')
            .replace(/:1/g, '<span class="closer">:</span>1')
            .replace(/1$/g, '<span class="closer">1</span>');
}

function getDayMonthDate(date) {
  date = date || new Date();
  return days[date.getDay()] + ', ' + 
         months[date.getMonth()] + ' ' + 
         date.getDate();
}

function refresh_date_loop() {
  var date = refresh_date();
  refresh_event_day();
  setTimeout(refresh_date_loop, (60 - date.getSeconds()) * SECONDS);
}

function prefix_with_hidden_zero(num) {
  return num < 10 ? '<span style="opacity:0">0</span>' + num : ''+num;
}

function prefix_with_zero(num) {
  return num < 10 ? '0' + num : ''+num;
}

function format_time(date) {
  var hours = date.getHours();
  var mins = date.getMinutes();
  var ampm = (hours < 12) ? 'AM' : 'PM';
  hours = ((hours + 11) % 12 + 1);
  return hours + ':' +  prefix_with_zero(mins) + ' ' + ampm;
}

function refresh_event_start() {
  
  var forceShowPromoChance = 0; //Math.random() < 0.01; // 1%
  if (settings.notifications && 
      settings.notifications.ejjicmeblgpmajnghnpcppodonldlgfn === false &&
      !forceShowPromoChance) {
    byId('upcoming-event').style.display = 'none';
    return;
  }
  

  // listen to all new events
  chrome.runtime.onMessage.addListener(function(message){
     if (message.name != 'upcoming-event') return;
     refresh_event(message.data)
  });
  // fetch current calendar events
  chrome.runtime.sendMessage("get-calendar-events", refresh_event);
  if (stored.GCAL_cached_event_html)
    byId('upcoming-event').innerHTML = stored.GCAL_cached_event_html;
  try {
    // TODO: caching can fuck up the day (NOW, TODAY, NEXT FRIDAY)
    refresh_event([JSON.parse(stored.GCAL_cached_event)]);
  } catch (e) {}
}

var displayed_event;

function refresh_event_day() {
  if (!displayed_event || !byId('upcoming-event-day')) return;
  var event = displayed_event;
  byId('upcoming-event-day').innerHTML = format_day(event.start, event.end);
}

function refresh_event(events) {
  refresh_event_lazy(events);
  /*
  if (!events.length) return;
  var too_distant = (new Date(events[0].startTime) > Date.now() + 2 * DAYS);
  if (too_distant) return;
  include_js_once('js/widgets/calendar.js', 
    function () { refresh_event_lazy(events); });
    */
}


// calendar.js


function is_today(date) {
  return (new Date).toDateString() == date.toDateString();
}
function is_right_now(start, end) {
  var today = new Date;
  return +today >= +start && +today <= +end;
}

// it assumes a date in the future (google calendar)
function format_day(date, end_date) {
  var today = new Date;

  if (is_right_now(date, end_date)) {
    //return '<b style="color: #ffd400;" class="circle">●</b> ' +   // ● ◉
    return '<i class="fas fa-circle"></i> ' +
           '<b class="bolder">RIGHT NOW</b>';
  } 

 
  if (is_today(date)) {
    return '<b class="bolder">TODAY</b>';
  } 

  var tomorrow = new Date;
  tomorrow.setDate(tomorrow.getDate()+1);
  if (tomorrow.toDateString() == date.toDateString()) {
    return 'Tomorrow';
  } 

  var end_of_week = new Date()
  var day = today.getDay();
  end_of_week.setDate( 7 + today.getDate() - day + (day == 0 ? -6 : 1)  );
  end_of_week.setHours(0)
  end_of_week.setMinutes(0);
  if (+date < +end_of_week) {
    return days[date.getDay()];
  }

  var end_of_next_week = new Date(end_of_week)
  end_of_next_week.setDate( end_of_week.getDate() + 7 );
  if (+date < +end_of_next_week) {
    return 'Next ' + days[date.getDay()];
  }

  return getDayMonthDate(date); // date.toLocaleDateString();
}

function format_event_title(event) {
  if (!event.title) return;
  if (is_today(event.start) || is_right_now(event.start, event.end)) 
    return '<b class="title bolder">' + event.title + '</b>';
  else
    return '<b class="title">' + event.title+ '</b>';
}

function refresh_event_lazy(events) {

  // fix old shit, of cached forbidden event
  if (events && events[0] && events[0].promo) {
    delete stored.GCAL_cached_event;
    events = 'forbidden';
  }

  if ('string' == typeof events && events == 'forbidden') {

    // show promo for first 10 new tab views
    // then show for every 30
    if (storageGet('GCAL_promo_shown_cnt', 0) > 10 && 
        storageInc('GCAL_promo_imps_since') < 30) {
      return hide_event();
    }
    storageSet('GCAL_promo_imps_since', 0);
    storageInc('GCAL_promo_shown_cnt');

    var promoBtns  = '<div id="event-btns" title="">' +
                     '<div class="btn enable">enable</div>' +
                     '<div class="btn hide">hide</div>' + 
                     '</div>';
    events = [{
      startTime: +new Date,
      endTime: +new Date + 1 * HOURS,
      title: 'Example event',
      promo: 'Click to enable <i>Your</i> Google Calendar here' + promoBtns
    }];
    var promo = true;
    delete stored.GCAL_cached_event;
    byId('upcoming-event').classList.add('forbidden');
    ga('stats.send', 'event', 'stats', 'gcal-view-type', 'forbidden');
  } else {
    byId('upcoming-event').classList.remove('forbidden');
  }


  /*
  if ('string' == typeof events && events == 'forbidden') {
    byId('upcoming-event').innerHTML = "Click To Enable<br>Calendar Events";
    byId('upcoming-event').classList.add('forbidden');
    byId('upcoming-event').style.display = '';
    byId('datetime').classList.remove('no-event');
    delete stored.GCAL_cached_event;
    return;
  }
  */


  // no events found (or url is down)
  // calendar notifications turned off
  var notiSetting = settings.notifications['ejjicmeblgpmajnghnpcppodonldlgfn'];
  if (!events || !events.length || notiSetting === false) {
    return hide_event();
  }

  // everything is ok
  var event = events[0];

  var in_past = (new Date(event.endTime) < Date.now() - 15 * MINS); // we show it a little more
  var too_distant = (new Date(event.startTime) > Date.now() + 2 * DAYS);
  if (too_distant || in_past)
    return;

  byId('upcoming-event').style.display = '';
  byId('datetime').classList.remove('no-event');

  if (!promo) {
    stored.GCAL_cached_event = JSON.stringify(event);
  }

  displayed_event = event;

  event.start = new Date(event.startTime);
  event.end = new Date(event.endTime);

  var start = format_time(event.start);
  var end = format_time(event.end);
  var day = format_day(event.start, event.end);
  var title = format_event_title(event);

  var arr = [];

   /// NOTE: doesn't support multi-day events
  day && arr.push('<span class="day" id="upcoming-event-day">' + day + '</span>');

  title && arr.push(title);
  event.promo && arr.push(event.promo);
  // event.description  && arr.push(event.description);
  // event.location  && arr.push(event.location);

  if (event.end - event.start != 86400000) {
    arr.push(start + ' - ' + end);
  } else {
    arr.push('All Day');
  }
  
  byId('upcoming-event').innerHTML = arr.join('<br/>');
  byId('upcoming-event').dataset.href = event.url || '';
}

function hide_event() {
  byId('upcoming-event').innerHTML = '';
  byId('upcoming-event').style.display = 'none';
  byId('datetime').classList.add('no-event');
}

var upcomingEventEl = byId('upcoming-event');

upcomingEventEl.onmousedown = function (e) {
  if (e.target.classList.contains('hide')) {
    change_options(function (new_settings) {
      new_settings.notifications.ejjicmeblgpmajnghnpcppodonldlgfn = false;
    });
    ga('stats.send', 'event', 'stats', 'gcal-auth-choice', 'disable');
    return (upcomingEventEl.style.display = 'none');
  }
}

upcomingEventEl.onclick = function (e) {
  if (upcomingEventEl.classList.contains('forbidden')) {
    ga_cb('stats.send', 'event', 'stats', 'gcal-auth-choice', 'enable', function () {
      chrome.runtime.sendMessage("prompt-calendar-auth");
    });
    return;
  }
  if (upcomingEventEl.dataset.href) 
    return (window.location.href = upcomingEventEl.dataset.href); 
}



// Dom ready

if (/interactive|complete/.test(document.readyState)) {
  dom_ready();
} else {
  window.on("DOMContentLoaded", dom_ready);
}


// Context menu

var apps_el = byId('apps-wrapper');
//mouse_enter_once(byId('apps-wrapper'), load_context_menu_css); // needed?
var context_menu = $('.context-menu')[0];
context_menu.style.display = "none";
function load_context_menu_css() {
  loadCSS('css/context_menu.css', 'context-menu-css');
}
apps_el.on("contextmenu", function (e) {
  //if (e.button != RIGHT_BUTTON) return; causes issues where LEFT buttons is reported (Allie)
  load_context_menu_css();
  if (e.target.closest('.test-item')) {
    e.preventDefault();
  }
  include_js_once('js/apps/context_menu.js', 
    function () { on_context_menu(e); });
});


// Recently closed
function load_recently_closed_dep() { 
  loadCSS('css/recently_closed.css', 'recently-closed-css'); 
  include_js_once('js/recently_closed.js');
}
mouse_enter_once(byId('recently-closed-button'), load_recently_closed_dep);
byId('recently-closed-button').on('mousedown', load_recently_closed_dep);
byId('recently-closed-button').on('click', function (e) {
  include_js_once('js/recently_closed.js', 
    function () { on_recently_closed_click(e); });
});

// launch app w click
document.on("click", on_app_click);    // left mouse (launch in current tab)
document.on("auxclick", on_app_click); // middle mouse (launch in new tab )

function on_app_click(e) {
  if (e.button != LEFT_BUTTON && e.button != MIDDLE_BUTTON) 
    return true;
  var item = e.target.closest('.test-item');
  if (item) {
    var special_open = ((e.button == MIDDLE_BUTTON || e.ctrlKey || e.metaKey));
    var new_tab = (settings.app_opener_tab != 'current') || special_open;
    var active = (settings.app_opener_tab == 'new_active');
    launch_app(item, { new_tab: new_tab, active: active });
    if (!new_tab) {
      item.classList.add('pressed');
      // no interaction after launch starts 
      // (because dragging in pressed state can cause app to be cached as pressed)
      document.body.style.pointerEvents = 'none';
      // some apps may not launch in a diff window
      setTimeout(function () { // so remove .pressed
        item.classList.remove('pressed');
        document.body.style.pointerEvents = '';
      }, 2000);
    }
    return false;
  }
}

byId("time").onclick = function(e) {
  var time_format_new = (settings.time_format == '12') ? '24' : '12';
  change_options(function (settings_new) {
      settings_new.time_format = time_format_new;
  });
  refresh_date();
}

byId("clear-notifications").onclick = function(e) {
  byId('notifications').innerHTML = '';
  stored.notifications = '';
}

chrome.runtime.onMessage.addListener(async function(message) {
  if (message.name == "add_new_app" && message.id) {
    const bg = await getBackgroundVars('apps');
    apps = bg.apps;
    var app = apps[message.id];
    html = get_app_html(app);
    cache_set_app_html(app, html);

    add_new_app_html(html);

    if (message.id.indexOf('user_app') == 0) {
      hide_new_app_panel();
    }
    go_last_page && go_last_page();
    logAppInstallURLForApp(app);
  }
  else if (message.name == "edit_app" && message.id) {
    const bg = await getBackgroundVars('apps');
    apps = bg.apps;
    var app = apps[message.id];
    html = get_app_html(app);
    cache_set_app_html(app, html);
    replace_app_html(byId(message.id), html);
    hide_new_app_panel();
  }
});

function logAppInstallURLForApp(app) {
  var type = (app.id.indexOf('user_app') != -1) ? 'custom' : 'system';
  var domain = shortURLHost(app.appLaunchUrl) || app.id;
  ga('send', 'event', 'apps', type, domain);
}

function logAppLaunchURLForApp(app, cb) {
  var type;
  if (app.id.length == 32) 
    type = 'chrome';
  else 
    type = (app.id.indexOf('user_app') != -1) ? 'user' : 'system';
  var url = app.appLaunchUrl;
  var domain = shortURLHost(app.appLaunchUrl) || app.id;
  if (isFbqImportantTile(app, domain)) {
    fbq('track', 'TileClick', { id:app.id, name:app.name, domain:domain, url:url,
                                country:stored.GEO_country_code });
    adw('TileClick');
  }
  ga_cb('tile.send', 'event', 'tile-click', domain, type + ' ## ' + url, cb);
}

function shortURLHost(url) { // https://ebay.com/something?key=val#hash
  if (!url) return url;
  var protocolless = url.split('://').pop();
  var parts = protocolless.split(/[?#]/)[0].split('/'); // [ebay.com, something]
  var domain = parts[0].toLowerCase().replace(/^www\./i, '');
  var firstPath = parts[1];
  if (firstPath && !/index/i.test(firstPath))
    domain += '/' + firstPath;
  return domain;
}

function isFbqImportantTile(app, domain) {
  if (/^(ebay|aliexpress|alitems|booking|amazon)$/i.test(app.id))  return true;
  if (/(^ebay|aliexpress|alitems|booking|amazon)\./i.test(domain)) return true;
  return false;
}

//
// Toolbar
//

make_toolbar_label_for_button(byId('background-button'));
make_toolbar_label_for_button(byId('notifications-button'));
make_toolbar_label_for_button(byId('qnotes-button'));
make_toolbar_label_for_button(byId('bookmarks-button'));
make_toolbar_label_for_button(byId('apps-button'));
make_toolbar_label_for_button(byId('review-button'));
make_toolbar_label_for_button(byId('info-button'));
make_toolbar_label_for_button(byId('settings-button'));
make_toolbar_label_for_button(byId('focus-button'), function (e) {
  include_js_once('js/toolbar/focus_click.js', 
    function () { on_focus_click(e); });
});

update_focus_button_title();

function update_focus_button_title() {
  byId('focus-button').dataset.title = settings.focus_mode ? 'Leave Focus' : 'Focus';
}

function make_toolbar_label_for_button(button, onclick) {

  var toolbarButtonLabel = document.createElement('div');
  toolbarButtonLabel.className = 'toolbar-button-label';
  toolbarButtonLabel.style.opacity = 0;
  var hideAnimationTimeout;

  button.onmouseenter = function () {
    if (!button.dataset.title) return;
    clearTimeout(hideAnimationTimeout);
    document.body.appendChild(toolbarButtonLabel);
    var myVCenter = toolbarButtonLabel.offsetHeight / 2;
    var buttonOffset = button.getBoundingClientRect();
    var focusVCenter = buttonOffset.top + (button.offsetHeight/2);
    var myLeft = buttonOffset.left + button.offsetWidth;
    toolbarButtonLabel.innerHTML = button.dataset.title;
    toolbarButtonLabel.style.top = (focusVCenter - myVCenter) + 'px';
    toolbarButtonLabel.style.left =  (myLeft + 12) + 'px'; // myLeft+24
    toolbarButtonLabel.style.opacity = 1;
  }

  button.onmouseleave = function () {
    toolbarButtonLabel.style.opacity = 0;
    hideAnimationTimeout = setTimeout(function () {
      toolbarButtonLabel.remove();
    }, 1000);
  }

  button.onclick = onclick;
}

byId('left-toolbar').on('mouseup', function () {
  var labels = bySelectorAll('.toolbar-button-label');
  [].forEach.call(labels, function (label) {
    label.remove();
  });
});

// Draggable doesn't know about the search bar,
// so for loose coupling sake we handle that case here
(function () {
var is_scrolling = false;
document.on('keydown', function onkeydown(e) {
  var is_empty_input = (e.target.nodeName == 'INPUT' && !e.target.value);
  if (!is_scrolling && is_empty_input) {
    if (e.keyCode == 37)
      window.go_previous_page();
    if (e.keyCode == 39)
      window.go_next_page();
    is_scrolling = true;
    setTimeout(function() {
      is_scrolling = false;
    }, 300);
  }
});
})();

//
// Weather
//

if (stored.WTR_cache_weather_main_html && 
    stored.WTR_cache_weather_main_date == stored.WTR_last_updated) {
  byId('weather').innerHTML = stored.WTR_cache_weather_main_html;
} 

mouse_enter_once(byId('weather'), 
  make_included_function('js/weather/weather.js', 'showWeatherForecast'));


/*
byId('weather').on('mouseenter', showWeatherForecast);
byId('weather').on('mouseleave', forecastFadeOut);
addSettingsListener('temperature', refreshWeatherDisplay);
function showWeatherForecast() {}
include_js_once("/js/weather/weather.js"); 
*/

//
// Whatever Left At The End
//

chrome.runtime.sendMessage({"name": "pageview"});
fbq('track', 'PageView', {content_name: 'Main', country: stored.GEO_country_code});

//// if is TEMP until tile click test
if ('true' == stored.testing_tiles_active)
  ga('tile.send', 'pageview', { page: 'main.html' });

// "filesystem:chrome-extension://medcogigaddopcmahlhefiiabkklihoa/persistent/not-existing.png";
(function () {
var missing_image_counter = 0;
document.on('error', function (e) {
  if (e.target.nodeName == 'IMG' && e.target.src.indexOf('filesystem:') === 0)
    if (++missing_image_counter == 2)
      include_js_once('js/temp/missing_images_help.js', 
        () => handleMissingImages()); 
}, true);
async function handleMissingImages() {
  let lastTry = Number(stored.missing_image_last_restore_attempt) || 0;
  const oneDay = 86400000;
  if (Date.now() - lastTry > oneDay) { // once per day
    stored.missing_image_last_restore_attempt = String(Date.now());
    // try to restore missing images
    await include_js_once('js/lib/filesystem.js');
    await include_js_once('js/backup.js');
    window.restoreUserAppsFromAutoBackup();
    // a) we don't immediately reload here not to interrupt the restore mechanism
    // basically we are counting on the user keeping this tab open 
    // long enough for us to finish the restore
    setTimeout(function() {
      location.reload();
    }, 3000);

    // b) alternatively we could do the restore in offscreen doc of service worker 
    // by only sending message to them from here
  } else if (Date.now() - lastTry > 5 * oneDay) {
    stored.missing_image_last_restore_attempt = String(Date.now());
    show_missing_images_badge();
  }
}
})();

(async () => {
  // dont run for fresh installs
  if (+stored.install_time > 1733760055314)
    return;
  // dont run if no issue is detected (bg needs to be default)
  if (settings.background_image !== default_settings.background_image)
    return;
  if (stored.TEMP_restore_bg_image === 'true')
    return;

  stored.TEMP_restore_bg_image = true;

  await include_js_once('js/lib/filesystem.js');
  await include_js_once('js/backup.js');
  window.restoreBackgroundFromAutoBackup_TEMPFIX();
  // long enough for us to finish the restore
  setTimeout(function() {
    location.reload();
  }, 3000);
})();

if ('undefined' == typeof stored.test_facebook_tile_1 && stored.GEO_country_code)
  stored.test_facebook_tile_1 = (Math.random() < 0.3 && 'US' == stored.GEO_country_code);

function turn_tags_in_url(url) {
  //if (is_ebay_url(url))
  //  return turn_tag_ebay(url);
  if (is_facebook_url(url) && is_facebook_country() && !is_ublock()) //  && is_facebook_testing()
    url = turn_tag_facebook(url);
  if (is_aliexpress_url(url))
    url = turn_tag_aliexpress(url);
  //if (is_booking_url(url) && !is_ublock())
  //  return turn_tag_booking(url);
  //if (is_amazon_url(url))
  //  url = turn_tag_amazon(url);
  return url;
}

function is_facebook_testing () { return 'true' == stored.test_facebook_tile_1; }

function is_facebook_country() {
  var cc = stored.GEO_country_code;
  return cc == null || ({'US': 1, 'CA': 1})[cc];
}

function is_ublock() { return 'true' == stored.SD_ublock; }

function is_ebay_url(url) { 
  return /^https?:\/\/(www\.)?ebay\.(com|com\.au|ca|co\.uk|at|be|fr|de|it|nl|es|ch|ie)(\/|$)/i.test(url);
} 

// https://rover.ebay.com/rover/1/711-53200-19255-0/1?icep_ff3=1&pub=5575232646&toolid=10001&campid=5337987822&customid=&ipn=psmain&icep_vectorid=229466&kwid=902099&mtid=824&kw=lg
function turn_tag_ebay(url) { 
  try {
    var match;
    var ebayRe = /^https?:\/\/(?:www\.|deals\.|stores\.|)ebay\.([^\/]+)/i;
    if ((match = url.toLowerCase().match(ebayRe))) {
      var domain = match[1].toUpperCase();
      var codes  = ebayCodesForCountry[domain];
      if (!codes) {
        var country = localStorage.GEO_country_code;
        codes = ebayCodesForCountry[country] || ebayCodesForCountry['US'];
      }
      return 'https://rover.ebay.com/rover/1/' + codes[0] +
             //'/1?icep_id=114&ipn=icep&toolid=20004&campid=5337987822' + 
             '/1?icep_ff3=1&pub=5575232646&toolid=10001&campid=5337987822' + 
             '&customid=&ipn=psmain&icep_vectorid=' + codes[1] + 
             '&kwid=902099&mtid=824&kw=lg';
             //'&mpre=' + encodeURIComponent(url);
    }
  } catch (e) { 
    setTimeout(function () { throw e; }); // async error logging
  }
  return url;
}

// https://partnernetwork.ebay.com/epn-blog/2009/05/new-link-generator-tool-additional-information
var ebayCodesForCountry = { // Site Rotation ID, Vector ID
  "US": ["711-53200-19255-0",  "229466"],
  "CA": ["706-53473-19255-0",  "229529"],
  "UK": ["710-53481-19255-0",  "229508"],  "CO.UK": ["710-53481-19255-0",  "229508"],
  "AU": ["705-53470-19255-0",  "229515"], "COM.AU": ["705-53470-19255-0",  "229515"],
  "AT": ["5221-53469-19255-0", "229473"], 
  "BE": ["1553-53471-19255-0", "229522"],
  "FR": ["709-53476-19255-0",  "229480"],
  "DE": ["707-53477-19255-0",  "229487"], 
  "IT": ["724-53478-19255-0",  "229494"],
  "NL": ["1346-53482-19255-0", "229557"],
  "ES": ["1185-53479-19255-0", "229501"], 
  "CH": ["5222-53480-19255-0", "229536"], 
  "IE": ["5282-53468-19255-0", "229543"], 
};



function is_aliexpress_url(url) { 
  return url.indexOf('aliexpress.com') != -1;
} 

function is_booking_url(url) { 
  return url.indexOf('https://www.booking.com/index.html?aid=') == 0;
} 

function turn_tag_aliexpress(url) { 
  //if ('US' == localStorage.GEO_country_code)
  url = 'https://alitems.com/g/1e8d1144941b31890c7516525dc3e8/';
  return url;
}

function turn_tag_booking(url) { 
  //if ('US' == localStorage.GEO_country_code)
  //  url = "https://www.booking.com/index.html?aid=1195099";
  url = 'https://homenewtab.ampxdirect.com/booking';
  return url;
} 

// leaves smile subdomain alone
function is_amazon_url(url) { // com.au, com.br, com.mx
  return /^https?:\/\/(www\.|)amazon\.(com|ca|cn|co.uk|co.jp|fr|de|it|in|nl|es)(\.|\/|$)/i
         .test(url);
}

function turn_tag_amazon(url) { 
  try {
    var match;
    var amznRe = /^https?:\/\/(?:www\.)?amazon(\.[^\/]+)/i;
    if ((match = url.toLowerCase().match(amznRe))) {
      var matchedTLD = match[1];
      if (matchedTLD != '.com') return url;
      var country = localStorage.GEO_country_code || 'US';
      var localTLD = amazonTLDsForCountry[country];
      if (!localTLD) return url;
      return url.replace('amazon.com', 'amazon.' + localTLD);
    }
  } catch (e) { 
    setTimeout(function () { throw e; }); // async error logging
  }
  return url;
}

var amazonTLDsForCountry = { 
  "US": "com",
  "CA": "ca",
  "UK": "co.uk",
  "AU": "com.au",
  "BR": "com.br",
  "MX": "com.mx",
  "JP": "co.jp",
  "FR": "fr",
  "DE": "de",
  "IT": "it",
  "NL": "nl",
  "ES": "es",
  "CN": "cn",
  "IN": "in",
};

function is_facebook_url(url) {
  return /^https?:\/\/(www\.)?facebook\.com\/?$/i.test(url);
}

function turn_tag_facebook(url) {
  if (stored.TILE_promo_airfind_conn != 'true') {
    return url;
  }
  //return 'https://homenewtab.ampxdirect.com/facebook';
  return 'https://api.airfind.com/link/v1?id=5bf6f1c9d5b24054179f29c6&clientId=50191&brand=FBNOV18';
}


var isMac = /mac/i.test(navigator.userAgent);
if (!isMac) {
  var winFontEls = document.getElementsByClassName('win-font');
  [].slice.apply(winFontEls).forEach(function (el) {
    el.style.fontWeight = 'normal';
  });
}

chrome.runtime.onMessage.addListener(function(message) {
  if (message.name && message.name == 'reload-yourself')
    location.reload();
});

/*
byId('notifications-box').classList.add('frosted-glass');
byId('qnote').classList.add('frosted-glass');
byId('notifications-box').innerHTML += 
  '<div class="cover bg"></div><div class="cover darker"></div>';
  '<div class="cover bg darker"></div>';
byId('qnote').innerHTML += 
    '<div class="cover bg"></div><div class="cover dark"></div>';
  '<div class="cover bg dark"></div>';

[].forEach.call(document.getElementsByClassName('bg'), function (bg) {
  bg.style.backgroundImage = 'url(' + settings.background_image + ')';
});
*/

if (newInstall) { // && getSearchConfig().search_type !== 'google'
  byId('search-form').classList.add('show-search-logo');
}

if (Date.now() - stored.install_time > 5 * DAYS && byId('time')) {
  byId('time').title = '';
}

// focus

byId('apps-button').on('click', function (e) {
  include_js_once('js/toolbar/apps_button.js', 
    function () { on_apps_button_click(e); });
});

function get_current_date() {
  var d = new Date;
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

if (stored.FOC_day != get_current_date()) {
  delete stored.FOC_input;
  delete stored.FOC_complete;
} else if (stored.FOC_input) {
  focus_set_complete(stored.FOC_complete == 'true');
  focus_set(stored.FOC_input);
}

var focus_help_timer;

function focus_toggle_complete() {
  var oldComplete = stored.FOC_complete == 'true';
  var complete = !oldComplete;
  focus_set_complete(complete);
}

function focus_set_complete(complete) {
  var fn = complete ? 'add' : 'remove';
  byId('focus-today').classList[fn]('complete');
  stored.FOC_complete = complete;
}

function focus_set(value) {
  byId('focus-today-span').textContent = value;
  //byId('focus-today-input').value = value;
  //byId('focus-today-input').size = value.length;
  byId('focus-today').classList.add('set');
  focus_hide_help();
  stored.FOC_day   = get_current_date();
  stored.FOC_input = value;
}

function focus_hide_help() {
  clearTimeout(focus_help_timer);
  byId('focus-today-help').style.opacity = 0;
}

var KEY_ENTER = 13;
byId('focus-today-input').addEventListener('keydown', function (e) {
  if (e.keyCode == KEY_ENTER) {
    e.preventDefault();
    e.target.blur();
    focus_set(byId('focus-today-input').value);
    return false;
  } 

  clearTimeout(focus_help_timer);
  if (!e.target.value.length) return;
  focus_help_timer = setTimeout(function () {
    byId('focus-today-help').style.opacity = 1;
  }, 1000);
});

byId('focus-today-checkbox').onclick = function (e) {
  focus_toggle_complete();
};
bySelector('.delete', byId('focus-today')).onclick = function (e) {
  byId('focus-today').classList.remove('complete');
  byId('focus-today').classList.remove('set');
  byId('focus-today-input').value = '';
  byId('focus-today-input').style.width = '';
  byId('focus-today-input').focus();
  focus_hide_help();

  stored.FOC_day   = get_current_date();
  stored.FOC_input = byId('focus-today-input').value;
  focus_set_complete(false);
};

// fauxmine.js 

function getHistoryBookmarksSuggestions(term, callback) {
  include_js_once('js/search/common.js', function () {
    include_js_once('js/search/fauxmine.js', function () { 
      getHistoryBookmarksSuggestions = window.getHistoryBookmarksSuggestions_lazy;
      if (!getHistoryBookmarksSuggestions) return callback([]);
      getHistoryBookmarksSuggestions(term, callback); 
    }); 
  }); 
}

// suggest.js 

if (location.hash && location.hash.startsWith('#q=') ||
    byId('search-input') == document.activeElement && document.hasFocus()) {
  include_js_once('js/search/suggest.js'); 
  include_js_once('/js/cursor.js');
  loadCSS('css/search_extra.css', 'css-search')
} else {
  byId('search-input').on('focus', function first_focus(e) {
    byId('search-input').off('focus', first_focus);
    include_js_once('js/search/suggest.js'); 
    include_js_once('/js/cursor.js');
    loadCSS('css/search_extra.css', 'css-search')
  });
}
byId('search-input').onkeydown = function (e) {
  include_js_once('js/search/suggest.js', function () {
    suggest_keydown.call(e.target, e);
  }); 
};
byId('search-input').oninput = function (e) {
  include_js_once('js/search/suggest.js', function () {
    suggest_term_changed.call(e.target, e);
  }); 
};

window.on("click", function (e) {
  var el = document.activeElement;
  if (/input|textarea/i.test(el.nodeName) || el.isContentEditable)
    return;
  if (el != byId("search-input"))
    byId("search-input").focus();
});

function getSearchConfig() {
  let conf = {};
  try {
    conf = JSON.parse(localStorage.SRV_conf || '{}');
    conf.search_domain = new URL(conf.search_url).hostname; // throws
  } catch (e) {
    // ignore
  }
  return conf;
}

// cursor

//window.on('load', function () {
//  setTimeout(function () {
////    include_js_once('/js/cursor.js');
//  }, 200);
//});

// toolbar

if (byId('background-button')) {
  mouse_enter_once(byId('background-button'), function () {
    include_js_once('js/toolbar/background_button_hover.js', function (e) {
      background_button_hover(e);
    });
  });
}

mouse_enter_once(byId('left-toolbar'), function () {
  loadCSS('css/widgets.css', 'widgets-css');
  loadCSS('css/weather.css', 'weather-css');
  include_js_once('js/toolbar/toolbar.js');
});

addLeftToolbarSettingsListener('show_notifications', 'notifications-button');
addLeftToolbarSettingsListener('show_qnotes', 'qnotes-button');
addLeftToolbarSettingsListener('show_bookmarks', 'bookmarks-button');
addLeftToolbarSettingsListener('show_weather', 'weather');
addLeftToolbarSettingsListener('show_help', 'info-button');
addLeftToolbarSettingsListener('show_review', 'review-button');
addLeftToolbarSettingsListener('show_focus', 'focus-button');
addLeftToolbarSettingsListener('show_datetime', 'datetime');
addLeftToolbarSettingsListener('show_recently_closed', 'recently-closed-button');
addLeftToolbarSettingsListener('show_daily_focus', 'focus-today');
addLeftToolbarSettingsListener('show_apps_button', 'apps-button');
addLeftToolbarSettingsListener('show_background_button', 'background-button');

//addLeftToolbarSettingsListener('search_bar', 'search-box');

function mouse_enter_once(el, fn) {
  el.on('mouseenter', function once() { el.off('mouseenter', once); fn(); });
}

function makeLeftToolbarShowListener(elementId) {
  return function (settingsKey, settingsVal) {
    byId(elementId).style.display = (settingsVal === false) ? 'none' : '';
  };
}
function addLeftToolbarSettingsListener(settingsKey, elementId) {
  var listener = makeLeftToolbarShowListener(elementId);
  listener(settingsKey, settings[settingsKey]);
  addSettingsListener(settingsKey, listener);
}

// toolbar.js 
createToolbarWidget('notifications-button', 'initToolbarNotifications');
createToolbarWidget('qnotes-button', 'initToolbarQuickNotes');

function createToolbarWidget(btnId, fn_name) {
  byId(btnId).on('click', function (e)  {
    if (window[fn_name] && window[fn_name].done) return;
    loadCSS('css/widgets.css', 'widgets-css');
    include_js_once('js/toolbar/toolbar.js', function () {
      window[fn_name]().open(e);
    });
  }); 
}

// panels.js 
function make_included_function(js_src, fn_name) {
  return function (e) {
    var self = this;
    var args = Array.from(arguments);
    if (e && e.type == 'click' && e.preventDefault) e.preventDefault();
    include_js_once(js_src, function () {
      if ('function' == typeof fn_name)
        return fn_name.apply(self, args);
      else if (!window[fn_name])
        throw fn_name + " doesn't exist (" + js_src + ")";
      window[fn_name].apply(self, args);
    });
  }
}

function add_panel(buttonId, panelName, mouseEnterExtra) {
  byId(buttonId).on('mousedown', loadPanelsCSSAndJS);
  byId(buttonId).on('click', make_panel_function('show_' + panelName));
  mouse_enter_once(byId(buttonId), function () {
    loadPanelsCSSAndJS();
    bindNextTick(make_panel_function('prepare_' + panelName));
    if (mouseEnterExtra) mouseEnterExtra();
  });
}

function make_panel_function(fn_name) {
  return make_included_function('panels/panels.js', fn_name);
}

function preload_store_json() {
  preload('/panels/new_app/store/apps.json', 'fetch');
}

add_panel('add-app-button', 'new_app_panel', preload_store_json);
add_panel('background-button', 'background_settings_panel');
add_panel('bookmarks-button', 'bookmarks_panel');
add_panel('settings-button', 'options_panel');
chrome.runtime.onMessage.addListener(make_panel_function('handleBackgroundImageMessages'));

window.show_new_app_panel = make_panel_function('show_new_app_panel');

setTimeout(function () {
  if (byId('webstore')) {
    byId('webstore').on('click', function (e) { 
      if (e.button != LEFT_BUTTON) return;
      e.stopPropagation(); 
      loadPanelsCSSAndJS(function () { show_new_app_panel(e); })
    });
  }
}, 1);

function loadPanelsCSS() {
  loadCSS('css/panels.css', 'panels-css');
}
function loadPanelsCSSAndJS(callback) {
  loadCSS('css/panels.css', 'panels-css');
  include_js_once('panels/panels.js', callback);
}

// Change Search Engine
var searchProviders, search_provider;
try {
  searchProviders = JSON.parse(stored.SEARCH_providers);
  search_provider = searchProviders[settings.search_provider] || searchProviders.home;
  byId('search-logo').src = search_provider.icon;
} catch (e) {}

// promos
if (localStorage.FB_history_index_enabled == null) 
  include_js('/js/search/promo/search_promo.js');

if (stored.SS_discrete_mouse_wheel == 'true' && 
    stored.SS_promo_clicked != 'true') {
  include_js('js/temp/sscr_promo.js');
}

// promos
if (window.DEV) 
  include_js('/pages/onboard/onboard.js');


//
// Stats
//

(function () {

var btns = ['qnotes-button', 'notifications-button', 'bookmarks-button',
 'recently-closed-button', 'focus-button', 'background-button', 
 'review-button', 'info-button', 'settings-button'];

btns.forEach(addButtonTracker);

function addButtonTracker(id, altName) {
  var btn = document.getElementById(id);
  if (!btn) return;
  var name = id.replace(/-/g, '_');
  var storedDailyKey = 'STAT_click_cnt_daily_' + name;
  btn.on('click', function () {
    storageInc(storedDailyKey);
    ga('stats.send', 'event', 'click', name);
  }); 
}

})();

window.addEventListener('load', function () {
  setTimeout(function () {
    include_js_once('js/weather/weather.js');
    if (window.DEV) {
      console.log('domInteractive', nav.domInteractive);
      console.log('domContentLoadedEventEnd', nav.domContentLoadedEventEnd);
      console.log('domComplete', nav.domComplete);
    }
  }, 300);
  if (window.PerformanceNavigationTiming) {
    var nav = performance.getEntriesByType("navigation")[0];
    delayedLogPageSpeedStats(nav);
  } else {
    delayedLogPageSpeedStats('domComplete', performance.now());
  }
  if (window.requestIdleCallback) {
    window.requestIdleCallback(function (deadline) {
      delayedLogPageSpeedStats('hnt.idle', performance.now());
      //if (window.DEV) console.log('idle', performance.now());
    });
  }
});
