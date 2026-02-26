

var css = document.createElement('style');
css.innerHTML = `
  #search-providers-dd {
    list-style:none;
    position:absolute; 
    top: 34px; 
    border-radius: 0 0 3px 3px; 
    overflow:hidden;
     box-shadow: 0 0 10px rgba(0,0,0, .5);
  }

  #search-providers-dd > li {
    background: #fff;
    /*padding: 4px 20px 4px 6px;*/
    padding: 4px 6px;
    width: 100px;
    overflow: hidden;
    color: #444;
    height: 34px;
    line-height: 34px;
  }

  #search-providers-dd > li:hover {
    background: #e8eaed; 
  }

  #search-providers-dd > li.active {
    background: #ccc; 
    font-weight: bold;
  }

  #search-providers-dd > li > img {
    float: left;
    padding: 4px 6px;
  }
`;

document.head.appendChild(css);

var searchProviderDropdownEscHandler;


function searchProviderDropdownHide() {
 var el = document.getElementById('search-providers-dd')
  if (el) el.remove();
}

function searchProviderDropdownShow () {
  if (document.getElementById('search-providers-dd')) {
    return;
  }

  searchProviderDropdownEscHandler = addEscHandler(searchProviderDropdownHide);

  var dropdown = '<ul id="search-providers-dd">';
  Object.keys(searchProviders).forEach(function (id) {
    var p = searchProviders[id];
    dropdown += `<li data-id="${id}"><img src="${p.icon}" width="26" /> ${p.name}</li>`; 
  });
  dropdown += '</ul>';

  byId('search-logo').insertAdjacentHTML('afterend', dropdown);


  var activeId = settings.search_provider;

  var dropdown = document.getElementById('search-providers-dd');

  document.on("click", function (e) {
    if (e.target.closest('#search-providers-dd')) return;
    if (e.target.id == 'search-logo') return;
    searchProviderDropdownHide();
  });

  dropdown.querySelector(`li[data-id=${activeId}]`).classList.add('active');

  dropdown.onclick = function (e) {
    var li = e.target.closest('li');
    if (!li) return;
    var active = dropdown.getElementsByClassName('active')[0];
    if (active) active.classList.remove('active');
    li.classList.add('active');
    byId('search-logo').src = li.getElementsByTagName('img')[0].src;
    byId('search-logo').dataset.id = li.dataset.id;

    change_options(function (settings_new) {
        settings_new.search_provider = li.dataset.id;
    });

    setTimeout(function () {
      searchProviderDropdownHide();
    }, 300);
  }
 
}
