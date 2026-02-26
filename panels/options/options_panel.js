// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

// animation
/*
var options_el = document.getElementsByClassName('options')[0];
options_el.style.webkitTransform = "translate3d(0, "+ (window.innerHeight*0.8) +"px, 0)";
setTimeout(function(){
  options_el.style.webkitTransition = "-webkit-transform 1s";
  options_el.style.webkitTransform = "";
}, 1);
*/  


function byId(id, base) { return (base||document).getElementById(id); }
function bySelector(sel, base) { return (base||document).querySelector(sel); }
function bySelectorAll(sel, base) { return (base||document).querySelectorAll(sel); }

var isMac = /mac/i.test(navigator.userAgent);
document.documentElement.classList.add(isMac ? 'mac' : 'not-mac');
var isWin = /windows/i.test(navigator.userAgent);
document.documentElement.classList.add(isWin ? 'win' : 'not-win');

var apps_with_notification = {
  'pjkljhegncpnkpknbcohdijeoejaedia': 'Gmail',
  //'pjjhlfkghdhmijklfnahfkpgmhcmfgcm': 'Google Reader',
  'dlppkpafhbajpcmmoheippocdidnckmm': 'Google Plus',
  'ejjicmeblgpmajnghnpcppodonldlgfn': 'Google Calendar',
  'yahoo-mail': 'Yahoo Mail',
  'hotmail':    'Outlook (Hotmail)',
  'facebook':   'Facebook'
  //,'twitter':    'Twitter'
};

////////////////////////// 

document.removeEventListener("change", on_change, true); // panel reusing behavior

// load settings on init

byId('fetch_interval').value = settings.fetch_interval;
byId('time_format').value    = settings.time_format;
byId('search_bar').checked   = settings.search_bar;
byId('temperature').value    = settings.temperature || temprature_from_language();
byId('app_opener_tab').value = settings.app_opener_tab;

byId('background_style').value      = settings.background_style;
byId('background_gradient').checked = settings.background_gradient;
byId('background_fadein').checked   = settings.background_fadein;
byId('background-preview').src      = settings.background_image;
byId('dim_at_night').value          = settings.dim_at_night;

// disable fadein, slow computer
if (settings.background_fadein && localStorage.PERF_disableFadeIn == 'true') {
  byId('background_fadein').disabled = true;
  byId('background_fadein').checked = false;
  byId('background_fadein').closest('label').classList.add('disabled');
}

var appearanceChecks = byId("appearance").querySelectorAll('input[type=checkbox]');
[].forEach.call(appearanceChecks, function (checkbox) {
  checkbox.checked = settings[checkbox.id] !== false;
});

// if they hide help on New Tab, we show it inside Settings
function onHelpChange() {
  byId('help-button-wrapper').style.display = 
    byId('show_help').checked  ? 'none' : 'block';
}
byId('show_help').onchange = onHelpChange;
onHelpChange();

// notifications 

(async () => {
  const bg = await getBackgroundVars(['apps', 'custom_apps']);
  var apps = bg.apps, custom_apps = bg.custom_apps;

  var noti_options = byId("notification-options");
  const calendarId = 'ejjicmeblgpmajnghnpcppodonldlgfn';

  for (var i in apps_with_notification) {
    // Calendar doesn't need to be installed but others do
    if (i == calendarId || 
        apps[i] && (apps[i].enabled || custom_apps[i])) { 
      const html = generate_notification_html(apps, i);
      noti_options.insertAdjacentHTML("beforeend", html);
    }
  }

  const isAuthorized = await chrome.runtime.sendMessage("is-calendar-authorized");
  if (isAuthorized) {
    // ...
  }
})();

document.addEventListener("change", on_change, true);

////////////////////////// 

function generate_notification_html(apps, i) {
  var checked = ("undefined" == typeof settings.notifications[i] || settings.notifications[i]) ? "checked='checked'" : '';
  return '<label><input type="checkbox" '+ checked +' id="'+ i +'" /> '+ 
                 apps_with_notification[i] + ' ' +
         '</label>';
}

//byId('files').addEventListener('change', handle_file_select, false);

// save on every change
function on_change(e) {

  // notification settings
  if (e.target.type && e.target.type == "checkbox") {
    if (e.target.parentNode.parentNode.id == 'notification-options') {
      settings.notifications[e.target.id] = e.target.checked;
      //publishSettingsChange('notifications', SET ME);
    } else {
      settings[e.target.id] = e.target.checked;
      publishSettingsChange(e.target.id, e.target.checked);
    }
  }
  // other settings
  else if (e.target.nodeName == "SELECT") {
    let value = e.target.value;
    if (['true', 'false'].includes(value)) {
      value = (value === 'true');
    } 
    settings[e.target.id] = value;
    publishSettingsChange(e.target.id, value);
  }
  // background image settings
  else if (e.target.type && e.target.type == "file") {
    //if (settings.background_image)
    //  remove_file(extract_filename(settings.background_image))
    if (e.target.id == 'backup-import-file')
      return importBackupFile(e.target.files[0]);

    // Only process image files.
    var file = e.target.files[0];
    if (!file.type.match('image.*')) {
      alert("Error: Only image files are allowed for background!")
      return;
    }

    byId('background-preview-wrapper').classList.add('loading');

    handle_file_select(e, function (filename, dataURI) {
      byId('background-preview').src = dataURI;
      //byId('page').style.backgroundImage = 'url(' + dataURI + ')';
      byId('default-background').disabled = false;
      save_file('/background.jpg', dataURI, function (url) {  // TODO: merge this and default
        //settings[e.target.id] = url;
        //save_settings();
        chrome.runtime.sendMessage({name: 'setBackgroundImageService', type: 'manual'});
        chrome.runtime.sendMessage({name: 'setBackgroundImage', content: url});
        publishSettingsChange('background_image', url);
        byId('background-preview-wrapper').classList.remove('loading');
      });
    })
  }
  save_settings();
}

function save_settings() {
  stored.settings = JSON.stringify(settings);
  setBackgroundVars({
    settings: settings,
    FETCH_INTERVAL: settings.fetch_interval * MINUTES,
  });
  bg_call('on_fetch_interval_change', settings.fetch_interval);
}

byId('default-background').onclick = function() {
  // reset form default values
  byId('default-background').disabled = true;
  byId('background_gradient').checked = true;
  byId('background_style').value = default_settings.background_style;
  byId('background-preview').src = default_settings.background_image;
  // reset default settings
  settings.background_style = default_settings.background_style;
  settings.background_gradient = default_settings.background_gradient;
  settings.background_image = default_settings.background_image;
  save_settings();
  bg_call('save_new_background', default_settings.background_image); // TODO: merge this and upload
  chrome.runtime.sendMessage({name: 'setBackgroundImageService', type: 'manual'});
  // update UI
  publishSettingsChange('background_style', settings.background_style);
  publishSettingsChange('background_image', settings.background_image);
  publishSettingsChange('background_gradient', settings.background_gradient);
}

if (settings.background_image == default_settings.background_image) {
  byId('default-background').disabled = true;
}

chrome.runtime.sendMessage({"name": "pageview", "page": "options.html"});

fbq('track', 'PageView', {content_name: 'Options', country: stored.GEO_country_code
                          /*, content_category: ''*/});

//
// search
//

//byId('search_bar').removeEventListener('change', on_search_bar_change);
//byId('search_bar').addEventListener('change', on_search_bar_change);

function on_search_bar_change(e) {
  var search_bar_opt_message = { 
      opt_key: 'search_bar', 
      opt_val: !!byId('search_bar').checked, 
      country: stored.GEO_country_code,
      days_since_install  : get_days_since_install(),
      lifetime_days       : get_days_since_install(),
      lifetime_searches   : +stored.lifetime_searches || 0,
  };

  if (!byId('search_bar').checked) {
    ga('send', 'event', 'option', 'search-bar', 'disabled');
    ga('send', 'event', 'option', 'search-bar-lifetime-searches', 
                                   search_bar_opt_message.lifetime_searches);
    fbq('track', 'SetOption', search_bar_opt_message);
  } else {
    ga('send', 'event', 'option', 'search-bar', 'enabled');
    fbq('track', 'SetOption', search_bar_opt_message);
  }
  
  if (!byId('search_bar').checked) {
    byId('search-survey-wrapper').style.display = 'block';
    bySelector('.options-wrapper').style.scrollBehavior = 'smooth';
    bySelector('.options-wrapper').scrollTop += 1000;
    //byId('search-survey-wrapper').scrollIntoView({
    //  behavior: "smooth", block: "start",
    //});
  }
}

document.removeEventListener("change", on_search_survey_change, true);
document.addEventListener("change", on_search_survey_change, true);

function on_search_survey_change(e) {
    if (e.target.name != 'search-survey') return;
    ga('send', 'event', 'survey', 'search-bar-disable', e.target.value);
    byId('search-survey-wrapper').innerHTML = 'Thanks a lot of sharing!';
}

function temprature_from_language() {
  return ((stored.language || navigator.languages[0]) == 'en-US') ? 'f' : 'c';
}

if (window.location.href.indexOf('?cf-enable') != -1) {
  stored.cf_test_review = 'true';
  chrome.runtime.reload();
}


// backup

byId('backup-export').onclick = function () {
  window.exportAndDownloadBackup();
}

byId('backup-import').onclick = function () {
  byId('backup-import-file').click();
}

byId('backup-auto').onclick = function () {
  restoreAutoBackup();
}

window.BAK_readyListeners = window.AB_readyListeners || [];
window.BAK_readyListeners.push(function () {
  listAutoBackup(function (backup) {
    if (!backup.time) { 
      byId('backup-auto').style.display = 'none';
      return;
    }
    var time = formattedDateTime(new Date(backup.time));
    var size = Math.floor(backup.size/1000).toLocaleString();
    byId('backup-auto-time').innerHTML = time;
    byId('backup-auto-size').innerHTML = '(' + size + ' KB)';
  });
});

function formattedDateTime(date) {
  var dateString = date.toLocaleDateString();
  var is_today = date.toDateString() == (new Date).toDateString();
  if (is_today)
    dateString = 'Today';
  var yesterday = new Date;
  yesterday.setDate(yesterday.getDate()-1);
  if (yesterday.toDateString() == date.toDateString()) 
    dateString = 'Yesterday';
  return dateString + ', ' + formattedTime(date);
}

function formattedTime(date) {
  return date.toTimeString().split(':').slice(0,2).join(':');
}


// reload after backup

chrome.runtime.onMessage.addListener(function(message) {
  if (message.name && message.name == 'reload-yourself')
    location.reload();
});


// please and ask

var showPlease = Math.random() < 0.1;

window.addEventListener('focus', function (e) { 
  //if (e.target == window)
    initSocial();
});
window.addEventListener('load', initSocial);

function initSocial() {
  if (!showPlease) return;
  if (initSocial.done) return;
  initSocial.done = true;
  setTimeout(function () {
    byId('fb-like').src = byId('fb-like').dataset.src;
    //byId('fb-like').style.display = 'none';
    byId('twitter-widget-0').src = byId('twitter-widget-0').dataset.src;
    //$('#I0_1495096884686').prop('src', $('#I0_1495096884686').data('src'));
  });
}

var pleaseDisplay = showPlease ? 'block' : 'none';
byId('options-please').style.display = pleaseDisplay;
byId('social-buttons').style.display = pleaseDisplay;


// DANGEROUS! FOR TESTING ONLY!
function TEST_DANGER_simulate_missing_icons() {
  delete stored.missing_image_last_restore_attempt;
  stored.user_app_ids.split(',').filter(Boolean).forEach(remove_user_icon)
  function remove_user_icon(id) {
    const app = JSON.parse(stored[id]);
    if (app.icons) {
      app.icons.forEach(function (icon) {
        console.log('removing', icon.url);
        remove_file(extract_filename(icon.url));
      });
    }
  }
}
