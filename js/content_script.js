// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

var SPACE = 32;
var HOME = 36;
var ach  = 0.1;

window.DEV = (chrome.runtime.id != 'ehhkfhegcenpfoanmgfpfhnmdmflkbgk');

if (document.URL.includes('homenewtab.com/welcome.html') && !window.DEV) {
  var timer = setInterval(function(){
    if (!document.head) return;
    clearInterval(timer);
    var el = document.createElement('link');
    el.id = 'ehhkfhegcenpfoanmgfpfhnmdmflkbgk-installed';
    document.head.appendChild(el);
  }, 10);
}




