(function () {

function background_button_hover() {
  clearTimeout(timer);
  timer = setTimeout(function () {
    byId('page-gradient').style.opacity = 0;
  }, 1000); 
}

if (byId('background-button')) {
  var timer;
  byId('background-button').on('mouseenter', background_button_hover);
  byId('background-button').on('mouseleave', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      byId('page-gradient').style.opacity = 1;
    }, 200);
  });
}

window.background_button_hover = background_button_hover;

})();

/*
function button_with_included_js(button, onClick, onMouseEnter) {
  if (onClick) button.on('click', onClick);
  button.on('mouseenter', function once() {
    button.off('mouseenter', once);
    if (onMouseEnter) onMouseEnter();
  });
}
*/