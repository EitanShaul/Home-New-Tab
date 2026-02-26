// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

function is_today(date) {
  return (new Date).toDateString() == date.toDateString();
}
function is_right_now(start, end) {
  var today = new Date;
  return +today >= +start && +today <= +end;
}

// it assumes a date in the future (google calendar)
function format_day(date, end_date) {
  var today = new Date;

  if (is_right_now(date, end_date)) {
    //return '<b style="color: #ffd400;" class="circle">●</b> ' +   // ● ◉
    return '<i class="fas fa-circle"></i> ' +
           '<b class="bolder">RIGHT NOW</b>';
  } 

 
  if (is_today(date)) {
    return '<b class="bolder">TODAY</b>';
  } 

  var tomorrow = new Date;
  tomorrow.setDate(tomorrow.getDate()+1);
  if (tomorrow.toDateString() == date.toDateString()) {
    return 'Tomorrow';
  } 

  var end_of_week = new Date()
  var day = today.getDay();
  end_of_week.setDate( 7 + today.getDate() - day + (day == 0 ? -6 : 1)  );
  end_of_week.setHours(0)
  end_of_week.setMinutes(0);
  if (+date < +end_of_week) {
    return days[date.getDay()];
  }

  var end_of_next_week = new Date(end_of_week)
  end_of_next_week.setDate( end_of_week.getDate() + 7 );
  if (+date < +end_of_next_week) {
    return 'Next ' + days[date.getDay()];
  }

  return getDayMonthDate(date); // date.toLocaleDateString();
}

function format_event_title(event) {
  if (!event.title) return;
  if (is_today(event.start) || is_right_now(event.start, event.end)) 
    return '<b class="title bolder">' + event.title + '</b>';
  else
    return '<b class="title">' + event.title+ '</b>';
}

function refresh_event_lazy(events) {

  if ('string' == typeof events && events == 'forbidden') {
    byId('upcoming-event').innerHTML = "Click To Enable<br>Calendar Events";
    byId('upcoming-event').classList.add('forbidden');
    byId('upcoming-event').style.display = '';
    byId('datetime').classList.remove('no-event');
    delete stored.GCAL_cached_event;
    return;
  }

  // no events found (or url is down)
  // calendar notifications turned off
  var notiSetting = settings.notifications['ejjicmeblgpmajnghnpcppodonldlgfn'];
  if (!events || !events.length || notiSetting === false) {
    byId('upcoming-event').innerHTML = '';
    byId('upcoming-event').style.display = 'none';
    byId('datetime').classList.add('no-event');
    return;
  }

  // everything is ok
  var event = events[0];

  var too_distant = (new Date(event.startTime) > Date.now() + 2 * DAYS);
  if (too_distant)
    return;

  byId('upcoming-event').style.display = '';
  byId('upcoming-event').classList.remove('forbidden');
  byId('datetime').classList.remove('no-event');

  displayed_event = event;
  stored.GCAL_cached_event = JSON.stringify(event);

  event.start = new Date(event.startTime);
  event.end = new Date(event.endTime);


  var start = format_time(event.start);
  var end = format_time(event.end);
  var day = format_day(event.start, event.end);
  var title = format_event_title(event);

  var arr = [];

   /// NOTE: doesn't support multi-day events
  day && arr.push('<span class="day" id="upcoming-event-day">' + day + '</span>');

  title && arr.push(title);
  // event.description  && arr.push(event.description);
  // event.location  && arr.push(event.location);

  if (event.end - event.start != 86400000) {
    arr.push(start + ' - ' + end);
  } else {
    arr.push('All Day');
  }
  
  byId('upcoming-event').innerHTML = arr.join('<br/>');
  byId('upcoming-event').href = event.url;
}

byId('upcoming-event').onclick = function () {
  if (byId('upcoming-event').classList.contains('forbidden')) {
    chrome.runtime.sendMessage("prompt-calendar-auth");
  }
}

function get_calendar_icon() {

  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var date = new Date;

  var week_day = days[date.getDay()];
  var year = date.getFullYear();
  var month = months[date.getMonth()];
  var month_day = date.getDate();

  return '<div id="cal-icon-overlay" class="fit"></div>' +
         '<div id="cal-icon">' +
          '<div id="cal-icon-content">' +
            '<div id="cal-icon-header">'+ month +'</div>' +
            '<div id="cal-icon-month-day">'+ month_day +'</div>' +
            '<div id="cal-icon-week-day">'+ week_day +'</div>' +
          '</div>' +
        '</div>';
}

