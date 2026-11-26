/* Premium Bot Mini App: plain classic JavaScript, no build step. */
/* The site's loader may run this file again in a document that already has it: the first run stays. */
window.PremiumApp = window.PremiumApp || (function() {
  'use strict';

  var POLL_INTERVAL = 1500;
  var POLL_TIMEOUT = 120000;
  var INVOICE_TIMEOUT = 600000;
  // How long a client other than Android may stay silent on a chat request before the bot is offered in the page.
  var PICKER_QUIET = 4000;
  var INVOICE_GRACE = 2000;
  var PRICE_STEPS = ['', 'price-sides', 'price-type', 'price-lines'];
  // Layout rounds to 1/64 px: an overhang below this is a fit.
  var FIT_SLACK = 0.01;
  // The page prints these on .screen as data-t-<name> in its own language; the English stands in until it does.
  var TEXTS = {
    'pay-failed': 'Payment didn’t go through. Try again or use another card.',
    'pay-open': 'Couldn’t start the payment. Try again.',
    'picker-failed': 'Couldn’t open the list. Try again.',
    'bot-title': 'Continue in {bot}',
    'bot-text': 'Send {command} to {bot} to use this flow in the existing bot chat.',
    'bot-open': 'Open {bot}'
  };
  var picker = null;
  var pickerSequence = 0;
  var silentPicker = false;
  var invoice = null;
  var unanswered = {};
  var pageToken = 0;
  var visits = 0;
  var mainButtonHandler = null;
  var resultBar = null;
  var ctaCopy = null;
  var pageColors = null;
  var colorFrame = 0;
  var toastTimer = 0;
  var liveTimer = 0;
  var pressed = null;
  var bound = [];

  function webApp() {
    return window.Telegram && window.Telegram.WebApp;
  }

  function on(element, eventName, handler, capture) {
    if (!element) {
      return;
    }
    element.addEventListener(eventName, handler, !!capture);
    bound.push([element, eventName, handler, !!capture]);
  }

  function bind(selector, eventName, handler) {
    var elements = document.querySelectorAll(selector);
    for (var i = 0; i < elements.length; i++) {
      on(elements[i], eventName, handler);
    }
  }

  function unbindAll() {
    for (var i = 0; i < bound.length; i++) {
      bound[i][0].removeEventListener(bound[i][1], bound[i][2], bound[i][3]);
    }
    bound = [];
  }

  function scriptText(name, values) {
    var screen = document.querySelector('.screen');
    var result = (screen && screen.getAttribute('data-t-' + name)) || TEXTS[name];
    for (var key in values) {
      result = result.split('{' + key + '}').join(values[key]);
    }
    return result;
  }

  // ===== Theme and platform classes on <html> =====

  function applyBridgeClasses() {
    var app = webApp();
    var root = document.documentElement;
    if (!app) {
      return;
    }
    // Night only: the app paints its own palette, whatever scheme the client is in.
    root.classList.add('theme-dark');
    root.classList.remove('theme-light');
    var stages = document.querySelectorAll('.fx-light__stage, .fx-stage');
    for (var i = 0; i < stages.length; i++) {
      stages[i].classList.add('fx-stage--dark');
    }
    var platform = app.platform || '';
    root.classList.remove('platform-ios', 'platform-android', 'platform-desktop');
    if (platform === 'ios') {
      root.classList.add('platform-ios');
    } else if (platform === 'android' || platform === 'android_x') {
      root.classList.add('platform-android');
    } else if (platform) {
      root.classList.add('platform-desktop');
    }
    matchPageColors();
  }

  // ===== Native header, background and bottom bar in the page's colours =====

  function toHex(color) {
    var parts = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color);
    var scale = 1;
    if (!parts) {
      // WebKit computes a color-mix() to color(srgb r g b), each from 0 to 1.
      parts = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color);
      scale = 255;
    }
    if (!parts) {
      return '';
    }
    var hex = '#';
    for (var i = 1; i <= 3; i++) {
      var value = Math.max(0, Math.min(255, Math.round(parseFloat(parts[i]) * scale)));
      hex += (value < 16 ? '0' : '') + value.toString(16);
    }
    return hex;
  }

  // The colour a custom property holds where `element` sits, as #rrggbb; '' where the engine computes it to nothing.
  function cssColor(element, property) {
    var probe = document.createElement('i');
    probe.style.color = 'var(' + property + ')';
    element.appendChild(probe);
    var color = getComputedStyle(probe).color;
    var inherited = getComputedStyle(element).color;
    element.removeChild(probe);
    return color === inherited ? '' : toHex(color);
  }

  function mixHex(from, to, amount) {
    var hex = '#';
    for (var i = 1; i < 7; i += 2) {
      var start = parseInt(from.substr(i, 2), 16);
      var value = Math.round(start + (parseInt(to.substr(i, 2), 16) - start) * amount);
      hex += (value < 16 ? '0' : '') + value.toString(16);
    }
    return hex;
  }

  function matchPageColors() {
    var app = webApp();
    var screen = document.querySelector('.screen');
    if (!app || !screen) {
      return;
    }
    // A screen that opens on a stage starts in the stage's top colour and runs down to the page's.
    var stage = document.querySelector('.fx-light__stage, .fx-stage');
    var page = cssColor(stage || screen, '--page');
    if (!page) {
      return;
    }
    pageColors = {
      page: page,
      top: (stage && cssColor(stage, '--fx-top')) || page,
      stage: stage,
      header: ''
    };
    try {
      app.setBackgroundColor(page);
      if (app.setBottomBarColor && app.isVersionAtLeast('7.10')) {
        app.setBottomBarColor(page);
      }
    } catch (error) {}
    matchHeaderColor();
  }

  // The header keeps the colour of the row under it while the stage scrolls away.
  function matchHeaderColor() {
    var app = webApp();
    colorFrame = 0;
    if (!app || !pageColors || !app.setHeaderColor) {
      return;
    }
    var height = pageColors.stage ? pageColors.stage.offsetHeight : 0;
    var passed = height > 0 ? Math.max(0, Math.min(1, (window.pageYOffset || 0) / height)) : 1;
    var color = mixHex(pageColors.top, pageColors.page, passed);
    if (color === pageColors.header) {
      return;
    }
    pageColors.header = color;
    try {
      // Before 6.9 the header takes a theme key only.
      app.setHeaderColor(app.isVersionAtLeast('6.9') ? color : 'bg_color');
    } catch (error) {}
  }

  function onPageScroll() {
    if (!colorFrame) {
      colorFrame = requestAnimationFrame(matchHeaderColor);
    }
    piecesSoon();
  }

  // ===== Toasts and the banner =====

  function showMessage(message, isError) {
    var region = document.querySelector('.toast-region');
    var live = document.getElementById('pm-live');
    clearMessage();
    if (region) {
      var toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      region.appendChild(toast);
      toastTimer = setTimeout(function() {
        toast.classList.add('is-leaving');
        toastTimer = setTimeout(function() {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 220);
      }, 3400);
    }
    if (live) {
      // A live region stays silent when its text does not change: it was cleared above and is set a beat later.
      liveTimer = setTimeout(function() {
        live.textContent = message;
      }, 50);
    }
    if (isError) {
      hapticNotify('error');
    }
  }

  function clearMessage() {
    var region = document.querySelector('.toast-region');
    var live = document.getElementById('pm-live');
    clearTimeout(toastTimer);
    clearTimeout(liveTimer);
    if (region) {
      while (region.firstChild) {
        region.removeChild(region.firstChild);
      }
    }
    if (live) {
      live.textContent = '';
    }
  }

  // Icons are masks whose address the page prints inline: another icon's address gives this one's.
  function iconUrl(name) {
    var sample = document.querySelector('.icon[data-icon][style*="--icon"]');
    var value = sample ? sample.style.getPropertyValue('--icon') : '';
    return value ? value.replace(/[^\/'"()]+\.svg/, name + '.svg') : 'url("/img/premiumbot/' + name + '.svg")';
  }

  // An error that stays until the next attempt. A banner never sits above a stage: it tops the sheet over the
  // stage, or follows a stage that has no sheet. An empty message clears it.
  function showBanner(message) {
    var slot = document.querySelector('.screen-banner');
    if (!slot) {
      return false;
    }
    while (slot.firstChild) {
      slot.removeChild(slot.firstChild);
    }
    if (!message) {
      return true;
    }
    var stage = slot.parentNode.querySelector('.fx-stage');
    var sheet = slot.parentNode.querySelector('.fx-stage ~ .fx-sheet');
    if (sheet) {
      sheet.insertBefore(slot, sheet.firstChild);
    } else if (stage) {
      stage.parentNode.insertBefore(slot, stage.nextSibling);
    }
    var banner = document.createElement('div');
    banner.className = 'banner banner--error island';
    banner.setAttribute('role', 'alert');
    var mark = document.createElement('span');
    mark.className = 'banner-mark';
    var icon = document.createElement('span');
    icon.className = 'icon banner-icon';
    icon.setAttribute('data-icon', 'ui-warning');
    icon.setAttribute('aria-hidden', 'true');
    icon.style.setProperty('--icon', iconUrl('ui-warning'));
    var body = document.createElement('span');
    body.className = 'banner-body';
    var line = document.createElement('span');
    line.className = 'banner-text grid-snap';
    line.textContent = message;
    mark.appendChild(icon);
    body.appendChild(line);
    banner.appendChild(mark);
    banner.appendChild(body);
    slot.appendChild(banner);
    // Into view: to the very top when it shows from there, so the stage stays in sight.
    var box = banner.getBoundingClientRect();
    var top = box.top + window.pageYOffset;
    var target = top + box.height <= window.innerHeight ? 0 : Math.max(0, top - 16);
    if (target === 0 ? window.pageYOffset > 0 : box.top < 0 || box.bottom > window.innerHeight) {
      window.scrollTo({top: target, behavior: reducedMotion() ? 'auto' : 'smooth'});
    }
    return true;
  }

  // ===== Haptics =====

  function haptic(method, value) {
    var app = webApp();
    if (app && app.HapticFeedback && app.isVersionAtLeast('6.1')) {
      try {
        app.HapticFeedback[method](value);
      } catch (error) {}
    }
  }

  function hapticSelection() {
    haptic('selectionChanged');
  }

  function hapticNotify(type) {
    haptic('notificationOccurred', type);
  }

  // Every tap is felt once: light for rows, buttons and links, medium for the pay button. A choice ticks when it
  // changes, so its label is left to the change handlers.
  function onTapHaptic(event) {
    var target = event.target && event.target.closest ? event.target.closest('[data-haptic], button, a[href], .is-tappable') : null;
    if (!target || target.tagName === 'LABEL' ||
        target.getAttribute('aria-disabled') === 'true' || target.getAttribute('aria-busy') === 'true') {
      return;
    }
    var kind = target.getAttribute('data-haptic') || (target.classList.contains('js-cta') ? 'medium' : 'light');
    if (kind === 'selection') {
      hapticSelection();
    } else if (kind !== 'none') {
      haptic('impactOccurred', kind);
    }
  }

  // ===== Links that leave the app go through Telegram =====

  function onLinkClick(event) {
    var app = webApp();
    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!app || !link || event.defaultPrevented || link.host === window.location.host || !/^https?:$/.test(link.protocol)) {
      return;
    }
    try {
      if (/^(t|telegram)\.me$/.test(link.hostname)) {
        app.openTelegramLink(link.href);
      } else {
        app.openLink(link.href);
      }
      event.preventDefault();
    } catch (error) {}
  }

  // ===== Native MainButton =====

  function mainButtonAvailable() {
    var app = webApp();
    return !!(app && app.MainButton && app.isVersionAtLeast && app.isVersionAtLeast('6.0'));
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
    if (resultBar && resultBar.parentNode) {
      resultBar.parentNode.removeChild(resultBar);
    }
    resultBar = null;
  }

  function ctaButton() {
    return document.getElementById('pm-cta');
  }

  function ctaCurrentUrl() {
    var button = ctaButton();
    return button ? button.getAttribute('data-invoice-url') : '';
  }

  function ctaLabel(button) {
    return button.querySelector('.cta-label') || button;
  }

  // The label shows its whole text. One the button would cut gives way to the short text, where the page has one.
  function ctaFit() {
    var button = ctaButton();
    if (!button || !ctaCopy) {
      return;
    }
    var label = ctaLabel(button);
    label.textContent = ctaCopy.text;
    if (ctaCopy.short && label.scrollWidth > label.clientWidth) {
      label.textContent = ctaCopy.short;
    }
  }

  function ctaUpdate(text, url, shortText) {
    var button = ctaButton();
    if (!button) {
      return;
    }
    if (text) {
      ctaCopy = {text: text, short: shortText || ''};
      ctaFit();
    }
    if (url) {
      button.setAttribute('data-invoice-url', url);
    }
    button.setAttribute('aria-disabled', ctaCurrentUrl() ? 'false' : 'true');
  }

  function ctaInit() {
    var button = ctaButton();
    if (!button) {
      return false;
    }
    button.setAttribute('aria-disabled', ctaCurrentUrl() ? 'false' : 'true');
    // The pill is lit while the page is.
    button.classList.add('is-lit');
    return true;
  }

  function resultButtonInit() {
    // Playgrounds pin the fake result route here; production takes location.
    var pathname = window.PMA_RESULT_PATH || window.location.pathname;
    if (pathname.indexOf('/premiumbot/result/') !== 0) {
      return;
    }
    var result = document.querySelector('.result-screen');
    var label = (result && result.getAttribute('data-done-text')) || 'Done';
    var done = function() {
      openPage('/premiumbot');
    };
    // A result ends in the page's own bar and button, as every other screen does, so no screen ends in a button of
    // another kind. A client's native button is put away.
    if (mainButtonAvailable()) {
      webApp().MainButton.hide();
    }
    if (result) {
      resultBar = document.createElement('div');
      resultBar.className = 'cta-bar';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cta-button cta-button--premium fx-press';
      var content = document.createElement('span');
      content.className = 'cta-content';
      var line = document.createElement('span');
      line.className = 'cta-line';
      var face = document.createElement('span');
      face.className = 'cta-label';
      face.textContent = label;
      line.appendChild(face);
      content.appendChild(line);
      button.appendChild(content);
      button.addEventListener('click', done, false);
      resultBar.appendChild(button);
      result.appendChild(resultBar);
    }
  }

  // ===== Invoices =====

  function setButtonBusy(button, busy) {
    if (!button) {
      return;
    }
    // Busy, not disabled: the button keeps its look and its focus, and assistive tech hears why it does not answer.
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    button.classList.toggle('is-busy', !!busy);
    var trail = button.classList.contains('cell') ? button.querySelector('.cell-trail') : null;
    if (!trail) {
      return;
    }
    // In a row the spinner takes the place of what the row ends with.
    var spinner = trail.querySelector('.cell-busy');
    if (!spinner && busy) {
      spinner = document.createElement('span');
      spinner.className = 'cell-busy';
      spinner.setAttribute('aria-hidden', 'true');
      trail.appendChild(spinner);
    }
    if (spinner) {
      spinner.hidden = !busy;
    }
    var rest = trail.querySelectorAll('.cell-value, .cell-chevron');
    for (var i = 0; i < rest.length; i++) {
      rest[i].hidden = !!busy;
    }
  }

  function invoiceButton(url) {
    var buttons = document.querySelectorAll('.js-invoice');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute('data-invoice-url') === url) {
        return buttons[i];
      }
    }
    return null;
  }

  function closingConfirmation(enabled) {
    var app = webApp();
    if (app && app.enableClosingConfirmation && app.isVersionAtLeast('6.2')) {
      try {
        if (enabled) {
          app.enableClosingConfirmation();
        } else {
          app.disableClosingConfirmation();
        }
      } catch (error) {}
    }
  }

  function releaseInvoice() {
    if (!invoice) {
      return;
    }
    clearTimeout(invoice.timer);
    document.removeEventListener('pointerdown', noteInvoiceTap, true);
    setButtonBusy(invoice.button, false);
    closingConfirmation(false);
    invoice = null;
  }

  // The client has not answered and still holds the invoice open: it would refuse to open the same one again, so
  // the next try for it goes by its link.
  function giveUpInvoice() {
    if (invoice) {
      unanswered[invoice.url] = true;
      releaseInvoice();
    }
  }

  // iOS sends no answer for an invoice it cannot load. Its checkout covers the page while it shows, so a tap on the
  // page after the grace time means that no checkout is up.
  function noteInvoiceTap() {
    if (invoice && Date.now() - invoice.openedAt >= INVOICE_GRACE) {
      giveUpInvoice();
    }
  }

  // A button may name a second way for when its invoice gives no payment (data-fallback-url): a link the client opens,
  // such as the bot's own flow. It is taken where the invoice cannot be opened and where the payment fails; a
  // payment the user closes is his choice and leads nowhere.
  function invoiceFallback(button) {
    var app = webApp();
    var link = button ? button.getAttribute('data-fallback-url') : '';
    if (!app || !link) {
      return false;
    }
    app.openTelegramLink(link);
    return true;
  }

  function openInvoice(url, resultFlow, button) {
    var app = webApp();
    if (!app || !url) {
      return;
    }
    if (!app.isVersionAtLeast('6.1') || unanswered[url]) {
      app.openTelegramLink(url);
      return;
    }
    if (invoice) {
      if (invoice.url === url) {
        return;
      }
      giveUpInvoice();
    }
    var current = {
      url: url,
      button: button || invoiceButton(url),
      openedAt: Date.now(),
      page: pageToken,
      timer: setTimeout(giveUpInvoice, INVOICE_TIMEOUT)
    };
    invoice = current;
    setButtonBusy(current.button, true);
    clearMessage();
    showBanner('');
    closingConfirmation(true);
    if (app.platform === 'ios') {
      document.addEventListener('pointerdown', noteInvoiceTap, true);
    }
    try {
      app.openInvoice(url, function(status) {
        delete unanswered[url];
        if (invoice === current) {
          releaseInvoice();
        }
        // The answer can come after the page that asked has gone.
        if (current.page !== pageToken) {
          return;
        }
        // A status this script does not know may hide a payment, as 'pending' does: only the server can tell.
        if (status !== 'paid' && status !== 'failed' && status !== 'cancelled') {
          status = 'pending';
        }
        if (status === 'paid') {
          hapticNotify('success');
          openPage('/premiumbot/result/paid/' + (resultFlow || 'premium'));
        } else if (status === 'pending') {
          openPage('/premiumbot/result/pending/' + (resultFlow || 'premium'));
        } else if (status === 'failed') {
          hapticNotify('error');
          if (!invoiceFallback(current.button) && !showBanner(scriptText('pay-failed'))) {
            showMessage(scriptText('pay-failed'), false);
          }
        }
      });
    } catch (error) {
      releaseInvoice();
      if (!invoiceFallback(current.button)) {
        showMessage(scriptText('pay-open'), true);
      }
    }
  }

  // ===== Plan and gift-card selection (radio -> CTA) =====

  function planApply(input) {
    var url = input.getAttribute('data-invoice-url');
    var text = input.getAttribute('data-cta-text');
    if (url && text) {
      ctaUpdate(text, url, input.getAttribute('data-cta-short'));
    }
  }

  // A reload or a step back can restore another radio than the one the server checked.
  function planSync() {
    var input = document.querySelector('.js-plan-option:checked');
    if (input) {
      planApply(input);
    }
  }

  // Gift prices no longer need inside-card fitting: the plan cell layout holds them.

  // ===== Giveaway matrix (duration or amount, then winners -> option) =====

  // The visible prize group when the page carries both prizes (3.8, one-page switch); the lone matrix otherwise.
  function giveawayActive() {
    var both = document.querySelector('[data-prize-both]');
    return both ? both.querySelector('.gw-prize[data-prize="' + both.getAttribute('data-prize-both') + '"]') : null;
  }

  function giveawayMatrix() {
    var active = giveawayActive();
    if (active) {
      return active.querySelector('.js-gw-matrix');
    }
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
        footerText: nodes[i].getAttribute('data-footer-text'),
        url: nodes[i].getAttribute('data-invoice-url')
      });
    }
    return records;
  }

  function giveawayChecked(name) {
    var scope = giveawayActive() || document;
    var input = scope.querySelector('.js-gw-' + name + ':checked');
    return input ? input.value : '';
  }

  // The records of one duration (Premium) or one amount (Stars), by winners count.
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

  // The winners count a duration or an amount takes: the current one where it offers it, else the one the server
  // checked, else its first.
  function giveawayUsersChoice(offered, inputs, current) {
    var choice = '';
    for (var i = 0; i < inputs.length; i++) {
      var value = inputs[i].value;
      if (offered[value]) {
        if (value === current) {
          return value;
        }
        if (!choice || inputs[i].defaultChecked) {
          choice = value;
        }
      }
    }
    return choice;
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

  // Thousands grouped the way the server grouped the amounts on the page: "1,000" or "1 000".
  function giveawayNumber(value, inputs) {
    var group = '';
    for (var i = 0; i < inputs.length && !group; i++) {
      var label = inputs[i].closest('label');
      var title = label ? label.querySelector('.cell-title') : null;
      var match = title ? /\d(\D)\d{3}(?!\d)/.exec(title.textContent) : null;
      group = match ? match[1] : '';
    }
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, group);
  }

  function giveawayWrite(nodes, text) {
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = text;
    }
  }

  function giveawayUpdate() {
    var matrix = giveawayMatrix();
    if (!matrix) {
      return;
    }
    var flow = matrix.getAttribute('data-flow') || 'premium';
    var records = giveawayOptions();
    var scope = giveawayActive() || document;
    var durInputs = scope.querySelectorAll('.js-gw-dur');
    var userInputs = scope.querySelectorAll('.js-gw-users');
    var i;
    if (!giveawayChecked('dur') && durInputs.length) {
      durInputs[0].checked = true;
    }
    // The duration or the amount leads: winners are offered for it alone, so a winners tap never changes it.
    var offered = giveawayUsersFor(records, flow, giveawayChecked('dur'));
    var users = giveawayUsersChoice(offered, userInputs, giveawayChecked('users'));
    var choices = 0;
    for (i = 0; i < userInputs.length; i++) {
      var has = !!offered[userInputs[i].value];
      var chip = userInputs[i].closest('label');
      if (chip) {
        chip.hidden = !has;
      }
      userInputs[i].disabled = !has;
      userInputs[i].checked = userInputs[i].value === users;
      choices += has ? 1 : 0;
    }
    // One count is no choice: the island states it as a plain row in place of the chips.
    var single = choices < 2;
    var chipRow = userInputs.length ? userInputs[0].closest('.chips') : null;
    if (chipRow) {
      chipRow.style.display = single ? 'none' : '';
    }
    for (i = 0; i < durInputs.length; i++) {
      var value = durInputs[i].value;
      // A row shows what choosing it gives: the current winners where it offers them, else its own.
      var rowOffered = giveawayUsersFor(records, flow, value);
      var record = rowOffered[giveawayUsersChoice(rowOffered, userInputs, users)];
      giveawayWrite(scope.querySelectorAll('.js-gw-dur-price[data-dur="' + value + '"]'), record ? record.price : '');
      giveawayWrite(scope.querySelectorAll('.js-gw-dur-boosts[data-dur="' + value + '"]'), record ? giveawayFill(matrix.getAttribute('data-tpl-boosts') || '', record) : '');
    }
    var picked = offered[users];
    var footer = scope.querySelector('.js-gw-footer');
    if (footer) {
      var line = picked ? picked.footerText || giveawayFill(matrix.getAttribute('data-tpl-footer') || '', picked) : '';
      var each = picked ? matrix.getAttribute('data-tpl-each') : '';
      var share = each ? Math.floor(picked.stars / picked.users) : 0;
      var shareText = share > 0 ? each.split('{stars}').join(giveawayNumber(share, durInputs)) : '';
      giveawayFixedRow(chipRow ? chipRow.parentNode : null, single ? line : '', shareText);
      footer.textContent = single ? '' : line + (shareText ? ' · ' + shareText : '');
      footer.hidden = single;
    }
    if (picked) {
      ctaUpdate(giveawayFill(matrix.getAttribute('data-tpl-cta') || '', picked) || picked.ctaText, picked.url);
      return;
    }
    // No option for this pair: the button must not keep the last one's invoice.
    var button = ctaButton();
    if (button) {
      button.setAttribute('data-invoice-url', '');
      button.setAttribute('aria-disabled', 'true');
    }
  }

  // The lone winners count as a row of facts: the count, and each winner's share when the prize is Stars.
  function giveawayFixedRow(island, title, value) {
    if (!island) {
      return;
    }
    var row = island.querySelector('.pm-gw-fixed');
    if (!title) {
      if (row) {
        island.removeChild(row);
      }
      return;
    }
    if (!row) {
      row = document.createElement('div');
      row.className = 'cell cell--value pm-gw-fixed';
      row.innerHTML = '<span class="cell-main"><span class="cell-title"></span></span>'
        + '<span class="cell-trail"><span class="cell-value"></span></span>';
      island.appendChild(row);
    }
    row.querySelector('.cell-title').textContent = title;
    row.querySelector('.cell-value').textContent = value;
  }

  // ===== Peer picker (native request through the existing web methods) =====

  // Each step of a pick, the request, the native picker and the polling, gets this long.
  function pickerWatch(handler) {
    clearTimeout(picker.watch);
    picker.watch = setTimeout(handler, POLL_TIMEOUT);
  }

  function stopPicker() {
    if (!picker) {
      return;
    }
    picker.cancelled = true;
    clearTimeout(picker.timer);
    clearTimeout(picker.watch);
    clearTimeout(picker.quiet);
    setButtonBusy(picker.button, false);
    picker = null;
  }

  function failPicker() {
    if (!picker) {
      return;
    }
    stopPicker();
    showMessage(scriptText('picker-failed'), true);
  }

  function schedulePoll() {
    if (picker && !picker.cancelled) {
      picker.timer = setTimeout(pollPeer, POLL_INTERVAL);
    }
  }

  function pollPeer() {
    if (!picker || picker.cancelled) {
      return;
    }
    var current = picker;
    Aj.apiRequest('getPeerRequest', {
      flow: current.flow,
      request_id: current.peerRequestId
    }, function(result) {
      if (!picker || picker.serial !== current.serial || picker.cancelled) {
        return;
      }
      if (result.error === 'PEER_REQUEST_EXPIRED') {
        failPicker();
        return;
      }
      if (!result.error && result.status === 'ready' && result.url) {
        var url = result.url;
        stopPicker();
        openPage(url);
        return;
      }
      // Any other error may pass with the next check; the watch ends the wait.
      schedulePoll();
    });
  }

  function requestNativePeer() {
    if (!picker || picker.cancelled) {
      return;
    }
    var current = picker;
    // A client that does not implement the request never answers it: the row is freed and the bot offered. An
    // answer that still comes, after a long pick, is taken.
    pickerWatch(function() {
      silentPicker = true;
      setButtonBusy(current.button, false);
      fallbackToBot(current.flow, current.button);
    });
    if (webApp().platform !== 'android') {
      // Only Android is known to answer. Elsewhere a picker may be open over the page by now, so nothing may open
      // over it: after a short silence the bot is offered in the page, under the row.
      current.quiet = setTimeout(function() {
        if (picker !== current || current.cancelled) {
          return;
        }
        if (offerBotInPage(current.flow, current.button)) {
          silentPicker = true;
          clearTimeout(current.watch);
          setButtonBusy(current.button, false);
        }
      }, PICKER_QUIET);
    }
    try {
      webApp().requestChat(current.webappRequestId, function(sent) {
        silentPicker = false;
        clearTimeout(current.quiet);
        withdrawBotInPage(current.button);
        if (!picker || picker.serial !== current.serial || picker.cancelled) {
          return;
        }
        if (!sent) {
          // A dismissed picker is the user's own cancel: nothing to say.
          stopPicker();
          return;
        }
        setButtonBusy(current.button, true);
        // The time to share the choice starts now, not when the picker opened.
        pickerWatch(failPicker);
        schedulePoll();
      });
    } catch (error) {
      stopPicker();
      fallbackToBot(current.flow, current.button);
    }
  }

  function startPicker(flow, chatType, button) {
    var app = webApp();
    if (!app) {
      return;
    }
    // A client that stayed silent on this page is not asked twice.
    if (!app.isVersionAtLeast('9.6') || silentPicker) {
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
      serial: ++pickerSequence,
      timer: 0,
      watch: 0,
      quiet: 0,
      cancelled: false
    };
    var current = picker;
    setButtonBusy(button, true);
    pickerWatch(failPicker);
    Aj.apiRequest('requestPeer', {
      flow: flow,
      chat_type: current.chatType
    }, function(result) {
      if (!picker || picker.serial !== current.serial || picker.cancelled) {
        return;
      }
      if (result.error || !result.webapp_req_id || !result.request_id) {
        failPicker();
        return;
      }
      picker.webappRequestId = result.webapp_req_id;
      picker.peerRequestId = result.request_id;
      requestNativePeer();
    });
  }

  // Where the bot continues a flow: its start link for gifts, a command to send for the others.
  function botTarget(flow) {
    var username = window.Aj && Aj.state && Aj.state.botUsername ? Aj.state.botUsername : 'PremiumBot';
    var commands = {
      stars_gift: '/stars',
      premium_giveaway: '/giveaway',
      stars_giveaway: '/stars_giveaway'
    };
    var command = flow === 'gift' ? '' : commands[flow] || '/status';
    return {
      url: 'https://t.me/' + username + (command ? '' : '?start=gift'),
      command: command,
      values: {bot: '@' + username, command: command}
    };
  }

  // The bot's flow as a line and a link under the row. False where the page has no place for it.
  function offerBotInPage(flow, button) {
    var app = webApp();
    var container = button ? button.closest('.pm-picker') : null;
    var legacy = container ? container.querySelector('.pm-picker-legacy') : null;
    if (!app || !legacy) {
      return false;
    }
    var target = botTarget(flow);
    legacy.hidden = false;
    var status = container.querySelector('.pm-picker-status');
    if (status) {
      status.textContent = target.command ? scriptText('bot-text', target.values) : '';
    }
    // One link, however many taps.
    if (legacy.firstChild) {
      return true;
    }
    var link = document.createElement('a');
    link.href = target.url;
    link.className = 'cell cell--action is-tappable fx-press island';
    var main = document.createElement('span');
    main.className = 'cell-main';
    var title = document.createElement('span');
    title.className = 'cell-title';
    title.textContent = scriptText('bot-open', target.values);
    main.appendChild(title);
    link.appendChild(main);
    link.addEventListener('click', function(event) {
      event.preventDefault();
      app.openTelegramLink(target.url);
    }, false);
    legacy.appendChild(link);
    return true;
  }

  function withdrawBotInPage(button) {
    var container = button ? button.closest('.pm-picker') : null;
    var legacy = container ? container.querySelector('.pm-picker-legacy') : null;
    if (!legacy || legacy.hidden) {
      return;
    }
    legacy.hidden = true;
    var status = container.querySelector('.pm-picker-status');
    if (status) {
      status.textContent = '';
    }
  }

  function fallbackToBot(flow, button) {
    var app = webApp();
    if (!app) {
      return;
    }
    var target = botTarget(flow);
    var openBot = function() {
      app.openTelegramLink(target.url);
    };
    if (!target.command) {
      openBot();
      return;
    }
    if (app.isVersionAtLeast('6.2')) {
      try {
        app.showPopup({
          title: scriptText('bot-title', target.values),
          message: scriptText('bot-text', target.values),
          buttons: [
            {id: 'open', type: 'default', text: scriptText('bot-open', target.values)},
            {id: 'cancel', type: 'cancel'}
          ]
        }, function(buttonId) {
          if (buttonId === 'open') {
            openBot();
          }
        });
      } catch (error) {
        // A popup that is up already is the answer; one the client refuses leaves the bot itself.
        if (error.message !== 'WebAppPopupOpened') {
          openBot();
        }
      }
      return;
    }
    if (!offerBotInPage(flow, button)) {
      openBot();
    }
  }

  // ===== Show-more packs =====

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // New content rises in a beat apart; its natural style is the final state.
  function rise(element, index) {
    if (!element.animate) {
      return;
    }
    var calm = reducedMotion();
    element.animate(calm ? [{opacity: 0}, {opacity: 1}] : [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {
      duration: calm ? 200 : 320,
      delay: calm ? 0 : Math.min(index, 7) * 30,
      easing: 'cubic-bezier(.2, .8, .2, 1)',
      fill: 'backwards'
    });
  }

  function showMorePacks(button) {
    var extras = document.querySelectorAll('.js-pack-extra');
    for (var i = 0; i < extras.length; i++) {
      extras[i].hidden = false;
      rise(extras[i], i);
    }
    button.setAttribute('aria-expanded', 'true');
    button.hidden = true;
    // The button goes, so the focus moves on to the first pack it revealed.
    if (extras.length) {
      extras[0].focus({preventScroll: true});
    }
  }

  // ===== Press effect =====

  function releasePress() {
    if (pressed) {
      pressed.classList.remove('is-pressed');
      pressed = null;
    }
  }

  function onPress(event) {
    var type = event.type;
    if (type === 'pointerdown' || type === 'keydown') {
      var down = type === 'pointerdown' ? event.button === 0 : !event.repeat && (event.key === ' ' || event.key === 'Enter');
      var target = down && event.target && event.target.closest ? event.target.closest('.fx-press') : null;
      if (target && !target.disabled && target.getAttribute('aria-disabled') !== 'true') {
        releasePress();
        pressed = target;
        target.classList.add('is-pressed');
      }
      return;
    }
    // The pointer leaving a child, or a child losing the focus, is not the pressed element letting go.
    if ((type !== 'pointerleave' && type !== 'blur') || event.target === pressed) {
      releasePress();
    }
  }

  // ===== Dates: the server prints them in UTC, the device shows its own day =====

  function localizeDates() {
    var app = webApp();
    var user = app && app.initDataUnsafe ? app.initDataUnsafe.user : null;
    var lang = document.documentElement.lang || (user && user.language_code);
    if (!lang || !window.Intl || !Intl.DateTimeFormat) {
      return;
    }
    var nodes = document.querySelectorAll('time[datetime]');
    for (var i = 0; i < nodes.length; i++) {
      var date = new Date(nodes[i].getAttribute('datetime'));
      if (!isNaN(date.getTime())) {
        try {
          // No-break spaces keep a date on one line.
          nodes[i].textContent = new Intl.DateTimeFormat(lang, {day: 'numeric', month: 'long', year: 'numeric'}).format(date).replace(/ /g, ' ');
        } catch (error) {}
      }
    }
  }

  // ===== The giveaway's two prizes as one page =====
  // The switch between Premium and Stars is a link to the other prize's page, and the server answers it with that
  // page. It is shown as a change of this one. At the tap the switch's capsule slides to the tapped segment. When
  // the page arrives, the star, which is the same object, turns into the other one (premiumbot-3d.js adopt), the
  // title's colours and the words cross-fade where they stand, and the sheet's sections and the pay bar leave along
  // the capsule's way while the new ones arrive from the side it went to. What leaves is a layer of copies taken at
  // the tap (prizeGhost): it outlives the page's own block, which the loader replaces. What both prizes share plays
  // no entrance again (fx.css html.pm-swap); the classes that say so stay for the life of the page that came this
  // way, and a page that comes any other way drops them (init).

  var prizeSwap = null;
  var prizeSwapComing = false;
  var PRIZE_SWAP_CLASSES = ['pm-swap', 'pm-swap-all'];
  var PRIZE_SLIDE_MS = 380;
  var PRIZE_OUT_MS = 180;
  var PRIZE_IN_MS = 380;
  var PRIZE_WAY_PX = 40;
  var PRIZE_SLIDE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
  var PRIZE_IN_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

  // A copy of `el` as it stands on the screen, in the layer of what is leaving. Its ancestors come with it as boxless
  // wrappers, so every rule that styles it by where it lies still does, and it is placed by its own rect. The copy
  // has no ids and its radios are out of their groups, so the page's own stay as they are.
  function prizeGhost(layer, el) {
    var rect = el ? el.getBoundingClientRect() : null;
    if (!rect || !rect.width || !rect.height) {
      return null;
    }
    var copy = el.cloneNode(true);
    var named = copy.querySelectorAll('[id], [name]');
    for (var i = 0; i < named.length; i++) {
      named[i].removeAttribute('id');
      named[i].removeAttribute('name');
    }
    copy.removeAttribute('id');
    copy.style.cssText += '; position: absolute; left: ' + rect.left + 'px; top: ' + rect.top + 'px; width: ' + rect.width +
      'px; height: ' + rect.height + 'px; margin: 0; box-sizing: border-box;';
    var node = copy;
    for (var parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      var wrap = parent.cloneNode(false);
      wrap.removeAttribute('id');
      wrap.style.cssText = 'display: contents';
      wrap.appendChild(node);
      node = wrap;
    }
    layer.appendChild(node);
    return copy;
  }

  // What a section says, to tell whether the two prizes show it alike.
  function prizeSign(el) {
    return el.textContent.replace(/\s+/g, ' ').trim();
  }

  // The two prizes as one page, server-loaded together: a tap on the switch's segment flips what the page
  // shows — group, mark, words, the stage's light — with no navigation at all.
  function prizeLocalSwitch(link, both) {
    var segments = link.parentNode.querySelectorAll('.segment');
    var target = '';
    for (var i = 0; i < segments.length; i++) {
      var is_tap = segments[i] === link;
      segments[i].classList.toggle('is-active', is_tap);
      if (is_tap) {
        target = segments[i].getAttribute('href').indexOf('stars') >= 0 ? 'stars' : 'premium';
      }
    }
    if (!target) {
      return;
    }
    both.setAttribute('data-prize-both', target);
    for (var i = 0; i < segments.length; i++) {
      var is_tap2 = segments[i] === link;
      if (is_tap2) {
        segments[i].setAttribute('aria-current', 'true');
      } else {
        segments[i].removeAttribute('aria-current');
      }
    }
    both.classList.toggle('commerce--giveaway-premium', target === 'premium');
    both.classList.toggle('commerce--giveaway-stars', target === 'stars');
    var stage = document.querySelector('.fx-stage');
    if (stage) {
      stage.classList.toggle('fx-stage--boost', target === 'premium');
      stage.classList.toggle('fx-stage--stars', target === 'stars');
    }
    var light_stage = document.querySelector('.fx-light__stage');
    if (light_stage) {
      light_stage.classList.toggle('fx-stage--boost', target === 'premium');
      light_stage.classList.toggle('fx-stage--stars', target === 'stars');
      light_stage.style.setProperty('--fx-accent', target === 'stars' ? '249 176 4' : '90 111 246');
    }
    if (window.Premium3D) {
      window.Premium3D.mount(document);
    }
    if (window.PremiumFx) {
      window.PremiumFx.mount(document);
    }
    giveawayUpdate();
    hapticSelection();
  }

  // The sheet's sections on show, in order. With both prizes on one page a prize's own sections lie in its group,
  // and the other prize's are out of sight.
  function prizeSections(page) {
    var all = page ? page.querySelectorAll('.fx-sheet > .section, .fx-sheet > .gw-prize > .section') : [];
    var shown = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].getClientRects().length) {
        shown.push(all[i]);
      }
    }
    return shown;
  }

  // The first of the page's elements by `selector` that is on show.
  function prizeShown(page, selector) {
    var all = page ? page.querySelectorAll(selector) : [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].getClientRects().length) {
        return all[i];
      }
    }
    return null;
  }

  // What was put out of sight under its copy shows again where it is still the page's own.
  function prizeUncover(swap) {
    for (var i = 0; i < swap.under.length; i++) {
      if (swap.under[i].isConnected) {
        swap.under[i].style.visibility = '';
      }
    }
    swap.under = [];
  }

  function prizeSwapDrop() {
    var swap = prizeSwap;
    prizeSwap = null;
    prizeSwapComing = false;
    document.documentElement.classList.remove('pm-swap-on');
    if (swap) {
      clearTimeout(swap.timer);
      prizeUncover(swap);
      // The sections that waited under their copies show as the copies go, in the same frame.
      for (var k = 0; swap.kept && k < swap.kept.length; k++) {
        swap.kept[k].style.opacity = '';
      }
      if (swap.layer && swap.layer.parentNode) {
        swap.layer.parentNode.removeChild(swap.layer);
      }
    }
  }

  // The capsule slides from the chosen segment to the tapped one inside the switch's copy, changing from the fill of
  // the prize it leaves to the other's. It is a window over the track: the track's labels all take the ink of a
  // segment not chosen, and the capsule holds a second row of the same labels in the ink that stands on its fill,
  // which moves against it and so stays where the track's row is. A label changes its ink where the capsule's edge
  // passes over it. The whole run is two transforms and one opacity, which the browser keeps going while the page
  // under it is replaced. Both are laid out where they end and moved back to where they start, so they come to rest
  // with no transform, drawn as the page's own switch is, and at its size. `stars` says the page being left is the
  // Stars one.
  function prizeSlide(copy, bar, from, to, stars) {
    var real = bar.querySelectorAll('.segment-face');
    // The tap has pressed the segment a little small, and it is still on its way back: the capsule is measured from
    // the segments at rest, the size the page's own switch will stand at, or it would grow as it comes to rest.
    var held = bar.querySelectorAll('.segment');
    var h;
    for (h = 0; h < held.length; h++) {
      held[h].classList.remove('is-pressed');
      held[h].style.transition = 'none';
    }
    var box = bar.getBoundingClientRect();
    var a = real[from].getBoundingClientRect();
    var b = real[to].getBoundingClientRect();
    for (h = 0; h < held.length; h++) {
      held[h].style.transition = '';
    }
    var plain = getComputedStyle(real[to]).color;
    var ink = getComputedStyle(document.documentElement).getPropertyValue(stars ? '--tone-solid-ink' : '--gold-ink').trim();
    var row = copy.cloneNode(true);
    row.className = 'segmented segment-thumb-row';
    row.style.cssText = 'left: ' + (box.left - b.left) + 'px; top: ' + (box.top - b.top) + 'px; width: ' + box.width + 'px; height: ' + box.height + 'px;';
    var faces = copy.querySelectorAll('.segment-face');
    for (var i = 0; i < faces.length; i++) {
      faces[i].style.color = plain;
    }
    var thumb = document.createElement('i');
    thumb.className = 'segment-thumb segment-thumb--' + (stars ? 'stars' : 'premium');
    thumb.style.cssText = 'left: ' + (b.left - box.left) + 'px; top: ' + (b.top - box.top) + 'px; width: ' + b.width + 'px; height: ' + b.height + 'px;';
    if (ink) {
      thumb.style.setProperty('--thumb-ink', ink);
    }
    var next = document.createElement('i');
    next.className = 'segment-thumb--' + (stars ? 'premium' : 'stars');
    thumb.appendChild(next);
    thumb.appendChild(row);
    copy.classList.add('is-sliding');
    copy.appendChild(thumb);
    var way = b.left - a.left;
    var timing = {duration: PRIZE_SLIDE_MS, easing: PRIZE_SLIDE_EASE};
    thumb.animate([{transform: 'translateX(' + -way + 'px)'}, {transform: 'translateX(0px)'}], timing);
    row.animate([{transform: 'translateX(' + way + 'px)'}, {transform: 'translateX(0px)'}], timing);
    next.animate([{opacity: 0}, {opacity: 1}], timing);
  }

  function onPrizeSwitch(event) {
    var link = event.target && event.target.closest ? event.target.closest('.commerce--giveaway .segmented a.segment[href]') : null;
    if (!link || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    // The loader that follows links listens on the document too: this one page change is made here.
    event.preventDefault();
    event.stopPropagation();
    if (link.classList.contains('is-active') || prizeSwap) {
      return;
    }
    // With both prizes on the page the switch changes what the page shows. With one, it asks for the other's page.
    // Either way the change is shown the same.
    var both = document.querySelector('[data-prize-both]');
    var url = link.getAttribute('href');
    var root = document.documentElement;
    var page = link.closest('.commerce--giveaway');
    var bar = link.parentNode;
    var segments = bar.querySelectorAll('.segment');
    var from = -1;
    var to = -1;
    var i;
    for (i = 0; i < segments.length; i++) {
      if (segments[i] === link) {
        to = i;
      } else if (segments[i].classList.contains('is-active')) {
        from = i;
      }
    }
    for (i = 0; i < PRIZE_SWAP_CLASSES.length; i++) {
      root.classList.remove(PRIZE_SWAP_CLASSES[i]);
    }
    root.classList.add('pm-swap');
    var still = root.classList.contains('fx-reduce') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (still || from < 0 || !bar.animate) {
      if (both) {
        prizeLocalSwitch(link, both);
      } else {
        prizeSwapComing = true;
        openPage(url);
      }
      return;
    }
    root.classList.add('pm-swap-all');
    var layer = document.createElement('div');
    layer.className = 'pm-ghost';
    layer.setAttribute('aria-hidden', 'true');
    var parts = [];
    var leaving = prizeSections(page);
    for (i = 0; i < leaving.length; i++) {
      parts.push({
        copy: prizeGhost(layer, leaving[i]),
        sign: prizeSign(leaving[i]),
        top: leaving[i].getBoundingClientRect().top
      });
    }
    var pay = page.querySelector('.cta-bar');
    var payCopy = prizeGhost(layer, pay);
    var heading = page.querySelector('.hero-title');
    var caption = prizeShown(page, '.hero-subtitle');
    var title = prizeGhost(layer, heading);
    var words = prizeGhost(layer, caption);
    var copy = prizeGhost(layer, bar);
    document.body.appendChild(layer);
    // What was copied goes out of sight under its copy until the page has changed: a tile's glass drawn twice, one
    // over the other, would show lighter for as long as the page takes to come.
    var under = [];
    var put = function(el, made) {
      if (el && made) {
        el.style.visibility = 'hidden';
        under.push(el);
      }
    };
    for (i = 0; i < leaving.length; i++) {
      put(leaving[i], parts[i].copy);
    }
    put(pay, payCopy);
    put(heading, title);
    put(caption, words);
    if (copy) {
      // The page's own switch, this one and the next page's, stays out of sight under its copy.
      root.classList.add('pm-swap-on');
      prizeSlide(copy, bar, from, to, page.classList.contains('commerce--giveaway-stars'));
    }
    // The capsule goes towards the tapped segment, and the sheet's pieces go the other way.
    prizeSwap = {
      layer: layer,
      under: under,
      parts: parts,
      pay: payCopy,
      paySign: pay ? prizeSign(pay) : '',
      title: title,
      words: words,
      way: to > from ? 1 : -1,
      // The switch's copy is sliding: the page's own switch stays out of sight under it (.pm-swap-on).
      on: !!copy,
      timer: setTimeout(prizeSwapDrop, 4000)
    };
    if (both) {
      prizeLocalSwitch(link, both);
      prizeSwapRun();
    } else {
      prizeSwapComing = true;
      openPage(url);
    }
  }

  // The other prize is in place, as a page that came or as this page's other group: what was copied leaves and what
  // came arrives. A section that both prizes show alike does neither: its copy stands for it until the copies are
  // dropped, and if what changed above it left it higher or lower, the copy moves there in one piece. Where the
  // browser loaded the page as a new document there are no copies, and what came arrives alone.
  function prizeSwapRun() {
    var swap = prizeSwap;
    if (!swap || swap.ran) {
      return;
    }
    swap.ran = true;
    prizeSwapComing = false;
    clearTimeout(swap.timer);
    prizeUncover(swap);
    var i;
    var page = document.querySelector('.commerce--giveaway');
    var fresh = prizeSections(page);
    var gone = [{opacity: 1, transform: 'translateX(0px)'}, {opacity: 0, transform: 'translateX(' + (-PRIZE_WAY_PX * swap.way) + 'px)'}];
    var come = [{opacity: 0, transform: 'translateX(' + (PRIZE_WAY_PX * swap.way) + 'px)'}, {opacity: 1, transform: 'translateX(0px)'}];
    var out = {duration: PRIZE_OUT_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards'};
    var kept = [];
    for (i = 0; i < swap.parts.length; i++) {
      var part = swap.parts[i];
      var copy = part.copy;
      if (fresh[i] && prizeSign(fresh[i]) === part.sign) {
        kept[i] = true;
        var lift = part.top - fresh[i].getBoundingClientRect().top;
        if (copy && copy.parentNode) {
          // The copy stays over the section until the copies are dropped, and the section waits under it all but
          // unseen: icons a page has just brought can take the renderer a moment to fetch and draw, and a section
          // shown at once would blink its chevrons and glyphs. It waits at a hundredth of its opacity and not
          // hidden, so the renderer does fetch and draw them meanwhile. Where the section stands higher or lower
          // than it did, the copy moves there.
          fresh[i].style.opacity = '0.01';
          swap.kept = swap.kept || [];
          swap.kept.push(fresh[i]);
          if (Math.abs(lift) > 0.5) {
            copy.animate([{transform: 'translateY(0px)'}, {transform: 'translateY(' + (-lift) + 'px)'}], {duration: PRIZE_IN_MS, easing: PRIZE_SLIDE_EASE, fill: 'forwards'});
          }
        } else if (Math.abs(lift) > 0.5) {
          fresh[i].animate([{transform: 'translateY(' + lift + 'px)'}, {transform: 'translateY(0px)'}], {duration: PRIZE_IN_MS, easing: PRIZE_SLIDE_EASE});
        }
      } else if (copy) {
        copy.animate(gone, out);
      }
    }
    var step = 0;
    for (i = 0; i < fresh.length; i++) {
      if (!kept[i]) {
        fresh[i].animate(come, {duration: PRIZE_IN_MS, delay: 110 + Math.min(step++, 3) * 50, easing: PRIZE_IN_EASE, fill: 'backwards'});
      }
    }
    var pay = page ? page.querySelector('.cta-bar') : null;
    if (pay && prizeSign(pay) === swap.paySign) {
      if (swap.pay && swap.pay.parentNode) {
        swap.pay.parentNode.removeChild(swap.pay);
      }
    } else if (swap.pay) {
      // The bar is docked over the page: its copy fades off the bar that came, which stands whole under it, so the
      // page never shows through the two.
      swap.pay.animate([{opacity: 1}, {opacity: 0}], {duration: 240, easing: 'ease-in-out', fill: 'forwards'});
    }
    if (swap.title) {
      swap.title.animate([{opacity: 1}, {opacity: 0}], {duration: 320, easing: 'ease-in-out', fill: 'forwards'});
      // The title that came stands under the copy of the one that left: the same words in the other prize's
      // colours. Whole under a whole copy, the two would show their glow twice from one frame to the next, a flash
      // of the title's light. So it comes up under the copy while the copy still covers it.
      var heading = page ? page.querySelector('.hero-title') : null;
      if (heading && heading.animate) {
        heading.animate([{opacity: 0}, {opacity: 1}], {duration: 200, easing: 'ease-out', fill: 'backwards'});
      }
    }
    if (swap.words) {
      swap.words.animate([{opacity: 1}, {opacity: 0}], {duration: 160, easing: 'ease-out', fill: 'forwards'});
    }
    var words = prizeShown(page, '.hero-subtitle');
    if (words && words.animate) {
      words.animate([{opacity: 0}, {opacity: 1}], {duration: 280, delay: 100, easing: 'ease-out', fill: 'backwards'});
    }
    // The copies are spent, and the switch's copy has come to rest as the page's own switch stands.
    swap.timer = setTimeout(prizeSwapDrop, PRIZE_SLIDE_MS + 60);
  }

  // ===== From one page to the next =====
  // How a page is replaced is the site's business and differs by deployment. Its loader may swap the page's block
  // inside this document and run init again, with a call to what onUnload was given or without one, early or late.
  // It may run these files again. Or the browser may load the next page as a new document. The app holds in all of
  // them:
  // - Nothing on show is taken down when a page is left (pageLeave). What draws goes on until the next page's init,
  //   which ends the old page's and starts its own in one task, so a mark or a field both pages hold passes from one
  //   to the other with no frame between them.
  // - Where no page of this app follows, a watch ends what the page left running once it is out of the document.
  // - Where the document is unloaded, the page leaves the next one word of it (navLeave): the time, and a prize
  //   switch under way. A page that comes within a moment of that goes on from it: its mark and its field play no
  //   entrance. The mark's slot is never empty meanwhile: the sheets show the mark's picture there from the first
  //   paint.

  // No view transition around a page change. The site's loader wraps one around every page change where its flag
  // is set, and the site's script sets the flag for every web app (main-aj.js loadPage, webapp-common.js
  // TWebApp.init). This app must not have one: when a view transition ends, a quarter of a second into the page,
  // every animation still running starts over on screen, which screen recordings showed frame by frame as a star
  // that travels its way twice, a title gone for a frame and a bar whose entrance plays again. The page needs no
  // cross-fade of its own. The loader reads the flag when a page has come, so it is taken down wherever this
  // script gets a word in before that: as a page starts and a task later, at every tap, before a page it opens
  // itself, and with the page's watch. A transition that starts all the same is over with its first frame
  // (premiumbot.css ::view-transition-group).
  function loaderPlain() {
    if (window.Aj && window.Aj.viewTransition) {
      window.Aj.viewTransition = false;
    }
  }

  function openPage(url) {
    loaderPlain();
    if (window.Aj && typeof window.Aj.location === 'function') {
      window.Aj.location(url);
    } else {
      window.location.href = url;
    }
  }

  // The page on show has a docked bar: the next page's bar goes on from it.
  var barKept = false;
  var NAV_KEY = 'pm-nav';
  // A page that takes longer than this to come is a new start, not a continuation.
  var NAV_FRESH_MS = 10000;
  var pageWatchTimer = 0;

  function navLeave() {
    try {
      piecesNote();
      var left = { t: Date.now(), swap: null, bar: barKept, pieces: Object.keys(pieceSigns.set) };
      if (prizeSwap && prizeSwapComing) {
        left.swap = { way: prizeSwap.way, paySign: prizeSwap.paySign, parts: [] };
        for (var i = 0; i < prizeSwap.parts.length; i++) {
          left.swap.parts.push({ sign: prizeSwap.parts[i].sign, top: prizeSwap.parts[i].top });
        }
      }
      window.sessionStorage.setItem(NAV_KEY, JSON.stringify(left));
    } catch (error) {}
  }

  // Read once, by the document that follows, and only while fresh. A client that keeps no session storage gives
  // nothing, and the page starts as on a launch.
  function navArrive() {
    try {
      var raw = window.sessionStorage.getItem(NAV_KEY);
      if (!raw) {
        return null;
      }
      window.sessionStorage.removeItem(NAV_KEY);
      var left = JSON.parse(raw);
      return left && Date.now() - left.t < NAV_FRESH_MS ? left : null;
    } catch (error) {
      return null;
    }
  }

  // ===== What both pages show alike stays =====
  // A page's pieces come in with entrances of their own (premiumbot-fx.css). A piece the page before showed too,
  // the same words in the same place, is one piece to the eye, and an entrance would take it away and bring it
  // back: under the loader's cross-fade the old picture of it fades out over a new one that is not there yet. So a
  // page notes what it shows when it is left, and the page that follows ends, before its first frame, every
  // entrance on a piece it finds there again. Nothing is named: the rule holds for any piece on any pair of pages.
  // The note is taken when the loader says the page is left, at a tap on what leads on, as the document is
  // unloaded, and a moment after anything that may have moved the pieces, so a loader that gives no word of leaving
  // finds it in step with the page too.
  var pieceSigns = null;
  var pieceTimer = 0;

  // A piece's laid-out place in the viewport. No entrance's shift is in it, and none of a press's.
  function pieceBox(el) {
    var x = 0;
    var y = 0;
    var last = el;
    for (var node = el; node; node = node.offsetParent) {
      x += node.offsetLeft + (node === el ? 0 : node.clientLeft);
      y += node.offsetTop + (node === el ? 0 : node.clientTop);
      last = node;
    }
    // A chain that does not end at the page's own root ends at something fixed to the viewport.
    if (last === document.body || last === document.documentElement) {
      x -= window.pageXOffset;
      y -= window.pageYOffset;
    }
    return x + ',' + y + ',' + el.offsetWidth + ',' + el.offsetHeight;
  }

  // What a piece is to the eye, as a short number: its kind, its words and its place. Nothing for a piece without
  // words or without a box.
  function pieceSign(el) {
    var text = el.offsetWidth ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (!text) {
      return '';
    }
    var line = el.tagName + '|' + (el.classList[0] || '') + '|' + text.slice(0, 80) + '|' + text.length + '|' + pieceBox(el);
    var hash = 2166136261;
    for (var i = 0; i < line.length; i++) {
      hash = Math.imul(hash ^ line.charCodeAt(i), 16777619);
    }
    return String(hash >>> 0);
  }

  function piecesNote() {
    heroNote();
    var all = document.querySelectorAll('.screen *');
    var set = {};
    for (var i = 0; i < all.length; i++) {
      var sign = typeof all[i].offsetWidth === 'number' ? pieceSign(all[i]) : '';
      if (sign) {
        set[sign] = 1;
      }
    }
    // Good for as long as its page stands; a note handed to a new document is good for a moment (navArrive).
    pieceSigns = { screen: document.querySelector('.screen'), until: Infinity, set: set };
  }

  function piecesSoon() {
    clearTimeout(pieceTimer);
    pieceTimer = setTimeout(piecesNote, 200);
  }

  // An entrance is an animation the sheets start and that ends. It is ended on a piece that is as the page before
  // showed it, on all that lies in such a piece, and on every block such a piece lies in: a block that came in as
  // a whole would take the piece with it.
  // ===== A page shows itself once =====
  // The first time a page comes in a launch it plays its entrance: the plans are drawn one after another, a price
  // rolls to its figure. That is a showing, and a thing is shown once. A page the user has been on already and
  // comes back to, the home page after a look at the giveaway, is not shown again: its entrances are ended before
  // its first frame, and what it holds comes as one, in a short fade. What it shares with the page before stays as
  // it is. A result is new every time it comes.
  var seenPages = {};
  var arrival = null;

  function pageArrival() {
    var screen = document.querySelector('.screen');
    if (!arrival || arrival.screen !== screen) {
      // A page is told by its address's path, its route and its step, choosing or paying. Not by the address's
      // query: a launch's carries what the client adds to it, and the same page has none of that later.
      var key = !screen ? '' : window.location.pathname + '|' + (screen.getAttribute('data-route') || '') + '|' +
        (screen.querySelector('.pm-picker') ? 'pick' : '') + (screen.querySelector('.js-invoice') ? 'pay' : '');
      var result = !!(screen && screen.querySelector('.result-screen'));
      arrival = { screen: screen, again: !result && !!seenPages[key], kept: null, calmed: false };
      seenPages[key] = 1;
    }
    return arrival;
  }

  function piecesKeep() {
    var here = pageArrival();
    var left = pieceSigns;
    var screen = here.screen;
    // A note of this very page is no page before: it waits for the page that follows.
    if (left && left.screen === screen) {
      return;
    }
    pieceSigns = null;
    if (!screen || typeof document.getAnimations !== 'function' || typeof WeakMap !== 'function') {
      return;
    }
    if (left && Date.now() > left.until) {
      left = null;
    }
    if (!left && !here.again) {
      return;
    }
    var SAME = 1;
    var HOLDS = 2;
    var kept = new WeakMap();
    var all = left ? screen.querySelectorAll('*') : [];
    var any = false;
    var i;
    var node;
    for (i = 0; i < all.length; i++) {
      var sign = typeof all[i].offsetWidth === 'number' ? pieceSign(all[i]) : '';
      if (sign && left.set[sign]) {
        any = true;
        kept.set(all[i], SAME);
        for (node = all[i].parentNode; node && node !== screen && !kept.has(node); node = node.parentNode) {
          kept.set(node, HOLDS);
        }
      }
    }
    here.kept = kept;
    if (!any && !here.again) {
      return;
    }
    var runs = document.getAnimations();
    var entering = [];
    var el;
    var timing;
    for (i = 0; i < runs.length; i++) {
      el = runs[i].animationName && runs[i].effect ? runs[i].effect.target : null;
      timing = el && runs[i].effect.getComputedTiming ? runs[i].effect.getComputedTiming() : null;
      entering.push(timing && timing.iterations !== Infinity && screen.contains(el) ? el : null);
    }
    for (i = 0; i < runs.length; i++) {
      el = entering[i];
      if (!el) {
        continue;
      }
      var run = runs[i];
      var hit = here.again || kept.has(el);
      for (node = el.parentNode; !hit && node && node !== screen; node = node.parentNode) {
        hit = kept.get(node) === SAME;
      }
      if (!hit) {
        continue;
      }
      // A block that only holds a kept piece gives its entrance up, and what else it holds would be there whole in
      // one frame. So its entrance goes to each of those in its place: the kept piece stands, the rest comes in as
      // the block would have brought it.
      if (!here.again && kept.get(el) === HOLDS && !run.effect.pseudoElement) {
        piecesHandDown(el, run.effect.getKeyframes(), run.effect.getTiming(), kept, entering, 0);
      }
      run.cancel();
    }
  }

  function piecesHandDown(el, frames, timing, kept, entering, depth) {
    for (var i = 0; i < el.children.length; i++) {
      var child = el.children[i];
      var state = kept.get(child);
      if (state === 1 || child.classList.contains('is-kept')) {
        continue;
      }
      if (state === 2) {
        if (depth < 6) {
          piecesHandDown(child, frames, timing, kept, entering, depth + 1);
        }
        continue;
      }
      // A piece with an entrance of its own comes by that.
      if (entering.indexOf(child) < 0 && child.animate && child.getClientRects().length) {
        var plain = [];
        for (var k = 0; k < frames.length; k++) {
          var frame = {};
          for (var name in frames[k]) {
            if (name !== 'computedOffset' && name !== 'composite') {
              frame[name] = frames[k][name];
            }
          }
          plain.push(frame);
        }
        child.animate(plain, timing);
      }
    }
  }

  // The page that came back, once its marks are mounted: every block of words that is not kept from the page before,
  // and holds nothing that is, comes up in one short fade. A block that holds a kept thing is taken apart, so the
  // kept thing stands while the rest of the block comes up round it. What draws by itself, a canvas or a layer of
  // light, has no words and is left as it stands. A docked bar is taken apart too: it is the cover over the rows
  // that lie under it, and a cover that fades shows them through itself and through its button, so the bar stands
  // from the first frame and its button comes up on it. A page the prize switch brought is not faded here at all:
  // the switch brings its pieces in itself, and a block must never carry two fades at once. The sheets resolve
  // two as the later one, but on a screen the renderer plays the first until the second's delay is over and then
  // starts the second from nothing: the block comes up, drops out and comes up again. For the same reason a block
  // that something else already animates is left to it.
  var CALM_MS = 180;

  function calmArrive() {
    var here = arrival;
    if (!here || !here.again || here.calmed || !here.screen) {
      return;
    }
    here.calmed = true;
    if (prizeSwap || prizeSwapComing || reducedMotion() || document.documentElement.classList.contains('fx-reduce')) {
      return;
    }
    var kept = here.kept;
    var walk = function(el, depth) {
      if (el.classList.contains('is-kept') || (kept && kept.get(el) === 1) || el.getAttribute('aria-hidden') === 'true') {
        return;
      }
      if (depth < 7 && ((kept && kept.get(el) === 2) || el.classList.contains('cta-bar') || el.querySelector('.is-kept, canvas'))) {
        for (var i = 0; i < el.children.length; i++) {
          walk(el.children[i], depth + 1);
        }
        return;
      }
      if (el.animate && el.getClientRects().length && (el.textContent || '').trim() && !(el.getAnimations && el.getAnimations().length)) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: CALM_MS, easing: 'ease-out' });
      }
    };
    walk(here.screen, 0);
  }

  // The launch's show (premiumbot.css fx-mark-rise). The sheets hold the sheet back until the mark has passed it,
  // with one delayed fade of the whole sheet. By then the entrances of what the sheet holds would be over, played
  // out of sight: the plans would be there, drawn, and never seen being drawn. So each of those entrances is set
  // back by the sheet's own delay and starts as the sheet shows.
  function launchHold() {
    if (typeof document.getAnimations !== 'function') {
      return 0;
    }
    var runs = document.getAnimations();
    var held = [];
    var i;
    var el;
    var timing;
    for (i = 0; i < runs.length; i++) {
      el = runs[i].effect ? runs[i].effect.target : null;
      timing = el && runs[i].animationName === 'fx-in-fade' && el.classList.contains('fx-sheet') ? runs[i].effect.getComputedTiming() : null;
      if (timing && timing.delay >= 300) {
        held.push({ sheet: el, hold: timing.delay });
      }
    }
    for (i = 0; i < runs.length && held.length; i++) {
      el = runs[i].animationName && runs[i].effect ? runs[i].effect.target : null;
      timing = el && runs[i].effect.getComputedTiming ? runs[i].effect.getComputedTiming() : null;
      if (!timing || timing.iterations === Infinity) {
        continue;
      }
      for (var h = 0; h < held.length; h++) {
        if (held[h].sheet !== el && held[h].sheet.contains(el)) {
          runs[i].currentTime = (runs[i].currentTime || 0) - held[h].hold;
          break;
        }
      }
    }
    return held.length ? held[0].hold : 0;
  }

  // ===== One page's object turns into the next page's =====
  // A screen opens on one object, the star or a sticker. Where two screens that follow one another hold different
  // objects in the same place, the gift's sticker after the star, the first turns to its edge and the second comes
  // from its own, as one thing turned over: no object goes out while another pops up. Two stars are one star
  // already (premiumbot-3d.js adopt). The way back turns the other way.
  var heroLeft = null;
  var HERO_OUT_MS = 200;
  var HERO_IN_MS = 340;
  var HERO_EDGE = 84;

  function heroOf() {
    var all = document.querySelectorAll('.screen .pm-mark[data-icon3d], .screen .hero-media');
    for (var i = 0; i < all.length; i++) {
      if (all[i].getClientRects().length) {
        return all[i];
      }
    }
    return null;
  }

  // An object's laid-out place: its middle and its width. An entrance under way does not move it.
  function heroBox(el) {
    var box = pieceBox(el).split(',');
    return { x: Number(box[0]) + Number(box[2]) / 2, y: Number(box[1]) + Number(box[3]) / 2, w: Number(box[2]) };
  }

  // With the page's pieces: the page's object, where it stands, and a picture of a sticker as it is drawn now, which
  // is what turns away once the page has gone.
  function heroNote() {
    var el = heroOf();
    heroLeft = null;
    if (!el) {
      return;
    }
    var star = el.hasAttribute('data-icon3d');
    var box = heroBox(el);
    var drawn = star ? null : el.querySelector('canvas');
    var picture = null;
    var at = null;
    if (drawn && drawn.width && drawn.height) {
      try {
        picture = document.createElement('canvas');
        picture.width = drawn.width;
        picture.height = drawn.height;
        picture.getContext('2d').drawImage(drawn, 0, 0);
        at = drawn.getBoundingClientRect();
      } catch (error) {
        picture = null;
      }
    }
    heroLeft = { screen: document.querySelector('.screen'), star: star, x: box.x, y: box.y, w: box.w, picture: picture, at: at };
  }

  function heroGhost(left, way) {
    var holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position: fixed; z-index: 3; pointer-events: none; left: ' + left.at.left.toFixed(1) + 'px; top: ' +
      left.at.top.toFixed(1) + 'px; width: ' + left.at.width + 'px; height: ' + left.at.height + 'px;';
    left.picture.style.cssText = 'display: block; width: 100%; height: 100%;';
    holder.appendChild(left.picture);
    document.body.appendChild(holder);
    // A flat picture on its edge is nothing at all: it stops just short of it, and stays one frame more, over the
    // other object's first.
    var gone = holder.animate([
      { transform: 'perspective(480px) rotateY(0deg) scale(1)' },
      { transform: 'perspective(480px) rotateY(' + (-HERO_EDGE * way) + 'deg) scale(0.9)' }
    ], { duration: HERO_OUT_MS, endDelay: 16, easing: 'cubic-bezier(0.42, 0, 1, 1)', fill: 'forwards' });
    gone.onfinish = gone.oncancel = function() {
      if (holder.parentNode) {
        holder.parentNode.removeChild(holder);
      }
    };
  }

  // After the page's marks are mounted: a star that has no slot on this page is still at hand for a moment.
  function heroTurn() {
    var left = heroLeft;
    var screen = document.querySelector('.screen');
    if (!left || left.screen === screen) {
      return;
    }
    heroLeft = null;
    var el = heroOf();
    if (!el || !el.animate || reducedMotion() || document.documentElement.classList.contains('fx-reduce')) {
      return;
    }
    var star = el.hasAttribute('data-icon3d');
    var box = heroBox(el);
    // Only where one object takes the other's very place, and that place was whole on screen.
    if (star === left.star || Math.abs(box.x - left.x) > 2 || Math.abs(box.y - left.y) > 2 || Math.abs(box.w - left.w) > 2 ||
        left.y - left.w / 2 < 0 || left.y + left.w / 2 > window.innerHeight) {
      return;
    }
    var way = star ? -1 : 1;
    if (left.star) {
      if (!(window.Premium3D && window.Premium3D.leave && window.Premium3D.leave(way))) {
        return;
      }
    } else if (left.picture) {
      heroGhost(left, way);
    }
    // The object that came plays no entrance of its own (.is-kept). It is out of sight until the other has reached
    // its edge, and comes from its own edge in that frame: neither fades, so no frame is without an object.
    var wait = HERO_OUT_MS;
    var timing = { duration: HERO_IN_MS, delay: wait, easing: 'cubic-bezier(0, 0, 0.58, 1)', fill: 'backwards' };
    el.classList.add('is-kept');
    el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: wait });
    if (star) {
      if (window.Premium3D && window.Premium3D.arrive) {
        window.Premium3D.arrive(el, way, wait);
      }
      el.animate([{ transform: 'scale(0.9)' }, { transform: 'none' }], timing);
    } else {
      el.animate([
        { transform: 'perspective(480px) rotateY(' + (HERO_EDGE * way) + 'deg) scale(0.9)' },
        { transform: 'perspective(480px) rotateY(0deg) scale(1)' }
      ], timing);
    }
  }

  // A tap on something that leads on: the page is noted now. Any other tap may have moved a piece.
  function onPieceTap(event) {
    loaderPlain();
    if (event.target && event.target.closest && event.target.closest('a[href], .js-back, .segment')) {
      piecesNote();
    } else {
      piecesSoon();
    }
  }

  // The loader says the page is about to be replaced. What waits on the client is let go, and each mark's place
  // and the page's pieces are noted for the page that follows; the rest stays as it is.
  function pageLeave() {
    piecesNote();
    pageToken++;
    stopPicker();
    giveUpInvoice();
    releasePress();
    if (window.Premium3D && window.Premium3D.note) {
      window.Premium3D.note();
    }
  }

  var pageSeen = null;
  var pageObserver = null;

  // A loader may replace the page in one task and run init in a later one, after its own work. The mark and the
  // fields go over to the page that came as soon as it is in the document, before the frame that first shows it;
  // the init that follows finds them there. A loader that runs init with the replacement gets here after it and
  // has nothing left to do.
  function pageCarry() {
    var screen = document.querySelector('.screen');
    if (!screen || screen === pageSeen) {
      return;
    }
    pageSeen = screen;
    // The loader has written the root's classes anew by now (main-aj.js onResult). They are put back before the
    // page's first frame, as init would: without them the page is laid out as on another platform and plays a
    // launch's entrances until init comes.
    var root = document.documentElement;
    applyBridgeClasses();
    if (visits > 0) {
      root.classList.add('pm-launched');
    }
    if (prizeSwapComing) {
      root.classList.add('pm-swap');
      if (prizeSwap) {
        root.classList.add('pm-swap-all');
        if (prizeSwap.on) {
          root.classList.add('pm-swap-on');
        }
      }
    }
    piecesKeep();
    if (window.Premium3D) {
      window.Premium3D.mount(document);
    }
    if (window.PremiumFx && window.PremiumFx.carry) {
      window.PremiumFx.carry(document);
    }
    heroTurn();
    calmArrive();
    pageWatch();
  }

  // Watches the page's place in the document: each block the page lies in, up to the body, for a change of its
  // children. Where no page of this app follows and nothing calls init, what the page left running is ended once
  // the page has been out of the document for two looks, a second apart.
  // ===== A link to a place in the app =====
  // A link to the app may name a place in it, https://t.me/<bot>?startapp=<name>, and the client hands the name to
  // the page as the launch's start parameter. A server that knows the name opens the place at once. Where the home
  // page comes instead, the script goes on to the place from it, once in a launch, so the client's Back leads
  // home; until the place is there the home page shows its mark alone (premiumbot.css .pm-linking). A letter's
  // case does not count and - is read as _. A name that is not in the list opens the home page as it is.
  var LINK_ROUTES = {
    home: 'home',
    plans: 'subscription',
    premium: 'subscription',
    subscription: 'subscription',
    upgrade: 'subscription',
    gift: 'gift',
    gift_premium: 'gift',
    stars: 'stars',
    gift_stars: 'stars/gift',
    stars_gift: 'stars/gift',
    giveaway: 'giveaway/premium',
    giveaway_premium: 'giveaway/premium',
    giveaway_stars: 'giveaway/stars',
    // Places on the home page itself: what Premium includes, opened, and a lapsed subscription's renewal, which its
    // own home page docks. With nothing lapsed, renew leads to the plans.
    features: 'home',
    renew: 'home',
    grace: 'home'
  };
  var LINK_KEY = 'pm-link';
  var LINK_WAIT_MS = 4000;
  var linkTimer = 0;

  function linkName() {
    var app = webApp();
    var name = app && app.initDataUnsafe ? app.initDataUnsafe.start_param : '';
    if (!name) {
      try {
        name = new URLSearchParams(window.location.search).get('tgWebAppStartParam');
      } catch (error) {}
    }
    name = String(name || '').toLowerCase().replace(/-/g, '_');
    return LINK_ROUTES[name] ? name : '';
  }

  // A launch is told from the next by its time: a name acts once in a launch, whatever documents the launch loads.
  function linkLaunch(name) {
    var app = webApp();
    return name + ':' + ((app && app.initDataUnsafe && app.initDataUnsafe.auth_date) || '');
  }

  // Where the launch's link leads from the page that came: a route to open, or '' where the page is the place.
  // Only the home page is left for it: a server that opened another page has chosen.
  function linkRoute(name) {
    var screen = document.querySelector('.screen[data-route]');
    var here = screen ? screen.getAttribute('data-route') : '';
    var route = LINK_ROUTES[name];
    if ((name === 'renew' || name === 'grace') && !document.querySelector('.home--grace')) {
      route = 'subscription';
    }
    return here === 'home' && route !== 'home' ? route : '';
  }

  function linkWaiting() {
    var name = linkName();
    if (!name) {
      return '';
    }
    try {
      if (window.sessionStorage.getItem(LINK_KEY) === linkLaunch(name)) {
        return '';
      }
    } catch (error) {}
    return name;
  }

  function linkShow() {
    clearTimeout(linkTimer);
    linkTimer = 0;
    document.documentElement.classList.remove('pm-linking');
  }

  function linkGo(name) {
    try {
      window.sessionStorage.setItem(LINK_KEY, linkLaunch(name));
    } catch (error) {}
    var route = linkRoute(name);
    if (route) {
      // The page that comes takes the class off with the root's other classes; a page that never comes gives the
      // home page back.
      document.documentElement.classList.add('pm-linking');
      linkTimer = setTimeout(linkShow, LINK_WAIT_MS);
      openPage('/premiumbot/' + route);
      return;
    }
    linkShow();
    if (name === 'features' && window.PremiumFx && window.PremiumFx.openPerks) {
      // Once the page has come up, so the tile is seen to open.
      linkTimer = setTimeout(window.PremiumFx.openPerks, 900);
    }
  }

  // The site's own script takes a sideways swipe anywhere on a phone's page for Back, and where there is no page
  // to go back to it closes the app (webapp-common.js initBackSwipe). A touch that starts on something that moves
  // sideways itself, the wall of features or a row of chips, is that thing's own: it does not reach the site's
  // listeners, which sit on the document after this one.
  var touchOwn = false;

  function onTouchGuard(event) {
    if (event.type === 'touchstart') {
      touchOwn = !!(event.target && event.target.closest && event.target.closest('.perk-strip.is-live, .chips'));
    }
    if (touchOwn) {
      event.stopPropagation();
    }
    if (event.type === 'touchend' || event.type === 'touchcancel') {
      touchOwn = false;
    }
  }

  function pageWatch() {
    var screen = document.querySelector('.screen');
    var gone = 0;
    pageSeen = screen;
    clearInterval(pageWatchTimer);
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
    if (screen && typeof MutationObserver === 'function') {
      pageObserver = new MutationObserver(pageCarry);
      for (var node = screen.parentNode; node && node !== document.documentElement; node = node.parentNode) {
        pageObserver.observe(node, { childList: true });
      }
    }
    pageWatchTimer = setInterval(function() {
      loaderPlain();
      gone = screen && screen.isConnected ? 0 : gone + 1;
      if (gone > 1) {
        cleanup();
      }
    }, 1000);
  }

  // ===== Page lifecycle =====

  function cleanup() {
    var app = webApp();
    pageToken++;
    clearInterval(pageWatchTimer);
    pageWatchTimer = 0;
    clearTimeout(pieceTimer);
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
    // A prize switch that waits for its page outlives the page it was tapped on.
    if (!prizeSwapComing) {
      prizeSwapDrop();
    }
    stopPicker();
    giveUpInvoice();
    hideMainButton();
    unbindAll();
    clearMessage();
    releasePress();
    if (colorFrame) {
      cancelAnimationFrame(colorFrame);
      colorFrame = 0;
    }
    ctaCopy = null;
    pageColors = null;
    if (app && app.offEvent) {
      try {
        app.offEvent('themeChanged', applyBridgeClasses);
      } catch (error) {}
    }
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
    loaderPlain();
    applyBridgeClasses();
    var app = webApp();
    var i;
    // What the page before left, where the browser unloaded its document: used once.
    var from = navArrived;
    navArrived = null;
    // Only the first page of a launch brings its mark up from the loading screen's (premiumbot.css fx-mark-rise).
    if (visits > 0 || from) {
      document.documentElement.classList.add('pm-launched');
    }
    // A docked bar that follows a docked bar is one bar to the eye: it stands from the page's first frame, where
    // an entrance of its own would blink it (premiumbot.css .cta-bar.is-kept). A result's bar is built further
    // down and comes in its own time.
    if (barKept || (from && from.bar)) {
      var bars = document.querySelectorAll('.cta-bar');
      for (i = 0; i < bars.length; i++) {
        bars[i].classList.add('is-kept');
      }
    }
    // A link's place, once in a launch, from the launch's first page.
    var link = visits > 0 ? '' : linkWaiting();
    if (visits > 0) {
      linkShow();
    }
    if (from && from.swap && !prizeSwap) {
      prizeSwap = { layer: null, under: [], parts: from.swap.parts || [], pay: null, paySign: from.swap.paySign, title: null, words: null, way: from.swap.way, timer: 0 };
    }
    if (prizeSwapComing) {
      prizeSwapComing = false;
      // The site's loader writes the root's classes anew with every page (main-aj.js onResult): the switch's are
      // put back before the page's first frame.
      document.documentElement.classList.add('pm-swap');
      if (prizeSwap) {
        document.documentElement.classList.add('pm-swap-all');
        if (prizeSwap.on) {
          document.documentElement.classList.add('pm-swap-on');
        }
      }
    } else {
      for (i = 0; i < PRIZE_SWAP_CLASSES.length; i++) {
        document.documentElement.classList.remove(PRIZE_SWAP_CLASSES[i]);
      }
    }
    // With the root's classes as the page will have them, so the entrances in play are the page's own.
    piecesKeep();
    var held = visits === 0 && !from ? launchHold() : 0;
    if (app && app.onEvent) {
      // themeChanged is user-triggered while the app stays open.
      try {
        app.onEvent('themeChanged', applyBridgeClasses);
      } catch (error) {}
    }
    var pressEvents = ['pointerdown', 'pointerup', 'pointercancel', 'pointerleave', 'keydown', 'keyup', 'blur'];
    for (i = 0; i < pressEvents.length; i++) {
      on(document, pressEvents[i], onPress, true);
    }
    // Ahead of the tapped element's own handler: a button that turns busy on its tap is still felt.
    on(document, 'click', onTapHaptic, true);
    on(document, 'click', onPieceTap, true);
    on(document, 'click', onPrizeSwitch, true);
    on(document, 'click', onLinkClick);
    on(window, 'scroll', onPageScroll);
    on(window, 'resize', ctaFit);
    on(window, 'resize', piecesSoon);
    on(window, 'pageshow', planSync);
    on(window, 'pagehide', navLeave);
    var touchEvents = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
    for (i = 0; i < touchEvents.length; i++) {
      on(document, touchEvents[i], onTouchGuard, true);
    }
    bind('.js-invoice', 'click', function() {
      if (this.getAttribute('aria-disabled') === 'true' || this.getAttribute('aria-busy') === 'true') {
        return;
      }
      var flow = this.getAttribute('data-result-flow') || inferResultFlow();
      openInvoice(this.getAttribute('data-invoice-url'), flow, this);
    });
    bind('.js-request-peer', 'click', function() {
      if (this.getAttribute('aria-busy') !== 'true') {
        startPicker(this.getAttribute('data-peer-flow'), this.getAttribute('data-peer-chat-type'), this);
      }
    });
    bind('.js-telegram-link', 'click', function() {
      var appInstance = webApp();
      if (appInstance) {
        appInstance.openTelegramLink(this.getAttribute('data-telegram-url'));
      }
    });
    bind('.js-plan-option', 'change', function() {
      planApply(this);
      hapticSelection();
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
    if (!ctaInit()) {
      resultButtonInit();
    }
    planSync();
    giveawayUpdate();
    localizeDates();
    // After a navigation the title takes the focus; the first page leaves it where the client put it.
    var title = document.querySelector('.hero-title, .screen-title');
    visits++;
    if (title && visits > 1) {
      title.focus({preventScroll: true});
    }
    if (window.PremiumLottie) {
      window.PremiumLottie.mount(document);
    }
    if (window.Premium3D) {
      window.Premium3D.mount(document, !!from);
    }
    if (window.PremiumFx) {
      // In the same task as the page, so the light and the fields are there for its first frame.
      window.PremiumFx.mount(document, !!from);
      if (held && window.PremiumFx.late) {
        window.PremiumFx.late(held);
      }
    }
    heroTurn();
    calmArrive();
    if (window.Aj && typeof window.Aj.onUnload === 'function') {
      window.Aj.onUnload(pageLeave);
    }
    pageWatch();
    prizeSwapRun();
    piecesSoon();
    // The site's own script paints the client's header and background in its own colours once, from the page's
    // script (webapp-common.js initOnce). Where that runs after this, the page's colours are put back a task later.
    var token = pageToken;
    setTimeout(function() {
      loaderPlain();
      if (token === pageToken) {
        matchPageColors();
      }
    }, 0);
    var docked = document.querySelectorAll('.cta-bar');
    barKept = false;
    for (i = 0; i < docked.length; i++) {
      barKept = barKept || docked[i].getClientRects().length > 0;
    }
    if (link) {
      linkGo(link);
    }
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
      // The one-page giveaway's switch says which prize the payment celebrates.
      var both = document.querySelector('[data-prize-both]');
      return both && both.getAttribute('data-prize-both') === 'stars' ? 'stars_giveaway' : 'premium_giveaway';
    }
    if (route === 'giveaway/stars') {
      return 'stars_giveaway';
    }
    if (route === 'gift') {
      return 'gift';
    }
    return 'premium';
  }

  // Theme and platform classes are wanted for the first paint, which can come before init.
  applyBridgeClasses();

  // So is a link's place: the home page that the script is about to leave for it shows its mark alone.
  if (linkWaiting() && linkRoute(linkWaiting())) {
    document.documentElement.classList.add('pm-linking');
  }

  // So is what a prize switch on the page before set aside, where this document is that switch's other page.
  var navArrived = navArrive();
  if (navArrived) {
    document.documentElement.classList.add('pm-launched');
  }
  if (navArrived && navArrived.swap) {
    document.documentElement.classList.add('pm-swap', 'pm-swap-all');
    prizeSwapComing = true;
  }
  if (navArrived && navArrived.pieces && navArrived.pieces.length) {
    pieceSigns = { screen: null, until: navArrived.t + NAV_FRESH_MS, set: {} };
    for (var piece = 0; piece < navArrived.pieces.length; piece++) {
      pieceSigns.set[navArrived.pieces[piece]] = 1;
    }
  }

  return {
    init: init,
    openInvoice: openInvoice,
    startPicker: startPicker,
    cleanup: cleanup
  };
})();
