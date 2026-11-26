/* Premium Bot Mini App fx runtime: Telegram's StarParticlesView particle field (src/fx/particles.ts, stage.ts), the
   page's light field (src/fx/field.ts), iOS success confetti and the results burst (src/fx/confetti.ts, burst.ts),
   the light on the best plan and the pay button's glint, the wall of what a payment unlocked,
   in plain classic JavaScript, no build step. */
/* The site's loader may run this file again in a document that already has it: the first run stays, with the fields
   it holds, so a page change keeps them. */
window.PremiumFx = window.PremiumFx || (function() {
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

  // A particle as a picture: a glint. Four needles round a small core, the curve |x|^p + |y|^p = r^p with p well
  // under one, so each arm thins to nothing at its tip and the core is a seventh of the reach; at the smallest
  // size, where arms would not be seen, the curve is fuller and reads as a point of light. Drawn sharp, with no
  // blur: the stars this is taken from are thinner than a pixel under a blur, a glow on a phone and a smudge on a
  // larger screen.
  var GLINT_POWER = 0.3;
  var GLINT_POINT_POWER = 0.55;
  var GLINT_STEPS = 14;

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
    if (g && parseHex(color)) {
      var r = n / 2;
      var power = 2 / (size < 6 ? GLINT_POINT_POWER : GLINT_POWER);
      g.translate(r, r);
      g.beginPath();
      // One quarter of the curve at a time, from the arm on the x axis round to the same arm.
      for (var q = 0; q < 4; q++) {
        for (var k = 0; k < GLINT_STEPS; k++) {
          var t = (k / GLINT_STEPS) * Math.PI / 2;
          var x = r * Math.pow(Math.cos(t), power);
          var y = r * Math.pow(Math.sin(t), power);
          var px = q === 0 ? x : q === 1 ? -y : q === 2 ? -x : y;
          var py = q === 0 ? y : q === 1 ? x : q === 2 ? -y : -x;
          g[q || k ? 'lineTo' : 'moveTo'](px, py);
        }
      }
      g.closePath();
      g.fillStyle = color;
      g.fill();
    }
    sprites[key] = canvas;
    return canvas;
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
        // Gone at FAR, whichever way the particle lies. Distances are spawn()'s, with y unsquashed by 0.6, where the
        // mark's circle is `edge` away in this particle's direction.
        var d = Math.hypot(p[o], p[o + 1] / 0.6);
        var edge = (0.55 * mark * d) / (Math.hypot(p[o], p[o + 1]) || 1);
        // A particle keeps its light for most of its way and gives it up over the last third: fading all the way
        // from the mark, most of the field stood at half strength, grey on the page's blue.
        var fade = clamp((far - d) / ((far - edge) * 0.34), 0, 1);
        // The top 12 px stay empty: under a header, a particle on the page's first rows reads as a speck on its edge.
        var alpha = p[o + 6] * (1 - out) * fade * Math.min(1, (y - 12) / 12, (h - y) / 12, x / 24, (w - x) / 24);
        var image = images[p[o + 7]];
        if (!image) {
          continue;
        }
        // On whole device pixels, at a whole size: a sprite a few pixels across laid between pixels is a smudge.
        var size = Math.round(image.width * overshoot(Math.min(1, age / 200)));
        if (alpha <= 0 || size <= 0) {
          continue;
        }
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(image, Math.round(x * dpr - size / 2), Math.round(y * dpr - size / 2), size, size);
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
  // This page goes on from one the browser has unloaded: its field is the same field to the eye, so it starts whole
  // and with no rush.
  var continuing = false;

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
    // The mark on show: a giveaway's stage holds both prizes' and keeps one out of sight.
    var marks = stage.querySelectorAll('.pm-mark[data-icon3d]');
    var mark = null;
    for (var k = 0; k < marks.length && !mark; k++) {
      if (marks[k].getClientRects().length) {
        mark = marks[k];
      }
    }
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
      if (!taken && !continuing && !reducedMotion()) {
        // On a launch the mark rises to its slot from the screen's middle (premiumbot.css fx-mark-rise): the
        // field's rush is from the mark, so it waits for the mark to land.
        var rising = false;
        if (mark && typeof mark.getAnimations === 'function') {
          var runs = mark.getAnimations();
          for (var a = 0; a < runs.length; a++) {
            rising = rising || (runs[a].animationName === 'fx-mark-rise' && runs[a].playState !== 'finished');
          }
        }
        if (rising) {
          var field = entry.field;
          var landed = function(event) {
            if (event.animationName === 'fx-mark-rise') {
              mark.removeEventListener('animationend', landed);
              mark.removeEventListener('animationcancel', landed);
              if (entry.field === field && stages.indexOf(entry) >= 0) {
                field.intro();
              }
            }
          };
          mark.addEventListener('animationend', landed);
          mark.addEventListener('animationcancel', landed);
        } else {
          entry.field.intro();
        }
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
      // A phone's three device pixels to one are the field's too: at two it would be drawn enlarged by half.
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
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

  // ===== Confetti of our own, over the whole screen, once: foil in the mark's colours. Ribbons, discs and small
  // stars are thrown out of the mark as it lands, turn over as they fly, each face catching the light in its turn,
  // slow in the air and fall, swaying; a thinner fall follows them from above the screen. A piece's size is its
  // distance: the larger fall faster and pass in front =====

  // A giveaway's foil is in the features' colours, and its signs are a boost's bolt in place of the star: boosts
  // are what a giveaway gives a channel.
  var CONFETTI_FOIL = {
    premium: ['#55a5ff', '#7d8bff', '#a767ff', '#c9a6ff', '#ffffff', '#ffd66b'],
    stars: ['#ffc43d', '#ffdc6c', '#ffab2e', '#fff3c4', '#ffffff', '#ff9f1c'],
    giveaway: ['#ef6922', '#e3433c', '#cb3e6d', '#a34cd7', '#8958ff', '#5b79ff', '#4492ff', '#41a6a5', '#3dbd4a', '#ffffff']
  };
  var CONFETTI_BOLT = [1.5, -7.5, -4, 1, -0.5, 1, -1.5, 7.5, 4, -1, 0.5, -1];
  // Pieces thrown from the mark, and pieces that fall from above after them.
  var CONFETTI_BURST = 90;
  var CONFETTI_RAIN = 46;
  // Per piece: x, y, vx, vy, turn, spin, flip, flip speed, depth, shape, colour, born, life.
  var CONFETTI_STRIDE = 13;

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

  function confetti(host, colors, bolts) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var out = effectLayer(host, 'fx-confetti', w, h);
    if (!out) {
      return;
    }
    var ctx = out.ctx;
    var dpr = out.dpr;
    var mark = host.querySelector(MEDIA);
    var from = mark ? mark.getBoundingClientRect() : null;
    var ox = from ? from.left + from.width / 2 : w / 2;
    var oy = from ? from.top + from.height / 2 : h * 0.4;
    var count = CONFETTI_BURST + CONFETTI_RAIN;
    var p = new Float32Array(count * CONFETTI_STRIDE);
    for (var i = 0; i < count; i++) {
      var thrown = i < CONFETTI_BURST;
      var a = range(0, Math.PI * 2);
      // Most of the throw stays near the mark and a few pieces go far: an even spread would be a ring.
      var v = thrown ? (240 + Math.pow(Math.random(), 0.55) * 860) * Math.min(1.2, h / 760) : 0;
      p.set([
        thrown ? ox : range(0, w), thrown ? oy : range(-0.5 * h, -20),
        thrown ? Math.cos(a) * v : range(-30, 30), thrown ? Math.sin(a) * v - 260 : range(60, 150),
        range(0, Math.PI * 2), range(-6, 6), range(0, Math.PI * 2), range(5, 13), range(0.6, 1.5),
        // Three ribbons to a disc and a star; with bolts, two ribbons to a disc and two bolts.
        i % 5 < (bolts ? 2 : 3) ? 0 : i % 5 === (bolts ? 2 : 3) ? 1 : 2, Math.floor(Math.random() * colors.length),
        thrown ? range(0, 0.08) : range(0.3, 1.3), thrown ? range(2.2, 3.6) : range(3, 4.4)
      ], i * CONFETTI_STRIDE);
    }
    // The sign among the pieces: a four-pointed star of radius r round the origin, or a boost's bolt as tall as
    // a ribbon and a quarter.
    var sign = function(r) {
      for (var k = 0; k < (bolts ? CONFETTI_BOLT.length / 2 : 8); k++) {
        if (bolts) {
          ctx[k ? 'lineTo' : 'moveTo'](CONFETTI_BOLT[2 * k], CONFETTI_BOLT[2 * k + 1]);
        } else {
          var reach = k % 2 ? r * 0.4 : r;
          var at = k * Math.PI / 4;
          ctx[k ? 'lineTo' : 'moveTo'](Math.cos(at) * reach, Math.sin(at) * reach);
        }
      }
      ctx.closePath();
    };
    playEffect(out.canvas, ctx, function(dt, age) {
      var air = Math.exp(-1.9 * dt);
      var alive = false;
      for (var o = 0, n = 0; o < p.length; o += CONFETTI_STRIDE, n++) {
        var lived = age - p[o + 11];
        if (lived < 0) {
          alive = true;
          continue;
        }
        if (lived > p[o + 12] || p[o + 1] > h + 40) {
          continue;
        }
        alive = true;
        var depth = p[o + 8];
        // Air takes the throw's speed; the fall settles at a pace of the piece's own, and the piece sways as it
        // turns over.
        p[o + 2] = p[o + 2] * air + Math.cos(p[o + 6] * 0.5 + n) * 70 * depth * dt;
        p[o + 3] = p[o + 3] * air + 520 * depth * dt;
        p[o] += p[o + 2] * dt;
        p[o + 1] += p[o + 3] * dt;
        p[o + 4] += p[o + 5] * dt;
        p[o + 6] += p[o + 7] * dt;
        var face = Math.cos(p[o + 6]);
        var alpha = Math.min(1, lived / 0.1, (p[o + 12] - lived) / 0.6, (h + 40 - p[o + 1]) / 80);
        if (alpha <= 0) {
          continue;
        }
        var size = depth * dpr;
        var cos = Math.cos(p[o + 4]);
        var sin = Math.sin(p[o + 4]);
        // Turned over its own long axis: its height is the face's share of it, never quite edge on.
        var tall = Math.max(0.14, Math.abs(face));
        ctx.setTransform(cos * size, sin * size, -sin * size * tall, cos * size * tall, p[o] * dpr, p[o + 1] * dpr);
        ctx.beginPath();
        if (p[o + 9] === 0) {
          ctx.rect(-2.5, -6, 5, 12);
        } else if (p[o + 9] === 1) {
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
        } else {
          sign(6.5);
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colors[p[o + 10]];
        ctx.fill();
        // The back of the foil is darker; a face square to the eye flashes.
        if (face < 0) {
          ctx.globalAlpha = alpha * 0.3;
          ctx.fillStyle = '#000';
          ctx.fill();
        } else if (face > 0.9) {
          ctx.globalAlpha = alpha * (face - 0.9) * 5;
          ctx.fillStyle = '#fff';
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      return alive;
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

  // On a paid result the show follows the mark's pop (fx.css, the state screens' entrance), which has all but landed
  // by then.
  var BURST_AFTER_MS = 160;
  var burstTimer = 0;

  // How long until a result's mark stands where the show is thrown from. A mark kept from the page before glides
  // to its place here, and one that takes another's place turns in after it (premiumbot-3d.js glide, premiumbot.js
  // heroTurn): both are the scripts' own animations on the mark, and the show waits them out. Thrown before
  // that, from where the mark will be or from where it was, the confetti came out of thin air.
  function landing(mark) {
    var wait = BURST_AFTER_MS;
    var runs = mark && typeof mark.getAnimations === 'function' ? mark.getAnimations() : [];
    for (var i = 0; i < runs.length; i++) {
      var timing = runs[i].effect && runs[i].effect.getComputedTiming ? runs[i].effect.getComputedTiming() : null;
      if (timing && !runs[i].animationName && isFinite(timing.endTime)) {
        wait = Math.max(wait, timing.endTime - (runs[i].currentTime || 0));
      }
    }
    return wait;
  }

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

  // ===== A docked bar that stays through a page change keeps its place and its fill, and its words roll to the new
  // page's, as the paywall's roll when a plan is chosen: words swapped in one frame on a button that stands still
  // would be the one thing on the page that is not brought in. The label last shown is kept by its element, which
  // still has its words after its page has left the document =====

  var barLabel = null;

  function mountBar(root) {
    var was = barLabel ? barLabel.textContent : '';
    var all = root.querySelectorAll('.cta-bar .cta-button .cta-label');
    var label = null;
    for (var i = 0; i < all.length && !label; i++) {
      if (all[i].getClientRects().length) {
        label = all[i];
      }
    }
    barLabel = label;
    if (!label || !was || was === label.textContent || !label.closest('.cta-bar.is-kept') || document.documentElement.classList.contains('fx-snap')) {
      return;
    }
    var text = label.textContent;
    label.textContent = was;
    roll(label.parentNode, function() {
      label.textContent = text;
    });
  }

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
  // The band of light in the label's words: its picture is 2000 px wide with the band in the middle, and at rest
  // the band stands 40 px before the words (fx.css, which sets the same numbers).
  var WORDS_LIT_MID = 1000;
  var WORDS_LIT_PARK = -40;
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
    // The label's words catch the light after its star: a band of light in their ink (fx.css, the words' picture)
    // goes through them under the light's point, on the point's own clock and easing. The point is `lap / COMET_HOME`
    // px on at the run's end, counted along the ring, and passes words that start after the star on its way out and
    // words before it on its way home; the band keeps to the words' own length and waits beside them otherwise,
    // so their picture always covers them.
    if (spark && lap > 0) {
      var from = spark.getBoundingClientRect().left + spark.offsetWidth / 2;
      var words = path.tile.querySelectorAll('.plan-tab > .plan-tab-label, .plan-tab > .badge');
      for (var k = 0; k < words.length; k++) {
        var at = words[k].getBoundingClientRect();
        var base = from - at.left - (at.left < from ? lap : 0);
        var start = Math.max(WORDS_LIT_PARK, base);
        var end = at.width - WORDS_LIT_PARK;
        var one = (start - WORDS_LIT_MID) + 'px';
        var two = (end - WORDS_LIT_MID) + 'px';
        lit(words[k].animate([
          {backgroundPositionX: one, offset: 0},
          {backgroundPositionX: one, offset: clamp((start - base) * COMET_HOME / lap, 0, 1)},
          {backgroundPositionX: two, offset: clamp((end - base) * COMET_HOME / lap, 0, 1)},
          {backgroundPositionX: two, offset: 1}
        ], {delay: delay, duration: COMET_MS, easing: EASE_IN_OUT}));
      }
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
  // rolls down to its own. The sheet keeps the clock: it starts the rate's fade when the rate's turn comes, and the
  // script, hearing that start, sets the drum, which waits for the sheet's --fx-drop and rolls then, on every tile
  // at the same moment. A tap on the plans ends it all at once, so a plan is always chosen among final values =====

  // The rate stands on the struck figure at least this long, fading in as the sheet fades it, before its strip moves.
  var WAS_HOLD_MS = 80;
  var WAS_ROLL_MS = 520;
  // At the drop the figure the rate first showed is struck where it stands, in WAS_STRIKE_MS; WAS_MOVE_AFTER_MS
  // after the drop it sets off for the struck price's place and is there WAS_MOVE_MS later. The drum starts at
  // the drop too: it eases in, so the rate's own figure shows from below just as the struck one clears its
  // place. The sheet shows the struck price itself over the last WAS_SWAP_MS of the way (fx.css .plan-was,
  // which counts the same numbers) and the figure that came then goes.
  var WAS_STRIKE_MS = 200;
  var WAS_MOVE_AFTER_MS = 120;
  var WAS_MOVE_MS = 380;
  var WAS_SWAP_MS = 60;

  // The figure a rate first shows, as a thing of its own that can leave the rate's place: a copy of the rate laid
  // over it, with the struck price's bar across it. At the drop the bar is drawn, then the copy goes to the struck
  // price's place while its type goes to that price's: size, weight, spacing, line and grey. It is set anew at
  // every size on the way, not scaled as a picture, so at the end it is the struck price to the letter and the
  // sheet's own can take its place unseen; a scaled copy of the larger face came out a pixel narrower, and the
  // words were seen to shift. Null where the struck price has no place of its own on the rate's line, a row too
  // narrow for both: the drum rolls the figure out then, as it did.
  function wasGhost(rate, was, hold) {
    var from = rate.getBoundingClientRect();
    var to = was.getBoundingClientRect();
    if (!from.width || !to.width || Math.abs(to.top + to.height / 2 - from.top - from.height / 2) > from.height / 2) {
      return null;
    }
    var ghost = rate.cloneNode(true);
    ghost.classList.add('fx-drum-copy', 'fx-was-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    rate.parentNode.appendChild(ghost);
    var at = ghost.getBoundingClientRect();
    ghost.style.left = from.left - at.left + 'px';
    ghost.style.top = from.top - at.top + 'px';
    var bar = document.createElement('i');
    bar.className = 'fx-was-bar';
    ghost.appendChild(bar);
    var mine = getComputedStyle(ghost);
    var its = getComputedStyle(was);
    var words = document.createRange();
    words.selectNodeContents(was);
    var spacing = function(value) {
      return value === 'normal' ? '0px' : value;
    };
    var leave = hold + WAS_MOVE_AFTER_MS;
    ghost.animate([{opacity: 0}, {opacity: 1}], WAS_HOLD_MS);
    // The bar lies as the struck price's own does, tilted about its middle, and is drawn from its start end: it is
    // moved half its length back, scaled, and moved on again, along its own tilt.
    var back = mine.direction === 'rtl' ? '50%' : '-50%';
    var on = mine.direction === 'rtl' ? '-50%' : '50%';
    bar.animate([
      {transform: 'rotate(-8deg) translateX(' + back + ') scaleX(0) translateX(' + on + ')'},
      {transform: 'rotate(-8deg) translateX(' + back + ') scaleX(1) translateX(' + on + ')'}
    ], {delay: hold, duration: WAS_STRIKE_MS, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', fill: 'backwards'});
    // The copy's box is its words', set from its start corner: at the end it is as wide as the struck price's
    // words and as tall as its line, and its middle is moved onto that price's middle.
    var endX = to.left + to.width / 2 - from.left - words.getBoundingClientRect().width / 2;
    var endY = to.top + to.height / 2 - from.top - to.height / 2;
    ghost.animate([
      {
        transform: 'translate(0px, 0px)', color: mine.color, fontSize: mine.fontSize, lineHeight: mine.lineHeight,
        fontWeight: mine.fontWeight, letterSpacing: spacing(mine.letterSpacing)
      },
      {
        transform: 'translate(' + endX.toFixed(2) + 'px, ' + endY.toFixed(2) + 'px)', color: its.color, fontSize: its.fontSize,
        lineHeight: its.lineHeight, fontWeight: its.fontWeight, letterSpacing: spacing(its.letterSpacing)
      }
    ], {delay: leave, duration: WAS_MOVE_MS, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards'});
    var gone = function() {
      if (ghost.parentNode) {
        ghost.parentNode.removeChild(ghost);
      }
    };
    ghost.animate([{opacity: 1}, {opacity: 0}], {delay: leave + WAS_MOVE_MS, duration: WAS_SWAP_MS, fill: 'forwards'}).onfinish = gone;
    // Frames may never come; the copy must not be left standing.
    setTimeout(gone, leave + WAS_MOVE_MS + WAS_SWAP_MS + 200);
    return ghost;
  }
  var planGroups = [];

  // How long a rate whose fade has just begun waits before it rolls: what is left until --fx-drop, which the sheet
  // sets in ms on the clock the fade runs on. Read off the fade's own clock and not the time of the call, so tiles
  // whose fades began apart, and were heard a frame late, still roll as one.
  function dropHold(rate) {
    var drop = parseFloat(getComputedStyle(rate).getPropertyValue('--fx-drop'));
    var runs = drop && typeof rate.getAnimations === 'function' ? rate.getAnimations() : [];
    for (var i = 0; i < runs.length; i++) {
      if (runs[i].animationName === 'fx-in-roll') {
        return Math.max(WAS_HOLD_MS, drop - (runs[i].currentTime || 0));
      }
    }
    return WAS_HOLD_MS;
  }

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
    var hold = dropHold(rate);
    var landed = hold;
    if (strip.length) {
      rate.textContent = strip[0];
      // The figure the rate shows first leaves sideways as the struck price (wasGhost), and the drum only brings
      // the rate's own figure in: the line it would roll out is kept out of sight. With no ghost the drum rolls
      // that line out, and it fades in first, new to the eye.
      var ghost = wasGhost(rate, was, hold);
      for (i = 1; i <= strip.length; i++) {
        landed = roll(rate, writes(rate, i < strip.length ? strip[i] : now), {delay: hold, duration: WAS_ROLL_MS});
      }
      var first = rate.parentNode.querySelector('.fx-drum-copy:not(.fx-was-ghost)');
      if (first && ghost) {
        first.style.visibility = 'hidden';
      } else if (first) {
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
    var ghosts = group.querySelectorAll('.fx-was-ghost');
    for (var g = 0; g < ghosts.length; g++) {
      ghosts[g].parentNode.removeChild(ghosts[g]);
    }
    for (var r = rolls.length - 1; r >= 0; r--) {
      if (group.contains(rolls[r].line)) {
        endRoll(rolls[r]);
      }
    }
    var running = typeof document.getAnimations === 'function' ? document.getAnimations() : [];
    for (var i = 0; i < running.length; i++) {
      var name = running[i].animationName;
      var el = running[i].effect && running[i].effect.target;
      if (typeof name !== 'string' || name.indexOf('fx-in-') !== 0 || !el || !group.contains(el)) {
        continue;
      }
      if (!el.matches('.plan-was, .plan-rate, .plan-unit')) {
        // What waits for the drop, a pill or the parts of a choice, is there at once too; a part already on its way
        // runs on.
        if (el.matches('.plan-tab, .plan-fill, .cell-check, .cell-check .icon') && running[i].currentTime < running[i].effect.getTiming().delay) {
          running[i].cancel();
        }
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

  // ===== The wall of features, in a home page's open tile (premiumbot.css .section--perks.is-open): the three rows
  // of feature icons, going round. Each row becomes a strip of its own that holds its tiles twice over, so it can run on with no
  // end: the script moves a strip by a transform and takes it back by one round of its tiles whenever it has gone
  // that far, which shows nothing. The rows drift at paces of their own, the lowest the fastest, which reads as
  // depth. A finger moves them sideways, each by its own share of the finger's way, and a let-go leaves them
  // running the way they were thrown until that dies away into the drift. Tiles under a finger, or under a cursor,
  // grow, the nearest the most, and none so far as to touch its neighbour. A tap on a tile names its feature in a
  // cloud over it (cloudSay), and the rows hold still while the cloud is up: a touch anywhere puts the cloud away,
  // the same tile tapped again leaves it away, and it goes by itself after CLOUD_MS. Nothing done on the icons
  // presses the tile or opens its link, which the line over them does. With motion reduced the rows stand until a
  // finger moves them =====

  var unlocked = null;
  // A row's drift in px a second, the top row first, and its share of a finger's way.
  var ROW_DRIFT = [-10, -16, -22];
  var ROW_GAIN = [0.85, 1, 1.15];
  // A row's speed goes over to where it is headed in ROW_EASE_S.
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
  // The narrowest a cloud is tried at: room for its tip clear of both corners.
  var CLOUD_LEAST = 64;

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
  function cloudSay(tile, place, under) {
    var section = unlocked.host || unlocked.strip.closest('.section');
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
    // The cloud is as wide as its words need, whatever the language: the narrowest it can be without taking one more
    // line than it does at its widest. Left to the sheets it stands at its widest with the words evened out inside
    // it, and air at both sides of them.
    // Its widest is taken whole pixels up: a width cut down to a whole pixel would break a line that just fitted.
    var tall = cloud.offsetHeight;
    var wide = Math.ceil(parseFloat(getComputedStyle(cloud).width) || cloud.offsetWidth);
    var narrow = Math.min(wide, CLOUD_LEAST);
    // A word that cannot break takes no new line when it has no room: it runs out of its line's box instead.
    var spills = function() {
      for (var c = 0; c < cloud.children.length; c++) {
        if (cloud.children[c].scrollWidth > cloud.children[c].clientWidth) {
          return true;
        }
      }
      return false;
    };
    while (wide - narrow > 1) {
      var tried = (narrow + wide) >> 1;
      cloud.style.width = tried + 'px';
      if (cloud.offsetHeight > tall || spills()) {
        narrow = tried;
      } else {
        wide = tried;
      }
    }
    cloud.style.width = wide + 'px';
    var box = section.getBoundingClientRect();
    // `place` is where the tile will stand, where that is not where it stands now (a tile the rings bring forward).
    var at = place || tile.getBoundingClientRect();
    var width = cloud.offsetWidth;
    var middle = Math.max(CLOUD_TIP, Math.min(box.width - CLOUD_TIP, at.left + at.width / 2 - box.left));
    var left = Math.max(CLOUD_EDGE, Math.min(box.width - width - CLOUD_EDGE, middle - width / 2));
    var top = at.top - box.top - cloud.offsetHeight - CLOUD_GAP;
    // Among the rings the cloud keeps inside their layer, which is the screen. Over a home page's tile it may stand
    // over what lies above the tile, down to the screen's top. `under` asks for the cloud under the tile where
    // there is room for it there, down to `under` px from the box's top: the rings ask so for a tile that stands
    // under the star and the words, whose cloud would lie over them.
    var room = unlocked.host ? top : at.top - cloud.offsetHeight - CLOUD_GAP - CLOUD_EDGE;
    var below = at.bottom - box.top + CLOUD_GAP;
    if (room < 0 || (under && below + cloud.offsetHeight + CLOUD_EDGE <= under)) {
      top = below;
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
    var stand = u.said || reducedMotion();
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
    // A wall that is closing stands still (perksClose).
    var on = appActive && document.visibilityState !== 'hidden' && !u.frozen;
    if (on && !u.raf) {
      u.last = 0;
      u.raf = requestAnimationFrame(u.frame || unlockedFrame);
    } else if (!on && u.raf) {
      cancelAnimationFrame(u.raf);
      u.raf = 0;
    }
  }

  // The wall stands on a home page while its tile of features is open (perksSet). On the paid result the tiles go
  // round the star instead (orbitMount), and the wall is not built. `order` is the tiles in the order the
  // rows take them, where that is not the page's.
  function mountUnlocked(root, order) {
    if (typeof requestAnimationFrame !== 'function') {
      return;
    }
    // On the result of a Premium purchase the tiles go round the star (orbitMount below). A gift's result and a
    // giveaway's keep their own layout: the features there are someone else's, and rings of them round a sticker
    // read as an ornament.
    var screen = order ? null : root.querySelector('.result-screen');
    var held = screen ? screen.querySelector('.section--unlocked .perk-strip') : null;
    if (held && orbitMount(screen, held, [].slice.call(held.querySelectorAll('.icon-tile')))) {
      return;
    }
    var strip = root.querySelector('.section--perks.is-open .perk-strip');
    if (!strip) {
      return;
    }
    var tiles = order || [].slice.call(strip.querySelectorAll('.icon-tile'));
    if (!tiles.length) {
      return;
    }
    var each = Math.ceil(tiles.length / ROW_DRIFT.length);
    var size = tiles[0].offsetWidth;
    var step = size + (parseFloat(getComputedStyle(strip).columnGap) || 0);
    var width = strip.clientWidth;
    // A strip that is not laid out, with no size to its tiles or to itself, makes no wall: it stays as the sheets
    // set it.
    if (!step || !width) {
      return;
    }
    // As many rounds of a row as cover the window wherever the row stands in its round.
    var rounds = Math.min(Math.ceil(width / (each * step)) + 1, 12);
    var rows = [];
    for (var r = 0; r * each < tiles.length; r++) {
      var el = document.createElement('span');
      el.className = 'perk-row';
      el.style.zIndex = String(ROW_DRIFT.length - r);
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
      held: null, dragged: 0, raf: 0, last: 0, lens: {x: 0, y: 0, k: 0, on: false, shown: false}
    };
    var u = unlocked;
    unlockedMeasure();
    // Any touch puts the cloud away. One on an icon also lifts the press the page script has just put on the tile
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
      var tile = u.frozen || u.dragged > ROW_TAP_PX ? null : event.target.closest('.icon-tile');
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
    if (u.unmount) {
      u.unmount(u);
      unlocked = null;
      return;
    }
    u.strip.removeEventListener('pointerdown', u.down);
    u.strip.removeEventListener('pointermove', u.move);
    u.strip.removeEventListener('pointerup', u.up);
    u.strip.removeEventListener('pointercancel', u.up);
    u.strip.removeEventListener('pointerleave', u.up);
    u.link.removeEventListener('click', u.click, true);
    // The tiles go back to the strip row after row, a row from its tile `lead` on where one is set (perksClose),
    // and the copies go with their rows.
    for (var r = 0; r < u.rows.length; r++) {
      var row = u.rows[r];
      for (var i = 0; i < row.own.length; i++) {
        var tile = row.own[(i + (row.lead || 0)) % row.own.length];
        tile.style.transform = '';
        u.strip.appendChild(tile);
      }
      if (row.el.parentNode) {
        row.el.parentNode.removeChild(row.el);
      }
    }
    u.strip.classList.remove('is-live');
    unlocked = null;
  }

  // ===== The paid result's hero (premiumbot.css .orbit). The star and its words stand in the screen's middle and
  // every feature's tile goes round them on three rings: the inner ring's tiles are the smallest, the dimmest and
  // the slowest, the outer ring's the largest and the fastest, which reads as depth and keeps the middle calm. A
  // ring is the outline of the star and the words pushed out by a set distance, so its tiles pass as near over
  // the star as under the words and never come over either; where the screen is narrower than a ring, its tiles
  // pass out at one side and come back at the other. A
  // ring takes every third tile of the page's order, so each carries the whole of the tiles' colours round it, and
  // a nearer ring lies over a farther one: where two tiles pass, the nearer covers the edge of the farther. The
  // tiles come out of the star, each ring unwinding as it opens. A finger turns the rings, each by its own share,
  // and a let-go leaves them turning the way they were thrown until that dies away into the drift. A tap names a
  // feature in the cloud, and the rings stand while it is up. One tile at a time catches the light, where it
  // stands: no tile changes size by itself. With motion reduced the rings stand until a finger turns them =====

  var ORBIT_SIZE = [44, 60, 84];
  // How far a ring stands shows in its tiles' faces, not in their signs: a farther tile's colour goes ORBIT_LIT of
  // the way from the page's colour to its own, and its sign keeps ORBIT_INK of its white, so a sign reads better on
  // a far tile than on a near one. A tile dimmed whole, sign and all, had a sign at 2.4 to 1 on its face.
  var ORBIT_LIT = [0.6, 0.82, 1];
  var ORBIT_INK = [0.86, 0.94, 1];
  // A ring's pace along its round in px a second, and its share of a finger's turn.
  var ORBIT_PACE = [5.5, 13.5, 26];
  var ORBIT_GAIN = [0.8, 1, 1.2];
  // The first ring's tiles keep ORBIT_CLEAR from the outline of the mark and the words; each next ring stands
  // ORBIT_STEP further out, centre to centre, the last by a little less than its tiles and the ring's before it
  // need, so the two rings' tiles overlap where they pass. A round is kept as ORBIT_PATH_STEPS points.
  var ORBIT_CLEAR = 18;
  var ORBIT_STEP = [58, 64];
  var ORBIT_PATH_STEPS = 360;
  // The first ring starts ORBIT_BORN_MS into the page and each next one ORBIT_NEXT_MS later; a ring takes
  // ORBIT_OUT_MS to open from ORBIT_FROM of its size, wound back by ORBIT_WIND of its round at first.
  var ORBIT_BORN_MS = 320;
  var ORBIT_NEXT_MS = 90;
  var ORBIT_OUT_MS = 900;
  var ORBIT_FROM = 0.3;
  var ORBIT_WIND = 0.2;
  // A tile catches the light every ORBIT_LIT_MS, for ORBIT_GLINT_MS.
  var ORBIT_LIT_MS = 1800;
  var ORBIT_GLINT_MS = 1400;
  // The fastest a throw leaves a ring, in px a second.
  var ORBIT_THROW = 900;
  // A tile whose cloud is up changes places in depth with the tiles round it, as lifts pass one another: it comes
  // forward of every ring, to ORBIT_LIFT px by its ring, takes its own colour and lies over every other tile, with
  // the cloud over it, while each tile that stood over it or beside it, within ORBIT_SINK_NEAR px of where it now
  // stands, goes back: down to ORBIT_SINK of its size and ORBIT_SINK_LIT of its colour. All go back to their own
  // depth when the cloud is put away. A far tile's cloud used to stand under the nearer tiles that passed over it.
  // The tile grows no further than the room its ring keeps from the star and the words. ORBIT_LIFT_S is the time
  // the change takes, eased.
  var ORBIT_LIFT = [66, 76, 88];
  var ORBIT_LIFT_S = 0.09;
  var ORBIT_SINK = 0.7;
  var ORBIT_SINK_LIT = 0.6;
  var ORBIT_SINK_NEAR = 10;
  // The rings shift against where the eye is, each by its depth, as things at different distances do: ORBIT_DEPTH
  // px a ring when the eye is at the screen's edge. The eye follows a cursor; with none it wanders by itself, a
  // round every ORBIT_SWAY_S seconds across and down, and takes ORBIT_EYE_S to get where it is going.
  var ORBIT_DEPTH = [4, 10, 20];
  var ORBIT_SWAY_S = [17, 23];
  var ORBIT_EYE_S = 0.35;
  // The tiles fade out over ORBIT_FADE px before a docked bar's top, which is looked for every ORBIT_BAR_MS.
  var ORBIT_FADE = 28;
  var ORBIT_BAR_MS = 500;

  // Where an element is laid out on the page, with no entrance's transform in it.
  function orbitPlace(el) {
    var x = 0;
    var y = 0;
    for (var n = el; n; n = n.offsetParent) {
      x += n.offsetLeft + (n !== el ? n.clientLeft : 0);
      y += n.offsetTop + (n !== el ? n.clientTop : 0);
    }
    return {x: x, y: y};
  }

  // The layer covers the screen, and the rings are set round the star and the words as they are laid out now.
  function orbitMeasure() {
    var u = unlocked;
    var at = orbitPlace(u.screen);
    u.w = document.documentElement.clientWidth;
    u.h = Math.max(window.innerHeight || 0, document.documentElement.clientHeight);
    u.layer.style.left = -at.x + 'px';
    u.layer.style.top = -at.y + 'px';
    u.layer.style.width = u.w + 'px';
    u.layer.style.height = u.h + 'px';
    var parts = [];
    var range = document.createRange();
    for (var i = 0; i < u.group.length; i++) {
      var el = u.group[i];
      if (!el || !el.offsetWidth) {
        continue;
      }
      var place = orbitPlace(el);
      // A block of words is as wide as its row; the words themselves are what a tile must keep clear of.
      range.selectNodeContents(el);
      var words = range.getBoundingClientRect().width;
      parts.push({
        x: place.x + el.offsetWidth / 2, top: place.y, bottom: place.y + el.offsetHeight,
        half: (words && words < el.offsetWidth ? words : el.offsetWidth) / 2
      });
    }
    if (!parts.length) {
      return;
    }
    // The outline the rings keep to is the hull of every part's corners, and a ring is that outline pushed out by a
    // set distance: its tiles pass as near over the mark as beside the words and under them. A circle round the
    // lot, which this was, stood three times as far from the foot of a wide title as from the top of the star.
    var corners = [];
    var top = Infinity;
    var bottom = -Infinity;
    for (i = 0; i < parts.length; i++) {
      corners.push(
        [parts[i].x - parts[i].half, parts[i].top], [parts[i].x + parts[i].half, parts[i].top],
        [parts[i].x - parts[i].half, parts[i].bottom], [parts[i].x + parts[i].half, parts[i].bottom]
      );
      top = Math.min(top, parts[i].top);
      bottom = Math.max(bottom, parts[i].bottom);
    }
    u.cx = parts[0].x;
    u.cy = (top + bottom) / 2;
    var out = ORBIT_CLEAR + ORBIT_SIZE[0] / 2;
    for (var j = 0; j < u.rings.length; j++) {
      orbitPath(u.rings[j], corners, out);
      out += ORBIT_STEP[j] || ORBIT_STEP[ORBIT_STEP.length - 1];
    }
    var box = u.layer.getBoundingClientRect();
    u.left = box.left;
    u.top = box.top;
    orbitEnd(u);
  }

  // A ring's round: the outline of `corners` pushed out by `out` px, as points with the length run up to each. For
  // each way round, the point is the corner that lies farthest that way, moved `out` that way: round a corner
  // the points make an arc, and where the farthest corner changes they step along a side. A ring keeps its place
  // on its round when the round changes length.
  function orbitPath(ring, corners, out) {
    var xs = [];
    var ys = [];
    var run = [0];
    for (var k = 0; k <= ORBIT_PATH_STEPS; k++) {
      var a = (k % ORBIT_PATH_STEPS) * 2 * Math.PI / ORBIT_PATH_STEPS;
      var c = Math.cos(a);
      var s = Math.sin(a);
      var best = 0;
      var far = -Infinity;
      for (var n = 0; n < corners.length; n++) {
        var reach = corners[n][0] * c + corners[n][1] * s;
        if (reach > far) {
          far = reach;
          best = n;
        }
      }
      xs.push(corners[best][0] + out * c);
      ys.push(corners[best][1] + out * s);
      if (k) {
        run.push(run[k - 1] + Math.sqrt((xs[k] - xs[k - 1]) * (xs[k] - xs[k - 1]) + (ys[k] - ys[k - 1]) * (ys[k] - ys[k - 1])));
      }
    }
    if (ring.length) {
      ring.at *= run[ORBIT_PATH_STEPS] / ring.length;
    }
    ring.xs = xs;
    ring.ys = ys;
    ring.run = run;
    ring.length = run[ORBIT_PATH_STEPS];
  }

  // The point `way` px along a ring's round, into `spot`.
  function orbitAt(ring, way, spot) {
    way %= ring.length;
    if (way < 0) {
      way += ring.length;
    }
    var lo = 0;
    var hi = ORBIT_PATH_STEPS;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (ring.run[mid] <= way) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    var span = ring.run[hi] - ring.run[lo];
    var part = span ? (way - ring.run[lo]) / span : 0;
    spot[0] = ring.xs[lo] + (ring.xs[hi] - ring.xs[lo]) * part;
    spot[1] = ring.ys[lo] + (ring.ys[hi] - ring.ys[lo]) * part;
  }

  // Where the tiles end: at a docked bar's top, or the screen's end. The client's own button stands outside the
  // page, and the bar the page ends with where there is none comes after the page.
  function orbitEnd(u) {
    var bar = u.screen.querySelector('.cta-bar');
    var end = bar && bar.offsetHeight ? Math.round(bar.getBoundingClientRect().top - u.top) : u.h;
    if (end !== u.end) {
      u.end = end;
      u.layer.style.setProperty('--orbit-end', end + 'px');
    }
  }

  // One tile that stands whole on the screen catches the light: it brightens where it stands and dims again.
  function orbitGlint(u) {
    for (var n = 0; n < u.tiles.length; n++) {
      u.turn = (u.turn + 11) % u.tiles.length;
      var t = u.tiles[u.turn];
      if (t.full && typeof t.el.animate === 'function') {
        t.el.animate([
          {filter: 'brightness(1)'},
          {filter: 'brightness(' + (1.3 + 0.3 * (1 - t.ring.lit)).toFixed(2) + ')', offset: 0.45},
          {filter: 'brightness(1)'}
        ], {duration: ORBIT_GLINT_MS, easing: 'ease-in-out'});
        return;
      }
    }
  }

  function orbitFrame(now) {
    var u = unlocked;
    if (!u || !u.orbit) {
      return;
    }
    u.raf = requestAnimationFrame(orbitFrame);
    var dt = u.last ? Math.min(now - u.last, 64) / 1000 : 0;
    u.last = now;
    var still = reducedMotion();
    var stand = u.said || still;
    var ease = 1 - Math.exp(-dt / ROW_EASE_S);
    var lens = u.lens;
    lens.k += ((lens.on ? 1 : 0) - lens.k) * (1 - Math.exp(-dt / LENS_EASE_S));
    if (!lens.on && lens.k < 0.004) {
      lens.k = 0;
    }
    var reach = LENS_PX * LENS_PX;
    if (now >= u.barAt) {
      u.barAt = now + ORBIT_BAR_MS;
      orbitEnd(u);
    }
    // Where the eye is: a cursor's place, or its own slow round. It stays put while a cloud is up, whose tip points
    // at a tile.
    var eye = u.eye;
    if (!u.said) {
      var seconds = now / 1000;
      var toX = eye.on ? eye.x : still ? 0 : 0.6 * Math.sin(seconds * 2 * Math.PI / ORBIT_SWAY_S[0]);
      var toY = eye.on ? eye.y : still ? 0 : 0.6 * Math.sin(seconds * 2 * Math.PI / ORBIT_SWAY_S[1] + 1);
      var follow = 1 - Math.exp(-dt / ORBIT_EYE_S);
      eye.px += (toX - eye.px) * follow;
      eye.py += (toY - eye.py) * follow;
    }
    var open = true;
    var spot = [0, 0];
    var said = u.said ? u.said.tile : null;
    var rise = 1 - Math.exp(-dt / ORBIT_LIFT_S);
    for (var j = 0; j < u.rings.length; j++) {
      var ring = u.rings[j];
      var cx = u.cx - ORBIT_DEPTH[j] * eye.px;
      var cy = u.cy - ORBIT_DEPTH[j] * eye.py;
      if (!u.held) {
        ring.v += ((stand ? 0 : ring.pace) - ring.v) * ease;
        ring.at += ring.v * dt;
      }
      // The ring's opening: it grows out of the middle past its size by a little and settles, and its turn unwinds.
      var p = still ? 1 : Math.max(0, Math.min(1, (now - ring.born) / ORBIT_OUT_MS));
      var q = p - 1;
      var out = 1 + q * q * q;
      var size = ORBIT_FROM + (1 - ORBIT_FROM) * (1 + 1.9 * q * q * q + 0.9 * q * q);
      var wind = ORBIT_WIND * ring.length * (out - 1);
      var gap = ring.length / ring.tiles.length;
      var grow = 0.4 + 0.6 * out;
      var dim = Math.round(Math.min(1, p * 4) * 100) / 100;
      var half = ring.size / 2;
      if (p < 1) {
        open = false;
      }
      for (var i = 0; i < ring.tiles.length; i++) {
        var t = ring.tiles[i];
        orbitAt(ring, ring.at + wind + (i + ring.lead) * gap, spot);
        var x = cx + (spot[0] - u.cx) * size;
        var y = cy + (spot[1] - u.cy) * size;
        var seen = p > 0 && x > -half && x < u.w + half && y > -half && y < u.end + half;
        t.full = p === 1 && x > half && x < u.w - half && y > half + ORBIT_FADE && y < u.end - half - ORBIT_FADE;
        if (seen !== t.seen) {
          t.seen = seen;
          t.el.style.visibility = seen ? '' : 'hidden';
        }
        if (!seen) {
          continue;
        }
        t.x = x;
        t.y = y;
        // Forward, back, or at its own depth: 1, -1 or 0. Its colour changes at the start of the way, its size
        // over the way.
        var want = said === t.el ? 1 : said && t.sunk ? -1 : 0;
        if (want !== t.want) {
          t.want = want;
          t.el.style.setProperty('--orbit-lit', String(want > 0 ? 1 : want < 0 ? ring.lit * ORBIT_SINK_LIT : ring.lit));
          t.el.style.setProperty('--orbit-ink', String(want > 0 ? 1 : want < 0 ? ring.ink * 0.8 : ring.ink));
        }
        if (t.lift !== want) {
          t.lift += (want - t.lift) * (still ? 1 : rise);
          if (Math.abs(want - t.lift) < 0.004) {
            t.lift = want;
          }
        }
        // The lens under a cursor gives way to the change of depth by as much as that change has gone, and comes
        // back as it goes back. Cut off for the whole of the change, it came back all at once when the change was
        // over, a third of a second after the cloud had gone: every tile under the cursor grew in one frame.
        var near = lens.k ? 1 - ((lens.x - x) * (lens.x - x) + (lens.y - y) * (lens.y - y)) / reach : 0;
        var deep = t.lift > 0 ? 1 + (ORBIT_LIFT[j] / ring.size - 1) * t.lift : 1 + (1 - ORBIT_SINK) * t.lift;
        var by = grow * (near > 0 ? 1 + LENS_UP * lens.k * near * near * (1 - Math.abs(t.lift)) : 1) * deep;
        // A tile lies over every tile that is smaller at this moment: the larger is the nearer. So two tiles that
        // change places in depth pass one another on the way, at the moment they are the same size, and not in one
        // frame at the way's end, where a tile at rest was seen to jump over its neighbour.
        var layer = Math.round(ring.size * by);
        if (layer !== t.layer) {
          t.layer = layer;
          t.el.style.zIndex = String(layer);
        }
        var shown = 'translate3d(' + (x - half).toFixed(1) + 'px, ' + (y - half).toFixed(1) + 'px, 0)' + (by === 1 ? '' : ' scale(' + by.toFixed(3) + ')');
        if (shown !== t.shown) {
          t.shown = shown;
          t.el.style.transform = shown;
        }
        if (dim !== t.dim) {
          t.dim = dim;
          t.el.style.opacity = String(dim);
        }
      }
    }
    if (open && !stand && !u.held && now >= u.lit) {
      u.lit = now + ORBIT_LIT_MS;
      orbitGlint(u);
    }
  }

  // The rings open now: a result's show calls this as its mark lands, so the tiles leave the mark with the stars
  // and the confetti.
  function orbitOpen() {
    var u = unlocked;
    if (!u || !u.orbit) {
      return;
    }
    var now = performance.now();
    for (var j = 0; j < u.rings.length; j++) {
      if (u.rings[j].born === Infinity) {
        u.rings[j].born = now + j * ORBIT_NEXT_MS;
      }
    }
    if (u.lit === Infinity) {
      u.lit = now + u.rings.length * ORBIT_NEXT_MS + ORBIT_OUT_MS + ORBIT_LIT_MS / 2;
    }
  }

  // The tiles leave the section's strip for a layer over the whole screen. False where the mark is not laid out or
  // there are no tiles: the page stays as the sheets leave it. On a page with a show the rings wait for it to open
  // them (orbitOpen); on any other they open by themselves ORBIT_BORN_MS in.
  function orbitMount(screen, strip, tiles) {
    var mark = screen.querySelector(MEDIA);
    if (!mark || !mark.offsetWidth || !tiles.length) {
      return false;
    }
    var layer = document.createElement('div');
    layer.className = 'orbit';
    screen.appendChild(layer);
    var first = reducedMotion() ? -1e9 : screen.querySelector('.js-celebrate') ? Infinity : performance.now() + ORBIT_BORN_MS;
    var rings = [];
    var all = [];
    var j;
    for (j = 0; j < ORBIT_SIZE.length; j++) {
      rings.push({
        tiles: [], size: ORBIT_SIZE[j], lit: ORBIT_LIT[j], ink: ORBIT_INK[j], pace: ORBIT_PACE[j], gain: ORBIT_GAIN[j], at: 0, v: 0,
        xs: null, ys: null, run: null, length: 0,
        // The rings start out of line with one another, by a third of a tile's share of the round each.
        lead: j * 0.31, born: first + j * ORBIT_NEXT_MS
      });
    }
    for (var i = 0; i < tiles.length; i++) {
      var ring = rings[i % rings.length];
      var state = {el: tiles[i], ring: ring, seen: true, full: false, shown: '', dim: -1, x: 0, y: 0, lift: 0, want: 0, sunk: false, layer: -1};
      tiles[i].style.setProperty('--orbit-size', ring.size + 'px');
      tiles[i].style.setProperty('--orbit-lit', String(ring.lit));
      tiles[i].style.setProperty('--orbit-ink', String(ring.ink));
      tiles[i].style.zIndex = String(ring.size);
      tiles[i].style.opacity = '0';
      layer.appendChild(tiles[i]);
      ring.tiles.push(state);
      all.push(state);
    }
    unlocked = {
      orbit: true, frame: orbitFrame, measure: orbitMeasure, unmount: orbitUnmount,
      strip: strip, host: layer, layer: layer, screen: screen, order: tiles, tiles: all, rings: rings, rows: [],
      group: [mark, screen.querySelector('.hero-title'), screen.querySelector('.hero-subtitle')],
      said: null, was: null, held: null, dragged: 0, raf: 0, last: 0, turn: 0,
      lit: first + rings.length * ORBIT_NEXT_MS + ORBIT_OUT_MS + ORBIT_LIT_MS / 2,
      lens: {x: 0, y: 0, k: 0, on: false}, eye: {x: 0, y: 0, px: 0, py: 0, on: false},
      cx: 0, cy: 0, w: 0, h: 0, left: 0, top: 0, end: -1, barAt: 0
    };
    var u = unlocked;
    orbitMeasure();
    var angle = function(event) {
      return Math.atan2(event.clientY - u.top - u.cy, event.clientX - u.left - u.cx);
    };
    u.touch = function() {
      u.was = u.said ? u.said.tile : null;
      cloudHush();
    };
    // A cursor anywhere over the page is where the eye is; a finger is not, it turns the rings.
    u.look = function(event) {
      if (event.pointerType !== 'mouse') {
        return;
      }
      u.eye.on = event.type !== 'pointerleave';
      u.eye.x = Math.max(-1, Math.min(1, (event.clientX - u.left - u.cx) / (u.w / 2)));
      u.eye.y = Math.max(-1, Math.min(1, (event.clientY - u.top - u.cy) / (u.h / 2)));
    };
    // A finger on a tile stops the rings where they are, and keeps hold of them wherever it goes.
    u.down = function(event) {
      var tile = event.target.closest('.icon-tile');
      if (u.held || event.button || !tile) {
        return;
      }
      u.held = {id: event.pointerId, a: angle(event), t: event.timeStamp};
      u.dragged = 0;
      for (var r = 0; r < u.rings.length; r++) {
        u.rings[r].v = 0;
      }
      u.lens.x = event.clientX - u.left;
      u.lens.y = event.clientY - u.top;
      u.lens.on = true;
      if (tile.setPointerCapture) {
        try {
          tile.setPointerCapture(event.pointerId);
        } catch (error) {
          // A pointer that is already gone takes no capture; the drag ends with it.
        }
      }
    };
    u.move = function(event) {
      u.lens.x = event.clientX - u.left;
      u.lens.y = event.clientY - u.top;
      var held = u.held;
      if (!held) {
        u.lens.on = event.pointerType === 'mouse';
        return;
      }
      if (event.pointerId !== held.id) {
        return;
      }
      var a = angle(event);
      var turn = a - held.a;
      if (turn > Math.PI) {
        turn -= 2 * Math.PI;
      } else if (turn < -Math.PI) {
        turn += 2 * Math.PI;
      }
      var dt = Math.max(event.timeStamp - held.t, 1) / 1000;
      u.dragged += Math.abs(turn) * Math.sqrt(u.lens.x * u.lens.x - 2 * u.lens.x * u.cx + u.cx * u.cx + (u.lens.y - u.cy) * (u.lens.y - u.cy));
      for (var r = 0; r < u.rings.length; r++) {
        var ring = u.rings[r];
        // The finger's turn round the middle, as a way along this ring's round.
        var way = turn * ring.gain * ring.length / (2 * Math.PI);
        ring.at += way;
        ring.v = Math.max(-ORBIT_THROW, Math.min(ORBIT_THROW, ring.v * 0.5 + (way / dt) * 0.5));
      }
      held.a = a;
      held.t = event.timeStamp;
    };
    u.up = function(event) {
      if (u.held && (event.type === 'pointerleave' || event.pointerId === u.held.id)) {
        if (event.type === 'pointerleave' && event.target !== layer) {
          return;
        }
        u.held = null;
        if (reducedMotion()) {
          for (var r = 0; r < u.rings.length; r++) {
            u.rings[r].v = 0;
          }
        }
      }
      if (event.pointerType !== 'mouse' || event.type === 'pointerleave') {
        u.lens.on = false;
      }
    };
    // A tap on the tile whose cloud this touch has just put away leaves it away; a drag names nothing. The cloud is
    // set over where the tile will stand once it has come forward: about its own middle, at its ring's forward
    // size.
    u.click = function(event) {
      var tile = u.dragged > ROW_TAP_PX ? null : event.target.closest('.icon-tile');
      if (tile && tile !== u.was) {
        for (var r = 0; r < u.rings.length; r++) {
          u.rings[r].v = 0;
        }
        var place = null;
        var mine = null;
        var size = 0;
        var k;
        for (k = 0; k < u.tiles.length; k++) {
          if (u.tiles[k].el === tile) {
            mine = u.tiles[k];
            size = ORBIT_LIFT[u.rings.indexOf(mine.ring)];
            var left = u.left + mine.x - size / 2;
            var top = u.top + mine.y - size / 2;
            place = {left: left, top: top, width: size, height: size, right: left + size, bottom: top + size};
          }
        }
        // The tiles that go back as this one comes forward: every one whose box comes within ORBIT_SINK_NEAR px of
        // the box this one will fill.
        for (k = 0; k < u.tiles.length; k++) {
          var other = u.tiles[k];
          var room = mine ? (size + other.ring.size) / 2 + ORBIT_SINK_NEAR : 0;
          other.sunk = !!mine && other !== mine && other.seen && Math.abs(other.x - mine.x) < room && Math.abs(other.y - mine.y) < room;
        }
        // Its cloud stands on the side of it away from the star and the words: over a tile above their middle,
        // under one below it, down to where the tiles end.
        cloudSay(tile, place, mine && mine.y > u.cy ? u.end : 0);
      }
      u.was = null;
    };
    document.addEventListener('pointerdown', u.touch);
    document.addEventListener('pointermove', u.look);
    document.documentElement.addEventListener('pointerleave', u.look);
    layer.addEventListener('pointerdown', u.down);
    layer.addEventListener('pointermove', u.move);
    layer.addEventListener('pointerup', u.up);
    layer.addEventListener('pointercancel', u.up);
    layer.addEventListener('pointerleave', u.up);
    layer.addEventListener('click', u.click);
    unlockedRun();
    return true;
  }

  // The tiles go back to the strip in the page's order, as the sheets alone hold them.
  function orbitUnmount(u) {
    document.removeEventListener('pointermove', u.look);
    document.documentElement.removeEventListener('pointerleave', u.look);
    u.layer.removeEventListener('pointerdown', u.down);
    u.layer.removeEventListener('pointermove', u.move);
    u.layer.removeEventListener('pointerup', u.up);
    u.layer.removeEventListener('pointercancel', u.up);
    u.layer.removeEventListener('pointerleave', u.up);
    u.layer.removeEventListener('click', u.click);
    for (var i = 0; i < u.order.length; i++) {
      var tile = u.order[i];
      tile.style.transform = '';
      tile.style.opacity = '';
      tile.style.visibility = '';
      tile.style.zIndex = '';
      tile.style.removeProperty('--orbit-size');
      tile.style.removeProperty('--orbit-lit');
      tile.style.removeProperty('--orbit-ink');
      u.strip.appendChild(tile);
    }
    if (u.layer.parentNode) {
      u.layer.parentNode.removeChild(u.layer);
    }
  }

  // ===== What Premium includes, on a home page and on a gift's result (premiumbot.css .section--perks): one tile
  // whose second line is a row of every feature's icon going by. A tap opens the tile where it stands and opens no
  // page: the tile grows, its second line becomes the wall of three rows above, with the same lens and the same
  // cloud over a tapped icon, and the page under the tile moves down by as much. A tap on the tile's first line
  // closes it. The tile's link stays for a client without this script =====

  var perks = null;
  var PERKS_MS = 420;
  var PERKS_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  // The closed line as the sheets run it (premiumbot.css .perk-strip, perk-run): a tile every 36 px, and the row
  // one step on every 2 s.
  var LINE_STEP = 36;
  var LINE_BEAT_S = 2;

  // The page follows the tile's foot where the tile grows past where the page's own end begins, the screen's end
  // less its foot padding, which holds the client's safe area, or a docked bar. It goes the way in step with the
  // growth, on the same curve, from the first frame. The page is only as tall as the tile has grown so far, so
  // such a scroll was cut to nothing for the first quarter of the way and then came in one jump; and for a foot a
  // few pixels over, the whole screen crept by those pixels a step at a time and was thrown back in one frame at
  // the closing. So the page is held at its full height while the tile's own is on its way (perksHold), and a foot
  // within PERKS_NEAR px of its place moves nothing.
  var PERKS_NEAR = 8;

  function perksEnd(p) {
    var bar = document.querySelector('.cta-bar');
    if (bar && getComputedStyle(bar).position !== 'static') {
      return window.innerHeight - 16 - bar.offsetHeight;
    }
    var screen = p.cell.closest('.screen');
    return window.innerHeight - (screen ? parseFloat(getComputedStyle(screen).paddingBottom) || 16 : 16);
  }

  // The page keeps a set height for the time of a move, so a scroll that goes in step with the tile is never cut
  // short by a page not yet, or no longer, that tall.
  function perksHold(p, height) {
    if (p.held === undefined) {
      p.held = document.body.style.minHeight;
    }
    document.body.style.minHeight = height + 'px';
  }

  function perksFree(p) {
    if (p.held !== undefined) {
      document.body.style.minHeight = p.held;
      p.held = undefined;
    }
  }

  // The page's scroll goes from where it is to `to` in step with `move`, an animation of the tile's height.
  function perksScroll(p, move, to) {
    var from = window.pageYOffset;
    var step = function() {
      var timing = move.effect && move.effect.getComputedTiming ? move.effect.getComputedTiming() : null;
      var done = !timing || timing.progress === null || timing.progress === undefined ? 1 : timing.progress;
      window.scrollTo(0, from + (to - from) * done);
      if (done < 1 && perks === p && p.busy === move) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  function perksFollow(p, grow, foot, tall) {
    var over = foot - perksEnd(p);
    if (over <= PERKS_NEAR) {
      return;
    }
    perksHold(p, tall);
    perksScroll(p, grow, window.pageYOffset + over);
  }

  // The way between the line and the wall, for every tile that shows at either end of it. The line is the wall
  // made smaller about the tile's middle: its top row comes down to the line's size and step, icon on icon, and
  // the rows under it go into the line behind that row and out of sight. `back` runs the way from the wall to the
  // line and holds there until the line itself takes over (perksShut).
  function perksMoves(p, back) {
    var u = unlocked;
    var width = u.strip.clientWidth;
    var near = LINE_STEP / u.step;
    var small = p.line.tile / u.size;
    var fill = back ? 'forwards' : 'none';
    // The wall's tiles show the line's sheen at half (premiumbot.css).
    var sheen = typeof KeyframeEffect === 'function' && 'pseudoElement' in KeyframeEffect.prototype;
    var moves = [];
    for (var r = 0; r < u.rows.length; r++) {
      var row = u.rows[r];
      var dy = p.line.mid - (u.pad + r * u.step + u.size / 2);
      for (var i = 0; i < row.tiles.length; i++) {
        var tile = row.tiles[i];
        var off = row.x + i * u.step + u.size / 2 - width / 2;
        if (Math.abs(off) > width / 2 + 2 * u.step) {
          continue;
        }
        var line = {transform: 'translate(' + (off * (near - 1)).toFixed(2) + 'px, ' + dy.toFixed(2) + 'px) scale(' + small + ')'};
        var wall = {transform: back ? tile.style.transform || 'none' : 'none'};
        if (r) {
          line.opacity = 0;
          wall.opacity = 1;
        }
        moves.push(tile.animate(back ? [wall, line] : [line, wall], {duration: PERKS_MS, easing: PERKS_EASE, fill: fill}));
        if (!r && sheen) {
          moves.push(tile.animate(back ? [{opacity: 0.5}, {opacity: 1}] : [{opacity: 1}, {opacity: 0.5}], {duration: PERKS_MS, easing: PERKS_EASE, fill: fill, pseudoElement: '::before'}));
        }
      }
    }
    return moves;
  }

  // Opening. The line's icons are the wall's top row from the first frame on: the rows are made up from the line
  // as it stands, the nine icons about its middle, then the next nine, then the rest; the top row is set where
  // the line, made larger about the tile's middle, puts it; and every tile starts at the line's size in the line's
  // place. From there the wall opens out as the tile grows, the two lower rows from behind the top one.
  function perksOpen(p) {
    var strip = p.strip;
    var box = strip.getBoundingClientRect();
    var tiles = [].slice.call(strip.querySelectorAll('.icon-tile'));
    var each = Math.ceil(tiles.length / ROW_DRIFT.length);
    var half = Math.floor(each / 2);
    var mid = 0;
    var at = box.width / 2;
    var best = Infinity;
    for (var i = 0; i < tiles.length; i++) {
      var rect = tiles[i].getBoundingClientRect();
      var off = Math.abs(rect.left + rect.width / 2 - box.left - box.width / 2);
      if (off < best) {
        best = off;
        mid = i;
        at = rect.left + rect.width / 2 - box.left;
      }
    }
    var order = [];
    for (var n = 0; n < tiles.length; n++) {
      order.push(tiles[(mid - half + n + tiles.length) % tiles.length]);
    }
    p.section.classList.add('is-open');
    mountUnlocked(p.root, order);
    var u = unlocked;
    if (!u) {
      return;
    }
    // Every row moves by as much as the top row does, so the rows keep their half step from one another.
    var lead = box.width / 2 + (at - box.width / 2) * u.step / LINE_STEP - half * u.step - u.size / 2;
    var shift = lead - u.rows[0].x;
    for (var r = 0; r < u.rows.length; r++) {
      var row = u.rows[r];
      row.x = (row.x + shift) % row.round;
      if (row.x > 0) {
        row.x -= row.round;
      }
      row.shown = Math.round(row.x * 10) / 10;
      row.el.style.transform = 'translate3d(' + row.shown + 'px, 0, 0)';
    }
    // The tile is laid out open here, before its height is run from the line's: its foot and the page's height are
    // the ones the opening ends on.
    var foot = p.cell.getBoundingClientRect().bottom;
    var tall = document.documentElement.scrollHeight;
    var grow = strip.animate([{height: box.height + 'px'}, {height: strip.getBoundingClientRect().height + 'px'}], {duration: PERKS_MS, easing: PERKS_EASE});
    p.moves = perksMoves(p, false);
    p.busy = grow;
    grow.onfinish = grow.oncancel = function() {
      perksFree(p);
      if (p.busy === grow) {
        p.busy = null;
        p.moves = null;
      }
    };
    perksFollow(p, grow, foot, tall);
  }

  // Closing is the opening run back. The wall stops. The line is set up to be what the wall's top row comes down
  // to: its order is that row's from four tiles before the one nearest the middle, then the other rows' (the
  // tiles go back to the strip in that order, unmountUnlocked), and --perk-shift puts the row on its loop where
  // that tile's middle comes down. Every tile goes to the line's size and place while the tile shrinks, the lower
  // rows in behind the top one, and only then is the second line the row of icons again: the same icons in the
  // same places, going on from there.
  function perksClose(p) {
    var u = unlocked;
    var strip = p.strip;
    if (!u) {
      perksShut(p);
      return;
    }
    cloudHush();
    u.frozen = true;
    u.held = null;
    unlockedRun();
    var width = strip.clientWidth;
    var top = u.rows[0];
    var each = top.own.length;
    var half = Math.floor(each / 2);
    var count = 0;
    for (var r = 0; r < u.rows.length; r++) {
      count += u.rows[r].own.length;
    }
    var near = Math.max(0, Math.min(top.tiles.length - 1, Math.round((width / 2 - top.x - u.size / 2) / u.step)));
    var mid = width / 2 + (top.x + near * u.step + u.size / 2 - width / 2) * LINE_STEP / u.step;
    top.lead = ((near - half) % each + each) % each;
    var loop = count * LINE_BEAT_S;
    var beat = (p.line.lead + half * LINE_STEP + p.line.tile / 2 - mid) / LINE_STEP * LINE_BEAT_S;
    p.shift = (beat % loop + loop) % loop;
    var from = strip.getBoundingClientRect().height;
    // Where the page can still be scrolled to once the tile is a line again. A page scrolled past that goes back
    // there in step with the closing, held at its open height meanwhile: left alone, it was thrown back in one
    // frame, the moment the shrinking page grew shorter than its scroll.
    var open = document.documentElement.scrollHeight;
    var most = Math.max(0, open - (from - p.line.height) - window.innerHeight);
    p.moves = perksMoves(p, true);
    var shrink = strip.animate([{height: from + 'px'}, {height: p.line.height + 'px'}], {duration: PERKS_MS, easing: PERKS_EASE, fill: 'forwards'});
    p.moves.push(shrink);
    p.section.classList.add('is-closing');
    p.busy = shrink;
    if (window.pageYOffset > most) {
      perksHold(p, open);
      p.back = most;
      perksScroll(p, shrink, most);
    }
    shrink.onfinish = function() {
      if (perks === p && p.busy === shrink) {
        perksShut(p);
      }
    };
  }

  // The wall is gone and the tile is one line again. After a closing the line's icons stand where the wall's came
  // down, so nothing is seen to change in the frame that puts one in the other's place.
  function perksShut(p) {
    var moves = p.moves || [];
    unmountUnlocked();
    p.section.classList.remove('is-open');
    p.section.classList.remove('is-closing');
    if (typeof p.shift === 'number') {
      p.strip.style.setProperty('--perk-shift', p.shift.toFixed(3) + 's');
    }
    for (var i = 0; i < moves.length; i++) {
      moves[i].cancel();
    }
    p.moves = null;
    p.busy = null;
    // The page is let go at the scroll the closing was taking it to, so nothing moves as it gets its own height back.
    if (typeof p.back === 'number') {
      window.scrollTo(0, p.back);
      p.back = undefined;
    }
    perksFree(p);
  }

  // A tap while the tile opens or closes is not taken: the way under way ends first.
  function perksSet(open) {
    var p = perks;
    if (!p || p.open === open || p.busy) {
      return;
    }
    p.open = open;
    p.cell.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (reducedMotion() || !p.strip.animate) {
      if (open) {
        p.section.classList.add('is-open');
        mountUnlocked(p.root);
      } else {
        perksShut(p);
      }
      return;
    }
    if (open) {
      perksOpen(p);
    } else {
      perksClose(p);
    }
  }

  function mountPerks(root) {
    var section = root.querySelector('.section--perks');
    var strip = section ? section.querySelector('.perk-strip') : null;
    var cell = strip ? strip.closest('.cell') : null;
    // A result does not show the section: on a Premium purchase's its tiles go round the star (orbitMount), and on
    // a gift's it is left out.
    if (!cell || section.closest('.result-screen')) {
      return;
    }
    var open = section.classList.contains('is-open');
    var first = strip.querySelector('.icon-tile');
    var laid = !open && first && strip.offsetHeight;
    perks = {
      root: root, section: section, strip: strip, cell: cell, open: open, click: null,
      // The closed line as laid out: its height, a tile's size, a tile's middle under the line's top edge and
      // where the row starts from the line's side.
      line: laid ? {height: strip.offsetHeight, tile: first.offsetWidth, mid: first.offsetTop + first.offsetHeight / 2, lead: first.offsetLeft} : {height: 28, tile: 24, mid: 14, lead: 16},
      // The way under way, by its height's animation, with every animation that is part of it, and where a
      // closing leaves the line on its loop.
      busy: null, moves: null, shift: null
    };
    var p = perks;
    p.click = function(event) {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      // The loader that follows links listens on the document: this tile opens nothing but itself.
      event.preventDefault();
      event.stopPropagation();
      perksSet(!p.open);
    };
    cell.addEventListener('click', p.click);
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-expanded', p.open ? 'true' : 'false');
  }

  function unmountPerks() {
    var p = perks;
    if (!p) {
      return;
    }
    p.cell.removeEventListener('click', p.click);
    // A page left in the middle of a move must not leave its hold on the next page's height.
    perksFree(p);
    var moves = p.moves || [];
    for (var i = 0; i < moves.length; i++) {
      moves[i].cancel();
    }
    if (p.busy) {
      p.busy.cancel();
      // A closing that the page's end cuts short is closed.
      if (!p.open) {
        p.section.classList.remove('is-open');
      }
    }
    p.section.classList.remove('is-closing');
    perks = null;
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

  // `continued` says the page goes on from one in a document the browser has unloaded (premiumbot.js init).
  function mount(root, continued) {
    destroy();
    syncMotion();
    continuing = !!continued;
    if (continuing) {
      launched = true;
    }
    var app = window.Telegram && window.Telegram.WebApp;
    appActive = !app || app.isActive !== false;
    mountEntrance(root);
    mountBar(root);
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
          (unlocked.measure || unlockedMeasure)();
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
    mountPerks(root);
    mountUnlocked(root);
    // A paid result: the field's stars burst from the mark and confetti falls over the screen.
    var celebrate = root.querySelector('.js-celebrate');
    if (celebrate) {
      var host = celebrate.closest('.result-screen') || celebrate.parentNode;
      if (host) {
        var golden = host.querySelector('.fx-stage--stars, .pm-mark--stars');
        // The wait is counted in a task of its own, when every mount of this page has run and the mark is on its
        // way. Then the stars, the confetti and the rings of tiles all leave the mark at once.
        burstTimer = setTimeout(function() {
          burstTimer = setTimeout(function() {
            burst(host, golden ? FIELD_COLORS.starsPaid : FIELD_COLORS.premium);
            var giveaway = host.classList.contains('tone-giveaway');
            confetti(host, golden ? CONFETTI_FOIL.stars : giveaway ? CONFETTI_FOIL.giveaway : CONFETTI_FOIL.premium, giveaway);
            orbitOpen();
          }, landing(host.querySelector(MEDIA)));
        }, 0);
      }
    }
    mountLoops(root);
    update();
    launched = true;
    continuing = false;
  }

  // The page was replaced and its init has not run yet (premiumbot.js pageCarry): the fields and the light go over
  // to the new page's stages now, so no frame is without them. The init that follows mounts the page in full.
  function carry(root) {
    destroy();
    syncMotion();
    var found = root.querySelectorAll('.fx-stage');
    for (var i = 0; i < found.length; i++) {
      mountStage(found[i]);
    }
    dropFields();
    mountLight(root);
    update();
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
    unmountPerks();
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
    carry: carry,
    destroy: destroy,
    confetti: confetti,
    // The launch holds the page's entrance back while the mark rises (premiumbot.js launchHold): the entrance is
    // given that much longer before it is taken for stalled.
    late: function(ms) {
      if (entranceTimer) {
        clearTimeout(entranceTimer);
        entranceTimer = setTimeout(function() {
          endEntrance(document);
        }, ENTRANCE_MAX_MS + ms);
      }
    },
    // A link to the app may name what Premium includes (premiumbot.js linkGo): the home page's tile opens.
    openPerks: function() {
      perksSet(true);
    }
  };
})();
