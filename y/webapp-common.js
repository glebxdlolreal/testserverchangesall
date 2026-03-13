window.WebApp = window.Telegram && window.Telegram.WebApp || null;

var TWebApp = {
  init() {
    TWebApp.initOnce();
    Aj.viewTransition = true;

    $('form').on('submit', e => e.preventDefault());
    TBackButton.update();
    Aj.state.files = Aj.state.files || {};

    function adjustTextArea () {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    }
    $('textarea[expandable]').each(adjustTextArea).on('input focus', adjustTextArea);

    window.showConfirm = (message, onConfirm, confirm_btn, onCancel) => {
      WebApp.showPopup({
        message: message,
        buttons: [
          {type: 'destructive', id: 'ok', text: confirm_btn || 'OK'},
          {type: 'cancel'}
        ]
      }, button_id => button_id == 'ok' ? onConfirm?.() : onCancel?.());
    };
    window.showToast = TWebApp.showSuccessToast;
    window.showAlert = TWebApp.showErrorToast;
    WebApp.MainButton.enable();

    $('body').on('keydown', function(e) {
        if (e.key === 'Enter' && e.target.matches('input[enterkeyhint=next]')) {
            e.preventDefault();
            TWebApp.focusNextInput();
        }
    });
  },
  initOnce() {
    if (window._initOnce) {
      return;
    }
    window._initOnce = true;

    TWebApp.checkAuth();

    $(document).on('click', '.tm-attach', function () {
      this.remove();
    })

    WebApp.ready();
    WebApp.setHeaderColor('#212a33');
    WebApp.setBackgroundColor('#1a2026');
    WebApp.setBottomBarColor('#212a33');
    WebApp.MainButton.setParams({ color: '#248BDA', text_color: '#ffffff'});
    WebApp.disableVerticalSwipes();

    if (['android', 'ios'].includes(WebApp.platform)) {
      $('body').addClass('mobile');
      $('body').addClass('platform-'+WebApp.platform);
      WebApp.requestFullscreen();
      TBackButton.initBackSwipe();
    }

    $(document).on('popup:open popup:close', TBackButton.update);

    $(document).on('click', '.tm-nav-anchor', () => {
      WebApp.HapticFeedback.impactOccurred('soft');
    });

    $(document).on('shown.bs.dropdown', (event) => {
      WebApp.HapticFeedback.impactOccurred('soft');
      var $menu = $('.dropdown-menu', event.target);
      var rect = $menu[0].getBoundingClientRect();
      var needsInvert = document.body.clientHeight - rect.bottom < -4;
      $menu.toggleClass('dropdown-menu-top', needsInvert);
    });

    $(document).on('hidden.bs.dropdown', (event) => {
      var $menu = $('.dropdown-menu', event.target);
      $menu.toggleClass('dropdown-menu-top', false);
    });

    $(document).on('change', 'input[type=checkbox]', () => {
      WebApp.HapticFeedback.selectionChanged();
    })
  },
  checkAuth() {
    var authPage = Aj.state.authPage === true;
    Aj.apiRequest('auth', {_auth: WebApp.initData}, res => {
      if (res.ok) {
        Aj.unauth = false;
        if (res.api_url) {
          Aj.apiUrl = res.api_url;
        }
        if (authPage) {
          var loc = window.location;
          if (Aj.state.redirect) {
            Aj.location(Aj.state.redirect);  
          } else if (loc.pathname.endsWith('/auth')) {
            Aj.location('/');  
          } else {
            Aj.location(loc.href);
          }
        }
      } else {
        Aj.unauth = true;
        if (!authPage) {
          Aj.location(Aj.state.authHref || '/auth');
        } else {
          TWebApp.showExpired();
        }
      }
    });
  },
  showExpired() {
    $('.tm-auth-expired').toggle(true);
    WebApp.MainButton.setText('Close');
    WebApp.MainButton.onClick(() => {
      WebApp.close();
    });
    WebApp.MainButton.show();
  },
  showToast(text, options = {}) {
    if (!window.$_toastContainer) {
      window.$_toastContainer = $('<div class="tm-toast-container">').appendTo('body');
    }
    if (!window.$toast) {
      window.$toast = $(`<div class="tm-toast ${options.class}"><div>${text}</div></div>`);
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
  showErrorToast(html) {
    TWebApp.showToast(html || 'Error.', { class: 'tm-toast-error' });
    WebApp.HapticFeedback.notificationOccurred('error');
  },
  showSuccessToast(html, time = 2000) {
    TWebApp.showToast(html || 'Success.', { class: 'tm-toast-success', duration: time });
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
  focusNextInput() {
    const inputs = document.querySelectorAll('input:not([type=submit]):not([type=button]), textarea, select');
    const currentIndex = Array.from(inputs).indexOf(document.activeElement);

    if (currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
    }
  }
}

function debounce() {
  let timer;
  return function (callback, delay = 300) {
    clearTimeout(timer);
    timer = setTimeout(callback, delay);
  };
}

var TBackButton = {
  update() {
    WebApp.BackButton.onClick(TBackButton.onClick);
    if (Aj.state.backButton || Popups?.length) {
      WebApp.BackButton.show();
    } else {
      WebApp.BackButton.hide();
    }
  },
  onClick() {
    if (Popups?.length) {
      return closePopup();
    }
    if (Aj.state.backButton) {
      Aj.location(Aj.state.backButton);
      return;
    }
    WebApp.close();
  },
  initBackSwipe() {
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

    zone.addEventListener('touchstart', function(event) {
        touchstartX = event.touches[0].screenX;
        touchstartY = event.touches[0].screenY;
    });

    zone.addEventListener('touchmove', function(event) {
        touchendX = event.changedTouches[0].screenX;
        touchendY = event.changedTouches[0].screenY;

        deltaX = touchendX - touchstartX;
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
        var translateX = (touchendX - touchstartX) / 1.2;
        translateX = asymptoticInterp((touchendX - touchstartX) / 1.2 / 120, 0, 130, 1);
        translateX -= 40;
        $('.tm-swipe-back')[0].style.left = translateX - 52 + 'px';
    }, {passive: false})

    zone.addEventListener('touchend', function(event) {
      if (type == 'h' && touchendX - touchstartX > threshold) {
        if (!feedbackDelay) {
          WebApp.HapticFeedback.impactOccurred('light');
        }
        TBackButton.onClick?.();
      }
      notified = false;
      type = null;
      touchendX = event.changedTouches[0].screenX;
      touchendY = event.changedTouches[0].screenY;
      $('.tm-swipe-back')[0].style.left = '-52px';
    }, false);

    function asymptoticInterp(t, start, end, rate = 5) {
      if (t <= 0) return start;
      return start + (end - start) * (t / (t + 0.5));
    }
  }
}
