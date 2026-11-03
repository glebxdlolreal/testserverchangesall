/* my.telegram.org — shared UI logic (vanilla JS, no jQuery) */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  function postForm(url, data) {
    var body = Object.keys(data).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(data[key] == null ? '' : data[key]);
    }).join('&');
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
      credentials: 'same-origin'
    }).then(function (res) {
      return res.text().then(function (text) {
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (e) {}
        if (!res.ok) {
          throw { text: (parsed && parsed.text) || text || 'Error', field: parsed && parsed.field };
        }
        return parsed;
      });
    });
  }

  function formData(form) {
    var data = {};
    $all('input, textarea, select', form).forEach(function (el) {
      if (!el.name || el.disabled) return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      data[el.name] = el.value;
    });
    return data;
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    if (busy) {
      btn.setAttribute('data-label', btn.textContent);
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
  }

  function showAlert(slot, text) {
    if (!slot) return;
    if (slot.classList.contains('inline')) {
      slot.innerHTML = '<p class="alert-inline" role="alert">' + escapeHtml(text) + '</p>';
      slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    slot.innerHTML =
      '<div class="callout danger">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
      '<div>' + escapeHtml(text) + '</div></div>';
    slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function clearAlert(slot) {
    if (slot) slot.innerHTML = '';
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fieldOf(input) {
    return input.closest('.field');
  }

  function setFieldState(input, state, msg) {
    var field = fieldOf(input);
    if (!field) return;
    field.classList.remove('ok', 'err');
    if (state) field.classList.add(state);
    var msgEl = $('.hint .msg', field);
    if (msgEl && msg != null) msgEl.textContent = msg;
  }

  function clearFieldState(input) {
    var field = fieldOf(input);
    if (!field) return;
    field.classList.remove('ok', 'err');
  }

  /* ---------- entrance animation ---------- */
  /* subtle staggered rise-in of the heading + cards on page load (telegram.org style).
     /auth: logo, title, text and card of the visible stage */
  var AUTH_ITEMS = '.auth > div > .hero-logo, .auth > div > h1, .auth > div > p, .auth > div > .card';
  function riseIn(items) {
    items.forEach(function (el, i) {
      el.animate(
        [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 460, delay: i * 70, easing: 'cubic-bezier(.2, 0, 0, 1)', fill: 'both' }
      );
    });
  }
  function motionOk() {
    return !!Element.prototype.animate && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function initEntrance() {
    if (!motionOk()) return;
    try { window.scrollTo(0, 0); } catch (e) {}
    riseIn($all('.page section > .head, .page section > .card, .home-head, .home-card > .opt-row, ' + AUTH_ITEMS));
  }

  /* ---------- header logo: paper plane flight ----------
     Adapted from Telegram's own intro animation (Telegram-iOS, submodules/RMIntro/Sources/core/
     animations.c): path dx = sin(tt)*75, dy = -sin(tt)*60, scale s = (cos(tt)+1)/2,
     scaleX = cos(tt)*s (the plane turns edge-on as it flies away). Changes for the 32px clipped
     disc: distances scaled by the plane's own size (9.7 units / 82px texture), the path is cut at
     100deg (plane fully outside the disc, no mirrored frames), exit and entry are separate
     animations with eased progress and a 100ms pause between. Only the plane moves; the disc
     stays still. Plays on hover of the logo itself (not the brand text) and on keyboard focus of
     the brand link; never restarts mid-flight. Off under reduced motion. */
  function rmFrames(from, to, n, ease) {
    var K = 9.7 / 82, out = [];
    for (var i = 0; i <= n; i++) {
      var u = ease ? ease(i / n) : i / n;
      var tt = (from + (to - from) * u) * Math.PI / 180, s = (Math.cos(tt) + 1) / 2;
      out.push({ transform: 'translate(' + (Math.sin(tt) * 75 * K).toFixed(3) + 'px,' + (-Math.sin(tt) * 60 * K).toFixed(3) + 'px) scale(' + (Math.cos(tt) * s).toFixed(4) + ',' + s.toFixed(4) + ')' });
    }
    return out;
  }

  function initLogo() {
    var brand = $('.brand');
    var logo = brand && $('.brand-logo', brand);
    if (!logo || !Element.prototype.animate) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var plane = $('.logo-plane', logo);
    /* exit moves from the first frame and keeps accelerating (progress = t^1.6) */
    var EXIT = rmFrames(0, 100, 32, function (t) { return Math.pow(t, 1.6); });
    var ENTRY = rmFrames(-100, 0, 24);
    var busy = false;

    function play() {
      if (busy) return;
      busy = true;
      /* exit holds its last (off-disc) frame; after a short pause the entry replaces it */
      var ex = plane.animate(EXIT, { duration: 400, fill: 'forwards' });
      ex.onfinish = function () {
        setTimeout(function () {
          var en = plane.animate(ENTRY, { duration: 620, easing: 'cubic-bezier(.16, 1, .3, 1)' });
          ex.cancel();
          en.onfinish = en.oncancel = function () { busy = false; };
        }, 100);
      };
    }
    logo.addEventListener('pointerenter', play);
    brand.addEventListener('focus', function () { if (brand.matches(':focus-visible')) play(); });
  }

  /* ---------- theme toggle ---------- */
  /* Circular wipe ported from bugs.telegram.org's bugtracker-theme.js (doToggle):
     a view transition snapshot of the old theme gets a radial mask cut into it,
     growing from the clicked button on light->dark, shrinking back into it on
     dark->light. The matching CSS lives in my-telegram.css (theme-reveal/collapse). */
  var WIPE_DARK_MS = 800;
  var WIPE_LIGHT_MS = 500;
  var WIPE_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  /* the wipe in flight: { vt, anim, from, to, start, end, dark (old snapshot is light: hole grows),
     shown (theme the DOM has now), heading (theme the wipe is going to), pending (commit of a click
     made during the wipe, run at the end), ended } */
  var wipe = null;

  function currentTheme() {
    var root = document.documentElement;
    return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function commitTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }

  /* `theme-switching` turns CSS transitions off so the colours flip at once (a live page fading its
     colours under the wipe looks muddy). It is held only for the frames around a colour change, not
     for the whole wipe, so hovers, the theme pill and other transitions keep working during it. */
  function holdTransitions() {
    var root = document.documentElement;
    root.classList.add('theme-switching');
    root.offsetWidth;
  }
  function releaseTransitions() {
    // two frames: the colour change has been styled and painted without transitions by then
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      document.documentElement.classList.remove('theme-switching');
    }); });
  }

  function wipeRadius(w) {
    if (!w.anim) return w.start;
    var p = w.anim.effect.getComputedTiming().progress;
    if (p == null) p = w.anim.playState === 'finished' ? 1 : 0;
    return w.from + (w.to - w.from) * p;
  }

  /* what a live layer drawn above the wipe (the api_hash spoiler dust) needs to match it: the circle in
     viewport px and which theme shows inside / outside it. null when no wipe is on screen. The mask is a
     radial-gradient with farthest-corner size, so 100% is the distance from the origin to the farthest
     corner of the snapshot (the viewport). */
  function wipeView() {
    var w = wipe;
    if (!w || w.ended || w.ox == null) return null;
    var vw = window.innerWidth, vh = window.innerHeight;
    var far = Math.max(Math.hypot(w.ox, w.oy), Math.hypot(vw - w.ox, w.oy), Math.hypot(w.ox, vh - w.oy), Math.hypot(vw - w.ox, vh - w.oy));
    var old = w.shown === 'dark' ? 'light' : 'dark';
    var reveal = w.start === 0; // reveal: a hole in the old snapshot shows the live page; collapse: a disc of the old one
    return { x: w.ox, y: w.oy, r: wipeRadius(w) / 100 * far, inside: reveal ? w.shown : old, outside: reveal ? old : w.shown };
  }

  /* run the mask from where it is now to `to` (percent). Going back uses the same ease-out curve over a
     share of the full time, so a reversal starts at once from the current point instead of crawling. */
  function runWipe(w, to) {
    var from = wipeRadius(w);
    if (w.anim) w.anim.cancel();
    var full = w.heading === 'dark' ? WIPE_DARK_MS : WIPE_LIGHT_MS;
    var share = Math.abs(to - from) / Math.abs(w.end - w.start);
    w.from = from; w.to = to;
    var anim = document.documentElement.animate({ '--theme-hole-radius': [from + '%', to + '%'] }, {
      duration: Math.max(160, full * share),
      easing: WIPE_EASE,
      fill: 'forwards',
      pseudoElement: '::view-transition-old(root)'
    });
    w.anim = anim;
    anim.onfinish = function () { if (w.anim === anim) endWipe(w); };
  }

  /* the mask reached its end. A wipe that turned back ends with the old snapshot covering the page, so
     the DOM can switch back under it unseen; then the overlay goes and the live page looks the same. */
  function endWipe(w) {
    if (w.ended) return;
    w.ended = true;
    if (w.pending) { holdTransitions(); w.pending(); w.pending = null; }
    if (wipe === w) wipe = null;
    try { w.vt.skipTransition(); } catch (e) {}
  }

  /* While a view transition is up, Chrome hit-tests every real click to <html> (even with
     `::view-transition { pointer-events: none }`), so buttons under the wipe looked dead. Such a click
     is passed on to the control whose box holds the point; the last one in document order wins, which
     is the innermost one and the settings menu (it sits at the end of <body>). Hover cannot be routed. */
  var themeVTs = 0;
  var ROUTE_SEL = 'a[href], button, input, select, textarea, summary, label, [role="button"], [role="radio"], [tabindex]:not([tabindex="-1"])';
  function controlAt(x, y) {
    var hit = null;
    $all(ROUTE_SEL).forEach(function (el) {
      if (el.disabled || el.closest('[inert]')) return;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return;
      var r = el.getBoundingClientRect();
      if (r.width && r.height && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = el;
    });
    return hit;
  }
  document.addEventListener('click', function (e) {
    if (!themeVTs || e.target !== document.documentElement || !e.isTrusted) return;
    var el = controlAt(e.clientX, e.clientY);
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|button|submit|reset|file)$/.test(el.type)) el.focus();
    else el.click();
  }, true);

  /* next: the theme the page ends up in; commit: applies it (default = store that theme) */
  function toggleTheme(btn, next, commit) {
    var root = document.documentElement;
    next = next || ((wipe ? wipe.heading : currentTheme()) === 'dark' ? 'light' : 'dark');
    commit = commit || function () { commitTheme(next); };
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* a click during a wipe never restarts it: the same direction keeps going, the other one turns the
       circle back from the point it has reached. The click's own choice is applied when the wipe ends. */
    if (wipe) {
      wipe.pending = commit;
      if (next !== wipe.heading) {
        wipe.heading = next;
        if (wipe.anim) runWipe(wipe, next === wipe.shown ? wipe.end : wipe.start);
      }
      return;
    }

    if (!document.startViewTransition || reduce || next === currentTheme()) {
      commit();
      return;
    }

    var rect = btn.getBoundingClientRect();
    var w = { anim: null, shown: next, heading: next, pending: null, ended: false,
              ox: rect.left + rect.width / 2, oy: rect.top + rect.height / 2 };
    // live layers (spoiler dust) prepare before the old snapshot is taken: they may opt out of it
    document.dispatchEvent(new CustomEvent('themewipestart'));
    w.start = next === 'dark' ? 0 : 102;
    w.end = next === 'dark' ? 102 : 0;
    w.from = w.to = w.start;
    holdTransitions();
    root.classList.toggle('theme-reveal', next === 'dark');
    root.classList.remove('theme-collapse');
    root.offsetWidth; // flush styles before the VT captures the old snapshot

    w.vt = document.startViewTransition(commit);
    wipe = w;
    themeVTs++;
    w.vt.updateCallbackDone.then(releaseTransitions, releaseTransitions);

    w.vt.ready.then(function () {
      if (w.ended) return;
      try {
        root.style.setProperty('--theme-origin-x', w.ox + 'px');
        root.style.setProperty('--theme-origin-y', w.oy + 'px');
        if (next !== 'dark') root.classList.add('theme-collapse');
        root.offsetWidth;
        /* keeps the overlay up after the mask animation finishes, so endWipe decides when it goes
           (without it the transition could end one frame before a reversed wipe switches the DOM back) */
        root.animate({ opacity: [1, 1] }, { duration: 60000, pseudoElement: '::view-transition' });
        if (w.heading !== w.shown) endWipe(w); // turned back before the first frame: nothing to show
        else runWipe(w, w.end);
      } catch (e) { endWipe(w); }
    }, function () {});

    var cleared = false;
    var clear = function () {
      if (cleared) return;
      cleared = true;
      themeVTs--;
      if (!w.ended) { w.ended = true; if (w.pending) w.pending(); } // ended early (tab hidden etc.)
      if (wipe === w) wipe = null;
      if (!wipe) {
        root.classList.remove('theme-reveal', 'theme-collapse');
        root.style.removeProperty('--theme-origin-x');
        root.style.removeProperty('--theme-origin-y');
        releaseTransitions();
      }
    };
    w.vt.finished.then(clear, clear);
  }
  /* the inline display:none (anti-FOUC) comes off only once the stylesheet is guaranteed loaded:
     window load waits for it; an already-complete page (warm cache) fires at once */
  function showSettingsMenuLater() {
    if (document.readyState === 'complete') {
      $all('.settings-menu').forEach(function (m) { m.style.display = ''; });
      return;
    }
    window.addEventListener('load', function () {
      $all('.settings-menu').forEach(function (m) { m.style.display = ''; });
    }, { once: true });
  }

  function initTheme() {
    initSettings();
    initEscBlur();
  }

  /* Esc (and Enter in one-line fields) leaves the text field (blur). When Esc already closes something
     (country list, settings menu, /delete confirm), that comes first and the field keeps focus. */
  function initEscBlur() {
    var busy = false;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') busy = !!document.querySelector('.phone-field.open, .settings.open, .confirm-box.open');
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || busy || e.defaultPrevented) return;
      var el = document.activeElement;
      if (el && el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select, [contenteditable="true"]')) el.blur();
    });
    /* Enter in a one-line field: whatever Enter does there runs first (submit the form, pick the country,
       confirm the number); if focus is still in the same field afterwards, it leaves the field too.
       Textareas keep Enter for a new line. */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      var el = e.target;
      if (!el.matches || !el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"]):not([type="button"])')) return;
      if (el.getAttribute('role') === 'combobox') return; // the country search keeps focus (Enter with no match does nothing)
      setTimeout(function () { if (document.activeElement === el) el.blur(); }, 0);
    });
  }

  /* Settings menu behind the gear in the top bar (private pages): the signed-in number with the avatar,
     and the theme: Light / Dark / System. System clears the stored choice, so the page follows the OS
     (the dark CSS already keys on :root:not([data-theme="light"]) inside prefers-color-scheme). The
     switch reuses the circular theme wipe, starting from the pressed segment. */
  function initSettings() {
    $all('.settings').forEach(function (box) {
      var gear = $('.gear-btn', box), menu = $('.settings-menu', box);
      var segs = $all('[data-theme-set]', box);
      /* the menu lives in <body>, not in the top bar: the top bar has its own backdrop-filter, which makes
         it the "backdrop root" for anything inside, so the menu's blur saw only the empty bar and the page
         showed through it sharp. Out here the blur sees the page and the glass works. */
      document.body.appendChild(menu);
      showSettingsMenuLater();
      /* phones: the header links (Getting started, TDLib, API Terms) are hidden in the top bar, so the sheet
         gets a copy of them as rows with an icon and an "opens outside" arrow, between the theme row and Log
         out (user pick A). Built from the header links themselves, so they stay one list; hidden on desktop. */
      var headerLinks = $all('.header-links a');
      if (headerLinks.length && !$('.sm-links', menu)) {
        var LINK_ICONS = {
          'Getting started': '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z"/><path d="M8 7h6"/>',
          'TDLib': '<path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
          'API Terms': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'
        };
        var group = document.createElement('div');
        group.className = 'sm-links';
        headerLinks.forEach(function (a) {
          var row = a.cloneNode(true), label = a.textContent.trim();
          row.className = 'sm-link';
          row.innerHTML = '<svg class="sm-link-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (LINK_ICONS[label] || LINK_ICONS['API Terms']) + '</svg><span></span>' +
            '<svg class="sm-link-ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
          $('span', row).textContent = label;
          group.appendChild(row);
        });
        menu.insertBefore(group, $('.sm-logout', menu));
      }
      // disclosure pattern: the gear says which element it opens
      if (!menu.id) menu.id = 'settings-menu-' + Math.random().toString(36).slice(2, 8);
      gear.setAttribute('aria-controls', menu.id);
      /* Phones (640px and below): the menu is a bottom sheet (user pick): full width at the bottom, a dimmed
         backdrop behind it that closes it on tap, and a downward swipe closes it too. CSS does the layout;
         here the desktop position is dropped, the backdrop is added and the swipe is handled. */
      var sheetMq = window.matchMedia ? matchMedia('(max-width: 640px)') : { matches: false };
      var backdrop = document.createElement('div');
      backdrop.className = 'sm-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(backdrop, menu);
      // the tap lands on the backdrop (not the page under it), so closing never also follows a link there
      backdrop.addEventListener('click', function () { open(false); gear.focus({ preventScroll: true }); });
      function place() {
        if (sheetMq.matches) { menu.style.top = menu.style.right = ''; return; }
        var r = gear.getBoundingClientRect();
        menu.style.top = (r.bottom + 12) + 'px';
        menu.style.right = Math.max(8, document.documentElement.clientWidth - r.right) + 'px';
      }
      window.addEventListener('resize', function () { if (box.classList.contains('open')) place(); });
      /* a choice clicked during a theme wipe is stored only when the wipe ends; until then the switch
         shows it from here, so the pill moves at once and a click on the same segment does nothing */
      var chosen = null;
      function pref() {
        if (chosen) return chosen;
        var t = null; try { t = localStorage.getItem('theme'); } catch (e) {}
        return t === 'light' || t === 'dark' ? t : (document.documentElement.dataset.theme || 'system');
      }
      function mark() {
        var p = pref();
        segs.forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-theme-set') === p)); });
        // slide the pill to the selected segment
        var seg = $('.theme-seg', menu), idx = -1;
        segs.forEach(function (b, k) { if (b.getAttribute('data-theme-set') === p) idx = k; });
        if (seg) { seg.style.setProperty('--i', Math.max(0, idx)); seg.style.setProperty('--on', idx < 0 ? 0 : 1); }
        // roving tabindex: Tab reaches only the selected theme, arrows move between them
        segs.forEach(function (b, k) { b.tabIndex = k === Math.max(0, idx) ? 0 : -1; });
      }
      function focusables() {
        return $all('a[href], button:not([disabled])', menu).filter(function (el) { return el.tabIndex >= 0; });
      }
      function open(on) {
        if (on) place();
        box.classList.toggle('open', on);
        menu.classList.toggle('open', on);
        backdrop.classList.toggle('open', on);
        document.documentElement.classList.toggle('sheet-open', on && sheetMq.matches); // no page scroll under the sheet
        gear.setAttribute('aria-expanded', String(on));
        menu.inert = !on;
        if (on) {
          mark();
          // the menu sits at the end of <body>, far from the gear in tab order, so focus moves into it:
          // the selected theme first (keyboard users land on what they most likely came for)
          var first = segs.filter(function (b) { return b.tabIndex === 0; })[0] || focusables()[0];
          if (first) first.focus({ preventScroll: true });
        }
      }
      gear.addEventListener('click', function () { open(!box.classList.contains('open')); });
      // outside press closes; a press inside the menu's box never does, even if it lands on <html>
      // (as during a theme wipe, when the transition overlay is the hit target)
      document.addEventListener('pointerdown', function (e) {
        if (!box.classList.contains('open') || box.contains(e.target) || menu.contains(e.target) || e.target === backdrop) return;
        var hit = [gear, menu].some(function (el) {
          var r = el.getBoundingClientRect();
          return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        });
        if (!hit) open(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && box.classList.contains('open')) { open(false); gear.focus({ preventScroll: true }); }
      });
      /* swipe down on the sheet: it follows the finger; let go past 70px (or flick down faster than
         0.5 px/ms after 24px) and it closes, otherwise it springs back. Taps on the buttons inside are not affected (a drag starts after 6px, and from then the pointer is
         captured by the sheet, so the release does not press a button). */
      var drag = null;
      menu.addEventListener('pointerdown', function (e) {
        if (!sheetMq.matches || !menu.classList.contains('open') || e.button > 0) return;
        drag = { y: e.clientY, dy: 0, on: false, id: e.pointerId, v: 0, ly: e.clientY, lt: e.timeStamp };
      });
      menu.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        drag.dy = Math.max(0, e.clientY - drag.y);
        // speed of the last movement (px/ms), as iOS judges a flick by how fast the finger leaves
        var dt = e.timeStamp - drag.lt;
        if (dt > 0) { drag.v = (e.clientY - drag.ly) / dt; drag.ly = e.clientY; drag.lt = e.timeStamp; }
        if (!drag.on && drag.dy > 6) { drag.on = true; menu.classList.add('dragging'); try { menu.setPointerCapture(e.pointerId); } catch (err) {} }
        if (drag.on) menu.style.transform = 'translateY(' + drag.dy + 'px)';
      });
      function endDrag(e) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        var d = drag; drag = null;
        if (!d.on) return;
        menu.classList.remove('dragging');
        menu.style.transform = '';
        var fast = d.v > 0.5 && d.dy > 24;
        if (d.dy > 70 || fast) { open(false); gear.focus({ preventScroll: true }); }
      }
      menu.addEventListener('pointerup', endDrag);
      menu.addEventListener('pointercancel', endDrag);
      menu.addEventListener('keydown', function (e) {
        // Tab past either end leaves the menu: it closes and focus goes back to the gear,
        // so the next Tab continues through the page from where the menu was opened
        if (e.key === 'Tab') {
          var f = focusables(), i = f.indexOf(document.activeElement);
          if ((e.shiftKey && i <= 0) || (!e.shiftKey && i === f.length - 1)) {
            e.preventDefault(); open(false); gear.focus({ preventScroll: true });
          }
          return;
        }
        // radio group: arrows / Home / End move the selection, as native radios do
        var at = segs.indexOf(document.activeElement);
        if (at < 0) return;
        var to = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: segs.length - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        to = (to + segs.length) % segs.length;
        segs[to].focus({ preventScroll: true });
        segs[to].click();
      });
      segs.forEach(function (b) {
        b.addEventListener('click', function () {
          var mode = b.getAttribute('data-theme-set');
          if (mode === pref()) return;
          var sys = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          var next = mode === 'system' ? sys : mode;
          chosen = mode;
          toggleTheme(b, next, function () {
            if (mode === 'system') {
              delete document.documentElement.dataset.theme;
              try { localStorage.removeItem('theme'); } catch (e) {}
            } else commitTheme(mode);
            if (chosen === mode) chosen = null; // an older click's commit must not drop a newer choice
            mark();
          });
          mark();
        });
      });
      mark();
      requestAnimationFrame(function () { requestAnimationFrame(function () { var seg = $('.theme-seg', menu); if (seg) seg.classList.add('ready'); }); });
    });
  }

  /* ---------- ripple (design ui.js) ---------- */
  function initMotion() {
    var sel = '.btn, .chip, .icon-btn, .side a, .gear-btn';
    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest(sel);
      if (!el) return;
      var r = el.getBoundingClientRect();
      var d = Math.max(r.width, r.height) * 2.2;
      var s = document.createElement('span');
      s.className = 'ripple';
      s.style.width = s.style.height = d + 'px';
      s.style.left = (e.clientX - r.left - d / 2) + 'px';
      s.style.top = (e.clientY - r.top - d / 2) + 'px';
      el.appendChild(s);
      var EXPAND = 450; // must match the ripple-in keyframe duration in the CSS
      var start = (window.performance && performance.now) ? performance.now() : Date.now();
      var ended = false;
      var done = function () {
        if (ended) return;
        ended = true;
        var now = (window.performance && performance.now) ? performance.now() : Date.now();
        // let the fill finish expanding before it fades, even on a fast click
        var wait = Math.max(0, EXPAND - (now - start));
        setTimeout(function () {
          s.classList.add('out');
          setTimeout(function () { s.remove(); }, 400);
        }, wait);
      };
      el.addEventListener('pointerup', done, { once: true });
      el.addEventListener('pointerleave', done, { once: true });
    });
  }
  /* ---------- country picker ---------- */
  /* Emoji flags where the system renders them (macOS/iOS/Android/Twemoji); the vendored PNGs where it
     does not (Chrome/Edge on Windows draw "US" letters instead — detected as a colourless render) and
     always for FT/globe, where the emoji look is less predictable. */
  var FLAG_EMOJI_OK = null;
  function supportsFlagEmoji() {
    if (FLAG_EMOJI_OK !== null) return FLAG_EMOJI_OK;
    try {
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = 24;
      var ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
      if (!ctx) return (FLAG_EMOJI_OK = false);
      ctx.font = '20px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('\u{1F1FA}\u{1F1F8}', 0, 0);
      var d = ctx.getImageData(0, 0, 24, 24).data;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 32 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 60) {
          return (FLAG_EMOJI_OK = true);
        }
      }
    } catch (e) {}
    return (FLAG_EMOJI_OK = false);
  }
  function flagEmoji(iso2) {
    if (iso2 === 'FT') return '\u{1F3F4}\u200D\u2620\uFE0F';
    return String.fromCodePoint(0x1F1E6 + iso2.charCodeAt(0) - 65, 0x1F1E6 + iso2.charCodeAt(1) - 65);
  }
  function flagHtml(iso2) {
    if (/^[A-Z]{2}$/.test(iso2) && iso2 !== 'FT' && supportsFlagEmoji()) {
      return '<span class="flag flag-emoji">' + flagEmoji(iso2) + '</span>';
    }
    var f = /^[A-Z]{2}$/.test(iso2) ? iso2 : 'globe';
    return '<img class="flag" src="/img/flags/' + f + '.png" alt="" width="20" height="20" loading="lazy" decoding="async">';
  }

  /* national number masks (X = digit) come from the server: myCountriesJson emits per-country
     [iso2, name, dial, mask, minLen, maxLen] from the phonecode config (client_pattern + len_min/max).
     Countries without a config pattern get groups of three, capped by their len_max (E.164 otherwise). */
  function phoneMask(c) {
    if (c[3]) return c[3];
    var dial = c[2].replace(/\D/g, '');
    var n = c[5] || 15 - dial.length, out = '';
    for (var i = 0; i < n; i++) out += (i && i % 3 === 0 ? ' ' : '') + 'X';
    return out;
  }
  function applyMask(digits, mask) {
    var out = '', d = 0;
    for (var i = 0; i < mask.length && d < digits.length; i++) {
      if (mask.charAt(i) === 'X') out += digits.charAt(d++);
      else out += mask.charAt(i);
    }
    return out;
  }
  function maskDigits(mask) { return mask.replace(/[^X]/g, '').length; }

  /* "+7999..." -> the country whose dial code is the longest prefix, with the slice length used.
     Shared codes: +7 6/7xx is Kazakhstan, +1 defaults to the USA. */
  function phoneCountry(digits) {
    if (typeof MyCountries === 'undefined') return null;
    for (var len = 4; len >= 1; len--) {
      var dial = '+' + digits.slice(0, len);
      var hits = MyCountries.filter(function (c) { return c[2] === dial; });
      if (!hits.length) continue;
      var pick = dial === '+7' ? hits.filter(function (c) { return c[0] === (/^[67]/.test(digits.charAt(1)) ? 'KZ' : 'RU'); })[0]
        : dial === '+1' ? hits.filter(function (c) { return c[0] === 'US'; })[0] : null;
      return { c: pick || hits[0], len: len };
    }
    return null;
  }
  function formatPhone(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    var hit = digits && phoneCountry(digits);
    if (!hit) return String(raw || '');
    var nat = digits.slice(hit.len), mask = phoneMask(hit.c), max = maskDigits(mask);
    var out = '+' + digits.slice(0, hit.len) + (nat ? ' ' + applyMask(nat, mask) : '');
    return nat.length > max ? out + ' ' + nat.slice(max) : out;
  }
  function rawPhone(p) { var d = String(p || '').replace(/\D/g, ''); return d ? '+' + d : ''; }

  /* numbers printed by the server (settings menu, /delete) are raw: show them formatted */
  function initPhoneDisplay() {
    $all('.sm-phone, #account_phone').forEach(function (el) { el.textContent = formatPhone(el.textContent.trim()); });
    var hint = $('#deactivate_phone_hint');
    if (hint && !hint.textContent.trim()) {
      var accountPhone = ($('#account_phone') || {}).textContent || '';
      if (accountPhone) hint.textContent = 'Enter ' + accountPhone + ' to confirm';
    }
  }


  /* shortest valid national number: the server's len_min when there is one, else the mask length,
     else 5 digits. +888 stays special: ordinary numbers may be as short as 4, "0..." ones are 8. */
  function phoneMin(c, digits) {
    if (c[0] === 'FT') return digits && digits.charAt(0) !== '0' ? 4 : 8;
    if (c[4]) return c[4];
    if (c[3]) return maskDigits(c[3]);
    return 5;
  }

  function initPhoneField() {
    var field = $('#phoneField');
    if (!field || typeof MyCountries === 'undefined') return;

    var btn = $('#countryBtn', field);
    var pop = $('#countryPop', field);
    pop.style.display = ''; // inline anti-FOUC guard; the stylesheet's closed state takes over
    var list = $('#countryList', field);
    var query = $('#countryQ', field);
    var search = $('#countrySearch', field);
    var input = $('#my_login_phone', field);
    var codeIn = $('#my_login_code', field);
    var flagEl = $('#cFlag', field);
    var nameEl = $('#cName', field);
    var current = codeIn.value;
    var codeOk = true;

    var measure = document.createElement('canvas').getContext('2d');
    function sizeCode() {
      var cs = getComputedStyle(codeIn);
      measure.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      codeIn.style.width = Math.ceil(measure.measureText(codeIn.value || '+').width) + 2 + 'px';
    }
    function layout() {
      sizeCode();
      placeGhost();
    }
    function maskC() { return codeOk ? country : ['', '', current.length > 1 ? current : '+1', '', 0, 0]; }

    /* the mask as faint zeros ("000 000 0000") under the input; typed digits cover them one by one.
       Box metrics are copied from the input so the zeros sit exactly under the real ones. */
    var ghost = $('#phone_ghost', field);
    function placeGhost() {
      if (!ghost) return;
      var cs = getComputedStyle(input);
      ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
       'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'].forEach(function (k) { ghost.style[k] = cs[k]; });
      var rect = input.getBoundingClientRect();
      ghost.style.width = rect.width + 'px';
      ghost.style.height = rect.height + 'px';
    }
    var placeholderText = input.getAttribute('placeholder') || '';
    function syncGhost() {
      if (!ghost || typeof country === 'undefined') return;
      var v = input.value, tpl = phoneMask(maskC()).replace(/X/g, '0');
      var fits = /^[\d ]*$/.test(v) && v.length < tpl.length && v.replace(/\d/g, '0') === tpl.slice(0, v.length);
      var show = (document.activeElement === input || v !== '') && fits && codeOk;
      ghost.querySelector('.ghost-typed').textContent = v;
      ghost.querySelector('.ghost-rest').textContent = tpl.slice(v.length);
      ghost.classList.toggle('on', show);
      // never both texts at once (some UAs keep the placeholder up while focused):
      // the mask zeros are the placeholder whenever they are on
      input.setAttribute('placeholder', show && v === '' ? '' : placeholderText);
    }
    window.addEventListener('resize', placeGhost);
    input.addEventListener('focus', syncGhost);
    input.addEventListener('blur', syncGhost);

    /* Search also finds a country by hidden names: its own language, the languages of the visitor's
       system, and the other official languages of multilingual countries. Names come from the browser
       (Intl.DisplayNames), plus a few everyday aliases the browser does not give. */
    var EXTRA_LANGS = {
      CH: ['de', 'fr', 'it', 'rm'], BE: ['nl', 'fr', 'de'], CA: ['fr'], LU: ['lb', 'fr', 'de'], IE: ['ga'], MT: ['mt'],
      FI: ['sv'], ES: ['ca', 'eu', 'gl'], CY: ['tr'], BY: ['ru'], KZ: ['ru'], KG: ['ru'], RS: ['sr-Latn'], BA: ['hr', 'sr'],
      ME: ['sr-Latn'], IN: ['en'], PK: ['en'], SG: ['zh', 'ms', 'ta'], LK: ['ta'], ZA: ['af', 'zu', 'xh'], IL: ['ar'],
      MA: ['fr'], DZ: ['fr'], TN: ['fr'], AF: ['ps'], NO: ['nn'], PY: ['gn'], BO: ['qu'], PE: ['qu'], NZ: ['mi'], PH: ['en']
    };
    function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
    var namers = {}, hidden = {};
    function namer(lang) {
      if (!(lang in namers)) {
        try { namers[lang] = new Intl.DisplayNames([lang], { type: 'region', fallback: 'none' }); } catch (e) { namers[lang] = null; }
      }
      return namers[lang];
    }
    var ALIASES = {
      GB: ['uk', 'britain', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'],
      US: ['usa', 'us', 'america', 'united states of america'], NL: ['holland'], CI: ['ivory coast'],
      IT: ['vatican', 'holy see'], SZ: ['swaziland'], CZ: ['czech republic'], MK: ['macedonia'], MM: ['burma'],
      TR: ['turkiye'], AE: ['uae', 'emirates'], KR: ['south korea'], KP: ['north korea', 'dprk'],
      TL: ['east timor'], CV: ['cape verde'], CD: ['drc', 'congo kinshasa'], CG: ['congo brazzaville'],
      RU: ['rf'], BY: ['belorussia'], LA: ['laos'], SY: ['syria'], VN: ['vietnam'], IR: ['persia']
    };
    function hiddenNames(iso) {
      if (hidden[iso] != null) return hidden[iso];
      var langs = [];
      try { var loc = new Intl.Locale('und-' + iso).maximize(); langs.push(loc.language + (loc.script ? '-' + loc.script : '')); } catch (e) {}
      langs = langs.concat(EXTRA_LANGS[iso] || [], navigator.languages || [navigator.language]);
      var names = [];
      langs.forEach(function (l) {
        var d = l && namer(l), n = null;
        try { n = d && d.of(iso); } catch (e) {}
        if (n && n !== iso) names.push(norm(n));
      });
      (ALIASES[iso] || []).forEach(function (a) { names.push(a); });
      return (hidden[iso] = names.join('\n'));
    }

    function render(filter) {
      var f = norm(filter || '');
      var dial = f.replace(/^\+/, '');
      list.innerHTML = '';
      var shown = 0;
      /* a search lists the best matches first: the English name starting with the text, then a word of it,
         then the dial code, then a hidden native name starting with it, then anything containing it */
      var rows = MyCountries;
      if (f) {
        var rank = function (c) {
          var n = norm(c[1]), hn = hiddenNames(c[0]);
          if (('\n' + hn + '\n').indexOf('\n' + f + '\n') >= 0) return 0;
          if (n.indexOf(f) === 0) return 0.5;
          if ((' ' + n).indexOf(' ' + f) >= 0) return 1;
          if (c[2] === '+' + dial && /^\+?\d+$/.test(f)) return 1.5;
          if (c[2].replace(/^\+/, '').indexOf(dial) === 0 && /^\+?\d+$/.test(f)) return 2;
          if (('\n' + hn).indexOf('\n' + f) >= 0) return 3;
          if (n.indexOf(f) >= 0 || hn.indexOf(f) >= 0) return 4;
          if (c[2].replace(/^\+/, '').indexOf(dial) === 0) return 5;
          return -1;
        };
        rows = MyCountries.map(function (c, i) { return { c: c, r: rank(c), i: i }; })
          .filter(function (x) { return x.r >= 0; })
          .sort(function (a, b) { return a.r - b.r || a.i - b.i; })
          .map(function (x) { return x.c; });
      }
      rows.forEach(function (c) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.id = 'cc-' + c[0] + '-' + c[2].slice(1);
        var isSel = codeOk && c === country;
        li.className = isSel ? 'sel' : '';
        li.setAttribute('aria-selected', String(isSel));
        li.innerHTML = flagHtml(c[0]) + '<span class="name"></span><span class="dial">' + c[2] + '</span>';
        $('.name', li).textContent = c[1];
        li.addEventListener('click', function () { pick(c); });
        li.addEventListener('mousemove', function () { if (!li.classList.contains('active')) setActive(options().indexOf(li), false); });
        list.appendChild(li);
        shown++;
      });
      if (!shown) {
        list.innerHTML = '<li class="empty" role="presentation">No countries found</li>';
        setActive(-1);
        return;
      }
      var opts = options(), at = f ? 0 : Math.max(0, opts.findIndex(function (li) { return li.classList.contains('sel'); }));
      // a search starts the list from its very top; the full list centres the chosen country
      if (f) { list.scrollTop = 0; setActive(at, false); } else setActive(at, true, true);
    }

    /* Keyboard: focus stays in the search field (combobox with aria-activedescendant): Up / Down move the
       highlight, PageUp / PageDown jump 8 rows, Enter picks, Tab closes and goes on to the number. */
    var activeIdx = -1;
    function options() { return $all('li[role="option"]', list); }
    function setActive(i, scroll, center) {
      var opts = options();
      opts.forEach(function (li) { li.classList.remove('active'); });
      activeIdx = opts.length ? Math.max(0, Math.min(opts.length - 1, i)) : -1;
      if (i < 0 || activeIdx < 0) { activeIdx = -1; query.removeAttribute('aria-activedescendant'); return; }
      var li = opts[activeIdx];
      li.classList.add('active');
      query.setAttribute('aria-activedescendant', li.id);
      if (scroll) li.scrollIntoView({ block: center ? 'center' : 'nearest' });
    }

    /* keep a 24px gap between the list and the bottom of the window */
    var GAP = 24, MIN_LIST = 120, MAX_LIST = 216;
    function fitPop(noScroll) {
      list.style.maxHeight = '';
      var top = field.getBoundingClientRect().top + pop.offsetTop;
      var chrome = pop.offsetHeight - list.offsetHeight;
      var room = window.innerHeight - GAP - top - chrome;
      var h = Math.max(MIN_LIST, Math.min(MAX_LIST, room));
      list.style.maxHeight = h + 'px';
      var bottom = field.getBoundingClientRect().top + pop.offsetTop + pop.offsetHeight;
      if (bottom + GAP > window.innerHeight && h > MIN_LIST) {
        h = Math.max(MIN_LIST, h - (bottom + GAP - window.innerHeight));
        list.style.maxHeight = h + 'px';
        bottom = field.getBoundingClientRect().top + pop.offsetTop + pop.offsetHeight;
      }
      var over = Math.ceil(bottom + GAP - window.innerHeight);
      if (over > 0 && !noScroll) {
        var spare = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
        if (spare < over) document.body.style.paddingBottom = (over - spare) + 'px';
        window.scrollBy({ top: over, behavior: 'smooth' });
      }
    }
    window.addEventListener('resize', function () { if (field.classList.contains('open')) fitPop(true); });

    /* iOS-style scrolling for the list: no browser scrollbar; a thin overlay thumb that shows while the
       list scrolls or is hovered and fades out after; rows fade out at the top edge once scrolled. */
    var thumb = document.createElement('div');
    thumb.className = 'country-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    pop.appendChild(thumb);
    var THUMB_INSET = 6, THUMB_MIN = 28, hideThumb = 0;
    function thumbGeo() {
      var max = list.scrollHeight - list.clientHeight, track = list.clientHeight - THUMB_INSET * 2;
      return { max: max, track: track, h: Math.max(THUMB_MIN, track * list.clientHeight / Math.max(1, list.scrollHeight)) };
    }
    function syncScroll(flash) {
      var g = thumbGeo();
      list.classList.toggle('fade-top', list.scrollTop > 1);
      if (g.max <= 1) { thumb.style.display = 'none'; return; }
      thumb.style.display = '';
      thumb.style.height = g.h + 'px';
      thumb.style.transform = 'translateY(' + (list.offsetTop + THUMB_INSET + (g.track - g.h) * list.scrollTop / g.max) + 'px)';
      if (flash) {
        pop.classList.add('scrolling');
        clearTimeout(hideThumb);
        hideThumb = setTimeout(function () { pop.classList.remove('scrolling'); }, 900);
      }
    }
    list.addEventListener('scroll', function () { syncScroll(true); }, { passive: true });
    if (window.MutationObserver) new MutationObserver(function () { syncScroll(false); }).observe(list, { childList: true });
    if (window.ResizeObserver) new ResizeObserver(function () { syncScroll(false); }).observe(list);
    thumb.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var g = thumbGeo(), y0 = e.clientY, s0 = list.scrollTop;
      thumb.setPointerCapture(e.pointerId);
      thumb.classList.add('drag');
      function move(ev) { list.scrollTop = s0 + (ev.clientY - y0) * g.max / Math.max(1, g.track - g.h); }
      function up() {
        thumb.classList.remove('drag');
        thumb.removeEventListener('pointermove', move);
        thumb.removeEventListener('pointerup', up);
        thumb.removeEventListener('pointercancel', up);
      }
      thumb.addEventListener('pointermove', move);
      thumb.addEventListener('pointerup', up);
      thumb.addEventListener('pointercancel', up);
    });

    function open() {
      pop.inert = false;
      search.inert = false;
      query.value = '';
      fitPop();
      field.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      query.setAttribute('aria-expanded', 'true');
      render('');
      setTimeout(function () { query.focus({ preventScroll: true }); }, 60);
    }

    function close(focusTo) {
      if (!field.classList.contains('open')) return;
      document.body.style.paddingBottom = '';
      field.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      query.setAttribute('aria-expanded', 'false');
      if (focusTo) focusTo.focus({ preventScroll: true });
      else if (pop.contains(document.activeElement)) btn.focus({ preventScroll: true });
      pop.inert = true;
      search.inert = true;
    }

    var country = MyCountries.filter(function (c) { return c[0] === 'US'; })[0] || MyCountries[0];

    function setFlag(iso) { flagEl.innerHTML = flagHtml(iso); }

    function setCountry(c) {
      country = c;
      codeOk = true;
      current = c[2];
      codeIn.value = c[2];
      setFlag(c[0]);
      nameEl.textContent = c[1];
      field.classList.remove('no-country');
      layout();
      syncGhost();
    }

    // the typed code matches no country (yet): globe and a grey note instead of a name
    function setUnknown(code) {
      codeOk = false;
      current = code;
      var d = code.replace(/\D/g, '');
      var partial = d && MyCountries.some(function (c) { return c[2].indexOf(code) === 0; });
      setFlag('');
      nameEl.textContent = !d || partial ? 'Choose a country' : 'Invalid country code';
      field.classList.add('no-country');
      sizeCode();
      syncGhost();
    }

    function pick(c) {
      setCountry(c);
      close(input);
      format(input.value.replace(/\D/g, ''), null);
    }

    function countryFor(digits) {
      for (var len = 4; len >= 1; len--) {
        var dial = '+' + digits.slice(0, len);
        var hits = MyCountries.filter(function (c) { return c[2] === dial; });
        if (!hits.length) continue;
        var pickIt = hits.filter(function (c) { return c === country; })[0];
        if (!pickIt && dial === '+7') pickIt = hits.filter(function (c) { return c[0] === (/^[67]/.test(digits.charAt(1)) ? 'KZ' : 'RU'); })[0];
        if (!pickIt && dial === '+1') pickIt = hits.filter(function (c) { return c[0] === 'US'; })[0];
        return { c: pickIt || hits[0], len: len };
      }
      return null;
    }

    /* writes the national number: masked with spaces, or as typed when it holds - ( ) */
    var lastValue = '';
    function format(raw, caretDigits, caretPos) {
      var max = maskDigits(phoneMask(maskC()));
      var digits = raw.replace(/\D/g, '').slice(0, max);
      var mask = phoneMask(maskC());
      var out;
      if (/[-()]/.test(raw)) {
        var n = 0;
        out = raw.replace(/\d/g, function (d) { return ++n <= max ? d : ''; });
        input.value = out;
        lastValue = out;
        if (caretPos != null && document.activeElement === input) {
          var p = Math.min(out.length, caretPos - (raw.length - out.length));
          input.setSelectionRange(Math.max(0, p), Math.max(0, p));
        }
        return;
      }
      out = applyMask(digits, mask);
      input.value = out;
      lastValue = out;
      if (caretDigits != null) {
        var pos = 0, seen = 0;
        while (pos < out.length && seen < caretDigits) { if (/\d/.test(out.charAt(pos))) seen++; pos++; }
        if (document.activeElement === input) input.setSelectionRange(pos, pos);
      }
    }

    input.addEventListener('input', function () {
      var raw = input.value;
      var caret = input.selectionStart == null ? raw.length : input.selectionStart;
      var plus = raw.indexOf('+');
      if (plus >= 0) {
        // a full number with "+" (pasted or typed): its dial code goes to the country row
        var all = raw.slice(plus + 1).replace(/\D/g, '');
        var hit = countryFor(all);
        if (hit) {
          if (hit.c !== country) setCountry(hit.c);
          var rest = all.slice(hit.len);
          format(rest, rest.length);
          return;
        }
        // still typing a code ("+", "+3") or one no country has ("+999"): it moves into the code input
        input.value = raw.slice(0, plus).replace(/[^\d\-() ]/g, '');
        lastValue = input.value;
        codeIn.value = '+' + all;
        codeIn.focus();
        codeIn.setSelectionRange(codeIn.value.length, codeIn.value.length);
        onCode(false);
        return;
      }
      var clean = raw.replace(/[^\d\-() ]/g, '');
      var digits = clean.replace(/\D/g, ''), max = maskDigits(phoneMask(maskC()));
      if (digits.length > max && digits.length - lastValue.replace(/\D/g, '').length > 1) {
        // a whole number was pasted: own code without "+", "8 999..." (RU, KZ), trunk 0 -> national number
        var dialD = current.replace(/\D/g, '');
        var hit2 = digits.slice(0, 2) === '00' ? countryFor(digits.slice(2)) : null;
        if (hit2) {
          if (hit2.c !== country) setCountry(hit2.c);
          var r2 = digits.slice(2 + hit2.len);
          format(r2, r2.length);
          return;
        }
        var nat = null;
        if (digits.indexOf(dialD) === 0 && digits.length - dialD.length <= max) nat = digits.slice(dialD.length);
        else if (codeOk && (country[0] === 'RU' || country[0] === 'KZ') && digits.charAt(0) === '8' && digits.length === max + 1) nat = digits.slice(1);
        else if (digits.charAt(0) === '0' && digits.length === max + 1) nat = digits.slice(1);
        if (nat != null) { format(nat, nat.length); return; }
      }
      var before = raw.slice(0, caret).replace(/\D/g, '').length;
      var cleanCaret = raw.slice(0, caret).replace(/[^\d\-() ]/g, '').length;
      if (clean === lastValue && clean !== raw) {
        // only a disallowed character was typed: put the old value back, caret where it was
        input.value = lastValue;
        var p = Math.max(0, caret - (raw.length - lastValue.length));
        input.setSelectionRange(p, p);
        return;
      }
      format(clean, before, cleanCaret);
    });

    /* Pasting a whole number replaces what is in the field. A paste counts as a whole number when it
       starts with "+" or "00" or holds 6+ digits; shorter pastes are inserted at the caret as before. */
    input.addEventListener('paste', function (e) {
      var cd = e.clipboardData || window.clipboardData;
      var text = cd ? cd.getData('text') : '';
      if (!text) return;
      text = text.replace(/[\u00a0\u2000-\u200b\u2060]/g, ' ').trim();
      if (!/^(\+|00)/.test(text) && text.replace(/\D/g, '').length < 6) return;
      e.preventDefault();
      lastValue = '';
      input.value = text.slice(0, 40);
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    input.addEventListener('input', syncGhost);

    // Backspace / Delete right next to a mask space removes the digit behind it, not just the space
    input.addEventListener('keydown', function (e) {
      if (input.selectionStart !== input.selectionEnd) return;
      var p = input.selectionStart, v = input.value;
      if (e.key === 'Backspace' && p > 0 && v.charAt(p - 1) === ' ') input.setSelectionRange(p - 1, p - 1);
      if (e.key === 'Delete' && v.charAt(p) === ' ') input.setSelectionRange(p + 1, p + 1);
      // Backspace or Left at the start of the number goes back into the code
      if ((e.key === 'Backspace' || e.key === 'ArrowLeft') && p === 0 && input.selectionEnd === 0 && !e.shiftKey) {
        e.preventDefault();
        codeIn.focus();
        codeIn.setSelectionRange(codeIn.value.length, codeIn.value.length);
      }
    });

    /* Code input: always starts with "+", up to 4 digits. A code that matches a country picks it in the
       country row; when no longer code can follow, typing moves on to the number. */
    function onCode(typing) {
      var digits = codeIn.value.replace(/\D/g, '');
      var hit = digits ? countryFor(digits) : null;
      if (hit) hit = { c: hit.c, len: hit.c[2].length - 1 };
      var longer = function (d) { return MyCountries.some(function (c) { return c[2].length > d.length + 1 && c[2].indexOf('+' + d) === 0; }); };
      var prefix = function (d) { return MyCountries.some(function (c) { return c[2].indexOf('+' + d) === 0; }); };
      if (hit && hit.len < digits.length && !prefix(digits)) {
        var rest = digits.slice(hit.len);
        setCountry(hit.c);
        codeIn.value = '+' + digits.slice(0, hit.len);
        current = codeIn.value;
        sizeCode();
        lastValue = '';
        format(rest + input.value.replace(/\D/g, ''), rest.length);
        input.focus();
        var pos = 0, seen = 0, v = input.value;
        while (pos < v.length && seen < rest.length) { if (/\d/.test(v.charAt(pos))) seen++; pos++; }
        input.setSelectionRange(pos, pos);
        syncGhost();
        return;
      }
      digits = digits.slice(0, 4);
      codeIn.value = '+' + digits;
      if (hit && hit.len === digits.length) {
        if (hit.c !== country || !codeOk) setCountry(hit.c); else { current = codeIn.value; sizeCode(); }
        format(input.value.replace(/\D/g, ''), null);
        if (typing && !longer(digits)) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      } else {
        /* a code still being typed ("+", "+4") keeps the country row as it was until the code is complete;
           codeOk false meanwhile, so the number cannot be sent */
        if (document.activeElement === codeIn && (!digits || prefix(digits))) { codeOk = false; current = codeIn.value; sizeCode(); }
        else setUnknown(codeIn.value);
        format(input.value.replace(/\D/g, ''), null);
      }
      syncGhost();
    }
    codeIn.addEventListener('blur', function () {
      setTimeout(function () { if (!codeOk && document.activeElement !== codeIn) setUnknown(codeIn.value); }, 0);
    });
    codeIn.addEventListener('input', function (e) {
      onCode(!!(e.inputType && e.inputType.indexOf('insert') === 0 && e.inputType !== 'insertFromPaste'));
    });
    codeIn.addEventListener('keydown', function (e) {
      var s0 = codeIn.selectionStart, s1 = codeIn.selectionEnd;
      if (e.key === 'Backspace' && s0 === s1 && s0 <= 1) e.preventDefault();
      if ((e.key === 'Home' || (e.key === 'ArrowLeft' && s0 <= 1)) && !e.shiftKey) { e.preventDefault(); codeIn.setSelectionRange(1, 1); }
      if (e.key === 'ArrowRight' && s0 === s1 && s0 === codeIn.value.length && !e.shiftKey) {
        e.preventDefault();
        input.focus();
        input.setSelectionRange(0, 0);
      }
    });
    codeIn.addEventListener('focus', function () {
      setTimeout(function () { if (document.activeElement === codeIn && codeIn.selectionStart === 0 && codeIn.selectionEnd === 0) codeIn.setSelectionRange(1, 1); }, 0);
    });
    codeIn.addEventListener('mouseup', function () { if (codeIn.selectionStart === 0 && codeIn.selectionEnd === 0) codeIn.setSelectionRange(1, 1); });

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (field.classList.contains('open')) close(); else open();
    });
    query.addEventListener('input', function () { render(query.value); });
    query.addEventListener('keydown', function (e) {
      if (e.isComposing) return;
      var opts = options();
      var step = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 }[e.key];
      if (step) {
        e.preventDefault();
        if (opts.length) setActive(activeIdx < 0 ? 0 : activeIdx + step, true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (opts[activeIdx]) opts[activeIdx].click();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        close(e.shiftKey ? btn : input);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(btn);
      }
    });
    btn.addEventListener('keydown', function (e) {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !field.classList.contains('open')) { e.preventDefault(); open(); }
    });
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
    search.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && field.classList.contains('open')) close(btn); });
    setCountry(country);

    // '' when the number can be sent, else the error text for the hint
    field.codeError = function () {
      var d = current.replace(/\D/g, '');
      if (codeOk) return '';
      if (!d) return 'Choose a country or enter its code';
      for (var len = 1; len <= d.length; len++) {
        var pre = '+' + d.slice(0, len);
        if (!MyCountries.some(function (c) { return c[2].indexOf(pre) === 0; })) return 'No country uses the code ' + pre;
      }
      return 'Choose a country or finish its code';
    };
    field.phoneError = function () {
      var ce = field.codeError();
      if (ce) return ce;
      var d = input.value.replace(/\D/g, ''), n = d.length;
      if (!n) return 'Enter your phone number';
      var min = phoneMin(country, d), max = maskDigits(phoneMask(country));
      if (n < min) return 'Too short: ' + current + ' numbers have ' + (min === max ? min : min + '\u2013' + max) + ' digits';
      return '';
    };

    // what goes to the server: raw "+88801024105" (dial code + national digits, no formatting)
    field.getFullPhone = function () {
      var digits = input.value.replace(/\D/g, '');
      if (!digits) return '';
      return rawPhone(current + digits);
    };
  }

  /* ---------- auth: phone + code ---------- */
  function initAuth() {
    var sendForm = $('#my_send_form');
    if (!sendForm) return;

    var loginForm = $('#my_login_form');
    // each stage has its own error line under its button; this one points at the visible stage's
    var sendAlert = $('#my_send_alert');
    var codeAlert = $('#my_code_alert');
    var alertSlot = sendAlert;
    var phoneInput = $('#my_login_phone');
    var dialInput = $('#my_login_code');
    var phoneField = $('#phoneField');
    var codeInput = $('#my_password');
    var hashInput = $('#my_random_hash');
    var phoneHidden = $('#my_login_phone_input');

    var stagePhone = $('#stage_phone');
    var stageCode = $('#stage_code');
    var codePhone = $('#my_code_phone');
    var resendLink = $('#my_resend_link');
    var resendText = $('#my_resend_text');
    var resendTimer = null;

    function showCodeStage(phone) {
      if (stagePhone && stageCode) {
        stagePhone.classList.add('my-hide');
        stageCode.classList.remove('my-hide');
      }
      clearAlert(sendAlert);
      alertSlot = codeAlert;
      if (codePhone) codePhone.textContent = formatPhone(phone); // sent raw, shown formatted
      if (codeInput) codeInput.focus();
      startResendCountdown(42);
    }

    function showPhoneStage() {
      if (stagePhone && stageCode) {
        stageCode.classList.add('my-hide');
        stagePhone.classList.remove('my-hide');
      }
      clearAlert(codeAlert);
      alertSlot = sendAlert;
      stopResendCountdown();
    }

    function stopResendCountdown() {
      if (resendTimer) {
        clearInterval(resendTimer);
        resendTimer = null;
      }
    }

    function startResendCountdown(seconds) {
      if (!resendLink || !resendText) return;
      stopResendCountdown();
      var left = seconds;
      resendLink.classList.add('disabled');
      var tick = function () {
        var mm = Math.floor(left / 60);
        var ss = ('0' + (left % 60)).slice(-2);
        resendText.textContent = 'Resend in ' + mm + ':' + ss;
        if (left <= 0) {
          stopResendCountdown();
          resendText.textContent = 'Resend code';
          resendLink.classList.remove('disabled');
        }
        left--;
      };
      tick();
      resendTimer = setInterval(tick, 1000);
    }

    function sendPassword(phone, btn, onDone) {
      // the old error stays until the answer comes: clearing it first made the card shrink and grow back
      // on every repeated Next; the new error replaces it, success removes it
      setBusy(btn, true);
      postForm('/auth/send_password', { phone: phone }).then(function (result) {
        setBusy(btn, false);
        clearAlert(alertSlot);
        if (hashInput) hashInput.value = result.random_hash;
        if (phoneHidden) phoneHidden.value = phone;
        if (onDone) onDone(phone);
      }).catch(function (err) {
        setBusy(btn, false);
        showAlert(alertSlot, err.text);
      });
    }

    var phoneHint = phoneField && $('.hint .msg', phoneField);
    var phoneHintHtml = phoneHint ? phoneHint.innerHTML : '';
    function phoneEdited() {
      clearAlert(sendAlert); // a new number: the old send error no longer applies
      if (!phoneField || !phoneField.classList.contains('err')) return;
      clearFieldState(phoneInput);
      if (phoneHint) phoneHint.innerHTML = phoneHintHtml;
    }
    phoneInput.addEventListener('input', phoneEdited);
    if (dialInput) dialInput.addEventListener('input', phoneEdited);

    sendForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = phoneField && phoneField.getFullPhone ? phoneField.getFullPhone() : phoneInput.value.trim();
      var perr = phoneField && phoneField.phoneError ? phoneField.phoneError() : (phone.replace(/\D/g, '').length < 5 ? 'Enter a valid phone number' : '');
      if (perr) {
        setFieldState(phoneInput, 'err', perr);
        // a bad code is fixed in the code input, a short number in the number input
        (dialInput && phoneField.codeError && phoneField.codeError() ? dialInput : phoneInput).focus();
        return;
      }
      clearFieldState(phoneInput);
      sendPassword(phone, $('button[type="submit"]', sendForm), showCodeStage);
    });

    var wrongNumber = $('#my_wrong_number');
    if (wrongNumber) {
      wrongNumber.addEventListener('click', function (e) {
        e.preventDefault();
        clearAlert(alertSlot);
        showPhoneStage();
        if (phoneInput) phoneInput.focus();
      });
    }

    if (resendLink) {
      resendLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (resendLink.classList.contains('disabled')) return;
        sendPassword(phoneHidden.value, null, function () {
          startResendCountdown(42);
        });
      });
    }

    if (codeInput) {
      // paste: spaces are dropped before the 20-character limit, so "12 34 56 ..." keeps 20 digits
      codeInput.addEventListener('beforeinput', function (e) {
        if (e.inputType !== 'insertFromPaste' && e.inputType !== 'insertFromDrop') return;
        var text = e.data != null ? e.data : (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
        if (text == null) return;
        e.preventDefault();
        var v = codeInput.value, a = codeInput.selectionStart, b = codeInput.selectionEnd;
        var head = v.slice(0, a), tail = v.slice(b);
        var ins = String(text).replace(/\s+/g, '').slice(0, Math.max(0, 20 - head.length - tail.length));
        codeInput.value = head + ins + tail;
        codeInput.setSelectionRange(head.length + ins.length, head.length + ins.length);
        codeInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      codeInput.addEventListener('input', function () {
        codeInput.value = codeInput.value.replace(/\s+/g, '').slice(0, 20);
        clearFieldState(codeInput);
      });
    }

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearAlert(alertSlot);
      if (!codeInput.value) {
        setFieldState(codeInput, 'err', 'Enter the code from the Telegram message');
        codeInput.focus();
        return;
      }
      var btn = $('button[type="submit"]', loginForm);
      setBusy(btn, true);
      postForm('/auth/login', formData(loginForm)).then(function () {
        location.href = typeof MyAuthRedirect !== 'undefined' ? MyAuthRedirect : '/';
      }).catch(function (err) {
        setBusy(btn, false);
        setFieldState(codeInput, 'err', err.text);
      });
    });
  }

  /* ---------- app form validation ---------- */
  /* title: same rule as the server (trimmed, at least 5 chars, max 255); short name: 5-32
     latin letters, digits and spaces. Neither may contain the word "Telegram" (any case,
     also split by spaces). Shared by /apps/new and App configuration. */
  var SHORT_NAME_MSG = '5–32 characters: latin letters, digits and spaces';
  var TELEGRAM_MSG = 'Can\u2019t contain the word \u201cTelegram\u201d';
  function appNameProblem(kind, v) {
    if (/telegram/i.test(String(v).replace(/\s+/g, ''))) return TELEGRAM_MSG;
    if (kind === 'short') return /^[A-Za-z0-9 ]{5,32}$/.test(v) ? '' : SHORT_NAME_MSG;
    return String(v).trim().length >= 5 ? '' : 'At least 5 characters';
  }

  /* textarea that grows with its text (up to its CSS max-height, then scrolls, `.scroll` drives the
     label fade) and shows its `.count-hint` counter only in the last 10% of maxlength (red when full).
     Used by the delete reason and the /apps/new description. */
  function initAutoGrow(textarea) {
    if (!textarea) return;
    var field = fieldOf(textarea);
    var countHint = field && $('.count-hint', field);
    var countEl = countHint && $('.count', countHint);
    var maxLen = +textarea.getAttribute('maxlength') || 0;
    var fit = function () {
      textarea.style.height = 'auto';
      var cap = parseFloat(getComputedStyle(textarea).maxHeight) || Infinity;
      var h = textarea.scrollHeight + 3; /* + top/bottom border */
      textarea.style.height = Math.min(h, cap) + 'px';
      textarea.classList.toggle('scroll', h > cap);
      if (countEl && maxLen) {
        var n = textarea.value.length;
        // only in the last 10% (user: from the first character it was noise; both limits are 512 now)
        countHint.classList.toggle('on', n >= maxLen * 0.9);
        countHint.classList.toggle('full', n >= maxLen);
        countEl.textContent = n + ' / ' + maxLen;
      }
    };
    textarea.addEventListener('input', fit);
    fit();
  }

  /* ---------- auto-prefix fields ---------- */
  /* A field that always starts with a fixed prefix (App URL "https://", WNS Package SID
     "ms-app://S-1-15-2-"). Entering an empty field puts the prefix in with the caret after it; leaving with
     nothing more takes it out; while the field has focus the prefix cannot be removed (Backspace, cut,
     select all + delete leave only the prefix). normalize(value) returns the value with exactly one
     prefix (pasted or doubled prefixes, damaged prefix). onChange runs after focus / blur change the value.
     The input / blur listeners are capture ones, so the field's own handlers see the final value. */
  function initAutoPrefix(input, prefix, normalize, onChange) {
    var done = onChange || function () {};
    input.addEventListener('focus', function () {
      if (input.value !== '') return;
      input.value = prefix;
      // after the click has placed its caret (and only if nothing was typed in between)
      setTimeout(function () {
        if (input.value === prefix) input.setSelectionRange(prefix.length, prefix.length);
      }, 0);
      done();
    });
    input.addEventListener('input', function () {
      var v = input.value, fromEnd = v.length - (input.selectionEnd || 0);
      var n = v.replace(/\s+/g, '') === '' ? prefix : normalize(v);
      if (n === v) return;
      input.value = n;
      var pos = Math.max(prefix.length, n.length - fromEnd);
      input.setSelectionRange(pos, pos);
    }, true);
    input.addEventListener('blur', function () {
      if (input.value.trim().toLowerCase() === prefix.toLowerCase()) { input.value = ''; done(); }
    }, true);
  }
  /* ---------- copy buttons ---------- */
  function initCopy() {
    var CHECK_SVG = '<svg class="ic-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M5.5 12.5l4.25 4.25L18.5 8"/></svg>';
    $all('[data-copy]').forEach(function (btn) {
      var glyph = btn.querySelector('svg');
      if (glyph) glyph.classList.add('ic-copy');
      btn.insertAdjacentHTML('beforeend', CHECK_SVG);
      btn.addEventListener('click', function (e) {
        // inside a <summary> (MTProto server address) copying must not open or close the row
        if (btn.closest('summary')) e.preventDefault();
        copyText(btn.getAttribute('data-copy'), btn);
      });
    });
  }

  function copyText(value, btn) {
    var done = function () {
      clearTimeout(btn._copiedTimer);
      btn.classList.remove('copied');
      void btn.offsetWidth;
      btn.classList.add('copied');
      btn._copiedTimer = setTimeout(function () { btn.classList.remove('copied'); }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done, done);
    } else {
      var area = document.createElement('textarea');
      area.value = value;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch (e) {}
      area.remove();
      done();
    }
  }

  /* ---------- create app ----------
     A field turns red once it has been left with a bad value (or the user starts fixing a red one);
     while typing into a fresh field it stays neutral. Create is inert until everything is valid. */
  function initCreateApp() {
    var form = $('#app_create_form');
    if (!form) return;

    $all('.chip input[type="radio"]', form).forEach(function (radio) {
      radio.addEventListener('change', function () {
        $all('.chip', form).forEach(function (chip) { chip.classList.remove('on'); });
        radio.closest('.chip').classList.add('on');
      });
    });

    var URL_PREFIX = 'https://';
    var titleInput = $('#app_title');
    var nameInput = $('#app_shortname');
    var urlInput = $('#app_url');
    var alertSlot = $('#app_form_alert');
    var createBtn = $('#app_create_btn');

    /* URL: optional; when filled it must be a full https:// address with a public domain name.
       Returns null when fine, else the reason. */
    function urlProblem(v) {
      v = v.trim();
      if (v === '' || v.toLowerCase() === URL_PREFIX) return null;
      if (/\s/.test(v)) return 'No spaces in the address';
      if (v.length > 2048) return 'Up to 2048 characters';
      if (!/^https:\/\//i.test(v)) return 'Starts with https://';
      var u;
      try { u = new URL(v); } catch (e) { return 'Not a valid address'; }
      if (u.protocol !== 'https:') return 'Starts with https://';
      if (u.username || u.password) return 'No login or password in the address';
      var host = u.hostname.replace(/\.$/, '');
      if (!host) return 'Add a domain, e.g. example.com';
      if (/^\[|^\d+(\.\d+){3}$/.test(host)) return 'Use a domain name, not an IP address';
      var labels = host.split('.');
      if (labels.length < 2) return 'Add a domain, e.g. example.com';
      if (host.length > 253) return 'Domain is too long';
      var badLabel = labels.some(function (l) { return !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l); });
      if (badLabel) return 'Check the domain name';
      if (!/^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(labels[labels.length - 1])) return 'Check the domain ending';
      return null;
    }

    var checks = [
      { input: titleInput, ok: function (v) { return !appNameProblem('title', v); }, why: function (v) { return appNameProblem('title', v); }, msg: 'At least 5 characters' },
      { input: nameInput, ok: function (v) { return !appNameProblem('short', v); }, why: function (v) { return appNameProblem('short', v); }, msg: SHORT_NAME_MSG },
      { input: urlInput, ok: function (v) { return !urlProblem(v); }, why: urlProblem, msg: 'Full address with https://', neutral: 'Optional. Full address with https://' }
    ].filter(function (c) { return c.input; });

    function paint(c) {
      var good = c.ok(c.input.value);
      if (good) setFieldState(c.input, null, c.neutral || c.msg);
      else setFieldState(c.input, 'err', (c.why && c.why(c.input.value)) || c.msg);
      return good;
    }

    /* URL auto-prefix: a pasted or typed scheme is not doubled */
    function normalizeUrl(v) {
      var low = v.toLowerCase();
      if (URL_PREFIX.indexOf(low) === 0) return URL_PREFIX;
      var rest = v;
      if (low.indexOf(URL_PREFIX) === 0) rest = v.slice(URL_PREFIX.length);
      else {
        var k = 0;
        while (k < low.length && k < URL_PREFIX.length && low[k] === URL_PREFIX[k]) k++;
        var sep = v.indexOf('://');
        rest = sep >= 0 && sep <= 8 ? v.slice(sep + 3) : v.slice(k);
      }
      rest = rest.replace(/^\s+/, '');
      var m;
      while ((m = rest.match(/^[a-z][a-z0-9+.-]{0,9}:\/\//i))) rest = rest.slice(m[0].length);
      return URL_PREFIX + rest;
    }
    if (urlInput) initAutoPrefix(urlInput, URL_PREFIX, normalizeUrl);
    function sync() {
      var all = true;
      checks.forEach(function (c) { if (!c.ok(c.input.value)) all = false; });
      if (createBtn) createBtn.disabled = !all;
    }
    checks.forEach(function (c) {
      c.input.addEventListener('input', function () {
        if (fieldOf(c.input).classList.contains('err')) paint(c);
        clearAlert(alertSlot);
        sync();
      });
      c.input.addEventListener('blur', function () {
        if (c.input.value !== '') paint(c);
        else setFieldState(c.input, null, c.neutral || c.msg);
      });
    });
    initAutoGrow($('#app_desc'));
    sync();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      checks.forEach(function (c) { if (!paint(c) && !firstBad) firstBad = c.input; });
      if (firstBad) { clearAlert(alertSlot); firstBad.focus(); sync(); return; }

      // a submitted bare auto-prefix is no URL
      if (urlInput && urlInput.value.trim().toLowerCase() === URL_PREFIX) urlInput.value = '';
      setBusy(createBtn, true);
      var createUrl = '/apps/create';
      if (location.search.indexOf('_newapp=1') !== -1) {
        createUrl += '?_newapp=1';
      }
      postForm(createUrl, formData(form)).then(function () {
        location.reload();
      }).catch(function (err) {
        setBusy(createBtn, false);
        var target = err.field === 'app_shortname' ? nameInput : err.field === 'app_title' ? titleInput : null;
        if (target) {
          clearAlert(alertSlot);
          setFieldState(target, 'err', err.text);
          target.focus();
        } else {
          showAlert(alertSlot, err.text);
        }
      });
    });
  }

  /* ---------- home: Development Tools tile animation ---------- */
  /* Home, Development Tools tile: both decorative windows come alive on hover and tell one story: code
     is typed in the editor (front) and every finished line sends a message in the app chat (back), with
     an occasional reply. Each window is a viewport over a list (.art-code > .art-lines, .art-chat >
     .art-feed) that scrolls up as items are added; old items go under the title bar through a soft top
     fade. A new bubble comes up from 26px below and fades in, as Telegram iOS inserts a message
     (ChatMessageItemView.animateInsertion: offset 1.6x the height, alpha in over 0.2 s); a new code line
     fades in and grows linearly at a steady typing speed under a faint current-line band. Leaving the tile glides both lists back to their
     first items, then the extra ones are dropped. Off under reduced motion. */
  function initHomeChat() {
    var tile = $('.opt-main');
    if (!tile || !motionOk()) return;
    var chatView = $('.art-chat', tile), codeView = $('.art-code', tile);
    if (!chatView || !codeView) return;
    function makeList(view, list, gap) {
      var L = { view: view, list: list, base: list.children.length, y: 0 };
      L.setY = function (v, instant) {
        L.y = v;
        if (instant) list.style.transition = 'none';
        list.style.transform = v ? 'translateY(' + (-v) + 'px)' : '';
        if (instant) { list.offsetHeight; list.style.transition = ''; }
      };
      L.toBottom = function () { list.classList.remove('returning'); L.setY(Math.max(0, list.offsetHeight - view.clientHeight)); };
      // keep the list short: added items far above the view go, the list shifts by the same amount at once.
      // The first items stay (the return glides back to them), so the added ones left must still fill the
      // whole view plus one item; otherwise the first items creep in under the title bar (user saw the
      // short original lines pile up at the top of the editor).
      L.prune = function () {
        while (list.children.length - L.base > 1) {
          var old = list.children[L.base], h = old.offsetHeight + gap, rest = 0;
          for (var i = L.base + 1; i < list.children.length; i++) rest += list.children[i].offsetHeight + gap;
          if (rest < view.clientHeight + h) break;
          old.remove();
          L.setY(L.y - h, true);
        }
      };
      // leaving: glide back to the first items while the added ones fade out (they used to vanish at once)
      L.reset = function () {
        list.classList.add('returning'); L.setY(0);
        for (var i = L.base; i < list.children.length; i++) list.children[i].classList.add('gone');
      };
      L.unfade = function () { for (var i = L.base; i < list.children.length; i++) list.children[i].classList.remove('gone'); };
      L.clear = function () { while (list.children.length > L.base) list.lastElementChild.remove(); list.classList.remove('returning'); };
      return L;
    }
    var chat = makeList(chatView, $('.art-feed', chatView), 8);
    var code = makeList(codeView, $('.art-lines', codeView), 7);
    var lastCode = code.list.lastElementChild, indent = 0, run = 0;

    function bubble(kind) {
      chat.prune();
      var b = document.createElement('i');
      b.className = kind + ' new';
      b.style.setProperty('--w', Math.round(28 + Math.random() * 40) + '%');
      chat.list.appendChild(b);
      chat.toBottom();
      requestAnimationFrame(function () { requestAnimationFrame(function () { b.classList.remove('new'); }); });
    }
    function line() {
      code.prune();
      if (lastCode) lastCode.classList.remove('cur');
      /* indentation walks like real code: one level in or out at a time, 0..3. The edges push back
         (at 0 the next line goes in 70% of the time, at 3 it comes out), and a level never holds for more
         than 2 lines in a row (user: up to 10 lines at the left edge in a row looked wrong) */
      var r = Math.random(), next;
      if (indent === 0) next = r < 0.7 ? 1 : 0;
      else if (indent === 3) next = r < 0.7 ? 2 : 3;
      else next = indent + (r < 0.38 ? -1 : r < 0.62 ? 0 : 1);
      run = next === indent ? run + 1 : 0;
      if (run >= 2) { next = indent === 0 ? 1 : indent === 3 ? 2 : indent + (Math.random() < 0.5 ? -1 : 1); run = 0; }
      indent = next;
      var b = document.createElement('b');
      b.className = 'new cur';
      var w = Math.round(18 + Math.random() * 52);
      b.style.setProperty('--w', w + '%');
      b.style.setProperty('--x', indent);
      // steady typing speed: the duration follows the length (linear width, CSS)
      var dur = Math.round(150 + w * 9);
      b.style.transitionDuration = dur + 'ms, 300ms';
      // the blue accent is typed after the grey line is done, at the same typing speed
      var emDur = 0;
      if (Math.random() < 0.5) {
        var ew = Math.round(25 + Math.random() * 30);
        var em = document.createElement('em');
        em.style.setProperty('--w', ew + '%');
        emDur = Math.round(150 + w * ew / 100 * 9);
        em.style.transitionDuration = emDur + 'ms';
        b.appendChild(em);
        b.classList.add('typing');
        later(function () { b.classList.remove('typing'); }, dur);
      }
      code.list.appendChild(b);
      code.toBottom();
      lastCode = b;
      requestAnimationFrame(function () { requestAnimationFrame(function () { b.classList.remove('new'); }); });
      return dur + emDur;
    }

    // the script: type a line (about 0.3-0.8 s by its length), send it, sometimes get a reply, then the next line
    var timers = [], active = false, cleanup = 0;
    function later(fn, ms) { timers.push(setTimeout(function () { if (active) fn(); }, ms)); }
    function step() {
      var typing = line();
      later(function () {
        bubble('out');
        if (Math.random() < 0.6) later(function () { bubble('in'); }, 550 + Math.random() * 300);
        later(step, 450 + Math.random() * 300); // short pause before the next line (was 1.1-1.6 s, user: too slow)
      }, typing + 120); // sent as soon as the line (and its accent) is typed
    }
    function start() {
      if (active) return;
      active = true;
      clearTimeout(cleanup);
      chat.unfade(); code.unfade(); // back before the return finished: the added items come back
      later(step, 250);
    }
    function stop() {
      if (!active) return;
      active = false;
      timers.forEach(clearTimeout); timers = [];
      if (lastCode) lastCode.classList.remove('cur', 'typing'); // a line left mid-typing still gets its accent
      chat.reset(); code.reset();
      clearTimeout(cleanup);
      cleanup = setTimeout(function () {
        if (active) return;
        chat.clear(); code.clear();
        lastCode = code.list.lastElementChild; indent = 0; run = 0;
      }, 750);
    }
    /* Desktop: the windows come alive on hover. Touch screens have no hover (a tap opens /apps), so
       there the story plays by itself while most of the tile is on screen and the tab is visible. */
    var touch = window.matchMedia && matchMedia('(hover: none)').matches;
    if (!touch || !window.IntersectionObserver) {
      tile.addEventListener('mouseenter', start);
      tile.addEventListener('mouseleave', stop);
      return;
    }
    var seen = false;
    function syncPlay() { if (seen && !document.hidden) start(); else stop(); }
    new IntersectionObserver(function (entries) {
      seen = entries[entries.length - 1].intersectionRatio >= 0.6;
      syncPlay();
    }, { threshold: [0, 0.6, 1] }).observe(tile);
    document.addEventListener('visibilitychange', syncPlay);
  }

  /* ---------- edit app ---------- */
  function initEditApp() {
    var form = $('#app_edit_form');
    if (!form) return;

    var alertSlot = $('#app_form_alert');
    var titleInput = $('#app_title');
    var nameInput = $('#app_shortname');

    /* entering a field selects its whole value; the mouseup that follows the focus
       click would otherwise collapse the selection, so it is swallowed once */
    [titleInput, nameInput].forEach(function (el) {
      var fresh = false;
      el.addEventListener('focus', function () { fresh = true; el.select(); });
      el.addEventListener('mouseup', function (e) {
        if (fresh) { e.preventDefault(); fresh = false; }
      });
    });

    /* same rules as /apps/new (appNameProblem): a field is red while it breaks its rule */
    function checkField(input) {
      var problem = appNameProblem(input === nameInput ? 'short' : 'title', input.value);
      if (!problem) {
        clearFieldState(input);
        return true;
      }
      setFieldState(input, 'err', problem);
      return false;
    }

    /* Cancel fades in while the title/short name differ from what was saved;
       clicking it restores the saved values and fades out again. */
    var cancelBtn = $('#app_cancel_btn');
    var saveBtn = $('#app_save_btn');
    var bar = $('.card-bar', form);
    var flashTimer = 0;
    var saved = { title: titleInput.value, name: nameInput.value };
    function syncCancel() {
      var dirty = titleInput.value !== saved.title || nameInput.value !== saved.name;
      /* check both fields every time so every bad field turns red at once */
      var titleOk = checkField(titleInput);
      var nameOk = checkField(nameInput);
      /* the Save/Cancel row only exists while something has changed: it opens below the card */
      if (bar) bar.classList.toggle('open', dirty);
      if (cancelBtn) cancelBtn.classList.toggle('soft-hidden', !dirty);
      /* Save is inert until something differs from the saved values AND both fields are valid */
      if (saveBtn) saveBtn.disabled = !dirty || !(titleOk && nameOk);
    }
    syncCancel();
    titleInput.addEventListener('input', syncCancel);
    nameInput.addEventListener('input', syncCancel);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        titleInput.value = saved.title;
        nameInput.value = saved.name;
        clearFieldState(titleInput);
        clearFieldState(nameInput);
        clearAlert(alertSlot);
        syncCancel();
      });
    }

    $all('[data-reveal]').forEach(function (btn) {
      var spTarget = $(btn.getAttribute('data-reveal'));
      if (spTarget && spTarget.classList.contains('spoiler')) { initSpoiler(spTarget, btn); return; }
      btn.addEventListener('click', function () {
        var target = $(btn.getAttribute('data-reveal'));
        if (!target) return;
        var textEl = $('.vv', target) || target;
        var masked = target.classList.toggle('masked');
        btn.classList.toggle('on', !masked);
        if (masked) {
          textEl.textContent = '••••••••••••••••••••••••••••••••••••••••••••';
          btn.title = 'Show';
        } else {
          textEl.textContent = target.getAttribute('data-value');
          btn.title = 'Hide';
        }
      });
    });

    /* Telegram iOS spoiler ("invisible ink") over a hidden value, ported from
       submodules/InvisibleInkDustNode/Sources/InvisibleInkDustNode.swift:
       - point particles in the text colour over the text box, birth rate = area * 0.35 per second,
         lifetime 1 s, random direction, speed 0..20 px/s, random alpha that fades in and out over life;
       - reveal / hide: a plain 0.25 s crossfade between the text and the dust (no growing circle).
       The real value sits in the DOM under the dust, transparent and not selectable, so nothing can be
       copied while hidden. Reduced motion: still dust, instant switch. */
    function initSpoiler(target, btn) {
      var vv = $('.vv', target);
      /* the DOM keeps the bullet placeholder while masked: the real value enters the document only
         on reveal and leaves again on hide, so a selection over the hidden text can never clone it.
         Only the text node is rewritten (the canvas child survives every toggle) */
      var maskText = vv.textContent;
      var textNode = vv.firstChild;
      var value = target.getAttribute('data-value') || '';
      var cv = document.createElement('canvas');
      cv.className = 'ink';
      cv.setAttribute('aria-hidden', 'true');
      vv.appendChild(cv);
      var ctx = cv.getContext('2d');
      var still = !motionOk();
      var W = 0, H = 0, dpr = 1, parts = [], last = 0, raf = 0, color = '#000';
      var hidden = true, spot = null, fade = 1;
      // the dust only animates while it is on screen and the tab is visible (battery); the last frame stays drawn
      var onScreen = true;
      function active() { return onScreen && !document.hidden; }

      function measure() {
        var r = vv.getBoundingClientRect();
        // the dust spans the whole value box, up to the eye and copy buttons (user request)
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        dpr = window.devicePixelRatio || 1;
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        color = getComputedStyle(target).getPropertyValue('--text').trim() || getComputedStyle(document.body).color;
        // steady state: as many particles as one second of births
        var n = Math.round(W * H * 0.35);
        parts = [];
        for (var i = 0; i < n; i++) parts.push(spawn(Math.random()));
        if (still) draw(0);
      }
      function spawn(age) {
        var a = Math.random() * Math.PI * 2, v = Math.random() * 20;
        return { x: Math.random() * W, y: 2 + Math.random() * (H - 4), vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                 age: age || 0, life: 1, peak: Math.random() };
      }
      /* dust colour per theme (--text), read in the frame the theme changes, so there is never a frame
         of old-colour dust on the new background (it used to wait for a setTimeout: a one-frame blink) */
      var colors = {}, shownTheme = null;
      function themeColor(theme) {
        var now = currentTheme();
        if (now !== shownTheme || !colors[now]) {
          shownTheme = now;
          colors[now] = getComputedStyle(target).getPropertyValue('--text').trim() || getComputedStyle(document.body).color;
        }
        color = colors[now];
        return colors[theme || now] || color;
      }
      function draw(dt) {
        /* clear the whole bitmap in device pixels: with a fractional box (e.g. 21.5px at 100%) a clear in
           CSS px left the last pixel row half-cleared every frame, and dots drifting there piled up into a
           solid line under the dust */
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.save();
        themeColor();
        /* during a theme wipe the canvas is its own live layer above the wipe (see themewipestart), so each
           dot takes the colour of the theme shown at its spot: inside or outside the circle */
        var view = wipeView(), ox = 0, oy = 0, r2 = 0, cIn = color, cOut = color;
        if (view) {
          var cr = cv.getBoundingClientRect();
          ox = view.x - cr.left; oy = view.y - cr.top; r2 = view.r * view.r;
          cIn = themeColor(view.inside); cOut = themeColor(view.outside);
        }
        var s = 1.15;
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          if (dt) {
            p.age += dt;
            if (p.age >= p.life) { parts[i] = p = spawn(0); }
            p.x += p.vx * dt; p.y += p.vy * dt;
          }
          // alpha over life: 0 -> peak -> 0
          var k = p.age / p.life, al = (k < .5 ? k * 2 : (1 - k) * 2) * p.peak;
          if (still) al = p.peak * .8;
          if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) continue;
          // soft ends: the dust thins out over the last few px instead of stopping at a hard line
          al *= Math.min(1, p.x / 6, (W - p.x) / 10);
          if (al <= 0.02) continue;
          ctx.fillStyle = view ? ((p.x - ox) * (p.x - ox) + (p.y - oy) * (p.y - oy) <= r2 ? cIn : cOut) : color;
          ctx.globalAlpha = al * fade;
          ctx.fillRect(p.x, p.y, s, s);
        }
        ctx.restore();
      }
      function frame(t) {
        var dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
        draw(dt);
        if (spot || (hidden && active())) raf = requestAnimationFrame(frame); else { raf = 0; last = 0; }
      }
      function run() { if (!raf && !still && (spot || active())) { last = 0; raf = requestAnimationFrame(frame); } }

      // reveal: plain crossfade (user request: no growing circle), the text fades in, the dust fades out
      function reveal() {
        hidden = false;
        textNode.nodeValue = value;
        target.classList.remove('masked');
        btn.classList.add('on'); btn.title = 'Hide';
        if (still) { cv.style.opacity = '0'; return; }
        var t0 = performance.now(), from = fade;
        spot = true; // keeps frames running while the dust fades out
        (function down(t) {
          if (hidden) return;
          fade = from * Math.max(0, 1 - (t - t0) / 250);
          if (fade > 0) requestAnimationFrame(down);
          else { spot = null; cv.style.opacity = '0'; fade = 1; }
        })(t0);
        run();
      }
      function hide() {
        hidden = true; spot = null;
        textNode.nodeValue = maskText;
        target.classList.add('masked');
        btn.classList.remove('on'); btn.title = 'Show';
        cv.style.opacity = '';
        if (still) { draw(0); return; }
        fade = 0; var t0 = performance.now();
        (function up(t) { fade = Math.min(1, (t - t0) / 250); if (fade < 1 && hidden) requestAnimationFrame(up); })(t0);
        run();
      }

      btn.addEventListener('click', function () {
        if (!hidden) { hide(); return; }
        reveal();
      });
      // tapping the dust reveals too, as in Telegram
      vv.addEventListener('click', function (e) {
        if (!hidden) return;
        reveal();
      });
      measure();
      run();
      if (window.IntersectionObserver) new IntersectionObserver(function (es) {
        onScreen = es[es.length - 1].isIntersecting;
        if (onScreen && hidden) run();
      }).observe(vv);
      document.addEventListener('visibilitychange', function () { if (hidden && active()) run(); });
      if (window.ResizeObserver) new ResizeObserver(function () { if (hidden) { measure(); if (!raf) draw(0); } }).observe(vv);
      // reduced motion draws no frames: repaint the still dust when the theme changes
      new MutationObserver(function () { if (still) draw(0); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      /* Theme wipe: inside the view transition snapshot the dust would freeze, and it stays covered for the
         whole wipe when the theme is switched back and forth. So the canvas gets its own transition layer
         (live, above the wipe; old image hidden in CSS) and draw() colours it to match the circle. Not when
         it sits under the sticky header or the open settings menu: that layer would paint over them. */
      document.addEventListener('themewipestart', function () {
        themeColor(); // the theme before the switch, for the dots outside / inside the circle
        var r = vv.getBoundingClientRect(), live = hidden && onScreen && r.bottom > 0 && r.top < window.innerHeight;
        $all('.topbar, .settings-menu.open').forEach(function (el) {
          var o = el.getBoundingClientRect();
          if (r.left < o.right && r.right > o.left && r.top < o.bottom && r.bottom > o.top) live = false;
        });
        cv.style.viewTransitionName = live ? 'api-ink' : '';
      });
    }

    /* hidden value: the dots stay selectable but never reach the clipboard (copy or drag).
       Text selected around them is copied as usual; a selection of dots only copies nothing. */
    function stripMasked(e) {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !document.querySelector('.masked .vv')) return;
      var hit = false, box = document.createElement('div');
      for (var i = 0; i < sel.rangeCount; i++) {
        var r = sel.getRangeAt(i);
        $all('.masked .vv').forEach(function (el) { if (r.intersectsNode(el)) hit = true; });
        box.appendChild(r.cloneContents());
      }
      if (!hit) return;
      $all('.vv', box).forEach(function (el) { el.textContent = ''; });
      /* a partial selection clones only a text node, without its .vv wrapper */
      var text = (box.textContent || '').replace(/•+/g, '').trim();
      var dt = e.clipboardData || e.dataTransfer;
      if (e.type === 'dragstart' && !text) { e.preventDefault(); return; }
      if (e.type === 'copy' || e.type === 'cut') e.preventDefault();
      if (dt && text) dt.setData('text/plain', text);
    }
    document.addEventListener('copy', stripMasked);
    document.addEventListener('cut', stripMasked);
    document.addEventListener('dragstart', stripMasked);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearAlert(alertSlot);
      var okTitle = checkField(titleInput);
      var okName = checkField(nameInput);
      if (!okTitle) { titleInput.focus(); return; }
      if (!okName) { nameInput.focus(); return; }

      var btn = $('button[type="submit"]', form);
      setBusy(btn, true);
      postForm('/apps/save', formData(form)).then(function () {
        setBusy(btn, false);
        /* only the fields whose value changed flash (user: one edited field, one flash) */
        var changed = [];
        if (titleInput.value !== saved.title) changed.push(titleInput.closest('.field'));
        if (nameInput.value !== saved.name) changed.push(nameInput.closest('.field'));
        saved = { title: titleInput.value, name: nameInput.value };
        // the page heading is the app title: show the saved one at once (it used to wait for a reload)
        var pageTitle = $('main .head h1') || $('main h1');
        if (pageTitle) pageTitle.textContent = titleInput.value;
        syncCancel();
        /* no toast: the changed fields flash an accent-blue border for 1 second */
        var both = [titleInput.closest('.field'), nameInput.closest('.field')];
        clearTimeout(flashTimer);
        both.forEach(function (field) { field.classList.remove('saved', 'fading'); }); // a quick second save starts over
        changed.forEach(function (field) { field.classList.add('saved'); });
        flashTimer = setTimeout(function () {
          changed.forEach(function (field) {
            field.classList.remove('saved');
            field.classList.add('fading');
          });
          setTimeout(function () {
            changed.forEach(function (field) { field.classList.remove('fading'); });
          }, 250);
        }, 1000);
      }).catch(function (err) {
        setBusy(btn, false);
        var target = err.field === 'app_shortname' ? nameInput : err.field === 'app_title' ? titleInput : null;
        if (target) {
          setFieldState(target, 'err', err.text);
          target.focus();
        } else {
          showAlert(alertSlot, err.text);
        }
      });
    });
  }

  /* ---------- delete account ---------- */
  function initDelete() {
    var form = $('#deactivate_phone_form');
    if (!form) return;

    var confirmBox = $('#deactivate_confirm_box');
    var phoneInput = $('#deactivate_phone_confirm');
    var hint = $('#deactivate_phone_hint');
    var confirmBtn = $('#deactivate_confirm_btn');
    var cancelBtn = $('#deactivate_cancel_btn');
    var alertSlot = $('#deactivate_code_alert');
    var resultWrap = $('#deactivate_result_wrap');
    var messageInput = $('#deactivate_message');
    var mainActions = $('#deactivate_actions');

    /* reason field: grows with the text and shows a counter near the limit */
    initAutoGrow(messageInput);
    /* the phone number shown on the page is the one this account is linked to */
    var accountPhone = ($('#account_phone', form) || {}).textContent || '';
    var accountDigits = accountPhone.replace(/\D/g, '');
    var performing = false;

    function digitsOf(v) { return (v || '').replace(/\D/g, ''); }

    /* strict = the field was left. While typing, a correct beginning of the number keeps the
       neutral hint (the number to retype stays visible); the error shows only for a wrong digit
       or an incomplete number on blur. */
    function syncConfirm(strict) {
      var d = digitsOf(phoneInput.value);
      var ok = accountDigits.length > 0 && d === accountDigits;
      var onTrack = d.length < accountDigits.length && accountDigits.indexOf(d) === 0;
      confirmBtn.disabled = !ok;
      if (ok) {
        setFieldState(phoneInput, 'ok', 'Number confirmed');
      } else if (!phoneInput.value || (onTrack && strict !== true)) {
        clearFieldState(phoneInput);
        hint.textContent = 'Enter ' + accountPhone + ' to confirm';
      } else {
        setFieldState(phoneInput, 'err', 'Number does not match this account');
      }
    }

    function openConfirm() {
      clearAlert(alertSlot);
      phoneInput.value = '';
      syncConfirm();
      /* the main Delete button gives way to the confirm step, which unfolds in its place */
      mainActions.classList.add('gone');
      confirmBox.inert = false;
      confirmBox.classList.add('open');
      phoneInput.focus({ preventScroll: true });
      /* once the box has finished unfolding (0.4s), glide to the very bottom of the page (user: the small
         nudge that only brought the Yes/Cancel row into view was not enough), so the whole confirm step,
         from "Are you sure?" to the buttons, sits at the bottom of the screen */
      setTimeout(function () {
        var root = document.scrollingElement || document.documentElement;
        try { window.scrollTo({ top: root.scrollHeight, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, root.scrollHeight); }
      }, 420);
    }

    function isOpen() { return confirmBox.classList.contains('open'); }

    function closeConfirm() {
      confirmBox.classList.remove('open');
      confirmBox.inert = true;
      mainActions.classList.remove('gone');
      $('button', mainActions).focus({ preventScroll: true });
    }

    /* Enter inside the confirm step must not reopen it (that wiped the typed number): with the right
       number it deletes, same as "Yes, delete my account"; otherwise the field shows its error */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!isOpen()) { openConfirm(); return; }
      if (!confirmBtn.disabled) confirmBtn.click();
      else { syncConfirm(true); phoneInput.focus({ preventScroll: true }); }
    });

    /* Typing the confirm number.
       - Digits only (capped at the account number length): laid out like the account number, the
         "+" and spaces appear at the same places as in +888 0102 4105.
       - "+" is accepted once, at the start. "(", ")", "-" and spaces may be typed too: as soon as
         the value has "(", ")" or "-", the user's own formatting is kept as typed (no auto layout).
       - Only the digits are compared with the account number.
       Paste and drop are blocked: the number has to be typed. */
    var maxDigits = accountDigits.length;
    /* layout template: the account number with any separator turned into a single space
       (a shown "+1-555-010-0100" lays out as "+1 555 010 0100") */
    var template = accountPhone.trim().replace(/[^\d+]+/g, ' ');
    function layout(d) {
      var out = '', k = 0;
      for (var i = 0; i < template.length && k < d.length; i++) {
        out += /\d/.test(template[i]) ? d[k++] : template[i];
      }
      return out;
    }
    function caretAfterDigit(str, n) {
      if (n <= 0) return /^\+/.test(str) ? 1 : 0;
      for (var i = 0, k = 0; i < str.length; i++) if (/\d/.test(str[i]) && ++k === n) return i + 1;
      return str.length;
    }
    function ownFormat(v) { return /[()\-]/.test(v); }
    /* filter the raw value; map[i] = cleaned length after the first i raw chars (for the caret) */
    function clean(raw) {
      var out = '', digits = 0, map = [0];
      for (var i = 0; i < raw.length; i++) {
        var ch = raw[i];
        if (digits >= maxDigits) { map.push(out.length); continue; } /* number complete: nothing more */
        if (/\d/.test(ch)) { out += ch; digits++; }
        else if (ch === '+') { if (out.trim() === '') out = '+'; }
        else if (ch === ' ') { if (out !== '' && out.slice(-1) !== ' ') out += ' '; }
        else if (ch === '(' || ch === ')' || ch === '-') { out += ch; }
        map.push(out.length);
      }
      return { v: out, map: map };
    }
    function reformat(rawCaret) {
      var raw = phoneInput.value, c = clean(raw), v, pos;
      if (ownFormat(c.v)) {
        v = c.v; pos = c.map[Math.min(rawCaret, raw.length)];
      } else {
        var d = digitsOf(c.v);
        v = d ? layout(d) : (c.v.charAt(0) === '+' ? '+' : '');
        /* a space typed at the end is kept, so "+1 " followed by "(" gives "+1 (" */
        if (d && c.v.slice(-1) === ' ' && v.slice(-1) !== ' ') v += ' ';
        pos = caretAfterDigit(v, digitsOf(c.v.slice(0, c.map[Math.min(rawCaret, raw.length)])).length);
      }
      if (rawCaret >= raw.length) pos = v.length; /* typing at the end stays at the end */
      phoneInput.value = v;
      if (document.activeElement === phoneInput) phoneInput.setSelectionRange(pos, pos);
    }
    /* faint account number inside the field: shown while the field is focused or filled and the
       typed value is still a correct beginning in the auto layout; hidden on error or own formatting */
    var ghost = $('#deactivate_phone_ghost');
    function placeGhost() {
      if (!ghost) return;
      var cs = getComputedStyle(phoneInput);
      ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
       'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing'].forEach(function (k) { ghost.style[k] = cs[k]; });
      // exact (fractional) size: offsetWidth/Height round 56.5px to 57px, which moves the centred
      // zeros by a fraction of a pixel and shows up as a 1px shift at some zoom levels
      var rect = phoneInput.getBoundingClientRect();
      ghost.style.width = rect.width + 'px';
      ghost.style.height = rect.height + 'px';
    }
    function syncGhost() {
      if (!ghost) return;
      var v = phoneInput.value;
      var show = (document.activeElement === phoneInput || v !== '') && template.indexOf(v) === 0 &&
        v.length < template.length && !fieldOf(phoneInput).classList.contains('err');
      ghost.querySelector('.ghost-typed').textContent = v;
      ghost.querySelector('.ghost-rest').textContent = template.slice(v.length);
      ghost.classList.toggle('on', show);
    }
    window.addEventListener('resize', placeGhost);
    phoneInput.addEventListener('beforeinput', function (e) {
      var t = e.inputType || '';
      if (t === 'insertFromPaste' || t === 'insertFromDrop' || t === 'insertFromPasteAsQuotation') e.preventDefault();
    });
    /* auto layout only: Backspace/Delete next to an inserted space removes the neighbouring digit
       instead, otherwise the layout would put the space straight back (keydown: fires everywhere).
       A lone "+" is deleted normally. With the user's own formatting, deletion is native. */
    phoneInput.addEventListener('keydown', function (e) {
      var back = e.key === 'Backspace', fwd = e.key === 'Delete';
      if ((!back && !fwd) || e.ctrlKey || e.metaKey || e.altKey) return;
      var s = phoneInput.selectionStart, en = phoneInput.selectionEnd, v = phoneInput.value, i = -1;
      if (s !== en || ownFormat(v) || !digitsOf(v)) return;
      if (back && s > 0 && v[s - 1] === ' ') { for (i = s - 1; i >= 0 && !/\d/.test(v[i]); i--); }
      else if (fwd && s < v.length && v[s] === ' ') { for (i = s; i < v.length && !/\d/.test(v[i]); i++); if (i >= v.length) i = -1; }
      else if (back && s === 1 && v[0] === '+') { e.preventDefault(); return; }
      else return;
      e.preventDefault();
      if (i < 0) return;
      // erasing from the end must not leave a trailing space ("+888 0102 "): with it the value is no
      // longer a beginning of the number and the faint hint in the field disappears
      var nv = v.slice(0, i) + v.slice(i + 1);
      if (!/\d/.test(v.slice(i + 1))) nv = nv.replace(/ +$/, '');
      phoneInput.value = nv;
      reformat(Math.min(i, nv.length));
      syncConfirm(false);
      syncGhost();
    });
    phoneInput.addEventListener('paste', function (e) { e.preventDefault(); });
    phoneInput.addEventListener('drop', function (e) { e.preventDefault(); });
    phoneInput.addEventListener('input', function (e) {
      // deleting: no trailing space is kept (that rule is only for a space the user types)
      if (e.inputType && e.inputType.indexOf('delete') === 0 && / +$/.test(phoneInput.value) &&
          phoneInput.selectionStart >= phoneInput.value.replace(/ +$/, '').length) {
        phoneInput.value = phoneInput.value.replace(/ +$/, '');
      }
      reformat(Math.min(phoneInput.selectionStart, phoneInput.value.length));
      syncConfirm(false);
      syncGhost();
    });
    phoneInput.addEventListener('blur', function () { if (isOpen()) syncConfirm(true); syncGhost(); });
    /* back in the field: drop the blur-only error while the number is still a correct beginning */
    phoneInput.addEventListener('focus', function () { syncConfirm(false); placeGhost(); syncGhost(); });
    cancelBtn.addEventListener('click', closeConfirm);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) closeConfirm();
    });

    confirmBtn.addEventListener('click', function () {
      if (performing || confirmBtn.disabled) return;
      if (digitsOf(phoneInput.value) !== accountDigits) return;
      performing = true;
      clearAlert(alertSlot);
      setBusy(confirmBtn, true);
      postForm('/delete/do_delete', {
        hash: form.elements.hash.value,
        message: messageInput ? messageInput.value : ''
      }).then(function () {
        setBusy(confirmBtn, false);
        performing = false;
        closeConfirm();
        form.classList.add('my-hide');
        /* the result replaces the page heading: the question and its warning are gone */
        var head = $('#deactivate_head');
        if (head) head.classList.add('my-hide');
        resultWrap.classList.remove('my-hide');
        /* signed out now (user: the page still offered the account navigation): the sidebar and the mobile
           back link go (their space stays, nothing jumps), the settings menu keeps only the theme row like
           on /auth, and the result offers "Sign in again" */
        document.body.classList.add('signed-out');
        $all('.sm-account, .sm-logout').forEach(function (el) { el.remove(); });
        if (resultWrap.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          /* phones: fade only. The "Sign in again" button is position: fixed at the bottom there, and a
             transform on this wrapper would make it the button's containing block for the 460 ms, so the
             button showed mid-page and then jumped down (user bug) */
          var pinned = window.matchMedia('(max-width: 520px)').matches;
          resultWrap.animate(pinned ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
            { duration: 460, easing: 'cubic-bezier(.2, 0, 0, 1)' });
        }
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      }).catch(function (err) {
        setBusy(confirmBtn, false);
        performing = false;
        showAlert(alertSlot, err.text);
      });
    });
  }

  /* MTProto server rows: the address is plain selectable text (clicks on it never toggle the row), and a
     text selection made elsewhere in the header or a double/triple click does not toggle it either */
  function initServers() {
    $all('details.server > summary').forEach(function (s) {
      s.addEventListener('click', function (e) {
        var sel = window.getSelection();
        if (e.target.closest('.a') || e.detail > 1 || (sel && !sel.isCollapsed && s.contains(sel.anchorNode))) e.preventDefault();
      });
    });
  }

  /* ---------- WNS credentials ----------
     Package SID auto-prefix + live rule check; the secret is a password input with an eye
     (native masking works in every engine). The form posts normally (full page flow). */
  function initWns() {
    var form = $('#wns_form');
    if (!form) return;

    function sidProblem(v) {
      v = v.trim();
      if (!/^ms-app:\/\/S-1-15-2-/i.test(v)) return 'Starts with ms-app://S-1-15-2-';
      var parts = v.slice(18).split('-');
      if (parts.some(function (p) { return !/^\d+$/.test(p); })) return 'Numbers separated by "-" after the prefix';
      if (parts.some(function (p) { return p.length > 10; })) return 'Each number has at most 10 digits';
      if (parts.length !== 7) return 'Needs 7 numbers after ms-app://S-1-15-2- (has ' + parts.length + ')';
      return '';
    }

    var sidInput = $('#wns_package_sid');
    var secretInput = $('#wns_client_secret');
    var SID_PREFIX = 'ms-app://S-1-15-2-';
    function normalizeSid(v) {
      v = v.replace(/\s+/g, '');
      if (v === '') return '';
      if (SID_PREFIX.toLowerCase().indexOf(v.toLowerCase()) === 0) return SID_PREFIX;
      var low = v.toLowerCase(), at = low.lastIndexOf('s-1-15-2-');
      if (at >= 0) return SID_PREFIX + v.slice(at + 9);
      var k = 0, p = SID_PREFIX.toLowerCase();
      while (k < low.length && k < p.length && low[k] === p[k]) k++;
      return SID_PREFIX + v.slice(k);
    }
    initAutoPrefix(sidInput, SID_PREFIX, normalizeSid);

    sidInput.addEventListener('input', function () {
      if (fieldOf(sidInput).classList.contains('err') && !sidProblem(sidInput.value)) clearFieldState(sidInput);
    });
    sidInput.addEventListener('blur', function () {
      var p = sidInput.value.trim() ? sidProblem(sidInput.value) : '';
      if (p) setFieldState(sidInput, 'err', p);
      else setFieldState(sidInput, null, 'Starts with ms-app://S-1-15-2-');
    });

    var eye = $('.eye', form);
    if (eye && secretInput) {
      eye.addEventListener('mousedown', function (e) { e.preventDefault(); });
      eye.addEventListener('click', function () {
        var show = secretInput.type === 'password';
        secretInput.type = show ? 'text' : 'password';
        eye.classList.toggle('on', show);
        eye.title = show ? 'Hide' : 'Show';
      });
    }

    form.addEventListener('submit', function (e) {
      var p = sidProblem(sidInput.value);
      if (p) {
        e.preventDefault();
        setFieldState(sidInput, 'err', p);
        sidInput.focus();
        return;
      }
      clearFieldState(sidInput);
      if (!secretInput.value.trim()) {
        e.preventDefault();
        setFieldState(secretInput, 'err', 'Required');
        secretInput.focus();
      }
    });
  }

  /* ---------- FCM credentials ----------
     Drop zone with client-side pre-checks (JSON, size, service_account fields, shown without the
     private key). The form then posts normally; the server stays the final validator. */
  function initFcm() {
    var form = $('#fcm_form');
    if (!form) return;
    var drop = $('#fcm_drop'), input = $('#fcm_service_json'), saveBtn = $('#fcm_save_btn');
    var empty = $('.drop-empty', drop), filled = $('.drop-file', drop);
    var nameEl = $('.drop-name', drop), subEl = $('.drop-sub', drop);
    var replaceEl = $('.drop-replace', drop), clearEl = $('.drop-clear', drop);
    var hint = $('.drop-hint'), hintMsg = $('.msg', hint), HINT = hintMsg.textContent;
    var current = null, seq = 0;

    function setError(msg) {
      drop.classList.toggle('err', !!msg);
      hint.classList.toggle('err', !!msg);
      hintMsg.textContent = msg || HINT;
    }
    function render(name, sub) {
      nameEl.textContent = name;
      nameEl.title = name;
      subEl.textContent = sub || '';
      subEl.title = sub || '';
      empty.hidden = true; filled.hidden = false;
      replaceEl.hidden = false; clearEl.hidden = false;
      drop.classList.add('has-file');
      filled.classList.remove('in');
      void filled.offsetWidth;
      filled.classList.add('in');
    }
    function showEmpty() {
      seq++; current = null; input.value = '';
      setError(null); saveBtn.disabled = true;
      drop.classList.remove('has-file');
      filled.hidden = true; empty.hidden = false;
    }
    saveBtn.disabled = true;
    // a dropped file must be attached to the input as well, else the POST body goes out empty;
    // engines without the DataTransfer constructor (old Safari) fall back to the file picker
    function attach(file) {
      if (input.files.length) return true; // chosen through the picker: nothing to attach
      try {
        var dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        return !!input.files.length;
      } catch (e) {
        return false;
      }
    }
    function take(file) {
      if (!file) return;
      var mine = ++seq;
      current = null; saveBtn.disabled = true;
      if (!/\.json$/i.test(file.name) && file.type !== 'application/json') { render(file.name, 'Not a JSON file'); setError('Choose the .json key file'); return; }
      if (file.size > 8096) { render(file.name, 'JSON file · ' + Math.round(file.size / 1024) + ' KB'); setError('Invalid service json file.'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        if (mine !== seq) return;
        var data = null;
        try { data = JSON.parse(reader.result); } catch (e) {}
        if (!data || typeof data !== 'object') { render(file.name, 'JSON file'); setError('Invalid service json file.'); return; }
        if (data.type !== 'service_account' || !data.project_id || !data.client_email || !data.private_key) {
          render(file.name, data.project_id ? 'Project ' + data.project_id : 'JSON file');
          setError('Invalid service json file.');
          return;
        }
        render(file.name, data.project_id + ' · ' + data.client_email);
        setError(null);
        current = file;
        if (!attach(file)) {
          // no DataTransfer here: a pasted/chosen file is fine (it is in the input already),
          // a dropped one would be lost, so say so instead of failing silently
          setError('Use the file picker on this browser');
          saveBtn.disabled = true;
          return;
        }
        saveBtn.disabled = false;
      };
      reader.onerror = function () { if (mine !== seq) return; render(file.name, ''); setError('Could not read the file'); };
      reader.readAsText(file);
    }

    input.addEventListener('change', function () { take(input.files && input.files[0]); });
    clearEl.addEventListener('click', showEmpty);

    function hasFiles(e) { return !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1); }
    var pageDepth = 0, tileDepth = 0;
    function endDrag() { pageDepth = tileDepth = 0; drop.classList.remove('ready', 'over'); }
    window.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; pageDepth++; drop.classList.add('ready'); });
    window.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; if (--pageDepth <= 0) endDrag(); });
    window.addEventListener('dragover', function (e) { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', function (e) { if (hasFiles(e)) { e.preventDefault(); endDrag(); } });
    drop.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; tileDepth++; drop.classList.add('over'); });
    drop.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; if (--tileDepth <= 0) { tileDepth = 0; drop.classList.remove('over'); } });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); e.stopPropagation(); endDrag();
      take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });

    form.addEventListener('submit', function (e) {
      if (!current) {
        e.preventDefault();
        setError('Choose the .json key file');
      }
    });
  }

  ready(function () {
    initEntrance();
    document.documentElement.classList.remove('anim');
    initLogo();
    initTheme();
    initMotion();
    initPhoneDisplay();
    initPhoneField();
    initAuth();
    initCopy();
    initCreateApp();
    initHomeChat();
    initEditApp();
    initDelete();
    initServers();
    initWns();
    initFcm();
  });
})();
