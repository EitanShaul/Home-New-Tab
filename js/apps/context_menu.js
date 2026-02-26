
//
// Context menu
//

var context_menu = $('.context-menu')[0];
context_menu.on("click", context_click);

function context_click(e) {
  var id = context_menu.dataset.appid;
  var action = e.target.innerHTML;
  var className = e.target.className;
  var app = apps[id];
  var appLaunchUrl = turn_tags_in_url(app.appLaunchUrl);
  if (id) {
    if (className == 'context-app-name' || className == 'context-app-new-tab') {
      chrome.tabs.create({ 'url': appLaunchUrl, active: false });
    }
    else if (action == "Options") {
      if (app.optionsUrl)
        chrome.tabs.create({ 'url': app.optionsUrl });
    }
    else if (action == "Hide") {
      bg_call('hideChromeApp', id);
      remove_app_el(id);
    }
    else if (action == "Remove") {
      hide_context_menu();
      var after_uninstall = function (uninstalledId) {
          if (id != uninstalledId) return;
          bg_call('onUninstalled', id);
          remove_app_el(id);
          //window.location.hash = '#page=' + get_current_page();
          //location.reload();
      }
      if (is_chrome_app_id(id)) {
        chrome.management.onUninstalled.addListener(after_uninstall);
        chrome.management.uninstall(id);
      } else { // build in Home New Tab apps
        //if (id.indexOf('user_app') != -1 ) 
        if (confirm('Remove "' + apps[id].name + '"?')) 
          after_uninstall(id);
      }
    }  
    else if (action == "Edit") {
      hide_context_menu();
      show_new_app_panel(function (iframe) {
        iframe.addEventListener('load', function () {
          var msg = {name: 'startEditingApp', app: app};
          iframe.contentWindow.postMessage(msg, '*');
        });
      }, 'edit');
    }
  }
}

function is_chrome_app_id(id) {
  return /^[a-z]{32}$/.test(id);
}

function closestClass(el, className) {
  do {
    if (el.classList && el.classList.contains(className)) 
      return el;
  } while ((el = el.parentNode));
}

var context_menu_mouse_blocker; 

function on_context_menu(e) {
  //if (e.button != RIGHT_BUTTON) return; causes issues where LEFT buttons is reported (Allie)
  load_context_menu_css();
  // it was a click on an icon
  var el = closestClass(e.target, 'test-item');
  if (el) {
    var app = apps[el.id];
    var isUserApp = app.id.indexOf('user_app') != -1;
    var isChromeApp = app.id.length == 32;
    context_menu.dataset.appid = el.id;
    context_menu.innerHTML = '' +
      //'<li class="context-app-name">'+ app.name +'</li>' +
      '<li class="context-app-name">Open in New Tab</li>' +
      (app.optionsUrl ? '<hr /><li>Options</li>' : '') +
      //'<li class="disabled">Hide</li>' +
      '<hr />' +
      (isUserApp ? '<li>Edit</li>' : '') +
      (isChromeApp ? '<li>Hide</li>' : '') +
      '<li>Remove</li>';


    context_menu.style.left = oddifyNum(e.pageX) + 'px';
    context_menu.style.top  = oddifyNum(e.pageY) + 'px';
    loadPanelsCSS(); // because of Edit button
    setTimeout(show_context_menu, 1);
    e.preventDefault();
  } else {
    hide_context_menu();
  }
}

// fix windows non-retina display alising problems
function oddifyNum(n) { return (n % 2 == 0) ? n + 1 : n; }

/*
function get_context_mouse_blocker() {
  var overlay = document.querySelector('.context-menu-mouse-blocker');
  if (overlay) return overlay;
  var overlay = document.createElement('div');
  overlay.className = 'context-menu-mouse-blocker fit';
  document.body.appendChild(overlay);
  return overlay;
}
*/

function hide_context_menu() {
  context_menu.style.webkitTransition = "opacity .2s ease-out";
  context_menu.style.opacity = 0;
  setTimeout(function(){
    context_menu.style.display = "none";
  }, 200);
  //get_context_mouse_blocker().style.display = 'none';
}

function show_context_menu() {
  context_menu.style.webkitTransition = "";
  context_menu.style.opacity = 1;
  context_menu.style.display = "block";
  //get_context_mouse_blocker().style.display = 'block';
}

document.on("click", hide_context_menu);
document.on("keydown", hide_context_menu);
