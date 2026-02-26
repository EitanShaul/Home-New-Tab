
//
// Draggable
//

// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

// kell több items []
// drag oldal váltás lapozáskor
// ordered i,i,i,i;i,i,i,,,;
// átrendezés lapok között
// méretezés általánosítása
// új temp. oldal grab-kor

var DRG = {};
DRG.log = function () {}; // console.log;

(function(){

var item_width, item_height, rows, cols, root, root_width, root_height,
    items, target, ghost, drag_item_x, drag_item_y, store_timer,
    target_index, page, dots;
;
var margin = 10;
var cols = 5; //5; 7;f
var rows = 4; //4; 3;
var page_margin = 160; //160; 100
var page_width  = 0; //680; 740; 1036  calculated when we know item_width
var page_height = 0;
var mouse_is_moving = false;
var apply_container_width = false;
var default_root_width = 4000;

var page_height_max_fn; //  overrides percentage and absolute maxes if set
var page_width_max, page_height_max; // these override percentage maxes if set
var page_width_percent = 0.8;
var page_height_max_percent = 0.8;
//var margin_percent = 0.1;
var icon_width_percent = 0.7;

function apply_options(opt) {
  opt = opt || {};
  if (opt.rows != null) rows = opt.rows;
  if (opt.cols != null) cols = opt.cols;
  if (opt.margin != null) margin = opt.margin;
  if (opt.page_margin != null) page_margin = opt.page_margin;
  if (opt.apply_container_width != null) apply_container_width = opt.apply_container_width;
  if (opt.page_width_max != null) page_width_max = opt.page_width_max;
  if (opt.page_height_max != null) page_height_max = opt.page_height_max;
  if (opt.page_height_max_fn != null) page_height_max_fn = opt.page_height_max_fn;
  if (opt.icon_width_percent != null) icon_width_percent = opt.icon_width_percent;
  if (opt.page_height_max_percent != null) page_height_max_percent = opt.page_height_max_percent;
}

function init(opt) {

  if (init.wasCalled) return;
  init.wasCalled = true;

  apply_options(opt);

  root = byId('apps-pages-list');
  page = byId('page');
  dots = byId('apps-dots');
  mouse_overlay = byId("mouse-move-overlay");

  dots.on("mouseover", dots_mouseover);
  dots.on("mouseout", dots_mouseout);

  // use a static copy of item list
  // but make sure to keep it up to date when using ghost item
  items = [].slice.call($('.test-item', root));

  if (!stored.icons_order)
    calculate_order();

  calculate_grid(false, function write_block() {
    load_lazy_images_on_page(0);
  }); // !!stored.app_html_webstore

  // resize event may change icon size (but not the structure)
  last_window_width = window.innerWidth;
  window.on("resize", onresize);

  // scroll event handlers
  root.on('mousewheel', onscroll);
  document.on("keydown", onkeydown);
  document.on("keyup", onkeyup);

  // show new item on install (last page)
  if (window.location.hash == "#last") {
    window.location.hash = "";
    setTimeout(go_last_page, 500);
  } else if (window.location.hash.indexOf("#page=") != -1) {
    var pageToGo = window.location.hash.split('=')[1];
    window.location.hash = "";
    setTimeout(function () { switch_page(pageToGo); }, 500);
  }

  // append as many handler "dots" as pages
  refresh_dots();

  // possible drag start
  root.onmousedown = function(e) {
    // only need left mouse button
    if (e.button != 0) return;
    var target = e.target;
    //var launcher = target.closest('.test-item-launcher');
    //if (!launcher) return;

    var item = target.closest('.test-item');
    if (!item) return;

    var previousGhost = document.getElementsByClassName('ghost')[0];
    previousGhost && previousGhost.classList.remove('ghost');

    // it was a click on an icon
    //if (target.nodeName != 'IMG' && !/^cal/.test(target.id)) return; //!
    // don't want the image to be dragged by Chrome
    e.preventDefault();
    // select the item containing the icon
    ///var item = launcher.parentNode; //! launcher version
    // save mouse offset on item
    // Note: add target offset because we drag by img, not whole tile
    var item_pos = item.getBoundingClientRect();
    drag_item_x  = e.pageX - item_pos.left //e.offsetX //+ target.offsetLeft; //!
    drag_item_y  = e.pageY - item_pos.top  //e.offsetY //+ target.offsetTop;  //! 
    // drag starts on the first mousemove
    var mouse_move_before_drag = function (e) {
      // note: getting el offset is slow, but this is only for small movements
      var moved_pos_item_x = e.pageX - item_pos.left //+ target.offsetLeft;   //! 
      var moved_pos_item_y = e.pageY - item_pos.top //+ target.offsetTop;    //! 
      // micro movements are still clicks
      if (distance(drag_item_x, drag_item_y, moved_pos_item_x, moved_pos_item_y) < 10)  //! 
        return;
      // stop micromovement tracking
      //!item.onmousemove = null;
      document.off('mousemove', mouse_move_before_drag); 
      // find out the items index
      var index = get_cell_index_at(e.pageX, e.pageY);
      // start dragging
      grab(index, e);
      // if we moved enough it was a drag,
      // everybody else should NOT see a regular 'click' event
      // 'mouseup' events still fire for everybody (we use it inside grab too)
      document.on('mouseup', function after_drag_complete() {
        // prevent other's click events because drag happened
        e.stopPropagation();
        document.off('mouseup', after_drag_complete);
      });
    }
    // track possible drag start
    document.on('mousemove', mouse_move_before_drag); 
    // when click happens without movement
    document.on('mouseup', function cleanup_after_any_drag() {
      document.off('mouseup',   cleanup_after_any_drag);
      document.off('mousemove', mouse_move_before_drag); 
    });
  }

  return {
    recalc: function(rows_in, cols_in) {
      if (rows_in) rows = rows_in;
      if (cols_in) cols = cols_in;
      calculate_grid();
    }
  };
}

function refresh_dots() {
  // append as many handler "dots" as pages
  var dots_count = $('span', dots).length;
  var dots_to_insert = get_page_count() - dots_count;
  for (var i = 0; i < dots_to_insert; i++) { // don't count down, can be -1
    dots.insertAdjacentHTML("beforeend", "<span></span>");
  }
  dots.style.visibility =  (get_page_count() < 2) ? "hidden" : "";
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}

function calculate_order() {
  var arr = [];
  for (var i = 0; i < items.length; i++) {
    arr.push(items[i].id);
  }
  stored.icons_order = arr.join(',');
}

/// TODO: only recalc. if things have changed
function calculate_grid(cached, write_block) {

  if (!init.wasCalled) return init();

  // delay if we were too fast and not everything's been painted yet
  if (!window.innerWidth) {
    setTimeout(function() {
      calculate_grid(cached);
    }, 10);
    return;
  }

  if (!root.firstElementChild) {
    log_bug_drag.send();
  }

  // 142 text, 120 img, 2x16 text-text marg-h (2x27 img-img marg-h), 

  // read everything that might trigger reflow 
  // (dom sizes and positions of elements)
  root_width  = root.clientWidth || default_root_width;
  //root_height = root.clientHeight;
  var dots_height = dots.offsetHeight;
  //item_width  = root.firstElementChild.clientWidth;
  //item_height = root.firstElementChild.clientHeight;

  ///d
  var page_width_temp = window.innerWidth * page_width_percent;
  var page_width_max_temp = Math.min(page_width_temp, page_width_max || Infinity);

  if (!apply_container_width) {
    page_width_max_temp = byId('apps-wrapper').offsetWidth;
  }

  //margin = Math.floor(Math.floor(page_width_max_temp / cols) * 0.1);
  item_width  = Math.floor(page_width_max_temp / cols) - 2 * margin;
  item_height = Math.floor((102/96) * item_width);

  page_width  = cols * item_width  + (2 * cols) * margin;
  page_height = rows * item_height + (2 * rows) * margin;

  var page_height_temp = page_height_max_percent * window.innerHeight;

  if ('function' == typeof page_height_max_fn)
    page_height_temp = page_height_max_fn();
  var page_height_max_temp = Math.min(page_height_temp, page_height_max || Infinity);

  var dots_h_full = dots_height + 20;
  var page_height_full = page_height + dots_h_full; // includes dots

  if (page_height_full > page_height_max_temp) {
    var all_margins_v = (2 * rows) * margin;
    var icons_max_height = (page_height_max_temp - dots_h_full - all_margins_v);
    var icons_current_height = page_height - all_margins_v;
    var downsize = icons_max_height / icons_current_height;
    item_width  *= downsize;
    item_height *= downsize;
    page_width  = cols * item_width  + (2 * cols) * margin;
    page_height = rows * item_height + (2 * rows) * margin;
  }

  //for (var i = 0; i < items.length; i++) {
  //  items[i].style.width  = item_width  + 'px';
  //  items[i].style.height = item_height + 'px';
  //}

  //var iconw = icon_width_percent * 100; 
  var font = Math.floor(item_width*0.1); // 0.125
  font = Math.max(Math.min(font, 16), 13);
  var iconwhpx = item_width * icon_width_percent;

  var docStyle = document.documentElement.style;
  docStyle.setProperty('--item-size', item_width + 'px');
  docStyle.setProperty('--item-img-size', iconwhpx + 'px');
  docStyle.setProperty('--item-font-size', font + 'px');

 // css var(--draggable-margin) = '.test-item { margin: '+ margin +'px }';


  var page_full_width = page_width; //+ 2 * margin; but it's included in page_width now
  var wrapper_container_width = apply_container_width ? page_full_width + 'px' : ''; 
  var dots_top = page_height + 5;// + 30;

  byId('apps-slider').style.width  = page_full_width + 'px'; 
  byId('apps-wrapper').style.width = wrapper_container_width;
  dots.style.top = dots_top + 'px';

  byId('apps-slider').style.height = dots_top + dots_height + 20 + 'px'; 

  if ('function' == typeof write_block) write_block();

  if (cached) return;

  // power user wider than 10,000px slider
  var page_count = Math.ceil((Math.ceil(items.length / cols) / rows));
  //root.style.width = page_count * (page_width + page_margin) * 1.5 + 'px'; for everybody?
  var scroller_required_width = page_count * (page_width + page_margin) - page_margin;
  if (scroller_required_width > root_width)
    root.style.width = scroller_required_width + 'px';

  // calculate absolute positions
  for (var i = items.length; i--;) {
    var pos = get_cell_pos(i);
    var item = items[i];
    setPos(item, pos.left, pos.top);
  }

  ///
  /*
  setTimeout(function () {
    for (var i = items.length; i--;) {
      cache_set_app_html(item, item.outerHTML);
    }
  }, 500);
  */
  ///

  ensure_current_page_scroll();
  root.style.display = '';
}

function recalc_public(opt) {
  apply_options(opt);
  calculate_grid();
}

var resize_timer;
var last_window_width;

function onresize(e) {
  ///console.log(window.innerWidth  + " x " + window.innerHeight);
  //if (window.innerWidth == last_window_width) return;
  last_window_width = window.innerWidth;
  schedule_recalc();
}

function schedule_recalc(opt) {
  apply_options(opt);
  clearTimeout(resize_timer);
  resize_timer = setTimeout(calculate_grid, 100);
}


/**
 * Drag start.
 */
function grab(index, e) {

  ///if (index == -1) return;
  ////console.log("grab " + index + " : " + e.pageX + " , "  + e.pageY); ////
  mouse_is_moving = true;

  target = items[index];
  target_index = index;

  root.classList.remove('animated');

  // make a ghost copy for replacement
  ghost = target.cloneNode(true);
  ghost.classList.add('ghost');
  //ghost.style.visibility = 'hidden';

  // this event is initialized by the
  // first mousemove after mousedown
  // so we call mousemove for coordinates
  save_mouse_coordinates(e);
  update();

  // replace dragged item with a blank 'ghost'
  // replace in DOM
  root.replaceChild(ghost, target);
  // replace in static list
  items[index] = ghost;

  //target.style.left = ghost.offsetLeft + 'px';
  //target.style.top  = ghost.offsetTop  + 'px';

  // target item is removed from the list while dragging
  target.classList.add('dragged');
  page.appendChild(target);

  var next_move;
  var timer;
  var pager_timer;  
  //! var container_offset = root.parentNode.parentNode.offsetLeft;
  var container_offset = root.parentNode.parentNode.getBoundingClientRect().left;
  var mouse_x, mouse_y;

  /**
   * Do as little work on mouse move as we can
   */
  function save_mouse_coordinates(e) {
    mouse_x = e.pageX;
    mouse_y = e.pageY;
    // stop default dragging action
    e.preventDefault();
  }

  /**
   * Updates the dragged item (vsync)
   */
  function update() {

    if (!mouse_is_moving) return;

    // update dragged item coordinates
    setPos(target,
          (mouse_x - drag_item_x - margin),
          (mouse_y - drag_item_y - margin))

    // refresh list order after some delay
    //clearTimeout(timer);
    if (!timer) {
      timer = setTimeout(function () {
        timer = null;
        if (!pager_timer) {
          var center_x = mouse_x - container_offset - drag_item_x + item_width / 2;
          if (center_x < 10 || center_x > page_width) {
              pager_timer = setTimeout(function () {
                if (center_x < 10 && current_page != 0) {
                  go_previous_page_throttled();
                }
                else if (center_x > page_width - 10) {
                  go_next_page_throttled();
                }
                pager_timer = null;
              }, 500);
          }
        }
        // new index is where the mouse if pointing at
        var new_index = get_cell_index_at(mouse_x, mouse_y);
        //if (new_index != -1) {
          // do the reordering
          move(new_index, index);
          index = new_index;
        //}
      }, 30);
    }

    // go on while the mouse is still moving
    if (mouse_is_moving) requestAnimationFrame(update);
  }

  function mouseup(e) {
    // clean up
    mouse_is_moving = false;
    save_mouse_coordinates(e);
    update();
    clearTimeout(timer);
    document.off('mouseup', mouseup);
    mouse_overlay.style.display = "none";
    mouse_overlay.off('mousemove', save_mouse_coordinates);
    mouse_overlay.off('mousewheel', onscroll);
    release(e);
  }

  var mouse_overlay = byId("mouse-move-overlay");
  mouse_overlay.style.display = "block";

  document.on('mouseup', mouseup);
  mouse_overlay.on('mousemove', save_mouse_coordinates);
  mouse_overlay.on('mousewheel', onscroll);

  // start the dragging animation
  requestAnimationFrame(update);
}

/**
 * Drag end.
 */
function release(e) {

  ////console.log("release" + " : " + e.pageX + " , "  + e.pageY); ////

  // make return animation faster
  target.style.webkitTransitionDuration = ".15s, .10s, .15s, .15s";
  //target.style.webkitTransition = "transform .15s ease-out";

  // do the reordering
  var index = get_cell_index_at(e.pageX, e.pageY);

  // move everybody into their new place
  move(index, target_index);

  // change from on-screen position to in-list-element positions
  var root_pos = root.getBoundingClientRect();
  //target.style.left = e.pageX - root_pos.left + "px";
  //target.style.top  = e.pageY - root_pos.top  + "px";

  // send target to ghost's destination
  // (works even if ghost was still moving)
  setPos(target, root_pos.left + getLeft(ghost), root_pos.top + getTop(ghost));
  target.classList.remove('dragged');

  // after the animation ended
  target.on("webkitTransitionEnd", transitionEnd);
  var transitionTimeout = setTimeout(transitionEnd, 200);

  var releasedTarget = target;
  var releasedGhost  = ghost;

  function transitionEnd(e) {

    if (e && !/left|right/i.test(e.propertyName)) return;

    releasedTarget.off("webkitTransitionEnd", transitionEnd);
    clearTimeout(transitionTimeout);

    releasedTarget.style.webkitTransition = ""; // webkitTransitionDuration

    releasedTarget.remove();
    releasedGhost.classList.remove('ghost');

    //setPos(releasedTarget, getLeft(releasedGhost), getTop(releasedGhost));
    //releasedTarget.classList.remove('dragged');

    // replace back in DOM
    //root.replaceChild(releasedTarget, releasedGhost);

    // replace back in static list
    //items[index] = releasedTarget;

    // clean up
    //target = ghost = null;
  }

  // store icons order and cache htmls
  ghost.classList.remove('ghost');
  var list = [];
  for (var i = 0; i < items.length; i++) {
    list.push(items[i].id);        
    ///cache_set_app_html(items[i], items[i].outerHTML);
  }
  stored.icons_order = list.join(",");
  ghost.classList.add('ghost');


}

function get_cell_index_at(pageX, pageY) {
  // TODO: ignore coords out of the target zone
  //...

  // convert to in-element positions
  var root_pos = root.parentNode.getBoundingClientRect();
  var x = pageX - root_pos.left;
  var y = pageY - root_pos.top;

  // calculate cell position in grid
  var row = Math.floor(y / (item_height + 2 * margin))
  var col = Math.floor(x / (item_width  + 2 * margin));

  // ignore negative values
  col = Math.max(col, 0);
  row = Math.max(row, 0);

  var index = row * cols + col + (current_page * rows * cols);

  return Math.min(index, items.length - 1);///index < items.length ? index : -1;///Math.min(index, items.length - 1);///
}

function get_cell_pos(index) {
  var row = Math.floor(index / cols) % rows; // 0-1-2-3
  var col = index % cols;
  var page_index = Math.floor(index / (rows * cols));

  var top  = row * item_height + (2 * row) * margin;
  var left = col * item_width  + (2 * col) * margin + page_index * (page_width + page_margin);

  return {left: left, top: top};
}

function move(new_index, old_index) {

  if (new_index == old_index || new_index < 0) return;

  ////console.log("move : " + old_index + " -> " + new_index ); ////

  target_index = new_index;

  /// TODO: don't issue reorderings in parallel?
  /// cancel last one maybe?

  root.classList.remove('animated');

  var new_items = [];

  // create new list of items
  // (exact copy at first)
  for (var i = items.length; i--;) {
    new_items[i] = items[i];
  }

  // shift items to fill blank space
  // 2 possible directions
  var temp = new_items[old_index];

  if (new_index - old_index > 0) {
    for (var i = new_index; i > old_index; i--) {
      new_items[i-1] = items[i];
    }
  }
  else {
    for (var i = new_index; i < old_index; i++) {
      new_items[i+1] = items[i];
    }
  }

  new_items[new_index] = temp;

  root.classList.add('animated');

  // calculate new positions
  for (var i = new_items.length; i--;) {
    var pos = get_cell_pos(i);
    new_items[i].style.position = 'absolute';
    setPos(new_items[i], pos.left, pos.top);
  }

  items = new_items;
}

function remove_app_at(index) {
  var el_to_remove = items[index];
  //if (!el_to_remove) return;
  move(items.length - 1, index);
  el_to_remove.remove();
  items.pop();
}

function remove_app_el(el) {
  if ('string' == typeof el) el = byId(el);
  var index = items.indexOf(el);
  remove_app_at(index);
}

function load_lazy_images_on_page(page_idx) {
  var start_i = Math.min(page_idx * (rows * cols), items.length);
  var end_i   = Math.min((page_idx + 1) * (rows * cols), items.length);
  for (var i = start_i; i < end_i; i++) {
    items[i].style.display = '';
    var img = items[i].getElementsByTagName('img')[0];
    if (img && img.dataset.src) {
      img.src = img.dataset.src;
      img.dataset.src = '';
    }
  }
}

var current_page = 0;
var dots_timer;

function get_current_page() {
  return current_page;
}

function go_next_page() {
  if (current_page >= get_page_count() - 1) return;
  switch_page(current_page + 1);
}

function go_previous_page() {
  if (current_page <= 0) return;
  switch_page(current_page - 1);
}

function go_last_page() {
  switch_page(get_page_count() - 1);
}

function get_page_count() {
  return Math.floor((items.length - 1) / (cols * rows)) + 1;
}

var switch_page_transition_timeout;

function switch_page(index) {
  if (current_page == index) return;
  current_page = index;
  var pages = byId('apps-pages-list'), style = pages.style;
  var scroll_x = (-current_page * (page_width + page_margin));
  style.webkitTransform = "translate3d(" + scroll_x + 'px,0,0)';
  //style.webkitTransform = "translateX(" + scroll_x + 'px)'; not as smooth at the end

  load_lazy_images_on_page(current_page);

  //clearTimeout(dots_timer);
  if (dots_timer) return;
  dots_timer = setTimeout(function() {
    dots_timer = null;
    ($('.active-dot', dots)[0] || {}).className = "";
    dots.children[current_page].className = 'active-dot';
  }, 150);

  // after the animation ended
  /*
  pages.style.pointerEvents = 'none';
  //pages.on("webkitTransitionEnd", transitionEnd);
  clearTimeout(switch_page_transition_timeout);
  switch_page_transition_timeout = setTimeout(transitionEnd, 100);
  function transitionEnd(e) {
    if (e && 'transform' != e.propertyName) return;
    pages.off("webkitTransitionEnd", transitionEnd);
    clearTimeout(switch_page_transition_timeout);
    pages.style.pointerEvents = '';
  }
  */
}

// perf problems: https://github.com/hellopath/wheel-inertia/

function ensure_current_page_scroll() {
  DRG.log('ensure_current_page_scroll');
  var pages = byId('apps-pages-list'), style = pages.style;
  var scroll_x = (-current_page * (page_width + page_margin));
  style.webkitTransition = 'none';
  style.webkitTransform = scroll_x ? "translate3d(" + scroll_x + 'px,0,0)' : '';
  setTimeout(function () {
    style.webkitTransition = '';
  }, 100);
}

var throttle = function (fn, delay) {
  var lastExec = 0;
  return function () {
    var now = new Date;
    if (now - lastExec > delay) {
      fn();
      lastExec = now;
    }
  };
}

var go_next_page_throttled = throttle(go_next_page, 1250);
var go_previous_page_throttled = throttle(go_previous_page, 1250);

var dots_mouseover_timer;

function dots_mouseover(e) {
  if (e.target.nodeName != 'SPAN') return;
  var cnt = 0;
  var el = e.target;
  while ((el = el.previousSibling)) {
    cnt++;
  }
  dots_mouseover_timer = setTimeout(function () {
    switch_page(cnt);
  }, 150);
}

function dots_mouseout(e) {
  clearTimeout(dots_mouseover_timer);
}

var is_scrolling = false;
var last_scroll;
var first_scroll;

function onscroll(e) {
  if (e.ctrlKey) return true;
  ///console.log(e.wheelDeltaX)
  e.preventDefault();
  var delta = e.wheelDeltaX || e.wheelDeltaY;

  //first_scroll = first_scroll || Date.now(); ///inertia
  //console.log(Date.now() - first_scroll); ///inertia
  //console.log(delta); ///inertia

  inertia_update(delta); ///inertia

  return; ////////////////////////////////

  if (!is_scrolling && delta) {
    
    (delta < 0) ? go_next_page() : go_previous_page();
    is_scrolling = true;
    last_scroll = Date.now(); ///inertia
    DRG.log('SCROLL normal'); ///inertia
    setTimeout(function() {
      is_scrolling = false;
    }, Math.abs(delta) == 120 ? 300 : 1500); ///inertia
    //}, Math.abs(delta) == 120 ? 300 : 1000);
    // FIXED: add delay because mac os x continues scrolling for a long time
  }
}

setTimeout(function () {
  inertia_addCallback(on_user_wheel_scroll)
}, 1);

function on_user_wheel_scroll(dir) {
  /// continous scrolling for now
  //if (!is_scrolling && delta) {
  var since_last_scroll = Date.now() - last_scroll;
  if (since_last_scroll < 300) {
    //return;
  }

  if (dir) {
    if (dir === -1) go_next_page();
    if (dir === +1) go_previous_page() 

    DRG.log('SCROLL on_user_wheel_scroll', dir);
    last_scroll = Date.now();
  }
}

function onkeydown(e) {
  if (!is_scrolling && e.target == document.body) {
    if (e.keyCode == 37)
      go_previous_page();
    if (e.keyCode == 39)
      go_next_page();
    is_scrolling = true;
    setTimeout(function() {
      is_scrolling = false;
    }, 300);
  }
}

function onkeyup(e) {
  if (e.target == document.body)
    if (e.keyCode == 37 || e.keyCode == 39)
      is_scrolling = false;
}

function reset() {
  calculate_order();
  calculate_grid();
}

function add_new_app_html_beforeend(html) {
  root.insertAdjacentHTML("beforeend", html);
  var el = root.lastChild;
  var pos = get_cell_pos(items.length);
  setPos(el, pos.left, pos.top);
  items.push(root.lastChild);
  refresh_dots();
}

function add_new_app_html_afterbegin(html) {
  root.insertAdjacentHTML("afterbegin", html);
  var el = root.firstChild;
  var pos = get_cell_pos(0);
  setPos(el, pos.left, pos.top);
  items.unshift(el);
  refresh_dots();
  reset();
}

function replace_app_html(oldEl, replacementHtml) {
  var index = items.indexOf(oldEl);
  if (index == -1) return;
  var pos = get_cell_pos(index);
  var newEl = document.createElement('div');
  newEl.innerHTML = replacementHtml;
  newEl = newEl.firstChild;
  items[index] = newEl;
  setPos(newEl, pos.left, pos.top);
  oldEl.parentNode.replaceChild(newEl, oldEl);
}

function add_new_app_html(html) {
  add_new_app_html_beforeend(html);
}

// Data attributes are nice but expandos are still the fastest (50-100x)
// https://jsperf.com/dataset-vs-setattribute-vs-expando
function setPos(el, left, top) {
  el.left = left;
  el.top = top;
  el.style.left = left + 'px';
  el.style.top  = top  + 'px';
  //el.style.transform = 'translate(' + left +  'px, ' + top + 'px)';
}

function getLeft(el) {
  return el.left || (el.left = parseInt(el.style.left, 10));
}

function getTop(el) {
  return el.top  || (el.top = parseInt(el.style.top, 10));
}

function getPos(el) {
  return { left: el.dataset.left, top: el.dataset.top };
}

function computedStyle(el, style) {
  return window.getComputedStyle(el, null).getPropertyValue(style);
}
function computedPx(el, style) {
  return parseFloat(computedStyle(el, style), 10);
}

window.draggable_init = init;
window.draggable_recalc = recalc_public;
window.draggable_schedule_recalc = schedule_recalc;
window.draggable_set_opts = apply_options;
window.get_cell_pos = get_cell_pos;
window.get_cell_index_at = get_cell_index_at;
window.get_current_page = get_current_page;
window.go_last_page = go_last_page;
window.go_next_page = go_next_page;
window.go_previous_page = go_previous_page;
window.add_new_app_html = add_new_app_html;
window.replace_app_html = replace_app_html;
window.remove_app_el = remove_app_el;

// somebody already called us
if (window.draggable_should_init_async) {
  window.draggable_init(window.draggable_async_options);
}

})();


// check: https://github.com/hellopath/wheel-inertia/

(function() {

var deltas = [null, null, null, null, null, null, null, null, null],
    lock = 0,
    direction = undefined,
    cb = function () {},
    seen = 0,
    lastUpdate = 0,
    clearTimer,
    firstEagerTime = 0,
    lastRealScroll = 0;

function resetDeltas() {
  deltas = [null, null, null, null, null, null, null, null, null];
  return deltas;
}

function update(delta) {

    /*
    var previousDelta = deltas[deltas.length];
    var isFirstRun    = (previousDelta == null);

    if (isJumpingWheelDelta(delta) &&
        (isFirstRun || isJumpingWheelDelta(previousDelta))) {
      direction = (delta > 0) ? 1 : -1;
      cb(direction);
    }
    */

    if (delta == 0) return;

    var now = Date.now();

    //console.log('elapsed: ', now - lastUpdate, delta );

    var animatedScroll = now - lastUpdate < 100;
    
    if (!animatedScroll) {
      direction = (delta > 0) ? 1 : -1;
      //deltas = resetDeltas();
      cb(direction);
      firstEagerTime = now;
      lastRealScroll = now;
      DRG.log('eager scroll', now - lastUpdate, delta, direction);
    }

    // 
    // Check for an inertial peak. And if found, lock the peak
    // checking for 10 more events (decremented in hasPeak on
    // each new event) to prevent the sample window from registering
    // true more than once for each peak.
    // 
    // now - firstEagerTime > 300   // ignore first detection cause we were eager
    // now - lastRealScroll > 500   // ignore too fast scrolls in high precision mode
    // Note: with 400 for the latter we are faster, sometimes big 
    // trackpad flicks will scroll 2 pages tho => UX trade-off
    else 
    if (hasPeak() && now - firstEagerTime > 300 && now - lastRealScroll > 500) {
        DRG.log(deltas);
        DRG.log('since eager: ', now - firstEagerTime)
        DRG.log('since lastRealScroll: ', now - lastRealScroll)
        lock = 10;
        seen++;
        direction = (delta > 0) ? 1 : -1;
        // slooooow trackpad movement detection
        // Note: it was used before lastRealScroll elapsed check
        //if (absSum(deltas) > 100) {
          cb(direction);
          lastRealScroll = now;
        //}
    }

    // Shift the deltas backward and add the newest (maintaining the sample window).
    deltas.shift();
    deltas.push(Math.abs(delta));

    //deltas = normalizeDeltas(deltas);

    lastUpdate = now;

    //clearTimeout(clearTimer);
    //clearTimer = setTimeout(function () {
    //  deltas = [null, null, null, null, null, null, null, null, null];
    //}, 1600);
}

function normalizeDeltas(deltas) {
  var len = deltas.length,
      c = deltas[len - 1], 
      b = deltas[len - 2], 
      a = deltas[len - 3];
  if (!a || !b || !c) return deltas;
  if (b > 0 && b > (a + c) * 0.8 ||
      b < 0 && b < (a + c) * 0.8) {
    deltas.splice(len - 2, 1);
    DRG.log('throwing away middle: ', a, b, c);
  }
  return deltas;
}

function absSum(a) { 
  var s = 0; 
  for (var i = 0; i < a.length; i++) s += Math.abs(a[i]);
  return s;
}

function addCallback(callback) {
    cb = callback;
}

function hasPeak() {
    // Decrement the lock.
    if (lock > 0) {
        lock--;
        return false;
    }
    
    // If the oldest delta is null, there can't be a peak yet; so return.
    if (deltas[0] == null) return false;
    
    // Otherwise, check for a peak signature where the middle delta (4)
    // is the highest among all other deltas to the left or right.
    if (
        deltas[0] <  deltas[4] &&
        deltas[1] <= deltas[4] &&
        deltas[2] <= deltas[4] &&
        deltas[3] <= deltas[4] &&
        deltas[5] <= deltas[4] &&
        deltas[6] <= deltas[4] &&
        deltas[7] <= deltas[4] &&
        deltas[8] <  deltas[4]
    ) return true;
    
    // If no peak is found, return false.
    return false;
}

function isHighPrecisionWheelSeries(arr) {
  for (var i = 0; i < arr.length; i++)
    if (d != null && !isHighPrecisionWheelDelta(arr[i]))
      return false;
  return true;
}

function isHighPrecisionWheelDelta(d) {
  if (d == null) throw 'Dont tempt me with null wheelDelta, yo';
  if (typeof d != 'number') d = d.wheelDelta || d.wheelDeltaX || d.wheelDeltaY;
  d = Math.abs(d);
  return (d != 100 && 
          d != 120 && 
          d != window.devicePixelRatio * 100 && 
          d != window.devicePixelRatio * 120);
}
function isJumpingWheelDelta(d) {
  return !isHighPrecisionWheelDelta(d);
}

window.inertia_addCallback = addCallback;
window.inertia_update = update;

})();