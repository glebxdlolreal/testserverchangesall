/* Premium Bot Mini App: plain classic JavaScript, no build step. */
window.PremiumApp = (function() {
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
  var cardsObserver = null;
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
      Aj.location('/premiumbot');
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
          Aj.location('/premiumbot/result/paid/' + (resultFlow || 'premium'));
        } else if (status === 'pending') {
          Aj.location('/premiumbot/result/pending/' + (resultFlow || 'premium'));
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

  // ===== Gift cards: prices, savings and the Best Value tab stay inside their cards =====

  // How far `child` runs past the sides of `card` less `inset`; 0 or less is inside.
  function overhang(child, card, inset) {
    var outer = card.getBoundingClientRect();
    var inner = child.getBoundingClientRect();
    return Math.max(outer.left + inset - inner.left, inner.right - outer.right + inset);
  }

  // The symbol and the amount in the price's own order; the whole price when it has no symbol to set apart.
  function priceParts(price) {
    var match = /^(\D*)(\d(?:.*\d)?)(\D*)$/.exec(price);
    var before = match ? match[1].trim() : '';
    var after = match ? match[3].trim() : '';
    if (before && !after) {
      return [before, match[2]];
    }
    if (after && !before) {
      return [match[2], after];
    }
    return [price];
  }

  // On two lines the symbol takes a line of its own, so the amount never breaks.
  function priceLines(pill, split) {
    var price = pill.getAttribute('data-price');
    if (price === null) {
      price = pill.textContent;
      pill.setAttribute('data-price', price);
    }
    var parts = split ? priceParts(price) : [price];
    pill.textContent = parts.length === 2 ? '' : price;
    for (var i = 0; parts.length === 2 && i < 2; i++) {
      var line = document.createElement('span');
      line.className = 'gift-card-price-line';
      line.textContent = parts[i];
      pill.appendChild(line);
      if (!i) {
        // Not drawn in the column; assistive tech still reads the price as one.
        pill.appendChild(document.createTextNode(' '));
      }
    }
  }

  function fitGiftRow(row) {
    var cards = row.querySelectorAll('.gift-card');
    if (!cards.length || !cards[0].getBoundingClientRect().width) {
      return;
    }
    var pills = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var tab = cards[i].querySelector('.plan-tab');
      var tabLabel = tab ? tab.querySelector('.plan-tab-label') : null;
      if (tabLabel) {
        // Measured with the label shown; a label that would overhang stays for assistive tech alone.
        tabLabel.classList.remove('sr-only');
        tabLabel.classList.toggle('sr-only', overhang(tab, cards[i], 0) > FIT_SLACK);
      }
      var saving = cards[i].querySelector('.gift-card-saving');
      var amount = saving ? saving.querySelector('.value-amount') : null;
      if (amount) {
        saving.classList.remove('is-wide');
        saving.classList.toggle('is-wide', overhang(amount, saving, 0) > FIT_SLACK);
      }
      var pill = cards[i].querySelector('.gift-card-price');
      if (pill) {
        pills.push([pill, cards[i]]);
      }
    }
    // The whole row takes each step, so the pills stay even: narrower sides, smaller type, then two lines.
    var split = row.classList.contains('price-lines');
    for (var step = 0; step < PRICE_STEPS.length; step++) {
      for (i = 1; i < PRICE_STEPS.length; i++) {
        row.classList.toggle(PRICE_STEPS[i], i === step);
      }
      var fits = true;
      for (i = 0; i < pills.length; i++) {
        if ((step === PRICE_STEPS.length - 1) !== split) {
          priceLines(pills[i][0], !split);
        }
      }
      split = step === PRICE_STEPS.length - 1;
      for (i = 0; i < pills.length; i++) {
        // A price keeps 4 px inside its card's sides.
        fits = fits && overhang(pills[i][0], pills[i][1], 4) <= FIT_SLACK;
      }
      if (fits) {
        return;
      }
    }
  }

  function fitGiftCards() {
    var rows = document.querySelectorAll('.gift-cards');
    for (var i = 0; i < rows.length; i++) {
      fitGiftRow(rows[i]);
    }
  }

  function onResize() {
    fitGiftCards();
    ctaFit();
  }

  // ===== Giveaway matrix (duration or amount, then winners -> option) =====

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
        footerText: nodes[i].getAttribute('data-footer-text'),
        url: nodes[i].getAttribute('data-invoice-url')
      });
    }
    return records;
  }

  function giveawayChecked(name) {
    var input = document.querySelector('.js-gw-' + name + ':checked');
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

  function giveawayWrite(selector, text) {
    var nodes = document.querySelectorAll(selector);
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
    var durInputs = document.querySelectorAll('.js-gw-dur');
    var userInputs = document.querySelectorAll('.js-gw-users');
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
      giveawayWrite('.js-gw-dur-price[data-dur="' + value + '"]', record ? record.price : '');
      giveawayWrite('.js-gw-dur-boosts[data-dur="' + value + '"]', record ? giveawayFill(matrix.getAttribute('data-tpl-boosts') || '', record) : '');
    }
    var picked = offered[users];
    var footer = document.querySelector('.js-gw-footer');
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
        Aj.location(url);
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

  function prizeSwapDrop() {
    var swap = prizeSwap;
    prizeSwap = null;
    document.documentElement.classList.remove('pm-swap-on');
    if (swap) {
      clearTimeout(swap.timer);
      // Only if the page never came: what was put out of sight under its copy is still the page's own.
      for (var i = 0; i < swap.under.length; i++) {
        if (swap.under[i].isConnected) {
          swap.under[i].style.visibility = '';
        }
      }
      // The sections that waited under their copies show as the copies go, in the same frame.
      for (var k = 0; swap.kept && k < swap.kept.length; k++) {
        swap.kept[k].style.opacity = '';
      }
      if (swap.layer.parentNode) {
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
    prizeSwapComing = true;
    var still = root.classList.contains('fx-reduce') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (still || from < 0 || !bar.animate) {
      Aj.location(url);
      return;
    }
    root.classList.add('pm-swap-all');
    var layer = document.createElement('div');
    layer.className = 'pm-ghost';
    layer.setAttribute('aria-hidden', 'true');
    var parts = [];
    var leaving = page.querySelectorAll('.fx-sheet > .section');
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
    var caption = page.querySelector('.hero-subtitle');
    var title = prizeGhost(layer, heading);
    var words = prizeGhost(layer, caption);
    var copy = prizeGhost(layer, bar);
    document.body.appendChild(layer);
    // What was copied goes out of sight under its copy until the page is replaced: a tile's glass drawn twice, one
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
      timer: setTimeout(prizeSwapDrop, 4000)
    };
    Aj.location(url);
  }

  // The page the switch asked for is in place: what was copied leaves and what came arrives. A section that both
  // prizes show alike does neither: its copy stands for it until the copies are dropped, and if what changed above
  // it left it higher or lower, the copy moves there in one piece.
  function prizeSwapRun() {
    var swap = prizeSwap;
    if (!swap || swap.ran) {
      return;
    }
    swap.ran = true;
    clearTimeout(swap.timer);
    var i;
    var page = document.querySelector('.commerce--giveaway');
    var fresh = page ? page.querySelectorAll('.fx-sheet > .section') : [];
    var gone = [{opacity: 1, transform: 'translateX(0px)'}, {opacity: 0, transform: 'translateX(' + (-PRIZE_WAY_PX * swap.way) + 'px)'}];
    var come = [{opacity: 0, transform: 'translateX(' + (PRIZE_WAY_PX * swap.way) + 'px)'}, {opacity: 1, transform: 'translateX(0px)'}];
    var leave = {duration: PRIZE_OUT_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards'};
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
        copy.animate(gone, leave);
      }
    }
    var step = 0;
    for (i = 0; i < fresh.length; i++) {
      if (!kept[i]) {
        fresh[i].animate(come, {duration: PRIZE_IN_MS, delay: 110 + Math.min(step++, 3) * 50, easing: PRIZE_IN_EASE, fill: 'backwards'});
      }
    }
    var pay = page ? page.querySelector('.cta-bar') : null;
    if (pay && swap.pay && prizeSign(pay) === swap.paySign) {
      swap.pay.parentNode.removeChild(swap.pay);
    } else {
      if (swap.pay) {
        swap.pay.animate([{opacity: 1}, {opacity: 0}], leave);
      }
      if (pay) {
        pay.animate([{opacity: 0}, {opacity: 1}], {duration: 240, delay: 160, easing: 'ease-out', fill: 'backwards'});
      }
    }
    if (swap.title) {
      swap.title.animate([{opacity: 1}, {opacity: 0}], {duration: 320, easing: 'ease-in-out', fill: 'forwards'});
    }
    if (swap.words) {
      swap.words.animate([{opacity: 1}, {opacity: 0}], {duration: 160, easing: 'ease-out', fill: 'forwards'});
    }
    var words = page ? page.querySelector('.hero-subtitle') : null;
    if (words) {
      words.animate([{opacity: 0}, {opacity: 1}], {duration: 280, delay: 100, easing: 'ease-out', fill: 'backwards'});
    }
    // The copies are spent, and the switch's copy has come to rest as the page's own switch stands.
    swap.timer = setTimeout(prizeSwapDrop, PRIZE_SLIDE_MS + 60);
  }

  // ===== Page lifecycle =====

  function cleanup() {
    var app = webApp();
    pageToken++;
    stopPicker();
    giveUpInvoice();
    hideMainButton();
    unbindAll();
    clearMessage();
    releasePress();
    if (cardsObserver) {
      cardsObserver.disconnect();
      cardsObserver = null;
    }
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
    applyBridgeClasses();
    var app = webApp();
    var i;
    if (prizeSwapComing) {
      prizeSwapComing = false;
    } else {
      for (i = 0; i < PRIZE_SWAP_CLASSES.length; i++) {
        document.documentElement.classList.remove(PRIZE_SWAP_CLASSES[i]);
      }
    }
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
    on(document, 'click', onPrizeSwitch, true);
    on(document, 'click', onLinkClick);
    on(window, 'scroll', onPageScroll);
    on(window, 'resize', onResize);
    on(window, 'pageshow', planSync);
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
    fitGiftCards();
    var rows = document.querySelectorAll('.gift-cards');
    if (rows.length && window.ResizeObserver) {
      cardsObserver = new ResizeObserver(fitGiftCards);
      for (i = 0; i < rows.length; i++) {
        cardsObserver.observe(rows[i]);
      }
    }
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
      window.Premium3D.mount(document);
    }
    if (window.PremiumFx) {
      // In the same task as the page, so the light and the fields are there for its first frame.
      window.PremiumFx.mount(document);
    }
    Aj.onUnload(cleanup);
    prizeSwapRun();
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

  // Theme and platform classes are wanted for the first paint, which can come before init.
  applyBridgeClasses();

  return {
    init: init,
    openInvoice: openInvoice,
    startPicker: startPicker,
    cleanup: cleanup
  };
})();
