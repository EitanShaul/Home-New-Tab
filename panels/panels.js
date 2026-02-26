// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

(function () {

//
// New User App
//

var panel;
var LEFT_MOUSE_BUTTON = 0;

function prepare_new_app_panel(hash) {
  if (panel) return panel;
  panel = document.createElement('iframe');
  panel.id = 'new-app-panel';
  panel.className = 'hidden';
  panel.onload = function () {
    addEscHandler(hide_new_app_panel, panel.contentWindow, true);
  };
  panel.src = '/panels/new_app/new_app_panel.html#' + (hash||'');
  document.body.appendChild(panel);
  return panel;
}

function show_new_app_panel(callback, prepareArgs) {
  prepare_new_app_panel(prepareArgs);
  loadPanelsCSS();
  panel.style.webkitAnimation = '';
  //clearTimeout(hide_new_app_panel.timer);
  setTimeout(function () {
    panel.focus();
    panel.className = '';
    window.on('click', hide_new_app_panel);
    if ('function' == typeof callback) callback(panel);
  }, 10)
}

function hide_new_app_panel() {
  var panel_to_remove = panel;
  if (!panel_to_remove) return;
  panel = null;
  panel_to_remove.className = 'hidden';
  stopAndRemoveAnimation(panel_to_remove);
  hide_new_app_panel.timer = setTimeout(function () {
    panel_to_remove.remove();
  }, 1000);
  window.off('click', hide_new_app_panel);
  document.querySelector('[autofocus]').focus();
}

/*//inside main
byId('add-app-button').on('click', show_new_app_panel);
byId('add-app-button').on('mouseenter', loadPanelsCSS);
byId('add-app-button').on('mouseenter', bindNextTick(prepare_new_app_panel));
if (byId('webstore')) {
  byId('webstore').on('click', function (e) { 
    if (e.button != LEFT_MOUSE_BUTTON) return;
    e.stopPropagation(); 
    show_new_app_panel(); 
  });
}
*/

window.show_new_app_panel = show_new_app_panel;
window.prepare_new_app_panel = prepare_new_app_panel;

//
// Change background
//

function prepare_background_settings_panel() {
  var el = document.createElement('iframe');
  el.id = 'background-setting-panel';
  el.className = 'hidden';
  el.onload = function () {
    addEscHandler(hide_background_settings_panel, el.contentWindow, true);
  }; 
  el.src = '/panels/background/background_panel.html';
  document.body.appendChild(el);
  return el;
}

function show_background_settings_panel() {
  loadPanelsCSS();
  var el = byId('background-setting-panel') ||
           prepare_background_settings_panel();
  clearTimeout(hide_background_settings_panel.timer);
  el.style.webkitAnimation = '';
  //el.onload = el.focus.bind(el);
  setTimeout(function () {
    el.focus();
    el.className = '';
    window.on('click', hide_background_settings_panel);
  }, 10)
}

function hide_background_settings_panel() {
  var el = byId('background-setting-panel');
  if (!el) return;
  el.className = 'hidden';
  stopAndRemoveAnimation(el);
  hide_background_settings_panel.timer = setTimeout(function () {
    el.remove();
  }, 1000);
  window.off('click', hide_background_settings_panel); 
  document.querySelector('[autofocus]').focus();
}

/* //inside main
byId('background-button').on('click',      show_background_settings_panel);
byId('background-button').on('mouseenter', loadPanelsCSS);
byId('background-button').on('mouseenter', bindNextTick(prepare_background_settings_panel));
*/

function handleBackgroundImageMessages(message) {
  if ('setBackgroundStyle' == message.name) {
    settings.background_style = message.content;
    change_background_style();
  }
  if ('setBackgroundImage' == message.name) { 
    settings.background_image  = message.content;
    settings.background_filter = message.filter;
    change_background(false, .7);  
    /*// we temporarily set the user selected image to show him a preview
    change_background(true);
    // but save_new_background does the saving and corrects the settings
    bg_call('save_new_background', event.data.content);*/
  }
}
window.handleBackgroundImageMessages = handleBackgroundImageMessages;

//chrome.runtime.onMessage.addListener(handleBackgroundImageMessages); //inside main

window.hide_new_app_panel = hide_new_app_panel;
window.hide_background_settings_panel = hide_background_settings_panel;

window.show_background_settings_panel = show_background_settings_panel;
window.prepare_background_settings_panel = prepare_background_settings_panel;

//
// Bookmarks
//

var bm_panel, bm_wrapper;

function prepare_bookmarks_panel() {
  if (bm_wrapper) return bm_wrapper;
  bm_wrapper = document.createElement('div');
  bm_wrapper.id = 'bookmarks-wrapper';
  bm_wrapper.className = 'frostable hidden';
  bm_wrapper.style.display = 'none';
  bm_panel = document.createElement('iframe');
  bm_panel.id = 'bookmarks-panel';
  bm_panel.className = 'fit100';
  //bm_panel.className = 'hidden';
  //bm_panel.style.display = 'none';
  bm_panel.onload = function () {
    addEscHandler(hide_bookmarks_panel, bm_panel.contentWindow, true);
  }; 
  bm_panel.src = '/panels/bookmarks/bookmarks_panel.html';
  bm_wrapper.appendChild(bm_panel);
  document.body.appendChild(bm_wrapper);
  return bm_wrapper;
}

function show_bookmarks_panel(callback) {
  prepare_bookmarks_panel();
  loadPanelsCSS();
  bm_wrapper.style.display = '';
  bm_wrapper.style.webkitAnimation = '';
  //clearTimeout(hide_bookmarks_panel.timer);
  bm_panel.blur();
  setTimeout(function () {
    bm_panel.focus();
    bm_wrapper.classList.remove('hidden');
    window.on('click', hide_bookmarks_panel);
    if ('function' == typeof callback) callback(bm_wrapper, bm_panel);
  }, 10);
  byId('bookmarks-button').classList.add('active');
}

function hide_bookmarks_panel() {
  var panel_to_remove = bm_wrapper;
  if (!panel_to_remove) return;
  bm_wrapper = bm_panel = null;
  panel_to_remove.classList.add('hidden');
  stopAndRemoveAnimation(panel_to_remove);
  hide_bookmarks_panel.timer = setTimeout(function () {
    panel_to_remove.remove();
  }, 1000);
  panel_to_remove.on('webkitTransitionEnd', () => { 
    if (0 == Number(panel_to_remove.style.opacity)) {
      panel_to_remove.remove();
      clearTimeout(hide_bookmarks_panel.timer);
    }
  });
  window.off('click', hide_bookmarks_panel);
  byId('bookmarks-button').classList.remove('active');
  document.querySelector('[autofocus]').focus();
}

/*//inside main
byId('bookmarks-button').on('click', show_bookmarks_panel);
byId('bookmarks-button').on('mouseenter', loadPanelsCSS);
byId('bookmarks-button').on('mouseenter', bindNextTick(prepare_bookmarks_panel));
if (byId('bookmarks')) {
  byId('bookmarks').on('click', function (e) { 
    if (e.button != LEFT_MOUSE_BUTTON) return;
    e.stopPropagation(); 
    show_bookmarks_panel(); 
  });
}
*/
window.show_bookmarks_panel = show_bookmarks_panel;
window.prepare_bookmarks_panel = prepare_bookmarks_panel;


//
// Options
//

var opt_panel, opt_wrapper;

function prepare_options_panel() {
  if (opt_wrapper) return opt_wrapper;
  opt_wrapper = document.createElement('div');
  opt_wrapper.id = 'options-wrapper';
  opt_wrapper.className = 'frostable hidden';
  opt_wrapper.style.display = 'none';
  opt_panel = document.createElement('iframe');
  opt_panel.id = 'options-panel';
  opt_panel.className = 'fit100';
  //opt_panel.className = 'hidden';
  //opt_panel.style.display = 'none';
  opt_panel.onload = function () {
    addEscHandler(hide_options_panel, opt_panel.contentWindow, true);
  }; 
  opt_panel.src = '/panels/options/options_panel.html';
  opt_wrapper.appendChild(opt_panel);
  document.body.appendChild(opt_wrapper);
  return opt_wrapper;
}

function show_options_panel(callback) {
  if (callback && callback.preventDefault) callback.preventDefault();
  prepare_options_panel();
  loadPanelsCSS();
  opt_wrapper.style.display = '';
  opt_wrapper.style.webkitAnimation = '';
  //clearTimeout(hide_options_panel.timer);
  opt_panel.blur();
  setTimeout(function () {
    opt_panel.focus();
    opt_wrapper.classList.remove('hidden');
    window.on('click', hide_options_panel);
    if ('function' == typeof callback) callback(opt_wrapper, opt_panel);
  }, 10);
  byId('settings-button').classList.add('active');
}

function hide_options_panel() {
  var panel_to_remove = opt_wrapper;
  if (!panel_to_remove) return;
  opt_wrapper = opt_panel = null;
  panel_to_remove.classList.add('hidden');
  stopAndRemoveAnimation(panel_to_remove);
  hide_options_panel.timer = setTimeout(function () {
    panel_to_remove.remove();
  }, 1000);
  panel_to_remove.on('webkitTransitionEnd', () => { 
    if (0 == Number(panel_to_remove.style.opacity)) {
      panel_to_remove.remove();
      clearTimeout(hide_options_panel.timer);
    }
  });
  window.off('click', hide_options_panel);
  byId('settings-button').classList.remove('active');
  document.querySelector('[autofocus]').focus();
}

/*//inside main
byId('settings-button').on('click', show_options_panel);
byId('settings-button').on('mouseenter', loadPanelsCSS);
byId('settings-button').on('mouseenter', bindNextTick(prepare_options_panel));
if (byId('settings')) {
  byId('settings').on('click', function (e) { 
    if (e.button != LEFT_MOUSE_BUTTON) return;
    e.stopPropagation(); 
    show_options_panel(); 
  });
}
*/
window.show_options_panel = show_options_panel;
window.prepare_options_panel = prepare_options_panel;


//
// AI Chat
//

var ai_panel, ai_wrapper;

function ai_search_send_term(term) {
  ai_panel.contentWindow.postMessage({
    type: 'start-chat',
    term: term
  }, '*');
}

function prepare_ai_chat_panel() {
  if (ai_wrapper) return ai_wrapper;
  
  ai_wrapper = document.createElement('div');
  ai_wrapper.id = 'ai-chat-wrapper';
  ai_wrapper.className = 'frostable hidden';
  ai_wrapper.style.display = 'none';

  const style = document.createElement('style');
  style.textContent = get_ai_chat_css();
  ai_wrapper.appendChild(style);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.className = 'panel-close-button';
  closeButton.innerHTML = '×'; // Using × character instead of font icon for simplicity
  closeButton.onclick = (e) => {
    e.stopPropagation();
    hide_ai_chat_panel();
  };
  
  ai_panel = document.createElement('iframe');
  ai_panel.id = 'ai-chat-panel';
  ai_panel.className = 'fit100';
  ai_panel.src = '/panels/ai/ai_panel.html';
  ai_panel.style.border = 'none';
  ai_panel.onload = function () {
    addEscHandler(hide_ai_chat_panel, ai_panel.contentWindow, true);
  }; 

  //ai_wrapper.appendChild(closeButton);
  ai_wrapper.appendChild(ai_panel);
  document.body.appendChild(ai_wrapper);
  
  return ai_wrapper;
}

function show_ai_chat_panel(term, callback) {
  prepare_ai_chat_panel();
  loadPanelsCSS();

  
  ai_panel.addEventListener('load', () => ai_search_send_term(term), {once: true});
  //if (ai_panel.contentWindow.document.readyState === 'complete') {
  //  ai_search_send_term(term);
  //}
  
  ai_wrapper.style.display = '';
  ai_wrapper.style.webkitAnimation = '';
  
  ai_panel.blur();
  setTimeout(function () {
    ai_panel.focus();
    ai_wrapper.classList.remove('hidden');
    window.on('click', hide_ai_chat_panel);
    if ('function' == typeof callback) callback(ai_wrapper, ai_panel);
  }, 10);
  
  //byId('ai-chat-button').classList.add('active');
}

function hide_ai_chat_panel() {
  var panel_to_remove = ai_wrapper;
  if (!panel_to_remove) return;
  
  ai_wrapper = ai_panel = null;
  panel_to_remove.classList.add('hidden');
  stopAndRemoveAnimation(panel_to_remove);
  
  hide_ai_chat_panel.timer = setTimeout(function () {
    panel_to_remove.remove();
  }, 1000);
  
  panel_to_remove.on('webkitTransitionEnd', () => { 
    if (0 == Number(panel_to_remove.style.opacity)) {
      panel_to_remove.remove();
      clearTimeout(hide_ai_chat_panel.timer);
    }
  });
  
  window.off('click', hide_ai_chat_panel);
  //byId('ai-chat-button').classList.remove('active');
  document.querySelector('[autofocus]').focus();
}

function get_ai_chat_css() {
  return `
  body {
    transition: background-color .3s ease;
    background-color: #999;
  }
  #page {
    transition: filter .3s ease, opacity .3s ease;
    filter: brightness(0.5);
    opacity: .7;
  }
  `;
}

// Export functions to window
window.show_ai_chat_panel = show_ai_chat_panel;
window.prepare_ai_chat_panel = prepare_ai_chat_panel;
window.hide_ai_chat_panel = hide_ai_chat_panel;


//
// Voice Search
//

function prepare_speech_panel() {
  var el = document.createElement('iframe');
  el.src = '/panels/speech/speech_panel.html';
  el.id = 'speech-panel';
  el.className = 'hidden';
  document.body.appendChild(el);
  return el;
}

function show_speech_panel() {
  var el = byId('speech-panel') || prepare_speech_panel();
  clearTimeout(hide_speech_panel.timer);
  setTimeout(function () {
    el.focus();
    el.className = '';
    window.on('click', hide_speech_panel);
  }, 10)
}

function hide_speech_panel() {
  var el = byId('speech-panel');
  if (!el) return;
  el.className = 'hidden';
  el.remove();
  window.off('click', hide_speech_panel);
}

window.on('message', function () {
  if ('speechSearchEnded' == event.data.name) {
    hide_speech_panel();
    byId('search-input').value = event.data.content;
    byId('search-button').click();
  } 
  else if ('speechClose' == event.data.name) {
    hide_speech_panel();
  }
});

//byId('microphone-button').onmouseenter = bindNextTick(prepare_speech_panel);
byId('microphone-button').on('mousedown', prepare_speech_panel);
byId('microphone-button').on('click', show_speech_panel);
byId('microphone-button').on('mouseenter', loadPanelsCSS);


//
// Animation
//

function stopAndRemoveAnimation(el) {
  var trafo = getComputedStyle(el, null).webkitTransform;
  el.style.webkitTransform = trafo;
  el.style.webkitAnimation = 'none';
  setTimeout(function () {
    el.style.webkitTransform = '';
  }, 1)
}


var frames = [
  ['0', 110.00000000000001],
  ['30', -2.571428571428564],
  ['35', -2.295238095238097],
  ['40', 0],
  ['45', 1.2571428571428577],
  ['50', 1.2190476190476199],
  ['55', 0],
  ['60', -0.7509523809524043],
  ['65', -0.51904761904763],
  ['70', 0],
  ['75', 0.459523809523815],
  ['80', 0.2547619047618964],
  ['85', 0],
  ['90', -0.2723809523809593],
  ['95', -0.1623809523809593],
  ['100', 0]
];

var hwAccel = ' translateZ(0)';

function startAnimation(el, xy, allDuration) {
  var myFrames = frames.slice(); // static copy

  var previousFrame;

  // every other keyframe
  function onKeyFrame() {
    currentFrame = myFrames.shift();

    if (previousFrame) {
      var duration = allDuration * (currentFrame[0]-previousFrame[0]) / 100;
      el.style.webkitTransition = '-webkit-transform '+ duration +'ms'; // ease-in-out
    } else {
      el.style.webkitTransition = ''; 
    }

    el.style.webkitTransform = 'translate(' + currentFrame[1] + '%, 0%)' + hwAccel;

    var nextFrame = myFrames[0];
    if (nextFrame) {
      var delay = allDuration * (nextFrame[0]-currentFrame[0]) / 100;
      setTimeout(onKeyFrame, delay);
    }

    previousFrame = currentFrame;
  }

  onKeyFrame();
}

function loadPanelsCSS() {
  if (byId('panels-css')) return;
  var css  = document.createElement('link');
  css.id   = 'panels-css';
  css.rel  = 'stylesheet';
  css.type = 'text/css';
  css.href = 'css/panels.css';
  document.head.appendChild(css);
}
if (!window.loadPanelsCSS)
  window.loadPanelsCSS = loadPanelsCSS;

})();
