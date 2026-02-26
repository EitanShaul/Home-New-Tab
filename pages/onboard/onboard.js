
var hide_search_promo;


function onboard_if_needed() {
	return;
	
	var xhr = new XMLHttpRequest();
	xhr.responseType = 'document';
	xhr.onreadystatechange = function handleStateChange() {
		if (this.readyState != xhr.DONE || xhr.status != 200) return;
		var dummy = document.createElement('div');
		dummy.innerHTML = xhr.responseXML.body.innerHTML;
		document.body.appendChild(dummy);
		show_onboard();
	}
	xhr.open("GET", '/pages/onboard/onboard.html', true);
	xhr.send(null); 
}

function show_onboard() {


	function save_and_publish_response(granted) {
		// localStorage ...

		hide_onboard();
	}


  hide_onboard = function () {
  	//byId('search-promo').classList.remove('start');
  	byId('css-onboard').remove();
  }


  loadCSS('/pages/onboard/onboard.css', 'css-onboard');

	/*
	var img = document.createElement('img');
	img.src = 'img/search-promo.png';
	byId('search-promo').appendChild(img);
	*/

	setTimeout(function () {
		byId('search-promo').style.display = '';
		setTimeout(function () {
			byId('search-promo').classList.add('start');
		}, 100);
	}, 10);

}

(function () {

function dom_ready() {
	//setTimeout(onboard_if_needed, 1000);
	onboard_if_needed();
}

if (/interactive|complete/.test(document.readyState)) {
  dom_ready();
} else {
  window.on("DOMContentLoaded", dom_ready);
}

})();