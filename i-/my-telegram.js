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

  /* ---------- theme toggle ---------- */
  function initTheme() {
    $all('.theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var root = document.documentElement;
        var current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        var next = current === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch (e) {}
      });
    });
  }

  /* ---------- ripple (design ui.js) ---------- */
  function initMotion() {
    var sel = '.btn, .chip, .icon-btn, .side a, .theme-toggle';
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
      var done = function () { s.classList.add('out'); setTimeout(function () { s.remove(); }, 400); };
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
    function syncGhost() {
      if (!ghost || typeof country === 'undefined') return;
      var v = input.value, tpl = phoneMask(maskC()).replace(/X/g, '0');
      var fits = /^[\d ]*$/.test(v) && v.length < tpl.length && v.replace(/\d/g, '0') === tpl.slice(0, v.length);
      var show = (document.activeElement === input || v !== '') && fits && codeOk;
      ghost.querySelector('.ghost-typed').textContent = v;
      ghost.querySelector('.ghost-rest').textContent = tpl.slice(v.length);
      ghost.classList.toggle('on', show);
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
  var TELEGRAM_MSG = 'Can’t contain the word “Telegram”';
  function validateTitle(input) {
    var value = input.value.trim();
    if (/telegram/i.test(value.replace(/\s+/g, ''))) {
      setFieldState(input, 'err', TELEGRAM_MSG);
      return false;
    }
    if (value.length < 5) {
      setFieldState(input, 'err', 'At least 5 characters');
      return false;
    }
    setFieldState(input, 'ok', 'Looks good');
    return true;
  }

  function validateShortname(input) {
    var value = input.value;
    if (/telegram/i.test(value.replace(/\s+/g, ''))) {
      setFieldState(input, 'err', TELEGRAM_MSG);
      return false;
    }
    if (!/^[A-Za-z0-9 ]{5,32}$/.test(value)) {
      setFieldState(input, 'err', '5–32 characters: latin letters, digits and spaces');
      return false;
    }
    setFieldState(input, 'ok', 'Looks good');
    return true;
  }

  function initCounter(input, max) {
    var field = fieldOf(input);
    if (!field) return;
    var countEl = $('.hint .count', field);
    if (!countEl) return;
    var update = function () { countEl.textContent = input.value.length + ' / ' + max; };
    input.addEventListener('input', update);
    update();
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
      btn.classList.add('copied');
      setTimeout(function () { btn.classList.remove('copied'); }, 1500);
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

  /* ---------- create app ---------- */
  function initCreateApp() {
    var form = $('#app_create_form');
    if (!form) return;

    $all('.chip input[type="radio"]', form).forEach(function (radio) {
      radio.addEventListener('change', function () {
        $all('.chip', form).forEach(function (chip) { chip.classList.remove('on'); });
        radio.closest('.chip').classList.add('on');
      });
    });

    var titleInput = $('#app_title');
    var nameInput = $('#app_shortname');
    var descInput = $('#app_desc');
    var alertSlot = $('#app_form_alert');

    initCounter(titleInput, 255);
    initCounter(nameInput, 32);
    if (descInput) initCounter(descInput, 512);

    var touched = false;
    function revalidate() {
      clearAlert(alertSlot); // any edit: the old form error no longer applies
      if (!touched) return;
      validateTitle(titleInput);
      validateShortname(nameInput);
    }
    titleInput.addEventListener('input', revalidate);
    nameInput.addEventListener('input', revalidate);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      touched = true;
      var okTitle = validateTitle(titleInput);
      var okName = validateShortname(nameInput);
      if (!okTitle) { clearAlert(alertSlot); titleInput.focus(); return; }
      if (!okName) { clearAlert(alertSlot); nameInput.focus(); return; }

      // like /auth: the old error stays in the bar until the answer comes
      var btn = $('button[type="submit"]', form);
      setBusy(btn, true);
      var createUrl = '/apps/create';
      if (location.search.indexOf('_newapp=1') !== -1) {
        createUrl += '?_newapp=1';
      }
      postForm(createUrl, formData(form)).then(function () {
        location.reload();
      }).catch(function (err) {
        setBusy(btn, false);
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

  /* ---------- edit app ---------- */
  function initEditApp() {
    var form = $('#app_edit_form');
    if (!form) return;

    var alertSlot = $('#app_form_alert');
    var titleInput = $('#app_title');
    var nameInput = $('#app_shortname');

    $all('[data-reveal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = $(btn.getAttribute('data-reveal'));
        if (!target) return;
        var textEl = $('.vv', target) || target;
        var masked = target.classList.toggle('masked');
        if (masked) {
          textEl.textContent = '••••••••••••••••••••••••••••••••';
          btn.title = 'Show';
        } else {
          textEl.textContent = target.getAttribute('data-value');
          btn.title = 'Hide';
        }
      });
    });

    var touched = false;
    function revalidate() {
      clearAlert(alertSlot);
      if (!touched) return;
      validateTitle(titleInput);
      validateShortname(nameInput);
    }
    titleInput.addEventListener('input', revalidate);
    nameInput.addEventListener('input', revalidate);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      touched = true;
      var okTitle = validateTitle(titleInput);
      var okName = validateShortname(nameInput);
      if (!okTitle) { clearAlert(alertSlot); titleInput.focus(); return; }
      if (!okName) { clearAlert(alertSlot); nameInput.focus(); return; }

      var btn = $('button[type="submit"]', form);
      setBusy(btn, true);
      postForm('/apps/save', formData(form)).then(function () {
        setBusy(btn, false);
        if (alertSlot) {
          alertSlot.innerHTML =
            '<div class="callout success">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>' +
            '<div>Saved.</div></div>';
        }
      }).catch(function (err) {
        setBusy(btn, false);
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

  /* ---------- delete account ---------- */
  function initDelete() {
    var form = $('#deactivate_phone_form');
    if (!form) return;

    var confirmBox = $('#deactivate_confirm_box');
    var confirmBtn = $('#deactivate_confirm_btn');
    var cancelBtn = $('#deactivate_cancel_btn');
    var alertSlot = $('#deactivate_code_alert');
    var resultWrap = $('#deactivate_result_wrap');
    var formWrap = form;
    var messageInput = $('#deactivate_message');
    var performing = false;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      confirmBox.classList.remove('my-hide');
      confirmBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    cancelBtn.addEventListener('click', function () {
      confirmBox.classList.add('my-hide');
    });

    confirmBtn.addEventListener('click', function () {
      if (performing) return;
      performing = true;
      clearAlert(alertSlot);
      setBusy(confirmBtn, true);
      postForm('/delete/do_delete', {
        hash: form.elements.hash.value,
        message: messageInput ? messageInput.value : ''
      }).then(function () {
        setBusy(confirmBtn, false);
        performing = false;
        formWrap.classList.add('my-hide');
        resultWrap.classList.remove('my-hide');
      }).catch(function (err) {
        setBusy(confirmBtn, false);
        performing = false;
        showAlert(alertSlot, err.text);
      });
    });
  }

  ready(function () {
    initTheme();
    initMotion();
    initCopy();
    initPhoneField();
    initAuth();
    initCreateApp();
    initEditApp();
    initDelete();
  });
})();
