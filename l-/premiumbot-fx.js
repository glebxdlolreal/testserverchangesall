/* Premium Bot Mini App fx runtime: Telegram's StarParticlesView particle field (src/fx/particles.ts, stage.ts), the
   page's light field (src/fx/field.ts), iOS success confetti and the results burst (src/fx/confetti.ts, burst.ts),
   the light on the best plan and the pay button's glint, the wall of what a payment unlocked,
   in plain classic JavaScript, no build step. */
window.PremiumFx = (function() {
  'use strict';

  var stages = [];
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

  // Premium: white with the 3D star's own blue and violet (premiumbot-3d.js GRADIENT.star). A particle takes any entry
  // with equal chance, so the repeats are the mix: three in seven white, three blue, one violet. A paid Stars result
  // has the golds with two whites in five among them.
  var FIELD_COLORS = {
    stars: ['#fdd219', '#f9b004', '#f09903'],
    starsPaid: ['#fdd219', '#f9b004', '#f09903', '#ffffff', '#ffffff'],
    premium: ['#ffffff', '#ffffff', '#ffffff', '#55a5ff', '#55a5ff', '#55a5ff', '#a767ff']
  };
  var SPRITE_SIZES = [4, 12, 10];
  var STRIDE = 8;
  // The field gathers round the mark, in mark sizes from its centre: a particle is born within REACH, more often near
  // the mark than far from it (GATHER), and has faded out by FAR, its longest drift further out, which is inside the
  // edges of a 360 px screen around the 120 px mark.
  var REACH = 1.2;
  var FAR = 1.45;
  var GATHER = 1.7;
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
    // No other particle within 12 px either way: particles born side by side read as one smudge.
    var apart = function(o, x, y) {
      for (var j = 0; j < n * STRIDE; j += STRIDE) {
        if (j !== o && Math.abs(p[j] - x) < 12 && Math.abs(p[j + 1] - y) < 12) {
          return false;
        }
      }
      return true;
    };
    var spawn = function(o) {
      var x = 0;
      var y = 0;
      // A clipped canvas loses spawns past its edge, and a crowded spot makes a clump: a few tries keep the count on
      // screen and the field even.
      for (var tries = 0; tries < 6; tries++) {
        var a = rand() * Math.PI * 2;
        var c = Math.cos(a);
        var s = Math.sin(a);
        // Nothing inside the mark's circle once y is squashed.
        var near = (0.55 * mark) / Math.hypot(c, 0.6 * s);
        var r = near + Math.pow(rand(), GATHER) * Math.max(0, Math.min(w / 2, REACH * mark) - near);
        x = r * c;
        y = 0.6 * r * s;
        if (inside(x, y) && apart(o, x, y)) {
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
      var far = FAR * mark;
      for (var o = 0; o < n * STRIDE; o += STRIDE) {
        var x = cx + p[o];
        var y = cy + p[o + 1];
        var age = p[o + 4];
        var rest = p[o + 5] - age;
        var out = rest < 200 ? clamp(1 - rest / 150, 0, 1) : 0;
        // Full at the mark's circle and gone at FAR, whichever way the particle lies. Distances are spawn()'s, with y
        // unsquashed by 0.6, where the mark's circle is `edge` away in this particle's direction.
        var d = Math.hypot(p[o], p[o + 1] / 0.6);
        var edge = (0.55 * mark * d) / (Math.hypot(p[o], p[o + 1]) || 1);
        var fade = clamp((far - d) / (far - edge), 0, 1);
        // The top 12 px stay empty: under a header, a particle on the page's first rows reads as a speck on its edge.
        var alpha = p[o + 6] * (1 - out) * fade * Math.min(1, (y - 12) / 12, (h - y) / 12, x / 24, (w - x) / 24);
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
    return Math.max(1, Math.round((m ? (m[1] === 'HIGH' ? 60 : m[1] === 'AVERAGE' ? 40 : 20) : 50) * density));
  }

  // ===== Stages (fx/stage.ts): a hero's particle field and, on a full-screen stage, its centred content =====

  // The field keeps its look around the 88 px mark of fx.css .fx-stage--compact by scaling with the mark's area.
  var COMPACT_DENSITY = Math.pow(88 / 120, 2);
  // Reduced motion's one still frame of the field.
  var STILL_COUNT = 40;
  // What a stage centres by its box, not its contents: the mark and hero media.
  var MEDIA = '.pm-mark, .hero-media, .result-media';
  // Telegram's own colour art for a moment or a wait floats in the field; a plain glyph gets none.
  var HERO_ART = '[data-lottie-url*="premium-gift"], [data-lottie-url*="giveaway-results"], [data-lottie-url*="/empty."]';
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
    // A plain glyph, such as an error's sign, gets neither field nor glow (fx.css .fx-stage--bare).
    stage.classList.toggle('fx-stage--bare', !anchor);
    if (anchor) {
      // The mark's own gradient: gold around the golden star, the Premium star's colours elsewhere.
      var golden = anchor.classList.contains('pm-mark--stars') || stage.classList.contains('fx-stage--stars');
      var density = stage.classList.contains('fx-stage--compact') ? COMPACT_DENSITY : 1;
      var colors = !golden ? FIELD_COLORS.premium : stage.classList.contains('fx-stage--result') ? FIELD_COLORS.starsPaid : FIELD_COLORS.stars;
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
      // Round a mark larger than the paywall's the field keeps the paywall's reach: by the mark's size it would run to
      // the screen's edges and thin out to dust.
      entry.field.layout(stage.offsetWidth, Math.max(0, Math.min(stage.offsetHeight, cy + size) - top), cx, cy - top, Math.min(size, 120), dpr);
      if (reducedMotion()) {
        entry.field.still(STILL_COUNT);
      }
    }
  }

  // ===== The light field (fx/field.ts): one layer behind the page with its stages' light. The helper prints it with
  // approximate geometry, which stands until this lays it out from the page. =====

  // The stage classes the light reads (fx.css); layout ones such as --fill stay with the stage.
  var STAGE_LIGHT = /^fx-stage--(dark|premium|stars|gift|boost|compact|bare|result)$/;
  // Each variant's one hue, the stage's glow, as an "r g b" triplet for fx.css --fx-accent.
  var STAGE_ACCENTS = { premium: '92 72 255', stars: '249 176 4', gift: '92 72 255', boost: '90 111 246' };
  // fx.css: the first stage on a screen, whose light runs up under the safe areas.
  var FIRST_STAGE = '.screen > :first-child > .fx-stage:first-child, .screen > .fx-stage:first-child, .screen-banner:empty + * > .fx-stage:first-child, .screen-banner:empty + .fx-stage';
  var light = null;

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
    // Under the stages the layer runs on from the first sheet's top to the page's end, or to the screen's on a page
    // shorter than it.
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
      top = Math.min(top, run.top);
      bottom = Math.max(bottom, run.top + run.height);
    }
    // The layer spans its own parts, so no light holds the document past its page's end.
    var s = l.layer.style;
    s.top = top + 'px';
    s.height = bottom - top + 'px';
    s.removeProperty('bottom');
    placeStageLights(l.layer, boxes, top);
  }

  function mountLight(root) {
    var env = root.querySelector('.fx-env');
    var page = root.querySelector('.screen');
    var layer = env && env.querySelector('.fx-light');
    if (!layer || !page) {
      return;
    }
    light = { env: env, layer: layer, page: page, observer: null };
    layoutLight();
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

  // On a paid result the burst follows the mark's pop (fx.css, the state screens' entrance), which has all but landed
  // by then.
  var BURST_AFTER_MS = 160;
  var burstTimer = 0;

  // ===== A waiting state's animation runs again and again. The Lottie player plays a file once, and again on a tap of
  // its box (premiumbot-lottie.js), and offers no other way in. So a box with data-lottie-loop, its file's length and
  // rest in ms, gets that tap from here each time the period is over: a click that does not bubble, on a box marked
  // data-haptic="none", so only the player answers it. The clock counts as the player's does, a tenth of a second a
  // frame at most, so a page that stalled starts the next run only once this one has ended =====

  var loops = [];
  var loopRaf = 0;
  var loopLast = 0;

  function loopTick(now) {
    loopRaf = requestAnimationFrame(loopTick);
    var dt = loopLast ? Math.min(now - loopLast, 100) : 0;
    loopLast = now;
    for (var i = 0; i < loops.length; i++) {
      var loop = loops[i];
      // A run starts once the file has drawn; none starts while Telegram holds the app inactive.
      if (!appActive || !loop.box.classList.contains('is-ready')) {
        continue;
      }
      loop.age += dt;
      if (loop.age >= loop.period) {
        loop.age = 0;
        loop.box.dispatchEvent(new Event('click'));
      }
    }
  }

  function mountLoops(root) {
    var boxes = root.querySelectorAll('[data-lottie-loop]');
    for (var i = 0; i < boxes.length; i++) {
      var period = parseInt(boxes[i].getAttribute('data-lottie-loop'), 10);
      if (period > 0) {
        boxes[i].setAttribute('data-haptic', 'none');
        loops.push({ box: boxes[i], period: period, age: 0 });
      }
    }
    if (loops.length) {
      loopRaf = requestAnimationFrame(loopTick);
    }
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

  // ===== The entrance (fx.css fx-stagger, and the paywall's fx-in- keyframes) runs in CSS from the first paint. Content
  // never waits on an animation: in a page whose frames do not run, a hidden one, the entrance is given up, at once or
  // when it has stalled this long =====

  // Its last part, the recommended rate's cooling (fx.css fx-in-tint), ends 1680 ms in.
  var ENTRANCE_MAX_MS = 2000;
  var entranceTimer = 0;

  // The natural style is the final state, so cancelling a stalled entrance shows the content as it should be. The
  // document lists every animation under way, those of a block's parts and of pseudo-elements among them.
  function endEntrance(root) {
    var doc = root.ownerDocument || root;
    var running = typeof doc.getAnimations === 'function' ? doc.getAnimations() : [];
    for (var i = 0; i < running.length; i++) {
      var name = running[i].animationName;
      if (typeof name === 'string' && (name === 'fx-stagger' || name.indexOf('fx-in-') === 0) && running[i].playState !== 'finished') {
        running[i].cancel();
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

  // ===== The drum: a line that changes rolls. The line as it stood slides up and out of a window exactly one line
  // tall while the new one comes up from below; the window never changes size, so nothing around it moves. Every line
  // of the strip is moved, faded by how far out it is and cut where it passes the window's edge, on transform, opacity
  // and clip-path alone, as Web Animations =====

  var ROLL_MS = 320;
  var ROLL_STILL_MS = 200;
  // The window cuts above and below only: its sides lie wide of the line.
  var ROLL_SIDE = '-8px';
  var rolls = [];

  // One line of the strip, u lines below the window, or above it when negative. Under reduced motion nothing moves and
  // nothing is cut: the line leaving fades out over the first half and the one arriving fades in over the second.
  function rollFrame(u, height, still) {
    var out = Math.min(Math.abs(u), 1);
    if (still) {
      return {opacity: Math.max(0, 1 - 2 * out)};
    }
    var cut = out * height + 'px';
    return {
      transform: 'translateY(' + u * height + 'px)',
      opacity: 1 - out,
      clipPath: u < 0 ? 'inset(' + cut + ' ' + ROLL_SIDE + ' 0 ' + ROLL_SIDE + ')' : 'inset(0 ' + ROLL_SIDE + ' ' + cut + ' ' + ROLL_SIDE + ')'
    };
  }

  // A line's keyframes on its way up from a to b lines below the window: its two ends and, between them, each place
  // where its fade or its cut turns.
  function rollFrames(a, b, height, still) {
    var turns = still ? [0.5, 0, -0.5] : [1, 0, -1];
    var frames = [rollFrame(a, height, still)];
    frames[0].offset = 0;
    for (var i = 0; i < turns.length; i++) {
      if (turns[i] < a && turns[i] > b) {
        var frame = rollFrame(turns[i], height, still);
        frame.offset = (a - turns[i]) / (a - b);
        frames.push(frame);
      }
    }
    var last = rollFrame(b, height, still);
    last.offset = 1;
    frames.push(last);
    return frames;
  }

  function rollProgress(animation) {
    var progress = animation.effect.getComputedTiming().progress;
    return progress === null ? 1 : progress;
  }

  function endRoll(state) {
    var at = rolls.indexOf(state);
    if (at < 0) {
      return;
    }
    rolls.splice(at, 1);
    clearTimeout(state.timer);
    for (var i = 0; i < state.copies.length; i++) {
      if (state.copies[i].parentNode) {
        state.copies[i].parentNode.removeChild(state.copies[i]);
      }
    }
    state.box.classList.toggle('fx-rolling', !!state.box.querySelector('.fx-drum-copy'));
    for (var j = 0; j < state.all.length; j++) {
      state.all[j].cancel();
    }
  }

  // roll(line, change): `line` is an element one line tall that still shows the old content, and `change` writes the
  // new content into it. A copy of the line as it stood is laid over its place, out of the flow, and rolls out as
  // the line itself rolls in. A change that comes while the strip is still running adds a line to it: the strip runs
  // on from where it is, at the pace it has, so no text is ever swapped in sight; called several times in one task,
  // it builds a strip of that many lines and rolls through them all. `timing`, when given, is the strip's own
  // {delay, duration} in ms in place of the drum's pace. Returns the time until the strip stops, in ms, 0 when the
  // change was made at once. The line must hold no ids, and the box its copies are placed against, the nearest
  // positioned or transformed one above it, must stay that box while the strip runs.
  function roll(line, change, timing) {
    var state = null;
    for (var r = 0; r < rolls.length; r++) {
      if (rolls[r].line === line) {
        state = rolls[r];
      }
    }
    if (typeof line.animate !== 'function' || document.visibilityState === 'hidden' || document.documentElement.classList.contains('fx-snap')) {
      if (state) {
        endRoll(state);
      }
      change();
      return 0;
    }
    var still = reducedMotion();
    var from = 0;
    var pace = 0;
    var copies = [];
    if (state) {
      // Where the strip stands, and how far it ran in the frame before, read off the animation this roll takes over.
      var span = state.to - state.from;
      var now = state.live.currentTime || 0;
      var done = rollProgress(state.live);
      var back = Math.min(now, 16);
      state.live.currentTime = now - back;
      pace = back ? (done - rollProgress(state.live)) * span / back : 0;
      from = state.from + span * done;
      copies = state.copies;
      state.copies = [];
      endRoll(state);
      // A copy that has left the window is done.
      while (copies.length && from >= 1) {
        var gone = copies.shift();
        gone.parentNode.removeChild(gone);
        from -= 1;
      }
    }
    var box = line.getBoundingClientRect();
    var copy = line.cloneNode(true);
    copy.classList.add('fx-drum-copy');
    copy.setAttribute('aria-hidden', 'true');
    copy.style.width = box.width + 'px';
    line.parentNode.appendChild(copy);
    var spots = [];
    var i;
    for (i = 0; i < copies.length; i++) {
      spots.push(copies[i].getBoundingClientRect());
    }
    spots.push(box);
    copies.push(copy);
    change();
    // The change may move the box the copies are placed in: each goes back to where it stood.
    var moved = [];
    for (i = 0; i < copies.length; i++) {
      moved.push(copies[i].getBoundingClientRect());
    }
    for (i = 0; i < copies.length; i++) {
      copies[i].style.left = (parseFloat(copies[i].style.left) || 0) + spots[i].left - moved[i].left + 'px';
      copies[i].style.top = (parseFloat(copies[i].style.top) || 0) + spots[i].top - moved[i].top + 'px';
    }
    var to = copies.length;
    // One line takes ROLL_MS, and every further line of the strip half as long again.
    var duration = still ? ROLL_STILL_MS : timing ? timing.duration : ROLL_MS * (1 + to - from) / 2;
    var delay = timing ? timing.delay : 0;
    // From rest the strip eases at both ends. Taken over mid-flight it starts at the pace it had, so it never stalls,
    // and still lands softly: the curve's first handle gives the slope at its start.
    var slope = pace * duration / (to - from);
    var handle = 0.65 - 0.175 * Math.min(slope, 2);
    var run = {
      delay: delay,
      duration: duration,
      easing: still ? 'linear' : 'cubic-bezier(' + handle.toFixed(3) + ', ' + Math.min(slope * handle, 1).toFixed(3) + ', 0.35, 1)',
      fill: 'both'
    };
    // The box the strip rolls in is marked while it does (fx.css softens a rate's window by it).
    var next = {line: line, box: line.parentNode, copies: copies, from: from, to: to, all: [], live: null, timer: 0};
    next.box.classList.add('fx-rolling');
    for (i = 0; i <= to; i++) {
      next.all.push((i < to ? copies[i] : line).animate(rollFrames(i - from, i - to, box.height, still), run));
    }
    next.live = next.all[to];
    next.live.onfinish = function() {
      endRoll(next);
    };
    // Frames may never come; the line must be left as it should be.
    next.timer = setTimeout(function() {
      endRoll(next);
    }, delay + duration + 100);
    rolls.push(next);
    return delay + duration;
  }

  // ===== The paywall's pay label rolls to its new text. The page script writes the label up to twice in one task as it
  // fits it (premiumbot.js ctaFit); the observer hears of those writes together, once the task is over, so it only
  // ever sees the text that settled =====

  var labelWatch = null;

  function mountLabel(root) {
    var label = root.querySelector('.home--paywall .cta-button .cta-label');
    if (!label || typeof MutationObserver !== 'function') {
      return;
    }
    var shown = label.textContent;
    labelWatch = new MutationObserver(function(records, observer) {
      var text = label.textContent;
      if (text === shown) {
        return;
      }
      // The drum copies the line as it stood, so the text last shown goes back in for the copy.
      label.textContent = shown;
      shown = text;
      roll(label.parentNode, function() {
        label.textContent = text;
      });
      // The two writes just made are not news.
      observer.takeRecords();
    });
    labelWatch.observe(label, {childList: true, characterData: true, subtree: true});
  }

  // ===== The light on the best plan and the path of attention (fx.css .fx-comet, .fx-band). The light: the star in
  // the recommended plan's label flares and one stroke of neon goes once round the tile's ring, clockwise, out of the
  // label and back into it (runComet). It runs as that tile's rate lands in the entrance, whenever the tile is chosen
  // after another was, and every PATH_MS while it is the chosen one. On those beats the pay button of any screen
  // answers on the same clock, whatever is chosen: a band of light
  // sets off across it with the light on the ring, on the same easing, and is across as the light's point comes
  // home. Every animation of a run is made in one task, so they keep one clock. Nothing runs while the page is hidden, the app is not active, motion is
  // reduced or snap mode holds every screen still =====

  var EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
  var PATH_MS = 5000;
  // No beat this soon after a plan is chosen: the choice has its own motion.
  var PATH_CLEAR_MS = 800;
  var path = null;

  function pathLayer(host, name) {
    var layer = document.createElement('i');
    layer.className = name;
    layer.appendChild(document.createElement('i'));
    host.appendChild(layer);
    return layer;
  }

  function pathOpen() {
    return appActive && document.visibilityState !== 'hidden' && !reducedMotion() && !document.documentElement.classList.contains('fx-snap');
  }

  function charging() {
    for (var i = 0; i < path.live.length; i++) {
      if (path.live[i].playState !== 'finished' && path.live[i].playState !== 'idle') {
        return true;
      }
    }
    return false;
  }

  function endCharge() {
    for (var i = 0; i < path.live.length; i++) {
      path.live[i].cancel();
    }
    path.live = [];
    path.lights = [];
  }

  // An animation of the light on the tile, as apart from the button's band: the light alone goes out when the user
  // moves to another plan.
  function lit(animation) {
    path.live.push(animation);
    path.lights.push(animation);
  }

  // The light does not vanish between two frames: it dims where it is, on its way, over COMET_OUT_MS, and only
  // then is its run dropped.
  var COMET_OUT_MS = 280;

  function onPathChange() {
    if (!path || !path.tile || !path.lights.length || path.tile.querySelector('.cell-input:checked')) {
      return;
    }
    var lights = path.lights;
    var layer = path.comet;
    path.lights = [];
    var drop = function() {
      for (var i = 0; i < lights.length; i++) {
        lights[i].cancel();
      }
    };
    if (!layer || typeof layer.animate !== 'function') {
      drop();
      return;
    }
    var fade = layer.animate([{opacity: getComputedStyle(layer).opacity}, {opacity: 0}], {duration: COMET_OUT_MS, easing: 'ease-out', fill: 'forwards'});
    lights.push(fade);
    path.live.push(fade);
    fade.onfinish = drop;
  }

  // The light is one stroke of neon on the tile's ring: a bright point and, behind it on the same line, a tail made of
  // strokes that all end at the point and are each shorter than the one before, so the tail thins out evenly from
  // the point back with no step in it. The strokes are the dashes of one SVG path, drawn over the ring, and a soft
  // shadow of their own gold is their glow.
  var COMET_MS = 1500;
  // The point is back at the star this far through the run; the tail follows it in over the rest.
  var COMET_HOME = 0.86;
  // The strokes' lengths in px, the longest first; the last is the point itself.
  var COMET_TAIL = [200, 150, 110, 78, 52, 32, 16, 6, 0.5];
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // The layer stands before the label in the tile, so the label covers it: the light leaves it and returns to it.
  function cometLayer(tile) {
    if (!document.createElementNS) {
      return null;
    }
    var layer = document.createElementNS(SVG_NS, 'svg');
    layer.setAttribute('class', 'fx-comet');
    layer.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < COMET_TAIL.length; i++) {
      layer.appendChild(document.createElementNS(SVG_NS, 'path'));
    }
    tile.insertBefore(layer, tile.querySelector('.plan-tab'));
    return layer;
  }

  // One light goes once round the tile's ring, clockwise, out of the label's star and back into it, while the star
  // flares. `box` is the tile's rect; the line it follows lies 1 px inside the tile's edge, on the ring. Each stroke
  // grows out of the star until it has its length, runs with the point, and is drawn in behind it at the end.
  function runComet(box, delay) {
    var spark = path.spark;
    var layer = path.comet;
    var strokes = layer ? layer.childNodes : [];
    if (strokes.length && typeof strokes[0].getTotalLength === 'function') {
      var w = box.width;
      var h = box.height;
      var r = parseFloat(getComputedStyle(path.tile).borderTopLeftRadius) || 16;
      var x0 = spark ? spark.getBoundingClientRect().left + spark.offsetWidth / 2 - box.left : r;
      var a = r - 1;
      var arc = ' A' + a + ' ' + a + ' 0 0 1 ';
      var line = 'M' + x0 + ' 1 H' + (w - r) + arc + (w - 1) + ' ' + r + ' V' + (h - r) + arc + (w - r) + ' ' + (h - 1) +
        ' H' + r + arc + '1 ' + (h - r) + ' V' + r + arc + r + ' 1 H' + x0;
      strokes[0].setAttribute('d', line);
      var lap = strokes[0].getTotalLength();
      var gap = lap * 2;
      for (var i = 0; i < strokes.length && lap > 0; i++) {
        var tail = Math.min(COMET_TAIL[i], lap / 3);
        strokes[i].setAttribute('d', line);
        lit(strokes[i].animate(
          [
            {strokeDasharray: '0 ' + gap, strokeDashoffset: 0},
            {strokeDasharray: tail + ' ' + gap, strokeDashoffset: 0, offset: (COMET_HOME * tail) / lap},
            {strokeDasharray: tail + ' ' + gap, strokeDashoffset: tail - lap, offset: COMET_HOME},
            {strokeDasharray: '0 ' + gap, strokeDashoffset: -lap}
          ],
          {delay: delay, duration: COMET_MS, easing: EASE_IN_OUT}
        ));
      }
      lit(layer.animate(
        [{opacity: 0}, {opacity: 1, offset: 0.05}, {opacity: 1, offset: 0.93}, {opacity: 0}],
        {delay: delay, duration: COMET_MS}
      ));
    }
    if (spark) {
      var ink = getComputedStyle(spark).backgroundColor;
      lit(spark.animate(
        [{transform: 'scale(1)', backgroundColor: ink}, {transform: 'scale(1.8)', backgroundColor: '#fff', offset: 0.3}, {transform: 'scale(1)', backgroundColor: ink}],
        {delay: delay, duration: 520, easing: 'ease-out'}
      ));
    }
  }

  // One run, `delay` ms from now. The light goes round the recommended plan's tile only while that plan is the chosen
  // one (round a recommended pack always), and the tile is whole on screen above the pay bar: round a tile that is not chosen it would point at a
  // choice the user has left. With `onward` the pay button answers on the same clock, whatever is chosen: its band
  // from outside one end of the capsule to outside the other, the way the page reads, unless the button is inactive
  // or busy. A call made while a run is on its way is dropped.
  function charge(delay, onward) {
    if (!path || !pathOpen() || charging()) {
      return;
    }
    path.live = [];
    path.lights = [];
    if (path.tile && (path.always || path.tile.querySelector('.cell-input:checked'))) {
      var tile = path.tile.getBoundingClientRect();
      var floor = path.bar ? path.bar.getBoundingClientRect().top : window.innerHeight;
      if (tile.top >= 0 && tile.bottom <= floor) {
        runComet(tile, delay);
      }
    }
    if (onward && path.band && path.button.getAttribute('aria-disabled') !== 'true' && !path.button.classList.contains('is-busy')) {
      var width = path.button.offsetWidth;
      var half = path.band.firstChild.offsetWidth / 2;
      var back = getComputedStyle(path.button).direction === 'rtl';
      var enter = 'translateX(' + ((back ? width + half : -half) - half) + 'px)';
      var leave = 'translateX(' + ((back ? -half : width + half) - half) + 'px)';
      // The band crosses the button on the light's own clock: the same run, the same easing over the whole of it,
      // and across at the moment the light's point is home, so the two are at the same share of their ways at
      // every moment. Outside the run the band's layer is at rest, out of sight.
      path.live.push(
        path.band.animate([{opacity: 1}, {opacity: 1}], {delay: delay, duration: COMET_MS}),
        path.band.firstChild.animate(
          [{transform: enter}, {transform: leave, offset: COMET_HOME}, {transform: leave}],
          {delay: delay, duration: COMET_MS, easing: EASE_IN_OUT}
        )
      );
    }
    armPath();
  }

  // A beat of the path. It is passed over while something is pressed, a line is rolling or a plan has just been
  // chosen.
  function beat() {
    armPath();
    if (document.querySelector('.is-pressed') || rolls.length || performance.now() - path.changed < PATH_CLEAR_MS) {
      return;
    }
    charge(0, true);
  }

  // The path's clock starts over: after every charge, and when the page may move again.
  function armPath() {
    clearTimeout(path.timer);
    path.timer = pathOpen() ? setTimeout(beat, PATH_MS) : 0;
  }

  function refreshPath() {
    if (!path) {
      return;
    }
    if (!pathOpen()) {
      endCharge();
    }
    armPath();
  }

  // Every screen with a pay button in its bar has the band; a screen whose plans have a recommended one has the
  // light on that plan's tile too. A recommended pack of Stars is a button, not a choice: its light runs on every
  // beat.
  function mountPath(root) {
    var plan = root.querySelector('.cell--plan.plan-emphasis--strong');
    var tile = plan || root.querySelector('.pack-tile.plan-emphasis--strong:not([hidden])');
    var button = root.querySelector('.cta-bar .cta-button:not(.cta-button--glass)');
    var host = tile || button;
    if (!host || typeof host.animate !== 'function') {
      return;
    }
    path = {
      tile: tile,
      button: button,
      bar: root.querySelector('.cta-bar'),
      spark: tile ? tile.querySelector('.plan-tab-spark') : null,
      comet: tile ? cometLayer(tile) : null,
      band: button ? pathLayer(button, 'fx-band') : null,
      always: !plan,
      live: [],
      lights: [],
      timer: 0,
      changed: 0
    };
    if (plan) {
      document.addEventListener('change', onPathChange);
    }
    armPath();
  }

  function unmountPath() {
    if (!path) {
      return;
    }
    clearTimeout(path.timer);
    endCharge();
    document.removeEventListener('change', onPathChange);
    var layers = [path.comet, path.band];
    for (var i = 0; i < layers.length; i++) {
      if (layers[i] && layers[i].parentNode) {
        layers[i].parentNode.removeChild(layers[i]);
      }
    }
    path = null;
  }

  // ===== Was and now (fx.css fx-in-roll): on a plan tile with a struck price the rate comes in showing that price and
  // rolls down to its own through figures between the two. The sheet keeps the clock: it starts the rate's fade when
  // the rate's turn comes, and the script, hearing that start, rolls the drum. A tap on the plans ends it all at
  // once, so a plan is always chosen among final values =====

  // The rate stands on the struck figure this long, fading in as the sheet fades it, before its strip moves.
  var WAS_HOLD_MS = 80;
  var WAS_ROLL_MS = 520;
  var planGroups = [];

  // The figure a rate starts from on its way down to `nowText`: the struck price. It rolls from that to its own in one
  // step: figures between the two pass too fast to read and show only as cut halves.
  function figuresBetween(wasText, nowText) {
    return wasText === nowText ? [] : [wasText];
  }

  function writes(el, text) {
    return function() {
      el.textContent = text;
    };
  }

  // The rate's turn has come. One strip is built of all its figures in this task, so it rolls through them in one
  // run and stops on the rate's own. The recommended tile's charge is set to follow the landing.
  function wasNow(rate) {
    var was = rate.parentNode.querySelector('.plan-was');
    var now = rate.textContent;
    var figures = was ? figuresBetween(was.textContent, now) : [];
    // A figure wider than the rate would reach over the struck price beside it. Such a one between the two is left
    // out; when the struck figure itself is one, nothing rolls and the sheet's fade brings the rate in.
    var room = rate.getBoundingClientRect().width + 0.5;
    var strip = [];
    for (var i = 0; i < figures.length; i++) {
      rate.textContent = figures[i];
      if (rate.getBoundingClientRect().width <= room) {
        strip.push(figures[i]);
      } else if (!i) {
        break;
      }
    }
    rate.textContent = now;
    var landed = WAS_HOLD_MS;
    if (strip.length) {
      rate.textContent = strip[0];
      for (i = 1; i <= strip.length; i++) {
        landed = roll(rate, writes(rate, i < strip.length ? strip[i] : now), {delay: WAS_HOLD_MS, duration: WAS_ROLL_MS});
      }
      // The drum shows the line it rolls out from its first frame; here that line is new to the eye and fades in.
      var first = rate.parentNode.querySelector('.fx-drum-copy');
      if (first) {
        first.animate([{opacity: 0}, {opacity: 1}], WAS_HOLD_MS);
      }
    }
    if (path && path.tile && path.tile.contains(rate)) {
      charge(landed, false);
    }
  }

  function onPlanMotion(event) {
    var el = event.target;
    if (event.type === 'animationstart' && event.animationName === 'fx-in-roll') {
      wasNow(el);
    } else if (event.type === 'animationend' && event.animationName === 'fx-in-slide' && path && path.tile && el === path.tile && getComputedStyle(path.tile.querySelector('.plan-rate')).animationName.indexOf('fx-in-roll') < 0) {
      // The sheet gives the recommended tile's rate no was and now: the tile has arrived with its rate in place, and
      // the charge follows that.
      charge(0, false);
    }
  }

  // A tap on the plans: every rate stops on its own figure and each part still to come is there, at once. A colour
  // still to settle is not cut to its end, which would be a jump: it starts settling now.
  function endWasNow(event) {
    var group = event.currentTarget;
    for (var r = rolls.length - 1; r >= 0; r--) {
      if (group.contains(rolls[r].line)) {
        endRoll(rolls[r]);
      }
    }
    var running = typeof document.getAnimations === 'function' ? document.getAnimations() : [];
    for (var i = 0; i < running.length; i++) {
      var name = running[i].animationName;
      var el = running[i].effect && running[i].effect.target;
      if (typeof name !== 'string' || name.indexOf('fx-in-') !== 0 || !el || !group.contains(el) || !el.matches('.plan-was, .plan-rate, .plan-unit')) {
        continue;
      }
      if (name !== 'fx-in-tint') {
        running[i].cancel();
      } else if (running[i].currentTime < running[i].effect.getTiming().delay) {
        running[i].currentTime = running[i].effect.getTiming().delay;
      }
    }
    // A charge that waits for a landing has none to follow.
    if (path && path.live.length && path.live[0].currentTime < path.live[0].effect.getTiming().delay) {
      endCharge();
    }
  }

  function onPlanChange(event) {
    if (!path) {
      return;
    }
    path.changed = performance.now();
    if (event.target.checked && path.tile && path.tile.contains(event.target)) {
      charge(0, false);
    }
  }

  // ===== What the payment unlocked (premiumbot.css .section--unlocked): the three rows of feature icons as a wall
  // that goes round. Each row becomes a strip of its own that holds its tiles twice over, so it can run on with no
  // end: the script moves a strip by a transform and takes it back by one round of its tiles whenever it has gone
  // that far, which shows nothing. The rows drift at paces of their own, the lowest the fastest, which reads as
  // depth. A finger moves them sideways, each by its own share of the finger's way, and a let-go leaves them
  // running the way they were thrown until that dies away into the drift. Tiles under a finger, or under a cursor,
  // grow, the nearest the most, and none so far as to touch its neighbour. A tap on a tile names its feature in a
  // cloud over it (cloudSay), and the rows hold still while the cloud is up: a touch anywhere puts the cloud away,
  // the same tile tapped again leaves it away, and it goes by itself after CLOUD_MS. Nothing done on the icons
  // presses the band or opens its link, which the line over them does. With motion reduced the rows stand until a
  // finger moves them =====

  var unlocked = null;
  // A row's drift in px a second, the top row first, and its share of a finger's way.
  var ROW_DRIFT = [-10, -16, -22];
  var ROW_GAIN = [0.85, 1, 1.15];
  // The rows come in running, at ROW_RUSH times their drift, ROW_BORN_MS into the page, as the sheets bring them
  // up (fx.css fx-unlock-rows). A row's speed goes over to where it is headed in ROW_EASE_S.
  var ROW_RUSH = 40;
  var ROW_BORN_MS = 600;
  var ROW_EASE_S = 0.7;
  var ROW_TAP_PX = 8;
  // The tile under the pointer grows by LENS_UP, one LENS_PX away not at all. With 16 px between tiles a quarter
  // more of a 64 px tile is 8 px a side, and its neighbour grows by less than a third of that.
  var LENS_PX = 120;
  var LENS_UP = 0.25;
  var LENS_EASE_S = 0.12;
  var CLOUD_MS = 5000;
  var CLOUD_OUT_MS = 160;
  // The cloud's tip is 7 px tall and ends 2 px short of the tile; it keeps CLOUD_TIP from the cloud's corners, and
  // the cloud CLOUD_EDGE from the section's sides, which are the screen's.
  var CLOUD_GAP = 9;
  var CLOUD_TIP = 18;
  var CLOUD_EDGE = 8;

  function cloudHush() {
    var said = unlocked && unlocked.said;
    if (!said) {
      return;
    }
    unlocked.said = null;
    clearTimeout(said.timer);
    said.cloud.classList.remove('is-open');
    setTimeout(function() {
      if (said.cloud.parentNode) {
        said.cloud.parentNode.removeChild(said.cloud);
      }
    }, CLOUD_OUT_MS);
  }

  // The cloud over a tapped tile: the feature's name and its line, which the tile carries (data-perk-title,
  // data-perk-text). It stands over the tile, its tip on the tile's middle, and inside the section's width, clear
  // of its sides; where the section has no room over the tile it stands under it.
  function cloudSay(tile) {
    var section = unlocked.strip.closest('.section');
    var name = tile.getAttribute('data-perk-title');
    var text = tile.getAttribute('data-perk-text');
    if (!section || !name) {
      return;
    }
    var cloud = document.createElement('div');
    cloud.className = 'perk-bubble';
    var head = document.createElement('span');
    head.className = 'perk-bubble-title';
    head.textContent = name;
    cloud.appendChild(head);
    if (text) {
      var line = document.createElement('span');
      line.className = 'perk-bubble-text';
      line.textContent = text;
      cloud.appendChild(line);
    }
    section.appendChild(cloud);
    var box = section.getBoundingClientRect();
    var at = tile.getBoundingClientRect();
    var width = cloud.offsetWidth;
    var middle = Math.max(CLOUD_TIP, Math.min(box.width - CLOUD_TIP, at.left + at.width / 2 - box.left));
    var left = Math.max(CLOUD_EDGE, Math.min(box.width - width - CLOUD_EDGE, middle - width / 2));
    var top = at.top - box.top - cloud.offsetHeight - CLOUD_GAP;
    if (top < 0) {
      top = at.bottom - box.top + CLOUD_GAP;
      cloud.classList.add('perk-bubble--under');
    }
    cloud.style.left = left.toFixed(1) + 'px';
    cloud.style.top = top.toFixed(1) + 'px';
    cloud.style.setProperty('--tip', Math.max(CLOUD_TIP, Math.min(width - CLOUD_TIP, middle - left)).toFixed(1) + 'px');
    // The closed look is laid out first, so the opening is a change the sheets can run.
    void cloud.offsetWidth;
    cloud.classList.add('is-open');
    unlocked.said = {tile: tile, cloud: cloud, timer: setTimeout(cloudHush, CLOUD_MS)};
  }

  // A tile's size and step as laid out, and with them each row's round. A row keeps its place in its round.
  function unlockedMeasure() {
    var u = unlocked;
    var size = u.rows[0].own[0].offsetWidth;
    var gap = parseFloat(getComputedStyle(u.rows[0].el).columnGap) || 0;
    u.size = size;
    u.gap = gap;
    u.step = size + gap;
    u.pad = parseFloat(getComputedStyle(u.strip).paddingTop) || 0;
    for (var r = 0; r < u.rows.length; r++) {
      var row = u.rows[r];
      var round = row.own.length * u.step;
      if (row.round) {
        row.x *= round / row.round;
      }
      row.round = round;
      row.shown = null;
    }
  }

  // Each tile's size by how near the pointer is. A pass with the lens gone puts every tile back.
  function unlockedLens() {
    var u = unlocked;
    var lens = u.lens;
    var box = u.strip.getBoundingClientRect();
    var reach = LENS_PX * LENS_PX;
    lens.shown = false;
    for (var r = 0; r < u.rows.length; r++) {
      var row = u.rows[r];
      var dy = lens.y - (box.top + u.pad + r * u.step + u.size / 2);
      for (var i = 0; i < row.tiles.length; i++) {
        var dx = lens.x - (box.left + row.x + i * u.step + u.size / 2);
        var near = 1 - (dx * dx + dy * dy) / reach;
        var by = near > 0 ? Math.round((1 + LENS_UP * lens.k * near * near) * 200) / 200 : 1;
        if (by !== row.by[i]) {
          row.by[i] = by;
          row.tiles[i].style.transform = by === 1 ? '' : 'scale(' + by + ')';
        }
        if (by !== 1) {
          lens.shown = true;
        }
      }
    }
  }

  function unlockedFrame(now) {
    var u = unlocked;
    if (!u) {
      return;
    }
    u.raf = requestAnimationFrame(unlockedFrame);
    var dt = u.last ? Math.min(now - u.last, 64) / 1000 : 0;
    u.last = now;
    var r;
    if (u.born && now >= u.born) {
      u.born = 0;
      for (r = 0; r < u.rows.length; r++) {
        u.rows[r].v = u.rows[r].drift * ROW_RUSH;
      }
    }
    var stand = u.born || u.said || reducedMotion();
    var ease = 1 - Math.exp(-dt / ROW_EASE_S);
    for (r = 0; r < u.rows.length; r++) {
      var row = u.rows[r];
      if (!u.held) {
        row.v += ((stand ? 0 : row.drift) - row.v) * ease;
        row.x += row.v * dt;
      }
      // One round back or on is the same picture.
      row.x %= row.round;
      if (row.x > 0) {
        row.x -= row.round;
      }
      var x = Math.round(row.x * 10) / 10;
      if (x !== row.shown) {
        row.shown = x;
        row.el.style.transform = 'translate3d(' + x + 'px, 0, 0)';
      }
    }
    var lens = u.lens;
    lens.k += ((lens.on ? 1 : 0) - lens.k) * (1 - Math.exp(-dt / LENS_EASE_S));
    if (!lens.on && lens.k < 0.004) {
      lens.k = 0;
    }
    if (lens.k || lens.shown) {
      unlockedLens();
    }
  }

  function unlockedRun() {
    var u = unlocked;
    if (!u) {
      return;
    }
    var on = appActive && document.visibilityState !== 'hidden';
    if (on && !u.raf) {
      u.last = 0;
      u.raf = requestAnimationFrame(unlockedFrame);
    } else if (!on && u.raf) {
      cancelAnimationFrame(u.raf);
      u.raf = 0;
    }
  }

  function mountUnlocked(root) {
    var strip = root.querySelector('.section--unlocked .perk-strip');
    if (!strip || typeof requestAnimationFrame !== 'function') {
      return;
    }
    var tiles = [].slice.call(strip.querySelectorAll('.icon-tile'));
    if (!tiles.length) {
      return;
    }
    var each = Math.ceil(tiles.length / ROW_DRIFT.length);
    var size = tiles[0].offsetWidth;
    var step = size + (parseFloat(getComputedStyle(strip).columnGap) || 0);
    var width = strip.clientWidth;
    // As many rounds of a row as cover the window wherever the row stands in its round.
    var rounds = Math.ceil(width / (each * step)) + 1;
    var rows = [];
    for (var r = 0; r * each < tiles.length; r++) {
      var el = document.createElement('span');
      el.className = 'perk-row';
      var own = tiles.slice(r * each, (r + 1) * each);
      for (var n = 0; n < rounds; n++) {
        for (var i = 0; i < own.length; i++) {
          el.appendChild(n ? own[i].cloneNode(true) : own[i]);
        }
      }
      strip.appendChild(el);
      var all = [].slice.call(el.children);
      var by = [];
      for (var t = 0; t < all.length; t++) {
        by.push(1);
      }
      rows.push({
        el: el, own: own, tiles: all, by: by, round: 0, v: 0, shown: null,
        // Where the sheets alone stand the row: on the window's middle, the second row half a step in.
        x: (width - own.length * step) / 2 + (r === 1 ? step / 2 : 0),
        drift: ROW_DRIFT[r % ROW_DRIFT.length], gain: ROW_GAIN[r % ROW_GAIN.length]
      });
    }
    strip.classList.add('is-live');
    unlocked = {
      strip: strip, link: strip.closest('a') || strip, rows: rows, said: null, was: null,
      held: null, dragged: 0, raf: 0, last: 0, lens: {x: 0, y: 0, k: 0, on: false, shown: false},
      born: reducedMotion() ? 0 : performance.now() + ROW_BORN_MS
    };
    var u = unlocked;
    unlockedMeasure();
    // Any touch puts the cloud away. One on an icon also lifts the press the page script has just put on the band
    // the icons lie in: it comes after that script's own handler, whichever was bound first.
    u.touch = function(event) {
      u.was = u.said ? u.said.tile : null;
      cloudHush();
      if (strip.contains(event.target)) {
        var pressed = strip.closest('.is-pressed');
        if (pressed) {
          pressed.classList.remove('is-pressed');
        }
      }
    };
    // A finger stops the wall where it is.
    u.down = function(event) {
      if (u.held || event.button) {
        return;
      }
      u.held = {id: event.pointerId, x: event.clientX, t: event.timeStamp};
      u.dragged = 0;
      for (var r = 0; r < u.rows.length; r++) {
        u.rows[r].v = 0;
      }
      u.lens.x = event.clientX;
      u.lens.y = event.clientY;
      u.lens.on = true;
    };
    u.move = function(event) {
      u.lens.x = event.clientX;
      u.lens.y = event.clientY;
      var held = u.held;
      if (!held) {
        // A cursor over the wall is a lens without a press.
        u.lens.on = event.pointerType === 'mouse';
        return;
      }
      if (event.pointerId !== held.id) {
        return;
      }
      var dx = event.clientX - held.x;
      var dt = Math.max(event.timeStamp - held.t, 1) / 1000;
      u.dragged += Math.abs(dx);
      for (var r = 0; r < u.rows.length; r++) {
        var row = u.rows[r];
        row.x += dx * row.gain;
        // The speed of the throw: the last moves, smoothed.
        row.v = row.v * 0.5 + (dx * row.gain / dt) * 0.5;
      }
      held.x = event.clientX;
      held.t = event.timeStamp;
    };
    u.up = function(event) {
      if (u.held && (event.type === 'pointerleave' || event.pointerId === u.held.id)) {
        u.held = null;
        if (reducedMotion()) {
          for (var r = 0; r < u.rows.length; r++) {
            u.rows[r].v = 0;
          }
        }
      }
      if (event.pointerType !== 'mouse' || event.type === 'pointerleave') {
        u.lens.on = false;
      }
    };
    // A tap on the tile whose cloud this touch has just put away leaves it away; a drag names nothing.
    u.click = function(event) {
      if (!strip.contains(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      var tile = u.dragged > ROW_TAP_PX ? null : event.target.closest('.icon-tile');
      if (tile && tile !== u.was) {
        for (var r = 0; r < u.rows.length; r++) {
          u.rows[r].v = 0;
        }
        cloudSay(tile);
      }
      u.was = null;
    };
    document.addEventListener('pointerdown', u.touch);
    strip.addEventListener('pointerdown', u.down);
    strip.addEventListener('pointermove', u.move);
    strip.addEventListener('pointerup', u.up);
    strip.addEventListener('pointercancel', u.up);
    strip.addEventListener('pointerleave', u.up);
    u.link.addEventListener('click', u.click, true);
    unlockedRun();
  }

  function unmountUnlocked() {
    var u = unlocked;
    if (!u) {
      return;
    }
    if (u.raf) {
      cancelAnimationFrame(u.raf);
    }
    if (u.said) {
      clearTimeout(u.said.timer);
      if (u.said.cloud.parentNode) {
        u.said.cloud.parentNode.removeChild(u.said.cloud);
      }
    }
    document.removeEventListener('pointerdown', u.touch);
    u.strip.removeEventListener('pointerdown', u.down);
    u.strip.removeEventListener('pointermove', u.move);
    u.strip.removeEventListener('pointerup', u.up);
    u.strip.removeEventListener('pointercancel', u.up);
    u.strip.removeEventListener('pointerleave', u.up);
    u.link.removeEventListener('click', u.click, true);
    // The tiles go back as the server printed them, and the copies go with their rows.
    for (var r = 0; r < u.rows.length; r++) {
      var row = u.rows[r];
      for (var i = 0; i < row.own.length; i++) {
        row.own[i].style.transform = '';
        u.strip.appendChild(row.own[i]);
      }
      if (row.el.parentNode) {
        row.el.parentNode.removeChild(row.el);
      }
    }
    u.strip.classList.remove('is-live');
    unlocked = null;
  }

  function mountPlans(root) {
    var groups = root.querySelectorAll('.home--paywall .plans .section-body');
    for (var i = 0; i < groups.length; i++) {
      groups[i].addEventListener('animationstart', onPlanMotion);
      groups[i].addEventListener('animationend', onPlanMotion);
      groups[i].addEventListener('pointerdown', endWasNow);
      groups[i].addEventListener('click', endWasNow);
      groups[i].addEventListener('change', onPlanChange);
      planGroups.push(groups[i]);
    }
  }

  function unmountPlans() {
    while (planGroups.length) {
      var group = planGroups.pop();
      group.removeEventListener('animationstart', onPlanMotion);
      group.removeEventListener('animationend', onPlanMotion);
      group.removeEventListener('pointerdown', endWasNow);
      group.removeEventListener('click', endWasNow);
      group.removeEventListener('change', onPlanChange);
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
    refreshPath();
    unlockedRun();
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
    mountEntrance(root);
    mountLabel(root);
    // Before the rest, so the page is on its grid when anything is measured from it.
    mountSnaps(root);
    var found = root.querySelectorAll('.fx-stage');
    for (var i = 0; i < found.length; i++) {
      mountStage(found[i]);
    }
    // A field no stage of this page took on has nowhere to go.
    dropFields();
    mountLight(root);
    mountCounts(root);
    if (!resizeHandler) {
      resizeHandler = function() {
        for (var i = 0; i < stages.length; i++) {
          layoutStage(stages[i]);
        }
        layoutLight();
        if (unlocked) {
          unlockedMeasure();
        }
      };
      window.addEventListener('resize', resizeHandler);
      document.addEventListener('visibilitychange', refresh);
      if (app && app.onEvent) {
        app.onEvent('activated', onActive);
        app.onEvent('deactivated', onInactive);
      }
    }
    mountPath(root);
    mountPlans(root);
    mountUnlocked(root);
    // A paid result: the field's stars burst from the mark and confetti falls over the screen.
    var celebrate = root.querySelector('.js-celebrate');
    if (celebrate) {
      var host = celebrate.closest('.result-screen') || celebrate.parentNode;
      if (host) {
        var golden = host.querySelector('.fx-stage--stars, .pm-mark--stars');
        burstTimer = setTimeout(burst, BURST_AFTER_MS, host, golden ? FIELD_COLORS.starsPaid : FIELD_COLORS.premium);
        confetti(host);
      }
    }
    mountLoops(root);
    update();
    launched = true;
  }

  function destroy() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
    clearTimeout(burstTimer);
    cancelAnimationFrame(loopRaf);
    loopRaf = 0;
    loopLast = 0;
    loops = [];
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
    if (light && light.observer) {
      light.observer.disconnect();
    }
    light = null;
    clearTimeout(entranceTimer);
    if (labelWatch) {
      labelWatch.disconnect();
      labelWatch = null;
    }
    while (rolls.length) {
      endRoll(rolls[0]);
    }
    unmountPlans();
    unmountPath();
    unmountUnlocked();
    if (snapObserver) {
      snapObserver.disconnect();
      snapObserver = null;
    }
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
