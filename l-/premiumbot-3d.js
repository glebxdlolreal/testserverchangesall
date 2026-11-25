/* Premium Bot Mini App 3D mark: Telegram's GLIcon/Icon3D (org/telegram/ui/Components/Premium/GLIcon)
   ported to plain WebGL 1, vanilla JavaScript, no build step.
   Source of geometry, textures and shaders: static/telegram/resources/premiumbot/3d/ (unchecked, as upstream). */
window.Premium3D = (function() {
  'use strict';

  // Deployments and standalone playgrounds may override the root before this script runs.
  var ASSETS_BASE = window.PMA_ASSETS_BASE || '/resources/premiumbot/3d/';
  var instances = [];
  // Marks whose page is gone, each kept for a moment in case the next page has a slot for its kind (park, adopt).
  var parked = [];
  // Both stars are drawn from the same files.
  var assetCache = null;
  var assetsLoaded = false;

  // ===== Small math and color helpers (from fx/motion.ts and fx/palette.ts) =====

  function clamp(value) {
    return Math.min(Math.max(value, 0), 1);
  }

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
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

  function luminance(hex) {
    var rgb = parseHex(hex) || [0, 0, 0];
    return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 255000;
  }

  function mixHex(a, b, k) {
    var ca = parseHex(a) || [0, 0, 0];
    var cb = parseHex(b) || [0, 0, 0];
    var out = [0, 0, 0];
    for (var i = 0; i < 3; i++) {
      out[i] = Math.round(ca[i] + (cb[i] - ca[i]) * k);
    }
    return '#' + out.map(function(v) {
      return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
    }).join('');
  }

  function cubicBezier(x1, y1, x2, y2) {
    var cx = 3 * x1;
    var cy = 3 * y1;
    var bx = 3 * (x2 - x1) - cx;
    var by = 3 * (y2 - y1) - cy;
    var ax = 1 - cx - bx;
    var ay = 1 - cy - by;
    return function(time) {
      var x = time;
      for (var i = 1; i < 14; i++) {
        var z = x * (cx + x * (bx + x * ax)) - time;
        if (Math.abs(z) < 1e-3) {
          break;
        }
        x -= z / (cx + x * (2 * bx + 3 * ax * x));
      }
      return x * (cy + x * (by + x * ay));
    };
  }

  var EASE_OUT_QUINT = cubicBezier(0.23, 1, 0.32, 1);
  var EASE_DEFAULT = cubicBezier(0.25, 0.1, 0.25, 1);
  var EASE_OUT = cubicBezier(0, 0, 0.58, 1);
  var overshoot = function(t) {
    return (t - 1) * (t - 1) * (3 * t - 1) + 1;
  };
  var linear = function(t) {
    return t;
  };

  // PremiumStarComponent.setupShineAnimation (Telegram iOS): the light band's u + v.
  function shineAt(seconds) {
    var cycle = seconds < 1 ? 0 : (seconds - 1) % 4;
    return 2 * (0.87 - 1 + 1.6 * EASE_OUT(Math.min(Math.max((cycle - 1.1) / 0.9, 0), 1)));
  }

  // ===== Mesh replay from Telegram's ObjLoader tables (native3d/binobj.ts parseMesh) =====

  var MESH_MAGIC = 0x4853454d;
  var MESH_PLANES = 1;
  var MESH_WIDE = 2;

  function parseMesh(data) {
    var view = new DataView(data);
    if (data.byteLength < 16 || view.getUint32(0, true) !== MESH_MAGIC) {
      throw new Error('not a mesh');
    }
    var vertices = view.getUint32(4, true);
    var count = view.getUint32(8, true);
    var flags = view.getUint32(12, true);
    if (flags & ~(MESH_PLANES | MESH_WIDE)) {
      throw new Error('unknown mesh flags');
    }
    var at = 16;
    function take(n, size) {
      var bytes = new Uint8Array(data, at, n * size);
      at += n * size;
      if (!(flags & MESH_PLANES)) {
        return bytes.slice().buffer;
      }
      var out = new Uint8Array(n * size);
      for (var b = 0; b < size; b++) {
        for (var i = 0; i < n; i++) {
          out[i * size + b] = bytes[b * n + i];
        }
      }
      return out.buffer;
    }
    var positions = new Float32Array(take(vertices * 3, 4));
    var uvs = new Float32Array(take(vertices * 2, 4));
    var normals = new Float32Array(take(vertices * 3, 4));
    var indices = flags & MESH_WIDE ? new Uint32Array(take(count, 4)) : new Uint16Array(take(count, 2));
    var next = 0;
    for (var i = 0; i < count; i++) {
      var back = indices[i];
      if (back > next) {
        throw new Error('corrupt mesh');
      }
      indices[i] = next - back;
      if (back === 0) {
        next++;
      }
    }
    if (next !== vertices || at !== data.byteLength) {
      throw new Error('corrupt mesh');
    }
    return { positions: positions, uvs: uvs, normals: normals, indices: indices };
  }

  // ===== Idle/drag/tap motion, GLIconTextureView's (native3d/animator.ts) =====

  function around(d) {
    return (((d % 360) + 540) % 360) - 180;
  }

  function iconMotion(kind, now) {
    var m = { angleX: 0, angleY: 0, angleX2: 0 };
    var set = null;
    var back = null;
    var idleAt = now + 2000;
    var pointer = 0;
    var order = kind === 'coin' ? [0] : [0, 1, 2, 3, 4];
    var int = function(bound) {
      return Math.floor(Math.random() * bound);
    };
    var shuffle = function() {
      for (var i = order.length - 1; i > 0; i--) {
        var j = int(i + 1);
        var tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
      }
    };
    shuffle();
    var play = function(start, tracks) {
      set = {
        start: start,
        tracks: tracks,
        done: function(end) {
          m.angleX = 0;
          idleAt = end + 2000;
        }
      };
    };
    var startBack = function(start) {
      set = null;
      back = {
        start: start,
        tracks: [['angleX', [m.angleX, 0], 600, overshoot], ['angleX2', [m.angleX2, 0], 600, overshoot], ['angleY', [m.angleY, 0], 600, overshoot]]
      };
      idleAt = start + 2000;
    };
    var advance = function(run, now) {
      var ended = true;
      for (var t = 0; t < run.tracks.length; t++) {
        var track = run.tracks[t];
        var prop = track[0];
        var v = track[1];
        var duration = track[2];
        var ease = track[3];
        var delay = track[4] || 0;
        var elapsed = now - run.start - delay;
        if (elapsed < duration) {
          ended = false;
        }
        if (elapsed < 0) {
          continue;
        }
        var f = ease(Math.min(elapsed / duration, 1));
        var n = v.length - 1;
        var i = Math.min(Math.floor(Math.min(Math.max(f, 0), 1) * n), n - 1);
        m[prop] = v[i] + (v[i + 1] - v[i]) * (f * n - i);
      }
      return ended;
    };
    var startIdle = function(start) {
      var i = order[pointer++];
      if (pointer === order.length) {
        shuffle();
        pointer = 0;
      }
      var pull = int(4);
      var turn = (kind === 'coin' ? 360 : 485) * (pull === 2 ? -1 : 1);
      var x = m.angleX;
      var y = m.angleY;
      if (i === 0 && pull === 0 && kind !== 'coin') {
        play(start, [['angleY', [y, 48], 2300, EASE_OUT_QUINT], ['angleY', [48, 0], 500, overshoot, 2300]]);
      } else if (i === 0) {
        // pullAnimation starts this turn from angleY, 0 at rest.
        play(start, [['angleX', [y, turn], 3000, EASE_OUT_QUINT], ['angleX', [turn, 0], 1000, overshoot, 3000]]);
      } else if (i === 1) {
        play(start, [['angleX', [x, 360], 8000, EASE_DEFAULT]]);
      } else if (i === 2) {
        play(start, [
          ['angleX', [x, 184], 600, EASE_OUT],
          ['angleY', [y, 50], 600, EASE_OUT],
          ['angleX', [180, 0], 800, overshoot, 10000],
          ['angleY', [60, 0], 800, overshoot, 10000],
          ['angleX2', [0, 2, -3, 2, -1, 2, -3, 2, -1, 0], 10000, linear]
        ]);
      } else {
        play(start, [['angleX', [x, 180], 600, EASE_DEFAULT], ['angleX', [180, 360], 600, EASE_DEFAULT, 2000]]);
      }
    };

    return {
      get angleX() { return m.angleX; },
      get angleY() { return m.angleY; },
      get angleX2() { return m.angleX2; },
      tick: function(now) {
        var dead = true;
        var active;
        if (set) {
          active = set;
          dead = advance(active, now);
          if (dead && active.done) {
            active.done(now);
          }
          if (dead) {
            set = null;
          }
        } else if (back) {
          dead = advance(back, now);
          if (dead) {
            back = null;
          }
        }
        if (dead && idleAt !== null && now >= idleAt) {
          idleAt = null;
          startIdle(now);
        }
      },
      down: function() {
        // GestureDetector.onDown: a held finger drops the spring-back and the idles.
        set = null;
        back = null;
        idleAt = null;
      },
      // GestureDetector.onScroll distances, in device pixels.
      drag: function(distanceX, distanceY) {
        m.angleX += distanceX * 0.5;
        m.angleY += distanceY * 0.05;
      },
      up: function(now) {
        startBack(now);
      },
      // One whole turn about the upright axis, from where the mark stands to where it rests: a star that takes the
      // other star's place changes its kind in this turn (adopt). `way` is 1 or -1.
      turn: function(now, way) {
        set = back = null;
        idleAt = null;
        play(now + 16, [['angleX', [m.angleX, 360 * way], 760, EASE_DEFAULT], ['angleY', [m.angleY, 0], 400, EASE_OUT]]);
      },
      tap: function(now, fx, fy) {
        set = back = null;
        if (Math.abs(m.angleX) > 10) {
          startBack(now);
          return;
        }
        idleAt = null;
        var x = (40 + int(30)) * fx;
        var y = (40 + int(30)) * fy;
        play(now + 16, [
          ['angleX', [m.angleX, x], 220, EASE_OUT_QUINT],
          ['angleX', [x, 0], 600, overshoot, 220],
          ['angleY', [m.angleY, y], 220, EASE_OUT_QUINT],
          ['angleY', [y, 0], 600, overshoot, 220]
        ]);
      }
    };
  }

  // ===== The 3D icon (native3d/icon3d.ts) =====

  var GRADIENT = { star: '#a767ff #55a5ff', golden: '#fec846 #ec920a' };
  var LIGHT_STAR = { gradient: '#3d8bff #6b4dff', rest: 0.1, turn: 2.2, glint: '#bfdeff', behind: '#5c48ff', page: 0.1 };
  var ACCENT = { star: '#5c48ff', golden: '#f9b004' };

  var MOVE_S = 0.15;
  var MOVE_FROM = 10;
  var MOVE_TO = 60;

  function getAsset(name, binary) {
    var url = ASSETS_BASE + name;
    return fetch(url).then(function(response) {
      if (!response.ok) {
        throw new Error(name + ' ' + response.status);
      }
      return binary ? response.arrayBuffer() : response.text();
    });
  }

  function getImage(name) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() { resolve(img); };
      img.onerror = reject;
      img.src = ASSETS_BASE + name;
    });
  }

  // SvgHelper.getBitmap(R.raw.start_texture, 240, 240, Color.WHITE) of the 1024 x 1024 file.
  function starTexture() {
    return getAsset('start_texture.svg').then(function(svg) {
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = 240;
      var ctx = canvas.getContext('2d');
      ctx.scale(240 / 1024, 240 / 1024);
      ctx.fillStyle = '#fff';
      var match = /\sd="([^"]+)"/.exec(svg);
      ctx.fill(new Path2D(match[1]));
      return canvas;
    });
  }

  var FRAG_COLOR = 'gl_FragColor = mix(premium_star(), golden_star(), golden);';

  // fragment4.glsl plus the iOS star's shine (shineAt) along u + v = u_shine, a broader front lobe, the fixed
  // highlight and LIGHT_STAR's two turn lights (native3d/icon3d.ts withShine).
  function withShine(fragment) {
    return fragment
      .replace('pow(specComp3, max(1., 30.))', 'pow(specComp3, max(1., 20.))')
      .replace('void main() {', 'uniform float u_shine;\nuniform float u_rest;\nuniform float u_turn;\nuniform float u_move;\nuniform vec3 u_glint;\n\nvoid main() {')
      .replace(
        FRAG_COLOR,
        FRAG_COLOR + '\n    float shine = (vUV.x + vUV.y - u_shine) / 0.144;\n    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(gl_FragColor.a), 0.5 * exp(-shine * shine));' +
          '\n    vec3 worldNormal = normalize(vec3(world * vec4(vNormal, 0.0)));' +
          '\n    float rest = pow(max(dot(worldNormal, normalize(vec3(-0.265, 0.265, 0.927))), 0.0), 16.0);' +
          '\n    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(gl_FragColor.a), u_rest * rest * (1.0 - golden));' +
          '\n    float side = pow(max(dot(worldNormal, normalize(vec3(-0.77, 0.17, 0.62))), 0.0), 14.0) + pow(max(dot(worldNormal, normalize(vec3(0.77, 0.17, 0.62))), 0.0), 14.0);' +
          '\n    float turn = u_turn * (1.0 - smoothstep(0.94, 0.985, abs(world[2].z))) * side;' +
          '\n    gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(u_glint, vec3(1.0), 0.7 * clamp(turn - 1.0, 0.0, 1.0)) * gl_FragColor.a, clamp(turn + 0.5 * u_turn * u_move * rest, 0.0, 1.0) * (1.0 - golden));'
      );
  }

  function loadIcon() {
    if (!assetCache) {
      assetCache = Promise.all([
        getAsset('star.mesh', true).then(parseMesh),
        getAsset('vertex2.glsl'),
        getAsset('fragment4.glsl').then(function(fragment) { return withShine(fragment); }),
        starTexture(),
        getImage('flecks.png')
      ]).then(function(values) {
        assetsLoaded = true;
        return { mesh: values[0], vertex: values[1], fragment: values[2], texture: values[3], flecks: values[4] };
      });
      assetCache.catch(function() {
        assetCache = null;
      });
    }
    return assetCache;
  }

  function getIconGL(canvas) {
    try {
      return canvas.getContext('webgl', {
        powerPreference: 'low-power',
        failIfMajorPerformanceCaveat: true,
        preserveDrawingBuffer: false
      });
    } catch (error) {
      return null;
    }
  }

  function multiply(out, a, b) {
    for (var i = 0; i < 16; i++) {
      out[i] = 0;
      for (var k = 0; k < 4; k++) {
        out[i] = out[i] + a[k * 4 + (i % 4)] * b[(i & ~3) + k];
      }
    }
    return out;
  }

  // `shown` starts the icon at full alpha; otherwise its first frames fade it in.
  function createIcon(gl, kind, assets, shown) {
    if (gl.isContextLost()) {
      return null;
    }
    var program = gl.createProgram();
    [[gl.VERTEX_SHADER, assets.vertex], [gl.FRAGMENT_SHADER, assets.fragment]].forEach(function(pair) {
      var shader = gl.createShader(pair[0]);
      gl.shaderSource(shader, pair[1]);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    });
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      if (!gl.isContextLost()) {
        console.warn('premium3d:', gl.getProgramInfoLog(program));
      }
      return null;
    }
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    var at = {};
    var u = function(name) {
      if (!(name in at)) {
        at[name] = gl.getUniformLocation(program, name);
      }
      return at[name];
    };
    var attributes = ['a_TexCoordinate', 'a_Normal', 'vPosition'].map(function(name) {
      var location = gl.getAttribLocation(program, name);
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
      }
      return location;
    });
    var mesh = assets.mesh;
    if (mesh.indices instanceof Uint32Array && !gl.getExtension('OES_element_index_uint')) {
      return null;
    }
    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    var model = {
      count: mesh.indices.length,
      type: mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      indices: indexBuffer,
      buffers: [mesh.uvs, mesh.normals, mesh.positions].map(function(data) {
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return buffer;
      })
    };

    // As GLUtils.texImage2D uploads Android's premultiplied bitmaps.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    var texture = function(unit, source, clamp, existing) {
      var t = existing || gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      if (clamp) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      return t;
    };
    texture(0, assets.texture, kind !== 'coin');
    texture(1, assets.flecks, false);
    ['u_Texture', 'u_NormalMap', 'u_BackgroundTexture'].forEach(function(name, i) {
      gl.uniform1i(u(name), i);
    });
    gl.uniform1i(u('type'), 0);
    gl.uniform1f(u('golden'), kind === 'golden' ? 1 : 0);
    gl.uniform1f(u('u_diffuse'), 1);
    gl.uniform1f(u('normalSpec'), 0.2);
    gl.uniform3f(u('normalSpecColor'), 1, 1, 1);
    gl.uniform3f(u('specColor'), 1, 1, 1);
    GRADIENT[kind].split(' ').forEach(function(hex, i) {
      gl.uniform3fv(u('gradientColor' + (i + 1)), parseHex(hex).map(function(v) { return v / 255; }));
    });
    gl.uniform1f(u('u_rest'), 0.9);
    gl.uniform3fv(u('u_glint'), parseHex(LIGHT_STAR.glint).map(function(v) { return v / 255; }));

    var background = null;
    var backgroundTexture = null;
    // perspectiveM(53.13°, w / h, 1, 200) × setLookAtM(eye 0 0 100), which is a translation.
    var p = 1 / Math.tan((53.13 * Math.PI) / 360);
    var pv = new Float32Array([0, 0, 0, 0, 0, p, 0, 0, 0, 0, -201 / 199, -1, 0, 0, (201 * 100 - 400) / 199, 100]);
    var world = new Float32Array(16);
    var mvp = new Float32Array(16);
    world[15] = 1;
    var enterAlpha = shown ? 1 : 0;
    var xOffset = 0;
    var time = 0;
    var turnRate = 0;
    var lastX = 0;
    var lastY = 0;

    return {
      // The star between its two kinds: the shader's own mix of the two stars and the colours of their gradients,
      // `mix` of the way from `from` to `to`. At the end the icon is of the kind it has turned into.
      tint: function(from, to, mix) {
        var a = GRADIENT[from].split(' ');
        var b = GRADIENT[to].split(' ');
        gl.uniform1f(u('golden'), (from === 'golden' ? 1 - mix : 0) + (to === 'golden' ? mix : 0));
        for (var i = 0; i < a.length; i++) {
          gl.uniform3fv(u('gradientColor' + (i + 1)), parseHex(mixHex(a[i], b[i], mix)).map(function(v) { return v / 255; }));
        }
        if (mix >= 1) {
          kind = to;
        }
      },
      setBackground: function(hex) {
        background = document.createElement('canvas');
        background.width = background.height = 50;
        var ctx = background.getContext('2d');
        var dark = luminance(hex) < 0.5;
        var light = !dark && kind === 'star';
        ctx.fillStyle = light ? mixHex(LIGHT_STAR.behind, hex, LIGHT_STAR.page) : mixHex('#a767ff', hex, 0.5);
        ctx.fillRect(0, 0, 50, 50);
        gl.uniform1i(u('night'), dark ? 1 : 0);
        var gradient = light ? LIGHT_STAR.gradient : GRADIENT[kind];
        gradient.split(' ').forEach(function(c, i) {
          gl.uniform3fv(u('gradientColor' + (i + 1)), parseHex(c).map(function(v) { return v / 255; }));
        });
        gl.uniform1f(u('u_rest'), light ? LIGHT_STAR.rest : 0.9);
        gl.uniform1f(u('u_turn'), light ? LIGHT_STAR.turn : 0);
        // GLIconRenderer.isDarkBackground; the front lobe, raised from upstream's 0.2, is the light at rest.
        gl.uniform1f(u('spec1'), dark ? 1 : 2);
        gl.uniform1f(u('spec2'), 0.3);
      },
      draw: function(f, still) {
        var w = gl.drawingBufferWidth;
        var h = gl.drawingBufferHeight;
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (background) {
          backgroundTexture = texture(2, background, true, backgroundTexture);
          background = null;
        }
        pv[0] = p / (w / h);
        // translateM(0, angleX2, 0) × rotateM(-angleY - headerTilt, x) × rotateM(-angleX - angleX3, y).
        var a = (-(f.angleY + f.pitch) * Math.PI) / 180;
        var b = (-(f.angleX + f.yaw) * Math.PI) / 180;
        var ca = Math.cos(a);
        var sa = Math.sin(a);
        var cb = Math.cos(b);
        var sb = Math.sin(b);
        world[0] = cb;
        world[1] = sa * sb;
        world[2] = -ca * sb;
        world[5] = ca;
        world[6] = sa;
        world[8] = sb;
        world[9] = -sa * cb;
        world[10] = ca * cb;
        world[13] = f.angleX2;
        if (still) {
          enterAlpha = 1;
        }
        time += f.dt;
        var x = f.angleX + f.yaw;
        var y = f.angleY + f.pitch;
        if (f.dt > 0) {
          turnRate += (Math.hypot(around(x - lastX), around(y - lastY)) / f.dt - turnRate) * (1 - Math.exp(-f.dt / MOVE_S));
        }
        lastX = x;
        lastY = y;
        gl.uniformMatrix4fv(u('uMVPMatrix'), false, multiply(mvp, pv, world));
        gl.uniformMatrix4fv(u('world'), false, world);
        gl.uniform1f(u('f_xOffset'), xOffset);
        gl.uniform1f(u('f_alpha'), enterAlpha);
        gl.uniform2f(u('resolution'), w, h);
        gl.uniform1f(u('time'), time);
        gl.uniform1f(u('u_shine'), still ? shineAt(0) : shineAt(time));
        gl.uniform1f(u('u_move'), still ? 0 : smoothstep(clamp((turnRate - MOVE_FROM) / (MOVE_TO - MOVE_FROM))));
        for (var k = 0; k < model.buffers.length; k++) {
          gl.bindBuffer(gl.ARRAY_BUFFER, model.buffers[k]);
          gl.vertexAttribPointer(attributes[k], k ? 3 : 2, gl.FLOAT, false, 0, 0);
        }
        gl.uniform1i(u('modelIndex'), 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indices);
        gl.drawElements(gl.TRIANGLES, model.count, model.type, 0);
        // Per frame, as in Icon3D.draw, at most 60 a second (frameGate).
        enterAlpha = Math.min(1, enterAlpha + 16 / 220);
        xOffset = (xOffset + 0.0005) % 1;
      }
    };
  }

  // ===== Stage instances =====

  // A mark that has not drawn, or has lost its context, for this long shows the flat glyph until it draws.
  var FLAT_AFTER_MS = 1000;
  // One live list: every frame asks it, and destroy() can only take the listener off the list that has it.
  var motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  // Telegram's own flag, apart from the page's visibility: a minimised Mini App stays "visible".
  var active = true;

  function prefersReducedMotion() {
    return !!motionQuery && motionQuery.matches;
  }

  function webApp() {
    return window.Telegram && window.Telegram.WebApp;
  }

  // At most 60 frames a second at any display rate, on the display's own ticks (fx/motion.ts frameGate).
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

  function isDark() {
    return document.documentElement.classList.contains('theme-dark');
  }

  // A colour of Telegram's theme, which it hands over as #rrggbb in a --tg-theme-* variable.
  function themeHex(name, fallback) {
    var value = getComputedStyle(document.documentElement).getPropertyValue('--tg-theme-' + name).trim();
    return parseHex(value) ? value : fallback;
  }

  // What the glass star refracts: the centre of the stage's glow (fx/stage.ts behind).
  function behindColor(kind, dark) {
    var accent = ACCENT[kind] || ACCENT.star;
    if (dark) {
      return mixHex(themeHex('bg-color', '#000000'), accent, 0.58);
    }
    return mixHex(mixHex(themeHex('secondary-bg-color', '#ffffff'), '#ffffff', 0.95), accent, 0.28);
  }

  // Centres `el` on the mark, at `percent` of the mark's size.
  function place(el, percent) {
    var s = el.style;
    s.top = s.left = '50%';
    s.right = s.bottom = 'auto';
    s.width = s.height = percent + '%';
    s.transform = 'translate(-50%, -50%)';
  }

  // The golden star's bloom turned as GLIconRenderer turns the star: translateM(0, angleX2) × rotateM(-angleY - pitch, x)
  // × rotateM(-angleX - yaw, y), seen from 100 units away, in CSS's axes, where y runs down and +z faces the viewer.
  // `unit` is px per GL unit at the mark (fx/stage.ts bloomTurn).
  function bloomTurn(f, unit) {
    return 'translate(-50%, -50%) perspective(' + (100 * unit).toFixed(1) + 'px) translateY(' + (-f.angleX2 * unit).toFixed(2) +
      'px) rotateX(' + (f.angleY + f.pitch).toFixed(2) + 'deg) rotateY(' + (-(f.angleX + f.yaw)).toFixed(2) + 'deg)';
  }

  // The bloom shows on dark pages alone: elsewhere a transform a frame would restyle a box that paints nothing.
  function turnBloom(instance, f) {
    if (!instance.bloom || !instance.unit || !instance.dark) {
      return;
    }
    var turn = bloomTurn(f, instance.unit);
    if (turn !== instance.turned) {
      instance.turned = turn;
      instance.bloom.style.transform = turn;
    }
  }

  // Without its 3D mark the slot shows the flat glyph (premiumbot.css .pm-mark.is-flat).
  function setFlat(instance, flat) {
    clearTimeout(instance.waiting);
    instance.box.classList.toggle('is-flat', flat);
    if (flat) {
      instance.box.classList.remove('is-3d');
    }
    instance.canvas.style.visibility = flat ? 'hidden' : '';
  }

  // The slot must not stay empty: the glyph stands in for a mark that is slow to draw, and leaves when it does.
  function awaitDraw(instance) {
    clearTimeout(instance.waiting);
    instance.waiting = setTimeout(function() {
      if (!instance.icon && !instance.dead) {
        setFlat(instance, true);
      }
    }, FLAT_AFTER_MS);
  }

  function kindOf(box) {
    return box.getAttribute('data-icon3d') === 'golden' ? 'golden' : 'star';
  }

  // The golden star's light on dark pages: its blurred silhouette, drawn for 1.488 x the mark, turned with the star.
  function bloomOf(box, kind) {
    var bloom = kind === 'golden' ? box.querySelector('.pm-mark-bloom') : null;
    if (bloom) {
      place(bloom, 148.8);
      // A transform only: the blur is painted once.
      bloom.style.willChange = 'transform';
    }
    return bloom;
  }

  // `taking` says the page before had a mark on screen until this one took its place.
  function spawn(box, taking) {
    var kind = kindOf(box);
    var canvas = document.createElement('canvas');
    canvas.className = 'pm-mark-gl';
    // The view is half as large again as the mark: the icon fills two thirds of it.
    place(canvas, 150);
    // Horizontal drags spin the icon; vertical ones still scroll the page.
    canvas.style.touchAction = 'pan-y';
    box.appendChild(canvas);
    var dark = isDark();
    var instance = {
      box: box,
      kind: kind,
      canvas: canvas,
      bloom: bloomOf(box, kind),
      gl: null,
      icon: null,
      failed: false,
      // A mark that takes another's place is there in the page's first frame. Any other fades in, as does one whose
      // files are still on their way.
      instant: !!taking && assetsLoaded,
      motion: iconMotion(kind, 0),
      gate: frameGate(),
      last: 0,
      raf: 0,
      // The frame clock: it runs only while frames do, and every time the motion is given is on it.
      clockMs: 0,
      // A finger's spin speeds the particle field up until this clock time.
      spunUntil: -Infinity,
      angle: 0,
      spin: 0,
      // Px per GL unit at the mark: the view is 100 units tall at its 100-unit depth (perspectiveM 53.13°, eye at 100).
      unit: 0,
      turned: '',
      dark: dark,
      behind: behindColor(kind, dark),
      seen: typeof IntersectionObserver !== 'function',
      waiting: 0,
      tilt: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
      press: null,
      drag: false,
      lx: 0,
      ly: 0,
      dead: false,
      ready: false
    };
    instances.push(instance);
    loadIcon().then(function(assets) {
      if (instance.dead) {
        return;
      }
      instance.assets = assets;
      tryDraw(instance);
    }).catch(function() {
      if (!instance.dead) {
        instance.failed = true;
        setFlat(instance, true);
      }
    });
    awaitDraw(instance);
    bindStage(instance);
    layout(instance);
    return instance;
  }

  // The whole stage (or sheet around the mark) is where the pointer leans the mark; only the canvas takes its gestures.
  function stageOf(box) {
    return box.closest('.fx-stage') || box;
  }

  function bindStage(instance) {
    var zone = stageOf(instance.box);
    var canvas = instance.canvas;
    instance.zone = zone;
    // GLIconTextureView.onTouchEvent: past the 8 px slop a drag spins by device pixels; a tap within 400 ms pushes.
    instance.onPointerDown = function(e) {
      if (!instance.raf || instance.press) {
        return;
      }
      instance.press = e;
      instance.drag = false;
      instance.lx = e.clientX;
      instance.ly = e.clientY;
      // A captured pointer reports its release wherever that happens. Capturing throws once the pointer is up.
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (error) {}
      instance.motion.down();
      instance.spunUntil = Infinity;
    };
    instance.onPointerMove = function(e) {
      var press = instance.press;
      if (!press || e.pointerId !== press.pointerId) {
        return;
      }
      if (!instance.drag && Math.hypot(e.clientX - press.clientX, e.clientY - press.clientY) > 8) {
        instance.drag = true;
      }
      if (instance.drag) {
        var px = window.devicePixelRatio || 1;
        instance.motion.drag((instance.lx - e.clientX) * px, (instance.ly - e.clientY) * px);
        instance.lx = e.clientX;
        instance.ly = e.clientY;
      }
    };
    instance.onPointerUp = function(e) {
      var press = instance.press;
      if (!press || e.pointerId !== press.pointerId) {
        return;
      }
      instance.press = null;
      instance.target.x = 0;
      instance.target.y = 0;
      // On the clock tick() runs on, and before the tap: a release drops whatever plays, the tap's push too.
      instance.motion.up(instance.clockMs);
      instance.spunUntil = instance.clockMs + 1500;
      var r = canvas.getBoundingClientRect();
      var half = r.width / 2;
      if (e.type === 'pointerup' && !instance.drag && half > 0 && e.timeStamp - press.timeStamp < 400) {
        instance.motion.tap(instance.clockMs, (half - e.clientX + r.left) / half, (half - e.clientY + r.top) / half);
      }
      instance.drag = false;
    };
    // Pointer lean: the mark follows the finger/cursor over the stage.
    instance.onLean = function(e) {
      var r = zone.getBoundingClientRect();
      var half = Math.max(1, r.width / 2);
      instance.target.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / half));
      instance.target.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / half));
    };
    instance.onPointerLeave = function() {
      if (!instance.press) {
        instance.target.x = 0;
        instance.target.y = 0;
      }
    };
    // An engine that takes a context back for good sends no webglcontextrestored: the slot would stay empty, so the
    // glyph stands in until a context returns.
    instance.onContextLost = function(e) {
      e.preventDefault();
      instance.icon = null;
      instance.ready = false;
      update(instance);
      if (!instance.failed) {
        awaitDraw(instance);
      }
    };
    instance.onContextRestored = function() {
      tryDraw(instance);
    };
    canvas.addEventListener('pointerdown', instance.onPointerDown);
    canvas.addEventListener('pointermove', instance.onPointerMove);
    canvas.addEventListener('pointerup', instance.onPointerUp);
    canvas.addEventListener('pointercancel', instance.onPointerUp);
    canvas.addEventListener('webglcontextlost', instance.onContextLost);
    canvas.addEventListener('webglcontextrestored', instance.onContextRestored);
    zone.addEventListener('pointermove', instance.onLean);
    zone.addEventListener('pointerleave', instance.onPointerLeave);
    // Off screen nothing is drawn.
    if (typeof IntersectionObserver === 'function') {
      instance.observer = new IntersectionObserver(function(entries) {
        instance.seen = entries[entries.length - 1].isIntersecting;
        update(instance);
      });
      instance.observer.observe(canvas);
    }
  }

  function unbindStage(instance) {
    var zone = instance.zone;
    var canvas = instance.canvas;
    if (!zone) {
      return;
    }
    canvas.removeEventListener('pointerdown', instance.onPointerDown);
    canvas.removeEventListener('pointermove', instance.onPointerMove);
    canvas.removeEventListener('pointerup', instance.onPointerUp);
    canvas.removeEventListener('pointercancel', instance.onPointerUp);
    canvas.removeEventListener('webglcontextlost', instance.onContextLost);
    canvas.removeEventListener('webglcontextrestored', instance.onContextRestored);
    zone.removeEventListener('pointermove', instance.onLean);
    zone.removeEventListener('pointerleave', instance.onPointerLeave);
    if (instance.observer) {
      instance.observer.disconnect();
    }
  }

  function layout(instance) {
    var canvas = instance.canvas;
    // The buffer takes the canvas's own box: any other size is resampled on screen.
    var size = canvas.offsetWidth || 180;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pixels = Math.round(size * dpr);
    instance.unit = size / 100;
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
  }

  function tryDraw(instance) {
    if (instance.icon || instance.failed || !instance.assets || instance.dead) {
      return !!instance.icon;
    }
    if (!instance.gl) {
      instance.gl = getIconGL(instance.canvas);
    }
    if (instance.gl && !instance.gl.isContextLost()) {
      instance.icon = createIcon(instance.gl, instance.kind, instance.assets, instance.instant);
      // A context that comes back fades its mark in.
      instance.instant = false;
      instance.failed = !instance.icon;
      if (instance.icon) {
        instance.icon.setBackground(instance.behind);
        instance.ready = true;
        setFlat(instance, false);
        instance.box.classList.add('is-3d');
        layout(instance);
        // A mark that fades in is drawn clear first: the frames that follow bring it up (createIcon enterAlpha).
        frame(instance, performance.now());
      }
      update(instance);
    } else if (instance.gl && instance.gl.isContextLost()) {
      // A lost context cannot build the icon; webglcontextrestored comes back here.
      return false;
    } else {
      instance.failed = true;
    }
    if (instance.failed) {
      setFlat(instance, true);
    }
    return !!instance.icon;
  }

  var frameSeed = { angleX: 0, angleY: 0, angleX2: 0, yaw: 0, pitch: 0, dt: 0 };

  function frame(instance, now) {
    if (!instance.icon) {
      return;
    }
    var still = prefersReducedMotion();
    var dt = instance.last ? Math.min(Math.max(now - instance.last, 0), 100) : 16;
    instance.last = now;
    var f = frameSeed;
    var spin = 0;
    if (still) {
      instance.tilt.x = instance.tilt.y = 0;
      f.angleX = f.angleY = f.angleX2 = 0;
      f.dt = 0;
    } else {
      instance.clockMs += dt;
      instance.motion.tick(instance.clockMs);
      var k = 1 - Math.exp(-dt / 200);
      instance.tilt.x += (instance.target.x - instance.tilt.x) * k;
      instance.tilt.y += (instance.target.y - instance.tilt.y) * k;
      f.angleX = instance.motion.angleX;
      f.angleY = instance.motion.angleY;
      f.angleX2 = instance.motion.angleX2;
      f.dt = dt / 1000;
      // Only a finger's spin speeds the particle field up (premiumbot-fx.js reads data-spin, degrees a second):
      // idle turns and the pointer lean leave it alone.
      if (instance.clockMs < instance.spunUntil && dt > 0) {
        spin = Math.round(((f.angleX - instance.angle) * 1000) / dt);
      }
    }
    instance.angle = instance.motion.angleX;
    f.yaw = -instance.tilt.x * 14;
    f.pitch = -instance.tilt.y * 10;
    if (spin !== instance.spin) {
      instance.spin = spin;
      instance.box.setAttribute('data-spin', String(spin));
    }
    if (instance.tint) {
      stepTint(instance, now);
    }
    turnBloom(instance, f);
    instance.icon.draw(f, still);
  }

  // A star that took the other star's place turns into its own kind over TINT_MS, eased in and out: what it refracts,
  // the two stars' mix in the shader and their gradients run together from one to the other. With motion reduced it
  // is its own kind at once.
  var TINT_MS = 520;

  function stepTint(instance, now) {
    var tint = instance.tint;
    if (!tint.start) {
      tint.start = now;
    }
    var t = prefersReducedMotion() ? 1 : Math.min(Math.max((now - tint.start) / TINT_MS, 0), 1);
    var mix = t * t * (3 - 2 * t);
    instance.icon.setBackground(mixHex(tint.behind, instance.behind, mix));
    instance.icon.tint(tint.from, instance.kind, mix);
    if (t >= 1) {
      instance.tint = null;
      instance.icon.setBackground(instance.behind);
    }
  }

  function update(instance) {
    var running = !instance.dead && instance.ready && instance.seen && active && document.visibilityState !== 'hidden' && !prefersReducedMotion();
    if (running && !instance.raf) {
      instance.last = performance.now();
      var loop = function(now) {
        instance.raf = requestAnimationFrame(loop);
        if (instance.gate(now)) {
          frame(instance, now);
        }
      };
      instance.raf = requestAnimationFrame(loop);
    } else if (!running && instance.raf) {
      cancelAnimationFrame(instance.raf);
      instance.raf = 0;
    }
    if (instance.dead) {
      if (instance.raf) {
        cancelAnimationFrame(instance.raf);
        instance.raf = 0;
      }
      return;
    }
  }

  // The theme changed: the star refracts the new page, and a frame outside the loop shows it.
  function retheme(instance) {
    var dark = isDark();
    var behind = behindColor(instance.kind, dark);
    if (dark === instance.dark && behind === instance.behind) {
      return;
    }
    instance.dark = dark;
    instance.behind = behind;
    if (instance.icon) {
      instance.icon.setBackground(behind);
      if (!instance.raf) {
        frame(instance, performance.now());
      }
    }
  }

  function setActive(on) {
    active = on;
    for (var i = 0; i < instances.length; i++) {
      update(instances[i]);
    }
  }

  // A page change destroys and mounts in one task. A mark that has drawn waits this long for a slot of its kind in the
  // next page, with its canvas, context and motion, and is freed when no page takes it.
  var PARK_MS = 2000;
  // Set by a destroy() that took a drawn mark off its page, for the mount() that follows: that one is a page change.
  var changing = false;

  function release(instance) {
    instance.dead = true;
    if (instance.canvas.parentNode) {
      instance.canvas.parentNode.removeChild(instance.canvas);
    }
    if (instance.gl) {
      var lose = instance.gl.getExtension('WEBGL_lose_context');
      if (lose) {
        lose.loseContext();
      }
    }
  }

  function park(instance) {
    if (instance.raf) {
      cancelAnimationFrame(instance.raf);
      instance.raf = 0;
    }
    clearTimeout(instance.waiting);
    // A finger still down will send this canvas no release: it lets go as a cancelled pointer does.
    if (instance.press) {
      instance.onPointerUp({ type: 'pointercancel', pointerId: instance.press.pointerId });
    }
    unbindStage(instance);
    instance.box.removeAttribute('data-spin');
    if (!instance.icon || instance.gl.isContextLost()) {
      release(instance);
      return;
    }
    instance.spin = 0;
    instance.target.x = instance.target.y = 0;
    changing = true;
    parked.push(instance);
    instance.parking = setTimeout(function() {
      parked.splice(parked.indexOf(instance), 1);
      changing = false;
      release(instance);
    }, PARK_MS);
  }

  // The next page's slot takes a waiting mark as it stands: the same canvas, moved, so no frame is without the mark
  // and its motion goes on. Where no mark of the slot's kind waits, a waiting star of the other kind is taken: the
  // two are one mesh under one shader, so it turns into the slot's kind where it stands (stepTint), and its own light
  // on a dark page, the golden star's bloom, comes up with it.
  function adopt(box) {
    var kind = kindOf(box);
    var found = -1;
    for (var i = 0; i < parked.length; i++) {
      if (parked[i].kind === kind) {
        found = i;
        break;
      }
      if (found < 0) {
        found = i;
      }
    }
    if (found < 0) {
      return null;
    }
    var instance = parked[found];
    parked.splice(found, 1);
    clearTimeout(instance.parking);
    if (instance.gl.isContextLost()) {
      release(instance);
      return null;
    }
    var turning = instance.kind !== kind;
    if (turning) {
      instance.tint = { from: instance.kind, behind: instance.behind, start: 0 };
      instance.kind = kind;
      instance.behind = behindColor(kind, instance.dark);
    }
    instance.box = box;
    instance.bloom = bloomOf(box, kind);
    if (turning && instance.bloom && instance.bloom.animate && !prefersReducedMotion()) {
      instance.bloom.animate([{ opacity: 0, offset: 0 }], { duration: TINT_MS, easing: 'ease-in-out' });
    }
    if (turning) {
      instance.motion.turn(instance.clockMs, kind === 'golden' ? 1 : -1);
    }
    instance.turned = '';
    instance.seen = true;
    box.appendChild(instance.canvas);
    box.classList.add('is-3d');
    instances.push(instance);
    bindStage(instance);
    layout(instance);
    retheme(instance);
    // Redrawn as it stood, into a buffer the new box may have resized. The frame after is one step on, however long
    // the page change took.
    frame(instance, instance.last);
    update(instance);
    instance.last = 0;
    return instance;
  }

  var visibilityHandler = null;
  var resizeHandler = null;
  var motionHandler = null;
  var themeHandler = null;
  var themeObserver = null;
  var activatedHandler = null;
  var deactivatedHandler = null;

  function mount(root) {
    destroy();
    var taking = changing;
    changing = false;
    var app = webApp();
    // A mount while Telegram has the app in the background hears no event until `activated`.
    active = !app || app.isActive !== false;
    var boxes = root.querySelectorAll('[data-icon3d]');
    for (var i = 0; i < boxes.length; i++) {
      if (!adopt(boxes[i])) {
        spawn(boxes[i], taking);
      }
    }
    if (!instances.length) {
      return false;
    }
    if (!visibilityHandler) {
      visibilityHandler = function() {
        for (var i = 0; i < instances.length; i++) {
          update(instances[i]);
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
      // A resized buffer is cleared, and Reduce Motion switched on leaves the mark mid-turn: outside the loop both
      // need a frame drawn.
      resizeHandler = function() {
        for (var i = 0; i < instances.length; i++) {
          layout(instances[i]);
          if (!instances[i].raf) {
            frame(instances[i], performance.now());
          }
        }
      };
      window.addEventListener('resize', resizeHandler);
      motionHandler = function() {
        for (var i = 0; i < instances.length; i++) {
          update(instances[i]);
          if (!instances[i].raf) {
            frame(instances[i], performance.now());
          }
        }
      };
      if (motionQuery && motionQuery.addEventListener) {
        motionQuery.addEventListener('change', motionHandler);
      }
      themeHandler = function() {
        for (var i = 0; i < instances.length; i++) {
          retheme(instances[i]);
        }
      };
      activatedHandler = function() {
        setActive(true);
      };
      deactivatedHandler = function() {
        setActive(false);
      };
      if (app && app.onEvent) {
        app.onEvent('themeChanged', themeHandler);
        app.onEvent('activated', activatedHandler);
        app.onEvent('deactivated', deactivatedHandler);
      }
      // premiumbot.js answers themeChanged by switching the root's theme class, before or after this script hears it.
      if (typeof MutationObserver === 'function') {
        themeObserver = new MutationObserver(themeHandler);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      }
    }
    for (var j = 0; j < instances.length; j++) {
      update(instances[j]);
    }
    return true;
  }

  function destroy() {
    for (var i = 0; i < instances.length; i++) {
      park(instances[i]);
    }
    instances = [];
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('resize', resizeHandler);
      if (motionQuery && motionQuery.removeEventListener) {
        motionQuery.removeEventListener('change', motionHandler);
      }
      var app = webApp();
      if (app && app.offEvent) {
        app.offEvent('themeChanged', themeHandler);
        app.offEvent('activated', activatedHandler);
        app.offEvent('deactivated', deactivatedHandler);
      }
      if (themeObserver) {
        themeObserver.disconnect();
      }
      visibilityHandler = null;
      resizeHandler = null;
      motionHandler = null;
      themeHandler = null;
      themeObserver = null;
      activatedHandler = null;
      deactivatedHandler = null;
    }
  }

  return {
    mount: mount,
    destroy: destroy
  };
})();
