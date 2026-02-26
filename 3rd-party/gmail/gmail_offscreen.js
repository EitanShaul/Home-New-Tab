(function(){

var instanceId = 'gmc' + parseInt(Date.now() * Math.random(), 10);
var unreadCount = -1;
var requestTimeout = 1000 * 2;  // 5 seconds

function getFeedUrl() {
  // "zx" is a Gmail query parameter that is expected to contain a random
  // string and may be ignored/stripped.
  return "https://mail.google.com/mail/feed/atom?zx=" + encodeURIComponent(instanceId);
}

function getData(item, key) {
  var elem = getElem(item, key);
  return elem ? elem.textContent : null;
} 

function getElem(item, key) {
  return item ? item.getElementsByTagName(key)[0] : null;
} 

// as far as i can tell this is unused right now, we store notifications
// as html in a separate place
stored.gmail || (stored.gmail = "[]");
var MAX_GMAIL = 20;

// @param items - a collection of XML nodes
function processGmails(items) {

  if (!items.length) return;

  var since_id = stored.gmail_since_id;
  var new_items = [];
  var notifications = [];

  for (var i = 0; i < items.length; i++) {
    if (getData(items[i], "id") == since_id) break;
    var item = items[i];
    new_items.push({
      id: getData(item, "id"),
      title: getData(item, "title"),
      issued: getData(item, "issued"),
      link: getElem(item, "link").getAttribute("href"),
      summary: getData(item, "summary"),
      author: getData(getElem(item, "author"), "name")
    });
    notifications.push([
      'gmail', 
      "<a href='"+ getElem(item, "link").getAttribute("href") +"' target='_blank'>" + getData(getElem(item, "author"), "name") + "</a> " + getData(item, "title"), 
      getData(item, "summary")
    ]);
  }

  // going backwards intentionally for notifications to appear in order
  for (var i = notifications.length; i--;) {  
    //create_notification.apply(null, notifications[i]);
    bg_call('create_notification', ...notifications[i]);
  }

  stored.gmail_since_id = getData(items[0], "id");


  var old_items = [];
  try {
    old_items = JSON.parse(stored.gmail);
  } catch (e) {
    console.log('ERROR: stored gmail has invalid JSON: ' + stored.gmail);
    /// TODO: log error
    logError(e, "ERROR: stored gmail has invalid JSON");
    // throw new Error('ERROR: stored gmail has invalid JSON: ' + stored.gmail);
  }
  new_items.concat(old_items);
  new_items = new_items.slice(0, MAX_GMAIL);

  setTimeout(function() {
    stored.gmail = JSON.stringify(new_items);
  }, 1000);
}

function getInboxCount(onSuccess, onError) {
  var xhr = new XMLHttpRequest();
  var abortTimerId = window.setTimeout(function() {
    xhr.abort();  // synchronously calls onreadystatechange
  }, requestTimeout);

  function handleSuccess(count) {
    window.clearTimeout(abortTimerId);
    onSuccess?.(count);
  }

  function handleError() {
    window.clearTimeout(abortTimerId);
    if (onError && !handleError.once)
      onError();
    handleError.once = true;
  }

  try {
    xhr.onreadystatechange = function(){
      if (xhr.readyState != 4)
        return;
      // Logged out: 401 or responseXML is typically null
      //  || xhr.responseText.indexOf('Error 401') != -1
      if (xhr.status == 401 || !xhr.responseXML)
        return handleError();

      var xmlDoc = xhr.responseXML;

      // unread count
      var fullCountSet = xmlDoc.evaluate("/gmail:feed/gmail:fullcount",
          xmlDoc, gmailNSResolver, XPathResult.ANY_TYPE, null);
      var fullCountNode = fullCountSet.iterateNext();
      if (fullCountNode) {
        handleSuccess(fullCountNode.textContent);
      } else {
        console.error(chrome.i18n.getMessage("gmailcheck_node_error"));
        handleError();
      }

      // notifications
      /// TODO: if modified since?
      var items = xmlDoc.getElementsByTagName("entry");
      processGmails(items);
    }

    xhr.onerror = function(event) {
      // as far as we are concerned it's either a firewall blocking or user aborted
      // so no error reporting
      //logError(new Error("ERROR: gmail XHR: " + xhr.status));
      handleError();
      //sendBugreportXHR(xhr);
    }

    xhr.open("GET", getFeedUrl(), true);
    xhr.send(null);
  } catch(e) {
    logError(e, "ERROR: gmailcheck_exception: ");
    console.error(chrome.i18n.getMessage("gmailcheck_exception", e));
    handleError();
  }
}

function gmailNSResolver(prefix) {
  if(prefix == 'gmail') {
    return 'http://purl.org/atom/ns#';
  }
}

function updateUnreadCount(count) {
  //if (unreadCount != count) {
    unreadCount = count;
    bg_call('set_indicator', 'gmail', count);
    //set_indicator("gmail", count);
  //}
}

//window.addEventListener("DOMContentLoaded", scheduleRequest, false);
//startRequest();

function startRequest() {
  getInboxCount(updateUnreadCount);
}

// can be called with offscreen_call('fetch_gmail')
window.fetch_gmail = startRequest;

})();