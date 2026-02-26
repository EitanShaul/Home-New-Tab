// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

// 16px for retina: chrome://favicon/size/16@2x/https://www.apple.com/
// 48px: chrome://favicon/size/48/https://www.apple.com/

var BOOKMARKS_BAR_IDX = 0;
var OTHER_BOOKMARKS_IDX = 1;
var all_chrome = [];
var all = [];
var jNodeForId = {};
var jNodeRoots = [];

function create_jstree(data) {
    $('#container').jstree({
      plugins : ["wholerow"],
      core : {
        data : data,
        themes : {
          dots : false, 
          ellipsis: false,
          responsive: false,
          stripes: false, // true
          variant: 'small',
        }
      }
    });

    $('#container').on("select_node.jstree", function (e, eventData) {
      console.log(eventData.node);
      var node = eventData.node; 
      var isFolder = node.data && (node.data.children != null);
      if (isFolder)
        eventData.instance.toggle_node(node); 
      else if (node.a_attr.href)
        top.location = node.a_attr.href;
    });

    function on_toggle_node(e, eventData) {
      var node = eventData.node; 
      set_opened(node.id, node.state.opened);
    }

    $('#container').on("open_node.jstree", on_toggle_node);
    $('#container').on("close_node.jstree", on_toggle_node);
}

function load_bookmarks(callback) {

  //chrome.bookmarks.getChildren('2', function (results) {
  chrome.bookmarks.getTree(function (results) {

    console.log(results);
    var root = results[0];

    //all_chrome = results[0].children[1].children;
    var bookmarks_bar   = root.children[BOOKMARKS_BAR_IDX];
    var other_bookmarks = root.children[OTHER_BOOKMARKS_IDX];

    all_chrome = [bookmarks_bar].concat(other_bookmarks.children);

    jNodeForId['#'] = jNodeLazyArrayFromChromeNodes(all_chrome);
    jNodeRoots = jNodeForId['#'];

    create_jstree(jstreeDataProvider);

    //$("#bookmarks-bar")[0].innerHTML = html;
    callback && callback();


  });
}

function iconForNode(bm) {
  var icon;
  if (bm.url)
    if (bm.url.indexOf('javascript:') == 0)
      icon = 'file_chrome.png' // js
    else 
      icon = 'chrome://favicon/size/16@2x/' + bm.url;
  else if (bm.children)
    icon = 'folder.png';
  else
    icon = 'folder.png'; // TODO: unknown?
  return icon;
}

function walk(node, func) {
    func(node);
    if (node.children)
      for (var i = 0; i < node.children.length; i++)
        walk(node.children[i], func);
}

function jstreeDataProvider(node, cb) {
  console.log(node.id, node);
  if (node.id == '#')
    cb(jNodeRoots);
  else 
    cb(jNodeLazyArrayFromChromeNodes(node.original.chrome.children));
}

function jNodeLazyArrayFromChromeNodes(nodes) {
  var nodes = nodes.filter(excludeJavascript);
  return nodes.map(jNodeLazyFromChromeNode);
}

function excludeJavascript(node) {
  var isJavascript = node.url && node.url.indexOf('javascript:') === 0;
  return !isJavascript;
}

function jNodeLazyFromChromeNode(chNode) {
  return jNodeFromChromeNode(chNode, false);
}

function jNodeFullFromChromeNode(chNode) {
  return jNodeFromChromeNode(chNode, true);
}

function jNodeFromChromeNode(chNode, shouldLoadChildren) {
  //var state = (node.children) ? { 'undetermined': true } : null;
  var node = chNode;

  // make it iteration firendly and assume lazy loading
  if (shouldLoadChildren !== true)
    shouldLoadChildren = false;

  var children, state, data;
  if (node.children) {
    if (shouldLoadChildren)
      children = jNodeLazyArrayFromChromeNodes(node.children)
    else
      // true indicates unloaded children, empty array means there are no children
      children = !!node.children.length || []; 
    data =  { children: children };
  }
  if (openedIds[node.id]) {
    state = state || {};
    state.opened = true;
  }
  //if (node.url && node.url.indexOf('javascript:') === 0) {
  //  state = state || {};
  //  state.disabled = true;
  //}
  var jNode = {
    id: node.id,
    text: node.title || "UNKNOWN",
    icon: iconForNode(node),
    children: children,
    state: state,
    chrome: node,
    data: data,
    // data: node ?
  };
  if (node.url)
    jNode.a_attr = { href: node.url };
  else
    jNode.a_attr = { href: 'folder:' + node.title };
  jNodeForId[node.id] = jNode;
  return jNode;
}

function display_bookmarks_bar() {
  $("#bookmarks-bar")[0].style.opacity = 1;
  $("#page")[0].style.margin = '41px';
}

//
// Opened folders persistance
//

var openedIds = load_opened();

function load_opened() {
  try {
    return JSON.parse(localStorage.BM_opened);
  } catch (e) {
    return {};
  }
}

function set_opened(id, isOpened) {
  if (isOpened)
    openedIds[id] = true;
  else
    delete openedIds[id];
  localStorage.BM_opened = JSON.stringify(openedIds);
}

/*
window.addEventListener('focus', function firstFocus(e) {
  console.log('focus', e);
  if (e.target == window) 
    $('#search-term')[0].focus();
  //window.removeEventListener('focus', firstFocus);
});
*/

/*
function waitForFocus() {
  if (!document.hasFocus())
    return setTimeout(waitForFocus, 10);
  $('#search-term')[0].focus();
}
setTimeout(waitForFocus, 10);
*/

$('#search-button').on('click', on_search);
$('#search-form').on('submit', on_search);
$('#search-term').on('focus', function () {
  $('h1')[0].classList.add('search-active')
});
$('#search-term').on('blur', function () {
  var term = $('#search-term')[0].value;
  term ? $('h1')[0].classList.add('search-active')
       : $('h1')[0].classList.remove('search-active');
});

function on_search(e) {
  e.preventDefault();

  var term = $('#search-term')[0].value;

  chrome.bookmarks.search(term, function (results) {
    // remove folders and bookmarklets
    results = results.filter(function (node) {
      return node.url && node.url.indexOf('javascript:') == -1;
    });
    // turncate results to most relevant X
    results = results.slice(0, 50);

    var old_jstree = $('#container').jstree(true);
    old_jstree && old_jstree.destroy();

    if (!results.length) {
      $('#container').html('<div class="no-result">No Results</div>'); 
      return;
    }

    create_jstree(jNodeLazyArrayFromChromeNodes(results));
  });
}

//
// Init
//

display_bookmarks_bar();
load_bookmarks();


//
// Scrolling header
//

var was_scrolling = false;
var scrollbar_timer;
var scroll_root = $('#scrolling-root')[0];

window.onwheel = function (e) {

  //$('body')[0].classList.remove('hide_scrollbar')
  //clearTimeout(scrollbar_timer);
  //scrollbar_timer = setTimeout(hide_scrollbar, 500)

  var is_scrolling = scroll_root.scrollTop;
  if (is_scrolling == was_scrolling) return;
  (is_scrolling) ? $('h1')[0].classList.add('scrolling')
                 : $('h1')[0].classList.remove('scrolling');        
  was_scrolling = is_scrolling;
}

function hide_scrollbar() {
   $('body')[0].classList.add('hide_scrollbar')
}
$('body')[0].classList.add('hide_scrollbar')
