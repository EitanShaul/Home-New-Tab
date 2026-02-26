// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

// dont touch chrome.* APIs util DOM loaded 

//starttt = performance.now();
//console.log(performance.now() - starttt)

function byId(id, base) { return (base||document).getElementById(id); }

var bg_el_id = 'page';

var root = document.documentElement;
var rootClassList = root.classList;

if (settings.search_bar) {
  rootClassList.add('show-search');
  //byId("search-box").style.display = "block";
  //byId("apps-slider").style.paddingTop = "54px";
}
if (settings.focus_mode) {
  rootClassList.add('focus');
}

if (settings.background_image_baked) {
  rootClassList.add('bg-baked');
}

if ("true" != stored.WGS_notifications || settings.focus_mode) {
  rootClassList.add('notifications-hidden');
}

if ("true" != stored.WGS_quicknotes || settings.focus_mode) {
  rootClassList.add('qnotes-hidden');
}

// https://github.com/mourner/suncalc
function update_night_theme() {
  var now_hours = (new Date).getHours();
  const dimOn = !!settings.dim_at_night && (now_hours >= 19 || now_hours < 8);
  rootClassList.toggle('night-theme', !!dimOn); // bool!
}

update_night_theme();
addSettingsListener('dim_at_night', update_night_theme); 

if (in_widget_mode()) {
  rootClassList.add('widget-mode');
  loadCSS('css/widgets.css', 'widgets-css');
  include_js_once('js/toolbar/toolbar.js');
}

function in_widget_mode() {
  return !settings.focus_mode && 
         (stored.WGS_notifications == "true" || stored.WGS_quicknotes == "true");
}

var isMac = /mac/i.test(navigator.userAgent);
rootClassList.add(isMac ? 'mac' : 'not-mac');
var isWin = /windows/i.test(navigator.userAgent);
rootClassList.add(isWin ? 'win' : 'not-win');

addSettingsListener('search_bar', function (key, search_bar) {
  rootClassList[search_bar ? 'add' : 'remove']('show-search');
});
 


(function () {

// kick off loading background image as soon as possible
var bg_img = settings.background_image_baked || settings.background_image;
//bg_img = 'icons/twitter.png';

// v1
//(new Image).src = sbg_img;

// v2
//document.documentElement.style.backgroundImage = 'url(' + bg_img + ')';
var frosted = 0; window.DEV;

if (frosted) rootClassList.add('frosted-theme');

// v3
(new Image).src = bg_img;
var css = document.createElement('style');
css.textContent = '#' + bg_el_id + ' { background:url('+ bg_img +') } ';

if (settings.background_image_baked && settings.background_style == 'stretch') {
  css.textContent += '#page-gradient, #page-bg-base, #page-bg { background:none !important } ';
  css.textContent += '#page-bg-base, #page-bg { display:none !important } ';
  css.textContent += '.test-item-text { background: transparent; }';
}
else if (is_default_or_image_service(bg_img)) {
  css.textContent += '#page-bg-base { ';
  var filter = settings.background_filter || {};
  var filterImg = '/img/effects/' + (filter.img || '13.jpg'); // 38def, 34
  if (finalOpacity(filter) != null)
    css.textContent += 'opacity: ' + finalOpacity(filter) + ';';
  if (filter.name != 'none')
    css.textContent += 'background-image: url(' + filterImg + ');';
  css.textContent += '} '; 
  //css.textContent += '.test-item-text { background: transparent; }';
}
document.head.appendChild(css);

window.setFrostedCSS = function setFrostedCSS(bg_img) {
  if (frosted) 
  frostedCSS.textContent = '.frostable::before { background:url('+ bg_img +') 0 / cover fixed } ';
}
var frostedCSS = document.createElement('style');
document.head.appendChild(frostedCSS);
//setFrostedCSS(bg_img)



//var bg = 'filesystem:chrome-extension://' + chrome.runtime.id + '/persistent/background.jpg';

// v4
/*
var img = new Image;
img.onload = img.onerror = function init_background() {
  if (/interactive|complete/i.test(document.readyState)) {
    //byId(bg_el_id).style.backgroundImage = 'url(' + bg + ')';
    if (!settings.background_fadein) { // don't fade in
      prepare_background();
      show_background();
    } else {
      document.body.style.webkitTransition = 'opacity .5s';
      prepare_background();
      setTimeout(show_background, 1);
    }
  } else {
    window.addEventListener('DOMContentLoaded', init_background);
  }
};

img.src = bg;
*/
})();


function finalOpacity(filter) {
  if (settings.focus_mode) return null;
  return (filter.opacity != null) ? filter.opacity : .25;
}

function is_default_or_image_service(url) {
  url = url.replace('chrome-extension://'+ window.APP_ID, '');
  var provider = settings.background_image_provider || 'manual';
  return url.indexOf('/img/backgrounds/') != -1 || provider != 'manual';
}

function prepare_background() {
  change_background();
  change_background_style()
  change_background_gradient()
}

function show_background() {
  document.body.style.opacity = 1;
}


window.addEventListener('DOMContentLoaded', function () {
  change_background_style()
  change_background_gradient()
  change_background()
  /*
  if (settings.background_fadein)
    change_background()
  else 
    show_background();
  */
});

addSettingsListener('background_image', function () { change_background_from_outside() });
addSettingsListener('background_gradient', change_background_gradient);
addSettingsListener('background_style', change_background_style);

function change_background_from_outside(crossfade) {
  byId(bg_el_id).style.backgroundImage = '';
  change_background();
}

function change_background(crossfade, startOpacity) {
  var bg_img = settings.background_image;
  /*
  if (!settings.background_fadein) { // don't fade in
    /// REMOVED: added inline CSS already geeeeez
    // needed for bg changing ,figure out why
    byId(bg_el_id).style.backgroundImage = 'url(' + bg_img + ')';
  } 
  else { // fade in
  */
  var anim = (settings.background_fadein && stored.PERF_disableFadeIn != 'true');

  if (anim) {
    document.body.style.opacity = startOpacity || 0;
    setTimeout(function () {
      //document.body.style.webkitTransition = 'opacity .5s';
      //document.body.style.opacity = 1;
    }, 1);
  } else {
    //document.body.style.opacity = 1;
  }
  var load_timeout = setTimeout(function () {
    on_load({ type: 'error' });
  }, 4000);
  var load_placeholder_timeout = setTimeout(addLoadingImage, 1000);
  var load_page_without_bg_timeout = setTimeout(function () {
    byId(bg_el_id).style.backgroundImage = 'none';
    addLoadingImage.img.style.display = 'none';
    show_page();
  }, 2500);
  var abort_timeout = setTimeout(function () { img.src = ''; }, 30*1000);
  
  function on_load(e) {
    if (e.type == 'error') bg_img = default_settings.background_image;
    [load_timeout, load_placeholder_timeout, load_page_without_bg_timeout, abort_timeout]
      .forEach(clearTimeout);

    //if (!crossfade) fadeIn();
    /// REMOVED: added inline CSS already geeeeez
    // needed for bg changing ,figure out why
    byId(bg_el_id).style.backgroundImage = 'url(' + bg_img + ')';
    setFrostedCSS(bg_img);
    show_page();

    if (e.type != 'error') {
      var nav = imgWasFromCache ? 'hnt.bgImgSetCached' : 'hnt.bgImgSetFetched';
      delayedLogPageSpeedStats(nav, performance.now());
      delayedLogPageSpeedStats(nav + '.Delta', performance.now()-imgStart);
    }
  };
  function show_page() {
    document.documentElement.style.display = '';
    setTimeout(function () {
      if (anim)
        document.body.style.webkitTransition = 'opacity .5s';
      document.body.style.opacity = 1;
    }, 1);
  }
  var imgStart = performance.now();
  var img = new Image;
  img.onload = img.onerror = on_load;
  img.decoding = 'async';
  img.src = bg_img;
  var imgWasFromCache = img.complete;
  if (img.decode) {
    img.decode().then(function() {
      delayedLogPageSpeedStats('hnt.bgImgDecode', performance.now());
      delayedLogPageSpeedStats('hnt.bgImgDecode.Delta', performance.now()-imgStart);
    }).catch(function() {
      throw new Error('Could not load/decode big image.');
    });
  }
  //if (crossfade) setTimeout(fadeIn, 500);

  if (byId('page-bg-base')) {
    var filterCSS = byId('page-bg-base').style;

    if (is_default_or_image_service(bg_img)) {
      var filter = settings.background_filter || {};
      var filterImg = '/img/effects/' + (filter.img || '13.jpg'); // 38def, 34
      filterCSS.backgroundImage = 'url(' + filterImg + ')';
      filterCSS.opacity = finalOpacity(filter);
    } else {
      filterCSS.backgroundImage = 'none';
      filterCSS.opacity = null; // .25
    }
  }
  //if (crossfade) {
  //  document.body.style.backgroundColor = '#000';
  //  //byId(bg_el_id).style.webkitTransition = 'opacity .15s ease-in-out';
  //}
}

function addLoadingImage() {
  var img = document.createElement('img');
  img.src = "/icons/home.png";
  img.id = "bg-placeholder-img";
  img.style.opacity = 0;
  setTimeout(function () { img.style.opacity = null; }, 1);
  document.documentElement.appendChild(img);
  addLoadingImage.img = img;
  //document.documentElement.style.transition = 'background 1.25s';
  //document.documentElement.style.backgroundColor = '#999';
}

function change_background_gradient() {
  if (!settings.background_gradient) {
    byId('page-gradient').style.backgroundImage = 'none';
  } else {
    byId('page-gradient').style.backgroundImage = '';
  }
}

function change_background_style() {
  var page = byId(bg_el_id);
  var style = settings.background_style;
  if ('fill' == style) {
    page.style.backgroundSize = 'cover';
    //page.style.backgroundRepeat = 'repeat';
  } else if  ('stretch' == style) {
    page.style.backgroundSize = '100% 100%';
  } else {
    page.style.backgroundSize = '';
  }
}

function clone(obj) {
  var copy = {};
  for (var i in obj)
    if (obj.hasOwnProperty(i))
      copy[i] = obj[i];
  return copy;
}

// preload images so the don't "blink'
if (settings.focus_mode)
  setTimeout(preload_app_icons, 1000);
else 
  preload_app_icons();

function noop() {}

function preload_app_icons() {
  //return;///
  if (!localStorage.PERF_preload_urls) return;
  var urls = localStorage.PERF_preload_urls.split(ITEM_SEPARATOR);
  var len = Math.min(urls.length, 21); // first page only 
  for (var j = 0; j < len; j++) {// urls.length 
    new Image().src = urls[j];
    //load_and_decode_img(urls[j]);
  }
}

function load_and_decode_img(src) { 
  var img = new Image;
  img.decoding = 'async';
  img.src = src;
  if (img.decode) img.decode().then(noop);
}

load_and_decode_img('/img/vignette.png');
load_and_decode_img('/img/effects/center_vignette.png');
load_and_decode_img('/img/effects/top_vignette.png');

function loadCSS(src, id, onload) {
  id = id || src;
  if (id && byId(id)) return;
  var css  = document.createElement('link');
  css.id   = id;
  css.rel  = 'stylesheet';
  css.type = 'text/css';
  css.href = src;
  css.onload = onload;
  document.head.appendChild(css);
}

function delayedLogPageSpeedStats(nav, nav_val, nav_label) {
  if (bg && bg.delayedLogPageSpeedStats)
    bg.delayedLogPageSpeedStats(nav, nav_val, nav_label);
  //console.log(nav, nav_val, nav_label);  
}
