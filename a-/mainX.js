/* Self-contained behaviour for the right-hand "ON THE PAGE" nav:
   smooth in-page scrolling + scrollspy highlighting. The saved page keeps
   absolute hrefs (which would navigate away) and Telegram's main.js does not
   rebind this static nav, so we wire it up locally.
   .dev_side_nav is created dynamically by initDevPageNav() (main.js), which
   calls window.initDevSideNavX() once the nav is in the DOM. */
window.initDevSideNavX = (function () {
  var teardown = null;
  return function () {
  var sideNav = document.querySelector('.dev_side_nav');
  if (!sideNav) return;
  /* Idempotent: skip if already wired up for the current <ul>. The <ul> can be
     replaced by updateDevPageNav(); in that case main.js clears the flag
     before re-invoking us. */
  if (sideNav.dataset.localNav === '1') return;
  sideNav.dataset.localNav = '1';

  /* Tear down the previous instance (if updateDevPageNav replaced the <ul>)
     so window listeners don't accumulate. */
  if (teardown) teardown();

  var navUl = sideNav.querySelector('ul');
  if (!navUl) { sideNav.dataset.localNav = ''; return; }
  var HEADER_OFFSET = 100;

  /* Fumadocs "clerk" rail: a masked SVG path (grey full rail + blue active
     span). The path is rebuilt for the currently expanded group, with a
     diagonal bend between the group title and its nested children. */
  var rail = null, railBg = null, railThumb = null;
  if (navUl) {
    rail = document.createElement('div');
    rail.className = 'dev_side_nav_rail';
    railBg = document.createElement('div');
    railBg.className = 'dev_side_nav_rail_bg';
    railThumb = document.createElement('div');
    railThumb.className = 'dev_side_nav_rail_thumb';
    rail.appendChild(railBg);
    rail.appendChild(railThumb);
    navUl.appendChild(rail);
  }

  var GROUP_X = 0, NESTED_X = 12, STROKE = 2;

  function isVisible(a) { return a.getClientRects().length > 0; }

  function segOf(a) {
    var r = a.getBoundingClientRect();
    var st = getComputedStyle(a);
    var cTop = (r.top - navUl.getBoundingClientRect().top) + navUl.scrollTop;
    return {
      top: cTop + parseFloat(st.paddingTop),
      bottom: cTop + a.clientHeight - parseFloat(st.paddingBottom)
    };
  }

  function groupOf(li) {
    var p = li.parentNode && li.parentNode.closest('li');
    return p || li;
  }

  function isNested(li) {
    return !!(li.parentNode && li.parentNode.closest('li'));
  }

  function buildRail() {
    if (!rail || !navUl) return;
    /* One continuous path through every currently visible item: top-level
       titles at x=0, the expanded group's children at x=12. The connectors
       between the two levels become the diagonal bends. */
    var rows = [];
    for (var k = 0; k < entries.length; k++) {
      var a = entries[k].link;
      if (!isVisible(a)) continue;
      rows.push({ a: a, x: isNested(entries[k].li) ? NESTED_X : GROUP_X });
    }
    if (!rows.length) { rail.style.height = '0px'; return; }

    var w = 0, h = 0, d = [];
    for (var i = 0; i < rows.length; i++) {
      var off = rows[i].x + 1;
      var s = segOf(rows[i].a);
      w = Math.max(w, off);
      h = Math.max(h, s.bottom);
      d.push((i === 0 ? 'M' : 'L') + off + ' ' + s.top);
      d.push('L' + off + ' ' + s.bottom);
    }
    var width = w + 1;
    rail.style.width = width + 'px';
    rail.style.height = h + 'px';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + h +
      '"><path d="' + d.join(' ') + '" stroke="black" stroke-width="' + STROKE +
      '" fill="none" stroke-linejoin="round"/></svg>';
    var mask = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    rail.style.webkitMaskImage = mask;
    rail.style.maskImage = mask;
  }

  function positionThumb(link) {
    if (!railThumb || !navUl) return;
    var s = segOf(link);
    railThumb.style.marginTop = s.top + 'px';
    railThumb.style.height = (s.bottom - s.top) + 'px';
  }

  function resolve(link) {
    var sel = link.getAttribute('data-target') || '';
    if (sel.charAt(0) !== '#' || sel.length < 2) return null;
    return document.getElementById(sel.slice(1));
  }

  var entries = [];
  Array.prototype.forEach.call(sideNav.querySelectorAll('a[data-target]'), function (link) {
    var target = resolve(link);
    if (target) entries.push({ link: link, li: link.parentNode, target: target });
  });
  if (!entries.length) return;

  var programmatic = false, programmaticTarget = 0, settleTimer = null;

  /* Smooth scroll on click. The clicked item is activated immediately and
     scrollspy is suspended for the whole programmatic scroll, so the menu
     jumps straight to the target instead of expanding/collapsing every group
     it passes. Suppression is released only once the page has actually
     reached the destination (not on a mid-scroll pause), so nothing flashes
     open on the way. */
  function onNavClick(event) {
    var link = event.target.closest('a[data-target]');
    if (!link || !sideNav.contains(link)) return;
    var target = resolve(link);
    if (!target) return;
    event.preventDefault();

    var entry = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].link === link) { entry = entries[i]; break; }
    }
    /* Top-level headers: snap instantly, no animation. Sub-items: glide. */
    var isHeader = !!(entry && !(entry.li.parentNode && entry.li.parentNode.closest('li')));
    programmatic = true;
    if (entry) applyCurrent(entry, isHeader);

    var top = target.getBoundingClientRect().top + window.pageYOffset - 20;
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    programmaticTarget = Math.max(0, Math.min(top, maxScroll));
    window.scrollTo({ top: top, behavior: isHeader ? 'auto' : 'smooth' });
    var hash = link.getAttribute('data-target');
    if (history.replaceState) history.replaceState(null, '', hash);
    else window.location.hash = hash;

    /* Hard fallback in case the destination is never reached exactly. */
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(endProgrammatic, 2000);
  }
  sideNav.addEventListener('click', onNavClick);

  function keepLinkVisible(link) {
    if (!navUl) return;
    var l = link.getBoundingClientRect();
    var u = navUl.getBoundingClientRect();
    if (l.top < u.top) navUl.scrollTop -= (u.top - l.top) + 8;
    else if (l.bottom > u.bottom) navUl.scrollTop += (l.bottom - u.bottom) + 8;
  }

  var ticking = false;
  var lastGroup = null;

  function findCurrent() {
    var scrollPos = window.pageYOffset + HEADER_OFFSET;
    var atBottom = window.innerHeight + window.pageYOffset >=
      document.documentElement.scrollHeight - 2;
    var current = null;
    for (var i = 0; i < entries.length; i++) {
      var top = entries[i].target.getBoundingClientRect().top + window.pageYOffset;
      if (top <= scrollPos) current = entries[i];
    }
    if (atBottom) current = entries[entries.length - 1];
    return current || entries[0];
  }

  function applyCurrent(current, forceSnap) {
    if (!current) return;
    var marked = sideNav.querySelectorAll('li.active, li.is-current');
    Array.prototype.forEach.call(marked, function (li) {
      li.classList.remove('active', 'is-current');
    });

    /* "is-current" drives the highlight (blue + pill). "active" is what the
       page's own CSS keys off to expand a group's children, so the parent
       group also needs it — otherwise the nested list stays display:none. */
    current.li.classList.add('active', 'is-current');
    var groupLi = current.li.parentNode && current.li.parentNode.closest('li');
    var nested = !!(groupLi && groupLi !== current.li);
    if (nested) groupLi.classList.add('active');
    keepLinkVisible(current.link);

    var group = groupOf(current.li);
    var groupChanged = group !== lastGroup;
    if (groupChanged) { buildRail(); lastGroup = group; }

    if ((groupChanged || forceSnap) && railThumb) {
      /* Snap the indicator into place (group change rebuilt the rail, or a
         header click asked for an instant, animation-free update) rather than
         sliding it across the whole list. */
      railThumb.classList.remove('is-animated');
      positionThumb(current.link);
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          if (railThumb) railThumb.classList.add('is-animated');
        });
      });
    } else {
      positionThumb(current.link);
    }
  }

  function updateActive() {
    ticking = false;
    applyCurrent(findCurrent());
  }

  function endProgrammatic() {
    programmatic = false;
    window.clearTimeout(settleTimer);
    updateActive();
  }

  function onScroll() {
    if (programmatic) {
      /* Stay suspended until the page actually arrives at the destination,
         so no intermediate section flashes open mid-jump. */
      if (Math.abs(window.pageYOffset - programmaticTarget) <= 2) endProgrammatic();
      return;
    }
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateActive);
  }

  /* Recompute the rail whenever layout can shift: late CDN CSS, web fonts,
     window resize, content reflow. Force a rail rebuild by clearing the
     cached group, since the path geometry depends on the final layout. */
  var relayoutTick = false;
  function relayout() {
    if (relayoutTick) return;
    relayoutTick = true;
    window.requestAnimationFrame(function () {
      relayoutTick = false;
      lastGroup = null;
      updateActive();
    });
  }

  var resizeObserver = null;
  if (window.ResizeObserver && navUl) {
    resizeObserver = new ResizeObserver(relayout);
    resizeObserver.observe(navUl);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', relayout);
  window.addEventListener('load', relayout);

  updateActive();
  /* Enable the slide transition only after the first placement so the
     indicator does not animate in from the top on load. */
  window.requestAnimationFrame(function () {
    if (railThumb) railThumb.classList.add('is-animated');
  });

  /* Remember how to undo everything so a re-init (after updateDevPageNav
     replaces the <ul>) can cleanly remove window listeners + the observer. */
  teardown = function () {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', relayout);
    window.removeEventListener('load', relayout);
    if (resizeObserver) resizeObserver.disconnect();
    if (sideNav) sideNav.removeEventListener('click', onNavClick);
  };
  };
})();

/* ============================================================
   Day/night theme toggle — animated sun↔moon icon.
   Animation: Telegram's built-in RLottie (tgsticker.js) loads
   sun_outline.tgs via the wasm worker; we render specific frames
   ourselves (forward → moon, backward → sun) and tint each frame to
   the current theme colour. End frames are cached raw (pre-tint) so
   snapping to the target frame is synchronous — view-transition
   snapshots capture the canvas before any async frame could arrive.
   Fallback: when tgsticker.js isn't loaded (?notgs=1) or
   WebAssembly/Worker isn't supported, a static sun/moon SVG pair is
   shown. In both cases the radial-wipe view transition animates the
   theme change; the static path relies on CSS view-transition
   pseudo-element animations for the icon swap.
   ============================================================ */
(function () {
  var W = 44, H = 44;                 // render at 2x of the 22px display size
  var SUN_FRAME = 0;                  // frame 0 = sun (light)
  var MOON_FRAME = 0;                 // last frame = moon (dark); set after load

  /* The theme is stored in a cookie on the current host's parent domain so
     telegram.org and core.telegram.org stay in sync, and the server renders
     the correct data-theme attribute before any JS runs (no flash). */
  var COOKIE_NAME = 'stel_theme';
  var COOKIE_MAX_AGE = 31536000;       // ~1 year

  /* Compute the cookie domain from the current hostname: the last two labels
     (core.telegram.org → .telegram.org). A cookie can only be set on the
     current host's own domain tree, so this is derived from location.hostname
     rather than hardcoded. */
  function cookieDomain() {
    var parts = location.hostname.split('.');
    if (parts.length < 2) return '';
    return '.' + parts.slice(-2).join('.');
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    if (window.$) {
      $(document.documentElement).trigger('themechange');
    }
    var domain = cookieDomain();
    document.cookie = COOKIE_NAME + '=' + t +
      '; path=/; max-age=' + COOKIE_MAX_AGE +
      (domain ? '; domain=' + domain : '') + '; samesite=lax';
  }

  var btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  var head = document.querySelector('.dev_page_head, .tl_page_head');
  if (head) btn.style.height = head.offsetHeight + 'px';   // align to header height

  /* JS is the source of truth for the theme, so rapid clicks stay correct
     even while a transition's (async) callback hasn't run yet. */
  var themeState = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

  /* ---- Shared: demo video freeze/thaw + radial-wipe view transition ---- */

  /* The homepage demo videos (mp4s with a white backdrop) sit on top of the
     static preview images. A *live* <video> keeps painting over the
     view-transition snapshots, so when the theme wipe runs mid-playback its
     white box flashes over the dark side of the wipe. Freeze any playing video
     back to its (dark-aware) static image BEFORE the transition; remember which
     were playing so we can resume in light mode afterwards. */
  var frozenDemos = [];
  function freezeDemoVideos() {
    frozenDemos = [];
    var links = document.querySelectorAll(
      '.tl_main_download_link_android, .tl_main_download_link_ios');
    Array.prototype.forEach.call(links, function (link) {
      var v = link.querySelector('video');
      if (!v) return;
      if (link.classList.contains('video_play')) frozenDemos.push(link);
      link.classList.remove('video_play');     // reveal the static image
      try { v.pause(); } catch (e) {}
      link.isHover = 0;                         // keep main.js hover state in sync
      if (link.outTimeout) { clearTimeout(link.outTimeout); delete link.outTimeout; }
    });
  }
  function thawDemoVideos() {
    /* Keep videos suppressed in dark (matches the hover wrapper below); only
       resume in light, and only where the pointer is still on the button. */
    if (themeState !== 'dark' && typeof window.mainDemoVideoHover === 'function') {
      frozenDemos.forEach(function (link) {
        if (link.matches && link.matches(':hover')) window.mainDemoVideoHover(link, 1);
      });
    }
    frozenDemos = [];
  }

  var WIPE_MS = 500;
  var activeVT = null;

  /* doToggle handles the theme change with a radial-wipe view transition.
     - applyInVT:   called inside the VT callback (synchronous, before snapshot)
     - applyInstant: called when VT is unavailable or reduced motion (with `reduce` flag)
     Both are optional; the static path omits them (CSS handles the icon swap
     via ::view-transition-old/new pseudo-element animations). */
  function doToggle(applyInVT, applyInstant) {
    themeState = themeState === 'dark' ? 'light' : 'dark';
    var t = themeState;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    freezeDemoVideos();

    /* No View Transitions: instant theme change. */
    if (!document.startViewTransition) {
      setTheme(t);
      if (applyInstant) applyInstant(reduce);
      thawDemoVideos();
      return;
    }
    /* Reduced motion: snap, no reveal. */
    if (reduce) {
      setTheme(t);
      if (applyInstant) applyInstant(reduce);
      thawDemoVideos();
      return;
    }

    /* Skip any in-flight transition so a new click never has to wait. */
    if (activeVT && activeVT.skipTransition) { try { activeVT.skipTransition(); } catch (e) {} }

    /* Origin of the radial wipe = centre of the toggle. Guard every value: a
       degenerate rect or a non-finite coordinate would yield an invalid
       "circle(0px at NaNpx NaNpx)", which Chrome parses as "circle(0px)" —
       i.e. centred — making the wipe start from the screen centre. Fall back
       to the toggle's home corner (top-right), never the centre. */
    var vw = innerWidth, vh = innerHeight;
    var r = btn.getBoundingClientRect();
    var cx = r.width ? r.left + r.width / 2 : vw;
    var cy = r.height ? r.top + r.height / 2 : 0;
    if (!isFinite(cx)) cx = vw;
    if (!isFinite(cy)) cy = 0;
    var end = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy));
    if (!isFinite(end) || end <= 0) end = Math.hypot(vw, vh);

    /* Origin as PERCENTAGES of the snapshot box. The "at <length> <length>"
       form of circle() is silently dropped by some Chrome builds when animated
       via WAAPI keyframes — Chrome then falls back to circle()'s default 50% 50%,
       i.e. the wipe expands from screen centre instead of the toggle. Percentages
       resolve reliably regardless of Chrome version / DPR / page zoom. Radius
       stays in px (the snapshot box already equals the viewport). */
    var px = vw ? (cx / vw) * 100 : 95, py = vh ? (cy / vh) * 100 : 2;
    var from = 'circle(0% at ' + px + '% ' + py + '%)';
    var to   = 'circle(150% at ' + px + '% ' + py + '%)';

    /* One-shot diagnostic so an affected user can report what their browser
       actually computed: read window.__ttDebug or sessionStorage.ttDebug. */
    var dbg = { ua: navigator.userAgent, dpr: window.devicePixelRatio,
                vw: vw, vh: vh,
                rect: { l: r.left, t: r.top, w: r.width, h: r.height },
                vv: window.visualViewport
                      ? { scale: visualViewport.scale, ox: visualViewport.offsetLeft, oy: visualViewport.offsetTop }
                      : null,
                cx: cx, cy: cy, end: end, from: from, to: to };
    window.__ttDebug = dbg;
    try { sessionStorage.setItem('ttDebug', JSON.stringify(dbg)); } catch (e) {}
    console.log('[theme-toggle] reveal origin', dbg);

    var vt = document.startViewTransition(function () {
      setTheme(themeState);                 // latest intent (source of truth)
      if (applyInVT) applyInVT();           // icon's new snapshot = target frame
    });
    activeVT = vt;
    vt.ready.then(function () {
      document.documentElement.animate(
        { clipPath: [from, to] },
        { duration: WIPE_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pseudoElement: '::view-transition-new(root)' }
      );
    });
    var clear = function () { if (activeVT === vt) activeVT = null; thawDemoVideos(); };
    vt.finished.then(clear, clear);
  }

  /* ---------- Static SVG fallback (no RLottie) ----------
     The button + SVG icons are already server-rendered with the --static
     class; just wire up the click handler. */
  var replaced = false;
  if (typeof RLottie === 'undefined' || !RLottie.isSupported) {
    btn.addEventListener('click', function () { doToggle(null, null); });
    return;
  }

  /* ---------- Animated lottie path ---------- */
  /* Upgrade: replace the static SVGs with a canvas for lottie rendering. */
  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  btn.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  var player = null, ready = false, cur = 0, raf = 0, animTarget = null;
  var rawCache = {};  // frameNo → Uint8ClampedArray (raw white pixels from worker)

  function iconRGB() {
    var m = getComputedStyle(btn).color.match(/(\d+)\D+(\d+)\D+(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : [136, 136, 136];
  }

  /* The lottie is pure white; recolour RGB to the theme colour, keep alpha.
     Copies rawPixels so rawCache stays pristine for future re-tints. */
  function recolourAndDraw(rawPixels) {
    var arr = new Uint8ClampedArray(rawPixels);
    var c = iconRGB();
    for (var k = 0; k < arr.length; k += 4) {
      arr[k] = c[0]; arr[k + 1] = c[1]; arr[k + 2] = c[2];
    }
    ctx.putImageData(new ImageData(arr, W, H), 0, 0);
  }

  function onFrame(frameNo, pixels) {
    rawCache[frameNo] = pixels;
    /* Draw only if this is still the frame we want to show — background
       cache-fill renders (the "other" end frame) must not overwrite the
       visible icon. */
    if (frameNo === cur) recolourAndDraw(pixels);
    /* Advance the morph if we haven't reached the target. */
    if (animTarget !== null) {
      if (cur === animTarget) {
        animTarget = null;
      } else if (frameNo === cur) {
        raf = requestAnimationFrame(stepAnimation);
      }
    }
  }

  function stepAnimation() {
    raf = 0;
    if (!ready || animTarget === null) return;
    if (cur === animTarget) { animTarget = null; return; }
    var dir = animTarget > cur ? 2 : -2;     // ~2 frames per tick (~0.3s morph)
    var next = cur + dir;
    if ((dir > 0 && next >= animTarget) || (dir < 0 && next <= animTarget)) next = animTarget;
    cur = next;                  // optimistic: onFrame draws when the worker answers
    player.renderFrame(next);
  }

  function animateTo(target) {
    if (!ready) { cur = target; return; }
    if (raf) cancelAnimationFrame(raf);
    animTarget = target;
    stepAnimation();
  }

  function morphIcon() {                    // morph toward the current themeState
    animateTo(themeState === 'dark' ? MOON_FRAME : SUN_FRAME);
  }

  function snapIcon() {                     // snap to the frame matching themeState
    if (raf) cancelAnimationFrame(raf);
    animTarget = null;
    cur = (themeState === 'dark' ? MOON_FRAME : SUN_FRAME);
    var raw = rawCache[cur];
    if (raw) {
      /* Synchronous draw from cache — vital for view-transition snapshots,
         which capture the canvas before any async worker frame could arrive. */
      recolourAndDraw(raw);
    } else if (player) {
      player.renderFrame(cur);   // first time only; subsequent snaps hit the cache
    }
  }

  btn.addEventListener('click', function () {
    doToggle(
      function () { snapIcon(); },             // inside VT callback: snap to target frame
      function (reduce) {                       // instant (no VT or reduced motion):
        if (reduce) snapIcon(); else morphIcon();
      }
    );
  });

  /* Boot: init the wasm workers (shared with the homepage stickers), load
     the .tgs, and pre-render both end frames so the first snap is always
     synchronous. */
  RLottie.initWorkers(function () {
    player = RLottie.createRawPlayer(W, H, function (frameCount, fps) {
      MOON_FRAME = frameCount - 1;
      ready = true;
      cur = themeState === 'dark' ? MOON_FRAME : SUN_FRAME;
      player.renderFrame(cur);             // display the current theme's icon
      var other = themeState === 'dark' ? SUN_FRAME : MOON_FRAME;
      player.renderFrame(other);           // pre-fill the cache (no draw: other !== cur)
      if (!replaced) {
        btn.classList.remove('theme-toggle--static');
        replaced = true;
      }
    }, onFrame);
    player.loadFromUrl('/img/sun_outline.tgs');
  });
})();

/* ============================================================
   Safety / transparency dashboard — drive its native dark mode from our theme.
   Telegram's own assets already ship a dark variant we just need to switch on:
     - tchart chart chrome (legend/tooltip/zoom) is styled by `.dark .tchart--*`,
       so we put `.dark` on the chart CONTAINER (not <html>, which would also
       trip `.dark body`/`.dark a` and fight our palette);
     - the chart canvas is painted in JS — flip it with each TChart's
       setDarkMode(), which cascades to its parts (several call onResize() and
       the render cache key includes the dark flag, so it actually repaints).
   No-ops on pages without a dashboard / without window.charts.
   ============================================================ */
(function () {
  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function applyDashboardDark(dark) {
    var containers = document.querySelectorAll('.tl_dashboard_container');
    Array.prototype.forEach.call(containers, function (c) {
      c.classList.toggle('dark', dark);
    });
    if (!window.charts) return;
    var flipped = false;
    Object.keys(window.charts).forEach(function (id) {
      var chart = window.charts[id];
      if (chart && typeof chart.setDarkMode === 'function') {
        chart.setDarkMode(dark);
        flipped = true;
      }
    });
    /* Belt-and-suspenders repaint (setDarkMode already cascades to onResize, but
       a resize forces every chart to re-render against the new cache key). */
    if (flipped) window.dispatchEvent(new Event('resize'));
  }

  /* Re-sync whenever the theme attribute flips (toggle button). */
  if (window.MutationObserver) {
    new MutationObserver(function () { applyDashboardDark(isDark()); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* Chart container chrome can be themed right away; the canvas charts are
     built inside a setTimeout, so poll window.charts until they appear. */
  applyDashboardDark(isDark());
  var tries = 0;
  (function waitForCharts() {
    if (window.charts && Object.keys(window.charts).length) {
      applyDashboardDark(isDark());
      return;
    }
    if (++tries > 40) return;           // ~6s; no dashboard on this page
    window.setTimeout(waitForCharts, 150);
  })();
})();

/* Homepage download buttons play a demo video on hover (inline
   onmouseover="mainDemoVideoHover(...)", defined in main.js). Suppress that in
   dark mode — wrap the global so the inline handlers hit our version, falling
   through to the original in light. */
(function () {
  var orig = window.mainDemoVideoHover;
  if (typeof orig !== 'function') return;
  window.mainDemoVideoHover = function () {
    if (document.documentElement.getAttribute('data-theme') === 'dark') return;
    return orig.apply(this, arguments);
  };
})();
