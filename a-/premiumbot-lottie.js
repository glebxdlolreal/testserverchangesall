/* Lightweight tlottie enhancement for Premium Bot. Static posters remain the fallback. */
window.PremiumLottie = (function() {
  'use strict';

  // Deployments and standalone playgrounds may override the engines' root before this script runs.
  var WASM_URL = (window.PMA_LOTTIE_WASM_BASE || '/js/') + 'premiumbot-tlottie.wasm';
  var NOSIMD_URL = (window.PMA_LOTTIE_WASM_BASE || '/js/') + 'premiumbot-tlottie.nosimd.wasm';
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

  // Where the frame's pixels lie in the engine's memory; 0 when it could not draw.
  Engine.prototype.render = function(handle, frame, width, height) {
    return this.exports.tlottie_render(handle, frame, width, height, 1);
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

  // A sticker's file as the bytes the engine takes, asked for once in the life of the script. A page may ask ahead
  // of the page that shows the sticker (preload), and a second visit asks nothing.
  var files = {};

  function loadFile(url) {
    if (!files[url]) {
      files[url] = fetch(url).then(function(response) {
        if (!response.ok) {
          throw new Error('Lottie download failed');
        }
        return response.json();
      }).then(function(json) {
        return new TextEncoder().encode(JSON.stringify(json));
      }).catch(function(error) {
        delete files[url];
        throw error;
      });
    }
    return files[url];
  }

  function supported(root) {
    if (!root || !window.fetch || !window.WebAssembly || !window.TextEncoder || !window.ImageData) {
      return false;
    }
    var canvas = document.createElement('canvas');
    return !!canvas.getContext && !!canvas.getContext('2d');
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
    if (player.replay) {
      player.target.removeEventListener('click', player.replay, false);
      player.target.classList.remove('is-tappable');
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
    var cssSize = target.clientWidth || 96;
    var size = Math.max(1, Math.round(cssSize * (window.devicePixelRatio || 1)));
    // A display that refreshes faster than the file's rate asks for the same frame again.
    if (frame === player.frame && size === player.canvas.width) {
      return true;
    }
    if (player.canvas.width !== size || player.canvas.height !== size) {
      player.canvas.width = size;
      player.canvas.height = size;
    }
    var pointer = player.engine.render(player.handle, frame, size, size);
    if (!pointer) {
      return false;
    }
    // The pixels are read where the engine drew them: a new view only when it moved them or its memory grew.
    var buffer = player.engine.exports.memory.buffer;
    if (!player.image || player.buffer !== buffer || player.pointer !== pointer || player.image.width !== size) {
      player.image = new ImageData(new Uint8ClampedArray(buffer, pointer, size * size * 4), size, size);
      player.buffer = buffer;
      player.pointer = pointer;
    }
    player.context.putImageData(player.image, 0, 0);
    player.frame = frame;
    if (player.poster) {
      player.poster.style.display = 'none';
    }
    if (player.target.classList) {
      player.target.classList.add('is-ready');
    }
    return true;
  }

  // Plays once, by the clock at the file's own rate, and rests on the last frame. Reduced motion shows that frame
  // alone.
  function play(player) {
    var frameRate = player.info.frameRate || 60;
    var last = Math.max(1, player.info.frameCount || 1) - 1;
    var position = 0;
    var lastTime = 0;

    function show(frame) {
      if (!draw(player, frame)) {
        removePlayer(player);
        return false;
      }
      return true;
    }

    function tick(now) {
      player.frameRequest = 0;
      if (player.cancelled) {
        return;
      }
      // A page that stalled goes on from where it stopped: one step counts for a tenth of a second at most.
      if (lastTime) {
        position += Math.min(now - lastTime, 100) * frameRate / 1000;
      }
      lastTime = now;
      var frame = Math.min(last, Math.floor(position));
      if (show(frame) && frame < last) {
        player.frameRequest = requestAnimationFrame(tick);
      }
    }

    if (player.frameRequest) {
      cancelAnimationFrame(player.frameRequest);
      player.frameRequest = 0;
    }
    if (reducedMotion()) {
      show(last);
      return;
    }
    player.frameRequest = requestAnimationFrame(tick);
  }

  // Ahead of the page that shows them: the engine, and the files this page names in data-lottie-preload, addresses
  // apart by spaces, on any element. Asked for once the page has settled, so they take nothing from its own start.
  // A page that names none asks for nothing, and a failure here costs nothing: the page that shows the sticker asks
  // again.
  function preload(root) {
    var urls = [];
    var nodes = root.querySelectorAll('[data-lottie-preload]');
    for (var i = 0; i < nodes.length; i++) {
      urls = urls.concat(nodes[i].getAttribute('data-lottie-preload').split(/\s+/));
    }
    if (!urls.length) {
      return;
    }
    var run = function() {
      loadEngine().catch(function() {});
      for (var j = 0; j < urls.length; j++) {
        if (urls[j]) {
          loadFile(urls[j]).catch(function() {});
        }
      }
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 400);
    }
  }

  function mount(root) {
    destroy();
    if (!supported(root)) {
      return false;
    }
    preload(root);
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
          frame: -1,
          image: null,
          buffer: null,
          pointer: 0,
          replay: null,
          frameRequest: 0,
          cancelled: false,
          removed: false
        };
        player.context = player.canvas.getContext('2d');
        player.canvas.className = 'js-lottie-canvas';
        target.appendChild(player.canvas);
        players.push(player);
        Promise.all([loadEngine(), loadFile(player.url)]).then(function(values) {
          if (player.cancelled) {
            return;
          }
          player.engine = values[0];
          player.handle = player.engine.create(values[1]);
          player.info = player.engine.info(player.handle);
          play(player);
          // A tap plays it again.
          player.replay = function() {
            if (!player.cancelled && !reducedMotion()) {
              play(player);
            }
          };
          target.addEventListener('click', player.replay, false);
          target.classList.add('is-tappable');
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
