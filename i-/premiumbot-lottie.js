/* Lightweight tlottie enhancement for Premium Bot. Static posters remain the fallback. */
window.PremiumLottie = (function() {
  'use strict';

  var WASM_URL = '/js/premiumbot-tlottie.wasm';
  var NOSIMD_URL = '/js/premiumbot-tlottie.nosimd.wasm';
  var SIMD_PROBE = new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 8, 1, 6, 0, 65, 0, 253, 15, 11
  ]);
  var REQUIRED = [
    'tlottie_alloc', 'tlottie_free', 'tlottie_new', 'tlottie_drop',
    'tlottie_width', 'tlottie_height', 'tlottie_frame_rate',
    'tlottie_frame_count', 'tlottie_render'
  ];
  var enginePromise = null;
  var players = [];

  function Engine(instance) {
    var exports = instance.exports;
    if (!(exports.memory instanceof WebAssembly.Memory)) {
      throw new Error('Invalid tlottie memory');
    }
    for (var i = 0; i < REQUIRED.length; i++) {
      if (typeof exports[REQUIRED[i]] !== 'function') {
        throw new Error('Invalid tlottie exports');
      }
    }
    this.exports = exports;
  }

  Engine.prototype.create = function(bytes) {
    var exports = this.exports;
    var pointer = exports.tlottie_alloc(bytes.length);
    if (!pointer) {
      throw new Error('Unable to allocate Lottie animation');
    }
    new Uint8Array(exports.memory.buffer, pointer, bytes.length).set(bytes);
    var handle = exports.tlottie_new(pointer, bytes.length);
    exports.tlottie_free(pointer, bytes.length);
    if (!handle) {
      throw new Error('Unable to parse Lottie animation');
    }
    return handle;
  };

  Engine.prototype.info = function(handle) {
    var exports = this.exports;
    return {
      width: exports.tlottie_width(handle),
      height: exports.tlottie_height(handle),
      frameRate: exports.tlottie_frame_rate(handle),
      frameCount: exports.tlottie_frame_count(handle)
    };
  };

  Engine.prototype.render = function(handle, frame, width, height) {
    var pointer = this.exports.tlottie_render(handle, frame, width, height, 1);
    return pointer ? new Uint8ClampedArray(this.exports.memory.buffer, pointer, width * height * 4) : null;
  };

  Engine.prototype.drop = function(handle) {
    this.exports.tlottie_drop(handle);
  };

  function instantiateBuffered(response) {
    return response.arrayBuffer().then(function(bytes) {
      return WebAssembly.instantiate(bytes, {}).then(function(result) {
        return result.instance;
      });
    });
  }

  function instantiate(url) {
    return fetch(url).then(function(response) {
      if (!response.ok) {
        throw new Error('Wasm download failed');
      }
      var contentType = response.headers.get('content-type') || '';
      if (typeof WebAssembly.instantiateStreaming === 'function' &&
          contentType.indexOf('application/wasm') === 0 &&
          typeof response.clone === 'function') {
        return WebAssembly.instantiateStreaming(response.clone(), {}).then(function(result) {
          return result.instance;
        }).catch(function() {
          return instantiateBuffered(response);
        });
      }
      return instantiateBuffered(response);
    });
  }

  function simdSupported() {
    try {
      return WebAssembly.validate(SIMD_PROBE);
    } catch (error) {
      return false;
    }
  }

  function loadEngine() {
    if (!enginePromise) {
      var useSimd = simdSupported();
      var firstUrl = useSimd ? WASM_URL : NOSIMD_URL;
      enginePromise = instantiate(firstUrl).then(function(instance) {
        return new Engine(instance);
      }).catch(function(error) {
        if (!useSimd) {
          enginePromise = null;
          throw error;
        }
        return instantiate(NOSIMD_URL).then(function(instance) {
          return new Engine(instance);
        });
      }).catch(function(error) {
        enginePromise = null;
        throw error;
      });
    }
    return enginePromise;
  }

  function supported(root) {
    if (!root || !window.fetch || !window.WebAssembly || !window.TextEncoder || !window.ImageData) {
      return false;
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    var canvas = document.createElement('canvas');
    return !!canvas.getContext && !!canvas.getContext('2d');
  }

  function removePlayer(player) {
    if (player.removed) {
      return;
    }
    player.removed = true;
    player.cancelled = true;
    if (player.frameRequest) {
      cancelAnimationFrame(player.frameRequest);
    }
    if (player.handle && player.engine) {
      player.engine.drop(player.handle);
      player.handle = 0;
    }
    if (player.canvas && player.canvas.parentNode) {
      player.canvas.parentNode.removeChild(player.canvas);
    }
    if (player.poster) {
      player.poster.style.display = '';
    }
    if (player.target.classList) {
      player.target.classList.remove('is-ready');
    }
  }

  function destroy() {
    for (var i = 0; i < players.length; i++) {
      removePlayer(players[i]);
    }
    players = [];
  }

  function draw(player, frame) {
    var target = player.target;
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var cssSize = target.clientWidth || 96;
    var size = Math.max(1, Math.round(cssSize * ratio));
    if (player.canvas.width !== size || player.canvas.height !== size) {
      player.canvas.width = size;
      player.canvas.height = size;
    }
    var pixels = player.engine.render(player.handle, frame, size, size);
    if (!pixels) {
      return false;
    }
    var image = new ImageData(pixels, size, size);
    player.context.putImageData(image, 0, 0);
    if (player.poster) {
      player.poster.style.display = 'none';
    }
    if (player.target.classList) {
      player.target.classList.add('is-ready');
    }
    return true;
  }

  function start(player) {
    var loop = !/(success|error|empty)\.json$/.test(player.url);
    var frameRate = player.info.frameRate || 30;
    var frameCount = Math.max(1, player.info.frameCount || 1);
    var frame = 0;
    var lastFrameTime = 0;
    var frameDuration = 1000 / Math.min(frameRate, 30);

    function tick(now) {
      if (player.cancelled) {
        return;
      }
      if (now - lastFrameTime >= frameDuration || !lastFrameTime) {
        if (!draw(player, frame)) {
          removePlayer(player);
          return;
        }
        lastFrameTime = now;
        frame++;
        if (frame >= frameCount) {
          if (!loop) {
            return;
          }
          frame = 0;
        }
      }
      player.frameRequest = requestAnimationFrame(tick);
    }
    player.frameRequest = requestAnimationFrame(tick);
  }

  function mount(root) {
    destroy();
    if (!supported(root)) {
      return false;
    }
    var targets = root.querySelectorAll('[data-lottie-url]');
    for (var i = 0; i < targets.length; i++) {
      (function(target) {
        var player = {
          target: target,
          url: target.getAttribute('data-lottie-url'),
          poster: target.querySelector('[data-lottie-poster]'),
          canvas: document.createElement('canvas'),
          context: null,
          engine: null,
          handle: 0,
          info: null,
          frameRequest: 0,
          cancelled: false,
          removed: false
        };
        player.context = player.canvas.getContext('2d');
        player.canvas.className = 'js-lottie-canvas';
        target.appendChild(player.canvas);
        players.push(player);
        Promise.all([
          loadEngine(),
          fetch(player.url).then(function(response) {
            if (!response.ok) {
              throw new Error('Lottie download failed');
            }
            return response.json();
          })
        ]).then(function(values) {
          if (player.cancelled) {
            return;
          }
          player.engine = values[0];
          var bytes = new TextEncoder().encode(JSON.stringify(values[1]));
          player.handle = player.engine.create(bytes);
          player.info = player.engine.info(player.handle);
          start(player);
        }).catch(function() {
          removePlayer(player);
        });
      })(targets[i]);
    }
    return true;
  }

  return {
    mount: mount,
    destroy: destroy
  };
})();
