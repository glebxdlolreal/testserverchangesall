
function px(str) {
  return new Number(str.slice(0, -2));
}

var WebApp = window.Telegram && window.Telegram.WebApp || null;

var Main = {
  init(api_hash = null) {
    if (api_hash) {
      Aj.apiUrl = '/oauth/api?hash=' + api_hash;
    }
    Main.initOnce();
    Aj.viewTransition = true;
    window.basePath = '/oauth'

    setBackButton(Aj.state.backButton);
    Aj.state.files = Aj.state.files || {};

    function adjustTextArea () {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    }

    $('textarea[expandable]').each(adjustTextArea).on('input focus', adjustTextArea);

    $('.js-drop-area').on('dragenter', function () {
      $(this).toggleClass('drag-over', true);
    });

    $('.js-drop-area').on('dragover', function (e) {
      e.preventDefault();
    });

    $('.js-drop-area').on('dragleave drop', function (e) {
      $(this).toggleClass('drag-over', false);
    });

    $('img').on('error', function (e) {
      var src = this.src;
      setTimeout(() => {
        var url = document.createElement('a');
        url.href = src;
        if (!url.search.includes('retry')) {
          url.search += '&retry=1';
          this.src = url.href;
        }
      }, 300);
    });

    $('.js-lottie-thumb').each(function () {
      RLottie.init(this, {noAutoPlay: $(this).hasClass('static')});
    });

    $('.js-dropdown-wrapper').on('click', function (e) {
      if (e.target.closest('.tm-dropdown')) return;
      if (!this.contains(e.target)) return;
      $('.dropdown-toggle', this).dropdown('toggle');
      e.stopImmediatePropagation();
      e.stopPropagation();
    });

    WebApp.MainButton.enable();
    WebApp.MainButton.hide();
  },
  eMainButton() {
    if (Aj.layerState.onMainButton) {
      return Aj.layerState.onMainButton();
    }
    Aj.state.onMainButton && Aj.state.onMainButton();
  },
  initOnce() {
    if (window._initOnce) {
      return;
    }
    window._initOnce = true;

    Main.checkAuth();

    window.showConfirm = (message, onConfirm, confirm_btn, onCancel) => {
      WebApp.showPopup({
        message: message,
        buttons: [
          {type: 'destructive', id: 'ok', text: confirm_btn || 'Leave'},
          {type: 'cancel'}
        ]
      }, button_id => button_id == 'ok' ? onConfirm?.() : onCancel?.());
    };

    WebApp.ready();
    WebApp.setHeaderColor('#212a33');
    WebApp.setBackgroundColor('#1a2026');
    WebApp.setBottomBarColor('#212a33');
    WebApp.MainButton.setParams({ color: '#248BDA' });
    WebApp.MainButton.onClick(Main.eMainButton);
    //WebApp.disableVerticalSwipes();

    if (['android', 'ios'].includes(WebApp.platform)) {
      $('body').addClass('mobile');
      $('body').addClass('platform-'+WebApp.platform);
      // WebApp.requestFullscreen();
      initBackSwipe();
      window._mobileApp = true;
    }

    var ua = navigator.userAgent.toLowerCase();
    window.isSafari = (!(/chrome/i.test(ua)) && /webkit|safari|khtml/i.test(ua));

    window._localCache = {};

    $(document).on('submit', 'form', e => e.preventDefault());

    $(document).on('click', '.tm-bot-anchor', () => {
      WebApp.HapticFeedback.impactOccurred('soft');
    });

    $(document).on('shown.bs.dropdown', (event) => {
      WebApp.HapticFeedback.impactOccurred('soft');
      var $menu = $('.dropdown-menu', event.target);
      var rect = $menu[0].getBoundingClientRect();
      var needsInvert = document.body.clientHeight - rect.bottom < -4;
      var needsInvertHorizontal = rect.left < 2;
      $menu.toggleClass('dropdown-menu-top', needsInvert);
      $menu.toggleClass('dropdown-menu-right', needsInvertHorizontal);
    });

    $(document).on('hidden.bs.dropdown', (event) => {
      var $menu = $('.dropdown-menu', event.target);
      $menu.removeClass('dropdown-menu-top dropdown-menu-right');
    });

    $(document).on('change', 'input[type=checkbox]', () => {
      WebApp.HapticFeedback.selectionChanged();
    });

    $(document).on('sortchange', () => {
      WebApp.HapticFeedback.selectionChanged();
    });

    $(document).on('sortstart', () => {
      window._sortInProgress = true;
    });

    $(document).on('sortstop', () => {
      window._sortInProgress = false;
    });

    $(document).on('click', '.js-form-clear', function () {
      $('input', this.closest('.tm-field')).val('').trigger('input');
    });
  },
  scrollToEl(elem, offset = 0, smooth = false) {
   window.scrollTo({
    top: $(elem).offset().top - WebApp.safeAreaInset.top - WebApp.contentSafeAreaInset.top + offset,
    left: 0,
    behaviour: smooth ? 'smooth' : 'auto',
   });
  },
  checkAuth() {
    var authPage = Aj.state.authPage === true;
    Aj.apiRequest('auth', {_auth: WebApp.initData}, res => {
      if (!res.ok) {
        if (!authPage) {
          window.location = '/stickers/auth';
        } else {
          AuthPage.showExpired();          
        }
      } else if (authPage) {
        var start_param = WebApp.initDataUnsafe.start_param;
        window.location = '/stickers?' + (start_param ? 'tgWebAppStartParam=' + start_param : '');
      }
    });
  },
  showToast(text, options = {}) {
    if (!window.$_toastContainer) {
      window.$_toastContainer = $('<div class="tm-toast-container">').appendTo('body');
    }
    if (!window.$toast) {
      window.$toast = $(`<div class="tm-toast ${options.class}">${text}</div>`);
      $_toastContainer.html($toast);

      setTimeout(() => $toast.addClass('tm-toast-show'), 10);
      setTimeout(() => {
        $toast.removeClass('tm-toast-show');
        setTimeout(() => {
            $toast.remove();
            window.$toast = null;
        }, 300);
      }, options.duration || 2000);
    }
  },
  showErrorToast(text) {
    Main.showToast(text || 'Error.', { class: 'tm-toast-error' });
    WebApp.HapticFeedback.notificationOccurred('error');
  },
  showSuccessToast(text) {
    Main.showToast('<div>' + (text || 'Success.') + '</div>', { class: 'tm-toast-success' });
    WebApp.HapticFeedback.notificationOccurred('success');
  },
  iosChatFix() {
    if (WebApp.platform != 'ios') return;
    if (WebApp.isVersionAtLeast('8.0')) {
      setTimeout(() => {
        if (WebApp.isActive) {
          WebApp.close();
        }
      }, 500);
    } else {
      WebApp.close();
    }
  },
}

var MainPage = {
  init() {
    Aj.state.allowMsg = true;
    $('.tm-row-toggle').on('click', function () {
      var toggleEl = this.querySelector('.tm-toggle');
      var value = toggleEl.classList.toggle('tm-toggle-on');
      Aj.state.allowMsg = value;
      WebApp.HapticFeedback.impactOccurred('soft');
    });

    var sent = false;

    var accept = (allow_phone = false) => Aj.apiRequest('confirm', {tsession: Aj.state.temp_session, accept_allow_phone: allow_phone, accept_allow_write: Aj.state.allowMsg}, res => {
      if (res) {
        if (res.ok) {
          WebApp.HapticFeedback.notificationOccurred('success');
          // WebApp.close();
        }
      }
    });

    Aj.state.onMainButton = () => {
      sent = true;

      if (Aj.state.request_phone) {
        WebApp.showPopup({
          title: 'Allow access?',
          message: `${Aj.state.request_domain} wants to access your phone number +${Aj.state.request_phone}.`,
          buttons: [
            {type: 'default', id: 'ok', text: 'Allow'},
            {type: 'destructive', id: 'deny', text: 'Deny'},
          ]
        }, button_id => {
          accept(button_id == 'ok')
        });
      } else {
        accept();
      }
    };
    WebApp.MainButton.setText('Log In');
    WebApp.MainButton.show();

    WebApp.SecondaryButton.onClick(() => WebApp.close());
    WebApp.SecondaryButton.setText('Cancel');
    WebApp.SecondaryButton.setParams({ color: '#CC5D52', text_color: '#FFFFFF' })
    WebApp.SecondaryButton.show();
  },
}

function requestUpload(target, callback = null, options = {}) {
  options = {  
    accept: 'image/*',
    preventError: false,
    onSelected: null,
    ...options 
  }

  $input = $(`<input type="file" accept="${options.accept}" style="display: none">`);
  Aj.state.fileLoading = Aj.state.fileLoading || 0;
  Aj.state.files = Aj.state.files || {};

  let upload = (file) => {
    Aj.uploadRequest('upload', file, { target: target }, res => {
      Aj.state.fileLoading--;

      if (res.ok) {
        Aj.state.files[target] = res.media;
      }
      if (res.error && !options.preventError) {
        Main.showErrorToast(res.error);
      }
      if (callback) {
        callback(res);        
      }
    });
  }

  $input.on('change', () => {
    let file = $input[0].files[0];
    if (!file) return;

    processImage(file, res => upload(res), target);

    options.onSelected?.(file);

    Aj.state.fileLoading++;
    
    $input.remove();
  });
  $input.on('cancel', () => {
    callback({ cancel: true });

    $input.remove();
  })
  $('body').append($input);
  $input.click();
}


function processImage(file, callback, target='game_pic') {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (target == 'emoji' || target == 'stickers_thumb') {
        canvas.width = 100;
        canvas.height = 100;
      } else {
        canvas.width = 512;
        canvas.height = 512;
      }

      if (img.width == canvas.width && img.height == canvas.height) {
        callback(file);
        return;
      }

      var hRatio = canvas.width / img.width;
      var vRatio = canvas.height / img.height;
      var ratio  = Math.min ( hRatio, vRatio );

     var dx = ( canvas.width - img.width*ratio ) / 2;
     var dy = ( canvas.height - img.height*ratio ) / 2;  
     ctx.clearRect(0,0,canvas.width, canvas.height);
     ctx.drawImage(img, 0,0, img.width, img.height, dx, dy, img.width*ratio, img.height*ratio);  

      canvas.toBlob(function(blob) {
        file = new File([blob], file.name + '.webp', { type: 'image/webp' });
        callback(file);
      }, 'image/webp', 0.92);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function strEmojiToHex(emoji, trim_ef0f) {
  var hex = encodeURIComponent(emoji).replace(/%([0-9a-f]{2})|(.)/gi, function(m, m1, m2){ return m1 || m2.charCodeAt(0).toString(16); }).toUpperCase();
  if (trim_ef0f !== false) hex = hex.replace(/EFB88F/g, '');
  return hex;
}
function cleanHTML(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, getBR());
}
function cleanRE(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function debounce() {
  let timer;
  return function (callback, delay = 300) {
    clearTimeout(timer);
    timer = setTimeout(callback, delay);
  };
}

var _backButton = null;
function setBackButton(url) {
  if (_backButton) {
    WebApp.BackButton.offClick(_backButton);      
  }
  if (url) {
    _backButton = () => {
      if ((closePopup() === false)) Aj.location(url)
    };
    WebApp.BackButton.onClick(_backButton);
    WebApp.BackButton.show();
  } else {
    _backButton = null;
    WebApp.BackButton.hide();
  }
}

function fuzzyMatch(needle, haystack) {
  var needle = needle.toLowerCase();
  var haystack = haystack.toLowerCase();
  for (var i = 0, j = 0; j < haystack.length; j++) {
    if (needle[i] === haystack[j]) {
      i++;
    }
    if (i === needle.length) {
      return true;
    }
  }
  return false;
}

function initBackSwipe() {
  if ($('.tm-swipe-back').length) {
    return;
  }
  $('<div class="tm-swipe-back"></div>').appendTo('body');

  const threshold = 120;

  var touchstartX = 0;
  var touchstartY = 0;
  var touchendX = 0;
  var touchendY = 0;

  var zone = document;
  var type = null;
  var notified = false;
  var feedbackDelay = false;

  var isRtl = document.documentElement.classList.contains('lang_rtl');

  zone.addEventListener('touchstart', function(event) {
      touchstartX = event.touches[0].screenX;
      touchstartY = event.touches[0].screenY;
      window._canvasInteraction = (event.target.tagName == 'CANVAS');
  });

  zone.addEventListener('touchmove', function(event) {
      touchendX = event.changedTouches[0].screenX;
      touchendY = event.changedTouches[0].screenY;

      if (window._sortInProgress) return;
      if (window._canvasInteraction) return;

      deltaX = (touchendX - touchstartX) * (isRtl ? -1 : 1);
      deltaY = touchendY - touchstartY;

      const isHorizontal = Math.abs(deltaX) > 30 && 
                                     Math.abs(deltaY) < 30;

      if (type === 'h') {
          event.preventDefault();
      } else if (!event.cancelable) {
        return
      }           
      if (isHorizontal && !type && event.cancelable) {
          type = 'h';
          event.preventDefault();
      }
      if (deltaX > threshold && !notified) {
        notified = true;
        feedbackDelay = true;
        setTimeout(() => feedbackDelay = false, 80);
        WebApp.HapticFeedback.impactOccurred('soft');;
      }
      var translateX = deltaX / 1.2;
      translateX = asymptoticInterp(deltaX / 1.2 / 120, 0, 130, 1);
      translateX -= 40;
      $('.tm-swipe-back')[0].style.insetInlineStart = translateX - 52 + 'px';
  }, {passive: false})

  zone.addEventListener('touchend', function(event) {
    var finalDeltaX = (touchendX - touchstartX) * (isRtl ? -1 : 1);
    if (type == 'h' && finalDeltaX > threshold) {
      if (!feedbackDelay) {
        WebApp.HapticFeedback.impactOccurred('light');
      }
      if (_backButton) {
        _backButton();        
      } else {
        WebApp.close();
      }
    }
    notified = false;
    type = null;
    touchendX = event.changedTouches[0].screenX;
    touchendY = event.changedTouches[0].screenY;
    $('.tm-swipe-back')[0].style.insetInlineStart = '-92px';
  }, false);

  function asymptoticInterp(t, start, end, rate = 5) {
    if (t <= 0) return start;
    return start + (end - start) * (t / (t + 0.5));
  }
}

