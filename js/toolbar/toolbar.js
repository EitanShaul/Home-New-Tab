(() => { // make sure arrow functions work

var boxesHiders = [];

var mode = { NONE: 0, TOOLBAR: 1, WIDGET: 2 }; // toolbox

if (null == stored.WGS_update)
  stored.WGS_update = "1532978079628";
if (null == stored.WGS_notifications)
  stored.WGS_notifications = "false";
if (null == stored.WGS_quicknotes)
  stored.WGS_quicknotes = "false";

var notificationsToolbox, quicknotesToolbox;

refreshToolbar();

function refreshToolbar() {
  if (("true" != stored.WGS_notifications || settings.focus_mode) && 
      settings.show_notifications !== false) {
    initToolbarNotifications();
  }
  if (("true" != stored.WGS_quicknotes || settings.focus_mode) &&
      settings.show_qnotes !== false) {
    initToolbarQuickNotes();
  }
}

addSettingsListener('show_notifications', function (key, value) {
  if (value) initToolbarNotifications();
});
addSettingsListener('show_qnotes', function (key, value) {
  if (value) initToolbarQuickNotes();
});

function initToolbarNotifications() {
  if (!notificationsToolbox) {
    var callbacks = { willShow: on_will_show_notifications_box }
    notificationsToolbox = initToolbarButtonWithBox(
      byId('notifications-button'), byId('notifications-box'), callbacks);
    document.documentElement.classList.add('notifications-hidden');
  }
  initToolbarNotifications.done = true;
  return notificationsToolbox;
}

function initToolbarQuickNotes() {
  if (!quicknotesToolbox) {
    var callbacks = { willShow: on_will_show_quick_notes_box }
    quicknotesToolbox = initToolbarButtonWithBox(
      byId('qnotes-button'), byId('qnote'), callbacks);
    document.documentElement.classList.add('qnotes-hidden');
  }
  initToolbarQuickNotes.done = true;
  return quicknotesToolbox;
}

function on_will_show_notifications_box() {
  if (!show_recent_notifications.done)
    show_recent_notifications();
}

function on_will_show_quick_notes_box() {
  if (!load_quick_notes.done)
    load_quick_notes();
}

function initToolbarButtonWithBox(button, box, callbacks) {

  callbacks = callbacks || {};

  boxesHiders.push(boxFadeOut);

  button.style.display = 'block';
  var removeEscHandler;

  var tracker;

  function boxEnter() {
                    console.log('boxEnter');

    if (tracker) tracker.destroy();
  }

  function boxFadeIn() {
                    console.log('boxFadeIn');

    callbacks.willShow && callbacks.willShow(box);
    //console.log('boxFade IN', box.id)
    box.style.display = 'block';
    box.classList.add('floating');
    clearTimeout(boxFadeIn.timer);
    boxFadeIn.timer = setTimeout(_ => box.style.opacity = 1, 10);
    button.classList.add('active');

    removeEscHandler = addEscHandler(boxFadeOut);

    boxesHiders.forEach(function (boxhider) {
      if (boxhider == boxFadeOut) return;
      boxhider(10);
    });
  }

  var buttonClickX, buttonClickY;

  function boxFadeOut(delay) {
    if (typeof delay != 'number') delay = 200;
    //console.log('boxFade OUT', box.id)
    callbacks.willHide && callbacks.willHide(box);
    clearTimeout(boxFadeIn.timer);
    boxFadeIn.timer = setTimeout(_ => { 
      box.style.opacity = 0;
      button.classList.remove('active'); 
      callbacks.didHide && callbacks.didHide(box);
    }, delay); // 200
    button.off('mouseleave', buttonLeave);
    if (removeEscHandler) removeEscHandler();
  }

  function initAndToggleBox(e) {
    if (!initAndToggleBox.done || box.style.display == 'none') {
      initAndToggleBox.done = true;
      boxFadeIn();
      buttonClickX = e.pageX;
      buttonClickY = e.pageY;
      button.on('mouseleave', buttonLeave);
    } else {
      boxFadeOut(0);        
    } 
  }

  function buttonLeave() {
    startTracker(buttonClickX, buttonClickY);
  }

  function startTracker(startX, startY) {
    if (!tracker) {
      tracker = createMouseTriangleTracker({
        target: box,
        startX: startX,
        startY: startY,
        onLeave: function () {
          boxFadeOut();
          console.log('left')
        },
        onDestroy: function () {
          tracker = null;
        },
      }).start();
    }
  }

  function fadeOutIfFocusMovedOutsideBox(e) {
    // timeout is needed because `focusout` is fired BEFORE new focus is aquired
    // `focusout` is mandatory because it bubbles (simple `focus` doesn't)
    setTimeout(function () {
      var el = document.activeElement;
      do {
        if (el == box) return; // mouse is inside
      } while(el = el.parentNode);
      boxFadeOut(); // mouse is outside
    }, 100);
  }

  box.on('webkitTransitionEnd', () => { 
    //console.log('transitionEnd', box.id, 'opacity ' + box.style.opacity)
    if (0 == Number(box.style.opacity)) box.style.display = 'none';
  });

  var focusin  = (e) => box.off('mouseleave',  boxFadeOut);
  var focusout = (e) => box.on('mouseleave',  boxFadeOut);

  //button.on('mouseenter', initAndToggleBox);
  button.on('click', initAndToggleBox);
  //button.on('mouseleave', boxFadeOut);

  box.on('mouseenter',  boxEnter);
  box.on('mouseenter',  boxFadeIn);
  box.on('mouseleave',  boxFadeOut);
  box.on('focusin',  focusin);
  box.on('focusout', focusout);
  box.on('focusout', fadeOutIfFocusMovedOutsideBox);

  function destroy() {
    if (removeEscHandler) removeEscHandler();
    button.off('click', initAndToggleBox);
    //button.off('mouseleave', boxFadeOut);
    button.off('mouseleave', buttonLeave);

    box.off('mouseenter',  boxEnter);
    box.off('mouseenter',  boxFadeIn);
    box.off('mouseleave',  boxFadeOut);
    box.off('focusin',  focusin);
    box.off('focusout', focusout);
    box.off('focusout', fadeOutIfFocusMovedOutsideBox);
  }

  return {
    open: initAndToggleBox,
    destroy: destroy
  };
}

byId('notifications-button').on('click', reset_global_unread_notifications);

function notifications_pin() {
    notificationsToolbox.destroy();
    stored.WGS_notifications = "true";
    byId('notifications-button').style.display = 'none';
    byId('notifications-box').classList.remove('floating');
    document.documentElement.classList.remove('notifications-hidden');
    refresh_apps_grid();
}

function notifications_unpin() {
    stored.WGS_notifications = "false"; 
    byId('notifications-button').style.display = 'block';
    byId('notifications-box').classList.add('floating');
    document.documentElement.classList.add('notifications-hidden');
    notificationsToolbox = initToolbarButtonWithBox(
      byId('notifications-button'), byId('notifications-box'));
    refresh_apps_grid();
}

function quicknotes_pin() {
    quicknotesToolbox.destroy();
    stored.WGS_quicknotes = "true";
    byId('qnotes-button').style.display = 'none';
    byId('qnote').classList.remove('floating');
    document.documentElement.classList.remove('qnotes-hidden');
    refresh_apps_grid();
}

function quicknotes_unpin() {
    stored.WGS_quicknotes = "false"; 
    byId('qnotes-button').style.display = 'block';
    byId('qnote').classList.add('floating');
    document.documentElement.classList.add('qnotes-hidden');
    quicknotesToolbox = initToolbarButtonWithBox(
      byId('qnotes-button'), byId('qnote'));
    refresh_apps_grid();
}

if (byId('notifications-menu-button')) {
  byId('notifications-menu-button').on('click', () => {
    var was_pinned = ('true' == stored.WGS_notifications);
    (was_pinned) ? notifications_unpin() : notifications_pin();
  });
}

if (byId('qnote-menu-button')) {
  byId('qnote-menu-button').on('click', () => {
    var was_pinned = ('true' == stored.WGS_quicknotes);
    (was_pinned) ? quicknotes_unpin() : quicknotes_pin();
  });
}

if (byId('bookmarks-button'))
  byId('bookmarks-button').on('click', hideAllBoxes);
if (byId('settings-button'))
  byId('settings-button').on('click', hideAllBoxes);


function hideAllBoxes() {
  boxesHiders.forEach(function (boxhider) {
    boxhider(10);
  });
}

window.refreshToolbar = refreshToolbar;
window.initToolbarNotifications = initToolbarNotifications;
window.initToolbarQuickNotes = initToolbarQuickNotes;

})();


(function () {
function createMouseTriangleTracker(opt) {
  var lastX = opt.startX;
  var lastY = opt.startY;
  if (opt.target) {
    var rect = opt.target.getBoundingClientRect();
    var height = opt.target.offsetHeight;
    opt.targetTop    = { x: rect.left, y: rect.top };
    opt.targetBottom = { x: rect.left, y: rect.top + height  };
  }
  if (!opt.targetTop || !opt.targetBottom)
    throw 'TriangleTracker: Nothing to track';
  var checkInterval, leaveTimeout;
  var currentX, currentY;
  function mousemove(e) {
    if (lastX == null && lastY == null) {
      lastX    = e.pageX;  
      lastY    = e.pageY; 
    }
    //lastX    = currentX;  
    //lastY    = currentY;
    currentX = e.pageX;  
    currentY = e.pageY; 
  }
  function onCheck() {
        //console.log('onCheck');

      if (lastX == null && lastY == null) return; // first check
      if (lastX == currentX && lastY == currentY) return; // first check
      var p     = { x: currentX, y: currentY };
      var lastP = { x: lastX,    y: lastY    };
      if (isPointInsideTriangle( p,   lastP, opt.targetTop, opt.targetBottom )) {
        return clearTimeout(leaveTimeout); // came back
      }
      leaveTimeout = setTimeout(afterLeaveTimeout, 100);
  }
  function start() {
    console.log('start');
    window.on('mousemove', mousemove);
    checkInterval = setInterval(onCheck, 50);
    return self;
  }
  function afterLeaveTimeout() {
                console.log('afterLeaveTimeout');

    if (opt.onLeave) opt.onLeave();
    destroy();
  }
  function destroy() {
            console.log('destroy');

    window.off('mousemove', mousemove);
    clearInterval(checkInterval);
    clearTimeout(leaveTimeout);
    if (opt.onDestroy) opt.onDestroy();
  }
  var self = {
    start:   start,
    destroy: destroy
  };
  return self;
}
function isPointInsideTriangle(p, p1, p2, p3) {
  var alpha = ((p2.y - p3.y)*(p.x - p3.x) + (p3.x - p2.x)*(p.y - p3.y)) /
          ((p2.y - p3.y)*(p1.x - p3.x) + (p3.x - p2.x)*(p1.y - p3.y));
  var beta = ((p3.y - p1.y)*(p.x - p3.x) + (p1.x - p3.x)*(p.y - p3.y)) /
         ((p2.y - p3.y)*(p1.x - p3.x) + (p3.x - p2.x)*(p1.y - p3.y));
  var gamma = 1.0 - alpha - beta;
  var inside = alpha > 0 && beta > 0 && gamma > 0;
  return inside;
}
window.createMouseTriangleTracker = createMouseTriangleTracker;
})();
