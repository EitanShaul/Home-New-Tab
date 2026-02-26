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
fbq('track', 'PageView', {content_name: 'Options', country: stored.GEO_country_code
                          /*, content_category: ''*/});

function byId(id, base) { return (base||document).getElementById(id); }

var apps_with_notification = {
  'pjkljhegncpnkpknbcohdijeoejaedia': 'Gmail',
  //'pjjhlfkghdhmijklfnahfkpgmhcmfgcm': 'Google Reader',
  'dlppkpafhbajpcmmoheippocdidnckmm': 'Google Plus',
  'ejjicmeblgpmajnghnpcppodonldlgfn': 'Google Calendar',
  'yahoo-mail': 'Yahoo Mail',
  'hotmail':    'Hotmail (Outlook)',
  'facebook':   'Facebook'
  //,'twitter':    'Twitter'
};

var bg = chrome.extension.getBackgroundPage();
var apps = bg.apps, custom_apps = bg.custom_apps;
var el = byId("notification-options");

// load settings on init
for (var i in apps_with_notification) {
  if (i == 'ejjicmeblgpmajnghnpcppodonldlgfn' ||      // Calendar doesn't need to be installed
      apps[i] && (apps[i].enabled || custom_apps[i])) { // others do
    el.insertAdjacentHTML("beforeend", generate_notification_html(apps, i));
  }
}

function generate_notification_html(apps, i) {
  var checked = ("undefined" == typeof settings.notifications[i] || settings.notifications[i]) ? "checked='checked'" : '';
  return '<label><input type="checkbox" '+ checked +' id="'+ i +'" /> '+ 
                 apps_with_notification[i] + ' ' +
         '</label>';
}


byId('fetch_interval').value = settings.fetch_interval;
byId('time_format').value    = settings.time_format;
byId('search_bar').checked   = settings.search_bar;
byId('temperature').value    = settings.temperature || temprature_from_language();

byId('background_style').value      = settings.background_style;
byId('background_gradient').checked = settings.background_gradient;
byId('background_fadein').checked   = settings.background_fadein;
byId('background-preview').src      = settings.background_image;




//byId('files').addEventListener('change', handle_file_select, false);

// save on every change
function on_change(e) {

  // notification settings
  if (e.target.type && e.target.type == "checkbox") {
    if (e.target.parentNode.parentNode.id == 'notification-options') {
      settings.notifications[e.target.id] = e.target.checked;
    } else {
      settings[e.target.id] = e.target.checked;
    }
    if (e.target.id == 'background_gradient') {
      change_background_gradient();
    }
  }
  // other settings
  else if (e.target.nodeName == "SELECT") {
    settings[e.target.id] = e.target.value;
    if (e.target.id == 'background_style') {
      change_background_style();
    }
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

    handle_file_select(e, function (filename, dataURI) {
      byId('background-preview').src = dataURI;
      byId('page').style.backgroundImage = 'url(' + dataURI + ')';
      byId('default-background').disabled = false;
      save_file('/background.jpg', dataURI, function (url) {  // TODO: merge this and default
        //settings[e.target.id] = url;
        //save_settings();
        chrome.runtime.sendMessage({name: 'setBackgroundImageService', type: 'manual'});
        chrome.runtime.sendMessage({name: 'setBackgroundImage', content: url});
      });
    })
  }
  save_settings();
}

function save_settings() {
  stored.settings = JSON.stringify(settings);
  bg.settings = settings;
  bg.FETCH_INTERVAL = settings.fetch_interval * MINUTES;
}

document.addEventListener("change", on_change, true);


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
  var bg = chrome.extension.getBackgroundPage();
  bg.save_new_background(default_settings.background_image); // TODO: merge this and upload
  chrome.runtime.sendMessage({name: 'setBackgroundImageService', type: 'manual'});
  // update UI
  change_background_style();
  change_background();
  change_background_gradient();
}

if (settings.background_image == default_settings.background_image) {
  byId('default-background').disabled = true;
}

chrome.runtime.sendMessage({"name": "pageview", "page": "options.html"});




byId('search_bar').addEventListener('change', function (e) {
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
    byId('page').scrollTop += 120;
    //byId('search-survey-wrapper').scrollIntoView({
    //  behavior: "smooth", block: "start",
    //});
  }
});

document.addEventListener("change", function (e) {
    if (e.target.name != 'search-survey') return;
    ga('send', 'event', 'survey', 'search-bar-disable', e.target.value);
    byId('search-survey-wrapper').innerHTML = 'Thanks a lot of sharing!';
}, true);

function temprature_from_language() {
  return ((stored.language || navigator.languages[0]) == 'en-US') ? 'f' : 'c';
}

if (window.location.href.indexOf('?cf-enable') != -1) {
  stored.cf_test_review = 'true';
  chrome.runtime.reload();
}

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
    if (!backup.time) return;
    var time = formattedDateTime(new Date(backup.time));
    var size = Math.floor(backup.size/1000).toLocaleString();
    byId('backup-auto-time').innerHTML = time;
    byId('backup-auto-size').innerHTML = '(' + size + ' KB)';
    byId('backup-auto').style.display = 'block';
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


chrome.runtime.onMessage.addListener(function(message) {
  if (message.name && message.name == 'reload-yourself')
    location.reload();
});


