(function() {

// TODO
//
// TEMP: remove Google Caledanr support until a fix is found for this issue: 
//
// Your item is making a large volume of requests to Calendar API service. It makes apiary calendar requests with developer_project_id set to 0 and results in high volume of dailyLimitExceededUnreg 403 errors. Please ensure that your item does not make requests that are triggering forbidden responses.
//
window.GCAL_checkAuth = function () {};
//return;


// RELEASE: 1024356103437-t90vgokgf8d7fi0cef1imopvgsh02pvl
// DEBUG:   1024356103437-kb5uconje3r0p2rgemdgv7cmlmfo3a7k
var CLIENT_CODE = false && window.DEV 
                ? '1024356103437-kb5uconje3r0p2rgemdgv7cmlmfo3a7k'
                : '1024356103437-t90vgokgf8d7fi0cef1imopvgsh02pvl';
var CLIENT_ID = CLIENT_CODE + '.apps.googleusercontent.com';
var API_KEY = 'AIzaSyAgOHvN6VpxIO1wmV7tqZJ2FKXlp0zEsWc';

var SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

var CALENDAR_LIST_API_URL_ = 
  'https://www.googleapis.com/calendar/v3/users/me/calendarList';
var CALENDAR_EVENTS_API_URL_ = 
  'https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?';

// Time between server polls = 30 minutes.
var POLL_INTERVAL =  FETCH_INTERVAL || 1000 * 30;  // 10 seconds

/////////////////////////////////////////////////////////////////////

var LOCALSTORAGE_PREFIX = "GCAL_";
var pollUnderProgress = false;
var isMultiCalendar = false;

//This is used to poll only once per second at most, and delay that if
//we keep hitting pages that would otherwise force a load.
var pendingLoadId_ = null;
var isAuthorized = false;

// after first auth this stays 'true' even if our token expires, 
// and isAuthorized becomes 'false'
var wasAuthorizedBefore = false; 


/////////////////////////////////////////////////////////////////////


CalendarManager = {};

// multi calendar later:
//  localStorageSet('calendars', calendars);

/**
 * Polls the server to get the feed of the user.
 */
CalendarManager.pollServer = function() {
  if (! pollUnderProgress) {
    localStorageSet('eventList', []);
    pollUnderProgress = true;
    pendingLoadId_ = null;
    localStorageSet('calendars', []);
    localStorageSet('lastPollTime', Date.now());

    fetchEvents(function(events) {
      pollUnderProgress = false;
      if (!events || !events.length) {
        console.log('GCAL: No events');
        publishEvents([]);
        return;
      }

      handleFetchedEvents(events);
    });
  }
};

function publishEvents(eventList) {
  chrome.runtime.sendMessage({name: 'upcoming-event', data: eventList});
}

function handleFetchedEvents(events) {
  var eventList = localStorageGet('eventList', []);

  events.forEach(function (baseEvent) {

    var event = {};
    event.startTime = +new Date(baseEvent.start.dateTime || baseEvent.start.date);
    event.endTime = +new Date(baseEvent.end.dateTime || baseEvent.end.date);
    event.title = baseEvent.summary;
    event.location = baseEvent.location;
    event.url = baseEvent.htmlLink;
    event.id = baseEvent.id;
    event.description = baseEvent.description;
    // event.reminders

    //if (event.startTime > Date.now()) {
      eventList.push(event);
    //}
  });
  localStorageSet('eventList', eventList);
  publishEvents(eventList);
}

isMultiCalendar = localStorageGet('multiCalendar', false);

/////////////////////////////////////////////////////////////////////

function requestAuthPrompt() {
  chrome.identity.getAuthToken({'interactive': true}, function (authToken) {
    handleAuthResult(authToken, function (authToken) {
      if (authToken) 
        CalendarManager.pollServer();
    });
  });
  return false;

  /// why the fuck was this even here? Recurring checks after user action seems unnecessary
  ///setTimeout(checkAuthRecur, 2000); 

  //setTimeout(checkAuth, 5000); 
}


//function checkAuthRecur() {
//  if (isAuthorized) 
//    return console.log('GCAL: alredy isAuthorized, checkAuthRecur');
//  checkAuth();
//  setTimeout(checkAuthRecur, 2000);
//}

//function checkAuthBackground(callback) {
//  if (isAuthorized) 
//    return console.log('GCAL: alredy isAuthorized, checkAuth');
//  requestAuthBackground(callback);
//}

function checkAuthBackground(callback) {
  requestAuthBackground(function (authToken) {
    return callback(!!authToken);
  });
}

function requestAuthBackground(callback) {
  chrome.identity.getAuthToken({'interactive': false}, function (token) { 
    handleAuthResult(token, callback);
  });
}

function handleAuthResult(authToken, callback) {
  if (chrome.runtime.lastError || !authToken) {
    isAuthorized = false;
    console.error('getAuthToken', chrome.runtime.lastError.message);
    console.error('GCAL: handleAuthResult: set isAuthorized to false');
    //refreshUI();
    callback(null);
    return;
  }

  isAuthorized = true;
  callback(authToken);
}

function fetchEvents(callback) {

  var feedUrl =
      CALENDAR_EVENTS_API_URL_.replace('{calendarId}', 'primary') + ([
        'timeMin=' + encodeURIComponent((new Date()).toISOString()), 
        'maxResults=10',
        'orderBy=startTime', 
        'singleEvents=true', 
        'showDeleted=false'
      ].join('&'));

  requestAuthBackground(async function (authToken) {
    if (!authToken) 
      return callback(null);

    try {
      const res = await fetch(feedUrl, {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
  
      // 401: Invalid Credentials (reason: authError)
      // 403: Daily Limit for Unauthenticated Use Exceeded. (reason: dailyLimitExceededUnreg)
      //background.log('Fetch Error (Events)', response.statusText);
      if (!res.ok) {
        if (res.status === 401) {
          //refreshUI();
          isAuthorized = false;
          chrome.identity.removeCachedAuthToken({'token': authToken}, requestAuthBackground);
          console.error('GCAL: received 401, removing auth token');
          console.error('GCAL: handleAuthResult: set isAuthorized to false');
        }
        throw new Error(res.statusText);
      }
  
      const data = await res.json();
      //console.log(res);
      const events = data.items;
      callback && callback(events);
    } catch (err) {
      // Must callback here, otherwise the caller keeps waiting for all calendars to load.
      callback && callback(null);
    }
  });

  
}

/////////////////////////////////////////////////////////////////////

/*
 * Function runs on completed navigation with a url of google applications.
 * @param {details} details of the completed web navigation.
 */
function onCompleted(details) {
  var url = details.url;

  if ((url.indexOf('calendar.google.com/calendar/') != -1) ||
      ((url.indexOf('www.google.com/a/') != -1) &&
      (url.lastIndexOf('/acs') == url.length - 4)) ||
      (url.indexOf('www.google.com/accounts/') != -1)) {

    if (pendingLoadId_) {
      clearTimeout(pendingLoadId_);
      pendingLoadId_ = null;
    }

    // try to poll in 2 second [which makes the redirects settle down]
    pendingLoadId_ = setTimeout(CalendarManager.pollServer, 2000);
  }
}

function onInstalled() {
  CalendarManager.pollServer();
  localStorageSet('lastPollTime', 0);
}

chrome.runtime.onInstalled.addListener(onInstalled);
chrome.webNavigation.onCompleted.addListener(onCompleted,
    {url: [{hostSuffix: 'calendar.google.com', pathPrefix: '/calendar'},
           {hostSuffix: 'www.google.com', pathPrefix: '/accounts'},
           {hostSuffix: 'www.google.com', pathPrefix: '/a'}]});

/////////////////////////////////////////////////////////////////////

//
// LocalStorage
//

/**
 * Sets |key| as |value| in localStorage. |value| may be any JavaScript object;
 * this method will automatically stringify to JSON if needed.
 */
function localStorageSet(key, value) {
  if (typeof value == 'undefined') {
    // Don't try to stringify undefined, or bad things may happen (particularly
    // in localStorageGet, so let's be consistent).
    delete localStorage[LOCALSTORAGE_PREFIX + key];
  } else {
    localStorage[LOCALSTORAGE_PREFIX + key] = JSON.stringify(value);
  }
}

/**
 * Gets the JavaScript object at |key| from localStorage, defaulting to |deflt|
 * if it hasn't been set. Assumes that the value was written by localStorageSet
 * (i.e. stored as JSON).
 */
function localStorageGet(key, deflt) {
  var value = localStorage[LOCALSTORAGE_PREFIX + key];
  var returnValue;
  try {
    returnValue = (typeof value == 'undefined') ? deflt : JSON.parse(value);
  } catch (e) {
    logError(new Error("ERROR: gcalendar localStorageGet: " + key));
    throw new Error("gcalendar localStorageGet: " + key + " => " + value);
  } 
  return returnValue;
}

/////////////////////////////////////////////////////////////////////

var DATE_TIME_REGEX =
  /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)\.\d+(\+|-)(\d\d):(\d\d)$/;
var DATE_TIME_REGEX_Z = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)\.\d+Z$/;
var DATE_REGEX = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;

/**
* Convert the incoming date into a javascript date.
* @param {String} rfc3339 The rfc date in string format as following
*     2006-04-28T09:00:00.000-07:00
*     2006-04-28T09:00:00.000Z
*     2006-04-19.
* @return {Date} The javascript date format of the incoming date.
*/
function rfc3339StringToDate(rfc3339) {
  var parts = DATE_TIME_REGEX.exec(rfc3339);

  // Try out the Z version
  if (!parts) {
    parts = DATE_TIME_REGEX_Z.exec(rfc3339);
  }

  if (parts && parts.length > 0) {
    var d = new Date();
    d.setUTCFullYear(parts[1], parseInt(parts[2], 10) - 1, parts[3]);
    d.setUTCHours(parts[4]);
    d.setUTCMinutes(parts[5]);
    d.setUTCSeconds(parts[6]);

    var tzOffsetFeedMin = 0;
    if (parts.length > 7) {
      tzOffsetFeedMin = parseInt(parts[8], 10) * 60 + parseInt(parts[9], 10);
      if (parts[7] != '-') { // This is supposed to be backwards.
        tzOffsetFeedMin = -tzOffsetFeedMin;
      }
    }
    return new Date(d.getTime() + tzOffsetFeedMin * 60 * 1000);
  }

  parts = DATE_REGEX.exec(rfc3339);
  if (parts && parts.length > 0) {
    return new Date(parts[1], parseInt(parts[2], 10) - 1, parts[3]);
  }
  return null;
}

/////////////////////////////////////////////////////////////////////

/*
 * Fires once per minute to fetch
 */
function refetch() {
  CalendarManager.pollServer();
}

requestAuthBackground(refetch);

//window.setInterval(refetch, POLL_INTERVAL);
window.fetchScheduler.addHandlerFromTopLevelOnly(refetch);

function onMessage(request, sender, sendResponse) {
  if (request == "get-calendar-events") {
    isAuthorized || !navigator.onLine
      ? sendResponse(localStorageGet('eventList'))
      : sendResponse('forbidden');
  } 
  else if (request == "prompt-calendar-auth") {
    requestAuthPrompt();
  } 
  else if (request == "is-calendar-authorized") {
    sendResponse(isAuthorized);
  }
}

window.get_calendar_events = function() {
  return localStorageGet('eventList');
}

window.is_calendar_authorized = function() {
  return isAuthorized;
}

window.calendar_check_auth = checkAuthBackground;

chrome.runtime.onMessage.addListener(onMessage);

})();


/*
// trying to get web auth flow working for other Chromium browsers like
// Edge, Brave, Vivaldi etc.
let urlBase = 'https://accounts.google.com/o/oauth2/v2/auth';
const manifest = chrome.runtime.getManifest();
const clientId = manifest.oauth2.client_id;
const redirectURL = chrome.identity.getRedirectURL("oauth2");
const auth_params = {
  client_id: '1024356103437-7a7n0ju1vvu12cijrt138jv1vdtjnneg.apps.googleusercontent.com',
  redirect_uri: 'https://www.homenewtab.com/oauth2',
  response_type: 'token', // or??   response_type: 'code', access_type: 'offline',  
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
};
const searchParams = new URLSearchParams(auth_params);
const url = `${urlBase}?${searchParams.toString()}`;
await chrome.identity.launchWebAuthFlow({url: url, interactive: true})
*/

/*
{
    "kind": "calendar#event",
    "etag": "\"3071777414547000\"",
    "id": "_6ko3ahhm60q3iba3893...",
    "status": "confirmed",
    "htmlLink": "https://www.google.com/calendar/event?eid=XzZrbzNhaGht...",
    "created": "2018-08-29T15:07:46.000Z",
    "updated": "2018-09-06T08:22:28.205Z",
    "summary": "Levi logo",
    "description": "Dummy desc",
    "location": "...",
    "creator": {
        "email": "dummy@gmail.com",
        "displayName": "Dummy",
        "self": true
    },
    "organizer": {
        "email": "dummy@gmail.com",
        "displayName": "Dummy",
        "self": true
    },
    "start": {
        "dateTime": "2018-09-06T17:00:00+02:00",
        "timeZone": "Europe/Budapest"
    },
    "end": {
        "dateTime": "2018-09-06T18:00:00+02:00",
        "timeZone": "Europe/Budapest"
    },
    "recurringEventId": "_6ko3ahhm60q3iba389342b9k68pj...",
    "originalStartTime": {
        "dateTime": "2018-09-06T17:00:00+02:00",
        "timeZone": "Europe/Budapest"
    },
    "iCalUID": "505F6049-CBFA-42...",
    "sequence": 0,
    "reminders": {
        "useDefault": false,
        "overrides": [
            {
                "method": "popup",
                "minutes": 30
            },
            {
                "method": "popup",
                "minutes": 360
            }
        ]
    }
}
*/