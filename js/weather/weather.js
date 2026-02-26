// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

(() => { // make sure arrow functions work

var stored = localStorage;
var errorLogger = console.error.bind(console);

refreshWeatherDisplay();

chrome.runtime.onMessage.addListener(message => {
  if (message.name == 'weather.updated') {
    refreshWeatherDisplay();
    if (forecastStyle.display != 'none')
      showWeatherForecast();
  }
});

function refreshWeatherDisplay() {
  bg_call('getLocalWeather')
    .then(displayWeatherInfo)
    .catch(errorLogger);
}

//
// Events & Style
//

var forecastStyle = byId('weather-forecast').style;
var forecastCity = byId('weather-forecast-city');

function forecastFadeIn() {
  forecastStyle.display = 'block';
  clearTimeout(forecastFadeIn.timer);
  forecastFadeIn.timer = setTimeout(_ => forecastStyle.opacity = 1, 10);
}

function forecastFadeOut() {
  clearTimeout(forecastFadeIn.timer);
  forecastFadeIn.timer = setTimeout(_ => forecastStyle.opacity = 0, 50);
}

function showWeatherForecast() {
  bg_call('getLocalWeather')
    .then(weather => {
      var htmls = weather.forecast.slice(0, 5).map(htmlFromWeatherInfo);
      byId('weather-forecast-data').innerHTML = htmls.join('');
      byId('weather-forecast-cond').innerHTML = htmlFromCurrentCondition(weather);
      byId('weather-forecast-city').innerHTML = stored.GEO_custom_city || weather.location.city;
      byId('weather-autocomplete').style.display = 'none';
      //toggleAccurateLocation(weather.location.accurate);
      toggleAutoLocation(!stored.GEO_custom_city);
      forecastFadeIn();
    }).catch(errorLogger);
}

byId('weather-forecast').on('webkitTransitionEnd', () => { 
  if (0 == Number(forecastStyle.opacity)) forecastStyle.display = 'none';
});

byId('weather').on('mouseenter', showWeatherForecast);

byId('weather').on('mouseleave', forecastFadeOut);

byId('weather-forecast').on('mouseenter', forecastFadeIn);
byId('weather-forecast').on('mouseleave',  forecastFadeOut);

var locationIcon = bySelector('.location-icon');
locationIcon.on('mouseenter', function (e) { 
  var disabled = e.target.classList.contains('disabled');
  saveCityName();  
  forecastCity.innerHTML = disabled ? 'Switch to Auto' : 'Switch to Custom';
  //if (!e.target.classList.contains('disabled')) return;
  //byId('weather-forecast-help').style.display = 'block';
});

locationIcon.on('mouseleave', restoreSavedCityName);

locationIcon.on('click', function (e) { 
  if (e.target.classList.contains('disabled'))
    askForGeoFetch();
  else
    showManualLocationSelection();
});

function saveCityName() {
  forecastCity.dataset.saved = forecastCity.innerHTML;
}
function restoreSavedCityName() {
  if (forecastCity.dataset.saved) forecastCity.innerHTML = forecastCity.dataset.saved;
}


//function toggleAccurateLocation(accurate) {
//  if (accurate) bySelector('#weather-forecast-help').style.display = 'none';
//  bySelector('#weather-forecast .location-icon').classList.toggle('disabled', !accurate);
//  bySelector('#weather-forecast-city').classList.toggle('accurate', !!accurate);
//}

function toggleAutoLocation(isAuto) {
  bySelector('#weather-forecast .location-icon').classList.toggle('disabled', !isAuto);
  bySelector('#weather-forecast-city').classList.toggle('accurate', !!isAuto);
}

byId('weather-unit-option').textContent = temperatureUnit();
byId('weather-unit-option').onclick = function (e) {
  var temp = (this.textContent == 'f') ? 'c' : 'f';
  this.textContent = temp; 
  change_options(function (settings_new) {
    settings_new.temperature = temp;
  });
  refreshWeatherDisplay();
  showWeatherForecast();
};

addSettingsListener('temperature', refreshWeatherDisplay);

function showManualLocationSelection() {
  restoreSavedCityName();
  byId('weather-forecast-city').focus();
}

function askForGeoFetch() {
  byId('weather-forecast-city').innerHTML = 'Updating...';
  delete byId('weather-forecast-city').dataset.saved;
  delete stored.GEO_custom_city;
  // added a setTimeout because now localStorage is not "sync" on the service worker side (we have local cache and async updates)
  // so it needs some time to "catch up"
  setTimeout(() => 
    chrome.runtime.sendMessage({name: 'geo.fetch'}), 300);
}

//
// AutoComplete
//

byId('weather-autocomplete').style.display = 'none';

/// TEMP:  weather location is in testing mode for now
//locationIcon.style.display = 'none';
//byId('weather-forecast-city').style.cursor = 'default';

byId('weather-forecast-city').contentEditable = 'true';

byId('weather-forecast-city').onfocus = function () {
  setTimeout(() => document.execCommand('selectAll',false,null), 0);
}
byId('weather-forecast-city').onblur = function () {
   window.getSelection().empty();
}
/*
byId('weather-forecast-city').oninput = function () {
  var js = document.createElement('script');
  //js.src = 'https://autocomplete.wunderground.com/aq?cb=onWeatherAutoComplete' +
  //         '&query=' + byId('weather-forecast-city').textContent.trim();
  document.body.appendChild(js);
};
*/

byId('weather-forecast-city').oninput = async function() {
  try {
    const query = byId('weather-forecast-city').textContent.trim();
    const url = `https://api.weather.com/v3/location/search?apiKey=71f92ea9dd2f4790b92ea9dd2f779061&language=en-US&locationType=city%2Cairport%2CpostCode%2Cpws&format=json&query=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    const data = await response.json();

    const results = [];
    const loc = data.location;
    for (let i = 0; i < loc.address.length; i++) {
      const name = loc.address[i];
      const c = loc.countryCode[i];
      const lat = loc.latitude[i];
      const lon = loc.longitude[i];
      const type = loc.type[i];
      results.push({ type, c, lat, lon, name });
    }
    
    onWeatherAutoComplete(results);
  } catch (err) {
    errorLogger(err);
  }
};

window.onWeatherAutoComplete = function (results) {
  var html = '';
  if (results) {
    byId('weather-autocomplete').style.display = 'block';
    results.filter(entry => entry.type == 'city')
               .slice(0, 5).forEach((city) => {
      html += '<li data-c="'+ city.c +'" data-lat="'+ city.lat +'" data-lon="'+ city.lon +'">' + 
                  city.name + 
              '</li>';
    });

  }
  byId('weather-autocomplete').innerHTML = html || '<div class="empty">No Results</div>';
};
byId('weather-autocomplete').onclick = function (e) {
  var el = e.target;
  if (el.nodeName != 'LI') return;
  var cityShortName = el.textContent.split(',')[0];
  chrome.runtime.sendMessage({ name: 'geo.set', data: 
    { lat:  el.dataset.lat, lon: el.dataset.lon, countryCode: el.dataset.c, 
      customCity: cityShortName, custom: true }
  });
  byId('weather-forecast-city').innerHTML = cityShortName;
  byId('weather-autocomplete').style.display = 'none';
}
byId('weather-forecast-city').onkeydown = function (e) {
  var ENTER_KEYCODE = 13;
  if (e.keyCode == ENTER_KEYCODE) {
    var firstCity = byId('weather-autocomplete').querySelector('li');
    if (firstCity) { 
      firstCity.click();
      byId('weather-forecast-city').blur();
    }
    e.preventDefault();
  }
}

//
// HTML
//

function setCacheWeatherInfoHTML(icon, temp) {
  stored.WTR_cache_weather_main_html = byId('weather').innerHTML;
  stored.WTR_cache_weather_main_date = stored.WTR_last_updated;
  stored.WTR_cache_weather_main_id = icon + '-' + temp;
}

function displayWeatherInfo(weather) {
  return displayWeatherInfoBySVG(weather);
}

// v1: active
function displayWeatherInfoBySVG(weather) {
  var currentWeather = weather.current;
  var vals = currentWeather.imperial;
  //console.log('weather: current condition', currentWeather);
  ///var icon = iconFromWeatherCode(currentWeather);  
  var icon = iconFromWeatherCode_OLD(currentWeather.icon_code);
  var currentIconEl = bySelector('#weather .metric-stat .icon');
  var currentDegreeEl = bySelector('#weather .metric-stat .degree');
  currentIconEl.style.backgroundImage = 'none, url("' + icon + '")';
  currentIconEl.classList.add('svg');
  currentDegreeEl.textContent = toLocaleTemperature(vals.temp);
  setCacheWeatherInfoHTML(currentWeather.icon_code, vals.temp);
}

// v2: unused
function displayWeatherInfoByFont(weather) {
    var currentWeather = weather.condition;
    //console.log('weather: current condition', currentWeather);
    var icon = bySelector('.metric-stat .icon');
    icon.title = currentWeather.text;
    icon.dataset.icon = conditionCharFromCode[currentWeather.code];
    bySelector('.metric-stat .degree').textContent = 
      toLocaleTemperature(currentWeather.temp);
    setCacheWeatherInfoHTML(currentWeather.code, temp);
}

function htmlFromWeatherInfo(info) {
  var infoDN = info.day || info.night;
  var icon = iconFromWeatherCode_OLD(infoDN.icon_code);
  var style = "background-image:none, url(" + icon + ")";
  var pop = info.pop > 25 ? '<span class="percip-prob">' + infoDN.pop + '</span>' : '';
  var high = info.max_temp || infoDN.hi || info.min_temp; 
  var low  = info.min_temp || info.max_temp;
  return '<div class="metric-stat">' + 
    '<div class="weather-day">' + shortDay(info.dow) + '</div>' + 
    '<span class="icon svg" style="'+ style +'" title="'+ info.narrative +'">'+ pop +'</span>' + 
    '<span class="degree">' + toLocaleTemperature(high) + '</span>' + 
    '<span class="degree low">' + toLocaleTemperature(low) + '</span>' + 
  '</div>';
}

function htmlFromCurrentCondition(weather) {
  var current = weather.current;
  var vals = current.imperial;
  current.uv_index = Math.max(current.uv_index, 0);
  return htmlFromStat('Feels', toLocaleTemperature(vals.feels_like), temperatureUnitFull()) + 
         htmlFromStat('Humidity', vals.rh || 0, '%') + 
         htmlFromStat('UV', Math.max(current.uv_index), toLocaleUV(current.uv_index)) +
         htmlFromStat('Wind', toLocaleSpeed(vals.wspd), speedUnit()) +
         htmlFromStat('Rain', toLocalePercip(+vals.precip_24hour), percipUnit());
}

function htmlFromStat(title, value, unit, cls) {
  return  '<div class="weather-stat-col">' +
            '<div class="weather-stat-title">' + title + '</div> ' +
            '<div class="weather-stat-val ' + cls +'">'   + value + '</div>' + 
            '<div class="weather-stat-unit">'  + (unit||'&nbsp;') + '</div>' + 
          '</div>';
}

//
// Conversion
//

function temperatureUnit() {
  var lang = (stored.language || navigator.languages[0]);
  return settings.temperature || ('en-US' == lang ? 'f' : 'c');
}

function temperatureUnitFull() {
  return '°' + temperatureUnit().toUpperCase();
}

function toLocaleTemperature(f) {
  return Math.round('f' == temperatureUnit() ? f : celsiusFromFarenheit(f));
}

function toLocaleSpeed(mph) {
  return Math.round('f' == temperatureUnit() ? mph : mph * 1.609344);
}

function speedUnit() {
  return 'f' == temperatureUnit() ? 'mph' : 'km/h';
}

function toLocalePercip(inch) {
  return 'f' == temperatureUnit() ? inch : Math.round(inch * 25.4);
}

function percipUnit() {
  return 'f' == temperatureUnit() ? 'in' : 'mm';
}

function shortDay(day) {
  return day.slice(0, 3);
}

function toLocaleUV(uv) {
  return uv >= 8 ? 'very high' : (uv >= 6 ? 'high' : (uv >= 3 ? 'moderate' : 'low'));
}

function celsiusFromFarenheit(f) { return (f-32) * 5 / 9; }

function iconFromWeatherCode(weather) {
  weather = convertIconIfWindy(weather);
  var cond = weather.icon || ''; // fix icon null sometimes => at least show the temp
  if (cond == 'nt_') cond = 'nt_clear'; // fix wunderground empty 'nt_' issue
  cond = convertChances(cond);
  cond = cloudyFromSunny(cond);
  cond = convertDayNightToIconFormat(cond);
  cond = convertCondTerminology(cond);
  cond = cond.replace('mostly', 'mostly-').replace('partly', 'partly-');
  return getWeatherConditionIcons()[cond];
}

function convertChances(cond) {
  // MAYBE: with the percip prob, we could show rain icon with 1-2-3 drops
  //if (cond == 'chancerain') return 'drizzle';
  cond = cond.replace('chancetstorms', 'scattered-thunderstorms-d');
  cond = cond.replace('chancerain', 'scattered-showers');
  cond = cond.replace('chancesnow', 'light-snow-showers');
  return cond.replace('chance', '');
}

function cloudyFromSunny(cond) { 
  return cond.replace('mostlysunny', 'partlycloudy') // TODO: fair-d for small cloud coverage
             .replace('partlysunny', 'mostlycloudy')
}

function convertIconIfWindy(weather) {
  var celsius = celsiusFromFarenheit(weather.temp);
  var wind_kph = (weather.wspd) * 1.609344;
  var percipProb = weather.pop || 0;
  if (wind_kph > 10 && (wind_kph >= 1.3*celsius || celsius < 20 && wind_kph >= celsius))
    if (/partlycloudy|clear|sunny/.test(weather.icon) && percipProb < 20)
      weather.icon = 'windy';
  return weather;
}

// Note: drizzle, lightning bolt, etc. icons unused
function convertCondTerminology(cond) {
  var conv = { hazy: 'haze', fog: 'foggy', rain: 'showers', 
               flurries: 'snow-flurries', tstorms: 'thunderstorms' }; 
  return conv[cond] || cond;
}

// clear, mostly/partly cloudy
function hasNightAlternative(cond) {
  return (/clear|fair/i.test(cond) || /(mostly|partly)cloudy/i.test(cond));
}

function convertDayNightToIconFormat(cond) {
  if (!hasNightAlternative(cond)) 
    return cond.replace('nt_', '');
  if (/nt_/.test(cond))
    return cond.replace('nt_', '') + '-n';
  return cond + '-d';
}

// icons: https://output.jsbin.com/joquqiq
function iconFromWeatherCode_OLD(code) {
  var cond = getConditionTextForCode(code);
  cond = cond.replace('mixed', '');
  cond = cond.replace('(night)', 'n');
  cond = cond.replace('(day)', 'd');
  cond = cond.trim();
  cond = cond.replace(/ /g, '-');
  return getWeatherConditionIcon(cond);
}

// Conditions

function getWeatherConditionIcon(cond) {
  return '/icons/weather/' + cond + '.svg';
}

function getConditionTextForCode(code) {
  return getConditionTextForCodeTable()[code];
}

// https://output.jsbin.com/joquqiq
function getConditionTextForCodeTable() {
  return {
    0: "tornado",
    1: "tropical storm",
    2: "hurricane",
    3: "severe thunderstorms",
    4: "thunderstorms",
    5: "mixed rain and snow",
    6: "mixed rain and sleet",
    7: "mixed snow and sleet",
    8: "freezing drizzle",
    9: "drizzle",
    10: "freezing rain",
    11: "showers",
    12: "showers",
    13: "snow flurries",
    14: "light snow showers",
    15: "blowing snow",
    16: "snow",
    17: "hail",
    18: "sleet",
    19: "dust",
    20: "foggy",
    21: "haze",
    22: "smoky",
    23: "blustery",
    24: "windy",
    25: "cold",
    26: "cloudy",
    27: "mostly cloudy (night)",
    28: "mostly cloudy (day)",
    29: "partly cloudy (night)",
    30: "partly cloudy (day)",
    31: "clear (night)",
    32: "sunny",
    33: "fair (night)",
    34: "fair (day)",
    35: "mixed rain and hail",
    36: "hot",
    37: "isolated thunderstorms",
    38: "scattered thunderstorms (night)", // night was missing
    39: "scattered thunderstorms (day)",   // day was missing
    40: "scattered showers",
    41: "heavy snow",
    42: "scattered snow showers",
    43: "heavy snow",
    44: "partly cloudy",
    45: "thundershowers",
    46: "snow showers",
    47: "isolated thundershowers",
    3200: "not available" 
  };
}

// for font based images, (not the colored svg ones)
var conditionCharFromCode = "FFFOPXXXXQXRRUUUWXXJMJMFFGYIHEHCBCBXBOOORWUWHOWO".split("");
conditionCharFromCode[3200] = ")";  // "not available" 

window.showWeatherForecast = showWeatherForecast;

})();