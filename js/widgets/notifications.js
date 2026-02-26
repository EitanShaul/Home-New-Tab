// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

var last_sound = +new Date;

function set_indicator(id, count) {
  var key = "indicator-" + id;
  var el = byId(key);
  if (!el) 
    return setTimeout(function () { set_indicator(id, count) }, 1000);
  el.innerHTML = count;
  if (+count)
    el.style.display = "block";
  else
    el.style.display = "none";
  stored[key] = count;
  cache_set_app_html(el.parentNode);
}

function show_recent_notifications() {
  var container = byId('notifications');
  var notifications = stored.notifications.split(ITEM_SEPARATOR);
  var max = Math.min(notifications.length, MAX_NOTIFICATIONS_SHOWN);
  var html = "";
  if (!notifications[0]) return;
  for (var i = 0; i < max; i++) {
    var parts = notifications[i].split(FIELD_SEPARATOR);
    html += '<div class="box-text"><img src="'+ parts[0] +'" class="ticker-icon" /><div class="bd"><strong>'+ parts[1]  +'</strong> '+ parts[2]  + '</div></div>';
  }
  container.innerHTML = html;
  show_recent_notifications.done = true;
}


function create_notification(icon, title, body) {

  /*
  if (icon == 'tweet' && +new Date - last_sound > 1000)  {
    last_sound = +new Date;
    byId('twittersound', bg.document).currentTime = 0;
    byId('twittersound', bg.document).play();
  }
  */
  increment_global_unread_notifications();

  icon = ICONS[icon] || icon;

  // update UI
  var container = byId('notifications');
  var items = $('.box-text', container);
  var item = document.createElement('div');
  item.className = 'box-text';
  item.style.opacity = 0;
  item.innerHTML = '<img src="'+ icon +'" class="ticker-icon" /><div class="bd"><strong>'+ title +'</strong> '+ body + '</div>';
  container.insertBefore(item, container.firstChild);
  if (items.length > MAX_NOTIFICATIONS_SHOWN) {
    container.removeChild(container.lastChild);
  }

  // notification animation

  // start at zero height
  var height = item.offsetHeight;
  item.style.webkitTransition = "none";
  item.style.height = 0;
  //item.style.webkitTransform = "rotateX(90deg)";

  // open up and fade in
  setTimeout(function() {
    item.style.webkitTransition = "";
    item.style.height = height + "px";
    item.style.opacity = 1;
    //item.style.webkitTransform = "";
  }, 10);

  var transitionTimeout = setTimeout(transitionEnd, 500);
  item.on("webkitTransitionEnd", transitionEnd);

  // reset auto height after animation finished
  function transitionEnd(e) {
    if (e && e.propertyName != 'height') return;
    item.off("webkitTransitionEnd", transitionEnd);
    clearTimeout(transitionTimeout);
    item.style.webkitTransition = "none";
    item.style.height = "";
  };
}

function play_notification_sound(type) {
}

function increment_global_unread_notifications() {
  loadCSS('css/widgets.css', 'widgets-css'); // shake
  var unread = Number(stored.NOTI_unread_global) || 0;
  stored.NOTI_unread_global = unread + 1;
  redisplay_global_unread_notifications();
  byId('notifications-button').classList.remove('shake');
  void byId('notifications-button').offsetWidth; // trick: triggering reflow
  byId('notifications-button').classList.add('shake');
}
