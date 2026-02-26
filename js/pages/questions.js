
var root = document.documentElement;
var rootClassList = root.classList;

if (/mac/i.test(navigator.userAgent))
	rootClassList.add('mac');
else if (/windows/i.test(navigator.userAgent))
	rootClassList.add('win');
else if (/cros/i.test(navigator.userAgent))
	rootClassList.add('chrome-os');
else if (/Linux/i.test(navigator.userAgent))
	rootClassList.add('linux');
else
	rootClassList.add('no-platform');



var answers = document.getElementsByClassName('answer');
[].forEach.call(answers, function (a) {
	a.dataset.height = a.offsetHeight;
});
[].forEach.call(answers, function (a) {
  a.classList.add('hidden');
});

document.addEventListener('click', function (e) {
	var q = e.target;
	if (q.parentNode.nodeName == 'H3')
		q = q.parentNode;
	if (q.nodeName != 'H3')
		return;
  var ans = q.nextElementSibling;
	toggleSlide(ans);
}, true);

function toggleSlide(el) {
  if (el.classList.contains('hidden'))
  	el.classList.remove('hidden');
  else
  	el.classList.add('hidden');
  el.classList.remove('highlight');
}

window.onhashchange = hashNav;
hashNav();

function hashNav() {
	if (!window.location.hash) return;
	var q = document.querySelector(window.location.hash);
	if (!q) return;
  var ans = q.nextElementSibling;
	ans.classList.remove('hidden');
	q.scrollIntoView();
	var hi = document.querySelector('.highlight');
	if (hi) 
		hi.classList.remove('highlight');
	if (ans.classList.contains('answer'))
		ans.classList.add('highlight');
}


/*
var iframe = document.createElement('iframe');
iframe.id = "";
iframe.onerror = function () {
	iframe.style.display = 'none';
	document.querySelector('#options-content-local').style.display = 'block';
}
iframe.src = 'https://homenewtab.com.s3-website-us-east-1.amazonaws.com/help/questions.html';
document.querySelector('.options-content').appendChild(iframe);
*/