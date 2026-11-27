/* Premium Bot Mini App fx runtime: Telegram's StarParticlesView particle field (src/fx/particles.ts, stage.ts), the
   page's light field and fireflies (src/fx/field.ts, fireflies.ts), the shared breath, the neon aura and Best Value's
   glint (src/fx/light.ts), iOS success confetti and the results burst (src/fx/confetti.ts, burst.ts),
   ported to plain classic JavaScript, no build step. */
window.PremiumFx = (function() {
  'use strict';

  var stages = [];
  var auras = [];
  var raf = 0;
  var last = 0;
  var gate = null;
  var appActive = true;
  var resizeHandler = null;

  function clamp(value, lo, hi) {
    return Math.min(Math.max(value, lo), hi);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function overshoot(t) {
    var k = clamp(t, 0, 1);
    return (k - 1) * (k - 1) * (3 * k - 1) + 1;
  }

  function parseHex(hex) {
    var s = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    if (s.length === 3) {
      s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    var value = parseInt(s, 16);
    if (isNaN(value) || s.length !== 6) {
      return null;
    }
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function reducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // fx.css keys its still variants on the root's fx-reduce class.
  function syncMotion() {
    document.documentElement.classList.toggle('fx-reduce', reducedMotion());
  }

  // At most 60 frames a second at any display rate, on the display's own ticks.
  function frameGate() {
    var step = 1000 / 60;
    var next = 0;
    return function(now) {
      if (now < next - 2) {
        return false;
      }
      next = (now - next > step ? now : next) + step;
      return true;
    };
  }

  // Where el lies from root's padding edge, by layout offsets: a press or an entrance transforms a box, not its place.
  function offsetIn(el, root) {
    var x = 0;
    var y = 0;
    for (var e = el; e && e !== root; e = e.offsetParent) {
      x += e.offsetLeft;
      y += e.offsetTop;
    }
    return [x, y];
  }

  // ===== Particle field (Telegram Android's StarParticlesView, iOS colours and intro burst) =====

  var FIELD_COLORS = {
    stars: ['#fdd219', '#f9b004', '#f09903'],
    premium: ['#6a94ff', '#9472fd', '#e26bd3']
  };
  var SPRITE_SIZES = [4, 12, 10];
  var STRIDE = 8;
  // A particle's drift in px a ms: StarParticlesView's 4 dp in 660 ms.
  var DRIFT = 4 / 660;
  var sprites = {};

  function sprite(color, size, dpr) {
    var key = color + ' ' + size + ' ' + dpr;
    var cached = sprites[key];
    if (cached) {
      return cached;
    }
    var n = Math.max(2, Math.round(size * dpr));
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    var g = canvas.getContext('2d');
    var rgb = parseHex(color);
    if (g && rgb) {
      var half = n >> 1;
      var mid = Math.floor(half * 0.98);
      var points = [0, half, mid, mid, half, 0, n - mid, mid, n, half, n - mid, n - mid, half, n, mid, n - mid];
      // CornerPathEffect: each corner is cut back by up to 0.8 dp along both sides and joined by a quad through it.
      var cut = function(i, j, r) {
        var x = points[2 * i];
        var y = points[2 * i + 1];
        var dx = points[2 * j] - x;
        var dy = points[2 * j + 1] - y;
        var f = Math.min(0.5, r / (Math.hypot(dx, dy) || 1));
        return [x + dx * f, y + dy * f];
      };
      g.beginPath();
      for (var i = 0; i < 8; i++) {
        var a = cut(i, (i + 7) % 8, 0.8 * dpr);
        var b = cut(i, (i + 1) % 8, 0.8 * dpr);
        if (i) {
          g.lineTo(a[0], a[1]);
        } else {
          g.moveTo(a[0], a[1]);
        }
        g.quadraticCurveTo(points[2 * i], points[2 * i + 1], b[0], b[1]);
      }
      g.closePath();
      g.fillStyle = color;
      g.fill();
      blur(g, n, Math.round(dpr), rgb);
    }
    sprites[key] = canvas;
    return canvas;
  }

  // Stack blur on alpha; the colour is one, so this is what blurring premultiplied pixels gives. Alpha ends at 200.
  function blur(g, n, radius, rgb) {
    var img = g.getImageData(0, 0, n, n);
    var d = img.data;
    var a = new Float32Array(n * n);
    var t = new Float32Array(n * n);
    var i;
    for (i = 0; i < n * n; i++) {
      a[i] = d[i * 4 + 3];
    }
    var norm = (radius + 1) * (radius + 1);
    var dirs = [[1, 0], [0, 1]];
    for (var dir = 0; dir < 2; dir++) {
      var dx = dirs[dir][0];
      var dy = dirs[dir][1];
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          var s = 0;
          for (var k = -radius; k <= radius; k++) {
            s += a[clamp(y + k * dy, 0, n - 1) * n + clamp(x + k * dx, 0, n - 1)] * (radius + 1 - Math.abs(k));
          }
          t[y * n + x] = s / norm;
        }
      }
      var swap = a;
      a = t;
      t = swap;
    }
    for (i = 0; i < n * n; i++) {
      d[i * 4] = rgb[0];
      d[i * 4 + 1] = rgb[1];
      d[i * 4 + 2] = rgb[2];
      d[i * 4 + 3] = (a[i] * 200) / 255;
    }
    g.putImageData(img, 0, 0);
  }

  function particleField(colors, count) {
    var canvas = document.createElement('canvas');
    canvas.className = 'fx-stage__field';
    canvas.setAttribute('aria-hidden', 'true');
    var ctx = canvas.getContext('2d');
    var p = new Float32Array(count * STRIDE);
    var images = [];
    var w = 0;
    var h = 0;
    var cx = 0;
    var cy = 0;
    var mark = 0;
    var dpr = 0;
    var n = count;
    var rand = Math.random;
    var introAge = Infinity;
    var boost = 1;
    // How many of its particles a field taken on to another stage keeps where they are at its next layout, while the
    // others start along their lives. Below zero, a layout starts the field anew.
    var kept = -1;

    var inside = function(x, y) {
      return cx + x > -15 && cx + x < w + 15 && cy + y > -15 && cy + y < h + 15;
    };
    var spawn = function(o) {
      var x = 0;
      var y = 0;
      // A clipped canvas loses spawns past its edge: a few tries keep the count on screen.
      for (var tries = 0; tries < 4; tries++) {
        var a = rand() * Math.PI * 2;
        var c = Math.cos(a);
        var s = Math.sin(a);
        // Nothing inside the mark's circle once y is squashed.
        var near = (0.55 * mark) / Math.hypot(c, 0.6 * s);
        var r = near + rand() * Math.max(0, w / 2 - near);
        x = r * c;
        y = 0.6 * r * s;
        if (inside(x, y)) {
          break;
        }
      }
      var len = Math.hypot(x, y) || 1;
      p[o] = x;
      p[o + 1] = y;
      p[o + 2] = x / len;
      p[o + 3] = y / len;
      p[o + 4] = 0;
      p[o + 5] = 2000 + Math.floor(rand() * 3000);
      p[o + 6] = (50 + Math.floor(rand() * 50)) / 100;
      p[o + 7] = Math.floor(rand() * SPRITE_SIZES.length) * colors.length + Math.floor(rand() * colors.length);
    };
    var respawn = function() {
      for (var i = 0; i < n; i++) {
        spawn(i * STRIDE);
      }
    };
    // A particle somewhere along its life, as in a field long running; one that would have left by then is born anew.
    var settle = function(o) {
      spawn(o);
      var age = rand() * p[o + 5];
      var x = p[o] + p[o + 2] * DRIFT * age;
      var y = p[o + 1] + p[o + 3] * DRIFT * age;
      if (inside(x, y)) {
        p[o] = x;
        p[o + 1] = y;
        p[o + 4] = age;
      }
    };
    var dress = function(ratio) {
      SPRITE_SIZES.forEach(function(s, i) {
        colors.forEach(function(color, j) {
          images[i * colors.length + j] = sprite(color, s, ratio);
        });
      });
    };
    var step = function(dt, spin) {
      introAge += dt;
      boost = Math.max(Math.min(3.5, 1 + Math.abs(spin) * 0.02), 1 + (boost - 1) * Math.exp(-dt / 200));
      var intro = introAge < 1200 ? 4 - 3 * easeOutCubic(introAge / 1200) : 1;
      var move = DRIFT * dt * Math.max(intro, boost);
      for (var o = 0; o < n * STRIDE; o += STRIDE) {
        p[o + 4] += dt;
        if (p[o + 4] > p[o + 5]) {
          spawn(o);
        } else {
          p[o] += p[o + 2] * move;
          p[o + 1] += p[o + 3] * move;
          if (!inside(p[o], p[o + 1])) {
            spawn(o);
          }
        }
      }
    };
    var paint = function() {
      if (!ctx) {
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var o = 0; o < n * STRIDE; o += STRIDE) {
        var x = cx + p[o];
        var y = cy + p[o + 1];
        var age = p[o + 4];
        var rest = p[o + 5] - age;
        var out = rest < 200 ? clamp(1 - rest / 150, 0, 1) : 0;
        var alpha = p[o + 6] * (1 - out) * Math.min(1, y / 12, (h - y) / 12, x / 24, (w - x) / 24);
        var image = images[p[o + 7]];
        if (!image) {
          continue;
        }
        var size = image.width * overshoot(Math.min(1, age / 200));
        if (alpha <= 0 || size <= 0) {
          continue;
        }
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(image, x * dpr - size / 2, y * dpr - size / 2, size, size);
      }
    };

    return {
      canvas: canvas,
      layout: function(width, height, x, y, size, ratio) {
        var fresh = width !== w || size !== mark || ratio !== dpr;
        if (ratio !== dpr) {
          dress(ratio);
        }
        w = width;
        h = height;
        cx = x;
        cy = y;
        mark = size;
        dpr = ratio;
        if (canvas.width !== Math.round(w * dpr)) {
          canvas.width = Math.round(w * dpr);
        }
        if (canvas.height !== Math.round(h * dpr)) {
          canvas.height = Math.round(h * dpr);
        }
        canvas.style.height = h + 'px';
        if (kept >= 0) {
          for (var i = 0; i < n; i++) {
            if (i >= kept || !inside(p[i * STRIDE], p[i * STRIDE + 1])) {
              settle(i * STRIDE);
            }
          }
          kept = -1;
          // In this task, so the stage's first frame shows the field whole.
          paint();
        } else if (fresh) {
          respawn();
        }
      },
      // The field goes on under another stage, in its colours and count: what it holds stays where it is.
      carry: function(tones, total) {
        kept = w ? Math.min(count, total) : 0;
        if (total !== count) {
          var q = new Float32Array(total * STRIDE);
          q.set(p.subarray(0, kept * STRIDE));
          p = q;
          count = n = total;
        }
        colors = tones;
        if (dpr) {
          dress(dpr);
        }
      },
      frame: function(dt, spin) {
        if (!w) {
          return;
        }
        step(clamp(dt, 0, 50), spin);
        paint();
      },
      still: function(c) {
        if (!w) {
          return;
        }
        // A seeded field at t = 2 s, so the still looks like any live moment.
        var seed = 0x5eed;
        rand = function() {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        n = Math.min(c, count);
        introAge = Infinity;
        boost = 1;
        respawn();
        for (var t = 0; t < 2000; t += 1000 / 60) {
          step(1000 / 60, 0);
        }
        paint();
        rand = Math.random;
        n = count;
      },
      intro: function() {
        introAge = 0;
      }
    };
  }

  // Particles for this client: Telegram Android names its performance class in the user agent.
  function particleCount(density) {
    var m = /Telegram-Android\/\S+ \([^)]*; (LOW|AVERAGE|HIGH)\)/.exec(navigator.userAgent);
    return Math.max(1, Math.round((m ? (m[1] === 'HIGH' ? 120 : m[1] === 'AVERAGE' ? 80 : 40) : 100) * density));
  }

  // ===== Stages (fx/stage.ts): a hero's particle field and, on a full-screen stage, its centred content =====

  // The field keeps its look around the 88 px mark of fx.css .fx-stage--compact by scaling with the mark's area.
  var COMPACT_DENSITY = Math.pow(88 / 120, 2);
  // Reduced motion's one still frame of the field.
  var STILL_COUNT = 40;
  // What a stage centres by its box, not its contents: the mark and hero media.
  var MEDIA = '.pm-mark, .hero-media, .result-media';
  // Telegram's own colour art for a moment floats in the field; a plain glyph gets none.
  var HERO_ART = '[data-lottie-url*="premium-gift"], [data-lottie-url*="giveaway-results"]';
  // A page change ends one page's stages and mounts the next's in one task. A field waits this long for the next
  // stage to take it on, its canvas where it was, so its particles go on through the change; not taken, it goes.
  var FIELD_HOLD_MS = 2000;
  var heldFields = [];
  var heldTimer = 0;
  // The first mount is the app's launch, where a field starts new; one that starts on a later page starts whole.
  var launched = false;

  function dropFields() {
    clearTimeout(heldTimer);
    heldTimer = 0;
    while (heldFields.length) {
      var canvas = heldFields.pop().canvas;
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
  }

  function mountStage(stage) {
    var mark = stage.querySelector('.pm-mark[data-icon3d]');
    var media = mark || stage.querySelector('.hero-media, .result-media');
    var anchor = mark || (media && media.classList.contains('fx-field') && media.querySelector(HERO_ART) ? media : null);
    var entry = {
      stage: stage,
      content: stage.querySelector('.fx-stage__content'),
      centre: media,
      mark: mark,
      field: null,
      cy: null,
      seen: typeof IntersectionObserver !== 'function',
      observers: []
    };
    // A plain glyph, such as a pending payment's, gets neither field nor glow (fx.css .fx-stage--bare).
    stage.classList.toggle('fx-stage--bare', !anchor);
    // The stage's own breath is printed lit and starts with its page: on a clock that runs on, it starts over in its
    // place.
    if (breathHeld && stage.classList.contains('neon-lit')) {
      stage.classList.remove('neon-lit');
      stage.getBoundingClientRect();
      stage.style.setProperty('--neon-delay', breathDelay(breathHeld));
      stage.classList.add('neon-lit');
    }
    if (anchor) {
      // The mark's own gradient: gold around the golden star, the Premium star's colours elsewhere.
      var golden = anchor.classList.contains('pm-mark--stars') || stage.classList.contains('fx-stage--stars');
      var density = stage.classList.contains('fx-stage--compact') ? COMPACT_DENSITY : 1;
      var colors = golden ? FIELD_COLORS.stars : FIELD_COLORS.premium;
      var count = particleCount(density);
      var taken = heldFields.shift();
      entry.field = taken || particleField(colors, count);
      if (taken || launched) {
        entry.field.carry(colors, count);
        // On screen until the observer reports, so the field moves on in the page's first frame.
        entry.seen = true;
      }
      stage.insertBefore(entry.field.canvas, stage.firstChild);
      // The rush is a field's entrance: one that goes on from the page before keeps its pace.
      if (!taken && !reducedMotion()) {
        entry.field.intro();
      }
    }
    layoutStage(entry);
    if (typeof IntersectionObserver === 'function') {
      var seen = new IntersectionObserver(function(entries) {
        entry.seen = !!entries[entries.length - 1].isIntersecting;
        update();
      });
      seen.observe(stage);
      entry.observers.push(seen);
    }
    if (typeof ResizeObserver === 'function') {
      var resize = new ResizeObserver(function() {
        layoutStage(entry);
        layoutLight();
      });
      resize.observe(stage);
      entry.observers.push(resize);
    }
    stages.push(entry);
    return entry;
  }

  // A full-screen stage centres what it shows over its bottom padding, a little above the middle but never above its
  // top padding (fx.css .fx-stage--fill). Script, not flex: the offset rounds down to the 4 px grid.
  function centreContent(content) {
    content.style.paddingTop = '';
    var box = content.getBoundingClientRect();
    var top = box.bottom;
    var bottom = box.top;
    var nodes = content.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      // Media count by their box; of the rest, only what paints: text boxes and filled surfaces.
      if (!node.matches(MEDIA) && (node.closest(MEDIA) || (node.childElementCount && getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)'))) {
        continue;
      }
      var r = node.getBoundingClientRect();
      if (r.height) {
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      }
    }
    var cs = getComputedStyle(content);
    var drop = Math.floor(((box.height - parseFloat(cs.paddingBottom) - bottom + top) / 2 - top + box.top) / 4) * 4;
    if (drop > 0) {
      content.style.paddingTop = parseFloat(cs.paddingTop) + drop + 'px';
    }
  }

  function layoutStage(entry) {
    var stage = entry.stage;
    if (!stage.isConnected || !stage.offsetWidth) {
      return;
    }
    if (entry.content && stage.classList.contains('fx-stage--fill')) {
      centreContent(entry.content);
    }
    var centre = entry.centre;
    if (!centre || !centre.offsetWidth) {
      return;
    }
    var at = offsetIn(centre, stage);
    var size = centre.offsetWidth;
    var cx = at[0] + size / 2;
    var cy = at[1] + centre.offsetHeight / 2;
    entry.cy = Math.round(cy);
    if (entry.field) {
      // The stage's width by twice the mark, centred on the mark, inside the stage.
      var top = Math.max(0, cy - size);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      entry.field.canvas.style.top = top + 'px';
      entry.field.layout(stage.offsetWidth, Math.max(0, Math.min(stage.offsetHeight, cy + size) - top), cx, cy - top, size, dpr);
      if (reducedMotion()) {
        entry.field.still(STILL_COUNT);
      }
    }
  }

  // ===== Light (fx/light.ts): the sources breathe on one 8 s clock, lit only near the screen while the page is
  // visible and Telegram has the app active. fx.css animates .neon-lit alone; --neon-delay puts a source in phase. =====

  var BREATH_MS = 8000;
  var sources = [];
  var breathing = [];
  var breathOrigin = 0;
  // The time a page ended, until the next frame: a page change ends one page and mounts the next in one task, and the
  // clock stands still for it, so the next page's lights come on as one where the last page's stood, not at the peak.
  var breathHeld = 0;
  var nearObserver = null;

  // The animation delay that puts a source lit at `now` on the shared clock.
  function breathDelay(now) {
    return -Math.round((now - breathOrigin) % BREATH_MS) + 'ms';
  }

  function breathNow() {
    return breathHeld || performance.now();
  }

  // Whether any source breathes, so the clock runs.
  function breathes() {
    breathing = breathing.filter(function(other) {
      return other.isConnected && other.classList.contains('neon-lit');
    });
    return breathing.length > 0;
  }

  function setLit(source, on) {
    var el = source.el;
    var lit = on && appActive && document.visibilityState !== 'hidden' && !reducedMotion();
    if (lit === el.classList.contains('neon-lit')) {
      return;
    }
    if (lit) {
      var now = breathNow();
      // With none breathing, as at launch or back from the background, the clock starts at the peak, where every
      // source's breath meets its still: lit on screen, nothing steps.
      if (!breathes() && !breathHeld) {
        breathOrigin = now;
      }
      el.style.setProperty('--neon-delay', breathDelay(now));
      breathing.push(el);
    }
    el.classList.toggle('neon-lit', lit);
    if (source.onLit) {
      source.onLit(lit);
    }
  }

  function lightSource(el, onLit) {
    var source = { el: el, near: false, onLit: onLit || null };
    sources.push(source);
    if (nearObserver) {
      nearObserver.observe(el);
    }
    return source;
  }

  function dropSource(source) {
    var i = sources.indexOf(source);
    if (i < 0) {
      return;
    }
    sources.splice(i, 1);
    if (nearObserver) {
      nearObserver.unobserve(source.el);
    }
    setLit(source, false);
  }

  function refreshLight() {
    for (var i = 0; i < sources.length; i++) {
      setLit(sources[i], sources[i].near);
    }
  }

  // A source laid out anew lights at once if `box` is within the observer's half screen: the observer reports only
  // after the frame paints, which would show the still out of phase.
  function lightNear(source, box) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var b = box || source.el.getBoundingClientRect();
    source.near = b.width > 0 && b.bottom >= -h / 2 && b.top <= h * 1.5 && b.right >= -w / 2 && b.left <= w * 1.5;
    setLit(source, source.near);
  }

  function watchNear() {
    if (typeof IntersectionObserver !== 'function') {
      return null;
    }
    var report = function(entries) {
      for (var i = 0; i < entries.length; i++) {
        for (var j = 0; j < sources.length; j++) {
          if (sources[j].el === entries[i].target) {
            sources[j].near = !!entries[i].isIntersecting;
            setLit(sources[j], sources[j].near);
          }
        }
      }
    };
    // Half a screen ahead, so a source scrolled to is already in phase. The document as root keeps the margin inside
    // an iframe; an engine that takes no document root keeps the implicit one.
    try {
      return new IntersectionObserver(report, { root: document, rootMargin: '50%' });
    } catch (error) {
      return new IntersectionObserver(report, { rootMargin: '50%' });
    }
  }

  // The helper prints neon-lit on the page's light, whose breath so runs from the first paint: the shared clock
  // starts there, and what is lit later joins it in phase. A light that does not breathe yet is lit as any other, and
  // so is the light of a page that follows another, whose clock runs on.
  function adoptBreath(el) {
    var running = !breathHeld && typeof el.getAnimations === 'function' ? el.getAnimations({ subtree: true }) : [];
    var time = document.timeline ? document.timeline.currentTime : null;
    for (var i = 0; i < running.length; i++) {
      if (running[i].animationName === 'neon-breath' && typeof running[i].startTime === 'number' && typeof time === 'number') {
        breathOrigin = performance.now() - (time - running[i].startTime);
        breathing.push(el);
        return;
      }
    }
    el.classList.remove('neon-lit');
  }

  // The pay button's glow, the third source: the pill beckons on its light, in its phase (fx.css keys the pill's
  // motion on .is-lit and --cta-delay).
  function mountCta(glow) {
    var button = glow.closest('.cta-button');
    lightSource(glow, function(lit) {
      if (!button) {
        return;
      }
      if (lit && button.classList.contains('is-lit')) {
        // The app script lit the pill at its init: it starts over here, so its motion runs on the glow's clock.
        button.classList.remove('is-lit');
        button.getBoundingClientRect();
      }
      button.style.setProperty('--cta-delay', glow.style.getPropertyValue('--neon-delay') || '0s');
      button.classList.toggle('is-lit', lit);
    });
  }

  // ===== The light field (fx/field.ts, fx/fireflies.ts): one layer behind the page with its stages' light and its
  // fireflies. The helper prints it with approximate geometry, which stands until this lays it out from the page. =====

  // The stage classes the light reads (fx.css); layout ones such as --fill stay with the stage.
  var STAGE_LIGHT = /^fx-stage--(dark|premium|stars|gift|boost|compact|bare|result)$/;
  // Each variant's one hue, the stage's glow, as an "r g b" triplet for fx.css --fx-accent.
  var STAGE_ACCENTS = { premium: '92 72 255', stars: '249 176 4', gift: '92 72 255', boost: '90 111 246' };
  // fx.css: the first stage on a screen, whose light runs up under the safe areas.
  var FIRST_STAGE = '.screen > :first-child > .fx-stage:first-child, .screen > .fx-stage:first-child, .screen-banner:empty + * > .fx-stage:first-child, .screen-banner:empty + .fx-stage';
  // fx.css .fx-fly: the scroll its keyframes span, so a px of scroll is the same travel at any page length.
  var FLY_RANGE = 10000;
  // Top to bottom: where each sits across the column (0 its left edge, 1 its right), its size and how it moves. The
  // far ones are large and slow, the near ones small and quick.
  var FLY_SLOTS = [
    { x: 0, rx: 0.6, ry: 160, rate: 0.3, drift: 0.03, grow: 0 },
    { x: 1, rx: 0.68, ry: 180, rate: 0.16, drift: 0, grow: 0.0001 },
    { x: 0.06, rx: 0.5, ry: 140, rate: 0.55, drift: -0.02, grow: 0 },
    { x: 0.95, rx: 0.56, ry: 150, rate: 0.42, drift: 0, grow: -0.00006 },
    { x: 0, rx: 0.64, ry: 170, rate: 0.22, drift: 0.04, grow: 0.00008 },
    { x: 1, rx: 0.52, ry: 140, rate: 0.6, drift: -0.03, grow: 0 }
  ];
  // How far the first and last places sit inside the part.
  var FLY_MARGIN = 170;
  // One per this much of page, 4 to 6.
  var FLY_SPACING = 240;
  // A shown run of fireflies giving way to a new one.
  var FLIES_FADE_MS = 300;
  var light = null;
  var flyFrame = 0;
  var flyFollowing = false;

  // The fireflies down a column from the first sheet's top to the page's end. Each passes its place at the middle of
  // `viewport` as the page scrolls; `still` (reduced motion) rests each at its place.
  function flyPlan(top, left, width, height, viewport, still) {
    var range = Math.max(0, top + height - viewport);
    var n = clamp(Math.round(height / FLY_SPACING), 4, 6);
    var flies = [];
    for (var k = 0; k < n; k++) {
      var slot = FLY_SLOTS[k];
      var place = height > 2 * FLY_MARGIN ? FLY_MARGIN + ((height - 2 * FLY_MARGIN) * k) / (n - 1) : height / 2;
      // A short page holds smaller ones.
      var ry = Math.min(slot.ry, place, height - place);
      var lag = 1 - slot.rate;
      // The scroll at which it is at its place: as near the middle of the screen as the box lets it travel.
      var hi = Math.min(range, (place - ry) / lag);
      var lo = Math.max(0, range - (height - ry - place) / lag);
      var pivot = still ? 0 : clamp(lo > hi ? (lo + hi) / 2 : clamp(top + place - viewport / 2, lo, hi), 0, range);
      flies.push({
        x: Math.round(left + slot.x * width),
        y: Math.round(place - lag * pivot),
        rx: Math.round(slot.rx * width),
        ry: Math.round(ry),
        rate: slot.rate,
        drift: slot.drift,
        grow: slot.grow,
        hue: Math.round((100 * k) / (n - 1))
      });
    }
    return flies;
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  // Where a scroll of `scroll` px has moved a firefly from its rest: as fx.css's keyframes put it.
  function flyTransform(f, scroll) {
    return 'translate(' + round2(f.drift * scroll) + 'px, ' + round2((1 - f.rate) * scroll) + 'px) scale(' + Math.round((1 + f.grow * scroll) * 1e4) / 1e4 + ')';
  }

  // fx.css moves the fireflies on the scroll timeline where both of its features are there.
  function scrollDriven() {
    return typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('(animation-timeline: scroll()) and (animation-range: 0 1px)');
  }

  function writeFlies() {
    flyFrame = 0;
    if (!light || !light.part) {
      return;
    }
    var els = light.part.children;
    for (var i = 0; i < els.length && i < light.flies.length; i++) {
      els[i].style.transform = flyTransform(light.flies[i], window.scrollY);
    }
  }

  function onFlyScroll() {
    if (!flyFrame) {
      flyFrame = requestAnimationFrame(writeFlies);
    }
  }

  // The fallback: the fireflies follow the scroll by a transform written in one frame after it, while their light is
  // lit.
  function followFlies(lit) {
    var on = lit && !scrollDriven() && !reducedMotion();
    if (on === flyFollowing) {
      return;
    }
    flyFollowing = on;
    if (on) {
      window.addEventListener('scroll', onFlyScroll, { passive: true });
      // Caught up in the next frame: the scroll may have moved while they were not following.
      onFlyScroll();
    } else {
      window.removeEventListener('scroll', onFlyScroll);
      cancelAnimationFrame(flyFrame);
      flyFrame = 0;
    }
  }

  function fillFlies(part, flies) {
    while (part.firstChild) {
      part.removeChild(part.firstChild);
    }
    for (var i = 0; i < flies.length; i++) {
      var f = flies[i];
      var el = document.createElement('div');
      el.className = 'fx-fly';
      var s = el.style;
      s.left = f.x - f.rx + 'px';
      s.top = f.y - f.ry + 'px';
      s.width = 2 * f.rx + 'px';
      s.height = 2 * f.ry + 'px';
      s.setProperty('--fly-c', 'color-mix(in oklab, var(--fly-to) ' + f.hue + '%, var(--fly-from))');
      s.setProperty('--fly-dx', round2(f.drift * FLY_RANGE) + 'px');
      s.setProperty('--fly-dy', round2((1 - f.rate) * FLY_RANGE) + 'px');
      s.setProperty('--fly-k', String(1 + f.grow * FLY_RANGE));
      part.appendChild(el);
    }
  }

  // An element's layout box from the light's own origin.
  function lightBox(el, env) {
    var at = offsetIn(el, env.offsetParent);
    return { top: at[1] - env.offsetTop, left: at[0] - env.offsetLeft, width: el.offsetWidth, height: el.offsetHeight };
  }

  // Each stage's light takes the stage's box, variant and mark centre; none is left for a page with no stage.
  function placeStageLights(layer, boxes, top) {
    var parts = layer.querySelectorAll('.fx-light__stage');
    var i;
    for (i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      var stage = box.entry.stage;
      var part = parts[i] || layer.insertBefore(document.createElement('div'), layer.querySelector('.fx-light__flies'));
      var names = ['fx-light__stage'];
      for (var c = 0; c < stage.classList.length; c++) {
        if (STAGE_LIGHT.test(stage.classList[c])) {
          names.push(stage.classList[c]);
        }
      }
      if (stage.matches(FIRST_STAGE)) {
        names.push('fx-light__stage--first');
      }
      if (part.className !== names.join(' ')) {
        part.className = names.join(' ');
      }
      var variant = /(?:^| )fx-stage--(premium|stars|gift|boost)(?: |$)/.exec(stage.className);
      var s = part.style;
      s.setProperty('--fx-accent', STAGE_ACCENTS[variant ? variant[1] : 'premium']);
      if (box.entry.cy === null) {
        s.removeProperty('--fx-cy');
      } else {
        s.setProperty('--fx-cy', box.entry.cy + 'px');
      }
      s.left = box.left + 'px';
      s.width = box.width + 'px';
      s.height = box.height + 'px';
      s.top = box.top - top + 'px';
      s.removeProperty('right');
    }
    for (i = boxes.length; i < parts.length; i++) {
      layer.removeChild(parts[i]);
    }
  }

  function placeFlies(l, run, top) {
    var layer = l.layer;
    if (!run) {
      var stale = layer.querySelectorAll('.fx-light__flies');
      for (var i = 0; i < stale.length; i++) {
        layer.removeChild(stale[i]);
      }
      l.part = null;
      l.flies = [];
      l.fliesKey = '';
      return;
    }
    var key = JSON.stringify(run.flies);
    if (key !== l.fliesKey) {
      var old = l.part;
      // Fireflies whose run changes hand it over in a cross-fade, each run on a part of its own: the old run stays
      // where it is until it is out, so none jumps to its new place.
      var handOver = !!old && !!old.firstChild && typeof old.animate === 'function';
      if (!old || handOver) {
        l.part = layer.appendChild(document.createElement('div'));
        l.part.className = 'fx-light__flies';
      }
      fillFlies(l.part, run.flies);
      l.flies = run.flies;
      l.fliesKey = key;
      if (handOver) {
        var ease = 'cubic-bezier(0.2, 0.6, 0.35, 1)';
        l.part.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FLIES_FADE_MS, easing: ease });
        var out = old.animate([{ opacity: getComputedStyle(old).opacity }, { opacity: 0 }], { duration: FLIES_FADE_MS, easing: ease, fill: 'forwards' });
        // Out, it goes at once: kept, its box would hold the document past the page's end.
        out.onfinish = out.oncancel = function() {
          if (old.parentNode) {
            old.parentNode.removeChild(old);
          }
        };
      }
      // A page shown at a scroll: they start where it puts them, lit or not.
      if (!scrollDriven() && !reducedMotion()) {
        writeFlies();
      }
    }
    var s = l.part.style;
    s.left = '0px';
    s.width = run.width + 'px';
    s.height = run.height + 'px';
    s.top = run.top - top + 'px';
    s.removeProperty('right');
    s.removeProperty('bottom');
  }

  function layoutLight() {
    var l = light;
    if (!l || !l.page.isConnected) {
      return;
    }
    var env = l.env;
    var boxes = [];
    var top = 0;
    var bottom = 0;
    var i;
    for (i = 0; i < stages.length; i++) {
      if (stages[i].stage.offsetWidth) {
        var box = lightBox(stages[i].stage, env);
        box.entry = stages[i];
        boxes.push(box);
        top = Math.min(top, box.top);
        bottom = Math.max(bottom, box.top + box.height);
      }
    }
    // The fireflies run from the first sheet's top, where the stage's light ends, to the page's end, or to the
    // screen's on a page shorter than it, across the whole width: the column's edges are where they sit.
    var sheets = l.page.querySelectorAll('.fx-sheet, .neon-field');
    var sheet = null;
    for (i = 0; i < sheets.length && !sheet; i++) {
      if (sheets[i].offsetWidth) {
        sheet = lightBox(sheets[i], env);
      }
    }
    var run = null;
    if (sheet) {
      var page = lightBox(l.page, env);
      var view = document.documentElement;
      run = { top: sheet.top, height: Math.max(0, Math.max(page.top + page.height, env.offsetHeight) - sheet.top), width: view.clientWidth };
      run.flies = flyPlan(sheet.top, sheet.left, sheet.width, run.height, view.clientHeight, reducedMotion());
      top = Math.min(top, run.top);
      bottom = Math.max(bottom, run.top + run.height);
    }
    // The layer spans its own parts, so no light holds the document past its page's end.
    var s = l.layer.style;
    s.top = top + 'px';
    s.height = bottom - top + 'px';
    s.removeProperty('bottom');
    placeStageLights(l.layer, boxes, top);
    placeFlies(l, run, top);
  }

  function mountLight(root) {
    var env = root.querySelector('.fx-env');
    var page = root.querySelector('.screen');
    var layer = env && env.querySelector('.fx-light');
    if (!layer || !page) {
      return;
    }
    // One run of fireflies stands: a hand-over cut short by a new mount would leave two.
    var parts = layer.querySelectorAll('.fx-light__flies');
    for (var i = 0; i < parts.length - 1; i++) {
      layer.removeChild(parts[i]);
    }
    light = { env: env, layer: layer, page: page, part: parts.length ? parts[parts.length - 1] : null, flies: [], fliesKey: '', observer: null };
    layoutLight();
    adoptBreath(layer);
    lightSource(layer, followFlies);
    if (typeof ResizeObserver === 'function') {
      // The border box: a page's end moves with its padding too.
      light.observer = new ResizeObserver(layoutLight);
      light.observer.observe(page, { box: 'border-box' });
    }
  }

  // ===== Confetti (Telegram iOS ConfettiView), over the whole screen, once =====

  var CONFETTI_COLORS = ['#56ce6b', '#cd89d0', '#1e9aff', '#ff8724'];
  var CONFETTI_DELAYS = [0, 0.01, 0.08];
  var CONFETTI_STRIDE = 10;
  var CONFETTI_TOP = 70;
  var CONFETTI_SIDE = 40;

  function range(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  // A canvas over host, w by h CSS px, for a one-off effect; null under reduced motion or when it cannot draw.
  function effectLayer(host, className, w, h) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    if (reducedMotion() || !w || !h || !ctx) {
      return null;
    }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.className = className;
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    return { canvas: canvas, ctx: ctx, dpr: dpr };
  }

  // Clears and calls draw(dt, age), in seconds, every frame until it returns false or the canvas leaves the page.
  function playEffect(canvas, ctx, draw) {
    var start = performance.now();
    var prev = start;
    var frame = function(now) {
      var dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
      prev = now;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (draw(dt, (now - start) / 1000) && canvas.isConnected) {
        requestAnimationFrame(frame);
      } else if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
    requestAnimationFrame(frame);
  }

  function confetti(host) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var out = effectLayer(host, 'fx-confetti', w, h);
    if (!out) {
      return;
    }
    var canvas = out.canvas;
    var ctx = out.ctx;
    var dpr = out.dpr;

    var p = new Float32Array((CONFETTI_TOP + 2 * CONFETTI_SIDE) * CONFETTI_STRIDE);
    var put = function(k, image, x, y, vx, vy, mass, type) {
      p.set([x, y, vx, vy, 0, range(1, 6), mass, image % 8, type, range(0.8, 1.6)], k * CONFETTI_STRIDE);
    };
    var i;
    for (i = 0; i < CONFETTI_TOP; i++) {
      put(i, i, Math.floor(Math.random() * w), Math.floor(range(-h, 0)), 0, range(3, 5), range(40, 50), 0);
    }
    var sideY = (h * 9) / 10;
    var speed = (2400 * h) / 896;
    var angle = Math.PI / 2 + Math.atan(sideY / (w * 0.8));
    for (var side = 0; side < 2; side++) {
      var sign = side ? -1 : 1;
      var baseX = side ? w + 115 : -115;
      for (i = 0; i < CONFETTI_SIDE; i++) {
        var oa = range(0, Math.PI * 2);
        var amp = range(0, 115);
        var v = range(1.1, 1.3) * speed;
        var va = range(angle - 0.09, angle + 0.09);
        put(CONFETTI_TOP + side * CONFETTI_SIDE + i, i, baseX + Math.cos(oa) * amp, sideY + Math.sin(oa) * amp, sign * v * Math.sin(va), v * Math.cos(va), range(110, 120), i % 3);
      }
    }

    var slowdown = [0.33, NaN, NaN];
    var falling = [false, false, false];
    var steps = new Float32Array(3);
    var turbulence = new Float32Array(20);
    var time = 0;
    playEffect(canvas, ctx, function(dt) {
      var t;
      for (t = 0; t < 3; t++) {
        var local = time - CONFETTI_DELAYS[t];
        var s = local - slowdown[t];
        // Time runs at 80 % for 0.7 s once a type starts to fall, eased in over 0.05 s and out over 0.2 s.
        var ramp = s >= 0 && s <= 0.7 ? (s < 0.05 ? s / 0.05 : s >= 0.5 ? 1 - (s - 0.5) / 0.2 : 1) : 0;
        steps[t] = local < 0 ? 0 : dt * (1 - 0.2 * ramp * ramp);
      }
      time += dt;
      for (var j = 0; j < 20; j++) {
        turbulence[j] = (Math.random() * 32 - 16) * 60;
      }
      var above = false;
      for (var o = 0, index = 0; o < p.length; o += CONFETTI_STRIDE) {
        var type = p[o + 8];
        var pieceStep = steps[type];
        // Not started yet, or a frame stamped before play() began (dt 0): still above, so the effect keeps running.
        if (!pieceStep) {
          above = true;
          continue;
        }
        p[o] += p[o + 2] * pieceStep;
        p[o + 1] += p[o + 3] * pieceStep;
        p[o + 4] += p[o + 5] * pieceStep;
        p[o + 3] += 9.8 * p[o + 6] * pieceStep;
        if (p[o + 3] < 0) {
          // 0.93 per 60 Hz step, at any frame rate.
          var damping = Math.pow(0.93, pieceStep * 60);
          p[o + 2] *= damping;
          p[o + 3] *= damping;
        } else {
          p[o + 2] += turbulence[index % 20] * pieceStep;
          falling[type] = true;
        }
        index++;
        if (p[o + 1] < h + 30) {
          above = true;
        }
        var image = p[o + 7];
        var k = p[o + 9] * dpr;
        var cos = Math.cos(p[o + 4]) * k;
        var sin = Math.sin(p[o + 4]) * k;
        ctx.setTransform(cos, sin, -sin, cos, p[o] * dpr, p[o + 1] * dpr);
        ctx.fillStyle = CONFETTI_COLORS[image % 4];
        ctx.beginPath();
        // An 8 pt circle, or a 2 x 6 pt capsule.
        if (image < 4) {
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
        } else {
          ctx.arc(0, -2, 1, Math.PI, 0);
          ctx.arc(0, 2, 1, 0, Math.PI);
        }
        ctx.fill();
      }
      for (t = 1; t < 3; t++) {
        if (falling[t] && Number.isNaN(slowdown[t])) {
          slowdown[t] = Math.max(0, time - CONFETTI_DELAYS[t]);
        }
      }
      return above;
    });
  }

  // ===== The results burst (fx/burst.ts): the field's own stars fly from the mark, once =====

  var BURST_COUNT = 40;
  // Per particle: x, y, vx, vy, angle, spin, scale, life, sprite.
  var BURST_STRIDE = 9;

  function burst(host, colors) {
    var box = host.getBoundingClientRect();
    var out = effectLayer(host, 'fx-burst', box.width, box.height);
    if (!out) {
      return;
    }
    var ctx = out.ctx;
    var dpr = out.dpr;
    if (getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }
    var mark = host.querySelector(MEDIA);
    var from = mark ? mark.getBoundingClientRect() : null;
    var ox = from ? from.left + from.width / 2 - box.left : box.width / 2;
    var oy = from ? from.top + from.height / 2 - box.top : box.height * 0.4;
    // The two larger stars of the field, in its colours.
    var images = [];
    for (var c = 0; c < colors.length; c++) {
      for (var k = 1; k < SPRITE_SIZES.length; k++) {
        images.push(sprite(colors[c], SPRITE_SIZES[k], dpr));
      }
    }
    var p = new Float32Array(BURST_COUNT * BURST_STRIDE);
    for (var i = 0; i < BURST_COUNT; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = 160 + Math.pow(Math.random(), 0.6) * 640;
      p.set([ox, oy, Math.cos(a) * v, Math.sin(a) * v - 220, a, (Math.random() - 0.5) * 12, 1 + Math.random(), 0.8 + 0.4 * Math.random(), i % images.length], i * BURST_STRIDE);
    }
    playEffect(out.canvas, ctx, function(dt, age) {
      var drag = Math.exp(-1.8 * dt);
      for (var o = 0; o < p.length; o += BURST_STRIDE) {
        p[o + 2] *= drag;
        p[o + 3] = p[o + 3] * drag + 900 * dt;
        p[o] += p[o + 2] * dt;
        p[o + 1] += p[o + 3] * dt;
        p[o + 4] += p[o + 5] * dt;
        var t = age / p[o + 7];
        if (t >= 1) {
          continue;
        }
        var image = images[p[o + 8]];
        var s = p[o + 6] * (1 - 0.3 * t);
        var cos = Math.cos(p[o + 4]) * s;
        var sin = Math.sin(p[o + 4]) * s;
        ctx.globalAlpha = t < 0.55 ? 1 : (1 - t) / 0.45;
        ctx.setTransform(cos, sin, -sin, cos, p[o] * dpr, p[o + 1] * dpr);
        ctx.drawImage(image, -image.width / 2, -image.height / 2);
      }
      return age < 1.2;
    });
  }

  // ===== countUp (fx/effects.ts): a number eases up to its value, on the display's own ticks =====

  function countDuration(from, to) {
    var d = Math.abs(to - from);
    return Math.round(300 + 300 * clamp(Math.log10(Math.max(d, 1)) / 4, 0, 1));
  }

  function countUp(el, to, format, from) {
    el.classList.add('fx-count');
    if (reducedMotion() || from === to) {
      el.textContent = format(to);
      return;
    }
    var duration = countDuration(from, to);
    var start = performance.now();
    var shown = '';
    var raf = 0;
    var show = function(text) {
      if (text !== shown) {
        el.textContent = shown = text;
      }
    };
    var stop = function() {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    var step = function(now) {
      var t = clamp((now - start) / duration, 0, 1);
      show(format(Math.round(from + (to - from) * easeOutCubic(t))));
      if (now - start < duration) {
        raf = requestAnimationFrame(step);
      } else {
        stop();
      }
    };
    // Frames may never come; the final value must.
    var timer = setTimeout(function() {
      stop();
      show(format(to));
    }, duration + 100);
    step(start);
  }

  // The count ends on the server's own text; on the way it groups its digits as that text does.
  function countFormat(to, text) {
    var group = /\d(\D+)\d{3}(?!\d)/.exec(text);
    return function(v) {
      return v === to ? text : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, group ? group[1] : '');
    };
  }

  // The values last shown, by route and place on the page.
  var shownCounts = {};

  // A number counts up from the one last on screen; the first stands as the server printed it.
  function mountCounts(root) {
    var nodes = root.querySelectorAll('[data-count]');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var to = parseInt(node.getAttribute('data-count'), 10);
      if (isNaN(to)) {
        continue;
      }
      var screen = node.closest('.screen');
      var key = (screen ? screen.getAttribute('data-route') : '') + ' ' + i;
      var from = shownCounts[key];
      shownCounts[key] = to;
      if (from !== undefined && from !== to) {
        countUp(node.querySelector('.stars-text') || node, to, countFormat(to, node.getAttribute('data-count-text') || String(to)), from);
      }
    }
  }

  // ===== The entrance (fx.css fx-stagger) runs in CSS from the first paint. Content never waits on an animation: in a
  // page whose frames do not run, a hidden one, the entrance is given up, at once or when it has stalled this long =====

  var ENTRANCE_MAX_MS = 1500;
  var entranceTimer = 0;

  // The natural style is the final state, so cancelling a stalled entrance shows the content as it should be.
  function endEntrance(root) {
    var blocks = root.querySelectorAll('.fx-sheet > *');
    for (var i = 0; i < blocks.length; i++) {
      var running = typeof blocks[i].getAnimations === 'function' ? blocks[i].getAnimations() : [];
      for (var j = 0; j < running.length; j++) {
        if (running[j].animationName === 'fx-stagger' && running[j].playState !== 'finished') {
          running[j].cancel();
        }
      }
    }
  }

  function mountEntrance(root) {
    if (document.visibilityState === 'hidden') {
      endEntrance(root);
    } else {
      entranceTimer = setTimeout(function() {
        endEntrance(root);
      }, ENTRANCE_MAX_MS);
    }
  }

  // ===== The grid snap (components.css .grid-snap): text on a 2 px line step keeps what follows on the 4 px grid, an
  // ::after spacer taking up the 2 px an odd line count leaves =====

  var snapObserver = null;

  // The spacer's own height is subtracted first, so setting it never skews a reading.
  function fitToGrid(el, height) {
    var spacer = parseFloat(el.style.getPropertyValue('--snap')) || 0;
    var rest = ((height === undefined ? el.getBoundingClientRect().height : height) - spacer) % 4;
    var next = rest < 0.05 || 4 - rest < 0.05 ? 0 : 4 - rest;
    if (Math.abs(next - spacer) > 0.01) {
      el.style.setProperty('--snap', next + 'px');
    }
  }

  function mountSnaps(root) {
    if (typeof ResizeObserver === 'function') {
      snapObserver = new ResizeObserver(function(entries) {
        for (var i = 0; i < entries.length; i++) {
          var size = entries[i].borderBoxSize && entries[i].borderBoxSize[0];
          fitToGrid(entries[i].target, size ? size.blockSize : undefined);
        }
      });
    }
    var nodes = root.querySelectorAll('.grid-snap');
    for (var n = 0; n < nodes.length; n++) {
      fitToGrid(nodes[n]);
      if (snapObserver) {
        snapObserver.observe(nodes[n], { box: 'border-box' });
      }
    }
  }

  // ===== The neon aura around a screen's one primary card (Best Value plan, Popular pack; fx/light.ts neonAura).
  // In a sheet its light moves into the sheet over the card's box, under the islands and text, so it shows in the
  // gaps and never washes a neighbour; elsewhere it stays first in the card, on the card's own box and radius. =====

  function mountAura(card) {
    var light = document.createElement('span');
    light.className = 'neon-aura__light';
    light.setAttribute('aria-hidden', 'true');
    var glow = document.createElement('span');
    glow.className = 'neon-aura__glow';
    light.appendChild(glow);
    card.classList.add('neon-aura');
    card.insertBefore(light, card.firstChild);
    var entry = { card: card, light: light, sheet: null, laid: false, source: lightSource(light), observer: null, glint: null };
    if (typeof ResizeObserver === 'function') {
      entry.observer = new ResizeObserver(function() {
        placeAura(entry);
      });
      entry.observer.observe(card);
    }
    placeAura(entry);
    entry.glint = mountGlint(card);
    auras.push(entry);
    return entry;
  }

  // A light moving into the sheet takes on the entrance its card's block is playing (fx.css fx-stagger), so it never
  // shows ahead of its card.
  function followEntrance(light, card, sheet) {
    var block = card;
    while (block && block.parentNode !== sheet) {
      block = block.parentNode;
    }
    var running = block && typeof block.getAnimations === 'function' ? block.getAnimations() : [];
    for (var i = 0; i < running.length; i++) {
      var effect = running[i].effect;
      if (effect && effect.getKeyframes && effect.target === block && running[i].playState !== 'finished' && running[i].currentTime !== null) {
        var copy = light.animate(effect.getKeyframes(), effect.getTiming());
        // On the block's own start where it has one, so the two move as one from the light's first frame.
        if (typeof running[i].startTime === 'number') {
          copy.startTime = running[i].startTime;
        } else {
          copy.currentTime = running[i].currentTime;
        }
      }
    }
  }

  function placeAura(entry) {
    var card = entry.card;
    var light = entry.light;
    var sheet = card.isConnected ? card.closest('.fx-sheet') : null;
    if (!sheet) {
      return;
    }
    if (entry.sheet !== sheet) {
      if (entry.observer) {
        entry.observer.observe(sheet);
      }
      entry.sheet = sheet;
    }
    if (light.parentNode !== sheet) {
      sheet.insertBefore(light, sheet.firstChild);
      followEntrance(light, card, sheet);
    }
    light.hidden = !card.offsetWidth;
    // Observers call back before the frame paints: a card laid out anew lights here, not a frame late.
    if (!light.hidden && !entry.laid) {
      lightNear(entry.source, card.getBoundingClientRect());
    }
    entry.laid = !light.hidden;
    // The card's box and shape: the halos are its outer shadows (fx.css), spent within the gap around it.
    var at = offsetIn(card, sheet);
    var style = light.style;
    style.left = at[0] + 'px';
    style.top = at[1] + 'px';
    style.width = card.offsetWidth + 'px';
    style.height = card.offsetHeight + 'px';
    // Best Value's colours run to the end of its ring, and out of the card the light needs the card's radius.
    var cs = getComputedStyle(card);
    style.setProperty('--glow-from', cs.getPropertyValue('--glow-from').trim());
    style.setProperty('--glow-to', cs.getPropertyValue('--glow-to').trim());
    style.setProperty('--aura-radius', cs.borderTopLeftRadius);
  }

  // ===== Best Value's glint (design.md §11.9): once a breath, at its peak, the tab's sparkle flares and one light
  // leaves it, runs clockwise round the card's ring and comes back to be spent in it. Lit like any source. =====

  // The glint within one breath. The sparkle's flare is over `flare` ms from the peak; at `start` the light leaves it
  // and rounds the ring in `loop` ms, its pace easing from 1 + `ease` of the mean to 1 - `ease`. Along the ring the
  // light rises over `front` px to its peak and decays behind it by e every `tail` of the ring's length, an afterglow,
  // cut `reach` tails back; its core is white for `hot` px and down to `warm` of that from `head` px on, sooner where
  // the corners are tight. A corner's light keeps `slack` px clear of its ends.
  var GLINT = { flare: 650, start: 200, loop: 1800, ease: 0.3, front: 10, tail: 0.08, reach: 4.5, hot: 6, head: 36, warm: 0.4, slack: 2 };
  // The run's keyframes stand a frame apart at 60 Hz, the same for every stretch of the ring, so that between any two
  // all of them move as one.
  var GLINT_STEP = 1000 / 60;
  // The ring as the light meets it from the sparkle: a side by the way the light runs along it and the way across it
  // from outside (CSS degrees), a corner by the quarter turn it starts at.
  var GLINT_PARTS = [
    { way: 90, across: 180 },
    { turn: 0 },
    { way: 180, across: 270 },
    { turn: 1 },
    { way: 270, across: 0 },
    { turn: 2 },
    { way: 0, across: 90 },
    { turn: 3 },
    { way: 90, across: 180 }
  ];
  // The sparkle swells as it flares; its flare is a soft light round it.
  var GLINT_SPARK = [
    { offset: 0, transform: 'scale(1)', easing: 'ease-out' },
    { offset: 150 / BREATH_MS, transform: 'scale(1.4)', easing: 'ease-in-out' },
    { offset: 500 / BREATH_MS, transform: 'scale(1)' },
    { offset: 1, transform: 'scale(1)' }
  ];
  var GLINT_FLARE = [
    { offset: 0, opacity: 0, transform: 'scale(0.4)', easing: 'ease-out' },
    { offset: 150 / BREATH_MS, opacity: 1, transform: 'scale(1)', easing: 'ease-in' },
    { offset: GLINT.flare / BREATH_MS, opacity: 0, transform: 'scale(1.2)' },
    { offset: 1, opacity: 0, transform: 'scale(1.2)' }
  ];

  // The light's strength `u` px behind its peak, ahead of it below zero, its tail decaying by e every `tail` px.
  function glintGlow(u, tail) {
    if (u >= 0) {
      return u < GLINT.reach * tail ? Math.exp(-u / tail) : 0;
    }
    var t = Math.min(1, -u / GLINT.front);
    return Math.pow(1 - t * t, 2);
  }

  // The white of its core there, as a share of the head's: whole for GLINT.hot px, the tail's share from `head` px on.
  function glintCore(u, head) {
    var t = clamp((u - GLINT.hot) / (head - GLINT.hot), 0, 1);
    return GLINT.warm + (1 - GLINT.warm) * Math.pow(1 - t * t, 2);
  }

  // `strength` along the light as the stops of a mask's gradient (components.css), from `far` px behind the peak to
  // the front, `scale` units to a px. A stop stands every quarter of the front, every 4 px of the `head` and every
  // fifth of the `tail` behind it, where the gradient's straight lines keep within 1 % of the curves.
  function glintStops(far, head, tail, strength, scale, unit) {
    var at = [];
    var u;
    for (u = 4; u > 0; u--) {
      at.push((-GLINT.front * u) / 4);
    }
    for (u = 0; u < Math.min(head, far); u += 4) {
      at.push(u);
    }
    for (u = head; u < far; u += tail / 5) {
      at.push(u);
    }
    at.push(far);
    return at.reverse().map(function(v) {
      return 'rgba(0, 0, 0, ' + strength(v).toFixed(3) + ') ' + ((far - v) * scale).toFixed(2) + unit;
    }).join(', ');
  }

  // The light's peak `ms` after its front left the sparkle, in px round a ring `length` long. Past the lap it keeps
  // its last pace, while the sparkle takes the tail in.
  function glintAt(ms, length) {
    var x = ms / GLINT.loop;
    var lap = x < 1 ? x + (GLINT.ease / Math.PI) * Math.sin(Math.PI * x) : 1 + (1 - GLINT.ease) * (x - 1);
    return lap * length - GLINT.front;
  }

  // A side's run: how far the light's front is into it at each step, the side `length` px from `from` px round the
  // ring and the light `beam` px long. Only the steps of its passage, with the one before the front comes in and the
  // one after the tail's end is out, so it enters and leaves at the run's pace, not from a stand.
  function glintSide(times, at, from, length, beam) {
    var steps = [];
    var into = function(i) {
      return at[i] + GLINT.front - from;
    };
    for (var i = 0; i < at.length; i++) {
      var comes = i + 1 === at.length || into(i + 1) > 0;
      var left = i > 0 && into(i - 1) >= length + beam;
      if (comes && !left) {
        steps.push({ offset: (GLINT.start + times[i]) / BREATH_MS, into: into(i) });
      }
    }
    return steps;
  }

  // The keyframes that move an element `dx`, `dy` for every px of a side's `steps`: out of sight before the side's
  // start until the light comes, and `gone` px on, past its end, once it has left.
  function glintMoves(steps, dx, dy, gone) {
    var frame = function(offset, into) {
      return { offset: offset, transform: 'translate(' + (dx * into).toFixed(2) + 'px, ' + (dy * into).toFixed(2) + 'px)' };
    };
    var frames = [frame(0, 0)];
    for (var i = 0; i < steps.length; i++) {
      frames.push(frame(steps[i].offset, steps[i].into));
    }
    frames.push(frame(1, gone));
    return frames;
  }

  // A corner's keyframes, the corner `quarter` px long from `from` px round the ring. Its light is a conic gradient
  // (components.css) that turns with the run, `deg` degrees to a px: the peak stands `peak` degrees round it and its
  // last quarter is clear, so the corner is dark as the front comes. A gradient holds `far` px of the tail, less than
  // the tail is long: there the turning stops, and what the corner shows fades as the tail does, by e every `tail` px,
  // which for an afterglow is the same picture.
  function glintTurn(times, at, from, quarter, turn, tail, deg, peak, far) {
    var park = from - GLINT.front - GLINT.slack;
    var hold = from + far - GLINT.slack;
    var frame = function(ms, s, opacity) {
      return {
        offset: (GLINT.start + ms) / BREATH_MS,
        transform: 'rotate(' + (turn * 90 + (clamp(s, park, hold) - from) * deg - peak).toFixed(3) + 'deg)',
        opacity: Number(opacity.toFixed(4))
      };
    };
    var frames = [frame(-GLINT.start, park, 0)];
    for (var i = 0; i < at.length; i++) {
      var s = at[i];
      if (s <= park) {
        // Lit a step before the front comes, while the corner still shows the gradient's clear quarter.
        if (i + 1 < at.length && at[i + 1] > park) {
          frames.push(frame(times[i], s, 1));
        }
        continue;
      }
      // The turning starts and stops between two steps: a keyframe at each moment keeps it on the run's pace.
      for (var edge = 0; edge < 2; edge++) {
        var to = edge ? hold : park;
        if (i && at[i - 1] < to && s > to) {
          frames.push(frame(times[i - 1] + ((to - at[i - 1]) / (s - at[i - 1])) * (times[i] - times[i - 1]), to, 1));
        }
      }
      var gone = s - from - quarter >= GLINT.reach * tail;
      frames.push(frame(times[i], s, gone ? 0 : Math.min(1, Math.exp((hold - s) / tail))));
      if (gone) {
        break;
      }
    }
    frames.push(frame(BREATH_MS - GLINT.start, hold, 0));
    return frames;
  }

  // `el`'s box in the px of `card`, itself `width` px wide: a press or an entrance scales or moves both, not one
  // against the other.
  function boxWithin(card, el, width) {
    var c = card.getBoundingClientRect();
    var e = el.getBoundingClientRect();
    var k = c.width ? width / c.width : 1;
    return { left: (e.left - c.left) * k, top: (e.top - c.top) * k, width: e.width * k, height: e.height * k };
  }

  function mountGlint(card) {
    var tab = card.querySelector(':scope > .plan-tab');
    var spark = tab && tab.querySelector('.plan-tab-spark');
    var flare = tab && tab.querySelector('.plan-tab-flare');
    if (!tab || !spark || !flare) {
      return null;
    }
    var glint = document.createElement('span');
    glint.className = 'plan-glint';
    glint.setAttribute('aria-hidden', 'true');
    var parts = [];
    for (var k = 0; k < GLINT_PARTS.length; k++) {
      var side = GLINT_PARTS[k].turn === undefined;
      var part = document.createElement('span');
      var beam = document.createElement('span');
      var hue = null;
      // The ring's end colour holds from its top right corner to its bottom right one.
      part.className = 'plan-glint-part' + (side ? '' : ' is-turn') + (k > 0 && k < 4 ? ' is-end' : '');
      beam.className = 'plan-glint-beam';
      part.appendChild(beam);
      if (side) {
        part.style.setProperty('--glint-way', GLINT_PARTS[k].way + 'deg');
        part.style.setProperty('--glint-across', GLINT_PARTS[k].across + 'deg');
        if (GLINT_PARTS[k].way % 180) {
          // Along the top and the bottom the ring's colours change under the light: they lie in it, moved against it.
          hue = document.createElement('span');
          hue.className = 'plan-glint-hue';
          beam.appendChild(hue);
        }
      }
      glint.appendChild(part);
      parts.push({ part: part, beam: beam, hue: hue });
    }
    card.insertBefore(glint, tab);
    // The light's way out of the tab: over the fill from the sparkle to the tab's end, where the ring's light takes
    // over, so the run is seen to leave the tab.
    var exit = document.createElement('span');
    var ray = document.createElement('span');
    exit.className = 'plan-tab-run';
    exit.setAttribute('aria-hidden', 'true');
    ray.className = 'plan-tab-ray';
    exit.appendChild(ray);
    tab.insertBefore(exit, tab.firstChild);
    var running = [];
    var lit = false;
    // The card's and the tab's sizes the run is laid out for.
    var laid = '';
    var sizes = function() {
      return card.offsetWidth + ' ' + card.offsetHeight + ' ' + tab.offsetWidth + ' ' + tab.offsetHeight;
    };
    var place = function(el, left, top, width, height) {
      el.style.left = left.toFixed(2) + 'px';
      el.style.top = top.toFixed(2) + 'px';
      el.style.width = width.toFixed(2) + 'px';
      el.style.height = height.toFixed(2) + 'px';
    };
    var stop = function() {
      while (running.length) {
        running.pop().cancel();
      }
    };
    var start = function() {
      stop();
      if (!lit || !card.isConnected || !card.offsetWidth || typeof glint.animate !== 'function') {
        return;
      }
      laid = sizes();
      var cs = getComputedStyle(card);
      var own = getComputedStyle(glint);
      // The layer lies `out` px outside the card all round (components.css): its size gives the card's to the
      // fraction of a px, whatever transform the card is under.
      var out = -parseFloat(own.left) || 0;
      var width = parseFloat(own.width) - 2 * out;
      var height = parseFloat(own.height) - 2 * out;
      var ring = parseFloat(cs.getPropertyValue('--best-ring')) || 2;
      var radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, width / 2, height / 2);
      var band = out + ring;
      var s = boxWithin(card, spark, width);
      var t = boxWithin(card, tab, width);
      // Where the sparkle pours its light into the top edge.
      var from = clamp(s.left + s.width / 2, radius, width - radius);
      // The ring's centre line turns a corner on a radius of `arc` px, `quarter` px of the ring.
      var arc = Math.max(1, radius - ring / 2);
      var quarter = (Math.PI * arc) / 2;
      var lengths = [width - radius - from, quarter, height - 2 * radius, quarter, width - 2 * radius, quarter, height - 2 * radius, quarter, from - radius];
      var length = 2 * (width + height - 4 * radius) + 4 * quarter;
      var tail = GLINT.tail * length;
      var reach = GLINT.reach * tail;
      var light = reach + GLINT.front;
      var deg = 180 / (Math.PI * arc);
      var peak = 270 - (GLINT.front + 2 * GLINT.slack) * deg;
      var far = peak / deg;
      var style = glint.style;
      style.setProperty('--glint-radius', radius + 'px');
      style.setProperty('--glint-tab', (out + t.left).toFixed(2) + 'px ' + (out + t.top).toFixed(2) + 'px / ' + t.width.toFixed(2) + 'px ' + t.height.toFixed(2) + 'px');
      style.setProperty('--glint-spark', (s.left + s.width / 2 - t.left).toFixed(2) + 'px');
      // A corner stops turning with `far` px of the light behind the peak in it (glintTurn): the core's white has
      // settled by then, on a tight corner sooner than GLINT.head.
      var head = Math.max(GLINT.hot + 4, Math.min(GLINT.head, far - GLINT.slack - quarter));
      var glow = function(u) {
        return glintGlow(u, tail);
      };
      var core = function(u) {
        return glintCore(u, head);
      };
      style.setProperty('--glint-run', glintStops(reach, head, tail, glow, 1, 'px'));
      style.setProperty('--glint-run-core', glintStops(reach, head, tail, core, 1, 'px'));
      style.setProperty('--glint-arc', glintStops(far, head, tail, glow, deg, 'deg'));
      style.setProperty('--glint-arc-core', glintStops(far, head, tail, core, deg, 'deg'));
      // The run ends as the tail's end reaches the sparkle.
      var end = GLINT.loop * (1 + light / (length * (1 - GLINT.ease)));
      var times = [];
      var at = [];
      for (var ms = 0; ms < end; ms += GLINT_STEP) {
        times.push(ms);
        at.push(glintAt(ms, length));
      }
      times.push(end);
      at.push(glintAt(end, length));
      var timing = { duration: BREATH_MS, iterations: Infinity, delay: parseFloat(breathDelay(breathNow())) };
      var along = 0;
      for (var i = 0; i < parts.length; i++) {
        var def = GLINT_PARTS[i];
        var item = parts[i];
        if (def.turn === undefined) {
          var flat = def.way % 180 !== 0;
          var dx = flat ? (def.way === 90 ? 1 : -1) : 0;
          var dy = flat ? 0 : (def.way === 180 ? 1 : -1);
          // The side's stretch of the band, in the card's px, and its light, its own length before the side's start.
          var x = flat ? (i ? radius : from) : (dy > 0 ? width - ring : -out);
          var y = flat ? (dx > 0 ? -out : height - ring) : radius;
          var before = dx + dy > 0 ? -light : lengths[i];
          place(item.part, out + x, out + y, flat ? lengths[i] : band, flat ? band : lengths[i]);
          place(item.beam, flat ? before : 0, flat ? 0 : before, flat ? light : band, flat ? band : light);
          // The peak within the light: `front` px behind its front, on the ring's centre line.
          var on = dx + dy > 0 ? light - GLINT.front : GLINT.front;
          var mid = (dx > 0 || dy < 0 ? out : 0) + ring / 2;
          item.part.style.setProperty('--glint-bloom', (flat ? on : mid).toFixed(2) + 'px ' + (flat ? mid : on).toFixed(2) + 'px');
          var steps = glintSide(times, at, along, lengths[i], light);
          running.push(item.beam.animate(glintMoves(steps, dx, dy, lengths[i] + light), timing));
          if (item.hue) {
            // The card's width of colours over the gap, where the card's left edge is.
            place(item.hue, -x - before, dx > 0 ? 0 : ring, width, out);
            running.push(item.hue.animate(glintMoves(steps, -dx, -dy, lengths[i] + light), timing));
          }
        } else {
          // The corner's square of the band, and the gradient twice as large, centred where the corner turns.
          var east = def.turn < 2;
          var south = def.turn === 1 || def.turn === 2;
          var size = radius + out;
          place(item.part, east ? out + width - radius : 0, south ? out + height - radius : 0, size, size);
          place(item.beam, east ? -size : 0, south ? -size : 0, 2 * size, 2 * size);
          item.part.style.setProperty('--glint-bloom', (size + arc * Math.sin((peak * Math.PI) / 180)).toFixed(2) + 'px ' + (size - arc * Math.cos((peak * Math.PI) / 180)).toFixed(2) + 'px');
          running.push(item.beam.animate(glintTurn(times, at, along, quarter, def.turn, tail, deg, peak, far), timing));
        }
        along += lengths[i];
      }
      // The tab's stretch starts where the ring's first one does and keeps its steps, so the two move as one.
      var inTab = s.left + s.width / 2 - t.left;
      exit.style.setProperty('--glint-spark', inTab.toFixed(2) + 'px');
      exit.style.setProperty('--glint-run', glintStops(reach, head, tail, glow, 1, 'px'));
      exit.style.setProperty('--glint-bloom', (light - GLINT.front).toFixed(2) + 'px 50%');
      exit.style.setProperty('--glint-hue', t.left + t.width / 2 < width / 2 ? 'var(--glow-from)' : 'var(--glow-to)');
      place(ray, inTab - light, 0, light, t.height);
      running.push(ray.animate(glintMoves(glintSide(times, at, 0, t.width - inTab, light), 1, 0, t.width - inTab + light), timing));
      running.push(spark.animate(GLINT_SPARK, timing), flare.animate(GLINT_FLARE, timing));
    };
    // A new size moves the ring, a new tab its reach: the run is laid out again where the shared clock stands.
    var resize = null;
    if (typeof ResizeObserver === 'function') {
      resize = new ResizeObserver(function() {
        if (running.length && sizes() !== laid) {
          start();
        }
      });
      resize.observe(card);
      resize.observe(tab);
    }
    lightSource(glint, function(on) {
      lit = on;
      start();
    });
    return {
      destroy: function() {
        if (resize) {
          resize.disconnect();
        }
        stop();
        if (glint.parentNode) {
          glint.parentNode.removeChild(glint);
        }
        if (exit.parentNode) {
          exit.parentNode.removeChild(exit);
        }
      }
    };
  }

  // ===== Snap-scrolling carousels with page dots, auto-advancing until touched (fx/carousel.ts) =====

  var CAROUSEL_AUTO_MS = 4000;
  var carousels = [];

  function nearestIndex(items, track) {
    var mid = track.getBoundingClientRect();
    var center = mid.left + mid.width / 2;
    var best = 0;
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      var c = r.left + r.width / 2;
      var rb = items[best].getBoundingClientRect();
      if (Math.abs(c - center) < Math.abs(rb.left + rb.width / 2 - center)) {
        best = i;
      }
    }
    return best;
  }

  function mountCarousel(el) {
    var track = el.querySelector('.fx-carousel__track');
    var dots = el.querySelector('.fx-carousel__dots');
    if (!track || !dots) {
      return null;
    }
    var items = [];
    for (var i = 0; i < track.children.length; i++) {
      items.push(track.children[i]);
    }
    var index = -1;
    var timer = null;
    var frame = 0;
    var visible = true;
    var entry = { el: el, dead: false };
    var mark = function(i) {
      if (dots.children[index]) {
        dots.children[index].classList.remove('is-on');
      }
      index = i;
      if (dots.children[index]) {
        dots.children[index].classList.add('is-on');
      }
    };
    var current = function() {
      return nearestIndex(items, track);
    };
    // scrollBy moves the same way in both reading directions; scrollLeft does not.
    var go = function(i) {
      var item = items[i];
      if (!item) {
        return;
      }
      var ir = item.getBoundingClientRect();
      var tr = track.getBoundingClientRect();
      track.scrollBy({ left: (ir.left + ir.width / 2) - (tr.left + tr.width / 2), behavior: reducedMotion() ? 'auto' : 'smooth' });
    };
    var schedule = function() {
      if (entry.dead || reducedMotion() || items.length < 2) {
        return;
      }
      timer = setTimeout(function() {
        if (visible && document.visibilityState !== 'hidden') {
          go((current() + 1) % items.length);
        }
        schedule();
      }, CAROUSEL_AUTO_MS);
    };
    var stop = function() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    track.addEventListener('scroll', function() {
      if (!frame) {
        frame = requestAnimationFrame(function() {
          frame = 0;
          mark(current());
        });
      }
    }, { passive: true });
    for (var t = 0; t < 3; t++) {
      el.addEventListener(['pointerdown', 'wheel', 'focusin'][t], function() {
        stop();
      }, { passive: true });
    }
    track.addEventListener('keydown', function(e) {
      var forward = getComputedStyle(el).direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      var back = forward === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
      var n = items.length;
      var to = -1;
      if (e.key === 'Home') {
        to = 0;
      } else if (e.key === 'End') {
        to = n - 1;
      } else if (e.key === forward) {
        to = Math.min(n - 1, current() + 1);
      } else if (e.key === back) {
        to = Math.max(0, current() - 1);
      }
      if (to < 0) {
        return;
      }
      stop();
      e.preventDefault();
      go(to);
    });
    var io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(function(entries) {
        visible = !!entries[entries.length - 1].isIntersecting;
      });
      io.observe(el);
    }
    entry.stop = stop;
    entry.io = io;
    carousels.push(entry);
    mark(0);
    schedule();
    return entry;
  }

  // ===== The shared frame loop =====

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!gate(now)) {
      return;
    }
    var dt = last ? clamp(now - last, 0, 50) : 16;
    last = now;
    for (var i = 0; i < stages.length; i++) {
      var entry = stages[i];
      if (entry.field && entry.seen) {
        entry.field.frame(dt, entry.mark ? parseFloat(entry.mark.getAttribute('data-spin') || 0) : 0);
      }
    }
  }

  // The fields draw only while one is on screen, the page visible, Telegram has the app active and motion is allowed.
  function running() {
    if (!appActive || document.visibilityState === 'hidden' || reducedMotion()) {
      return false;
    }
    for (var i = 0; i < stages.length; i++) {
      if (stages[i].field && stages[i].seen) {
        return true;
      }
    }
    return false;
  }

  function update() {
    if (running() && !raf) {
      gate = frameGate();
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!running() && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
  }

  // The page went to the background or came back, or Telegram minimised or restored the app.
  function refresh() {
    refreshLight();
    update();
  }

  function onActive() {
    appActive = true;
    refresh();
  }

  function onInactive() {
    appActive = false;
    refresh();
  }

  // Reduce Motion switched: the loops stop and the still frames are drawn, or they start again.
  function onMotion() {
    syncMotion();
    for (var i = 0; i < stages.length; i++) {
      layoutStage(stages[i]);
    }
    layoutLight();
    refresh();
  }

  function mount(root) {
    destroy();
    syncMotion();
    var app = window.Telegram && window.Telegram.WebApp;
    appActive = !app || app.isActive !== false;
    nearObserver = watchNear();
    mountEntrance(root);
    // Before the rest, so the page is on its grid when anything is measured from it.
    mountSnaps(root);
    var found = root.querySelectorAll('.fx-stage');
    for (var i = 0; i < found.length; i++) {
      mountStage(found[i]);
    }
    // A field no stage of this page took on has nowhere to go.
    dropFields();
    mountLight(root);
    var glows = root.querySelectorAll('.cta-glow');
    for (var g = 0; g < glows.length; g++) {
      mountCta(glows[g]);
    }
    var cards = root.querySelectorAll('[data-aura]');
    for (var j = 0; j < cards.length; j++) {
      mountAura(cards[j]);
    }
    var carouselsFound = root.querySelectorAll('.fx-carousel');
    for (var c = 0; c < carouselsFound.length; c++) {
      mountCarousel(carouselsFound[c]);
    }
    mountCounts(root);
    if (!resizeHandler) {
      resizeHandler = function() {
        for (var i = 0; i < stages.length; i++) {
          layoutStage(stages[i]);
        }
        layoutLight();
        for (var j = 0; j < auras.length; j++) {
          placeAura(auras[j]);
        }
      };
      window.addEventListener('resize', resizeHandler);
      document.addEventListener('visibilitychange', refresh);
      if (app && app.onEvent) {
        app.onEvent('activated', onActive);
        app.onEvent('deactivated', onInactive);
      }
    }
    // A paid result: the field's stars burst from the mark and confetti falls over the screen.
    var celebrate = root.querySelector('.js-celebrate');
    if (celebrate) {
      var host = celebrate.closest('.result-screen') || celebrate.parentNode;
      if (host) {
        var golden = host.querySelector('.fx-stage--stars, .pm-mark--stars');
        burst(host, golden ? FIELD_COLORS.stars : FIELD_COLORS.premium);
        confetti(host);
      }
    }
    // Every source near the screen lights in this frame: the observer reports only after it paints.
    for (var s = 0; s < sources.length; s++) {
      lightNear(sources[s]);
    }
    update();
    launched = true;
  }

  function destroy() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
    var left = [];
    for (var i = 0; i < stages.length; i++) {
      var entry = stages[i];
      for (var o = 0; o < entry.observers.length; o++) {
        entry.observers[o].disconnect();
      }
      if (entry.field) {
        left.push(entry.field);
      }
    }
    stages = [];
    if (left.length) {
      dropFields();
      heldFields = left;
      heldTimer = setTimeout(dropFields, FIELD_HOLD_MS);
    }
    if (!breathHeld && breathes()) {
      breathHeld = performance.now();
      // What was lit since starts with this frame: the clock moves on from here.
      requestAnimationFrame(function(now) {
        breathOrigin += now - breathHeld;
        breathHeld = 0;
      });
    }
    while (sources.length) {
      dropSource(sources[0]);
    }
    if (nearObserver) {
      nearObserver.disconnect();
      nearObserver = null;
    }
    if (light && light.observer) {
      light.observer.disconnect();
    }
    light = null;
    clearTimeout(entranceTimer);
    if (snapObserver) {
      snapObserver.disconnect();
      snapObserver = null;
    }
    for (var j = 0; j < auras.length; j++) {
      var aura = auras[j];
      if (aura.observer) {
        aura.observer.disconnect();
      }
      if (aura.glint) {
        aura.glint.destroy();
      }
      if (aura.light.parentNode) {
        aura.light.parentNode.removeChild(aura.light);
      }
      aura.card.classList.remove('neon-aura');
    }
    auras = [];
    for (var k = 0; k < carousels.length; k++) {
      carousels[k].dead = true;
      if (carousels[k].stop) {
        carousels[k].stop();
      }
      if (carousels[k].io) {
        carousels[k].io.disconnect();
      }
    }
    carousels = [];
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      document.removeEventListener('visibilitychange', refresh);
      var app = window.Telegram && window.Telegram.WebApp;
      if (app && app.offEvent) {
        app.offEvent('activated', onActive);
        app.offEvent('deactivated', onInactive);
      }
      resizeHandler = null;
    }
  }

  // Reduce Motion is followed from the script's first run and as it changes, whether or not a page is mounted.
  syncMotion();
  if (typeof matchMedia === 'function') {
    var motionWatch = matchMedia('(prefers-reduced-motion: reduce)');
    if (motionWatch.addEventListener) {
      motionWatch.addEventListener('change', onMotion);
    }
  }

  return {
    mount: mount,
    destroy: destroy,
    confetti: confetti
  };
})();
