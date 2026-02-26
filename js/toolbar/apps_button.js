
//
// Apps in Focus mode
//

var apps_bg_image_url = '/img/backgrounds/13.jpg';
var appsOverlayRemoveEscHandler;

function on_apps_button_click(e) {

  byId('apps-slider').style.background = 'transparent';
  
  //window.on('mousedown', on_mousedown);
  //window.on('mouseup', on_mouseup);

  //if (byId('apps-wrapper').style.display == 'block') {
  if (byId('apps-wrapper').style.opacity > 0) {
    return hide_apps_overlay();
  }

  function hide_apps_overlay() {
    //byId('apps-wrapper').style.display = 'none';  
    byId('add-app-button').style.display = 'none';
    //byId('datetime').style.display = 'block';
    byId('apps-button').classList.remove('active');

    byId('page-bg-base').style.opacity = null; // back to default
    byId('apps-wrapper').style.opacity = 0;
    byId('apps-wrapper').style.height = '';
    byId('apps-wrapper').style.visibility = 'hidden';
    byId('apps-wrapper').style.transform = '';

    byId('focus-today').style.opacity = 1;
    byId('focus-today').style.pointerEvents = '';

    byId('datetime').style.opacity = 1;
    byId('datetime').style.pointerEvents = '';

    //show(byId('datetime'));
    window.off('mousedown', on_mousedown);
    window.off('mouseup', on_mouseup);
    if (appsOverlayRemoveEscHandler) appsOverlayRemoveEscHandler();
    return;
  }
  //init_app_slider_bg(); // comment this out for simple mode

  appsOverlayRemoveEscHandler = addEscHandler(hide_apps_overlay);

  //byId('apps-wrapper').style.pointerEvents = '';
  byId('apps-wrapper').style.visibility = 'visible';  
  byId('apps-wrapper').style.height = 'auto';  
  byId('add-app-button').style.display = 'block';
  //byId('datetime').style.display = 'none';
  byId('apps-button').classList.add('active');
  byId('page-bg-base').classList.add('anim');
  byId('page-bg-base').style.opacity = .7;

  //hide(byId('datetime'));

  byId('focus-today').style.opacity = 0;
  byId('focus-today').style.pointerEvents = 'none';

  byId('datetime').style.opacity = 0;
  byId('datetime').style.pointerEvents = 'none';
  //byId('apps-wrapper').style.willChange = 'opacity, transform';

  //setTimeout(function () {
    byId('apps-wrapper').style.opacity = 1; // scale needed cause of img % width
    byId('apps-wrapper').style.transform = 'translateX(-50%) scale(0.99)';
  //}, 1); // scale(0.99) 

  // look for drag inside #apps-slider, close if not moved enough to drag
  // outside #apps-slider even mousedown makes it disappear

  var mouseX, mouseY;
  function on_mousedown(e) { 
    if (e.button != LEFT_BUTTON ||  
        e.target.closest('.test-item') ||
        e.target.closest('#apps-button') ||
        e.target.id == 'add-app-button' ||
        $('.context-menu')[0].style.display != 'none') 
      return true;
    if (!e.target.closest('#apps-slider')) 
      return hide_apps_overlay();
    mouseX = e.pageX, mouseY = e.pageY; 
  }
  function on_mouseup(e) {
    if (distance(mouseX, mouseY, e.pageX, e.pageY) < 10) 
      hide_apps_overlay();
  }
  function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  }

  apps_init_once();
}

//byId('apps-button').on('mouseenter', init_app_slider_bg);
function show(el) {
  el.classList.remove('fade-anim');
  el.offsetTop; // force restyle
  el.classList.add('fade-anim');
  el.classList.remove('fade-hide');
  el.classList.add('fade-show');
}
function hide(el) {
  el.classList.remove('fade-anim');
  el.offsetTop; // force restyle
  el.classList.add('fade-anim');
  el.classList.remove('fade-show');
  el.classList.add('fade-hide');
}

// other version: make slider bg the settings.background_image, 
//                make apps-slider ratain .2 opacity bg color
function init_app_slider_bg() {
  var slider_bg = byId("apps-slider-bg");
  if (slider_bg) {
    slider_bg.style.display = 'block';
    return;
  }
  slider_bg = document.createElement('div');
  slider_bg.id = "apps-slider-bg";
  slider_bg.className = 'fit';
  slider_bg.style.backgroundImage = 'url(' + apps_bg_image_url + ')';
  (new Image).src = apps_bg_image_url; // preload
  byId('apps-slider').appendChild(slider_bg);
  return slider_bg;
}

