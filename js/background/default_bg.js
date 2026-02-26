//if (window.location.pathname.endsWith('/background.html')) {

(async () => { 
  await stored;

  // restore tabs after update
  if (stored.VER_lastVersion != window.APP_VERSION) {
    stored.VER_lastVersion = window.APP_VERSION;
    chrome.tabs.query({url: 'chrome://newtab/'}, function (tabs) {
      for (var i = 0; i < tabs.length; i++)
        chrome.tabs.update(tabs[i].id, { url: 'chrome://newtab/#updated' })
    }); 
  }
})();

function getChromeVersion() {     
    var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
    return raw ? parseInt(raw[2], 10) : false;
}

function get_days_since_install() {
   return Math.floor((Date.now() - stored.install_time) / DAYS) || 0;
}

/*
/// manifest v3
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','/local/www_google-analytics_com/analytics.js','ga');
*/
function ga() {}

if (window.DEV) window['ga-disable-UA-2437922-29'] = true;
if (window.DEV) window['ga-disable-UA-2437922-36'] = true;

//function ga() { if (!window.DEV) return ga_real.apply(this, arguments); }

var gaAppData = {
  'appName'    : window.APP_NAME,
  'appId'      : window.APP_ID,
  'appVersion' : window.APP_VERSION
};

ga('create', 'UA-2437922-29', 'auto', { 'anonymizeIp': true, 'allowLinker': true });
ga('set', 'checkProtocolTask', null); // ext context
ga('set', 'transport', 'beacon');
ga('require', 'linker');
ga('linker:autoLink', ['homenewtab.com']);
ga('set', gaAppData);

ga('send', 'pageview', { page: 'background.html' });

gaCreateTracker('tile',   'UA-2437922-36');
gaCreateTracker('search', 'UA-2437922-31');
gaCreateTracker('stats',  'UA-125348952-1');
gaCreateTracker('error',  'UA-125348952-2');
gaCreateTracker('update', 'UA-125348952-3');



function gaCreateTracker(name, id) {
  ga('create', id, 'auto', name);
  ga(name + '.set', 'checkProtocolTask', null); // ext context
  ga(name + '.set', gaAppData);
  ga(name + '.set', 'transport', 'beacon');
}


//// TEMP until tile click test ////////////////////////////////////////////
(function () {
var custom_apps_temp = {};
try { custom_apps_temp = JSON.parse(stored.custom_apps||'{}'); } catch (e) { }

if ('undefined' == typeof stored.test_tiles_group_1) { // 1
  var is_test_running = (typeof custom_apps_temp.ebay != 'undefined');
  stored.test_tiles_group_1 = is_test_running;
}
if ('undefined' == typeof stored.test_tiles_group_2) { // 2
  var group_2_addition = Math.random() < 0.10;
  stored.test_tiles_group_2 = ('true' == stored.test_tiles_group_1 || group_2_addition);
}
window.testing_tiles_active = ('true' == stored.test_tiles_group_2);
if ('undefined' == typeof stored.test_tiles_group_3) { // 3
  var group_3_addition = Math.random() < 0.10;
  stored.test_tiles_group_3 = ('true' == stored.test_tiles_group_2 || group_3_addition);
}
stored.testing_tiles_active = stored.test_tiles_group_3;
})();
///////////////////////////////////////////////////////////////////////


// fb
/*
/// manifest v3
if (!window.DEV) {
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','/local/connect_facebook_net/en_US/fbevents.js');
  var days_since_install = get_days_since_install();
  fbq('init', '425558794490797'); 
  fbq('track', 'PageView', {
    content_name          : 'Background',
    country               : stored.GEO_country_code,
    app_version           : window.APP_VERSION,
    opt_search_bar        : settings.search_bar,
    install_time          : +stored.install_time || Date.now(),
    days_since_install    : days_since_install,
    lifetime_days         : days_since_install,
    lifetime_searches     : +stored.lifetime_searches || 0,
    avg_weekly_searches   : +stored.lifetime_searches / (days_since_install/7)  || 0,
    avg_monthly_searches  : +stored.lifetime_searches / (days_since_install/30) || 0,
    lifetime_ad_clicks    : +stored.lifetime_ad_clicks || 0,
    avg_weekly_ad_clicks  : +stored.lifetime_ad_clicks / (days_since_install/7)  || 0,
    avg_monthly_ad_clicks : +stored.lifetime_ad_clicks / (days_since_install/30) || 0,
 });
} else { window.fbq = function () {}; }
*/
window.fbq = function () {}; 

// g adwords
/// manifest v3
//include_js('/local/www_googleadservices_com/pagead/conversion_async.js');
var adw_labels = {
  'Search'    : 'EgpsCKvkjHEQ_a-14QM', 'AdClick' : 'ePV-CKfopXEQ_a-14QM', 
  'TileClick' : 'K1yJCOXljHEQ_a-14QM', 'Install' : 'MO4tCLb4iXEQ_a-14QM'
};

window.adw = function (name, value, currency) {
  var w = window;
  w.google_conversion_id = 1009604605;
  w.google_conversion_label = adw_labels[name] || name;
  w.google_remarketing_only = false;
  //w.google_conversion_value = 0.01;
  //w.google_conversion_currency = "USD";
  w.google_conversion_format = "3";
  var opt = { onload_callback: function(){} };
  if (typeof w.google_trackConversion == 'function') {
    w.google_trackConversion(opt);
  }
};
if (window.DEV) window.adw = function () {};

//} 
