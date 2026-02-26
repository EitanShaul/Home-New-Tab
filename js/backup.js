// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

//
// Backup Import / Export
//

(function () {

const AUTO_BACKUP_APPS_LIMIT = 600;
const AB_DATA_KEY = 'BAK_auto_backup_data';
const AB_TIME_KEY = 'BAK_auto_backup_time';
const AB_SIZE_KEY = 'BAK_auto_backup_size';

if ("true" == localStorage.BAK_is_reloading_after_import) {
  delete localStorage.BAK_is_reloading_after_import;
  chrome.runtime.sendMessage({name: 'reload-yourself'});
} 

var URL = window.URL || window.webkitURL;

var backupKeys = [
  'settings',
  'icons_order',
  'custom_apps',
  'hidden_apps',
  'user_app_id_inc',
  'user_app_ids', // + don't forget user_app_{id}
  'install_time',
  'notes1',
  'notifications',
  // 'WGS_quicknotes', 'WGS_notifications'
];

window.exportAndDownloadBackup = function exportAndDownloadBackup(backupData) {
  exportBackup(function (data) {
    promptDownloadForData(data);
  });
}

window.promptDownloadForData = function promptDownloadForData(data, callback) {
  if ('string' != typeof data)
    data = JSON.stringify(data, null, 2);
  var blob = new Blob([data], {type: "text/plain"});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'HomeNewTab_Backup_' + formattedDate() + '.json'; 
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click(); 
  document.body.removeChild(a);
  logBackupSize(data.length);
}


window.exportBackupString = function exportBackupString(callback) {
  exportBackup(function (data) {
    if ('string' != typeof data)
      data = JSON.stringify(data, null, 2);
    callback(data);
  });
}

window.exportBackup = function exportBackup(callback) {
  var backupData = {};
  backupKeys.forEach(function (key) {
    backupData[key] = localStorage[key];
  });

  var imageURLs = [];
  var userApps = {};

  // user apps needs special treatment
  var user_app_ids = backupData.user_app_ids.split(',');
  user_app_ids.forEach(function (id) {
    if (!id) return;
    // imageURL
    try {
      var app = JSON.parse(localStorage[id]); 
      userApps[id] = app;
      try {
        imageURLs.push(app.icons[0].url);
      } catch (e) { }
    } catch (e) {
      console.error('error parsing app JSON', id, e);
    }
  });

  collectImageBlobs(imageURLs, function (dataForImageURL) {
    Object.keys(userApps).forEach(function (id) {
      var app = userApps[id];
      try {
        var imageURL = app.icons[0].url;
        app.icons[0].dataURL = dataForImageURL[imageURL];
      } catch (e) {
        console.error('error adding image', id, imageURL, e);
      }
      backupData[id] = JSON.stringify(app);
    });    
    callback && callback(backupData);
  });
};

function collectImageBlobs(imageURLs, onSuccess, onError) {
  var remaining = imageURLs.length;
  var blobForImageURL = {};
  imageURLs.forEach(function (url) {
    imageURLToBlob(url, function onBlobOk(blob) {
      read_file(blob, function onReadOk(dataURL) {
        blobForImageURL[url] = dataURL;
        checkFinish();
      }, function onReadErr(e) {
        console.error('error read_file', url, e);
        checkFinish();
      });
    },
    function onBlobErr(e) {
      console.error('error imageURLToBlob', url, e);
      checkFinish();
    });
  });
  function checkFinish() {
    remaining--;
    if (!remaining)
      onSuccess && onSuccess(blobForImageURL);
  }
}

window.importBackupFile = function importBackupFile(filename, callback) {
  read_text_file(filename, function (data) {
    importBackupData(data);
    callback && callback();
  }, function () {
    console.error('error with file select', arguments);
  });
}

window.importBackupData = function importBackupData(backupData, shouldOverwriteOldData) {
  
  // no turning back...
  //localStorage.clear();

  if ('string' == typeof backupData)
    backupData = JSON.parse(backupData);

  // restore what we saved
  Object.keys(backupData).forEach(function (key) {
    if (isUserAppId(key)) {
      localStorage[key] = importUserApp(key, backupData[key]);
    } else if ('settings' == key) {
      localStorage[key] = importSettings(backupData[key]);
    } else {
      localStorage[key] = backupData[key];
    }
  });

  // TODO: needs updating
  // gotta be careful with reloading since manifest v3 is not bg page anymore
  // we have service worker and i don't know how to update it yet

  //var bg = chrome.extension.getBackgroundPage();
  //bg.location.reload();
  //window.close();
  localStorage.BAK_is_reloading_after_import = true;
  //chrome.runtime.reload();

  var bg = chrome.extension.getBackgroundPage();
  bg.location.reload();

  //setTimeout(function () {
  //  location.reload();
  //}, 1000);
};

function importBackupDataUserAppsOnly(backupData) {
  
  if ('string' == typeof backupData)
    backupData = JSON.parse(backupData);

  Object.keys(backupData).filter(isUserAppId).forEach(function (key) {
    localStorage[key] = importUserApp(key, backupData[key]);
  });

  // we dont want reloading whole extension here.
};

function importBackupDataBackgroundOnly_TEMPFIX(backupData) {

  if ('string' == typeof backupData)
    backupData = JSON.parse(backupData);

  let backupSettings = JSON.parse(backupData.settings);

  Object.keys(default_settings).forEach(function (key) {
    settings[key] = backupSettings[key];
  });
  localStorage.settings = JSON.stringify(settings);

  // we dont want reloading whole extension here.
};

function importSettings(newSettingsString) {
  var newSettings = JSON.parse(newSettingsString);
  if (newSettings.background_image.startsWith('filesystem:')) {
    newSettings.background_image = settings.background_image;
    newSettings.background_style = settings.background_style;
  }
  delete newSettings.background_image_baked;

  /*
  if (newSettings.background_data_url) {
    var dataURL  = newSettings.background_data_url;
    var filename = decodedFilenameFromURL(dataURL);
    delete newSettings.background_data_url;
    save_file(filename, dataURL, function () {
      console.log('import bg image ok', id, filename)
    });
  }
  */

  return JSON.stringify(newSettings);
}

function isUserAppId(id) {
  return /^user_app_[\d]+$/.test(id);
}

// @param  {String} id
// @param  {String} data 
// @return {String} importedData
function importUserApp(id, data) {
  var app = 'string' == typeof data ? JSON.parse(data) : data; 
  try {
    var dataURL  = app.icons[0].dataURL;
    var filename = decodedFilenameFromURL(app.icons[0].url);
    delete app.icons[0].dataURL;
    save_file(filename, dataURL, function () {
      console.log('import icon ok', id, filename)
    });
  } catch (e) { 
    console.error(e);
  }
  return JSON.stringify(app);
}


//
// Auto Backup
//

chrome.idle.onStateChanged.addListener(function (state) {
  if (!/idle|locked/.test(state)) return;
  setTimeout(sendStorageStats, 1);  
  var today = getCurrentDateString();
  var backupDay = getDateString(new Date(+localStorage.BAK_auto_backup_time));
  if (today == backupDay) return;
  localStorage.BAK_auto_backup_time = Date.now();
  autoBackup();
});

function autoBackup() {
  var ordered = stored.icons_order.split(',');
  if (ordered.length > AUTO_BACKUP_APPS_LIMIT) return; // TEMP LIMIT 
  exportBackupString(saveAutoBackup);
}
window.autoBackup = autoBackup;

function saveAutoBackup(data) {
  var obj = { 
    [AB_DATA_KEY] : data, 
    [AB_TIME_KEY] : Date.now(),
    [AB_SIZE_KEY] : data.length 
  };
  chrome.storage.local.set(obj, function () {
    if (handleStorageError()) return;
  });
  logAutoBackupSize(data.length);
}

window.listAutoBackup = function listAutoBackup(callback, errorCallback) {
  var keys = [AB_TIME_KEY, AB_SIZE_KEY];
  chrome.storage.local.get(keys, function (res) {
    if (handleStorageError(errorCallback)) return;
    callback({
      time : res[AB_TIME_KEY],
      size : res[AB_SIZE_KEY]
    });
  });
}

window.restoreAutoBackup = 
    function restoreAutoBackup(callback, errorCallback) {
  if (!confirm('Do you want to R E S T O R E Home to an E A R L I E R state?\n\nThis can fix problems you might be having, but you will lose apps and settings that have changed since then.')) return;
  chrome.storage.local.get([AB_DATA_KEY], function (res) {
    if (handleStorageError(errorCallback)) return;
    importBackupData(res[AB_DATA_KEY]);
    callback && callback();
  });
}

window.restoreUserAppsFromAutoBackup = 
    function restoreUserAppsFromAutoBackup(callback, errorCallback) {
  chrome.storage.local.get([AB_DATA_KEY], function (res) {
    if (handleStorageError(errorCallback)) return;
    importBackupDataUserAppsOnly(res[AB_DATA_KEY]);
    callback && callback();
  });
}

// temp fixes an error where we overrode the settings with defaults
window.restoreBackgroundFromAutoBackup_TEMPFIX = 
    function restoreBackgroundFromAutoBackup_TEMPFIX(callback, errorCallback) {
  chrome.storage.local.get([AB_DATA_KEY], function (res) {
    if (handleStorageError(errorCallback)) return;
    importBackupDataBackgroundOnly_TEMPFIX(res[AB_DATA_KEY]);
    callback && callback();
  });
}

function handleStorageError(errorCallback) {
  if (chrome.runtime.lastError) {
    ga('error.send', 'event', 'backup', 'storage_error', chrome.runtime.lastError);
    errorCallback && errorCallback(chrome.runtime.lastError);
    console.error(chrome.runtime.lastError);
    return chrome.runtime.lastError;
  }
}

function logBackupSize(len) {
  ga('stats.send', 'event', 'backup', 'backup_size', len, len);
}

function logAutoBackupSize(len) {
  ///ga('stats.send', 'event', 'backup', 'auto_backup_size', len, len);
}

if (window.BAK_readyListeners) {
  window.BAK_readyListeners.forEach(function (fn) {
    fn();
  });
}

//
// Helpers
//

function decodedFilenameFromURL(url) {
  return decodeURIComponent(url.split('/').pop());
}

function formattedDate(date) {
  date || (date = new Date);
  var strDate = '' + date.getFullYear() + 
                '-' + pad(date.getMonth()+1) +
                '-' + pad(date.getDate())
  var strTime = pad(date.getHours()) + '-' +  pad(date.getMinutes());
  return strDate + '-' +  strTime;
}

function pad(v) {
  return v < 10 ? '0'+v : ''+v;
}

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

})();


//
// Storage stats
//

function sendStorageStats() {
  if ('true' == localStorage.STAT_sent_storage_stat_0) return;
  localStorage.STAT_sent_storage_stat_0 = 'true';
  var storage = 'storage0';
  function onErr(e) {
     ga('stats.send', 'event', storage, 'stat-err', e);
     console.error('stat-err', e);
  }
  // WebSQL?
  navigator.webkitTemporaryStorage.queryUsageAndQuota((usage, quota) => {
    console.log('temporary', usage);
    console.log('quota', quota);
    ga('stats.send', 'event', storage, 'temporary', usage, usage);
    ga('stats.send', 'event', storage, 'quota', quota, quota);
  }, onErr);
  // FileSystem
  navigator.webkitPersistentStorage.queryUsageAndQuota((usage, quota) => {
    console.log('persistent', usage);
    ga('stats.send', 'event', storage, 'persistent', usage, usage);
  }, onErr);
  var keyLen  = localStorage.length;
  var byteLen = JSON.stringify(localStorage).length;
  ga('stats.send', 'event', storage, 'localStorage-keys',  keyLen, keyLen);
  ga('stats.send', 'event', storage, 'localStorage-bytes', byteLen, byteLen);
  // chrome.storage.local.getBytesInUse(console.log)
}


//////////////////////////////////////////////////

/*
//  Pass in null to get the entire contents of storage.
chrome.storage.local.get(null, function(items) {
    var allKeys = Object.keys(items);
    console.log(allKeys);
});
*/

/*
  chrome.tabs.query({}, function(tabs) { 
    var urlStart = 'chrome-extension://' + window.APP_ID;
    tabs.forEach(function (tab) { 
      if (tab.url && tab.url.indexOf(urlStart == 0))
        chrome.tabs.reload(tab.id);
    });
    location.reload();
  });


storageEstimateWrapper().then(estimate => {
  // estimate.quota is the estimated quota
  // estimate.usage is the estimated number of bytes used
  console.log(estimate)
});

function storageEstimateWrapper() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    // We've got the real thing! Return its response.
    return navigator.storage.estimate();
  }

  webkitPersistentStorage

  if ('webkitTemporaryStorage' in navigator &&
      'queryUsageAndQuota' in navigator.webkitTemporaryStorage) {
    // Return a promise-based wrapper that will follow the expected interface.
    return new Promise(function(resolve, reject) {
      navigator.webkitTemporaryStorage.queryUsageAndQuota(
        function(usage, quota) {resolve({usage: usage, quota: quota})},
        reject
      );
    });
  }

  // If we can't estimate the values, return a Promise that resolves with NaN.
  return Promise.resolve({usage: NaN, quota: NaN});
}


*/