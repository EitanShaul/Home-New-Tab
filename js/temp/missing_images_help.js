
// "filesystem:chrome-extension://medcogigaddopcmahlhefiiabkklihoa/persistent/not-existing.png";

function show_missing_images_badge() {
  var el = document.createElement('div');
  el.id = 'missing-images-help';
  el.className = 'helpful-message clickable';
  el.innerHTML = 'missing images?';
  el.style.cursor = 'pointer';
  el.onclick = show_missing_images_detailed_help;
  byId('search-form').appendChild(el);
}

function hide_missing_images_badge() {
  var el = byId('missing-images-help');
  if (el) el.remove();
}

function show_missing_images_detailed_help() {
  hide_missing_images_badge();
  stored.missing_images_help_shown = 'true';
  stored.missing_images_help_shown_date = Date.now();
  window.location = "/pages/questions.html#missing-images";
}

