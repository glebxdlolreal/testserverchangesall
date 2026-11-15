/* Premium Bot Mini App: plain classic JavaScript, no build step. */
window.PremiumApp = (function() {
  'use strict';

  var POLL_INTERVAL = 1500;
  var POLL_TIMEOUT = 120000;
  var picker = null;
  var pickerSequence = 0;
  var mainAction = false;

  function webApp() {
    return window.Telegram && window.Telegram.WebApp;
  }

  function showMessage(text, isError) {
    var element = document.getElementById('pm-message');
    if (!element) {
      return;
    }
    element.textContent = text;
    element.className = isError ? 'pm-message pm-message-error' : 'pm-message';
    element.hidden = false;
    var live = document.getElementById('pm-live');
    if (live) {
      live.textContent = text;
    }
  }

  function clearMessage() {
    var element = document.getElementById('pm-message');
    if (element) {
      element.hidden = true;
      element.textContent = '';
    }
  }

  function setButtonBusy(button, busy) {
    if (!button) {
      return;
    }
    button.disabled = !!busy;
    if (busy) {
      button.classList.add('is-loading');
    } else {
      button.classList.remove('is-loading');
    }
  }

  function openInvoice(url) {
    var app = webApp();
    if (!app || !url) {
      return;
    }
    if (!app.isVersionAtLeast('6.1')) {
      app.openTelegramLink(url);
      return;
    }
    var buttons = document.querySelectorAll('.js-invoice');
    var button = null;
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute('data-invoice-url') === url) {
        button = buttons[i];
        break;
      }
    }
    setButtonBusy(button, true);
    clearMessage();
    try {
      app.openInvoice(url, function(status) {
        setButtonBusy(button, false);
        if (status === 'paid') {
          Aj.location('/premiumbot/result/paid');
          return;
        }
        if (status === 'pending') {
          showMessage('Payment is pending. Your selection is kept; please check again shortly.', false);
          return;
        }
        if (status === 'failed') {
          showMessage('Payment failed. You can retry with the same option.', true);
          return;
        }
        showMessage('Payment was cancelled. Your selection is unchanged.', false);
      });
    } catch (error) {
      setButtonBusy(button, false);
      showMessage('Unable to open this invoice. Please try again.', true);
    }
  }

  function fallbackToBot(flow, button) {
    var app = webApp();
    if (!app) {
      return;
    }
    var username = window.Aj && Aj.state.botUsername ? Aj.state.botUsername : 'PremiumBot';
    var baseUrl = 'https://t.me/' + username;
    if (flow === 'gift') {
      app.openTelegramLink(baseUrl + '?start=gift');
      return;
    }
    var commands = {
      stars_gift: '/stars',
      premium_giveaway: '/giveaway',
      stars_giveaway: '/stars_giveaway'
    };
    var command = commands[flow] || '/status';
    var openBot = function() {
      app.openTelegramLink(baseUrl);
    };
    if (app.isVersionAtLeast('6.2')) {
      app.showPopup({
        title: 'Continue in @' + username,
        message: 'Send ' + command + ' to @' + username + ' to use this flow in the existing bot chat.',
        buttons: [
          {id: 'open', type: 'default', text: 'Open @' + username},
          {id: 'cancel', type: 'cancel'}
        ]
      }, function(buttonId) {
        if (buttonId === 'open') {
          openBot();
        }
      });
    } else {
      var container = button ? button.closest('.pm-picker') : null;
      var status = container ? container.querySelector('.pm-picker-status') : null;
      if (status) {
        status.textContent = 'Send ' + command + ' to @' + username + ' to use this flow in the existing bot chat.';
        status.appendChild(document.createElement('br'));
        var link = document.createElement('a');
        link.href = baseUrl;
        link.className = 'pm-secondary pm-link';
        link.textContent = 'Open @' + username;
        link.addEventListener('click', function(event) {
          event.preventDefault();
          openBot();
        }, false);
        status.appendChild(link);
      } else {
        openBot();
      }
    }
  }

  function pickerText(text, isError) {
    if (!picker) {
      return;
    }
    var container = picker.button ? picker.button.closest('.pm-picker') : null;
    var status = container ? container.querySelector('.pm-picker-status') : null;
    if (status) {
      status.textContent = text;
      status.classList.toggle('is-error', !!isError);
    }
    if (isError) {
      showMessage(text, true);
    }
  }

  function stopPicker() {
    if (!picker) {
      return;
    }
    picker.cancelled = true;
    if (picker.timer) {
      clearTimeout(picker.timer);
    }
    setButtonBusy(picker.button, false);
    picker = null;
  }

  function finishPickerWithError(text) {
    if (!picker) {
      return;
    }
    pickerText(text, true);
    stopPicker();
  }

  function schedulePoll(delay) {
    if (!picker || picker.cancelled) {
      return;
    }
    picker.timer = setTimeout(pollPeer, delay || POLL_INTERVAL);
  }

  function pollPeer() {
    if (!picker || picker.cancelled || picker.inFlight) {
      return;
    }
    if (Date.now() - picker.startedAt >= POLL_TIMEOUT) {
      finishPickerWithError('Recipient selection timed out. Please try again.');
      return;
    }
    var current = picker;
    picker.inFlight = true;
    Aj.apiRequest('getPeerRequest', {
      flow: current.flow,
      webapp_req_id: current.requestId
    }, function(result) {
      if (!picker || picker.serial !== current.serial || picker.cancelled) {
        return;
      }
      picker.inFlight = false;
      if (result.error === 'PEER_REQUEST_EXPIRED') {
        finishPickerWithError('Recipient selection expired. Please start again.');
        return;
      }
      if (result.error) {
        finishPickerWithError('Unable to read the selection. Please try again.');
        return;
      }
      if (result.status === 'ready' && result.url) {
        var url = result.url;
        stopPicker();
        Aj.location(url);
        return;
      }
      schedulePoll(POLL_INTERVAL);
    });
  }

  function requestNativePeer() {
    if (!picker || picker.cancelled) {
      return;
    }
    var current = picker;
    try {
      webApp().requestChat(current.requestId, function(sent) {
        if (!picker || picker.serial !== current.serial || picker.cancelled) {
          return;
        }
        if (!sent) {
          pickerText('Selection was cancelled.', false);
          stopPicker();
          return;
        }
        pickerText('Waiting for Telegram to share the selection…', false);
        schedulePoll(POLL_INTERVAL);
      });
    } catch (error) {
      fallbackToBot(current.flow, current.button);
      stopPicker();
    }
  }

  function startPicker(flow, chatType, button) {
    var app = webApp();
    if (!app) {
      return;
    }
    if (!app.isVersionAtLeast('9.6')) {
      fallbackToBot(flow, button);
      return;
    }
    stopPicker();
    clearMessage();
    picker = {
      flow: flow,
      chatType: chatType || '',
      button: button,
      requestId: '',
      startedAt: Date.now(),
      serial: ++pickerSequence,
      timer: null,
      inFlight: false,
      cancelled: false
    };
    var current = picker;
    setButtonBusy(button, true);
    pickerText('Preparing the Telegram picker…', false);
    Aj.apiRequest('requestPeer', {
      flow: flow,
      chat_type: current.chatType
    }, function(result) {
      if (!picker || picker.serial !== current.serial || picker.cancelled) {
        return;
      }
      if (result.error || !result.webapp_req_id) {
        finishPickerWithError('Unable to prepare the Telegram picker. Please try again.');
        return;
      }
      picker.requestId = result.webapp_req_id;
      picker.startedAt = Date.now();
      requestNativePeer();
    });
  }

  function filterPlans(button) {
    var group = button.parentNode;
    var filters = group.querySelectorAll('.js-plan-filter');
    for (var i = 0; i < filters.length; i++) {
      filters[i].classList.toggle('is-active', filters[i] === button);
    }
    var constraints = {};
    var rows = document.querySelectorAll('.pm-filters');
    for (var r = 0; r < rows.length; r++) {
      var active = rows[r].querySelector('.js-plan-filter.is-active');
      if (active) {
        var field = active.getAttribute('data-filter-field');
        var value = active.getAttribute('data-filter-value');
        if (value) {
          constraints[field] = value;
        }
      }
    }
    var plans = document.querySelectorAll('.pm-plan');
    for (var j = 0; j < plans.length; j++) {
      var show = true;
      for (var fieldName in constraints) {
        if (Object.prototype.hasOwnProperty.call(constraints, fieldName) &&
            plans[j].getAttribute('data-' + fieldName) !== constraints[fieldName]) {
          show = false;
        }
      }
      plans[j].hidden = !show;
    }
  }

  function mainButtonHandler() {
    if (mainAction === 'home') {
      Aj.location('/premiumbot');
    }
  }

  function bind(selector, eventName, handler) {
    var elements = document.querySelectorAll(selector);
    for (var i = 0; i < elements.length; i++) {
      elements[i].addEventListener(eventName, handler, false);
    }
  }

  function cleanup() {
    stopPicker();
    mainAction = false;
    var app = webApp();
    if (app && app.MainButton) {
      app.MainButton.offClick(mainButtonHandler);
      app.MainButton.hide();
    }
    if (window.PremiumLottie) {
      window.PremiumLottie.destroy();
    }
  }

  function init() {
    cleanup();
    var app = webApp();
    if (app) {
      app.setHeaderColor('bg_color');
      app.setBackgroundColor('bg_color');
    }
    bind('.js-invoice', 'click', function() {
      openInvoice(this.getAttribute('data-invoice-url'));
    });
    bind('.js-request-peer', 'click', function() {
      startPicker(this.getAttribute('data-peer-flow'), this.getAttribute('data-peer-chat-type'), this);
    });
    bind('.js-telegram-link', 'click', function() {
      var appInstance = webApp();
      if (appInstance) {
        appInstance.openTelegramLink(this.getAttribute('data-telegram-url'));
      }
    });
    bind('.js-plan-filter', 'click', function() {
      filterPlans(this);
    });
    if (window.location.pathname.indexOf('/premiumbot/result/') === 0 && app && app.MainButton) {
      mainAction = 'home';
      app.MainButton.setParams({text: 'BACK TO PREMIUM', is_visible: true});
      app.MainButton.onClick(mainButtonHandler);
    }
    var title = document.querySelector('.pm-title');
    if (title) {
      title.focus();
    }
    if (window.PremiumLottie) {
      window.PremiumLottie.mount(document);
    }
    Aj.onUnload(cleanup);
  }

  return {
    init: init,
    openInvoice: openInvoice,
    startPicker: startPicker,
    cleanup: cleanup
  };
})();
