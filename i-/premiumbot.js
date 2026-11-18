/* Premium Bot Mini App: plain classic JavaScript, no build step. */
window.PremiumApp = (function() {
  'use strict';

  var POLL_INTERVAL = 1500;
  var POLL_TIMEOUT = 120000;
  var picker = null;
  var pickerSequence = 0;
  var mainButtonHandler = null;
  var mainButtonMode = false;
  var pressDelegate = null;
  var bound = [];

  function webApp() {
    return window.Telegram && window.Telegram.WebApp;
  }

  function on(element, eventName, handler) {
    if (!element) {
      return;
    }
    element.addEventListener(eventName, handler, false);
    bound.push([element, eventName, handler]);
  }

  function bind(selector, eventName, handler) {
    var elements = document.querySelectorAll(selector);
    for (var i = 0; i < elements.length; i++) {
      on(elements[i], eventName, handler);
    }
  }

  function unbindAll() {
    for (var i = 0; i < bound.length; i++) {
      bound[i][0].removeEventListener(bound[i][1], bound[i][2], false);
    }
    bound = [];
  }

  // ===== Theme and platform classes on <html> =====

  function applyBridgeClasses() {
    var app = webApp();
    var root = document.documentElement;
    if (!app) {
      return;
    }
    var dark = app.colorScheme === 'dark';
    root.classList.toggle('theme-dark', dark);
    root.classList.toggle('theme-light', !dark);
    // The light field's dark variant: the accent adds light instead of a white bloom (fx.css .fx-stage--dark).
    var stages = document.querySelectorAll('.fx-light__stage, .fx-stage');
    for (var i = 0; i < stages.length; i++) {
      stages[i].classList.toggle('fx-stage--dark', dark);
    }
    var platform = app.platform || '';
    root.classList.remove('platform-ios', 'platform-android', 'platform-desktop');
    if (platform === 'ios') {
      root.classList.add('platform-ios');
    } else if (platform === 'android') {
      root.classList.add('platform-android');
    } else if (platform) {
      root.classList.add('platform-desktop');
    }
    if (app.setHeaderColor) {
      app.setHeaderColor('bg_color');
    }
    if (app.setBackgroundColor) {
      app.setBackgroundColor('bg_color');
    }
  }

  // ===== Toasts =====

  function showMessage(text, isError) {
    var region = document.querySelector('.toast-region');
    var live = document.getElementById('pm-live');
    if (region) {
      var toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = text;
      region.appendChild(toast);
      setTimeout(function() {
        toast.classList.add('is-leaving');
        setTimeout(function() {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 220);
      }, 3400);
    }
    if (live) {
      live.textContent = text;
    }
  }

  function clearMessage() {
    var region = document.querySelector('.toast-region');
    if (region) {
      while (region.firstChild) {
        region.removeChild(region.firstChild);
      }
    }
  }

  // ===== Haptics =====

  function hapticSelection() {
    var app = webApp();
    if (app && app.HapticFeedback && app.isVersionAtLeast('6.1')) {
      try {
        app.HapticFeedback.selectionChanged();
      } catch (error) {}
    }
  }

  function hapticNotify(type) {
    var app = webApp();
    if (app && app.HapticFeedback && app.isVersionAtLeast('6.1')) {
      try {
        app.HapticFeedback.notificationOccurred(type);
      } catch (error) {}
    }
  }

  // ===== Native MainButton =====

  function mainButtonAvailable() {
    var app = webApp();
    return !!(app && app.MainButton && app.isVersionAtLeast && app.isVersionAtLeast('6.0'));
  }

  function mainButtonSet(text) {
    var app = webApp();
    if (!app) {
      return;
    }
    app.MainButton.setParams({
      text: text,
      is_visible: true,
      is_active: true,
      color: '#7356f6',
      text_color: '#ffffff'
    });
  }

  function hideMainButton() {
    var app = webApp();
    if (app && app.MainButton) {
      if (mainButtonHandler) {
        app.MainButton.offClick(mainButtonHandler);
      }
      app.MainButton.hide();
    }
    mainButtonHandler = null;
    mainButtonMode = false;
    document.documentElement.classList.remove('has-main-button');
  }

  function ctaButton() {
    return document.getElementById('pm-cta');
  }

  function ctaCurrentUrl() {
    var button = ctaButton();
    return button ? button.getAttribute('data-invoice-url') : '';
  }

  function ctaCurrentFlow() {
    var button = ctaButton();
    var flow = button ? button.getAttribute('data-result-flow') : '';
    return flow || inferResultFlow();
  }

  function ctaClick() {
    var url = ctaCurrentUrl();
    if (url) {
      openInvoice(url, ctaCurrentFlow());
    }
  }

  function ctaLabel(button) {
    return button.querySelector('.cta-label') || button;
  }

  function ctaUpdate(text, url) {
    var button = ctaButton();
    if (!button) {
      return;
    }
    if (text) {
      ctaLabel(button).textContent = text;
    }
    if (url) {
      button.setAttribute('data-invoice-url', url);
    }
    button.setAttribute('aria-disabled', ctaCurrentUrl() ? 'false' : 'true');
    if (mainButtonMode === 'cta') {
      mainButtonSet(text || ctaLabel(button).textContent);
    }
  }

  function ctaInit() {
    var button = ctaButton();
    if (!button) {
      return false;
    }
    button.setAttribute('aria-disabled', ctaCurrentUrl() ? 'false' : 'true');
    // The pill's glow breathes and its arrow knocks while the page is lit.
    button.classList.add('is-lit');
    return true;
  }

  function resultButtonInit() {
    if (!mainButtonAvailable()) {
      return;
    }
    var pathname = window.location.pathname;
    if (pathname.indexOf('/premiumbot/result/') !== 0) {
      return;
    }
    mainButtonMode = 'result';
    mainButtonSet('BACK TO PREMIUM');
    mainButtonHandler = function() {
      Aj.location('/premiumbot');
    };
    webApp().MainButton.onClick(mainButtonHandler);
    document.documentElement.classList.add('has-main-button');
  }

  // ===== Invoices =====

  function setButtonBusy(button, busy) {
    if (!button) {
      return;
    }
    button.disabled = !!busy;
    button.classList.toggle('is-loading', !!busy);
    button.classList.toggle('is-busy', !!busy);
    if (button.classList && (button.classList.contains('cell') || button.classList.contains('pack-tile'))) {
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
      var spinner = button.querySelector('.cell-busy');
      if (spinner) {
        spinner.hidden = !busy;
      }
      var value = button.querySelector('.cell-value');
      if (value) {
        value.hidden = !!busy;
      }
    }
  }

  function openInvoice(url, resultFlow) {
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
          hapticNotify('success');
          Aj.location('/premiumbot/result/paid/' + (resultFlow || 'premium'));
          return;
        }
        if (status === 'pending') {
          showMessage('Payment is pending. Your selection is kept; please check again shortly.', false);
          return;
        }
        if (status === 'failed') {
          hapticNotify('error');
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

  // ===== Plan and gift-card selection (radio -> CTA) =====

  function onPlanOptionChange(input) {
    var url = input.getAttribute('data-invoice-url');
    var text = input.getAttribute('data-cta-text');
    if (url && text) {
      ctaUpdate(text, url);
    }
    hapticSelection();
  }

  // ===== Giveaway matrix (duration x winners -> option) =====

  function giveawayMatrix() {
    return document.querySelector('.js-gw-matrix');
  }

  function giveawayOptions() {
    var matrix = giveawayMatrix();
    if (!matrix) {
      return [];
    }
    var nodes = matrix.querySelectorAll('.js-gw-option');
    var records = [];
    for (var i = 0; i < nodes.length; i++) {
      records.push({
        months: nodes[i].getAttribute('data-months'),
        stars: nodes[i].getAttribute('data-stars'),
        users: nodes[i].getAttribute('data-users'),
        boosts: nodes[i].getAttribute('data-boosts'),
        price: nodes[i].getAttribute('data-price'),
        ctaText: nodes[i].getAttribute('data-cta-text'),
        url: nodes[i].getAttribute('data-invoice-url')
      });
    }
    return records;
  }

  function giveawayChecked(name) {
    var input = document.querySelector('.js-gw-' + name + ':checked');
    return input ? input.value : '';
  }

  function giveawayFind(records, flow, dur, users) {
    for (var i = 0; i < records.length; i++) {
      var durValue = flow === 'premium' ? records[i].months : records[i].stars;
      if (durValue === dur && records[i].users === users) {
        return records[i];
      }
    }
    return null;
  }

  function giveawayUsersFor(records, flow, dur) {
    var users = {};
    for (var i = 0; i < records.length; i++) {
      var durValue = flow === 'premium' ? records[i].months : records[i].stars;
      if (durValue === dur) {
        users[records[i].users] = records[i];
      }
    }
    return users;
  }

  function giveawayFill(template, record) {
    var text = template;
    if (record) {
      text = text.split('{users}').join(record.users)
        .split('{boosts}').join(record.boosts)
        .split('{price}').join(record.price)
        .split('{stars}').join(record.stars);
    }
    return text;
  }

  function giveawayUpdate() {
    var matrix = giveawayMatrix();
    if (!matrix) {
      return;
    }
    var flow = matrix.getAttribute('data-flow') || 'premium';
    var records = giveawayOptions();
    var users = giveawayChecked('users');
    var durInputs = document.querySelectorAll('.js-gw-dur');
    var anyEnabled = false;
    for (var i = 0; i < durInputs.length; i++) {
      var record = giveawayFind(records, flow, durInputs[i].value, users);
      var priceSpans = document.querySelectorAll('.js-gw-dur-price[data-dur="' + durInputs[i].value + '"]');
      for (var p = 0; p < priceSpans.length; p++) {
        priceSpans[p].textContent = record ? record.price : '—';
      }
      var boostsSpans = document.querySelectorAll('.js-gw-dur-boosts[data-dur="' + durInputs[i].value + '"]');
      for (var b = 0; b < boostsSpans.length; b++) {
        boostsSpans[b].textContent = record ? giveawayFill(matrix.getAttribute('data-tpl-boosts') || '', record) : '';
      }
      durInputs[i].disabled = !record;
      var label = durInputs[i].closest('label');
      if (label) {
        label.classList.toggle('is-disabled', !record);
      }
      if (record) {
        anyEnabled = true;
      }
    }
    if (!anyEnabled) {
      return;
    }
    var checked = document.querySelector('.js-gw-dur:checked');
    if (!checked || checked.disabled) {
      for (var j = 0; j < durInputs.length; j++) {
        if (!durInputs[j].disabled) {
          durInputs[j].checked = true;
          break;
        }
      }
    }
    users = giveawayChecked('users');
    var dur = giveawayChecked('dur');
    var picked = giveawayFind(records, flow, dur, users);
    var footer = document.querySelector('.js-gw-footer');
    if (footer) {
      footer.textContent = giveawayFill(matrix.getAttribute('data-tpl-footer') || '', picked);
    }
    if (picked) {
      // Per-combination footer needs boosts from the picked record only.
      if (footer) {
        footer.textContent = giveawayFill(matrix.getAttribute('data-tpl-footer') || '', picked);
      }
      var cta = giveawayFill(matrix.getAttribute('data-tpl-cta') || '', picked);
      ctaUpdate(cta || picked.ctaText, picked.url);
    }
  }

  // ===== Peer picker (native request through the existing web methods) =====

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
      request_id: current.peerRequestId
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
      webApp().requestChat(current.webappRequestId, function(sent) {
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
      webappRequestId: '',
      peerRequestId: 0,
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
      if (result.error || !result.webapp_req_id || !result.request_id) {
        finishPickerWithError('Unable to prepare the Telegram picker. Please try again.');
        return;
      }
      picker.webappRequestId = result.webapp_req_id;
      picker.peerRequestId = result.request_id;
      picker.startedAt = Date.now();
      hapticSelection();
      requestNativePeer();
    });
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
      var legacy = container ? container.querySelector('.pm-picker-legacy') : null;
      if (legacy) {
        legacy.hidden = false;
        var status = container.querySelector('.pm-picker-status');
        if (status) {
          status.textContent = 'Send ' + command + ' to @' + username + ' to use this flow in the existing bot chat.';
        }
        var link = document.createElement('a');
        link.href = baseUrl;
        link.className = 'cell cell--action is-tappable fx-press island';
        link.innerHTML = '<span class="cell-main"><span class="cell-title">Open @' + username + '</span></span>';
        link.addEventListener('click', function(event) {
          event.preventDefault();
          openBot();
        }, false);
        legacy.appendChild(link);
      } else {
        openBot();
      }
    }
  }

  // ===== Show-more packs =====

  function showMorePacks(button) {
    var extras = document.querySelectorAll('.js-pack-extra');
    for (var i = 0; i < extras.length; i++) {
      extras[i].hidden = false;
    }
    button.hidden = true;
  }

  // ===== Press effect =====

  function setupPress() {
    pressDelegate = function(event) {
      var target = event.target && event.target.closest ? event.target.closest('.fx-press') : null;
      if (!target) {
        return;
      }
      if (event.type === 'pointerdown') {
        target.classList.add('is-pressed');
      } else {
        target.classList.remove('is-pressed');
      }
    };
    document.addEventListener('pointerdown', pressDelegate, true);
    document.addEventListener('pointerup', pressDelegate, true);
    document.addEventListener('pointercancel', pressDelegate, true);
    document.addEventListener('pointerleave', pressDelegate, true);
  }

  function teardownPress() {
    if (!pressDelegate) {
      return;
    }
    document.removeEventListener('pointerdown', pressDelegate, true);
    document.removeEventListener('pointerup', pressDelegate, true);
    document.removeEventListener('pointercancel', pressDelegate, true);
    document.removeEventListener('pointerleave', pressDelegate, true);
    pressDelegate = null;
  }

  // ===== Page lifecycle =====

  function cleanup() {
    stopPicker();
    hideMainButton();
    unbindAll();
    teardownPress();
    if (window.PremiumLottie) {
      window.PremiumLottie.destroy();
    }
    if (window.Premium3D) {
      window.Premium3D.destroy();
    }
    if (window.PremiumFx) {
      window.PremiumFx.destroy();
    }
  }

  function init() {
    cleanup();
    applyBridgeClasses();
    setupPress();
    var app = webApp();
    if (app && app.onEvent) {
      // themeChanged is user-triggered while the app stays open.
      try {
        app.onEvent('themeChanged', applyBridgeClasses);
      } catch (error) {}
    }
    bind('.js-invoice', 'click', function() {
      if (this.getAttribute('aria-disabled') === 'true' || this.getAttribute('aria-busy') === 'true') {
        return;
      }
      var flow = this.getAttribute('data-result-flow') || inferResultFlow();
      openInvoice(this.getAttribute('data-invoice-url'), flow);
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
    bind('.js-plan-option', 'change', function() {
      onPlanOptionChange(this);
    });
    bind('.js-gw-dur', 'change', function() {
      giveawayUpdate();
      hapticSelection();
    });
    bind('.js-gw-users', 'change', function() {
      giveawayUpdate();
      hapticSelection();
    });
    bind('.js-show-more', 'click', function() {
      showMorePacks(this);
    });
    bind('[data-haptic="selection"]', 'click', hapticSelection);
    if (!ctaInit()) {
      resultButtonInit();
    }
    giveawayUpdate();
    var title = document.querySelector('.hero-title, .screen-title');
    if (title) {
      title.focus();
    }
    if (window.PremiumLottie) {
      window.PremiumLottie.mount(document);
    }
    if (window.Premium3D) {
      window.Premium3D.mount(document);
    }
    if (window.PremiumFx) {
      // After the 3D marks are laid out, the fields take their boxes.
      requestAnimationFrame(function() {
        window.PremiumFx.mount(document);
      });
    }
    Aj.onUnload(cleanup);
  }

  function inferResultFlow() {
    var screen = document.querySelector('.screen[data-route]');
    var route = screen ? screen.getAttribute('data-route') : '';
    if (route === 'stars') {
      return 'stars';
    }
    if (route === 'stars/gift') {
      return 'stars_gift';
    }
    if (route === 'giveaway/premium') {
      return 'premium_giveaway';
    }
    if (route === 'giveaway/stars') {
      return 'stars_giveaway';
    }
    if (route === 'gift') {
      return 'gift';
    }
    return 'premium';
  }

  return {
    init: init,
    openInvoice: openInvoice,
    startPicker: startPicker,
    cleanup: cleanup
  };
})();
