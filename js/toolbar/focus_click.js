
function on_focus_click() {
  change_options(function (settings_new) {
      settings_new.focus_mode = !settings.focus_mode;
  });
  update_focus_button_title();
  if (settings.focus_mode) {
    document.documentElement.classList.add('focus');
    requestAnimationFrame(function () {
      if (!stored.FOC_input)
        byId('focus-today-input').focus();
    });
    refreshToolbar();
    refresh_date();
  } else {
    location.reload();
    // in-app refresh would need more work (e.g. icons are not positioned)
    //document.documentElement.classList.remove('focus'); 
  }
}
