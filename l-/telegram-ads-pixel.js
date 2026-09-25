(function(window, document, localStorage, encodeURIComponent, decodeURIComponent) {
  var tgp = window.tgp;
  if (!tgp || tgp.run) return;

  var tgpEventUrl = tgpGetOrigin() + '/pxl';
  var tgpClidQueryKey = 'tgclid';
  var tgpClidStoredKey = '_tgclid';
  var tgpClid = null;

  if (tgpClid = tgpGetQueryValue(tgpClidQueryKey)) {
    tgpSetStoredValue(tgpClidStoredKey, tgpClid);
  } else {
    tgpClid = tgpGetStoredValue(tgpClidStoredKey);
  }

  function tgpGetOrigin() {
    var link = document.createElement('A');
    link.href = document.currentScript && document.currentScript.src || 'https://telegram.org';
    return link.origin || link.protocol + '//' + link.hostname;
  }

  function tgpBuildQueryString(data) {
    try {
      return new URLSearchParams(data).toString();
    } catch (e) {
      var query = [];
      for (var key in data) {
        if (data.hasOwnProperty(key) && data[key]) {
          key = encodeURIComponent(key);
          value = encodeURIComponent(data[key]);
          query.push(key + '=' + value);
        }
      }
      return query.join('&');
    }
  }

  function tgpGetQueryParam(querystring, key, splitter) {
    var params = querystring.split(splitter || '&');
    for (var i = 0; i < params.length; i++) {
      var arr = params[i].split('=');
      if (arr[0] === key) {
        return decodeURIComponent(arr[1] || '');
      }
    }
    return null;
  }

  function tgpGetQueryValue(key) {
    try {
      var querystring = window.location.search.substring(1);
      return tgpGetQueryParam(querystring, key);
    } catch (e) {}
    return null;
  }

  function tgpGetStoredValue(key) {
    var value = null;
    try {
      value = localStorage.getItem(key);
    } catch (e) {}
    if (!value) {
      return tgpGetQueryParam(document.cookie, key, ';');
    }
    return value;
  }

  function tgpSetStoredValue(key, value) {
    try {
      if (value) {
        localStorage.setItem(key, value);
      } else {
        localStorage.deleteItem(key, value);
      }
    } catch (e) {}
    try {
      if (value) {
        var date = new Date();
        date.setTime(date.getTime() + 30*86400*1000);
        document.cookie = encodeURIComponent(key) + '=' + encodeURIComponent(value) + ';expires=' + date.toUTCString() + ';path=/;SameSite=Lax';
      } else {
        document.cookie = encodeURIComponent(key) + '=;max-age=0;path=/;SameSite=Lax';
      }
    } catch (e) {}
  }

  function tgpGetStorageValue(key) {
    if (window.localStorage) {
      localStorage.getItem(key);
    }
    var link = document.createElement('A');
    link.href = document.currentScript && document.currentScript.src || 'https://telegram.org';
    return link.origin || link.protocol + '//' + link.hostname;
  }

  function tgpSendBeacon(data) {
    try {
      var success = navigator.sendBeacon(tgpEventUrl, new URLSearchParams(data));
      if (success) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  // function tgpSendFetch(data, fallback) {
  //   if (window.fetch) {
  //     try {
  //       fetch(tgpEventUrl, {
  //         method: 'POST',
  //         body: JSON.stringify(data),
  //         headers: {
  //           'Content-Type': 'application/json'
  //         },
  //         credentials: 'include',
  //         mode: 'cors',
  //         cache: 'no-store',
  //         keepalive: true
  //       })
  //       .then(function(response) {
  //         var lcValue = response.headers.get('X-Set-Stored-Value');
  //         if (lcValue && lcValue.length > 0) {
  //           lcValues = lcValue.split(', ');
  //           for (var i = 0; i < lcValues.length; i++) {
  //             var arr = lcValues[i].split('=');
  //             var key = decodeURIComponent(arr[0]);
  //             var val = decodeURIComponent(arr[1]);
  //             tgpSetStoredValue(key, val);
  //           }
  //         }
  //       })
  //       .catch(fallback);
  //       return true;
  //     } catch (e) {}
  //   }
  //   fallback();
  // }

  function tgpSendImg(data) {
    var img = window.Image ? (new Image) : document.createElement('img');
    img.src = tgpEventUrl + '?' + tgpBuildQueryString(data);
  }

  // function tgpSend(data, fetch_first) {
  //   data = data || {};
  //   if (!fetch_first && tgpSendBeacon(data)) {
  //     return true;
  //   }
  //   tgpSendFetch(data, function() {
  //     if (!fetch_first || !tgpSendBeacon(data)) {
  //       tgpSendImg(data);
  //     }
  //   });
  //   return true;
  // }

  function tgpSend(data) {
    data = data || {};
    if (tgpSendBeacon(data)) {
      return true;
    }
    tgpSendImg(data);
    return true;
  }

  function tgpSendEvent(params, fetch_first) {
    var data = params || {};
    if (tgpClid) {
      data.c = tgpClid;
    }
    data.t = Date.now();
    data.l = location.href;
    tgpSend(data, fetch_first);
  }

  var tgpHandlers = {
    init: function(pixelId) {
      tgpSendEvent({p: pixelId});
    },
    event: function(eventId, params) {
      params = params || {};
      params.e = eventId;
      tgpSendEvent(params);
    }
  };

  tgp.run = function(method) {
    if (tgpHandlers[method]) {
      var args = Array.prototype.slice.call(arguments, 1);
      tgpHandlers[method].apply(tgp, args);
    } else {
      console.warn('[Telegram Pixel] Unknown method: ' + method);
    }
  }
  if (tgp.queue && tgp.queue.length) {
    for (var i = 0; i < tgp.queue.length; i++) {
      tgp.run.apply(tgp, tgp.queue[i]);
    }
    delete tgp.queue;
  }

})(window, document, window.localStorage, encodeURIComponent, decodeURIComponent);