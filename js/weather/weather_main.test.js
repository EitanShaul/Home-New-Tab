(() => { // make sure arrow functions work

var stored = localStorage;
var errorLogger = console.error.bind(console);
// bg is not ready for a while on Chrome startup
var bg = chrome.extension.getBackgroundPage();
chrome.runtime.getBackgroundPage(bgNew => bg = bgNew); 

refreshWeatherDisplay();

chrome.runtime.onMessage.addListener(message => {
  if (message.name == 'weather.updated') {
    refreshWeatherDisplay();
    if (forecastStyle.display != 'none')
      showWeatherForecast();
  }
});

function refreshWeatherDisplay() {
  chrome.runtime.getBackgroundPage(bg => {
    bg.getLocalWeather()
      .then(displayWeatherInfo)
      .catch(errorLogger);
  });
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
  bg.getLocalWeather()
    .then(weather => {
      var htmls = weather.forecast.slice(0, 5).map(fc => fc.summary).map(htmlFromWeatherInfo);
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

//
// HTML
//

function displayWeatherInfo(weather) {
  return displayWeatherInfoBySVG(weather);
}

// v1: active
function displayWeatherInfoBySVG(weather) {
  var currentWeather = weather.current_observation;
  //console.log('weather: current condition', currentWeather);
  var icon = iconFromWeatherCode(currentWeather);
  var currentIconEl = bySelector('#weather .metric-stat .icon');
  var currentDegreeEl = bySelector('#weather .metric-stat .degree');
  currentIconEl.style.backgroundImage = 'none, url("' + icon + '")';
  currentIconEl.classList.add('svg');
  currentDegreeEl.textContent = toLocaleTemperature(currentWeather.temperature);
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
  var celsius = celsiusFromFarenheit(weather.temperature || weather.high);
  var wind_kph = (weather.wind_speed || weather.wind_avg_speed) * 1.609344;
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
  var cond = bg.getConditionTextForCode(code);
  cond = cond.replace('mixed', '');
  cond = cond.replace('(night)', 'n');
  cond = cond.replace('(day)', 'd');
  cond = cond.trim();
  cond = cond.replace(/ /g, '-');
  return getWeatherConditionIcons()[cond];
}

function getWeatherConditionIcons() {
  return bg.weather_condition_icons;
}

// for font based images, (not the colored svg ones)
var conditionCharFromCode = "FFFOPXXXXQXRRUUUWXXJMJMFFGYIHEHCBCBXBOOORWUWHOWO".split("");
conditionCharFromCode[3200] = ")";  // "not available" 

})();