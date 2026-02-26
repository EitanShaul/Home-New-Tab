if (document.getElementById('close'))
document.getElementById('close').addEventListener("click", function (e) {
  chrome.tabs.getCurrent(function(tab) {
    chrome.tabs.remove(tab.id, function() { });
  });
}, true);
