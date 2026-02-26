
var hide_search_promo;


function search_promo_if_needed() {
	!window.DEV;

	// exit conditions in Production
	// we already have permission
	if (chrome.history) return;
	// he already responded
	if (localStorage.FB_history_index_enabled != null) return;
	// it's too early to get the promo yet
	if (localStorage.FB_search_promo_after == null) return;;
	if (+new Date < localStorage.FB_search_promo_after && !window.DEV) return;
	//if (+new Date - localStorage.install_time < 60*60*1000) return; // 24*

	var xhr = new XMLHttpRequest();
	xhr.responseType = 'document';
	xhr.onreadystatechange = function handleStateChange() {
		if (this.readyState != xhr.DONE || xhr.status != 200) return;
		var dummy = document.createElement('div');
		dummy.innerHTML = xhr.responseXML.body.innerHTML;
		document.body.appendChild(dummy);
		show_search_promo();
	}
	xhr.open("GET", '/js/search/promo/search_promo.html', true);
	xhr.send(null); 
}

function show_search_promo() {


	function save_and_publish_response(granted) {
		localStorage.FB_history_index_enabled = granted;
		localStorage.FB_history_index_user_response_time = +new Date;
		chrome.runtime.sendMessage({
			action: "search-promo-response",
			accepted: granted
		});
		if (granted) {
			change_options(function (settings_new) {
	      settings_new.search_bar = true;
	    });
		}
	}

  byId('search-promo-accept').addEventListener('click', function () {
    chrome.permissions.request({
      permissions: ['history']
    }, function(granted) {
      console.log('history permission request: ' + granted);
      save_and_publish_response(granted);
      hide_search_promo();
    });
  });

  hide_search_promo = function () {
  	//byId('search-promo').classList.remove('start');
  	byId('css-search-promo').remove();
  }

  byId('search-promo-decline').onclick = function() {
  	save_and_publish_response(false);
  	hide_search_promo();
  }

  loadCSS( 'css/search_promo.css', 'css-search-promo');

	var img = document.createElement('img');
	img.src = 'img/search-promo.png';
	byId('search-promo').appendChild(img);

	setTimeout(function () {
		byId('search-promo').style.display = '';
		setTimeout(function () {
			byId('search-promo').classList.add('start');
		}, 100);
	}, 10);

}

(function () {

function dom_ready() {
	setTimeout(search_promo_if_needed, 1000);
}

if (/interactive|complete/.test(document.readyState)) {
  dom_ready();
} else {
  window.on("DOMContentLoaded", dom_ready);
}

})();