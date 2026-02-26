// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

//
// Wallpaper services
//

(function () {

var homeImages;

(async () => {
  await stored;

  // why do both of these?
  if (stored.WLP_images == null) 
    stored.WLP_images = '[]';
  homeImages = storageGet('WLP_images', []);  

  setTimeout(homeFetchWallpapers, 1);
  setTimeout(homeRefreshCurrentWallpaper, 1);
})();

// has to be top level call (service worker)
chrome.alarms.create('homeWallpaperFetchAndRefresh', {
  periodInMinutes: 60 // 1 hour
});

// has to be top level call (service worker)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'homeWallpaperFetchAndRefresh') {
    homeFetchWallpapers();
    homeRefreshCurrentWallpaper();
  }
});

async function homeFetchWallpapers() {
  await stored;

  if (stored.WLP_home_next_fetch && 
      Date.now() < stored.WLP_home_next_fetch) 
    return;

  if (!window.navigator.onLine)
    //return setTimeout(homeFetchWallpapers, 10*MINUTES);
    return chrome.alarms.create('homeWallpaperFetchAndRefresh', {
      periodInMinutes: 10
    });

  // var baseUrl = 'https://wallpaper.homenewtab.com/today.json';
  var baseUrl = 'https://s3.amazonaws.com/wallpaper.homenewtab.com/today.json';
  ajax(baseUrl + '?t=' + Date.now(), function (xhr) {
    // if theres a problem I'd rather save the servers than keep trying
    // so even if something below fails we won't retry until the next schedule
    stored.WLP_home_next_fetch = Date.now() + 24*HOURS;

    if (!xhr.responseText) 
      ga('send', 'event', 'debug', 'error-wallpaper-home', 'no response text');

    try {
      //if (!xhr.responseText) return;
      var res = JSON.parse(xhr.responseText);
      //if (!res.images || !res.images.length) return;
      homeImages = res.images;
      storageSet('WLP_images', homeImages);

      homeRefreshCurrentWallpaper();
      // Blaze didn't wake up yet
      //if (res.date && res.date == stored.WLP_home_feed_date)
      //  stored.WLP_home_next_fetch = Date.now() + 50*MINUTES;
      //else
      //  storageSet('WLP_home_feed_date', res.date);

    } catch (e) {
       var errTxt = 'xhr.responseText: ' + xhr.responseText;
       ga('send', 'event', 'debug', 'error-wallpaper-home', errTxt);
       ajax2('https://search.homenewtab.com/debug/wallpaper.php' + 
              '?data=' + encodeURIComponent(errTxt), function(){}, function(){}, 'POST');
    }

    var today        = getDateString(new Date);
    var lastRetryDay = getDateString(new Date(+stored.WLP_home_retry_date));
    if (today == lastRetryDay && stored.WLP_home_retry_code) {
      ga('send', 'event', 'debug', 'error-wallpaper-home', 
         stored.WLP_home_retry_code + ' retry success');
    }
  }, function (xhr) {
      var errTxt = 'network error ' + xhr.status + ' ' + xhr.statusText;
      var errTxtLong = errTxt + '\n' + xhr.responseText;
      // Service Unavailable => one retry per day
      if (503 == xhr.status || 500 == xhr.status  || 0 == xhr.status) { 
        var today        = getDateString(new Date);
        var lastRetryDay = getDateString(new Date(+stored.WLP_home_retry_date));
        if (today != lastRetryDay) {
          stored.WLP_home_next_fetch = Date.now() + 50*MINUTES;
          stored.WLP_home_retry_date = Date.now();
          stored.WLP_home_retry_code = xhr.status;
        }
        ga('send', 'event', 'debug', 'error-wallpaper-home', xhr.status + ' first retry');
        ajax2('https://search.homenewtab.com/debug/wallpaper.php' + 
              '?data=' + encodeURIComponent(errTxtLong), function(){}, function(){}, 'POST');
        return;
      }
      ga('send', 'event', 'debug', 'error-wallpaper-home', errTxt);
      ajax2('https://search.homenewtab.com/debug/wallpaper.php' + 
            '?data=' + encodeURIComponent(errTxtLong), function(){}, function(){}, 'POST');
  });
}

async function homeRefreshCurrentWallpaper() {
  await stored;

  if (settings.background_image_provider != 'home') return;

  var idx = storageGet('WLP_home_idx', 0);

  if (stored.WLP_current_date != getCurrentDateString() || idx == -1) {
    //var urls = homeImages.map(homeGetURLFromWallpaperItem);
    //var oldIdx = urls.indexOf(settings.background_image);
    //idx = oldIdx + 1; // if it was -1 (not found) it becomes 0 => perfect
    //if (idx >= homeImages.length) idx = 0;
    idx = homeImages.length - 1;
    stored.WLP_home_idx = idx;
    stored.WLP_current_date = getCurrentDateString();
    ga('stats.send', 'event', 'WLP', 'WLP_home_idx', idx, idx);
  }

  if (idx == -1) return;

  var new_background = homeGetURLFromWallpaperItem(homeImages[idx]);
  if (!new_background) return;
  if (new_background == settings.background_image) return;
  var filter = homeGetFilterFromWallpaperItem(homeImages[idx]);
  chrome.runtime.sendMessage({name: 'setBackgroundImage', 
                              content: new_background,
                              filter: filter});
  chrome.runtime.sendMessage({name: 'setBackgroundStyle', 
                              content: 'stretch'});
  wallpaperActions.setBackgroundImage({content: new_background, filter: filter});
  wallpaperActions.setBackgroundStyle({content: 'stretch'});
}

function homeGetURLFromWallpaperItem(item) {
  if (item.url) 
    return item.url;
}

function homeGetFilterFromWallpaperItem(item) {
  var filter = item.filter || {};
  if ('warm' == filter.name == 'warm') {
    filter.img = '38.jpg';
  } else if ('top-grad' == filter.name) {
    filter.img = 'top_vignette.png';
  } else {
    filter.img = '13.jpg';
  }
  return filter;
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

var wallpaperActions = {
  setBackgroundImageService: function (message) {
    if (message.type == 'auto' && /home|bing/.test(message.source)) {
      change_options(function (settings_temp) {
        settings_temp.background_image_provider = message.source;
      });
      if (message.source == 'home') 
        homeRefreshCurrentWallpaper();
    } else if (message.type == 'manual') {
      change_options(function (settings_temp) {
        settings_temp.background_image_provider = 'manual';
        delete settings_temp.background_filter;
      });
    }
  },
  setBackgroundStyle: function (message) {
    change_options(function (settings_temp) {
      settings_temp.background_style = message.content;
    });
  },
  setBackgroundImage: function (message) {
    change_options(function (settings_temp) {
      settings_temp.background_image  = message.content;
      settings_temp.background_filter = message.filter;
    });
  },
}

// has to be top level call (service worker)
chrome.runtime.onMessage.addListener(function (message) {
  if (typeof wallpaperActions[message.name] == 'function') {
    wallpaperActions[message.name](message);
  }
});

window.get_wallpaper_provider = function get_wallpaper_provider() {
  var provider = settings.background_image_provider || 'manual';
  if (provider != 'manual') 
    return settings.background_image_provider;
  else if (settings.background_image.indexOf('/img/backgrounds/') != -1)
    return 'default';
  else
    return 'user';
}

})();


//
// Bake effects (vignette and filter)
//

(function () {

// Chrome 66, do: feature test
// now render more efficiently and with less jank 
// by working asynchronously and avoiding memory duplication.
//const image = await createImageBitmap(imageBlob);
//const context = el.getContext('bitmaprenderer');
//context.transferFromImageBitmap(image);

// Chrome 69, do: feature test
// OffScreen canvas, Off the main thread
// https://developers.google.com/web/updates/2018/08/offscreen-canvas

// has to be top level call (service worker)
chrome.runtime.onMessage.addListener(function (message) {
  if ('setBackgroundImage' != message.name) return;
  if (!message.content) return;

  /// NOT READY FOR PRODUCTION YET
  return;

  var url = message.content;

  var start = performance.now();

  var image = new Image();
  var filterImage = new Image();

  // bg default: 21 (38f), 18 (38f) little too cold to be def
  image.onload = filterImage.onload = checkAllLoaded;
  image.src = url; // 38 conservative elegant, 38 colorful, 34?
  filterImage.src = '/img/backgrounds/38.jpg'; // 31, 38, 34

  var remaining = 2;

  function checkAllLoaded () {
    remaining -= 1;
    if (remaining) return;

    var canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    var size = sizeFittingMaxSize(image.naturalWidth, image.naturalHeight, 1920, 1080);
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.width = size.width + 'px';
    canvas.style.height = size.height + 'px';

    //ctx.fillStyle="#fff";//testing
    //ctx.fillRect(0,0,size.width,size.height);

    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 
                         0, 0, size.width, size.height);
    ctx.globalAlpha = 0.5;
    ctx.filter = 'blur(30px)'; // real css: 20
    ctx.drawImage(filterImage, 0, 0, filterImage.naturalWidth, filterImage.naturalHeight, 
                               -40+40, -40+40, size.width + 80-80, size.height + 80-80);

    ctx.globalAlpha = 1;
    ctx.filter = 'none';              
    manualVignetteToContext(ctx, size.width, size.height);

    canvas.toBlob(function (blob) {
      save_file_blob('/background_baked.jpg', blob, function (url) {
        change_options(function (settings_temp) {
          settings_temp.background_image_baked = url;
        });
        console.log(performance.now() - start, blob);
      });
    }, 'image/jpeg', .92); // default: 0.92
  }
});

// css background-size: contain?
// each side fits into bounding rect (smaller than rect if needed)
function sizeFittingMaxSize(orgw, orgh, maxw, maxh) {
  var w, h;
  // pass 1
  w = Math.min(orgw, maxw);
  h = orgh * (w / orgw);
  // pass 2
  h = Math.min(h, maxh);
  w = orgw * (h / orgh);
  return { width: w, height: h };
}

// css background-size: 100% 100%
function sizeStretchedToMaxSize(orgw, orgh, maxw, maxh) {
  return { width: maxw, height: maxh };
}

// similar to css background-size: cover
// make sure only 1 side or no side overflows (never 2 sides)
function sizeCoveringMaxSize(orgw, orgh, maxw, maxh) {
  if (orgw <= maxw || orgh <= maxh) return;
  var w = orgw, h = orgh;
  // pass 1
  if (orgw > maxw) {
    w = Math.min(orgw, maxw);
    h = orgh * (w / orgw);
  }
  // pass 2
  h = Math.max(h, maxh);
  w = orgw * (h / orgh);
  return { width: w, height: h };
}

function manualVignetteToContext(ctx, width, height) {
  var grd = ctx.createLinearGradient(0, 0, 0, height);
  grd.addColorStop(0, "rgba(0, 0, 0, 0.01)");
  grd.addColorStop(0.75, "rgba(0, 0, 0, 0.001)");
  grd.addColorStop(1, "rgba(0, 0, 0, 0.33)");

  ctx.fillStyle = grd;
  ctx.fillRect(0,0,width,height);

  var grd = ctx.createLinearGradient(0, 0, width, 0);
  grd.addColorStop(0, "rgba(0, 0, 0, 0.25)");
  grd.addColorStop(0.25, "rgba(0, 0, 0, 0.001)");
  grd.addColorStop(0.75, "rgba(0, 0, 0, 0.001)");
  grd.addColorStop(1, "rgba(0, 0, 0, 0.25)");

  ctx.fillStyle = grd;
  ctx.fillRect(0,0,width,height);
}

})();

////////////////////////////////////////////////////////////
/// TEMP
//////////////////////////

/*
// has to be top level call (service worker)
chrome.runtime.onInstalled.addListener(function (details) {
  if ('update' != details.reason) return;
  if (stored.TEMP_wlp_migrated_to_home != null) return;
  stored.TEMP_wlp_migrated_to_home = 'true';
  if (settings.background_image_provider == 'home') return;
  if (settings.background_image.indexOf('/img/backgrounds') == -1) return;
  change_options(function (settings_new) {
    settings_new.background_image_provider = 'home';
  });
});
*/

////////////////////////////////////////////////////////////




/// TEMPORARY CODE ////////////////////////////////////////////////
// migrate to new background logic
/*
(function migrate_background_image() {
if (!fs) {
  setTimeout(migrate_background_image, 50);
  return;
}
if (settings.background_image.indexOf('persistent/background.jpg') == -1) {
  save_new_background(settings.background_image);
}
})();
*/
///////////////////////////////////////////////////////////////////
