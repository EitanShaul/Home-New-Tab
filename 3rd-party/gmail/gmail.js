
(function(){

function getGmailUrl() {
  var url = "https://mail.google.com/";
  if (localStorage.customDomain)
    url += localStorage.customDomain + "/";
  else
    url += "mail/"
  return url;
}

/*
function isGmailUrl(url) {
  // This is the Gmail we're looking for if:
  // - starts with the correct gmail url
  // - doesn't contain any other path chars
  var gmail = getGmailUrl();
  if (url.indexOf(gmail) != 0)
    return false;

  return url.length == gmail.length || url[gmail.length] == '?' ||
                       url[gmail.length] == '#';
}
*/

function isGmailUrl(url) {
  // Return whether the URL starts with the Gmail prefix.
  return url.indexOf(getGmailUrl()) == 0;
}

function startRequest() {
  offscreen_call('fetch_gmail');
}

//window.addEventListener("DOMContentLoaded", scheduleRequest, false);
//startRequest();


//
// FETCH CASES
//

// 1) periodic
window.fetchScheduler.addHandlerFromTopLevelOnly(startRequest);

// 2) tab update
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
  if (changeInfo.url && isGmailUrl(changeInfo.url)) {
    startRequest();
  }
});


// 3) Open Gmail tab update inbox
var filters = {
  // TODO(aa): Cannot use urlPrefix because all the url fields lack the protocol
  // part. See crbug.com/140238.
  url: [{urlContains: getGmailUrl().replace(/^https?\:\/\//, '')}]
};

function onNavigate(details) {
  if (details.url && isGmailUrl(details.url)) {
    console.log('Recognized Gmail navigation to: ' + details.url + '.' +
                'Refreshing count...');
    setTimeout(function () {
      startRequest();
    }, 1000);
  }
}

if (chrome.webNavigation && chrome.webNavigation.onDOMContentLoaded &&
    chrome.webNavigation.onReferenceFragmentUpdated) {
  chrome.webNavigation.onDOMContentLoaded.addListener(onNavigate, filters);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(
      onNavigate, filters);
} else {
  chrome.tabs.onUpdated.addListener(function(_, details) {
    onNavigate(details);
  });
}

})();