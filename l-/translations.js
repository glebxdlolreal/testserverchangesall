(function() {
  window.TrInitAfterAj = function(init) {
    if (window.Aj) return init();
    setTimeout(function() { window.TrInitAfterAj(init); }, 0);
  };
})();

(function($) {
  $.fn.initDropdown = function(options) {
    return this.map(function() {
      var $dd = $(this);
      var $field = $('.form-control-dropdown-search .form-control', $dd);
      var $select = $('.form-control-dropdown-select', $dd);
      var $results = $('.form-control-dropdown-list', $dd);

      function toggleDD(open) {
        if (open) {
          $field.val('').trigger('datachange');
        }
        $dd.toggleClass('open', open);
        $select.attr('aria-expanded', open ? 'true' : 'false');
      }

      function onFocus() {
        toggleDD(true);
        setTimeout(function(){ $field.focus(); }, 100);
      }

      $field.initSearch($.extend({
        $results: $results,
        emptyQueryEnabled: true,
        updateOnInit: true,
        itemClass: 'form-control-dropdown-list-item',
        onOpen: function() {
          toggleDD(true);
        },
        onClose: function() {
          toggleDD(false);
        }
      }, options));
      $select.on('focus.dropdown click.dropdown', onFocus);
      return this;
    });
  };
  $.fn.destroyDropdown = function() {
    return this.map(function() {
      var $dd = $(this);
      var $field = $('.form-control-dropdown-search .form-control', $dd);
      var $select = $('.form-control-dropdown-select', $dd);
      $field.destroySearch();
      $select.off('.dropdown');
      return this;
    });
  }
})(jQuery);

/* Compact popup focus handling layers over shared popup behavior. */
var PopupA11y = {
  registered: false,
  stack: [],
  init: function() {
    if (this.registered) return;
    this.registered = true;
    var self = this;
    $(document).on('popup:open.tr-popup-a11y', '.popup-container, .popup', function(e) {
      if (!self.compact()) return;
      if (self.root(this) !== self.root(e.target)) return;
      self.open(this);
    }).on('popup:close.tr-popup-a11y', '.popup-container, .popup', function(e) {
      if (!self.compact()) return;
      if (self.root(this) !== self.root(e.target)) return;
      self.close(this);
    }).on('keydown.tr-popup-a11y', function(e) {
      if (!self.compact() || e.key !== 'Tab') return;
      var root = self.top();
      if (!root) return;
      var focusable = self.focusable(root);
      if (!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      var active = document.activeElement;
      var inside = active === root || $.contains(root, active);
      if (!inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    });
    $(window).on('resize.tr-popup-a11y orientationchange.tr-popup-a11y', function() { self.refresh(); });
    if (window.visualViewport) $(window.visualViewport).on('resize.tr-popup-a11y scroll.tr-popup-a11y', function() { self.refresh(); });
    Aj.onUnload(function() {
      self.stack = $.grep(self.stack, function(record) { return document.documentElement.contains(record.root); });
    });
  },
  compact: function() {
    return !window.matchMedia || window.matchMedia('(max-width: 991px)').matches;
  },
  refresh: function() {
    if (!this.compact()) return;
    var height = window.visualViewport && window.visualViewport.height || window.innerHeight;
    $('.popup-container:visible').each(function() {
      var popup = $('.popup', this).first()[0];
      if (popup) popup.style.setProperty('--tr-visible-vh', Math.round(height) + 'px');
    });
  },
  root: function(el) {
    var $el = $(el);
    // popup:open/close bubbles from both nodes; always track the container so
    // one dialog cannot create two focus-stack records.
    return $el.closest('.popup-container')[0] || $el.closest('.popup')[0] || el;
  },
  focusable: function(root) {
    return $(root).find('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])').filter(':visible').toArray();
  },
  top: function() {
    for (var i = this.stack.length - 1; i >= 0; i--) {
      if (document.documentElement.contains(this.stack[i].root) && $(this.stack[i].root).is(':visible')) return this.stack[i].root;
    }
    return null;
  },
  open: function(el) {
    this.stack = $.grep(this.stack, function(record) { return document.documentElement.contains(record.root) && $(record.root).is(':visible'); });
    var root = this.root(el);
    for (var i = 0; i < this.stack.length; i++) if (this.stack[i].root === root) return;
    var labelled = root.getAttribute('aria-labelledby') || root.querySelector('h1[id],h2[id],h3[id],h4[id],h5[id]');
    if (!root.getAttribute('role')) root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    if (labelled && !root.getAttribute('aria-labelledby')) {
      if (!labelled.id) labelled.id = 'tr-popup-title-' + this.stack.length;
      root.setAttribute('aria-labelledby', labelled.id);
    }
    this.stack.push({root: root, origin: document.activeElement});
    this.refresh();
    var first = this.focusable(root)[0];
    if (first) setTimeout(function() { if (document.documentElement.contains(first)) first.focus(); }, 0);
  },
  close: function(el) {
    var root = this.root(el), record = null;
    for (var i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].root === root) { record = this.stack[i]; break; }
    }
    if (!record) return;
    // A parent close can tear down a nested dialog in the same lifecycle.
    // Prune all contained records while retaining the parent's origin.
    this.stack = $.grep(this.stack, function(item) {
      return item.root !== root && !$.contains(root, item.root);
    });
    var prior = this.top();
    var target = record.origin;
    if ((!target || typeof target.focus !== 'function' || !document.documentElement.contains(target) ||
         !$(target).is(':visible') || root === target || $.contains(root, target)) && prior) {
      target = this.focusable(prior)[0];
    }
    if (target && document.documentElement.contains(target)) setTimeout(function() { target.focus(); }, 0);
  }
};
TrInitAfterAj(function() { PopupA11y.init(); });

var TrCompactScrollLock = {
  depth: 0,
  scrollY: 0,
  bodyStyles: null,
  htmlStyles: null,
  mediaQuery: null,
  installBreakpoint: function() {
    if (this.mediaQuery || !window.matchMedia) return;
    this.mediaQuery = window.matchMedia('(max-width: 991px)');
    var self = this;
    var onChange = function(e) {
      if (typeof Nav !== 'undefined') Nav.stopDrawerTransition();
      if (e.matches) {
        var field = document.querySelector('.tr-search-field');
        var value = field ? (field.value || field.textContent || field.getAttribute('data-value') || '') : '';
        if (field && (value || document.activeElement === field)) $('.tr-search').addClass('tr-search-open');
      } else {
        while (self.depth) self.unlock();
        $('body').removeClass('tr-drawer-open');
        $('.tr-drawer-backdrop').prop('hidden', true);
        $('.tr-compact-nav-toggle').attr({'aria-expanded': 'false', 'aria-label': 'Open navigation'});
        $('.tr-search').removeClass('tr-search-open');
        if (typeof Search !== 'undefined') Search._scrollLocked = false;
        if (typeof EmojiSearch !== 'undefined') {
          EmojiSearch._scrollLocked = false;
          var emojiState = EmojiSearch._state;
          if (emojiState && emojiState.$searchEmojiPanel && emojiState.$searchEmojiPanel.unblockBodyScroll) emojiState.$searchEmojiPanel.unblockBodyScroll();
        }
      }
      if (typeof Nav !== 'undefined') Nav.syncDrawerA11y();
    };
    this.breakpointListener = onChange;
    if (this.mediaQuery.addEventListener) this.mediaQuery.addEventListener('change', onChange);
    else if (this.mediaQuery.addListener) this.mediaQuery.addListener(onChange);
  },
  compact: function() {
    return !window.matchMedia || window.matchMedia('(max-width: 991px)').matches;
  },
  lock: function() {
    this.installBreakpoint();
    if (!this.compact()) return false;
    if (this.depth++) return true;
    var body = document.body;
    var html = document.documentElement;
    this.scrollY = window.pageYOffset || html.scrollTop || 0;
    this.bodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      boxSizing: body.style.boxSizing,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    this.htmlStyles = {scrollbarGutter: html.style.scrollbarGutter};
    var scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
    html.style.scrollbarGutter = 'stable';
    body.style.position = 'fixed';
    body.style.top = (-this.scrollY) + 'px';
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.boxSizing = 'border-box';
    body.style.overflow = 'hidden';
    if (scrollbarWidth) body.style.paddingRight = scrollbarWidth + 'px';
    body.classList.add('tr-scroll-locked');
    return true;
  },
  unlock: function() {
    if (!this.depth) return;
    if (--this.depth) return;
    var body = document.body;
    var html = document.documentElement;
    var y = this.scrollY;
    var bodyStyles = this.bodyStyles || {};
    var htmlStyles = this.htmlStyles || {};
    body.classList.remove('tr-scroll-locked');
    body.style.position = bodyStyles.position || '';
    body.style.top = bodyStyles.top || '';
    body.style.left = bodyStyles.left || '';
    body.style.right = bodyStyles.right || '';
    body.style.width = bodyStyles.width || '';
    body.style.boxSizing = bodyStyles.boxSizing || '';
    body.style.overflow = bodyStyles.overflow || '';
    body.style.paddingRight = bodyStyles.paddingRight || '';
    html.style.scrollbarGutter = htmlStyles.scrollbarGutter || '';
    window.scrollTo(0, y);
    this.bodyStyles = this.htmlStyles = null;
  }
};

var TrMotion = {
  installed: false,
  active: function() {
    return TrCompactScrollLock.compact() && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
  install: function() {
    if (this.installed) return;
    this.installed = true;
    var self = this;
    ['animate', 'fadeIn', 'fadeOut', 'fadeToggle', 'slideDown', 'slideUp', 'slideToggle'].forEach(function(name) {
      var original = $.fn[name];
      if (!original || original._trMotionWrapped) return;
      var wrapped = function() {
        if (!self.active()) return original.apply(this, arguments);
        var args = Array.prototype.slice.call(arguments);
        if (name === 'animate') {
          if (args[1] && typeof args[1] === 'object') args[1] = $.extend({}, args[1], {duration: 0});
          else if (typeof args[1] !== 'undefined') args[1] = 0;
        } else if (typeof args[0] === 'number') {
          args[0] = 0;
        }
        return original.apply(this, args);
      };
      wrapped._trMotionWrapped = true;
      $.fn[name] = wrapped;
    });
  }
};

var TrSemanticAudit = {
  selectors: '.key-usage-header,.comment-reply-link,.comment-delele-btn,.comment-restore-btn,.comment-delete-all-btn,.key-suggestion-delete,.key-suggestion-delete-all,.key-suggestion-comment,.key-suggestion-edit,.key-suggestion-like,.key-suggestion-dislike,.mark-as-translated-btn,.key-add-suggestion-header-wrap,.tr-emoji-keywords-suggestion-btn,.tr-emoji-keywords-suggestion-header .tr-back,.tr-emoji-keyword-new .tr-back,.tr-search-emoji-icon,.tr-key-block-close,.langpack-enable,.app-release',
  imeSelector: '.tr-search-field,.key-add-suggestion-field,.comment-field,.tr-emoji-keyword-add-form [contenteditable="true"]',
  imeCapture: null,
  mutationObserver: null,
  init: function() {
    var self = this;
    Aj.onLoad(function() {
      TrMotion.install();
      self.apply();
      self.bindIme();
    });
    $(document).off('keydown.tr-semantic').on('keydown.tr-semantic', self.selectors + ':not(button):not([href])', function(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      $(this).trigger('click');
    });
    $(document).off('keydown.tr-row-selection').on('keydown.tr-row-selection', '.tr-plain-key-row[tabindex="0"]', function(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if ($(e.target).closest('a,button,input,select,textarea,[contenteditable="true"]').length) return;
      e.preventDefault();
      e.stopPropagation();
      $('.tr-row-select', this).first().trigger('click');
    }).off('click.tr-row-selection', '.tr-row-select').on('click.tr-row-selection', '.tr-row-select', function() {
      var $row = $(this).closest('.tr-plain-key-row');
      setTimeout(function() {
        if ($row.length) $row.attr('aria-selected', $row.hasClass('selected') || $('.tr-row-select', $row).attr('aria-pressed') === 'true' ? 'true' : 'false');
      }, 0);
    });
    $(document).off('click.tr-release-detail').on('click.tr-release-detail', '.app-release', function(e) {
      if (window.matchMedia && !window.matchMedia('(max-width: 991px)').matches) return;
      e.preventDefault();
      e.stopPropagation();
      var $item = $(this), open = !$item.hasClass('detail-open');
      $item.siblings('.app-release').removeClass('detail-open').attr('aria-expanded', 'false');
      $item.toggleClass('detail-open', open).attr('aria-expanded', open ? 'true' : 'false');
    });
    if (window.MutationObserver && document.body && !self.mutationObserver) {
      self.mutationObserver = new MutationObserver(function(records) {
        for (var i = 0; i < records.length; i++) if (records[i].addedNodes && records[i].addedNodes.length) { self.apply(); break; }
      });
      self.mutationObserver.observe(document.body, {childList: true, subtree: true});
    }
  },
  apply: function() {
    var self = this;
    $(self.selectors).each(function() {
      var $el = $(this);
      if (this.tagName === 'BUTTON' || this.tagName === 'A' && this.getAttribute('href')) return;
      if (!$el.attr('role')) $el.attr('role', 'button');
      if (!$el.attr('tabindex')) $el.attr('tabindex', '0');
      if (!$el.attr('aria-label')) $el.attr('aria-label', $.trim($el.text()) || 'Action');
    });
    $('.key-usage-header').each(function() {
      var $el = $(this), $key = $el.parents('.tr-key-full-block');
      $el.attr('aria-expanded', $('.key-usage-lines-wrap', $key).is(':visible') ? 'true' : 'false');
    });
    $('.app-release').each(function() {
      var $el = $(this);
      $el.attr('aria-expanded', $el.hasClass('detail-open') ? 'true' : 'false');
      if (!$el.attr('aria-label')) $el.attr('aria-label', $el.attr('data-title') || [$el.attr('data-since'), $el.attr('data-until')].filter(Boolean).join(' – ') || 'Release details');
    });
    $('.tr-back').each(function() { if (!this.getAttribute('aria-label')) this.setAttribute('aria-label', 'Back'); });
    $('.tr-header-tab > a').each(function() {
      var selected = $(this).hasClass('active') || $(this).parent().hasClass('active');
      this.setAttribute('role', 'tab');
      this.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    $('.key-add-suggestion-field,.comment-field,.tr-emoji-keyword-add-form [contenteditable="true"],.tr-search-field[contenteditable="true"]').each(function() {
      var $field = $(this);
      if (!$field.attr('role')) $field.attr('role', 'textbox');
      if (!$field.attr('aria-multiline')) $field.attr('aria-multiline', $field.is('.tr-search-field') ? 'false' : 'true');
      if (!$field.attr('aria-label')) $field.attr('aria-label', $field.attr('data-placeholder') || $field.attr('placeholder') || 'Text');
    });
    $('.tr-plain-key-row').each(function() {
      var $row = $(this);
      if (!$row.find('.tr-row-select').length) return;
      $row.attr({role: $row.attr('role') || 'group', tabindex: '0', 'aria-selected': $row.hasClass('selected') || $row.find('.tr-row-select').attr('aria-pressed') === 'true' ? 'true' : 'false'});
      if (!$row.attr('aria-label') && $row.attr('data-key')) $row.attr('aria-label', $row.attr('data-key'));
    });
    $('input.file-upload').each(function() {
      if (!this.getAttribute('aria-label')) {
        var label = $(this).closest('[data-label]').attr('data-label') || 'Upload file';
        this.setAttribute('aria-label', label);
      }
    });
    $('.key-suggestion-like,.key-suggestion-dislike').each(function() {
      var $counters = $(this).closest('.key-suggestion-counters');
      $(this).attr('aria-pressed', $(this).hasClass('key-suggestion-like') ? ($counters.hasClass('liked') ? 'true' : 'false') : ($counters.hasClass('disliked') ? 'true' : 'false'));
    });
  },
  bindIme: function() {
    var self = this;
    $(document).off('compositionstart.tr-ime', self.imeSelector).on('compositionstart.tr-ime', self.imeSelector, function() {
      $(this).data('tr-composing', true);
    }).off('compositionend.tr-ime', self.imeSelector).on('compositionend.tr-ime', self.imeSelector, function() {
      var field = this;
      var state = Aj.state;
      var route = Aj.location().href;
      var generation = TrResponsiveLifecycle.generation;
      $(field).data('tr-composing', false);
      setTimeout(function() {
        if (state === Aj.state && route === Aj.location().href && generation === TrResponsiveLifecycle.generation &&
            document.documentElement.contains(field) && $(field).is(self.imeSelector)) {
          $(field).trigger('input').trigger('contentchange');
        }
      }, 0);
    });
    if (!self.imeCapture) {
      self.imeCapture = function(e) {
        if (e.isComposing || e.inputType === 'insertCompositionText' || $(e.target).data('tr-composing')) e.stopImmediatePropagation();
      };
      document.addEventListener('input', self.imeCapture, true);
    }
  }
};
TrInitAfterAj(function() { TrSemanticAudit.init(); });


var Nav = {
  _registered: false,
  _scrollY: 0,
  _returnFocus: null,
  _drawerTransitionTimer: 0,
  _languagesDataGeneration: 0,
  _favoriteGenerations: {},
  _activationGeneration: 0,
  init: function() {
    if (Nav._registered) {
      Nav.bind();
      return;
    }
    Nav._registered = true;
    Nav.bind();
    Aj.onLoad(Nav.bind);
    Aj.onUnload(function(state) {
      Nav._languagesDataGeneration++;
      Nav._activationGeneration++;
      Nav._favoriteGenerations = {};
      if (state) {
        delete state.languagesData;
        delete state.languagesDataRequestGeneration;
      }
      $(document).off('.tr-nav').off('keydown.tr-nav-global');
      Nav.closeDrawer(null, true);
    });
  },
  bind: function() {
    TrCompactScrollLock.installBreakpoint();
    Nav.bindCurrentMenu();
    Nav.syncDrawerA11y();
    $(document).off('.tr-nav').on('click.tr-nav', '.tr-menu-header', Nav.eToggleMenuSection)
      .on('keydown.tr-nav', '.tr-search-filter-item[role="option"]:not([href]), .tr-languages-filter[role="option"]:not([href]), .languages-link[role="button"], .languages-link a[role="button"], .header-search-btn[role="button"]', Nav.onOptionKeyDown)
      .on('mouseover.tr-nav focusin.tr-nav', '.languages-link', Nav.loadLanguagesData)
      .on('click.tr-nav', '.languages-link', Nav.openLanguages)
      .on('click.tr-nav', '.langpack-enable', Nav.enableLangPack)
      .on('click.tr-nav', '.header-auth-name', function() {
        var button = this;
        setTimeout(function() { $(button).attr('aria-expanded', $(button).parent().hasClass('open') ? 'true' : 'false'); }, 0);
      })
      .on('click.tr-nav', '.tr-compact-nav-toggle', Nav.toggleDrawer)
      .on('click.tr-nav', '.tr-compact-search,.header-search-btn', Nav.openSearch)
      .on('click.tr-nav', '.tr-search-close', Nav.closeSearch)
      .on('click.tr-nav', '.tr-drawer-backdrop', Nav.closeDrawer)
      .on('click.tr-nav', '#tr-mobile-drawer a[href]:not(.languages-link)', Nav.closeDrawerForNavigation)
      .on('click.tr-nav', '.tr-compact-back', Nav.goBack);
    $(document).off('keydown.tr-nav-global').on('keydown.tr-nav-global', Nav.onGlobalKeyDown);
  },
  bindCurrentMenu: function() {
    if (window.matchMedia && window.matchMedia('(max-width: 991px)').matches && !$('body').hasClass('tr-drawer-open')) {
      return;
    }
    $('.tr-menu-items .active').each(function() {
      var $sectionEl = $(this).parents('.tr-menu-section');
      if (!$sectionEl.is(':visible')) return;
      $('.tr-menu-selected > .tr-menu-item', $sectionEl).css('marginTop', $(this).position().top);
    });
  },
  onOptionKeyDown: function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.click();
    }
  },
  eToggleMenuSection: function(e) {
    var $sectionEl = $(this).parents('.tr-menu-section');
    Nav.toggleMenuSection($sectionEl);
  },
  toggleMenuSection: function($sectionEl, state) {
    if (typeof state === 'undefined') {
      state = !$sectionEl.hasClass('tr-menu-section-collapsed');
    }
    var sid = $sectionEl.attr('data-menu-section-id');
    var collapsed_mask = Cookies.get('stel_tr_menu') || 0;
    if (state) {
      collapsed_mask |= (1 << sid);
    } else {
      collapsed_mask &= ~(1 << sid);
    }
    Cookies.set('stel_tr_menu', collapsed_mask, {expires: 365, secure: true});

    $('.tr-menu-items', $sectionEl).prepareSlideY();
    $sectionEl.toggleClass('tr-menu-section-collapsed', state);
    $sectionEl.find('> .tr-menu-header-wrap > .tr-menu-header').attr('aria-expanded', state ? 'false' : 'true');
  },
  toggleDrawer: function(e) {
    if (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    if ($('body').hasClass('tr-drawer-open')) {
      Nav.closeDrawer(e);
    } else {
      Nav.openDrawer(e);
    }
  },
  openDrawer: function(e) {
    Nav._scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    Nav._returnFocus = Nav.visibleNavToggle();
    Nav.startDrawerTransition();
    TrCompactScrollLock.lock();
    $('body').addClass('tr-drawer-open');
    Nav.setDrawerHidden(false);
    $('.tr-drawer-backdrop').prop('hidden', false);
    $('.tr-compact-nav-toggle').attr({'aria-expanded': 'true', 'aria-label': 'Close navigation'});
    Nav.bindCurrentMenu();
    var first = document.querySelector('#tr-mobile-drawer a, #tr-mobile-drawer button');
    var route = Aj.location().href;
    var state = Aj.state;
    if (first) setTimeout(function(){ if (state === Aj.state && route === Aj.location().href && document.documentElement.contains(first)) first.focus(); }, 0);
  },
  closeDrawer: function(e, silent) {
    if (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    if (silent) Nav.stopDrawerTransition();
    if (!$('body').hasClass('tr-drawer-open')) return;
    if (!silent) Nav.startDrawerTransition();
    $('body').removeClass('tr-drawer-open');
    Nav.setDrawerHidden(TrCompactScrollLock.compact());
    $('.tr-drawer-backdrop').prop('hidden', true);
    $('.tr-compact-nav-toggle').attr({'aria-expanded': 'false', 'aria-label': 'Open navigation'});
    TrCompactScrollLock.unlock();
    if (!silent) {
      var focusTarget = Nav.visibleNavToggle() || Nav._returnFocus;
      if (focusTarget && document.contains(focusTarget)) focusTarget.focus();
    }
    Nav._returnFocus = null;
  },
  startDrawerTransition: function() {
    Nav.stopDrawerTransition();
    $('body').addClass('tr-drawer-transition');
    Nav._drawerTransitionTimer = setTimeout(Nav.stopDrawerTransition, 240);
  },
  stopDrawerTransition: function() {
    if (Nav._drawerTransitionTimer) clearTimeout(Nav._drawerTransitionTimer);
    Nav._drawerTransitionTimer = 0;
    $('body').removeClass('tr-drawer-transition');
  },
  openSearch: function(e) {
    if ($('.tr-search-emoji-panel').length && window.EmojiSearch) {
      EmojiSearch.eOpen(e);
    } else if (window.Search) {
      Search.eOpen(e);
    }
  },
  closeSearch: function(e) {
    if ($('.tr-search-emoji-panel').length && window.EmojiSearch) {
      EmojiSearch.close(e);
    } else if (window.Search) {
      Search.close(e);
    }
  },
  closeDrawerForNavigation: function() {
    Nav.closeDrawer(null, true);
  },
  setDrawerHidden: function(hidden) {
    var drawer = document.getElementById('tr-mobile-drawer');
    if (!drawer) return;
    if (hidden) drawer.setAttribute('aria-hidden', 'true'); else drawer.removeAttribute('aria-hidden');
    drawer.inert = !!hidden;
  },
  syncDrawerA11y: function() {
    Nav.setDrawerHidden(TrCompactScrollLock.compact() && !$('body').hasClass('tr-drawer-open'));
  },
  visibleNavToggle: function() {
    var nodes = document.querySelectorAll('.tr-compact-nav-toggle');
    for (var i = 0; i < nodes.length; i++) if ($(nodes[i]).is(':visible') && nodes[i].getClientRects().length) return nodes[i];
    return null;
  },
  goBack: function(e) {
    /* Let the rendered parent link drive navigation. */
    if (e) e.stopImmediatePropagation();
    Nav.closeDrawer(null, true);
  },
  onGlobalKeyDown: function(e) {
    if (e.key === 'Escape') {
      if ($('body').hasClass('tr-drawer-open')) {
        Nav.closeDrawer(e);
      }
      if ($('.tr-search').hasClass('tr-search-open') && window.Search) Search.close();
      return;
    }
    if (e.key !== 'Tab' || !$('body').hasClass('tr-drawer-open')) return;
    var drawer = document.getElementById('tr-mobile-drawer');
    if (!drawer) return;
    var focusable = drawer.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  },
  openFilePopup: function(e) {
    e.stopImmediatePropagation();
    e.preventDefault();
    openPopup('#file-popup-container', {closeByClickOutside: '.popup-body'});
  },
  initLanguageFilter: function() {
    Aj.state.langFilters = {};
    $('.tr-languages-filter').each(function() {
      var lang_pack = $(this).data('value');
      Aj.state.langFilters[lang_pack] = !$(this).parent('li').hasClass('selected');
    });
  },
  updateLanguageFilter: function() {
    $('.tr-languages-filter').each(function() {
      var lang_pack = $(this).data('value');
      var filtered = Aj.state.langFilters[lang_pack] || false;
      $(this).parent('li').toggleClass('selected', !filtered);
      $(this).attr('aria-selected', filtered ? 'false' : 'true');
    });
  },
  toggleLanguageFilter: function(e) {
    e.stopImmediatePropagation();
    e.preventDefault();
    var lang_pack = $(this).data('value');
    Aj.state.langFilters[lang_pack] = !Aj.state.langFilters[lang_pack];
    $('.tr-languages-search-field').trigger('contentchange');
    $('.tr-languages-nav .tr-badges').html(Nav.getLanguageBadges(Aj.state.curLangData));
    Nav.updateLanguageFilter();
  },
  selectLanguageFilter: function(e) {
    e.stopImmediatePropagation();
    e.preventDefault();
    var lang_pack = $(this).data('value');
    var filtered_cnt = 0;
    for (var k in Aj.state.langFilters) {
      if (Aj.state.langFilters[k]) filtered_cnt++;
    }
    var $filters = $('.tr-languages-filter');
    if (filtered_cnt != $filters.length - 1 ||
        Aj.state.langFilters[lang_pack]) {
      $filters.each(function() {
        var lp = $(this).data('value');
        Aj.state.langFilters[lp] = (lang_pack != lp);
      });
    } else {
      Aj.state.langFilters = {};
      Aj.state.langFilters[lang_pack] = true;
    }
    $('.tr-languages-search-field').trigger('contentchange');
    $('.tr-languages-nav .tr-badges').html(Nav.getLanguageBadges(Aj.state.curLangData));
    Nav.updateLanguageFilter();
  },
  loadLanguagesData: function() {
    return Nav.getLanguagesData(function() {
      $('.tr-languages-search-field').trigger('dataready');
    });
  },
  reloadLanguagesData: function() {
    delete Aj.state.languagesData;
    delete Aj.state.languagesDataError;
    return Nav.getLanguagesData(function() {
      $('.tr-languages-results').attr('aria-busy', 'false');
      $('.tr-languages-search-field').trigger('dataready').trigger('contentchange');
    });
  },
  getLanguagesData: function(onDataReady) {
    var _data = Aj.state.languagesData;
    if (_data === false) {
      return false;
    } else if (_data) {
      return _data;
    }
    Aj.state.languagesData = false;
    var requestRoute = Aj.location().href;
    var requestState = Aj.state;
    var requestGeneration = ++Nav._languagesDataGeneration;
    Aj.state.languagesDataRequestGeneration = requestGeneration;
    Aj.apiRequest('getLanguages', {
      lang: Aj.state.curLang
    }, function(result) {
      if (requestGeneration !== Nav._languagesDataGeneration || requestState !== Aj.state || Aj.location().href !== requestRoute) {
        if (requestState && requestState.languagesDataRequestGeneration === requestGeneration) delete requestState.languagesData;
        return;
      }
      if (result.data) {
        for (var i = 0; i < result.data.length; i++) {
          var item = result.data[i];
          item._values = [item.name.toLowerCase(), item.native_name.toLowerCase()];
          if (item.lang == Aj.state.curLang) {
            Aj.state.curLangData = item;
          }
        }
        Aj.state.languagesData = result.data;
        delete Aj.state.languagesDataRequestGeneration;
        onDataReady && onDataReady();
      } else {
        Aj.state.languagesData = [];
        Aj.state.languagesDataError = result.error || 'Unable to load languages.';
        delete Aj.state.languagesDataRequestGeneration;
        onDataReady && onDataReady(false);
      }
    });
    return false;
  },
  getLanguageBadges: function(item) {
    if (!item) {
      return '';
    }
    var badges = '', count;
    if (item.unreleased) {
      count = 0;
      for (var lang_pack in item.unreleased) {
        if (!Aj.state.langFilters[lang_pack]) {
          count += item.unreleased[lang_pack];
        }
      }
      if (count > 0) {
        badges += '<a href="/' + item.lang + '/unreleased/" class="tr-badge unreleased">' + count + '</a>';
      }
    }
    if (item.untranslated) {
      count = 0;
      for (var lang_pack in item.untranslated) {
        if (!Aj.state.langFilters[lang_pack]) {
          count += item.untranslated[lang_pack];
        }
      }
      if (count > 0) {
        badges += '<a href="/' + item.lang + '/untranslated/" class="tr-badge">' + count + '</a>';
      }
    }
    return badges;
  },
  toggleLanguageFavorite: function(e) {
    var el = this;
    var lang = this.value;
    var fav  = this.checked;
    var previousFav = !fav;
    var langItems = Aj.state.languagesData || [];
    for (var i = 0; i < langItems.length; i++) {
      if (langItems[i].lang == lang) {
        previousFav = !!langItems[i].fav;
        langItems[i].fav = fav;
        break;
      }
    }
    var requestRoute = Aj.location().href;
    var requestState = Aj.state;
    var requestGeneration = (Nav._favoriteGenerations[lang] || 0) + 1;
    Nav._favoriteGenerations[lang] = requestGeneration;
    Aj.apiRequest('toggleLanguageFavorite', {
      lang: lang,
      fav:  fav ? 1 : 0
    }, function(result) {
      if (requestGeneration !== Nav._favoriteGenerations[lang] || requestState !== Aj.state || Aj.location().href !== requestRoute || !document.documentElement.contains(el)) return;
      if (result.error) {
        $('.tr-languages-status').text(result.error);
        showAlert(result.error);
        var lang_items = Aj.state.languagesData || [];
        for (var i = 0; i < lang_items.length; i++) {
          var item = lang_items[i];
          if (item.lang == lang) {
            item.fav = previousFav;
            el.checked = previousFav;
            break;
          }
        }
      } else if (result.ok) {
        $('.tr-languages-status').text('');
        var lang_items = Aj.state.languagesData || [];
        var fav_items = [];
        var cur_lang = Aj.state.curLang;
        var cur_lang_item = false;
        for (var i = 0; i < lang_items.length; i++) {
          var item = lang_items[i];
          if (item.lang == lang) {
            item.fav = fav;
          }
          if (item.lang == cur_lang) {
            cur_lang_item = item;
          }
          if (item.fav) {
            fav_items.push(item);
          }
        }
        if (cur_lang_item && !cur_lang_item.fav) {
          fav_items.push(cur_lang_item);
        }
        var items_html = '';
        for (var i = 0; i < fav_items.length; i++) {
          var item = fav_items[i];
          var item_class = '';
          if (Aj.state.curLangpack &&
              typeof item.available !== 'undefined' &&
              !item.available[Aj.state.curLangpack]) {
            item_class += ' unavailable';
          }
          if (item.lang == cur_lang) {
            item_class += ' active';
          }
          items_html += '<li' + (item_class ? ' class="' + item_class.slice(1) + '"' : '') + '><div class="tr-badges">' + Nav.getLanguageBadges(item) + '</div><a class="tr-menu-item" href="' + Nav.languageHref(item.lang) + '"><span class="nav-label">' + item.name + '</span></a></li>';
        }
        items_html += '<li class="languages-link">' + $('#tr-menu-language-items li.languages-link').html() + '</li>';
        $('#tr-menu-language-items').html(items_html);
        Nav.init();
      }
    });
  },
  openLanguages: function(e) {
    Nav._returnFocus = Nav.visibleNavToggle() || (e && e.currentTarget);
    Nav.closeDrawer(e, true);
    var returnFocus = Nav._returnFocus || Nav.visibleNavToggle();
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    var $field, $results;
    $('#languages-popup-container').one('popup:open', function(popup) {
      $field = $('.tr-languages-search-field');
      $results = $('.tr-languages-results');
      $results.attr('aria-busy', 'true');
      Nav.initLanguageFilter();
      $field.initSearch({
        $results: $results,
        emptyQueryEnabled: true,
        updateOnInit: true,
        enterEnabled: function() {
          return false;
        },
        renderItem: function(item, query) {
          var available = false;
          if (item.available) {
            for (var lang_pack in item.available) {
              if (!Aj.state.langFilters[lang_pack]) {
                available = true; break;
              }
            }
          } else {
            available = true;
          }
          return (!Aj.unauth ? '<label class="checkbox-item"><input type="checkbox" class="checkbox" name="lang" value="' + item.lang + '" aria-label="Favorite ' + cleanHTML(item.name) + '"' + (item.fav ? ' checked' : '') + (item.def_fav ? ' disabled' : '') + '><span class="checkbox-input ripple-handler"><span class="ripple-mask"><span class="ripple"></span></span><span class="checkbox-input-icon"></span></span></label>' : '') + '<div class="tr-badges">' + Nav.getLanguageBadges(item) + '</div><a href="' + Nav.languageHref(item.lang) + '" class="tr-languages-result' + (item.def ? ' default' : '') + '' + (!available ? ' unavailable' : '') + '" aria-label="' + cleanHTML(item.name) + (!item.def ? ' (' + cleanHTML(item.native_name) + ')' : '') + '"><span class="tr-languages-name">' + item.name + '</span>' + (!item.def ? '<span class="tr-languages-native-name" dir="auto">' + item.native_name + '</span>' : '') + '</a>';
        },
        renderNoItems: function() {
          if (Aj.state.languagesDataError) return '<div class="tr-languages-no-results" role="alert">' + cleanHTML(Aj.state.languagesDataError) + '<br><button type="button" class="btn btn-default tr-languages-retry">Retry</button></div>';
          return '<div class="tr-languages-no-results">' + l('WEB_NO_LANGUAGES_FOUND') + '</div>';
        },
        renderLoading: function() {
          return '<div class="tr-languages-result-loading dots-animated">' + l('WEB_LOADING') + '</div>';
        },
        getData: function() {
          return Nav.getLanguagesData(function() {
            $results.attr('aria-busy', 'false');
            $field.trigger('dataready');
            $('input[checked]', $results).trigger('hover');
          });
        },
        onSelect: function(item) {
          var href = Nav.languageHref(item.lang);
          Aj.location(href);
        },
      });
      $field.focus();
      Nav.updateLanguageFilter();
      $('.tr-languages-filter').on('click', Nav.toggleLanguageFilter);
      $('.tr-languages-filter').on('dblclick', Nav.selectLanguageFilter);
      $results.on('mousedown', '.search-item a[href]', Aj.linkHandler);
      $results.on('click', '.search-item a[href]', preventDefault);
      $results.on('mousedown', '.checkbox-item', stopImmediatePropagation);
      $results.on('change', '.checkbox', Nav.toggleLanguageFavorite);
      $results.on('click', '.tr-languages-retry', function(e) { e.preventDefault(); $results.attr('aria-busy', 'true'); Nav.reloadLanguagesData(); });
      $results.initRipple();
      Nav.reloadLanguagesData();
    });
    $('#languages-popup-container').one('popup:close', function(popup) {
      $('.tr-languages-filter').off('click', Nav.toggleLanguageFilter);
      $('.tr-languages-filter').off('dblclick', Nav.selectLanguageFilter);
      $results.off('mousedown', '.search-item a[href]', Aj.linkHandler);
      $results.off('click', '.search-item a[href]', preventDefault);
      $results.off('mousedown', '.checkbox-item', stopImmediatePropagation);
      $results.off('change', '.checkbox', Nav.toggleLanguageFavorite);
      $results.off('click', '.tr-languages-retry');
      $results.destroyRipple();
      $field.destroySearch();
      if (returnFocus && document.contains(returnFocus) && $(returnFocus).is(':visible')) returnFocus.focus();
    });
    openPopup('#languages-popup-container', {closeByClickOutside: '.popup-body'});
    $(this).parents('.open').find('.dropdown-toggle').dropdown('toggle');
    if (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  },
  languageHref: function(lang) {
    var url = Aj.location();
    var path_parts = url.pathname.split('/');
    if (path_parts[1] == Aj.state.curLang ||
        Aj.state.langList.indexOf(path_parts[1]) >= 0) {
      path_parts[1] = lang;
      url.pathname = path_parts.join('/');
    } else if (url.pathname == '/') {
      url.pathname = '/' + lang + '/';
    } else {
      addUrlSearchParam(url, 'lang', lang);
    }
    return url.href;
  },
  enableLangPack: function() {
    var lang_pack_name = $(this).data('langpack-name');
    var lang_pack = $(this).data('langpack');
    var lang_name = $(this).data('lang-name');
    var lang = $(this).data('lang');
    var confirm_text = l('WEB_ACTIVATE_LANGPACK_CONFIRM_TEXT', {lang_pack: cleanHTML(lang_pack_name), lang: cleanHTML(lang_name)});
    var requestRoute = Aj.location().href;
    var requestGeneration = ++Nav._activationGeneration;
    showConfirm(confirm_text, function() {
        Aj.apiRequest('activateLangPack', {
          lang_pack: lang_pack,
          lang: lang
        }, function(result) {
          if (requestGeneration !== Nav._activationGeneration || Aj.location().href !== requestRoute) return;
          if (result.error) {
            showAlert(result.error);
          }
          if (result.ok && result.href) {
            Aj.location(result.href);
          }
        });
    }, l('WEB_ACTIVATE_LANGPACK_CONFIRM_BUTTON'));
  }
};
TrInitAfterAj(function() { Nav.init(); });

var Header = {
  init: function() {
    Aj.onLoad(function(state) {
      $(window).off('scroll.tr-header').on('scroll.tr-header', Header.onScroll);
    });
    Aj.onUnload(function(state) {
      $(window).off('scroll.tr-header');
    });
  },
  onScroll: function() {
    if (window.matchMedia && window.matchMedia('(max-width: 991px)').matches) {
      $('header').css('marginLeft', '');
      return;
    }
    var scrollLeft = $(window).scrollLeft();
    $('header').css('marginLeft', -scrollLeft);
  }
};

var Search = {
  _generation: 0,
  _registered: false,
  _scrollLocked: false,
  _touchScrollStart: 0,
  init: function() {
    if (Search._registered) return;
    Search._registered = true;
    Aj.onLoad(function(state) {
      Search._generation++;
      var $field = $('.tr-search-field');
      var $results = $('.tr-search-results');
      $('.header-search-btn,.tr-compact-search').off('click.tr-search').on('click.tr-search', Search.eOpen);
      $('.tr-search-filter-where').off('click.tr-search').on('click.tr-search', '.tr-search-filter-item', Search.eChangeWhere);
      $('.tr-search-filter-lang').off('click.tr-search').on('click.tr-search', '.tr-search-filter-item', Search.eChangeLang);
      $('.tr-search-filter-langpack').off('click.tr-search').on('click.tr-search', '.tr-search-filter-item', Search.eChangeLangpack);
      $('.tr-search-reset').off('click.tr-search').on('click.tr-search', Search.eClearField);
      $('.tr-search-close').off('click.tr-search').on('click.tr-search', Search.close);
      $(document).off('click.tr-search-retry').on('click.tr-search-retry', '.tr-search-retry', Search.eRetryData);
      $('.tr-search-binding').off('click.tr-search').on('click.tr-search', function(e) {
        e.preventDefault();
        Search.bindingModeOff();
        $field.trigger('datachange');
      });
      $('.tr-search-field-wrap').off('mousedown.tr-search').on('mousedown.tr-search', Search.eOpen);
      $field.off('blur.tr-search').on('blur.tr-search', Search.onScroll);
      $('.tr-search-results,.tr-search-filters').off('.tr-search-scroll')
        .on('touchstart.tr-search-scroll', Search.eLockScroll)
        .on('touchmove.tr-search-scroll', Search.eLockScroll)
        .on('touchend.tr-search-scroll touchcancel.tr-search-scroll', Search.eUnlockScroll)
        .on('wheel.tr-search-scroll', Search.eLockScroll);
      $field.initSearch({
        $results: $results,
        $enter: $('.tr-search-enter'),
        enterEnabled: function() {
          return !Aj.state.searchModeBinding;
        },
        searchEnabled: function() {
          return !Aj.state.isSearchPage && !Aj.state.isReplacePage || !!Aj.state.searchModeBinding;
        },
        prepareQuery(query) {
          if (!query.length) {
            return false;
          }
          return Search.regexpFromQuery(query);
        },
        checkItem: function(item, or_regexps) {
          if (or_regexps === false) {
            return 0;
          }
          var values = [], i, j, k, and_found;
          var and_regexps, regexp, value, found, match;
          var search_where = Aj.state.searchWhere;
          if (search_where == 'key') {
            values = item._keys;
          } else if (search_where == 'text') {
            values = item._values;
          } else {
            values = [].concat(item._keys, item._values);
          }
          for (i = 0; i < or_regexps.length; i++) {
            and_regexps = or_regexps[i];
            and_found = true;
            for (j = 0; j < and_regexps.length; j++) {
              regexp = and_regexps[j]; found = false;
              var check_before = regexp._opts.before;
              for (k = 0; k < values.length; k++) {
                value = values[k];
                regexp.lastIndex = 0;
                while ((match = regexp.exec(value)) !== null) {
                  var matched = false;
                  if (check_before) {
                    if (!match.index || /\P{L}$/iu.test(value.substr(0, match.index))) {
                      matched = true;
                    }
                  } else {
                    matched = true;
                  }
                  if (matched) {
                    found = true;
                    regexp.lastIndex = 0;
                    break;
                  }
                }
                if (found) {
                  break;
                }
              }
              if (found !== !regexp._exclude) {
                and_found = false;
                break;
              }
            }
            if (and_found) {
              return value.length;
            }
          }
          return false;
        },
        renderItem: function(item, query) {
          var href = item.href + (Aj.state.searchModeBinding ? '?bind=' + Aj.state.searchBindTo : '');
          var search_where = Aj.state.searchWhere;
          var key_hl = '', val_hl = '';
          if (search_where == 'key') {
            key_hl = query;
          } else if (search_where == 'text') {
            val_hl = query;
          } else {
            key_hl = query;
            val_hl = query;
          }
          return '<a href="' + cleanAttr(href) + '" class="tr-search-result"><div class="tr-def-value">' + wrapLangValue(item.def_value, false, val_hl) + '</div><div class="tr-lang-key">' + Search.wrapHighlight(item.key, key_hl) + (!Aj.state.searchLangpack && Aj.state.langpackNames[item.lang_pack] ? '<span class="key-langpack">' + cleanHTML(Aj.state.langpackNames[item.lang_pack]) + '</span>' : '') + '</div>' + (item.value ? '<div class="tr-value">' + wrapLangValue(item.value, item.rtl, val_hl) + '</div>' : '') + '</a>';
        },
        renderNoItems: function() {
          var error = Search.getDataError(Aj.state.searchLang, Aj.state.searchLangpack);
          if (error) return '<div class="tr-search-no-results" role="alert">' + cleanHTML(error) + '<br><button type="button" class="btn btn-default tr-search-retry" data-lang="' + cleanAttr(Aj.state.searchLang) + '" data-langpack="' + cleanAttr(Aj.state.searchLangpack || '') + '">Retry</button></div>';
          return '<div class="tr-search-no-results">' + l('WEB_NO_TRANSLATIONS_FOUND') + '</div>';
        },
        renderLoading: function() {
          return '<div class="tr-search-result-loading dots-animated">' + l('WEB_TRANSLATIONS_LOADING') + '</div>';
        },
        getData: function() {
          var lang = Aj.state.searchLang;
          var lang_pack = Aj.state.searchLangpack;
          return Search.getData(lang, lang_pack, function() {
            $field.trigger('dataready');
          });
        },
        onSelect: function(item) {
          if (Aj.state.searchModeBinding && Aj.state.searchBindToWrapEl.size()) {
            LangKeys.openKey(Aj.state.searchBindToWrapEl, 0, item.lang_pack, item.key, item.section);
          } else {
            var href = item.href + (Aj.state.searchModeBinding ? '?bind=' + Aj.state.searchBindTo : '');
            Aj.location(href);
          }
        },
        onEnter: function(query) {
          if (Aj.state.isReplacePage) {
            Search.searchForReplace();
          } else {
            Search.goToSearch(query);
          }
        },
        onInput: function() {
          if ($(this).data('tr-composing')) return;
          Search.updateField();
        },
        onOpen: function(item) {
          $('.tr-search').addClass('tr-search-open');
        },
        onClose: function(item) {
          $('.tr-search').removeClass('tr-search-open');
          if (Aj.state.searchModeBinding) {
            Search.bindingModeOff();
            $field.trigger('datachange');
          }
        }
      });
      Search.updateField();
      $(window).on('scroll', Search.onScroll);
    });
    Aj.onUnload(function(state) {
      Search._generation++;
      var $field = $('.tr-search-field');
      var $results = $('.tr-search-results');
      $field.destroySearch();
      $('.header-search-btn,.tr-compact-search').off('.tr-search');
      $('.tr-search-filter-where,.tr-search-filter-lang,.tr-search-filter-langpack').off('.tr-search');
      $('.tr-search-reset,.tr-search-close').off('.tr-search');
      $('.tr-search-binding').off('.tr-search');
      $('.tr-search-field-wrap').off('.tr-search');
      $('.tr-search-results,.tr-search-filters').off('.tr-search-scroll');
      $field.off('.tr-search');
      $(window).off('scroll', Search.onScroll);
      Search.releaseScrollLock();
    });
  },
  simplify: function(str) {
    return str.toLowerCase().replace(/\n/g, ' ');
  },
  wrapHighlight: function(value, highlight, wrap_tag, prefix_only) {
    value = cleanHTML(value);
    if (highlight) {
      if (prefix_only) {
        var pattern = '^' + cleanRE(cleanHTML(highlight));
        value = value.replace(new RegExp(pattern, 'gi'), '<strong>$&<\/strong>');
      } else {
        var regexp = Search.regexpFromQuery(highlight, true);
        value = value.replace(regexp, function(match) {
          var args = Array.prototype.slice.call(arguments);
          var groups = args.pop();
          var check_before = false;
          for (var q in groups) {
            if (typeof groups[q] !== 'undefined') {
              check_before = regexp._opts[q].before;
            }
          }
          var matched = false;
          if (check_before) {
            var string = args.pop();
            var offset = args.pop();
            if (!offset || /\P{L}$/iu.test(string.substr(0, offset))) {
              matched = true;
            }
          } else {
            matched = true;
          }
          return matched ? '<strong>' + match + '<\/strong>' : match;
        });
      }
    }
    if (wrap_tag) {
      value = value.replace(TOKEN_REGEX, '<mark>$&</mark>');
    }
    return value;
  },
  regexpFromQuery: function(query, for_highlight) {
    if (!this._preparedQueries) {
      this._preparedQueries = [];
    }
    if (!this._preparedHlQueries) {
      this._preparedHlQueries = [];
    }
    var hl_queries = for_highlight ? this._preparedHlQueries : this._preparedQueries;
    if (typeof hl_queries[query] !== 'undefined') {
      return hl_queries[query];
    }
    query = Search.simplify(query);
    var and_words = [], regexp_maps = {inc:{}, exc:{}}, regexp_map;
    var regexp = /(-?)"((?:[^"\\]|\\.)+)"|(-?)([\(\[])((?:[^\(\)\[\]\\]|\\.)+)([\)\]])|(-?)([\p{L}\p{N}-]+)/gu;
    var query_word, word_regexp, hl_word_regexp, opts;
    var result = [], hl_result = [], hl_opts = {}, ind = 0;
    while ((match = regexp.exec(query)) !== null) {
      word_regexp = null; ++ind;
      if (query_word = match[2]) {
        query_word = '(?<q'+ind+'>' + cleanRE(cleanHTML(query_word)) + '(?=\\P{L}|$))';
        regexp_map = regexp_maps[match[1] ? 'exc' : 'inc'];
        opts = {before: true};
        if (!regexp_map[query_word]) {
          word_regexp = new RegExp(query_word, 'gui');
          word_regexp._opts = opts;
          regexp_map[query_word] = true;
          if (match[1]) {
            word_regexp._exclude = true;
          } else {
            hl_result.push(query_word);
            hl_opts['q' + ind] = opts;
          }
        }
      } else if (query_word = match[5]) {
        query_word = '(?<q'+ind+'>' + cleanRE(cleanHTML(query_word)) + (match[6] == ']' ? '(?=\\P{L}|$)' : '') + ')';
        regexp_map = regexp_maps[match[3] ? 'exc' : 'inc'];
        opts = {before: match[4] == '['};
        if (!regexp_map[query_word]) {
          word_regexp = new RegExp(query_word, 'gui');
          word_regexp._opts = opts;
          regexp_map[query_word] = true;
          if (match[3]) {
            word_regexp._exclude = true;
          } else {
            hl_result.push(query_word);
            hl_opts['q' + ind] = opts;
          }
        }
      } else if (query_word = match[8]) {
        query_word = '(?<q'+ind+'>' + cleanRE(cleanHTML(query_word)) + ')';
        regexp_map = regexp_maps[match[7] ? 'exc' : 'inc'];
        opts = {before: true};
        if (!regexp_map[query_word]) {
          word_regexp = new RegExp(query_word, 'gui');
          word_regexp._opts = opts;
          regexp_map[query_word] = true;
          if (match[7]) {
            word_regexp._exclude = true;
          } else {
            hl_result.push(query_word);
            hl_opts['q' + ind] = opts;
          }
        }
      }
      if (word_regexp) {
        and_words.push(word_regexp);
      }
    }
    if (and_words.length) {
      result.push(and_words);
    }
    if (for_highlight) {
      var result = new RegExp(hl_result.join('|'), 'gui');
      result._opts = hl_opts;
      return result;
    }
    hl_queries[query] = result;
    return result;
  },
  updateField: function() {
    var $field = $('.tr-search-field');
    var value = $field.val() || '';
    $('.tr-search').toggleClass('tr-search-has-value', value.length > 0);
  },
  goToSearch: function(query) {
    var params = [];
    if (Aj.state.searchLangpack) {
      params.push('lang_pack=' + encodeURIComponent(Aj.state.searchLangpack));
    }
    if (Aj.state.searchWhere) {
      params.push('where=' + encodeURIComponent(Aj.state.searchWhere));
    }
    if (query.length > 0) {
      params.push('query=' + encodeURIComponent(query));
    }
    var href = '/' + Aj.state.searchLang + '/search' + (params.length ? '?' + params.join('&') : '');
    Aj.location(href);
  },
  updateSearchFilter: function($filter, value, text) {
    $('li.selected', $filter).removeClass('selected');
    $('a.tr-search-filter-item', $filter).attr('aria-selected', 'false');
    $('a.tr-search-filter-item[data-value="' + value + '"]', $filter).parent('li').addClass('selected');
    $('a.tr-search-filter-item[data-value="' + value + '"]', $filter).attr('aria-selected', 'true');
    $('.tr-search-filter', $filter).text(text);
  },
  eChangeWhere: function() {
    var $field = $('.tr-search-field');
    var where = $(this).attr('data-value');
    if (Aj.state.searchModeBinding) {
      Search.bindingModeOff();
    }
    Search.changeWhere(where);
    if (Aj.state.isSearchPage) {
      Search.goToSearch($field.val());
    } else if (Aj.state.isReplacePage) {
      Search.searchForReplace();
    } else {
      Search.focus();
    }
  },
  changeWhere: function(where, query) {
    var $field = $('.tr-search-field');
    if (typeof query !== 'undefined') {
      $field.val(query).trigger('input');
    }
    Aj.state.searchWhere = where;
    Search.updateSearchFilter($('.tr-search-filter-where'), where, Aj.state.whereNames[where]);
    $field.trigger('datachange');
  },
  eChangeLang: function() {
    var $field = $('.tr-search-field');
    var lang = $(this).attr('data-value');
    if (Aj.state.searchModeBinding) {
      Search.bindingModeOff();
    }
    Search.changeLang(lang);
    if (Aj.state.isSearchPage) {
      Search.goToSearch($field.val());
    } else if (Aj.state.isReplacePage) {
      Search.searchForReplace();
    } else {
      Search.focus();
    }
  },
  changeLang: function(lang, query) {
    var $field = $('.tr-search-field');
    if (typeof query !== 'undefined') {
      $field.val(query).trigger('input');
    }
    Aj.state.searchLang = lang;
    Search.updateSearchFilter($('.tr-search-filter-lang'), lang, Aj.state.langNames[lang]);
    $field.trigger('datachange');
  },
  eChangeLangpack: function() {
    var $field = $('.tr-search-field');
    var lang_pack = $(this).attr('data-value');
    if (Aj.state.searchModeBinding) {
      Search.bindingModeOff();
    }
    Search.changeLangpack(lang_pack);
    if (Aj.state.isSearchPage) {
      Search.goToSearch($field.val());
    } else if (Aj.state.isReplacePage) {
      Search.searchForReplace();
    } else {
      Search.focus();
    }
  },
  changeLangpack: function(lang_pack, query, no_open) {
    var $field = $('.tr-search-field');
    if (typeof query !== 'undefined') {
      $field.val(query);
    }
    if (!no_open) {
      $field.trigger('input');
    }
    Aj.state.searchLangpack = lang_pack;
    Search.updateSearchFilter($('.tr-search-filter-langpack'), lang_pack, Aj.state.langpackNames[lang_pack]);
    $field.trigger('datachange');
  },
  bindingModeOn: function($wrapEl, bind_to, lang_pack, search_value) {
    var $field = $('.tr-search-field');
    $('.tr-search').addClass('tr-search-binding-mode');
    Aj.state.searchModeBinding = true;
    Aj.state.binding = true;
    Aj.state.searchBindToWrapEl = $wrapEl;
    Aj.state.searchBindTo = bind_to;
    Aj.state.searchBindPrevLangpack = Aj.state.searchLangpack;
    Aj.state.searchBindPrevValue = $field.val();
    Search.changeLangpack(lang_pack, search_value);
    Search.focus();
  },
  bindingModeOff: function() {
    var $field = $('.tr-search-field');
    $('.tr-search').removeClass('tr-search-binding-mode');
    Aj.state.searchModeBinding = false;
    Aj.state.binding = false;
    delete Aj.state.searchBindToWrapEl;
    delete Aj.state.searchBindTo;
    if (Aj.state.searchBindPrevLangpack) {
      Search.changeLangpack(Aj.state.searchBindPrevLangpack, Aj.state.searchBindPrevValue, true);
      delete Aj.state.searchBindPrevLangpack;
      delete Aj.state.searchBindPrevValue;
    }
  },
  eOpen: function(e) {
    if (e && $(e.target).closest('.tr-search-close').length) return;
    e && e.preventDefault();
    Search.focus();
  },
  close: function(e) {
    e && e.preventDefault();
    if (Aj.state && Aj.state.searchModeBinding) Search.bindingModeOff();
    $('.tr-search').removeClass('tr-search-open tr-search-binding-mode');
    Search.releaseScrollLock();
    if (Aj.state) Aj.state.searchModeBinding = false;
    var btn = document.querySelector('.tr-compact-search, .header-search-btn');
    if (btn && window.matchMedia && window.matchMedia('(max-width: 991px)').matches) btn.focus();
  },
  focus: function(e) {
    $('.tr-search').addClass('tr-search-open');
    var route = Aj.location().href;
    var state = Aj.state;
    setTimeout(function(){ if (state === Aj.state && route === Aj.location().href) $('.tr-search-field').first().focus(); }, 100);
  },
  eLockScroll: function(e) {
    var el = this;
    var oe = e.originalEvent || e;
    if (e.type === 'touchstart') {
      Search._touchScrollStart = oe.touches && oe.touches[0] ? oe.touches[0].clientY : 0;
      return;
    }
    var delta = e.type === 'wheel' ? oe.deltaY : Search._touchScrollStart - (oe.touches && oe.touches[0] ? oe.touches[0].clientY : Search._touchScrollStart);
    if (!delta) return;
    var atTop = el.scrollTop <= 0;
    var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    if (el.scrollHeight <= el.clientHeight || (delta < 0 && atTop) || (delta > 0 && atBottom)) {
      e.preventDefault();
    }
  },
  eUnlockScroll: function() {
    Search._touchScrollStart = 0;
  },
  eClearField: function(e) {
    if ($(this).data('tr-composing')) return;
    $('.tr-search-field').val('').trigger('input');
  },
  releaseScrollLock: function() {
    if (!Search._scrollLocked) return;
    Search._scrollLocked = false;
    TrCompactScrollLock.unlock();
  },
  wrapQKeys: function(item_key) {
    return [Search.simplify(item_key)];
  },
  wrapQValues: function(item_value, item_def_value) {
    var values = [];
    if (item_value) {
      if ($.isArray(item_value) || $.isPlainObject(item_value)) {
        for (var p = 0; p < 6; p++) {
          if (typeof item_value[p] === 'undefined') continue;
          values.push(Search.simplify(item_value[p]));
        }
      } else {
        values.push(Search.simplify(item_value));
      }
    }
    if ($.isArray(item_def_value) || $.isPlainObject(item_def_value)) {
      for (var p = 0; p < 6; p++) {
        if (typeof item_def_value[p] === 'undefined') continue;
        values.push(Search.simplify(item_def_value[p]));
      }
    } else {
      values.push(Search.simplify(item_def_value));
    }
    return values;
  },
  applyData: function(lang, data_json, is_rtl) {
    for (var lang_pack in data_json) {
      var data_key = lang + '_' + lang_pack;
      var data = data_json[lang_pack];
      for (var i = 0; i < data.length; i++) {
        var item = data[i];
        if (!item.value) {
          item.value = item.def_value;
        }
        item.lang_pack = lang_pack;
        item.rtl = is_rtl;
        item.href = '/' + lang + '/' + lang_pack + '/' + item.section + '/' + item.key;
        item._keys = Search.wrapQKeys(item.key);
        item._values = Search.wrapQValues(item.value, item.def_value);
      }
      Search._data[data_key] = data;
      delete Search._errors[data_key];
    }
  },
  clearData: function(lang, lang_pack) {
    var data_key = lang + '_' + lang_pack;
    if (!lang_pack) {
      var prefix = lang + '_';
      Object.keys(Search._data).forEach(function(key) { if (key.indexOf(prefix) === 0) delete Search._data[key]; });
      Object.keys(Search._dataRequests).forEach(function(key) { if (key.indexOf(prefix) === 0) delete Search._dataRequests[key]; });
      Object.keys(Search._errors).forEach(function(key) { if (key.indexOf(prefix) === 0) delete Search._errors[key]; });
      return;
    }
    delete Search._data[data_key];
    delete Search._dataRequests[data_key];
    delete Search._errors[data_key];
    delete Search._data[lang + '_'];
    delete Search._dataRequests[lang + '_'];
    delete Search._errors[lang + '_'];
  },
  getDataError: function(lang, lang_pack) {
    var error = Search._errors[lang + '_' + lang_pack];
    return error && error.message || '';
  },
  eRetryData: function(e) {
    e.preventDefault();
    var $button = $(this), lang = $button.attr('data-lang'), lang_pack = $button.attr('data-langpack') || '';
    Search.clearData(lang, lang_pack);
    var $field = $button.closest('.screenshot-key-edit-results').length ? $('.screenshot-key-edit-field', Aj.layer) : $('.tr-search-field');
    $field.trigger('datachange');
  },
  getData: function(lang, lang_pack, onDataReady) {
    var generation = Search._generation;
    var route = Aj.location().href;
    var state = Aj.state;
    var data_key = lang + '_' + lang_pack;
    var _data = Search._data[data_key];
    var request = Search._dataRequests[data_key];
    var error = Search._errors[data_key];
    if (error && (error.state !== state || error.route !== route)) {
      delete Search._errors[data_key];
      delete Search._data[data_key];
      _data = undefined;
    }
    var current = function() {
      return generation === Search._generation && state === Aj.state && route === Aj.location().href;
    };
    if (_data === false) {
      if (request && request.generation === generation && request.state === state && request.route === route) return false;
      delete Search._dataRequests[data_key];
      delete Search._data[data_key];
    } else if (_data) {
      return Search._data[data_key];
    }
    if (!lang_pack) {
      var aggregate_key = data_key;
      request = {generation: generation, state: state, route: route};
      Search._dataRequests[aggregate_key] = request;
      Search._data[aggregate_key] = false;
      var checkReady = function() {
        if (!current()) {
          if (Search._dataRequests[aggregate_key] === request) {
            delete Search._dataRequests[aggregate_key];
            if (Search._data[aggregate_key] === false) delete Search._data[aggregate_key];
          }
          return false;
        }
        var langpacks = Aj.state.langpackList;
        var data = [];
        var ready_count = 0;
        for (var i = 0; i < langpacks.length; i++) {
          var langpack = langpacks[i];
          var data_key = lang + '_' + langpack;
          var _data = Search._data[data_key];
          if (_data !== false && _data) {
            data = data.concat(_data);
            ready_count++;
          }
        }
        if (ready_count == langpacks.length) {
          Search._data[aggregate_key] = data;
          for (var e = 0; e < langpacks.length; e++) {
            var childError = Search._errors[lang + '_' + langpacks[e]];
            if (childError) { Search._errors[aggregate_key] = childError; break; }
          }
          if (Search._dataRequests[aggregate_key] === request) delete Search._dataRequests[aggregate_key];
          onDataReady && onDataReady();
          return data;
        }
        return false;
      };
      var langpacks = Aj.state.langpackList;
      for (var i = 0; i < langpacks.length; i++) {
        var langpack = langpacks[i];
        var data_key = lang + '_' + langpack;
        var _data = Search._data[data_key];
        if (_data !== false && !_data) {
          Search.getData(lang, langpack, checkReady);
        }
      }
      return checkReady();
    } else {
      request = {generation: generation, state: state, route: route};
      Search._dataRequests[data_key] = request;
      Search._data[data_key] = false;
      Aj.apiRequest('getLangPackFull', {
        lang: lang,
        lang_pack: lang_pack,
      }, function(result) {
        if (Search._dataRequests[data_key] !== request) return;
        delete Search._dataRequests[data_key];
        if (!current()) {
          if (Search._data[data_key] === false) delete Search._data[data_key];
          return;
        }
        if (result.data) {
          Search.applyData(lang, result.data, result.rtl);
          onDataReady && onDataReady();
        } else {
          Search._data[data_key] = [];
          Search._errors[data_key] = {message: result.error || 'Unable to load translations.', state: state, route: route};
          onDataReady && onDataReady(false);
        }
      });
    }
    return false;
  },
  onScroll: function() {
    var scrollTop = $(window).scrollTop();
    $('header').toggleClass('search-collapsed', scrollTop > 20);
  },
  searchForReplace: function(e) {
    e && e.preventDefault();
    var btn = $('.search-replace-form .submit-btn');
    if (btn.prop('disabled')) {
      return false;
    }
    var query = $('.tr-search-field').val();
    var find = $('.find-field').val();
    if (!find.length) {
      $('.find-field').focus();
      return false;
    }
    var replace = $('.replace-field').val();
    if (!replace.length) {
      $('.replace-field').focus();
      return false;
    }
    var case_sensitive = $('.case-sensitive-cbx').prop('checked') ? 1 : 0;
    var use_regexp = $('.use-regexp-cbx').prop('checked') ? 1 : 0;
    var requestGuard = TrResponsiveLifecycle.requestGuard('Search.replace', btn[0], function() {
      return [Aj.state.curLang, Aj.state.searchLangpack, Aj.state.searchWhere, query, find, replace, case_sensitive, use_regexp].join('\u0001');
    });
    btn.prop('disabled', true);
    btn.html(l('WEB_REPLACE_PROCESSING'));
    Aj.apiRequest('searchForReplace', {
      lang_pack: Aj.state.searchLangpack,
      lang: Aj.state.searchLang,
      where: Aj.state.searchWhere,
      query: query,
      find: find,
      replace: replace,
      case_sensitive: case_sensitive,
      use_regexp: use_regexp
    }, function(result) {
      if (!requestGuard()) return;
      btn.prop('disabled', false);
      btn.html(l('WEB_FIND_PHRASES_BUTTON'));
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.import_id) {
        Aj.state.importId = result.import_id;
        if (result.href) {
          Aj.setLocation(result.href);
        }
        if (result.html) {
          $('.tr-keys-blocks').html(result.html);
        }
      }
    });
    $('.tr-keys-blocks').html('');
  },
  _data: {},
  _dataRequests: {},
  _errors: {}
};

var Screenshots = {
  pageUploadGeneration: 0,
  pageUploadXhr: null,
  isCompactTouch: function() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 991px)').matches &&
      (navigator.maxTouchPoints > 0 || 'ontouchstart' in window));
  },
  sortableSync: function() {
    var compact = Screenshots.isCompactTouch();
    $('.tr-screenshots').each(function() {
      var $screens = $(this);
      var active = $screens.hasClass('ui-sortable');
      if (compact) {
        if (active) $screens.sortable('destroy');
        return;
      }
      if (!active) {
        $screens.sortable({
          cursor: 'move',
          distance: 3,
          items: '> [data-screenshot-id]',
          opacity: 0.95,
          revert: 200,
          tolerance: 'pointer',
          zIndex: 99,
        });
      }
      $screens.off('sortupdate.curPage', Screenshots.orderChanged)
        .on('sortupdate.curPage', Screenshots.orderChanged);
      if (Aj.state.selection) $screens.sortable('option', 'disabled', true);
    });
  },
  sortableRefresh: function() {
    $('.tr-screenshots').each(function() {
      var $screens = $(this);
      if ($screens.hasClass('ui-sortable')) $screens.sortable('refresh');
    });
  },
  eUpload: function(e) {
    var file = this.files && this.files[0] || null;
    var section = $(this).attr('data-section') || '';
    var source = $(this).attr('data-source') || '';
    var screenshot_id = $(this).attr('data-screenshot-id') || '';
    var lang_pack = $(this).parents('.tr-key-row').attr('data-langpack') || '';
    if (!file) return;
    Screenshots.upload(file, section, source, screenshot_id, lang_pack);
    this.value = '';
  },
  upload: function(file, section, source, screenshot_id, lang_pack) {
    var data = new FormData();
    data.append('file', file);
    var route = Aj.location().href;
    var state = Aj.state;
    var lifecycleGeneration = TrResponsiveLifecycle.generation;
    var layer = screenshot_id && Aj.layerState ? Aj.layerState : null;
    var requestGeneration = layer ? ++layer.requestGeneration : 0;
    var pageGeneration = layer ? 0 : ++Screenshots.pageUploadGeneration;
    if (layer && layer.uploadXhr && typeof layer.uploadXhr.abort === 'function') layer.uploadXhr.abort();
    if (!layer && Screenshots.pageUploadXhr && typeof Screenshots.pageUploadXhr.abort === 'function') Screenshots.pageUploadXhr.abort();
    var isCurrent = function() {
      return state === Aj.state && Aj.location().href === route && TrResponsiveLifecycle.isCurrent(lifecycleGeneration) &&
        (layer ? (Aj.layerState === layer && layer.requestGeneration === requestGeneration) : pageGeneration === Screenshots.pageUploadGeneration);
    };
    var $uploadStatus = layer ? $('.tr-upload-status', layer.$bodyEl) : $('.tr-upload-status').first();
    if (!$uploadStatus.length) {
      var $uploadRoot = layer ? layer.$bodyEl : $('.tr-screenshot-upload-row,.tr-value-upload-photo').first();
      if ($uploadRoot && $uploadRoot.length) $uploadStatus = $('<span class="tr-upload-status" role="status" aria-live="polite"></span>').appendTo($uploadRoot);
    }
    var setUploadStatus = function(text, busy) {
      if (!$uploadStatus.length || !isCurrent()) return;
      $uploadStatus.attr('aria-busy', busy ? 'true' : 'false').text(text || '');
    };
    setUploadStatus(l('WEB_TRANSLATIONS_LOADING') + ' 0%', true);
    if (screenshot_id && Aj.layerState) {
      Aj.layerState.$imgEl.fadeHide();
      Aj.layerState.$layerEl.fadeHide();
    }
    var uploadXhr = $.ajax({
      url: 'https://telegra.ph/upload?source=translations_screenshot',
      type: 'POST',
      data: data,
      cache: false,
      dataType: 'json',
      processData: false,
      contentType: false,
      xhr: function() {
        var xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', function(event) {
          if (event.lengthComputable) setUploadStatus(l('WEB_TRANSLATIONS_LOADING') + ' ' + Math.round(event.loaded / event.total * 100) + '%', true);
        });
        return xhr;
      },
      beforeSend: function(xhr) {
      },
      success: function (data) {
        if (!isCurrent()) return;
        if (layer && layer.uploadXhr === uploadXhr) layer.uploadXhr = null;
        if (!layer && Screenshots.pageUploadXhr === uploadXhr) Screenshots.pageUploadXhr = null;
        setUploadStatus('', false);
        if (data.error) {
          if (screenshot_id && Aj.layerState === layer && layer.requestGeneration === requestGeneration) {
            Aj.layerState.$imgEl.fadeShow();
            Aj.layerState.$layerEl.fadeShow();
          }
          return showAlert(data.error);
        }
        if (data.file_data) {
          if (screenshot_id) {
            Aj.apiRequest('editScreenshot', {
              lang_pack: lang_pack || Aj.state.curLangpack,
              screenshot_id: screenshot_id,
              file_data: data.file_data
            }, function(result) {
              if (!isCurrent()) return;
              if (result.error) {
                if (Aj.layerState === layer && layer.requestGeneration === requestGeneration) {
                  Aj.layerState.$imgEl.fadeShow();
                  Aj.layerState.$layerEl.fadeShow();
                }
                return showAlert(result.error);
              }
              if (Aj.layerState === layer && layer.requestGeneration === requestGeneration && result.src) {
                var $imgEl = Aj.layerState.$imgEl.clone();
                $imgEl.attr('src', result.src).addClass('ohide').one('load', function() {
                  if (isCurrent()) {
                    Aj.layerState.$imgEl.remove();
                    Aj.layerState.$imgEl = $imgEl;
                    $imgEl.off('.curLayer')
                      .on('load.curLayer', ScreenshotLayer.layerUpdate)
                      .on('error.curLayer', ScreenshotLayer.onImageError);
                    if (layer.resizeObserver) layer.resizeObserver.observe($imgEl.get(0));
                    Aj.layerState.$layerEl.css('backgroundImage', 'url(\'' + result.src + '\')');
                    ScreenshotLayer.onImageLoading(true, layer);
                    $imgEl.fadeShow();
                    Aj.layerState.$layerEl.fadeShow();
                  }
                }).one('error', function() {
                  if (isCurrent() && Aj.layerState.$imgEl) {
                    $imgEl.remove();
                    Aj.layerState.$bodyEl.removeClass('screenshot-image-error');
                    Aj.layerState.imageError = false;
                    Aj.layerState.$imgEl.fadeShow();
                    Aj.layerState.$layerEl.fadeShow();
                  }
                }).insertBefore(Aj.layerState.$imgEl);
              }
            });
          } else {
            Aj.apiRequest('addScreenshot', {
              lang: Aj.state.curLang,
              lang_pack: lang_pack || Aj.state.curLangpack,
              section: section,
              file_data: data.file_data
            }, function(result) {
              if (!isCurrent()) return;
              if (result.error) {
                return showAlert(result.error);
              }
              if (result.row) {
                $(result.row).insertBefore('.tr-screenshot-upload-row');
                Screenshots.sortableRefresh();
              }
              if (result.id) {
                var url = Aj.location();
                addUrlSearchParam(url, 'l', 'screenshot' + result.id + source);
                Aj.location(url.href);
              }
            });
          }
        }
      },
      error: function (xhr) {
        if (!isCurrent()) return;
        if (layer && layer.uploadXhr === uploadXhr) layer.uploadXhr = null;
        if (!layer && Screenshots.pageUploadXhr === uploadXhr) Screenshots.pageUploadXhr = null;
        setUploadStatus(xhr.statusText || '', false);
        if (screenshot_id && Aj.layerState === layer && layer.requestGeneration === requestGeneration) {
          Aj.layerState.$imgEl.fadeShow();
          Aj.layerState.$layerEl.fadeShow();
        }
        showAlert('Network error');
      }
    });
    if (layer) layer.uploadXhr = uploadXhr;
    else Screenshots.pageUploadXhr = uploadXhr;
  },
  cancelPageUpload: function() {
    Screenshots.pageUploadGeneration++;
    if (Screenshots.pageUploadXhr && typeof Screenshots.pageUploadXhr.abort === 'function') Screenshots.pageUploadXhr.abort();
    Screenshots.pageUploadXhr = null;
  },
  orderChanged: function() {
    var screenshot_ids = [];
    $('.tr-screenshots > [data-screenshot-id]').map(function() {
      var screenshot_id = $(this).attr('data-screenshot-id');
      screenshot_ids.push(screenshot_id);
    });
    var route = Aj.location().href;
    var state = Aj.state;
    var generation = TrResponsiveLifecycle.generation;
    Aj.apiRequest('saveScreenshotsOrder', {
      lang_pack: Aj.state.curLangpack,
      section: Aj.state.curSection,
      screenshot_ids: screenshot_ids.join(',')
    }, function(result) {
      if (state !== Aj.state || Aj.location().href !== route || !TrResponsiveLifecycle.isCurrent(generation)) return;
      if (result.error) {
        showAlert(result.error);
      }
    });
  },
  eScreenshotClick: function(e) {
    var $select = $(e.target).closest('.tr-screenshot-select-hit, .tr-selected-icon');
    if (!$select.size()) {
      return;
    }
    Screenshots.screenshotSelect($(this));
    e.stopImmediatePropagation();
    e.preventDefault();
  },
  screenshotSelect($screenEl) {
    $screenEl.toggleClass('selected');
    var selected = $screenEl.hasClass('selected');
    $('.tr-screenshot-select-hit', $screenEl).attr('aria-pressed', selected ? 'true' : 'false');
    Screenshots.updateSelected();
  },
  updateSelected() {
    var $selectedEls = $('.tr-screenshot-row[data-screenshot-id].selected');
    var selectedCount = $selectedEls.size();
    var newSelection = selectedCount > 0;
    var $selectorBtn = $('.move-selected-btn');
    $selectorBtn.text($selectorBtn.attr('data-label').replace('%s', selectedCount));
    $selectorBtn.attr('aria-label', $selectorBtn.text());
    $('.tr-screenshot-select-hit', '.tr-screenshot-row[data-screenshot-id]').attr('aria-pressed', 'false');
    $('.tr-screenshot-select-hit', $selectedEls).attr('aria-pressed', 'true');
    if (!Aj.state.selection !== !newSelection) {
      Aj.state.selection = newSelection;
      $('.tr-header-section-selector').fadeToggle(newSelection);
      var $screens = $('.tr-screenshots');
      if ($screens.hasClass('ui-sortable')) $screens.sortable('option', 'disabled', newSelection);
      $screens.toggleClass('selection', newSelection);
    }
  },
  eEditScreenshotsSection: function(e) {
    var $selectedEls = $('.tr-screenshot-row[data-screenshot-id].selected');
    var selectedCount = $selectedEls.size();
    if (!selectedCount) return;
    var section = $(this).attr('data-section');
    if (section == Aj.state.curSection ||
        $(this).parents('li').hasClass('selected')) {
      return;
    }
    var route = Aj.location().href;
    var generation = TrResponsiveLifecycle.generation;
    $selectedEls.each(function() {
      var $screenEl = $(this);
      var screenshotId = $screenEl.attr('data-screenshot-id');
      Aj.apiRequest('editScreenshotSection', {
        lang_pack: Aj.state.curLangpack,
        lang: Aj.state.curLang,
        screenshot_id: screenshotId,
        section: section
      }, function(result) {
        if (Aj.location().href !== route || !TrResponsiveLifecycle.isCurrent(generation) || !document.documentElement.contains($screenEl[0])) return;
        if (!result.error) {
          $screenEl.remove();
          var $screenEls = $('.tr-screenshot-row[data-screenshot-id]');
          $('.tr-header-counter').text($screenEls.size() || '');
          Screenshots.sortableRefresh();
          Screenshots.updateSelected();
        }
      });
    });
  },
  eSendScreenshotsToTop: function(e) {
    var $selectedEls = $('.tr-screenshot-row[data-screenshot-id].selected');
    var selectedCount = $selectedEls.size();
    if (!selectedCount) return;
    $selectedEls.prependTo('.tr-screenshots').removeClass('selected');
    Screenshots.orderChanged();
    Screenshots.sortableRefresh();
    Screenshots.updateSelected();
  },
  eSendScreenshotsToBottom: function(e) {
    var $selectedEls = $('.tr-screenshot-row[data-screenshot-id].selected');
    var selectedCount = $selectedEls.size();
    if (!selectedCount) return;
    $selectedEls.insertBefore('.tr-screenshot-upload-row').removeClass('selected');
    Screenshots.orderChanged();
    Screenshots.sortableRefresh();
    Screenshots.updateSelected();
  },
  onScroll: function() {
    var $headerEl = $('.header-nav li.active');
    var $el = $('.tr-header-section-selector');
    var $prevEl = $el.prev();
    var fromX = $prevEl.offset().left + $prevEl.width();
    var toX = $headerEl.offset().left + $headerEl.width() - 16;
    var deltaX = Math.round(toX - fromX);
    var deltaY = 113;
    var scrollTop = $(window).scrollTop();
    if (scrollTop <= deltaY) {
      var dy = deltaY - scrollTop;
      if (dy <= 12) {
        $el.addClass('fixed').css({transform: 'translateX(' + deltaX + 'px)', opacity: 1 - dy / 12});
      } else {
        $el.removeClass('fixed').css({transform: '', opacity: ''});
      }
    } else {
      $el.css({transform: 'translateX(' + deltaX + 'px)', opacity: ''});
      $el.addClass('fixed');
    }
  }
};

var Recognizer = {
  init: function() {
    if (!Tesseract._tInited) {
      Tesseract.recognize(document.createElement('canvas'));
      Tesseract._tInited = true;
    }
  },
  fixRecognizedText: function(text) {
    text = $.trim(text);
    text = text.replace(/ﬁ/g, 'fi');
    text = text.replace(/—/g, '-');
    text = text.replace(/\n/g, ' ');
    return text;
  },
  getTextFromImage: function(img, x, y, width, height, onComplete, onProgress, onError) {
    var crop_canvas = document.createElement('canvas');
    var w = width, h = height;
    crop_canvas.width = width;
    crop_canvas.height = height;
    crop_canvas.getContext('2d').drawImage(img, x, y, width, height, 0, 0, width, height);
    Tesseract.recognize(crop_canvas)
    .progress(function(message) {
      onProgress && onProgress(message);
    })
    .then(function(result) {
      var block = result.blocks[0];
      var coords = false;
      var lr_padding = 7, tb_padding = 10;
      if (block && block.bbox) {
        x += block.bbox.x0;
        w = block.bbox.x1 - block.bbox.x0;
        y += block.bbox.y0;
        h = block.bbox.y1 - block.bbox.y0;
        x -= lr_padding; y -= tb_padding;
        w += 2 * lr_padding; h += 2 * tb_padding;
        coords = [
          x / img.naturalWidth,
          y / img.naturalHeight,
          w / img.naturalWidth,
          h / img.naturalHeight
        ];
      }
      var text = Recognizer.fixRecognizedText(result.text);
      onComplete && onComplete(text, coords);
    }).catch(function(error) {
      onError && onError(error);
    });
  }
}

var ScreenshotLayer = {
  init: function(options) {
    options = options || {};
    var screenshot_id = options.screenshot_id;
    Aj.onLayerLoad(function(layerState) {
      Recognizer.init();
      var $bodyEl = $('.screenshot-body', Aj.layer);
      var $imgEl = $('.screenshot-full', Aj.layer);
      var $imgBgEl = $('.screenshot-full-bg', Aj.layer);
      var $layerEl = $('.screenshot-layer', Aj.layer);
      var $layerWrapEl = $('.screenshot-layer-wrap', Aj.layer);
      var $sideWrapEl = $('.screenshot-side-wrap', Aj.layer);
      var $searchFieldEl = $('.screenshot-key-edit-field', Aj.layerEl);
      var $searchResultsEl = $('.screenshot-key-edit-results', Aj.layerEl);

      layerState.screenshotId = screenshot_id;
      layerState.screenshotLangpack = options.lang_pack;
      layerState.$bodyEl = $bodyEl;
      layerState.$imgEl = $imgEl;
      layerState.$imgBgEl = $imgBgEl;
      layerState.$layerEl = $layerEl;
      layerState.$layerWrapEl = $layerWrapEl;
      layerState.$sideWrapEl = $sideWrapEl;
      layerState.$searchFieldEl = $searchFieldEl;
      layerState.canEditScreenshot = options.can_edit_screenshot || false;
      layerState.canEditPhrases = options.can_edit_phrases || false;
      layerState.$keyEl = null;
      layerState.keyCoords = null;
      layerState.drawing = false;
      layerState.pointerId = null;
      layerState.pointerCaptureTarget = null;
      layerState.ocrGeneration = 0;
      layerState.requestGeneration = 0;
      layerState.imgTimeout = null;
      layerState.imageError = false;
      layerState.resizeObserver = null;
      layerState.editMode = false;

      Aj.layer.addClass('popup-no-close');
      Aj.layer.one('popup:open.curLayer', ScreenshotLayer.layerUpdate);
      $(document).on('keydown', ScreenshotLayer.onKeyDown);
      $(window).on('resize orientationchange', ScreenshotLayer.layerUpdate);
      if (window.visualViewport) $(window.visualViewport).on('resize scroll', ScreenshotLayer.layerUpdate);
      $imgEl.on('load.curLayer', ScreenshotLayer.layerUpdate);
      $imgEl.on('error.curLayer', ScreenshotLayer.onImageError);
      if (window.ResizeObserver) {
        layerState.resizeObserver = new ResizeObserver(ScreenshotLayer.layerUpdate);
        layerState.resizeObserver.observe($bodyEl.get(0));
        layerState.resizeObserver.observe($imgEl.get(0));
      }
      ScreenshotLayer.onImageLoading();
      Aj.layer.on('click.curLayer', '.screenshot-close-btn', function() {
        closePopup();
      });
      Aj.layer.on('click.curLayer', '.screenshot-key', ScreenshotLayer.eOpenEdit);
      Aj.layer.on('click.curLayer', '.screenshot-key-remove', ScreenshotLayer.eRemoveScreenshotKey);
      Aj.layer.on('keydown.curLayer', '.screenshot-key-remove', function(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        $(this).trigger('click');
      });
      Aj.layer.on('click.curLayer', '.screenshot-remove-btn', ScreenshotLayer.removeScreenshot.pbind(screenshot_id));
      Aj.layer.on('click.curLayer', '.sections-select-item', ScreenshotLayer.eEditScreenshotSection);
      Aj.layer.on('click.curLayer', '.screenshot-key-edit-close', ScreenshotLayer.closeEdit);
      Aj.layer.on('submit.curLayer', '.screenshot-description-form', ScreenshotLayer.eSubmitDescriptionForm);
      Aj.layer.on('blur.curLayer', '.screenshot-description-field', ScreenshotLayer.eSubmitDescriptionForm);
      Aj.layer.on('keydown.curLayer', '.screenshot-description-field', ScreenshotLayer.eCancelDescriptionForm);
      Aj.layer.one('popup:open.curLayer', function() {
        autosize($('.screenshot-description-field', Aj.layer));
      });
      Aj.layer.on('mouseover.curLayer mouseout.curLayer', '.key-hover', ScreenshotLayer.eKeyHover);
      Aj.layer.on('keydown.curLayer', '.screenshot-key, .screenshot-key-row', ScreenshotLayer.onKeyTarget);
      if (layerState.canEditPhrases) {
        $searchFieldEl.initSearch({
          $results: $searchResultsEl,
          renderItem: function(item, query) {
            return '<div class="screenshot-key-row"><div class="screenshot-key-value-default">' + wrapLangValue(item.def_value, item.rtl, query) + '</div><div class="screenshot-key-lang-key">' + Search.wrapHighlight(item.key, query) + '</div></div>';
          },
          renderNoItems: function() {
            var error = Search.getDataError(Aj.state.curLang, Aj.layerState.screenshotLangpack);
            if (error) return '<div class="screenshot-keys-no-results" role="alert">' + cleanHTML(error) + '<br><button type="button" class="btn btn-default tr-search-retry" data-lang="' + cleanAttr(Aj.state.curLang) + '" data-langpack="' + cleanAttr(Aj.layerState.screenshotLangpack) + '">Retry</button></div>';
            return '<div class="screenshot-keys-no-results">' + l('WEB_NO_TRANSLATIONS_FOUND') + '</div>';
          },
          renderLoading: function() {
            return '<div class="screenshot-keys-result-loading">' + l('WEB_TRANSLATIONS_LOADING') + '</div>';
          },
          getData: function() {
            var lang = Aj.state.curLang;
            var lang_pack = Aj.layerState.screenshotLangpack;
            return Search.getData(lang, lang_pack, function() {
              $searchFieldEl.trigger('dataready');
            });
          },
          onSelect: function(item) {
            var $keyEl = Aj.layerState.$keyEl;
            var lang_key = item.key;
            var old_lang_key = $keyEl.attr('data-key') || null;
            var coords = $keyEl.attr('data-coordinates').split(',');
            var modified = $keyEl.hasClass('modified');
            if (old_lang_key && old_lang_key == lang_key) {
              old_lang_key = null;
              if (!modified) {
                return;
              }
            }
            ScreenshotLayer.addKeyToScreenshot($keyEl, lang_key, item, coords, old_lang_key);
          },
          onClose: function() {
            ScreenshotLayer.closeEdit();
          }
        });
        if (window.PointerEvent) {
          $layerEl.on('pointerdown.curLayer', ScreenshotLayer.eDrawKey);
          $layerEl.on('lostpointercapture.curLayer', ScreenshotLayer.eDrawKey);
        } else {
          $layerEl.on('mousedown.curLayer touchstart.curLayer', ScreenshotLayer.eDrawFallback);
        }
        $('input.file-upload', $layerEl).on('change', Screenshots.eUpload);
      }

      Aj.layer.one('popup:open.curLayer', function() {
        if (options.lang_key) {
          ScreenshotLayer.keyHover(options.lang_key, true, true);
          clearTimeout(layerState.hoverTimeout);
          layerState.hoverTimeout = setTimeout(function() {
            ScreenshotLayer.keyHover(options.lang_key, false);
          }, 1500);
        }
      });
    });
    Aj.onLayerUnload(function(layerState) {
      clearTimeout(layerState.imgTimeout);
      clearTimeout(layerState.hoverTimeout);
      layerState.imgTimeout = null;
      layerState.ocrGeneration++;
      layerState.requestGeneration++;
      if (layerState.uploadXhr && typeof layerState.uploadXhr.abort === 'function') layerState.uploadXhr.abort();
      layerState.uploadXhr = null;
      if (layerState.pointerCaptureTarget && layerState.pointerCaptureTarget.releasePointerCapture &&
          layerState.pointerId != null) {
        try { layerState.pointerCaptureTarget.releasePointerCapture(layerState.pointerId); } catch (ignore) {}
      }
      $(document).off('keydown', ScreenshotLayer.onKeyDown);
      $(window).off('resize orientationchange', ScreenshotLayer.layerUpdate);
      if (window.visualViewport) $(window.visualViewport).off('resize scroll', ScreenshotLayer.layerUpdate);
      layerState.$imgEl.off('.curLayer');
      if (layerState.resizeObserver) layerState.resizeObserver.disconnect();
      if (layerState.canEditPhrases) {
        layerState.$searchFieldEl.destroySearch();
        layerState.$layerEl.off('.curLayer');
        $(document).off('.screenshotDrawing');
        $('input.file-upload', layerState.$layerEl).off('change', Screenshots.eUpload);
      }
    });
  },
  onImageLoading: function(full, expectedState) {
    if (!Aj.layerState || (expectedState && Aj.layerState !== expectedState)) return;
    var layerState = Aj.layerState;
    var img = layerState.$imgEl && layerState.$imgEl.get(0);
    if (!img) return;
    if (img.naturalWidth && img.naturalHeight) {
      clearTimeout(layerState.imgTimeout);
      layerState.imgTimeout = null;
      layerState.$imgEl.attr('aria-busy', 'false');
      layerState.imageError = false;
      layerState.$bodyEl.removeClass('screenshot-image-error');
      layerState.$bodyEl.removeClass('ohide');
      ScreenshotLayer.layerUpdate();
      if (full) {
        $('.screenshot-key', layerState.$layerEl).each(function() {
          var $keyEl = $(this),
              coords = $keyEl.attr('data-coordinates').split(',');
          ScreenshotLayer.updateScreenshotKeyPosition($keyEl, coords);
        });
      }
      return;
    }
    clearTimeout(layerState.imgTimeout);
    layerState.imgTimeout = setTimeout(ScreenshotLayer.onImageLoading, 50, full, layerState);
  },
  onImageError: function() {
    if (!Aj.layerState) return;
    var layerState = Aj.layerState;
    clearTimeout(layerState.imgTimeout);
    layerState.imgTimeout = null;
    layerState.imageError = true;
    layerState.$bodyEl.removeClass('ohide').addClass('screenshot-image-error');
    $('.screenshot-image-error-message', Aj.layer).text(l('WEB_SCREENSHOT_NOT_EXISTS'));
    layerState.$imgEl.attr('aria-busy', 'false');
  },
  layerUpdate: function() {
    if (!Aj.layerState) return;
    var layerState = Aj.layerState;
    var $imgEl = layerState.$imgEl;
    var $imgBgEl = layerState.$imgBgEl;
    var $layerWrapEl = layerState.$layerWrapEl;
    var $layerEl = layerState.$layerEl;
    var img = $imgEl && $imgEl.get(0);
    if (!img) return;
    var compact = window.matchMedia && window.matchMedia('(max-width: 991px)').matches;
    if (!compact && layerState.$sideWrapEl) {
      layerState.$sideWrapEl.css({position: '', left: '', right: '', top: '', bottom: '', width: '', height: ''});
    }
    var rect = compact ? img.getBoundingClientRect() : null;
    var width = compact ? rect.width : $imgEl.width();
    var height = compact ? rect.height : $imgEl.height();
    if (!width || !height) return;
    var halfWidth = compact ? width / 2 : parseFloat($imgEl.css('width')) / 2;
    $imgBgEl.width(width).height(height);
    $layerWrapEl.width(width).height(height);
    if (compact) {
      var bodyEl = layerState.$bodyEl && layerState.$bodyEl.get(0);
      if (!bodyEl) return;
      var bodyRect = bodyEl.getBoundingClientRect();
      var compactPosition = {
        left: (rect.left - bodyRect.left) + 'px',
        top: (rect.top - bodyRect.top) + 'px',
        right: 'auto',
        bottom: 'auto'
      };
      $imgBgEl.css(compactPosition);
      $layerWrapEl.css(compactPosition);
      if (layerState.$sideWrapEl) {
        var viewport = window.visualViewport;
        var viewportTop = viewport ? viewport.offsetTop : 0;
        var viewportHeight = viewport ? viewport.height : (window.innerHeight || document.documentElement.clientHeight);
        var viewportBottom = viewportTop + viewportHeight;
        layerState.$sideWrapEl.css({
          position: 'fixed',
          left: bodyRect.left + 'px',
          right: 'auto',
          top: Math.max(viewportTop, bodyRect.top + bodyRect.height * .6) + 'px',
          bottom: Math.max(0, viewportBottom - bodyRect.bottom) + 'px',
          width: bodyRect.width + 'px',
          height: 'auto'
        });
      }
    }
    $layerEl.css('backgroundSize', width + 'px ' + height + 'px');
    $('.screenshot-body-left', Aj.layer).css('marginRight', halfWidth + 'px');
    $('.screenshot-body-right', Aj.layer).css('marginLeft', halfWidth + 'px');
  },
  addScreenshotKey: function(coords) {
    if (!Aj.layerState) return;
    var $keyEl = $('<div class="screenshot-key key-hover screenshot-key-drawable screenshot-key-new" role="button" tabindex="0" aria-label="Screenshot key region"><span class="screenshot-key-hit" aria-hidden="true"></span><div class="key-box"><div class="key-label"></div></div></div>');
    if (coords) {
      $keyEl.attr('data-coordinates', coords.join(','));
    }
    $keyEl.prependTo(Aj.layerState.$layerEl);
    if (coords) {
      ScreenshotLayer.updateScreenshotKeyPosition($keyEl, coords);
    }
    ScreenshotLayer.layerUpdate();
    return $keyEl;
  },
  screenshotKeyIsAllowedSize: function(coords) {
    coords = ScreenshotLayer.fixScreenshotKeyCoordinates(coords);
    var $layerEl = Aj.layerState.$layerEl;
    return !(coords[2] * $layerEl.width() < 3 ||
             coords[3] * $layerEl.height() < 3);
  },
  updateScreenshotKeyPosition: function($keyEl, coords) {
    coords = ScreenshotLayer.fixScreenshotKeyCoordinates(coords);
    var img = Aj.layerState.$imgEl.get(0);
    var ratio = img.naturalHeight / img.naturalWidth;
    var $layerEl = Aj.layerState.$layerEl;
    var left   = coords[0],
        top    = coords[1],
        right  = 1 - left - coords[2],
        bottom = 1 - top - coords[3];
    if (right  < 0) right  = 0;
    if (bottom < 0) bottom = 0;
    $keyEl.css({
      paddingLeft: (left * 100) + '%',
      paddingTop: (top * ratio * 100) + '%',
      paddingRight: (right * 100) + '%',
      paddingBottom: (bottom * ratio * 100) + '%',
      '--tr-key-center-x': ((left + coords[2] / 2) * 100) + '%',
      '--tr-key-center-y': ((top + coords[3] / 2) * 100) + '%',
      '--tr-key-hit-width': (coords[2] * 100) + '%',
      '--tr-key-hit-height': (coords[3] * 100) + '%',
      opacity: ScreenshotLayer.screenshotKeyIsAllowedSize(coords) ? 1 : 0
    });
    $keyEl.toggleClass('key-right', left + coords[2] / 2 > .5);
    $keyEl.attr('data-coordinates', coords.join(','));
  },
  keyAccessibleLabel: function(lang_key, lang_item) {
    var label = lang_key || 'Screenshot key region';
    if (lang_item && typeof lang_item.def_value !== 'undefined') {
      var value = $.trim($('<div>').html(wrapLangValue(lang_item.def_value)).text());
      if (value) label += ': ' + value;
    }
    var status = [];
    if (lang_item && lang_item.modified) status.push('Modified');
    if (lang_item && lang_item.untranslated) status.push('Untranslated');
    if (lang_item && lang_item.status) status.push(String(lang_item.status));
    if (status.length) label += ' — ' + status.join(', ');
    return label;
  },
  fixScreenshotKeyCoordinates: function(coords, precision) {
    var x = Number(coords[0]), y = Number(coords[1]), w = Number(coords[2]), h = Number(coords[3]);
    x = isFinite(x) ? x : 0;
    y = isFinite(y) ? y : 0;
    w = isFinite(w) ? w : 0;
    h = isFinite(h) ? h : 0;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > 1) { w = 1 - x; }
    if (y + h > 1) { h = 1 - y; }
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    w = Math.max(0, Math.min(1 - x, w));
    h = Math.max(0, Math.min(1 - y, h));
    if (typeof precision !== 'undefined') {
      var p = Math.pow(10, precision);
      x = Math.round(x * p) / p;
      y = Math.round(y * p) / p;
      w = Math.round(w * p) / p;
      h = Math.round(h * p) / p;
    }
    return [x, y, w, h];
  },
  eDrawKey: function(e) {
    var layerState = Aj.layerState;
    if (!layerState) return;
    if (e.type === 'pointerdown' && (e.pointerId == null || e.isPrimary === false)) return;
    if (e.type === 'pointerdown' && $(e.target).closest('.screenshot-key').length) return;
    if (e.type === 'pointerdown' && layerState.drawing) return;
    if ((e.type === 'pointercancel' || e.type === 'lostpointercapture') &&
        layerState.drawing && (e.pointerId == null || layerState.pointerId === e.pointerId)) {
      if (layerState.pointerCaptureTarget && layerState.pointerCaptureTarget.releasePointerCapture &&
          layerState.pointerId != null) {
        try { layerState.pointerCaptureTarget.releasePointerCapture(layerState.pointerId); } catch (ignore) {}
      }
      if (layerState.$keyEl && layerState.$keyEl.hasClass('screenshot-key-new')) {
        layerState.$keyEl.remove();
      }
      layerState.$keyEl = null;
      layerState.keyCoords = null;
      layerState.pointerId = null;
      layerState.pointerCaptureTarget = null;
      layerState.drawing = false;
      layerState.editMode = false;
      layerState.ocrGeneration++;
      layerState.$layerWrapEl.removeClass('screenshot-layer-mode-edit');
      $('.screenshot-key-drawing, .screenshot-key-recognizing', Aj.layer).addClass('ohide');
      $(document).off('.screenshotDrawing');
      Aj.layer.removeClass('popup-no-close');
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    var $imgEl = layerState.$imgEl;
    var $layerEl = layerState.$layerEl;
    var $layerWrapEl = layerState.$layerWrapEl;
    var $keyEl = layerState.$keyEl;

    var layerNode = $layerEl && $layerEl.get(0);
    if (!layerNode) return;
    var layerRect = layerNode.getBoundingClientRect();
    var normalizedX, normalizedY;
    if (e.type === 'pointerdown' || e.type === 'pointermove') {
      if (!layerRect.width || !layerRect.height) return;
      var relX = e.clientX - layerRect.left;
      var relY = e.clientY - layerRect.top;
      normalizedX = Math.max(0, Math.min(1, relX / layerRect.width));
      normalizedY = Math.max(0, Math.min(1, relY / layerRect.height));
    }
    if (e.type == 'pointerdown') {
      if (layerState.editMode && !layerState.drawing) {
        ScreenshotLayer.closeEdit();
        layerState.editMode = true;
        $('.screenshot-key-drawing', Aj.layer).removeClass('ohide');
        layerState.$layerWrapEl.addClass('screenshot-layer-mode-edit');
        $('.screenshot-key-recognizing', Aj.layer).addClass('ohide');
        $('.screenshot-key-edit-results', Aj.layer).addClass('ohide');
        $('.screenshot-key-edit-field', Aj.layer).val('').trigger('input').prop('disabled', true);
      }
      var coords = [
        normalizedX,
        normalizedY,
        0,
        0
      ];
      layerState.$keyEl = ScreenshotLayer.addScreenshotKey(coords);
      layerState.keyCoords = coords;
      layerState.drawing = true;
      layerState.pointerId = e.pointerId;
      Aj.layer.addClass('popup-no-close');
      layerState.pointerCaptureTarget = e.currentTarget;
      if (layerState.pointerCaptureTarget && layerState.pointerCaptureTarget.setPointerCapture) {
        try { layerState.pointerCaptureTarget.setPointerCapture(e.pointerId); } catch (ignore) {}
      }
      if (window.PointerEvent) $(document).on('pointermove.screenshotDrawing pointerup.screenshotDrawing pointercancel.screenshotDrawing', ScreenshotLayer.eDrawKey);
      else $(document).on('mousemove.screenshotDrawing mouseup.screenshotDrawing touchmove.screenshotDrawing touchend.screenshotDrawing touchcancel.screenshotDrawing', ScreenshotLayer.eDrawFallback);
      Search.getData(Aj.state.curLang, Aj.layerState.screenshotLangpack);
    }
    else if (e.type == 'pointermove') {
      if (!layerState.drawing) return;
      if (layerState.pointerId !== e.pointerId) return;
      if ($keyEl && layerState.keyCoords) {
        var coords = layerState.keyCoords;
        coords[2] = normalizedX - coords[0];
        coords[3] = normalizedY - coords[1];
        ScreenshotLayer.updateScreenshotKeyPosition($keyEl, coords);
        if (!layerState.editMode &&
            ScreenshotLayer.screenshotKeyIsAllowedSize(coords)) {
          layerState.editMode = true;
          $('.screenshot-key-drawing', Aj.layer).removeClass('ohide');
          layerState.$layerWrapEl.addClass('screenshot-layer-mode-edit');
          $('.screenshot-key-recognizing', Aj.layer).addClass('ohide');
          $('.screenshot-key-edit-results', Aj.layer).addClass('ohide');
          $('.screenshot-key-edit-field', Aj.layer).val('').trigger('input').prop('disabled', true);
        }
      }
    }
    else if (e.type == 'pointerup' || e.type == 'pointercancel' || e.type == 'lostpointercapture') {
      if (!layerState.drawing) return;
      if (e.pointerId != null && layerState.pointerId !== e.pointerId) return;
      if ($keyEl && layerState.keyCoords) {
        var coords = layerState.keyCoords;
        coords = ScreenshotLayer.fixScreenshotKeyCoordinates(coords, 6);
        ScreenshotLayer.updateScreenshotKeyPosition($keyEl, coords);
        $('.screenshot-key-drawing', Aj.layer).addClass('ohide');
        layerState.drawing = false;
        if (!ScreenshotLayer.screenshotKeyIsAllowedSize(coords)) {
          layerState.editMode = false;
          $layerWrapEl.removeClass('screenshot-layer-mode-edit');
          $keyEl.remove();
          layerState.$keyEl = null;
        } else {
          $keyEl.removeClass('screenshot-key-drawable');
          $('.screenshot-key-recognizing', Aj.layer).removeClass('ohide');
          $keyEl.addClass('active');
          ScreenshotLayer.updateLayerHover();
          var img = $imgEl[0];
          var x = coords[0] * img.naturalWidth;
          var y = coords[1] * img.naturalHeight;
          var width = coords[2] * img.naturalWidth;
          var height = coords[3] * img.naturalHeight;
          var ocrGeneration = ++layerState.ocrGeneration;
          var ocrRoute = Aj.location().href;
          var ocrState = Aj.state;
          Recognizer.getTextFromImage(img, x, y, width, height, function(text, coords) {
            if (!Aj.layerState || Aj.layerState !== layerState ||
                Aj.state !== ocrState || Aj.location().href !== ocrRoute ||
                layerState.screenshotId !== Aj.layerState.screenshotId ||
                ocrGeneration !== layerState.ocrGeneration ||
                $keyEl !== layerState.$keyEl) return;
            $('.screenshot-key-recognizing', Aj.layer).addClass('ohide');
            $('.screenshot-key-edit-results', Aj.layer).removeClass('ohide');
            if (coords) {
              coords = ScreenshotLayer.fixScreenshotKeyCoordinates(coords, 6);
              ScreenshotLayer.updateScreenshotKeyPosition($keyEl, coords);
            }
            var found = 0, found_item = false;
            var lang_keys = Search.getData(Aj.state.curLang, Aj.layerState.screenshotLangpack);
            if (lang_keys !== false) {
              for (var i = 0; i < lang_keys.length; i++) {
                var item = lang_keys[i];
                if (!$.isArray(item.def_value) &&
                    !$.isPlainObject(item.def_value) &&
                    item.def_value == text) {
                  found_item = item;
                  found++;
                }
              }
            }
            $keyEl.attr('data-text', text);
            if (!found || found > 1) {
              ScreenshotLayer.initKeysSearch($keyEl);
            }
            else if (coords) {
              var lang_key = found_item.key;
              ScreenshotLayer.addKeyToScreenshot($keyEl, lang_key, found_item, coords);
            }
          }, null, function() {
            if (!Aj.layerState || Aj.layerState !== layerState || Aj.state !== ocrState || Aj.location().href !== ocrRoute || ocrGeneration !== layerState.ocrGeneration || $keyEl !== layerState.$keyEl) return;
            $('.screenshot-key-recognizing', Aj.layer).addClass('ohide');
            $('.screenshot-key-edit-results', Aj.layer).removeClass('ohide');
            $keyEl.removeClass('active');
            ScreenshotLayer.initKeysSearch($keyEl);
          });
        }
        layerState.keyCoords = null;
        if (e.type === 'pointerup' && layerState.pointerCaptureTarget &&
            layerState.pointerCaptureTarget.releasePointerCapture) {
          try { layerState.pointerCaptureTarget.releasePointerCapture(e.pointerId); } catch (ignore) {}
        }
        layerState.pointerId = null;
        layerState.pointerCaptureTarget = null;
        $(document).off('.screenshotDrawing');
        setTimeout(function() {
          if (Aj.layerState === layerState) Aj.layer.removeClass('popup-no-close');
        }, 10);
      } else {
        if (layerState.pointerCaptureTarget && layerState.pointerCaptureTarget.releasePointerCapture &&
            layerState.pointerId != null) {
          try { layerState.pointerCaptureTarget.releasePointerCapture(layerState.pointerId); } catch (ignore) {}
        }
        layerState.drawing = false;
        layerState.keyCoords = null;
        layerState.$keyEl = null;
        layerState.pointerId = null;
        layerState.pointerCaptureTarget = null;
        layerState.ocrGeneration++;
        $(document).off('.screenshotDrawing');
        if (Aj.layerState === layerState) Aj.layer.removeClass('popup-no-close');
      }
    }
  },
  eDrawFallback: function(e) {
    var oe = e.originalEvent || e, touch = oe.touches && oe.touches[0] || oe.changedTouches && oe.changedTouches[0];
    if (e.type.indexOf('touch') === 0 && !touch) return;
    var synthetic = {
      type: e.type === 'mousedown' ? 'pointerdown' : (e.type === 'touchstart' ? 'pointerdown' : e.type === 'mousemove' || e.type === 'touchmove' ? 'pointermove' : e.type === 'touchcancel' ? 'pointercancel' : 'pointerup'),
      pointerId: touch ? touch.identifier + 1 : 1,
      isPrimary: true,
      clientX: touch ? touch.clientX : oe.clientX,
      clientY: touch ? touch.clientY : oe.clientY,
      target: oe.target,
      currentTarget: e.currentTarget,
      preventDefault: function() { e.preventDefault(); },
      stopPropagation: function() { e.stopPropagation(); }
    };
    ScreenshotLayer.eDrawKey(synthetic);
  },
  cancelDrawing: function() {
    var layerState = Aj.layerState;
    if (!layerState || !layerState.drawing) return false;
    if (layerState.pointerCaptureTarget && layerState.pointerCaptureTarget.releasePointerCapture && layerState.pointerId != null) {
      try { layerState.pointerCaptureTarget.releasePointerCapture(layerState.pointerId); } catch (ignore) {}
    }
    if (layerState.$keyEl && layerState.$keyEl.hasClass('screenshot-key-new')) layerState.$keyEl.remove();
    layerState.$keyEl = null;
    layerState.keyCoords = null;
    layerState.pointerId = null;
    layerState.pointerCaptureTarget = null;
    layerState.drawing = false;
    layerState.editMode = false;
    layerState.ocrGeneration++;
    if (layerState.$layerWrapEl) layerState.$layerWrapEl.removeClass('screenshot-layer-mode-edit');
    $('.screenshot-key-drawing,.screenshot-key-recognizing', Aj.layer).addClass('ohide');
    $(document).off('.screenshotDrawing');
    Aj.layer.removeClass('popup-no-close');
    return true;
  },
  addKeyToScreenshot: function($keyEl, lang_key, lang_item, coords, old_lang_key) {
    if (!Aj.layerState) return;
    var layerState = Aj.layerState;
    var requestGuard = TrResponsiveLifecycle.requestGuard('Screenshot.addKey', $keyEl[0], [layerState.screenshotLangpack, lang_key, layerState.screenshotId, old_lang_key || '', coords.join(',')].join('\u0001'), layerState);
    Aj.apiRequest('addKeyToScreenshot', {
      lang_pack: layerState.screenshotLangpack,
      lang_key: lang_key,
      screenshot_id: layerState.screenshotId,
      remove_lang_key: old_lang_key,
      x: coords[0],
      y: coords[1],
      w: coords[2],
      h: coords[3]
    }, function(result) {
      if (!requestGuard()) return;
      if (!result.ok) {
        ScreenshotLayer.applyScreenshotKey($keyEl, lang_key);
      } else if (old_lang_key) {
        ScreenshotLayer.applyScreenshotKey($keyEl, old_lang_key);
      }
      if (result.error) {
        return showAlert(result.error);
      }
    });
    ScreenshotLayer.applyScreenshotKey($keyEl, lang_key, lang_item, coords);
    ScreenshotLayer.closeEdit();
  },
  sortKeysByCoordinates: function() {
    if (!Aj.layerState) return;
    var $layerEl = Aj.layerState.$layerEl;
    var $keys = $('.screenshot-key[data-key]', $layerEl);
    var $layerKeys = $('.screenshot-layer-keys', Aj.layer);
    var coords = [];
    $keys.map(function() {
      var lang_key = $(this).attr('data-key') || '';
      coords.push({
        coords: $(this).attr('data-coordinates').split(','),
        $el: $('.screenshot-key-row[data-key="' + lang_key + '"]', $layerKeys)})
    });
    coords.sort(function(c1, c2) {
      return (c1.coords[1] - c2.coords[1]) || (c1.coords[0] - c2.coords[0]);
    });
    var prev_y = 0;
    for (var i = 0; i < coords.length; i++) {
      if ((coords[i].coords[1] - prev_y) < 0.005) {
        coords[i].coords[1] = prev_y;
      } else {
        prev_y = coords[i].coords[1];
      }
    }
    coords.sort(function(c1, c2) {
      return (c1.coords[1] - c2.coords[1]) || (c1.coords[0] - c2.coords[0]);
    });
    for (var i = coords.length - 1; i >= 0; i--) {
      coords[i].$el.prependTo($layerKeys);
    }
  },
  applyScreenshotKey: function($keyEl, lang_key, lang_item, coords) {
    if (!Aj.layerState) return;
    var $layerEl = Aj.layerState.$layerEl;
    if (lang_item) {
      var $foundKeyEl = $('.screenshot-key[data-key="' + lang_key + '"]', $layerEl);
      if ($foundKeyEl.length) {
        if (!$foundKeyEl.is($keyEl)) {
          $keyEl.remove();
        }
        ScreenshotLayer.updateLayerHover();
        $keyEl = $foundKeyEl;
        if ($keyEl.hasClass('modified')) {
          $('.key-hover[data-key="' + lang_key + '"]').removeClass('modified');
        }
        ScreenshotLayer.updateScreenshotKeyPosition($keyEl, coords);
      } else {
        $keyEl.attr({
          'data-key': lang_key,
          role: 'button',
          tabindex: '0',
          'aria-label': ScreenshotLayer.keyAccessibleLabel(lang_key, lang_item)
        });
        $('.key-label', $keyEl).html(wrapLangValue(lang_item.def_value));
        var $keys = $('.screenshot-layer-keys', Aj.layer);
        var base_url = $keys.attr('data-key-base-url') || '';
        $('<a href="' + cleanAttr(base_url + lang_key) + '" class="screenshot-key-row key-hover" data-key="' + cleanAttr(lang_key) + '"><span class="screenshot-key-remove close" role="button" tabindex="0" aria-label="Remove screenshot key"></span><div class="screenshot-key-value-default">' + wrapLangValue(lang_item.value) + '</div><div class="screenshot-key-lang-key">' + cleanHTML(lang_key) + '</div></a>').appendTo($keys);
        ScreenshotLayer.sortKeysByCoordinates();
        var $keysList = $('.screenshot-keys-list', Aj.layer);
        var $keysCounterEl = $('.tr-header-counter', $keysList);
        var keys_count = parseInt($keysCounterEl.text(), 10) || 0;
        $keysCounterEl.text(++keys_count || '');
        $keysList.fadeToggle(keys_count > 0);
      }
      $keyEl.attr({role: 'button', tabindex: '0', 'aria-label': ScreenshotLayer.keyAccessibleLabel(lang_key, lang_item)});
      $keyEl.removeClass('screenshot-key-new');
      ScreenshotLayer.keyHover(lang_key, true, true);
      clearTimeout(Aj.layerState.hoverTimeout);
      Aj.layerState.hoverTimeout = setTimeout(function() {
        ScreenshotLayer.keyHover(lang_key, false);
      }, 700);
    } else {
      $('.key-hover[data-key="' + lang_key + '"]').remove();
      ScreenshotLayer.updateLayerHover();
      var $keysList = $('.screenshot-keys-list', Aj.layer);
      var $keysCounterEl = $('.tr-header-counter', $keysList);
      var keys_count = parseInt($keysCounterEl.text(), 10) || 0;
      $keysCounterEl.text(--keys_count || '');
      $keysList.fadeToggle(keys_count > 0);
    }
  },
  eRemoveScreenshotKey: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    var $keyEl = $(this).parents('.screenshot-key-row');
    var lang_key = $keyEl.attr('data-key');
    var layerState = Aj.layerState;
    if (!layerState) return;
    var screenshot_id = layerState.screenshotId;
    if (lang_key) {
      var confirm_text = l('WEB_REMOVE_SCREENSHOT_KEY_CONFIRM_TEXT', {lang_key: cleanHTML(lang_key), n: screenshot_id});
      showConfirm(confirm_text, function() {
        var requestGuard = TrResponsiveLifecycle.requestGuard('Screenshot.removeKey', $keyEl[0], [layerState.screenshotLangpack, lang_key, screenshot_id].join('\u0001'), layerState);
          Aj.apiRequest('removeKeyFromScreenshot', {
            lang_pack: layerState.screenshotLangpack,
            lang_key: lang_key,
            screenshot_id: screenshot_id
          }, function(result) {
            if (!requestGuard()) return;
            if (result.ok) {
              ScreenshotLayer.applyScreenshotKey($keyEl, lang_key);
            }
            if (result.error) {
              return showAlert(result.error);
            }
          });
      }, l('WEB_REMOVE_SCREENSHOT_KEY_CONFIRM_BUTTON'));
    }
  },
  removeScreenshot: function(screenshot_id) {
    var layerState = Aj.layerState;
    if (!layerState) return;
    var confirm_text = l('WEB_REMOVE_SCREENSHOT_CONFIRM_TEXT', {n: screenshot_id});
    showConfirm(confirm_text, function() {
      var requestGuard = TrResponsiveLifecycle.requestGuard('Screenshot.remove', null, [layerState.screenshotLangpack, screenshot_id].join('\u0001'), layerState);
      Aj.apiRequest('removeScreenshot', {
        lang_pack: layerState.screenshotLangpack,
        screenshot_id: screenshot_id
      }, function(result) {
        if (!requestGuard()) return;
        if (result.error) {
          return showAlert(result.error);
        }
        $('.tr-screenshot-row[data-screenshot-id="' + screenshot_id + '"]').remove();
        Screenshots.sortableRefresh();
        closePopup(Aj.layer);
      });
    }, l('WEB_REMOVE_SCREENSHOT_CONFIRM_BUTTON'));
  },
  eEditScreenshotSection: function(e) {
    if (!Aj.layerState) return;
    e.stopPropagation();
    var $button = $(this), section = $button.attr('data-section');
    if ($button.parents('li').hasClass('selected') || $button.attr('aria-busy') === 'true') {
      return;
    }
    $button.attr('aria-busy', 'true').prop('disabled', true);
    var layerState = Aj.layerState;
    var requestGuard = TrResponsiveLifecycle.requestGuard('Screenshot.editSection', Aj.layer && Aj.layer[0], [layerState.screenshotLangpack, layerState.screenshotId, section].join('\u0001'), layerState);
    Aj.apiRequest('editScreenshotSection', {
      lang_pack: layerState.screenshotLangpack,
      lang: Aj.state.curLang,
      screenshot_id: layerState.screenshotId,
      section: section
    }, function(result) {
      if (!requestGuard()) return;
      $button.removeAttr('aria-busy').prop('disabled', false);
      if (result.error) return showAlert(result.error);
      if (result.sections_html) {
        $('.screenshot-sections', Aj.layer).html(result.sections_html);
      }
      if (section != Aj.state.curSection) {
        $('.tr-screenshot-row[data-screenshot-id="' + layerState.screenshotId + '"]').remove();
        Screenshots.sortableRefresh();
      }
    });
  },
  eKeyHover: function(e) {
    if ($(this).hasClass('screenshot-key-new')) return;
    var langKey = $(this).attr('data-key');
    var hover = (e.type == 'mouseover');
    var scrollToRow = !$(this).hasClass('screenshot-key-row');
    if (Aj.layerState.drawing && hover) return;
    ScreenshotLayer.keyHover(langKey, hover, scrollToRow);
  },
  keyHover: function(langKey, hover, scrollToRow) {
    var $keys = $('.key-hover[data-key="' + langKey + '"]');
    $keys.toggleClass('hover', hover);
    ScreenshotLayer.updateLayerHover();
    Aj.layerState.$layerEl.toggleClass('hover', $('.screenshot-key.hover').size() > 0);
    if (scrollToRow) {
      var $rows = $keys.filter('.screenshot-key-row');
      if ($rows.size()) {
        $rows.scrollIntoView({duration: 150, padding: 15});
      }
    }
  },
  updateLayerHover: function() {
    if (!Aj.layerState.$layerEl) return;
    Aj.layerState.$layerEl.toggleClass('hover', $('.screenshot-key.hover', Aj.layer).size() > 0);
    Aj.layerState.$layerEl.toggleClass('active', $('.screenshot-key.active', Aj.layer).size() > 0);
  },
  eOpenEdit: function(e) {
    if (!Aj.layerState) return;
    if (Aj.layerState.drawing) return;
    if (Aj.layerState.editMode) {
      ScreenshotLayer.closeEdit();
    }
    e.preventDefault();
    e.stopPropagation();
    var $keyEl = $(this);
    ScreenshotLayer.openEdit($keyEl);
  },
  openEdit: function($keyEl) {
    if (!Aj.layerState) return;
    if (!Aj.layerState.canEditPhrases) {
      var key = $keyEl.attr('data-key');
      var href = $('.screenshot-key-row', Aj.layer).filter(function() {
        return $(this).attr('data-key') === key;
      }).attr('href');
      if (href) Aj.setLocation(href);
      return;
    }
    var layerState = Aj.layerState;
    $keyEl.addClass('active');
    ScreenshotLayer.updateLayerHover();
    layerState.$keyEl = $keyEl;
    layerState.editMode = true;
    layerState.$layerWrapEl.addClass('screenshot-layer-mode-edit');
    $('.screenshot-key-recognizing', Aj.layer).addClass('ohide');
    $('.screenshot-key-edit-results', Aj.layer).removeClass('ohide');
    ScreenshotLayer.initKeysSearch($keyEl);
  },
  closeEdit: function() {
    if (!Aj.layerState) return;
    var layerState = Aj.layerState;
    if (layerState.drawing) return;
    layerState.ocrGeneration++;
    if (layerState.$keyEl) {
      if (layerState.$keyEl.hasClass('screenshot-key-new')) {
        layerState.$keyEl.remove();
      } else {
        layerState.$keyEl.removeClass('active');
      }
    }
    ScreenshotLayer.updateLayerHover();
    layerState.$keyEl = null;
    layerState.editMode = false;
    if (layerState.$layerWrapEl) {
      layerState.$layerWrapEl.removeClass('screenshot-layer-mode-edit');
    }
    var $fieldEl = $('.screenshot-key-edit-field', Aj.layerEl);
    $fieldEl.val('').trigger('input').blur();
  },
  initKeysSearch: function($keyEl) {
    var $layerEl = Aj.layerState.$layerEl;
    var lang_key = $keyEl.attr('data-key');
    var $fieldEl = $('.screenshot-key-edit-field', Aj.layerEl);
    var def_value = lang_key || $keyEl.attr('data-text') || '';
    $fieldEl.prop('disabled', false).val(def_value).trigger('input').focus().select();
  },
  eSubmitDescriptionForm: function(e) {
    e.preventDefault();
    var form = (e.type == 'submit') ? this : this.form;
    form.description.blur();
    if (form.description.defaultValue == form.description.value) {
      return false;
    }
    var layerState = Aj.layerState;
    if (!layerState) return false;
    var requestGuard = TrResponsiveLifecycle.requestGuard('Screenshot.description', form, [layerState.screenshotLangpack, layerState.screenshotId, form.description.value].join('\u0001'), layerState);
    Aj.apiRequest('editScreenshotDescription', {
      lang_pack: layerState.screenshotLangpack,
      screenshot_id: layerState.screenshotId,
      description: form.description.value
    }, function(result) {
      if (!requestGuard()) return;
      if (result.error) {
        return showAlert(result.error);
      }
      if (typeof result.description !== 'undefined') {
        form.description.defaultValue = form.description.value = result.description;
        autosize.update(form.description);
      }
      form.reset();
    });
    return false;
  },
  eCancelDescriptionForm: function(e) {
    if (e.which == Keys.ESC) {
      e.preventDefault();
      e.stopPropagation();
      this.form.reset();
      this.blur();
    }
  },
  onKeyTarget: function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if ($(e.target).closest('input, textarea, button, a').length &&
        !$(e.target).is('.screenshot-key, .screenshot-key-row')) return;
    e.preventDefault();
    e.stopPropagation();
    if ($(this).hasClass('screenshot-key-row')) {
      var href = $(this).attr('href');
      if (href) Aj.setLocation(href);
    } else {
      ScreenshotLayer.eOpenEdit.call(this, e);
    }
  },
  onKeyDown: function(e) {
    if (e.key === 'Escape' && Aj.layerState && Aj.layerState.drawing) {
      e.preventDefault();
      e.stopPropagation();
      ScreenshotLayer.cancelDrawing();
      return;
    }
    if (e.key === 'Escape' && Aj.layerState && Aj.layerState.editMode) {
      e.preventDefault();
      ScreenshotLayer.closeEdit();
      return;
    }
    if ((e.which == Keys.LEFT || e.which == Keys.RIGHT) &&
        $(e.target).closest('input, textarea, .input').size()) {
      return;
    }
    switch (e.which) {
      case Keys.LEFT:
        $('.screenshot-prev-btn').trigger('click');
        break;
      case Keys.RIGHT:
        $('.screenshot-next-btn').trigger('click');
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  }
};

var TOKEN_REGEX = new RegExp('%(\\d+\\$)?\\.?\\d*[%@sdf]|\\{[A-Za-z0-9_]+\\}|\\[\\/?[A-Za-z]\\]|\\bun\\d\\b|&lt;!\\[CDATA\\[&lt;a href=&quot;|&quot;&gt;|&lt;\\/a&gt;\\]\\]&gt;|\\[a href=&quot;|&quot;\\]', 'g');

function wrapLangValue(lang_value, is_rtl, highlight) {
  var html = '';
  var rtl_class = (is_rtl ? ' rtl' : '');
  if ($.isArray(lang_value) ||
      $.isPlainObject(lang_value)) {
    html += '<span class="pluralized' + rtl_class + '">';
    for (var p = 0; p < 6; p++) {
      if (typeof lang_value[p] === 'undefined') continue;
      html += '<span class="p-value' + rtl_class + '" data-label="' + l('WEB_PLURALIZED_LABEL_' + p).toLowerCase() + '"><span class="value">' + Search.wrapHighlight(lang_value[p], highlight, true) + '</span></span>';
      first = false;
    }
    html += '</span>';
    return html;
  }
  return '<span class="p-value' + rtl_class + '"><span class="value">' + Search.wrapHighlight(lang_value, highlight, true) + '</span></span>';
}

function getBR() {
  if (window._brHTML) return window._brHTML;
  return window._brHTML = $('<div><br/></div>').html();
}
function cleanHTML(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, getBR());
}
function cleanAttr(value) {
  return cleanHTML(String(value == null ? '' : value)).replace(/'/g, '&#39;');
}
function cleanRE(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function addUrlSearchParam(url, param, value) {
  var search = url.search || '';
  if (search.substr(0, 1) == '?') {
    search = search.substr(1);
  }
  var search_parts = search.length ? search.split('&') : [];
  var found = false, fstr = param + '=';
  for (var i = search_parts.length - 1; i >= 0; i--) {
    if (search_parts[i].substr(0, fstr.length) == fstr) {
      search_parts[i] = fstr + encodeURIComponent(value);
      found = true;
      break;
    }
  }
  if (!found) {
    search_parts.push(fstr + encodeURIComponent(value));
  }
  url.search = search_parts.join('&');
}

function stopImmediatePropagation(e) {
  e.stopImmediatePropagation();
}
function preventDefault(e) {
  e.preventDefault();
}


var LoadMore = {
  registered: false,
  generation: 0,
  requests: [],
  init: function() {
    if (LoadMore.registered) return;
    LoadMore.registered = true;
    Aj.onLoad(function(state) {
      LoadMore.generation++;
      state.loadMoreGeneration = LoadMore.generation;
      $(document).off('click.tr-loadmore').on('click.tr-loadmore', '.load-more-btn', LoadMore.onClick);
      $(window).off('scroll.tr-loadmore resize.tr-loadmore orientationchange.tr-loadmore').on('scroll.tr-loadmore resize.tr-loadmore orientationchange.tr-loadmore', LoadMore.onScroll);
      if (window.visualViewport) $(window.visualViewport).off('resize.tr-loadmore scroll.tr-loadmore').on('resize.tr-loadmore scroll.tr-loadmore', LoadMore.onScroll);
    });
    Aj.onUnload(function(state) {
      LoadMore.generation++;
      $.each(LoadMore.requests, function(i, record) {
        if (record && record.xhr && record.xhr.abort) record.xhr.abort();
      });
      LoadMore.requests = [];
      $(document).off('.tr-loadmore');
      $(window).off('.tr-loadmore');
      if (window.visualViewport) $(window.visualViewport).off('.tr-loadmore');
    });
  },
  onClick: function() {
    var $loadMore = $(this).parents('.load-more');
    LoadMore.load($loadMore);
  },
  onScroll: function() {
    $('.load-more').each(function() {
      var $loadMore = $(this);
      var top = $loadMore.offset().top - $(window).scrollTop();
      if (top < $(window).height() * 2) {
        LoadMore.load($loadMore);
      }
    });
  },
  load: function($loadMore) {
    if (!$loadMore || !$loadMore.length || !document.documentElement.contains($loadMore[0])) return;
    var offset = $loadMore.data('offset');
    if (!offset) {
      $loadMore.remove();
      return;
    }
    var generation = LoadMore.generation;
    var href = Aj.location().href;
    var state = Aj.state;
    var requestKey = href + '|' + offset + '|' + ($loadMore.data('offset-data') || '');
    if ($loadMore.data('loading') || $loadMore.data('request-key') === requestKey) {
      return;
    }
    var $loadMoreBtn = $('.load-more-btn', $loadMore);
    $loadMoreBtn.data('old-text', $loadMoreBtn.text()).text('Loading').attr({'aria-busy': 'true', 'aria-live': 'polite'}).addClass('dots-animated');
    $loadMore.data({'loading': true, 'request-key': requestKey});
    var requestRecord = {xhr: null, key: requestKey};
    LoadMore.requests.push(requestRecord);
    var clearRequestState = function() {
      /* Do not clear a newer request marker from a stale callback. */
      if ($loadMore.data('request-key') === requestKey) {
        $loadMore.data('loading', false).removeData('request-key');
      }
    };
    var request = $.ajax(href, {
      type: 'POST',
      data: {
        offset: offset,
        offset_data: $loadMore.data('offset-data'),
        more: 1
      },
      dataType: 'json',
      xhrFields: {withCredentials: true},
      success: function(result) {
        if (generation !== LoadMore.generation || state !== Aj.state || Aj.location().href !== href || !document.documentElement.contains($loadMore[0])) return;
        clearRequestState();
        if (result.more_html) {
          var $loadMoreCont = $loadMore.parents('.load-more-container');
          if (!$loadMoreCont.size()) {
            return;
          }
          $loadMore.remove();
          $loadMoreCont.append(result.more_html);
        } else {
          var $loadMoreBtn = $('.load-more-btn', $loadMore);
          $loadMoreBtn.text($loadMoreBtn.data('old-text')).removeAttr('aria-busy').removeClass('dots-animated');
        }
      },
      error: function(xhr) {
        if (generation !== LoadMore.generation || state !== Aj.state || Aj.location().href !== href || !document.documentElement.contains($loadMore[0])) return;
        clearRequestState();
        var $loadMoreBtn = $('.load-more-btn', $loadMore);
        $loadMoreBtn.text($loadMoreBtn.data('old-text')).removeAttr('aria-busy').removeClass('dots-animated');
      },
      complete: function() {
        LoadMore.requests = $.grep(LoadMore.requests, function(record) {
          return record !== requestRecord;
        });
        clearRequestState();
      }
    });
    requestRecord.xhr = request;
  }
};

var LangKey = {
  makeRequestGuard: function($block, identity) {
    if (!$block || !$block.length) return function() { return false; };
    var block = $block[0];
    var blockIdentity = function() {
      return [$block.attr('data-lang'), $block.attr('data-langpack'), $block.attr('data-section'), $block.attr('data-key'), identity || ''].join('\u0001');
    };
    return TrResponsiveLifecycle.requestGuard('LangKey', block, blockIdentity);
  },
  init: function($blockEl) {
    $('input.file-upload', $blockEl).on('change', Screenshots.eUpload);
    $('.key-add-suggestion-field', $blockEl).on('focus.curBlock blur.curBlock keyup.curBlock change.curBlock input.curBlock', LangKey.eUpdateAddSuggestionField);
    $('.key-add-suggestion-header-wrap', $blockEl).off('click.curBlock').on('click.curBlock', LangKey.eToggleSuggestionForm);
    $('.add-suggestion-form .form-cancel-btn', $blockEl).off('click.curBlock').on('click.curBlock', LangKey.eHideSuggestionForm);
    $('.key-description-form', $blockEl).on('submit', LangKey.eSubmitDescriptionForm);
    $('.key-description-field', $blockEl).on('blur', LangKey.eSubmitDescriptionForm);
    $('.key-description-field', $blockEl).on('keydown', LangKey.eCancelDescriptionForm);
    $('.key-remove-btn', $blockEl).on('click', LangKey.removeLangKey);
    $('.key-restore-btn', $blockEl).on('click', LangKey.restoreLangKey);
    $('.key-important-btn', $blockEl).on('click', LangKey.markAsImportantLangKey);
    $('.key-unimportant-btn', $blockEl).on('click', LangKey.markAsUnimportantLangKey);
    $('.tr-key-block-close', $blockEl).on('click', LangKeys.eCloseKey);
    $blockEl.on('click.curBlock', '.sections-select-item', LangKey.eToggleKeySection);
    $blockEl.on('click.curBlock', '.key-suggestion-value-wrap', LangKey.eToggleSuggestion);
    $blockEl.on('click.curBlock', '.key-suggestion-collapse', LangKey.eToggleSuggestion);
    $blockEl.on('keydown.curBlock', '.key-suggestion-collapse', LangKey.onSuggestionKeyDown);
    $blockEl.on('click.curBlock', '.key-suggestion-like', LangKey.eLikeSuggestion.pbind('liked'));
    $blockEl.on('click.curBlock', '.key-suggestion-dislike', LangKey.eLikeSuggestion.pbind('disliked'));
    $blockEl.on('click.curBlock', '.key-suggestion-comment', LangKey.eCommentSuggestion);
    $blockEl.on('click.curBlock', '.key-status-apply-btn', LangKey.eApplySuggestion);
    $blockEl.on('click.curBlock', '.key-suggestion-edit', LangKey.eEditSuggestion);
    $blockEl.on('click.curBlock', '.key-suggestion-delete', LangKey.eDeleteSuggestion);
    $blockEl.on('click.curBlock', '.key-suggestion-restore', LangKey.eRestoreSuggestion);
    $blockEl.on('click.curBlock', '.key-suggestion-delete-all', LangKey.eDeleteAllSuggestions);
    $blockEl.off('click.curBlock', '.mark-as-translated-btn').on('click.curBlock', '.mark-as-translated-btn', LangKey.eMarkAsTranslated);
    $blockEl.off('keydown.tr-key-action-a11y').on('keydown.tr-key-action-a11y', '.mark-as-translated-btn,.key-add-suggestion-header-wrap', function(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (this.tagName === 'BUTTON' || this.tagName === 'A') return;
      e.preventDefault();
      e.stopPropagation();
      $(this).trigger('click');
    });
    $blockEl.on('click.curBlock', '.key-default', LangKey.eToggleHistory);
    $blockEl.on('click.curBlock', '.key-usage-header', LangKey.eToggleUsage);
    $blockEl.on('click.curBlock', '.comments-show-all', LangKey.eShowAllSuggestionComments);
    $blockEl.on('submit.curBlock', '.add-suggestion-form', LangKey.eSubmitSuggestionForm);
    $blockEl.on('submit.curBlock', '.comment-form', LangKey.eSubmitCommentForm);
    $blockEl.on('focus.curBlock blur.curBlock keyup.curBlock change.curBlock input.curBlock', '.comment-field', LangKey.eUpdateCommentField);
    $blockEl.on('click.curBlock', '.comment-form .form-cancel-btn', LangKey.eHideCommentForm);
    $blockEl.on('click.curBlock', '.comment-reply-link', LangKey.eReplySuggestionComment);
    $blockEl.on('click.curBlock', '.comment-reply-cancel', LangKey.eCancelReplySuggestionComment);
    $blockEl.on('click.curBlock', '.comment-delele-btn', LangKey.eDeleteSuggestionComment);
    $blockEl.on('click.curBlock', '.comment-restore-btn', LangKey.eRestoreSuggestionComment);
    $blockEl.on('click.curBlock', '.comment-delete-all-btn', LangKey.eDeleteAllSuggestionComments);
    $blockEl.on('click.curBlock', '.binding-item', LangKey.eBindingOpen);
    $blockEl.on('click.curBlock', '.bind-key-btn', LangKey.eBindKey);
    $blockEl.on('click.curBlock', '.unbind-key-btn', LangKey.eUnbindKey);
    $blockEl.on('click.curBlock', '.diff-btn', LangKey.eToggleDiff);
    autosize($('.key-description-field', $blockEl));
    autosize($('.key-suggestion-wrap .comment-field', $blockEl));
    $('div.key-add-suggestion-field').initTextarea({
      allowTokens: true
    });
  },
  destroy: function($blockEl) {
    $('input.file-upload', $blockEl).off('change', Screenshots.eUpload);
    $('.key-add-suggestion-field', $blockEl).off('.curBlock', LangKey.eUpdateAddSuggestionField);
    $('.key-add-suggestion-header-wrap', $blockEl).off('click', LangKey.eToggleSuggestionForm);
    $('.add-suggestion-form .form-cancel-btn', $blockEl).off('click', LangKey.eHideSuggestionForm);
    $('.key-description-form', $blockEl).off('submit', LangKey.eSubmitDescriptionForm);
    $('.key-description-field', $blockEl).off('blur', LangKey.eSubmitDescriptionForm);
    $('.key-description-field', $blockEl).off('keydown', LangKey.eCancelDescriptionForm);
    $('.key-remove-btn', $blockEl).off('click', LangKey.removeLangKey);
    $('.key-restore-btn', $blockEl).off('click', LangKey.restoreLangKey);
    $('.tr-key-block-close', $blockEl).off('click', LangKeys.eCloseKey);
    $('div.key-add-suggestion-field').destroyTextarea();
    $blockEl.off('.tr-key-action-a11y');
    $blockEl.off('.curBlock');
  },
  eUpdateAddSuggestionField: function(e) {
    var $fieldEl = $(this);
    if ($fieldEl.data('tr-composing')) return;
    if (e.type == 'focus' || e.type == 'focusin') {
      LangKey.updateAddSuggestionField($fieldEl, true);
    } else if (e.type == 'blur' || e.type == 'focusout') {
      LangKey.updateAddSuggestionField($fieldEl, false);
    } else {
      LangKey.updateAddSuggestionField($fieldEl);
    }
  },
  updateAddSuggestionField: function($fieldEl, focused) {
    var $formGroup = $fieldEl.parents('.form-group');
    var $charsCount = $formGroup.parents('.add-suggestion-form').find('.chars-count');
    if (typeof focused !== 'undefined') {
      $formGroup.toggleClass('add-suggestion-field-focused', focused);
    }
    var def_value_length = +$charsCount.attr('data-length') || 0;
    var value = $fieldEl.value();
    var value_length = value.length;
    var max_value_length = Math.max.apply(null, $('.key-add-suggestion-field').map(function(){ return $(this).value().length; }));
    $formGroup.toggleClass('add-suggestion-field-has-value', value_length > 0);
    $charsCount.text(max_value_length + '/' + def_value_length).toggleClass('excess', max_value_length > def_value_length);
  },
  eUpdateCommentField: function(e) {
    var $fieldEl = $(this);
    if ($fieldEl.data('tr-composing')) return;
    if (e.type == 'focus' || e.type == 'focusin') {
      if (!Aj.needAuth()) {
        LangKey.updateCommentField($fieldEl, true);
      }
    } else if (e.type == 'blur' || e.type == 'focusout') {
      LangKey.updateCommentField($fieldEl, false);
    } else {
      LangKey.updateCommentField($fieldEl);
    }
  },
  updateCommentField: function($fieldEl, focused) {
    var $form = $fieldEl.parents('.comment-form');
    var $formButtons = $('.form-buttons-wrap', $form);
    if (typeof focused !== 'undefined') {
      $form.toggleClass('comment-form-focused', focused);
    }
    $form.toggleClass('comment-form-has-value', !!$fieldEl.val());
    $formButtons.slideToggle(!!$fieldEl.val() || $form.hasClass('comment-form-focused'));
  },
  eHideCommentForm: function(e) {
    e.preventDefault();
    this.form.reset();
    $('.comment-field', this.form).blur();
  },
  eSubmitCommentForm: function(e) {
    e.preventDefault();
    var form = this;
    var $wrap = $(this).parents('.key-suggestion-wrap');
    var $replyWrapEl = $('.comment-form-reply .comment-reply', form);
    var $keyBlock = $(this).parents('.tr-key-full-block');
    var lang = $keyBlock.attr('data-lang');
    var lang_pack = $keyBlock.attr('data-langpack');
    var lang_key = $keyBlock.attr('data-key');
    var section = $keyBlock.attr('data-section');
    var suggestion_id = $wrap.attr('data-suggestion-id');
    var reply_to_id = $replyWrapEl.attr('data-comment-id');
    var requestGuard = LangKey.makeRequestGuard($keyBlock, 'comment\u0001' + suggestion_id + '\u0001' + (reply_to_id || ''));
    Aj.apiRequest('suggestionAddComment', {
      lang: lang,
      lang_pack: lang_pack,
      section: section,
      lang_key: lang_key,
      suggestion_id: suggestion_id,
      reply_to_id: reply_to_id,
      text: form.text.value
    }, function(result) {
      if (!requestGuard()) return;
      if (result.error) {
        return showAlert(result.error);
      }
      $('.comment-form .comment-reply-wrap', $wrap).remove();
      form.reset();
      $('.comment-field', form).blur();
      if (result.comments_html) {
        $('.key-suggestion-counters .key-suggestion-comment', $wrap).text(result.comments || '');
        $('.key-suggestion-comments', $wrap).html(result.comments_html);
      }
    });
    return false;
  },
  eToggleSuggestionForm: function() {
    if ($('.key-add-suggestion-wrap').hasClass('collapsed')) {
      if (!Aj.needAuth()) {
        LangKey.showSuggestionForm();
      }
    } else {
      LangKey.hideSuggestionForm();
    }
  },
  eHideSuggestionForm: function(e) {
    e.preventDefault();
    LangKey.hideSuggestionForm();
  },
  showSuggestionForm: function(no_anim) {
    var $fields = $('.key-add-suggestion-field');
    $fields.each(function() {
      LangKey.updateAddSuggestionField($(this));
    });
    var callback = function() {
      $fields.focusAndSelectAll();
    };
    if (!$('.key-add-suggestion-wrap').hasClass('collapsed')) {
      callback();
      $('.key-add-suggestion-wrap').scrollIntoView({duration: no_anim ? 0 : 200, padding: 15, slidedEl: '.key-add-suggestion-form-wrap'});
      return;
    }
    if (no_anim) {
      $('.key-add-suggestion-wrap').animOff().removeClass('collapsed').animOn();
      callback();
    } else {
      $('.key-add-suggestion-form-wrap').prepareSlideY(callback);
      $('.key-add-suggestion-wrap').removeClass('collapsed');
    }
    $('.key-add-suggestion-wrap').scrollIntoView({duration: no_anim ? 0 : 200, padding: 15, slidedEl: '.key-add-suggestion-form-wrap'});
  },
  hideSuggestionForm: function() {
    var $formWrapEl = $('.key-add-suggestion-form-wrap');
    $formWrapEl.prepareSlideY(function() {
      $('.add-suggestion-form').reset();
    });
    $('.key-add-suggestion-wrap').addClass('collapsed');
  },
  eSubmitSuggestionForm: function(e) {
    e.preventDefault();
    var $form = $(this);
    var $keyBlock = $form.parents('.tr-key-full-block');
    var lang = $keyBlock.attr('data-lang');
    var lang_pack = $keyBlock.attr('data-langpack');
    var lang_key = $keyBlock.attr('data-key');
    var section = $keyBlock.attr('data-section');
    var $wrapEl = $form.parents('.tr-key-row-wrap');
    var requestGuard = LangKey.makeRequestGuard($keyBlock, 'suggestion\u0001' + lang_key);
    var params = {
      lang: lang,
      lang_pack: lang_pack,
      section: section,
      lang_key: lang_key,
      apply: $form.field('apply').value() || 0
    };
    if ($wrapEl.size() > 0 && lang_pack) {
      params.inline = 1;
      if (Aj.state.searchQuery) {
        params.inline_query = Aj.state.searchQuery;
      }
      if (Aj.state.searchWhere) {
        params.inline_where = Aj.state.searchWhere;
      }
    }
    if ($form.hasField('lang_value')) {
      params.lang_value = $form.field('lang_value').value();
    }
    for (var p = 0; p < 6; p++) {
      if ($form.hasField('lang_value' + p)) {
        params['lang_value[' + p + ']'] = $form.field('lang_value' + p).value();
      }
    }
    Aj.apiRequest('addSuggestion', params, function(result) {
      if (!requestGuard()) return;
      if (!result.error) {
        LangKey.hideSuggestionForm();
        if (result.suggestion_html) {
          if (params.apply) {
            $('.key-suggestion-wrap.key-suggestion-applied').removeClass('key-suggestion-applied');
            $('.key-suggestion-wrap.key-suggestion-custom').slideHide('remove');
            $('.key-default-value .tr-value-untranslated').fadeHide();
          }
          if (result.suggestion_id) {
            $('.key-suggestion-wrap[data-suggestion-id="' + result.suggestion_id + '"]').slideHide();
          }
          var $wrap = $(result.suggestion_html).addClass('shide');
          if (params.apply) {
            $wrap.prependTo('.key-suggestions');
          } else {
            $wrap.appendTo('.key-suggestions');
          }
          $wrap.slideShow();
          if (params.apply) {
            Search.clearData(lang, lang_pack);
            LangKey.editSuggestion($wrap, true);
            LangKey.clearHistory($wrap.parents('.tr-key-full-block'));
          }
        }
        if (result.row_html && params.inline) {
          var $newWrapEl = $(result.row_html);
          var $keyRowEl = $('.tr-key-row', $wrapEl).html($('.tr-key-row', $newWrapEl).html());
          if ($keyRowEl.attr('data-langpack') == Aj.state.curLangpack) {
            $('.key-langpack', $keyRowEl).remove();
          }
        }
      } else {
        if (result.suggestion_id) {
          var $sWrapEl;
          LangKey.hideSuggestionForm();
          LangKey.showSuggestion(result.suggestion_id);
        }
        showAlert(result.error);
      }
    });
    return false;
  },
  eToggleSuggestion: function(e) {
    var $wrapEl = $(this).parents('.key-suggestion-wrap');
    LangKey.toggleSuggestion($wrapEl);
  },
  onSuggestionKeyDown: function(e) {
    if (e.target && e.target.tagName === 'BUTTON') return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    LangKey.eToggleSuggestion.call(this, e);
  },
  toggleSuggestion: function($wrapEl, state, no_anim, callback) {
    if ($wrapEl.hasClass('key-suggestion-custom')) {
      return;
    }
    if (typeof state === 'undefined') {
      state = $wrapEl.hasClass('key-suggestion-collapsed');
    }
    var $commentsEl = $('.key-suggestion-comments-wrap', $wrapEl);
    if (no_anim) {
      $wrapEl.animOff().toggleClass('key-suggestion-collapsed', !state).animOn();
      $('.key-suggestion-collapse', $wrapEl).attr('aria-expanded', state ? 'true' : 'false');
      callback && callback();
    } else {
      if ($wrapEl.hasClass('key-suggestion-collapsed') !== !state) {
        $commentsEl.prepareSlideY(callback);
        $wrapEl.toggleClass('key-suggestion-collapsed', !state);
        $('.key-suggestion-collapse', $wrapEl).attr('aria-expanded', state ? 'true' : 'false');
      } else {
        callback && callback();
      }
    }
  },
  showSuggestion: function(suggestion_id, comment_id) {
    comment_id = +comment_id || 0;
    var $wrapEl = null;
    $('.key-suggestion-wrap').each(function() {
      var cur_suggestion_id = $(this).attr('data-suggestion-id') || 0;
      var state = (cur_suggestion_id == suggestion_id);
      LangKey.toggleSuggestion($(this), state, comment_id > 0 || !state);
      if (state) {
        $wrapEl = $(this);
      }
    });
    if ($wrapEl) {
      if (comment_id) {
        var $commentEl = $('.key-suggestion-comment-wrap[data-comment-id="' + comment_id + '"]', $wrapEl);
        var $showAllEl = $('.comments-show-all', $wrapEl);
        if ($commentEl.size()) {
          setTimeout(function() {
            $commentEl.highlight(2000).scrollIntoView({duration: 200, padding: 15, slidedEl: '.key-suggestion-comments-wrap'});
          }, 50);
          return;
        } else if ($showAllEl.size()) {
          $showAllEl.data('highlight-comment', comment_id).trigger('click');
          return;
        }
      }
      setTimeout(function() {
        $wrapEl.highlight(2000).scrollIntoView({duration: 200, padding: 15, slidedEl: '.key-suggestion-comments-wrap'});
      }, 50);
    }
  },
  eCommentSuggestion: function(e) {
    e.stopPropagation();
    e.preventDefault();
    var $wrapEl = $(this).parents('.key-suggestion-wrap');
    LangKey.toggleSuggestion($wrapEl, true, false, function() {
      $('.comment-field', $wrapEl).focus();
    });
  },
  eSubmitDescriptionForm: function(e) {
    e.preventDefault();
    var form = (e.type == 'submit') ? this : this.form;
    form.description.blur();
    if (form.description.defaultValue == form.description.value) {
      return false;
    }
    var $keyBlock = $(form).parents('.tr-key-full-block');
    var lang_pack = $keyBlock.attr('data-langpack');
    var lang_key = $keyBlock.attr('data-key');
    var requestGuard = LangKey.makeRequestGuard($keyBlock, 'description\u0001' + lang_key + '\u0001' + form.description.value);
    Aj.apiRequest('editKeyDescription', {
      lang_pack: lang_pack,
      lang_key: lang_key,
      description: form.description.value
    }, function(result) {
      if (!requestGuard()) return;
      if (result.error) {
        return showAlert(result.error);
      }
      if (typeof result.description !== 'undefined') {
        form.description.defaultValue = form.description.value = result.description;
        autosize.update(form.description);
      }
      form.reset();
    });
    return false;
  },
  eCancelDescriptionForm: function(e) {
    if (e.which == Keys.ESC) {
      e.preventDefault();
      e.stopPropagation();
      this.form.reset();
      this.blur();
    }
  },
  removeLangKey: function(e) {
    var $blockEl = $(this).parents('.tr-key-full-block');
    var lang = $blockEl.attr('data-lang');
    var lang_pack = $blockEl.attr('data-langpack');
    var lang_key = $blockEl.attr('data-key');
    var section = $blockEl.attr('data-section');
    var requestGuard = LangKey.makeRequestGuard($blockEl, 'remove');
    var confirm_text = l('WEB_REMOVE_LANG_KEY_CONFIRM_TEXT', {lang_key: cleanHTML(lang_key)});
    showConfirm(confirm_text, function() {
      Aj.apiRequest('removeLangKey', {
        lang_pack: lang_pack,
        lang: lang,
        section: section,
        lang_key: lang_key
      }, function(result) {
        if (!requestGuard()) return;
        var $wrapEl = $blockEl.parents('.tr-key-row-wrap');
        if ($wrapEl.size()) {
          LangKeys.closeKey($wrapEl);
          $wrapEl.slideHide('remove');
        } else {
          if (result.content_html) {
            LangKey.destroy($('.tr-key-full-block'));
            $('.tr-content').html(result.content_html);
            LangKey.init($('.tr-key-full-block'));
          }
        }
        if (result.error) {
          return showAlert(result.error);
        }
      });
    }, l('WEB_REMOVE_LANG_KEY_CONFIRM_BUTTON'));
  },
  restoreLangKey: function(e) {
    var $blockEl = $(this).parents('.tr-key-full-block');
    var lang = $blockEl.attr('data-lang');
    var lang_pack = $blockEl.attr('data-langpack');
    var lang_key = $blockEl.attr('data-key');
    var section = $blockEl.attr('data-section');
    var requestGuard = LangKey.makeRequestGuard($blockEl, 'restore');
    var confirm_text = l('WEB_RESTORE_LANG_KEY_CONFIRM_TEXT', {lang_key: cleanHTML(lang_key)});
    showConfirm(confirm_text, function() {
      Aj.apiRequest('restoreLangKey', {
        lang_pack: lang_pack,
        lang: lang,
        section: section,
        lang_key: lang_key
      }, function(result) {
        if (!requestGuard()) return;
        if (result.content_html) {
          LangKey.destroy($('.tr-key-full-block'));
          $('.tr-content').html(result.content_html);
          LangKey.init($('.tr-key-full-block'));
        }
        if (result.error) {
          return showAlert(result.error);
        }
      });
    }, l('WEB_RESTORE_LANG_KEY_CONFIRM_BUTTON'));
  },
  markAsImportantLangKey: function() {
    var $blockEl = $(this).parents('.tr-key-full-block');
    LangKey.toggleImportantLangKey($blockEl, true);
  },
  markAsUnimportantLangKey: function() {
    var $blockEl = $(this).parents('.tr-key-full-block');
    LangKey.toggleImportantLangKey($blockEl, false);
  },
  toggleImportantLangKey: function($blockEl, important) {
    var lang = $blockEl.attr('data-lang');
    var lang_pack = $blockEl.attr('data-langpack');
    var lang_key = $blockEl.attr('data-key');
    var section = $blockEl.attr('data-section');
    var params = {
      lang_pack: lang_pack,
      lang: lang,
      section: section,
      lang_key: lang_key,
      important: important ? 1 : 0
    };
    var requestGuard = LangKey.makeRequestGuard($blockEl, 'important\u0001' + (important ? 1 : 0));
    var callback = function(result) {
      if (!requestGuard()) return;
      if (result.confirm_hash) {
        showConfirm(result.confirm_text, function() {
          params.confirm_hash = result.confirm_hash;
          Aj.apiRequest('toggleImportantLangKey', params, callback);
        }, result.confirm_btn);
      } else {
        if (result.content_html) {
          LangKey.destroy($('.tr-key-full-block'));
          $('.tr-content').html(result.content_html);
          LangKey.init($('.tr-key-full-block'));
        }
        if (result.error) {
          return showAlert(result.error);
        }
      }
    };
    Aj.apiRequest('toggleImportantLangKey', params, callback);
  },
  eDeleteSuggestionComment: function(e) {
    var $wrapEl = $(this).parents('.js-suggestion-wrap');
    var $commentEl = $(this).parents('.js-comment-wrap');
    var $keyData = $(this).parents('.js-key-data');
    var lang = $keyData.attr('data-lang');
    var lang_pack = $keyData.attr('data-langpack');
    var lang_key = $keyData.attr('data-key');
    var suggestion_id = $wrapEl.attr('data-suggestion-id');
    var comment_id = $commentEl.attr('data-comment-id');
    var requestGuard = LangKey.makeRequestGuard($keyData, 'delete-comment\u0001' + suggestion_id + '\u0001' + comment_id);
    Aj.apiRequest('suggestionDeleteComment', {
      lang_pack: lang_pack,
      lang: lang,
      lang_key: lang_key,
      suggestion_id: suggestion_id,
      comment_id: comment_id
    }, function(result) {
      if (!requestGuard()) return;
      if (result.ok) {
        $('.key-suggestion-counters .key-suggestion-comment', $wrapEl).text(result.comments || '');
        $commentEl.addClass('comment-deleted');
      }
      if (result.error) {
        return showAlert(result.error);
      }
    });
  },
  eRestoreSuggestionComment: function(e) {
    var $wrapEl = $(this).parents('.js-suggestion-wrap');
    var $commentEl = $(this).parents('.js-comment-wrap');
    var $keyData = $(this).parents('.js-key-data');
    var lang = $keyData.attr('data-lang');
    var lang_pack = $keyData.attr('data-langpack');
    var lang_key = $keyData.attr('data-key');
    var suggestion_id = $wrapEl.attr('data-suggestion-id');
    var comment_id = $commentEl.attr('data-comment-id');
    var requestGuard = LangKey.makeRequestGuard($keyData, 'restore-comment\u0001' + suggestion_id + '\u0001' + comment_id);
    Aj.apiRequest('suggestionRestoreComment', {
      lang_pack: lang_pack,
      lang: lang,
      lang_key: lang_key,
      suggestion_id: suggestion_id,
      comment_id: comment_id
    }, function(result) {
      if (!requestGuard()) return;
      if (result.ok) {
        $('.key-suggestion-counters .key-suggestion-comment', $wrapEl).text(result.comments || '');
        $commentEl.removeClass('comment-deleted');
      }
      if (result.error) {
        return showAlert(result.error);
      }
    });
  },
  eDeleteAllSuggestionComments: function(e) {
    var $curCommentEl = $(this).parents('.js-comment-wrap');
    var $keyData = $(this).parents('.js-key-data');
    var author = $curCommentEl.attr('data-author');
    var requestGuard = LangKey.makeRequestGuard($keyData, 'delete-comments\u0001' + author);
    Aj.apiRequest('suggestionDeleteAllComments', {
      lang: Aj.state.curLang,
      author: author,
      confirm_only: 1
    }, function(result) {
      if (!requestGuard()) return;
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.confirm_text) {
        showConfirm(result.confirm_text, function() {
          Aj.apiRequest('suggestionDeleteAllComments', {
            lang: Aj.state.curLang,
            author: author
          }, function(result) {
            if (!requestGuard()) return;
            if (result.ok) {
              $('.js-comment-wrap').each(function() {
                var $commentEl = $(this);
                var row_author = $commentEl.attr('data-author');
                if (row_author == author) {
                  $commentEl.remove();
                }
              });
            }
            if (result.error) {
              return showAlert(result.error);
            }
          });
        }, result.confirm_btn).find('.popup-primary-btn').addClass('btn-danger btn-default').removeClass('btn-link');
      }
    });
  },
  eReplySuggestionComment: function(e) {
    if (Aj.needAuth()) return false;
    var $replyEl = $('<div class="comment-reply"><button type="button" class="comment-reply-cancel close" aria-label="Cancel reply"></button><div class="comment-head"></div></div>');
    var $replyWrapEl = $('<div class="comment-reply-wrap shide"><div class="comment-form-reply"></div></div>');
    var $wrapEl = $(this).parents('.key-suggestion-wrap');
    var $commentEl = $(this).parents('.key-suggestion-comment-wrap');
    var $authorEl = $('> .comment-head .comment-author', $commentEl).clone();
    var $textEl = $('> .comment-text', $commentEl).clone();
    $('br', $textEl).replaceWith(' ');
    $('.comment-head', $replyEl).append($authorEl);
    $replyEl.append($textEl);
    $replyEl.attr('data-comment-id', $commentEl.attr('data-comment-id'));
    $('.comment-form .comment-reply-wrap', $wrapEl).slideHide('remove');
    $('.comment-form', $wrapEl).prepend($replyWrapEl);
    $('.comment-form-reply', $replyWrapEl).append($replyEl);
    $replyWrapEl.slideShow();
    $('.comment-field', $wrapEl).get(0).focus();
  },
  eCancelReplySuggestionComment: function(e) {
    var $replyWrapEl = $(this).parents('.comment-reply-wrap');
    $replyWrapEl.slideHide('remove');
  },
  eToggleKeySection: function(e) {
    e.preventDefault();
    e.stopPropagation();
    var $button = $(this);
    if ($button.attr('aria-busy') === 'true') return;
    var section = $button.attr('data-section');
    var $keyBlock = $button.parents('.tr-key-full-block');
    var lang = $keyBlock.attr('data-lang');
    var lang_pack = $keyBlock.attr('data-langpack');
    var lang_key = $keyBlock.attr('data-key');
    var method = $button.parents('li').hasClass('selected') ? 'removeKeyFromSection' : 'addKeyToSection';
    var requestGuard = LangKey.makeRequestGuard($keyBlock, 'section\u0001' + section + '\u0001' + method);
    $button.attr('aria-busy', 'true').prop('disabled', true);
    Aj.apiRequest(method, {
      lang_pack: lang_pack,
      lang: lang,
      section: section,
      lang_key: lang_key
    }, function(result) {
      if (!requestGuard()) return;
      $button.removeAttr('aria-busy').prop('disabled', false);
      if (result.error) return showAlert(result.error);
      if (result.sections_html) {
        $('.key-default-sections').html(result.sections_html);
      }
    });
  },
  eLikeSuggestion: function(state, e) {
    e.stopPropagation();
    e.preventDefault();
    if (Aj.needAuth()) return false;
    var $wrap = $(this).parents('.key-suggestion-wrap');
    var $counters = $('.key-suggestion-counters', $wrap);
    var $keyBlock = $(this).parents('.tr-key-full-block');
    var lang = $keyBlock.attr('data-lang');
    var lang_pack = $keyBlock.attr('data-langpack');
    var lang_key = $keyBlock.attr('data-key');
    var section = $keyBlock.attr('data-section');
    var suggestion_id = $wrap.attr('data-suggestion-id');
    var previous = {
      likes: +$('.key-suggestion-like', $counters).text() || 0,
      dislikes: +$('.key-suggestion-dislike', $counters).text() || 0,
      state: $counters.hasClass('liked') ? 'liked' : ($counters.hasClass('disliked') ? 'disliked' : '')
    };
    var voteGeneration = ($wrap.data('vote-generation') || 0) + 1;
    $wrap.data('vote-generation', voteGeneration);
    $counters.attr('aria-busy', 'true');
    var likes = {
      likes: previous.likes,
      dislikes: previous.dislikes,
      state: state
    };
    var requestGuard = LangKey.makeRequestGuard($keyBlock, 'like\u0001' + suggestion_id + '\u0001' + state);
    var method;
    if (state == 'liked') {
      if ($counters.hasClass('liked')) {
        method = 'unlikeSuggestion';
        likes.state = '';
        likes.likes--;
      } else {
        if ($counters.hasClass('disliked')) {
          likes.dislikes--;
        }
        method = 'likeSuggestion';
        likes.likes++;
      }
    } else {
      if ($counters.hasClass('disliked')) {
        method = 'unlikeSuggestion';
        likes.state = '';
        likes.dislikes--;
      } else {
        if ($counters.hasClass('liked')) {
          likes.likes--;
        }
        method = 'dislikeSuggestion';
        likes.dislikes++;
      }
    }
    Aj.apiRequest(method, {
      lang: lang,
      lang_pack: lang_pack,
      section: section,
      lang_key: lang_key,
      suggestion_id: suggestion_id
    }, function(result) {
      if (!requestGuard() || $wrap.data('vote-generation') !== voteGeneration) return;
      $counters.removeAttr('aria-busy');
      if (result.error) {
        LangKey.updateSuggestionLikes($counters, previous);
        return showAlert(result.error);
      }
      LangKey.updateSuggestionLikes($counters, result);
    });
    LangKey.updateSuggestionLikes($counters, likes);
    return false;
  },
  updateSuggestionLikes: function($counters, likes) {
    $('.key-suggestion-like', $counters).text(likes.likes || '');
    $('.key-suggestion-dislike', $counters).text(likes.dislikes || '');
    $counters.removeClass('liked').removeClass('disliked');
    if (likes.state) {
      $counters.addClass(likes.state);
    }
    $('.key-suggestion-like', $counters).attr('aria-pressed', likes.state === 'liked' ? 'true' : 'false');
    $('.key-suggestion-dislike', $counters).attr('aria-pressed', likes.state === 'disliked' ? 'true' : 'false');
    var likes_score = likes.likes - likes.dislikes;
    $counters.parents('.key-suggestion-wrap').toggleClass('key-suggestion-disliked', likes_score < -1 || likes.likes && likes_score < 0);
  },
  eEditSuggestion: function(e) {
    e.preventDefault();
    if (!Aj.needAuth()) {
      var $wrap = $(this).parents('.key-suggestion-wrap');
      LangKey.editSuggestion($wrap);
      LangKey.showSuggestionForm();
    }
    return false;
  },
  editSuggestion: function($wrap, set_default) {
    var $valueEl = $('.key-suggestion-value', $wrap);
    var $form = $('.add-suggestion-form');
    if ($form.hasField('lang_value')) {
      var value = $('.value[data-value]', $valueEl).attr('data-value');
      if (set_default) {
        $form.field('lang_value').defaultValue(value);
      } else {
        $form.field('lang_value').value(value);
      }
    }
    for (var p = 0; p < 6; p++) {
      if ($form.hasField('lang_value' + p)) {
        var value = $('.value[data-p="' + p + '"]', $valueEl).attr('data-value');
        if (set_default) {
          $form.field('lang_value' + p).defaultValue(value);
        } else {
          $form.field('lang_value' + p).value(value);
        }
      }
    }
  },
  eApplySuggestion: function(e) {
    e.preventDefault();
    var $wrap = $(this).parents('.key-suggestion-wrap');
    var $wrapEl = $(this).parents('.tr-key-row-wrap');
    var $keyBlock = $(this).parents('.tr-key-full-block');
    var lang = $keyBlock.attr('data-lang');
    var lang_pack = $keyBlock.attr('data-langpack');
    var section = $keyBlock.attr('data-section');
    var lang_key = $keyBlock.attr('data-key');
    var suggestion_id = $wrap.attr('data-suggestion-id');
    var requestGeneration = TrResponsiveLifecycle.generation;
    var requestKey = [lang, lang_pack, section, lang_key, suggestion_id].join('/');
    var params = {
      lang: lang,
      lang_pack: lang_pack,
      section: section,
      lang_key: lang_key,
      suggestion_id: suggestion_id
    };
    if ($wrapEl.size() > 0 && lang_pack) {
      params.inline = 1;
      if (Aj.state.searchQuery) {
        params.inline_query = Aj.state.searchQuery;
      }
      if (Aj.state.searchWhere) {
        params.inline_where = Aj.state.searchWhere;
      }
    }
    Aj.apiRequest('suggestionApply', params, function(result) {
      if (!TrResponsiveLifecycle.isCurrent(requestGeneration) || !$wrap.closest('html').length ||
          [$keyBlock.attr('data-lang'), $keyBlock.attr('data-langpack'), $keyBlock.attr('data-section'),
           $keyBlock.attr('data-key'), $wrap.attr('data-suggestion-id')].join('/') !== requestKey) return;
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.ok) {
        Search.clearData(lang, lang_pack);
        LangKey.editSuggestion($wrap, true);
        LangKey.clearHistory($wrap.parents('.tr-key-full-block'));
        $('.key-suggestion-wrap.key-suggestion-applied', $keyBlock).removeClass('key-suggestion-applied');
        $('.key-suggestion-wrap.key-suggestion-custom', $keyBlock).slideHide('remove');
        $wrap.clone().addClass('key-suggestion-applied shide').prependTo($('.key-suggestions', $keyBlock)).slideShow();
        $('.key-default-value .tr-value-untranslated', $keyBlock).fadeHide();
        $wrap.slideHide('remove');
        if (result.row_html && params.inline) {
          var $newWrapEl = $(result.row_html);
          var $keyRowEl = $('.tr-key-row', $wrapEl).html($('.tr-key-row', $newWrapEl).html());
          if ($keyRowEl.attr('data-langpack') == Aj.state.curLangpack) {
            $('.key-langpack', $keyRowEl).remove();
          }
        }
      }
    });
    return false;
  },
  eMarkAsTranslated: function(e) {
    e.stopPropagation();
    e.preventDefault();
    var $wrapEl = $(this).parents('.tr-key-row-wrap');
    var $keyBlock = $(this).parents('.tr-key-full-block');
    var lang = $keyBlock.attr('data-lang');
    var lang_pack = $keyBlock.attr('data-langpack');
    var section = $keyBlock.attr('data-section');
    var lang_key = $keyBlock.attr('data-key');
    var requestGuard = LangKey.makeRequestGuard($keyBlock, 'translated');
    var confirm_text = l('WEB_MARK_AS_TRANSLATED_CONFIRM_TEXT', {lang_key: cleanHTML(lang_key)});
    showConfirm(confirm_text, function() {
      Aj.apiRequest('markAsTranslated', {
        lang: lang,
        lang_pack: lang_pack,
        section: section,
        lang_key: lang_key
      }, function(result) {
        if (!requestGuard()) return;
        if (result.error) {
          return showAlert(result.error);
        }
        if (result.ok) {
          $('.key-default-value .tr-value-untranslated').fadeHide();
          $('.tr-key-row  .tr-value-untranslated', $wrapEl).remove();
        }
      });
    }, l('WEB_MARK_AS_TRANSLATED_CONFIRM_BUTTON'));
    return false;
  },
  eDeleteSuggestion: function(e) {
    e.preventDefault();
    var $wrap = $(this).parents('.js-suggestion-wrap');
    var $wrapEl = $(this).parents('.tr-key-row-wrap');
    var $keyData = $(this).parents('.js-key-data');
    var lang = $keyData.attr('data-lang');
    var lang_pack = $keyData.attr('data-langpack');
    var section = $keyData.attr('data-section');
    var lang_key = $keyData.attr('data-key');
    var suggestion_id = $wrap.attr('data-suggestion-id');
    var requestGuard = LangKey.makeRequestGuard($keyData, 'delete-suggestion\u0001' + suggestion_id);
    var params = {
      lang: lang,
      lang_pack: lang_pack,
      section: section,
      lang_key: lang_key,
      suggestion_id: suggestion_id
    };
    if ($wrapEl.size() > 0 && lang_pack) {
      params.inline = 1;
      if (Aj.state.searchQuery) {
        params.inline_query = Aj.state.searchQuery;
      }
      if (Aj.state.searchWhere) {
        params.inline_where = Aj.state.searchWhere;
      }
    }
    Aj.apiRequest('suggestionDelete', params, function(result) {
      if (!requestGuard()) return;
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.ok) {
        LangKey.toggleSuggestion($wrap, false);
        $wrap.addClass('key-suggestion-deleted');
        if (result.row_html && params.inline) {
          var $newWrapEl = $(result.row_html);
          var $keyRowEl = $('.tr-key-row', $wrapEl).html($('.tr-key-row', $newWrapEl).html());
          if ($keyRowEl.attr('data-langpack') == Aj.state.curLangpack) {
            $('.key-langpack', $keyRowEl).remove();
          }
        }
      }
    });
    return false;
  },
  eRestoreSuggestion: function(e) {
    e.preventDefault();
    var $wrap = $(this).parents('.js-suggestion-wrap');
    var $wrapEl = $(this).parents('.tr-key-row-wrap');
    var $keyData = $(this).parents('.js-key-data');
    var lang = $keyData.attr('data-lang');
    var lang_pack = $keyData.attr('data-langpack');
    var section = $keyData.attr('data-section');
    var lang_key = $keyData.attr('data-key');
    var suggestion_id = $wrap.attr('data-suggestion-id');
    var requestGuard = LangKey.makeRequestGuard($keyData, 'restore-suggestion\u0001' + suggestion_id);
    var params = {
      lang: lang,
      lang_pack: lang_pack,
      section: section,
      lang_key: lang_key,
      suggestion_id: suggestion_id
    };
    if ($wrapEl.size() > 0 && lang_pack) {
      params.inline = 1;
      if (Aj.state.searchQuery) {
        params.inline_query = Aj.state.searchQuery;
      }
      if (Aj.state.searchWhere) {
        params.inline_where = Aj.state.searchWhere;
      }
    }
    Aj.apiRequest('suggestionRestore', params, function(result) {
      if (!requestGuard()) return;
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.ok) {
        $wrap.removeClass('key-suggestion-deleted');
        if (result.row_html && params.inline) {
          var $newWrapEl = $(result.row_html);
          var $keyRowEl = $('.tr-key-row', $wrapEl).html($('.tr-key-row', $newWrapEl).html());
          if ($keyRowEl.attr('data-langpack') == Aj.state.curLangpack) {
            $('.key-langpack', $keyRowEl).remove();
          }
        }
      }
    });
    return false;
  },
  eDeleteAllSuggestions: function(e) {
    e.preventDefault();
    var $curWrap = $(this).parents('.js-suggestion-wrap');
    var $keyData = $(this).parents('.js-key-data');
    var author = $curWrap.attr('data-author');
    var requestGuard = LangKey.makeRequestGuard($keyData, 'delete-suggestions\u0001' + author);
    Aj.apiRequest('suggestionDeleteAll', {
      lang: Aj.state.curLang,
      author: author,
      confirm_only: 1
    }, function(result) {
      if (!requestGuard()) return;
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.confirm_text) {
        showConfirm(result.confirm_text, function() {
          Aj.apiRequest('suggestionDeleteAll', {
            lang: Aj.state.curLang,
            author: author
          }, function(result) {
            if (!requestGuard()) return;
            if (result.ok) {
              $('.js-suggestion-wrap').each(function() {
                var $wrap = $(this);
                var row_author = $wrap.attr('data-author');
                if (row_author == author) {
                  $wrap.remove();
                }
              });
            }
            if (result.error) {
              return showAlert(result.error);
            }
          });
        }, result.confirm_btn).find('.popup-primary-btn').addClass('btn-danger btn-default').removeClass('btn-link');
      }
    });
  },
  eShowAllSuggestionComments: function(e) {
    e.preventDefault();
    e.stopPropagation();
    var form = this;
    var $wrap = $(this).parents('.key-suggestion-wrap');
    var $keyBlock = $(this).parents('.tr-key-full-block');
    var lang = $keyBlock.attr('data-lang');
    var lang_pack = $keyBlock.attr('data-langpack');
    var section = $keyBlock.attr('data-section');
    var lang_key = $keyBlock.attr('data-key');
    var suggestion_id = $wrap.attr('data-suggestion-id');
    var comment_id = $(this).data('highlight-comment');
    var requestGeneration = TrResponsiveLifecycle.generation;
    var requestKey = [lang, lang_pack, section, lang_key, suggestion_id].join('/');
    if (comment_id) {
      $(this).data('highlight-comment', 0);
    }
    Aj.apiRequest('suggestionGetComments', {
      lang: lang,
      lang_pack: lang_pack,
      section: section,
      lang_key: lang_key,
      suggestion_id: suggestion_id
    }, function(result) {
      if (!TrResponsiveLifecycle.isCurrent(requestGeneration) || !$wrap.closest('html').length ||
          [ $keyBlock.attr('data-lang'), $keyBlock.attr('data-langpack'), $keyBlock.attr('data-section'),
            $keyBlock.attr('data-key'), $wrap.attr('data-suggestion-id') ].join('/') !== requestKey) return;
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.comments_html) {
        $('.key-suggestion-counters .key-suggestion-comment', $wrap).text(result.comments || '');
        var $comments = $('.key-suggestion-comments', $wrap);
        var height = $comments.height(), scrollTop = $(window).scrollTop();
        $('.key-suggestion-comments', $wrap).html(result.comments_html);
        $(window).scrollTop(scrollTop + $comments.height() - height);
        if (comment_id) {
          var $commentEl = $('.key-suggestion-comment-wrap[data-comment-id="' + comment_id + '"]', $wrap);
          if ($commentEl.size()) {
            setTimeout(function() {
              $commentEl.highlight(2000).scrollIntoView({duration: 200, padding: 15});
            }, 50);
          }
        }
      }
    });
    return false;
  },
  clearHistory: function($keyBlock) {
    var $history = $('.key-history', $keyBlock);
    if (!$history.isSlideHidden()) {
      $history.slideHide('remove');
    } else {
      $history.remove();
    }
  },
  eToggleHistory: function(e) {
    if ($(e.target).closest('form.key-description-form,a,.diff-btn').size()) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    var $defaultEl = $(this);
    var $toggle = $('.key-default-toggle', $defaultEl);
    var setHistoryState = function(expanded) {
      $toggle.attr({
        'aria-expanded': expanded ? 'true' : 'false',
        'aria-label': expanded ? 'Hide history' : 'Show history'
      });
    };
    var $keyBlock = $defaultEl.parents('.tr-key-full-block');
    var $historyWrapEL = $('.key-history-wrap', $keyBlock);
    var $history = $('.key-history', $historyWrapEL);
    if ($history.size()) {
      var expanded = !$history.is(':visible');
      $history.slideToggle();
      setHistoryState(expanded);
    } else {
      if ($historyWrapEL.data('loading')) {
        return;
      }
      $historyWrapEL.html('<div class="key-history"><div class="tr-key-history-row"><div class="tr-key-history-row-loading dots-animated">' + l('WEB_TRANSLATIONS_LOADING') + '</div></div></div>');
      $('.key-history', $historyWrapEL).addClass('shide').slideShow();
      $historyWrapEL.data('loading', true);
      setHistoryState(true);
      var lang = $keyBlock.attr('data-lang');
      var lang_pack = $keyBlock.attr('data-langpack');
      var lang_key = $keyBlock.attr('data-key');
      var requestGeneration = TrResponsiveLifecycle.generation;
      var requestKey = [lang, lang_pack, lang_key].join('/');
      Aj.apiRequest('getKeyHistory', {
        lang: lang,
        lang_pack: lang_pack,
        lang_key: lang_key
      }, function(result) {
        if (!TrResponsiveLifecycle.isCurrent(requestGeneration) ||
            !$keyBlock.closest('html').length ||
            [$keyBlock.attr('data-lang'), $keyBlock.attr('data-langpack'), $keyBlock.attr('data-key')].join('/') !== requestKey) return;
        $historyWrapEL.data('loading', false);
        if (result.error) {
          $historyWrapEL.empty();
          setHistoryState(false);
          return showAlert(result.error);
        }
        if (result.history_html) {
          $historyWrapEL.html(result.history_html);
        }
      });
    }
    return false;
  },
  eToggleUsage: function(e) {
    if ($(e.target).closest('a').size()) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    var $usageEl = $(this);
    var $keyBlock = $usageEl.parents('.tr-key-full-block');
    var $linesWrapEL = $('.key-usage-lines-wrap', $keyBlock);
    var $releasesWrapEL = $('.app-releases', $keyBlock);
    var expanded = !$linesWrapEL.is(':visible');
    $linesWrapEL.slideToggle();
    $releasesWrapEL.toggleClass('open');
    $usageEl.attr('aria-expanded', expanded ? 'true' : 'false');
    return false;
  },
  eBindingOpen: function(e) {
    if (e.metaKey || e.ctrlKey) return true;
    var $wrapEl = $(this).parents('.tr-key-row-wrap');
    if ($(this).hasClass('binding-item-current')) {
      if (!$wrapEl.size()) return;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    var lang_pack = $(this).attr('data-langpack');
    var lang_key = $(this).attr('data-key');
    if (lang_key) {
      if (!$wrapEl.size()) return;
      var section = $(this).parents('.tr-key-full-block').attr('data-section');
      LangKeys.openKey($wrapEl, 0, lang_pack, lang_key, section);
    } else {
      var $bindingsEl = $(this).parents('.binding-items');
      var bind_lang_pack = $bindingsEl.attr('data-langpack');
      var bind_lang_key = $bindingsEl.attr('data-key');
      var search_value = $bindingsEl.attr('data-value');
      lang_key = $(this).parents('.tr-key-full-block').attr('data-key');
      if (lang_key) {
        var cur_lang_key = $('.tr-key-row', $wrapEl).attr('data-key') || lang_key;
        Search.bindingModeOn($wrapEl, bind_lang_pack + '/' + bind_lang_key, lang_pack, search_value);
      }
    }
    e.preventDefault();
    e.stopPropagation();
  },
  eBindKey: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    var $keyBlock = $(this).parents('.tr-key-full-block');
    var lang = $keyBlock.attr('data-lang');
    var lang_pack = $keyBlock.attr('data-langpack');
    var section = $keyBlock.attr('data-section');
    var lang_key = $keyBlock.attr('data-key');
    var $bindingsEl = $(this).parents('.binding-items');
    var bind_lang_pack = $bindingsEl.attr('data-langpack');
    var bind_lang_key = $bindingsEl.attr('data-key');
    var requestGeneration = TrResponsiveLifecycle.generation;
    var requestKey = [lang, lang_pack, section, lang_key, bind_lang_pack, bind_lang_key].join('/');
    if (lang_key && bind_lang_key) {
      Aj.apiRequest('bindKeys', {
        lang_pack: lang_pack,
        lang: lang,
        section: section,
        lang_key: lang_key,
        lang_pack2: bind_lang_pack,
        lang_key2: bind_lang_key
      }, function(result) {
        if (!TrResponsiveLifecycle.isCurrent(requestGeneration) || !$keyBlock.closest('html').length ||
            [$keyBlock.attr('data-lang'), $keyBlock.attr('data-langpack'), $keyBlock.attr('data-section'),
             $keyBlock.attr('data-key'), $bindingsEl.attr('data-langpack'), $bindingsEl.attr('data-key')].join('/') !== requestKey) return;
        if (result.error) {
          return showAlert(result.error);
        }
        if (result.bindings_html) {
          var $oldBindings = $('.binding-items', $keyBlock);
          $(result.bindings_html).insertAfter($oldBindings);
          $oldBindings.remove();
        }
      });
    }
  },
  eUnbindKey: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    var $keyBlock = $(this).parents('.tr-key-full-block');
    var lang = $keyBlock.attr('data-lang');
    var lang_pack = $keyBlock.attr('data-langpack');
    var section = $keyBlock.attr('data-section');
    var lang_key = $keyBlock.attr('data-key');
    var $bindingsEl = $(this).parents('.binding-items');
    var bind_lang_pack = $bindingsEl.attr('data-langpack');
    var bind_lang_key = $bindingsEl.attr('data-key');
    var requestGeneration = TrResponsiveLifecycle.generation;
    var requestKey = [lang, lang_pack, section, lang_key, bind_lang_pack, bind_lang_key].join('/');
    Aj.apiRequest('unbindKey', {
      lang_pack: lang_pack,
      lang: lang,
      section: section,
      lang_key: lang_key,
      lang_pack2: bind_lang_pack,
      lang_key2: bind_lang_key
    }, function(result) {
      if (!TrResponsiveLifecycle.isCurrent(requestGeneration) || !$keyBlock.closest('html').length ||
          [$keyBlock.attr('data-lang'), $keyBlock.attr('data-langpack'), $keyBlock.attr('data-section'),
           $keyBlock.attr('data-key'), $bindingsEl.attr('data-langpack'), $bindingsEl.attr('data-key')].join('/') !== requestKey) return;
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.bindings_html) {
        var $oldBindings = $('.binding-items', $keyBlock);
        $(result.bindings_html).insertAfter($oldBindings);
        $oldBindings.remove();
      }
    });
  },
  eToggleDiff: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    var $diffWrap = $(this).parents('.diff-wrap');
    if ($diffWrap.hasClass('show-diff')) {
      $diffWrap.removeClass('show-diff').addClass('show-diff-full');
    } else if ($diffWrap.hasClass('show-diff-full')) {
      $diffWrap.removeClass('show-diff-full');
    } else {
      $diffWrap.addClass('show-diff');
    }
  }
};

var LangKeys = {
  requestGeneration: 0,
  init: function() {
    $('.tr-content').on('change.curPage', '.tr-key-row input.file-upload', Screenshots.eUpload);
    $('.tr-content').on('click.curPage', '.tr-key-row input.file-upload', stopImmediatePropagation);
    $('.tr-content').on('click.curPage', '.tr-key-row[data-href]', LangKeys.eOpenKey);
    $('.tr-content').on('keydown.curPage', '.tr-key-row[data-href]', function(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if ($(e.target).closest('a,button,input,select,textarea,[contenteditable="true"]').length) return;
      e.preventDefault();
      LangKeys.eOpenKey.call(this, e);
    });
    LoadMore.init();
  },
  destroy: function() {
    LangKeys.requestGeneration++;
    $('.tr-content').off('.curPage');
  },
  eOpenKey: function(e) {
    if (e.metaKey || e.ctrlKey) return true;
    var $linkEl = $(e.target).closest('a.tr-value-link');
    if (!$linkEl.size() && $(e.target).closest('.tr-value-photo, a').size()) {
      return;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
    var $wrapEl = $(this).parents('.tr-key-row-wrap'),
        suggestion_id = $linkEl.attr('data-suggestion-id') || 0;
    LangKeys.openKey($wrapEl, suggestion_id);
  },
  openKey: function($wrapEl, suggestion_id, lang_pack, lang_key, section) {
    if (!$wrapEl.size()) return;
    var $rowEl = $('.tr-key-row', $wrapEl);
    var cur_lang = $rowEl.data('lang') || Aj.state.curLang;
    var cur_langpack = $rowEl.data('langpack');
    var cur_lang_key = $rowEl.data('key');
    var cur_section = $rowEl.data('section');
    var bind = '';
    if (lang_pack && cur_langpack != lang_pack &&
        lang_key && cur_lang_key != lang_key) {
      bind = cur_langpack + '/' + cur_lang_key;
    }
    if (!lang_pack) {
      lang_pack = cur_langpack;
    }
    if (!lang_key) {
      lang_key = cur_lang_key;
    }
    if (!section) {
      section = cur_section;
    }
    var routeGeneration = TrResponsiveLifecycle.generation;
    var routeHref = Aj.location().href;
    var openGeneration = ++LangKeys.requestGeneration;
    var wrapEl = $wrapEl[0];
    var rowEl = $rowEl[0];
    $('.tr-content').addClass('open');
    $(document).off('click.curPage', LangKeys.eCloseKeyOutside);
    $(document).off('keydown.curPage', LangKeys.onKeyDown);
    $(document).on('click.curPage', LangKeys.eCloseKeyOutside);
    $(document).on('keydown.curPage', LangKeys.onKeyDown);
    Aj.apiRequest('getKeyRowFull', {
      lang_pack: lang_pack,
      lang: cur_lang,
      section: section,
      lang_key: lang_key,
      bind: bind
    }, function(result) {
      if (openGeneration !== LangKeys.requestGeneration ||
          !TrResponsiveLifecycle.isCurrent(routeGeneration) || Aj.location().href !== routeHref ||
          !wrapEl || !rowEl || !document.documentElement.contains(wrapEl) ||
          !$.contains(wrapEl, rowEl)) {
        return;
      }
      if (!$('.tr-content').hasClass('open')) {
        return;
      }
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.row_html) {
        var $openedWrapEl = $('.tr-key-row-wrap.open');
        if ($openedWrapEl.size()) {
          var top = $wrapEl.offset().top - $(window).scrollTop();
          LangKeys.closeKey($openedWrapEl, true);
          var scrollTop = $wrapEl.offset().top - top - 1;
          $(window).scrollTop(scrollTop);
        }
        var $blockEl = $(result.row_html);
        if (!Aj.state.multiLang) {
          $('.tr-header-lang', $blockEl).remove();
        }
        if ($blockEl.attr('data-langpack') == Aj.state.curLangpack) {
          $('.tr-header-langpack', $blockEl).remove();
        }
        $rowEl.hide();
        $wrapEl.animOff().append($blockEl).addClass('open').animOn();
        LangKey.init($blockEl);
        var scrollTop = $wrapEl.offset().top - $('header').height() + 1;
        scrollTop -= 15;
        $('html').animate({scrollTop: scrollTop}, 200, function() {
          if (!$('.key-suggestion-wrap').size()) {
            if (!Aj.unauth) {
              LangKey.showSuggestionForm(true);
            }
          } else if (suggestion_id) {
            LangKey.showSuggestion(suggestion_id);
          }
        });
        $(window).trigger('scroll');
      }
    });
  },
  onKeyDown: function(e) {
    if ((e.which == Keys.UP || e.which == Keys.DOWN) &&
        !e.metaKey && !e.ctrlKey &&
        $(e.target).closest('input, textarea, .input').size()) {
      return;
    }
    var $openedWrapEl = $('.tr-key-row-wrap.open');
    switch (e.which) {
      case Keys.ESC:
        LangKeys.closeKey($openedWrapEl);
        break;
      case Keys.UP:
        LangKeys.openKey($openedWrapEl.prev('.tr-key-row-wrap'));
        break;
      case Keys.DOWN:
        LangKeys.openKey($openedWrapEl.next('.tr-key-row-wrap'));
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  },
  eCloseKeyOutside: function(e) {
    if ($(e.target).closest('.tr-key-row-wrap,header .container,.popup-container').size()) {
      return;
    }
    if ($('.tr-content').hasClass('open')) {
      LangKeys.closeKey($('.tr-key-row-wrap.open'));
    }
  },
  eCloseKey: function(e) {
    var $wrapEl = $(this).parents('.tr-key-row-wrap');
    LangKeys.closeKey($wrapEl);
  },
  closeKey: function($wrapEl, reopen, callback) {
    if (!reopen) {
      LangKeys.requestGeneration++;
      $(document).off('click.curPage', LangKeys.eCloseKeyOutside);
      $(document).off('keydown.curPage', LangKeys.onKeyDown);
    }
    var $rowEl = $('.tr-key-row', $wrapEl);
    var $blockEl = $('.tr-key-full-block', $wrapEl);
    LangKey.destroy($blockEl);
    $rowEl.show();
    $blockEl.remove();
    $wrapEl.animOff().removeClass('open').animOn();
    if (!reopen) {
      $('.tr-content').removeClass('open');
    }
  },
  groupKeyRows: function($rows) {
    var key_rows = {}, langs = [], lang_packs = [];
    if (!Aj.state.curLangpack) {
      var lang = Aj.state.curLang, lang_pack;
      key_rows[lang] = {}; langs = [lang];
      $rows.each(function() {
        if (lang_pack = $(this).attr('data-langpack')) {
          if (!key_rows[lang][lang_pack]) {
            key_rows[lang][lang_pack] = [];
            lang_packs.push(lang_pack);
          }
          key_rows[lang][lang_pack].push(this);
        }
      });
    } else if (!Aj.state.curLang) {
      var lang, lang_pack = Aj.state.curLangpack;
      lang_packs = [lang_pack];
      $rows.each(function() {
        if (lang = $(this).attr('data-lang')) {
          if (!key_rows[lang]) {
            key_rows[lang] = {};
            langs.push(lang);
            key_rows[lang][lang_pack] = [];
          }
          key_rows[lang][lang_pack].push(this);
        }
      });
    } else {
      var lang = Aj.state.curLang, lang_pack = Aj.state.curLangpack;
      key_rows[lang] = {};
      langs = [lang]; lang_packs = [lang_pack];
      key_rows[lang][lang_pack] = $rows.map(function() {
        return this;
      }).get();
    }
    var grouped_rows = [];
    $.each(langs, function(i, lang) {
      $.each(lang_packs, function(i, lang_pack) {
        var $rows = $(key_rows[lang][lang_pack]);
        grouped_rows.push({
          lang: lang,
          lang_pack: lang_pack,
          $rows: $rows
        });
      });
    });
    return grouped_rows;
  }
};

var Share = {
  registered: false,
  generation: 0,
  init: function() {
    if (Share.registered) return;
    Share.registered = true;
    Aj.onLoad(function(state) {
      Share.generation++;
      $(document).off('.tr-share').on('click.tr-share', '.tr-share-link-copy', Share.copyLink).on('click.tr-share', '.tr-share-link', Share.selectLink);
    });
    Aj.onUnload(function() { Share.generation++; $(document).off('.tr-share'); });
  },
  selectLink: function() {
    $('.tr-share-link').focus().select();
  },
  copyLink: function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    Share.selectLink();
    var input = $('.tr-share-link').get(0), value = input ? input.value : '';
    var generation = Share.generation;
    var done = function(ok) {
      if (generation !== Share.generation || !input || !document.documentElement.contains(input)) return;
      var $status = $('.tr-share-link-copied');
      if (ok) {
        $('.tr-share-link-copy').fadeHide();
        $status.text($status.data('copied-text') || $status.text()).attr('data-state', 'copied').fadeShow();
      } else {
        input.focus();
        input.select();
        $status.text($status.data('failed-text') || 'Copy failed — press Ctrl/Cmd+C to copy').attr('data-state', 'failed').fadeShow();
      }
      $status.attr('role', 'status');
      if (ok) setTimeout(function() { if (generation === Share.generation) { $('.tr-share-link-copy').fadeShow(); $status.fadeHide(); } }, 2000);
    };
    if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function() { done(true); }, function() { done(false); });
    } else {
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      done(ok);
    }
  },
  initStartLink: function() {
    Aj.onLoad(function(state) {
      $('.tr-lang-intro-link a').on('click', function(e) {
        document.location = this.href;
        e.preventDefault();
      });
    });
    Aj.onUnload(function(state) {
      $('.tr-lang-intro-link a').off('click');
    });
  }
};

/* Documentation anchors clear the fixed header. */
var TrDocs = {
  registered: false,
  init: function() {
    TrDocs.prepareAnchors();
    if (TrDocs.registered || !window.Aj) return;
    TrDocs.registered = true;
    Aj.onLoad(function() {
      TrDocs.prepareAnchors();
    });
  },
  prepareAnchors: function() {
    var header = document.querySelector('header'), height = header ? header.getBoundingClientRect().height : 56;
    $('.tr-docs-content a.anchor').css('scroll-margin-top', (height + 16) + 'px');
    $('.tr-docs-content [id]').css('scroll-margin-top', (height + 16) + 'px');
  }
};

var TrA11y = {
  labels: {
    '.key-suggestion-collapse': 'Expand suggestion',
    '.diff-btn': 'Show translation changes'
  },
  init: function() {
    Aj.onLoad(function() {
      $.each(TrA11y.labels, function(selector, label) {
        $(selector).each(function() {
          var $el = $(this);
          if (!$el.is('button,a,input,select,textarea') && !$el.attr('role')) $el.attr({'role': 'button', 'tabindex': '0'});
          if (!$el.attr('aria-label')) $el.attr('aria-label', label);
        });
      });
      $(document).off('keydown.tr-a11y').on('keydown.tr-a11y', '[role="button"][tabindex="0"]', function(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if ($(e.target).is('a,button,input,select,textarea')) return;
        e.preventDefault();
        this.click();
      });
    });
    Aj.onUnload(function() { $(document).off('.tr-a11y'); });
  }
};
TrInitAfterAj(function() { TrA11y.init(); });

var UnreleasedKeys = {
  registered: false,
  init: function() {
    if (UnreleasedKeys.registered) return;
    UnreleasedKeys.registered = true;
    Aj.onLoad(function(state) {
      var $rows = $('.tr-unreleased-keys');
      $(document).off('click.tr-unreleased keydown.tr-unreleased');
      if (!$rows.length) return;
      $(document)
        .on('click.tr-unreleased', '.tr-unreleased-keys .tr-plain-key-row', UnreleasedKeys.toggleRow)
        .on('click.tr-unreleased', '.tr-unreleased-keys .tr-row-select', UnreleasedKeys.toggleControl)
        .on('click.tr-unreleased', '.tr-unreleased-header .push-selected-btn', UnreleasedKeys.pushSelected)
        .on('click.tr-unreleased', '.tr-unreleased-header .push-btn', UnreleasedKeys.pushAll);
    });
    Aj.onUnload(function() { $(document).off('.tr-unreleased'); });
  },
  toggleRow: function(e) {
    if ($(e.target).closest('a,button,input,select,textarea').length) return;
    e.preventDefault();
    UnreleasedKeys.setSelected($(this));
    UnreleasedKeys.updateButtonsState();
  },
  toggleControl: function(e) {
    e.preventDefault();
    e.stopPropagation();
    var $row = $(this).closest('.tr-plain-key-row');
    UnreleasedKeys.setSelected($row);
    UnreleasedKeys.updateButtonsState();
  },
  setSelected: function($row, selected) {
    if (typeof selected === 'undefined') selected = !$row.hasClass('selected');
    $row.toggleClass('selected', selected);
    $row.attr('aria-selected', selected ? 'true' : 'false');
    $('.tr-row-select', $row).attr('aria-pressed', selected ? 'true' : 'false');
  },
  updateButtonsState: function() {
    var $root = $('.tr-unreleased-keys');
    var selected_cnt = $('.tr-plain-key-row-wrap:not(.shide) .tr-plain-key-row.selected', $root).size();
    $('.tr-unreleased-header .push-selected-btn').fadeToggle(selected_cnt > 0);
    $('.tr-unreleased-header .tr-selection-status').text(selected_cnt ? selected_cnt + ' selected' : '');
  },
  pushSelected: function(e) {
    var $rows = $('.tr-unreleased-keys .tr-plain-key-row.selected');
    if (!$rows.size()) return;
    showConfirm(l('WEB_PUSH_SELECTED_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      UnreleasedKeys.pushToProduction(grouped_rows);
    }, l('WEB_PUSH_SELECTED_PHRASES_CONFIRM_BUTTON'));
  },
  pushAll: function(e) {
    var $rows = $('.tr-unreleased-keys .tr-plain-key-row');
    if (!$rows.size()) return;
    showConfirm(l('WEB_PUSH_ALL_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      UnreleasedKeys.pushToProduction(grouped_rows);
    }, l('WEB_PUSH_ALL_PHRASES_CONFIRM_BUTTON'));
  },
  hideRows: function($rows) {
    var $rowsWrap = $rows.parents('.tr-plain-key-row-wrap');
    var $counterEl = $('.tr-unreleased-header .tr-header-counter');
    var cnt = $('.tr-unreleased-keys .tr-plain-key-row-wrap:not(.shide)').not($rowsWrap).size();
    $counterEl.text(cnt || '');
    if ($rows.size() > 3) {
      $rowsWrap.remove();
    } else {
      $rowsWrap.slideHide('remove');
    }
    $('.tr-unreleased-keys .tr-plain-key-row-empty-wrap').fadeToggle(!cnt);
    UnreleasedKeys.updateButtonsState();
  },
  toggleProcessing: function(show) {
    $('.tr-unreleased-header .tr-header-processing').fadeToggle(show);
    $('.tr-unreleased-header .tr-selection-status').text(show ? l('WEB_PROCESSING') : '');
    if (!show) {
      var $counterEl = $('.tr-unreleased-header .tr-header-counter');
      $('.tr-unreleased-header .tr-header-buttons').fadeToggle(!!$counterEl.text());
    } else {
      $('.tr-unreleased-header .tr-header-buttons').fadeToggle(false);
    }
  },
  pushToProduction: function(keys_list) {
    if (!keys_list.length) {
      Aj.state.pushProcessing = false;
      UnreleasedKeys.toggleProcessing(false);
      return;
    }
    Aj.state.pushProcessing = true;
    UnreleasedKeys.toggleProcessing(true);
    var keys_item = keys_list.shift();
    var generation = TrResponsiveLifecycle.generation;
    var route = Aj.location().href;
    var lang_keys = keys_item.$rows.map(function() {
      return $(this).attr('data-key');
    }).get().join(',');
    Aj.apiRequest('pushToProduction', {
      lang_pack: keys_item.lang_pack,
      lang: keys_item.lang,
      lang_keys: lang_keys
    }, function(result) {
      if (!TrResponsiveLifecycle.isCurrent(generation) || Aj.location().href !== route) return;
      if (result.ok) {
        UnreleasedKeys.hideRows(keys_item.$rows);
        setTimeout(function() {
          if (Aj.state.pushProcessing && TrResponsiveLifecycle.isCurrent(generation) && Aj.location().href === route) {
            UnreleasedKeys.pushToProduction(keys_list);
          }
        }, 500);
      }
      if (result.error) {
        UnreleasedKeys.toggleProcessing(false);
        return showAlert(result.error);
      }
    });
  }
};

var Languages = {
  generation: 0,
  init: function() {
    Aj.onLoad(function(state) {
      Languages.generation++;
      $(document).off('change.tr-languages').on('change.tr-languages', '.tr-languages-table .checkbox', Languages.toggleLanguage);
    });
    Aj.onUnload(function() { Languages.generation++; $(document).off('.tr-languages'); });
  },
  toggleLanguage: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    var checkbox = this;
    if (!this.checked) {
      return false;
    }
    var $td = $(this).parents('td');
    var generation = Languages.generation;
    var route = Aj.location().href;
    $(checkbox).prop('checked', false);
    showConfirm(l('WEB_ENABLE_LANGUAGE_CONFIRM_TEXT'), function() {
      Languages.enableLanguage($td, checkbox, generation, route);
    }, l('WEB_ENABLE_LANGUAGE_CONFIRM_BUTTON'));
  },
  enableLanguage: function($td, checkbox, generation, route) {
    var lang = $td.attr('data-lang');
    var lang_pack = $td.attr('data-langpack');
    var requestGeneration = ($td.data('enable-generation') || 0) + 1;
    $td.data('enable-generation', requestGeneration).attr('aria-busy', 'true');
    $(checkbox).prop('disabled', true);
    Aj.apiRequest('enableLanguage', {
      lang: lang,
      lang_pack: lang_pack
    }, function(result) {
      if (generation !== Languages.generation || Aj.location().href !== route || !document.documentElement.contains($td[0]) || $td.data('enable-generation') !== requestGeneration) return;
      $td.removeAttr('aria-busy');
      if (result.ok) {
        $td.removeClass('prepare').removeClass('ready');
        if ($td.hasClass('unavailable')) {
          $td.removeClass('unavailable').addClass('attention');
        }
        $('.checkbox', $td).prop('checked', true).prop('disabled', true).attr('aria-label', 'Enabled');
      }
      if (result.error) {
        $(checkbox).prop('checked', false).prop('disabled', false);
        return showAlert(result.error);
      }
    });
  }
};

var Members = {
  generation: 0,
  addGenerations: {},
  pendingAdds: {},
  init: function() {
    Aj.onLoad(function(state) {
      Members.generation++;
      Members.addGenerations = {};
      Members.pendingAdds = {};
      $('.tr-members-add-form').off('submit.tr-members').on('submit.tr-members', Members.eSubmitAddForm);
      $(document).off('click.tr-members').on('click.tr-members', '.delete-member-btn', Members.eDeleteMember).on('click.tr-members', '.add-member-btn', Members.eAddMember);
    });
    Aj.onUnload(function(state) {
      Members.generation++;
      Members.addGenerations = {};
      Members.pendingAdds = {};
      $('.tr-members-add-form').off('.tr-members');
      $(document).off('.tr-members');
    });
  },
  eSubmitAddForm: function(e) {
    e.preventDefault();
    var form = this;
    var $form = $(form);
    if ($form.data('request-pending')) return;
    var $blockEl = $(this).parents('.tr-members-block');
    var level = $blockEl.attr('data-level');
    var generation = Members.generation;
    var route = Aj.location().href;
    var requestGeneration = ($form.data('request-generation') || 0) + 1;
    $form.data('request-generation', requestGeneration).data('request-pending', true).attr('aria-busy', 'true');
    var $submitButtons = $form.find('[type="submit"], button:not([type])').prop('disabled', true);
    Aj.apiRequest('rightsAddMember', {
      level: level,
      query: this.query.value
    }, function(result) {
      if (generation !== Members.generation || Aj.location().href !== route ||
          !document.documentElement.contains(form) || !document.documentElement.contains($blockEl[0]) ||
          $form.data('request-generation') !== requestGeneration) return;
      $form.removeData('request-pending').removeAttr('aria-busy');
      $submitButtons.prop('disabled', false);
      if (result.member_html) {
        $(result.member_html).addClass('shide').prependTo($('.tr-members', $blockEl)).slideShow();
        $('.tr-header-counter', $blockEl).text($('.tr-member-row-wrap', $blockEl).size() || '');
      }
      if (result.error) {
        return showAlert(result.error);
      }
      form.reset();
      form.query.blur();
    });
  },
  eAddMember: function() {
    if (this.disabled) return;
    var level = $(this).attr('data-level');
    var $rowEl = $(this).parents('.tr-member-row-wrap');
    var member_id = $rowEl.attr('data-member-id');
    Members.addMember(level, member_id, this);
  },
  addMember: function(level, member_id, button) {
    var generation = Members.generation;
    var route = Aj.location().href;
    var $button = $(button);
    var $candidate = $button.parents('.tr-member-row-wrap');
    var $blockEl = $('.tr-members-block').filter(function() {
      return this.getAttribute('data-level') == level;
    }).first();
    if (!$blockEl.length || ($button.length && $button.prop('disabled'))) return false;
    var actionKey = level + ':' + member_id;
    if (Members.pendingAdds[actionKey]) return false;
    var requestGeneration = (Members.addGenerations[actionKey] || 0) + 1;
    Members.addGenerations[actionKey] = requestGeneration;
    Members.pendingAdds[actionKey] = true;
    if ($button.length) $button.prop('disabled', true).attr('aria-busy', 'true');
    if ($candidate.length) $candidate.attr('aria-busy', 'true');
    Aj.apiRequest('rightsAddMember', {
      level: level,
      member_id: member_id,
    }, function(result) {
      if (generation !== Members.generation || Aj.location().href !== route ||
          !document.documentElement.contains($blockEl[0]) ||
          Members.addGenerations[actionKey] !== requestGeneration) return;
      delete Members.pendingAdds[actionKey];
      if ($button.length && document.documentElement.contains($button[0])) $button.removeAttr('aria-busy');
      if ($candidate.length && document.documentElement.contains($candidate[0])) $candidate.removeAttr('aria-busy');
      if (result.member_html) {
        $('.tr-member-row-wrap').filter(function() {
          return this.getAttribute('data-member-id') == member_id;
        }).find('.add-member-btn').fadeHide();
        var hasMember = $('.tr-member-row-wrap', $blockEl).filter(function() {
          return this.getAttribute('data-member-id') == member_id;
        }).length;
        if (!hasMember) {
          $(result.member_html).addClass('shide').appendTo($('.tr-members', $blockEl)).slideShow();
        }
        $('.tr-header-counter', $blockEl).text($('.tr-member-row-wrap', $blockEl).size() || '');
      }
      if (result.error) {
        if ($button.length && document.documentElement.contains($button[0])) $button.prop('disabled', false);
        return showAlert(result.error);
      }
      if (!result.member_html && $button.length && document.documentElement.contains($button[0])) $button.prop('disabled', false);
    });
    return true;
  },
  eDeleteMember: function() {
    if (this.disabled) return;
    var button = this;
    var $button = $(button);
    var $blockEl = $(this).parents('.tr-members-block');
    var level = $blockEl.data('level');
    var $rowEl = $(this).parents('.tr-member-row-wrap');
    var member_id = $rowEl.attr('data-member-id');
    var generation = Members.generation;
    var route = Aj.location().href;
    var requestGeneration = ($button.data('request-generation') || 0) + 1;
    $button.data('request-generation', requestGeneration).prop('disabled', true).attr('aria-busy', 'true');
    $rowEl.attr('aria-busy', 'true');
    Aj.apiRequest('rightsDeleteMember', {
      level: level,
      member_id: member_id,
    }, function(result) {
      if (generation !== Members.generation || Aj.location().href !== route ||
          !document.documentElement.contains(button) || !document.documentElement.contains($rowEl[0]) ||
          !document.documentElement.contains($blockEl[0]) || !$.contains($rowEl[0], button) ||
          $button.data('request-generation') !== requestGeneration) return;
      $button.removeAttr('aria-busy');
      $rowEl.removeAttr('aria-busy');
      if (result.ok) {
        $rowEl.slideHide(function() {
          $(this).remove();
          $('.tr-header-counter', $blockEl).text($('.tr-member-row-wrap', $blockEl).size() || '');
        });
        $('.tr-member-row-wrap').filter(function() {
          return this.getAttribute('data-member-id') == member_id;
        }).find('.add-member-btn').fadeShow();
      }
      if (result.error) {
        $button.prop('disabled', false);
        return showAlert(result.error);
      }
      if (!result.ok) $button.prop('disabled', false);
    });
  }
};

var ImportKeys = {
  generation: 0,
  xhr: null,
  eUpload: function(e) {
    var file = this.files && this.files[0] || null;
    if (!file) return;
    ImportKeys.upload(file);
    this.value = '';
  },
  upload: function(file) {
    var generation = ++ImportKeys.generation;
    var route = Aj.location().href;
    var state = Aj.state;
    var $uploadRow = $('.tr-upload-row').first();
    var isCurrent = function() {
      return generation === ImportKeys.generation && state === Aj.state && Aj.location().href === route && $uploadRow.length && document.documentElement.contains($uploadRow[0]);
    };
    var data = new FormData();
    data.append('method', 'importFile');
    data.append('lang', Aj.state.curLang);
    data.append('lang_pack', Aj.state.curLangpack);
    data.append('file', file);
    $.ajax(Aj.apiUrl, {
      type: 'POST',
      data: data,
      cache: false,
      dataType: 'json',
      processData: false,
      contentType: false,
      xhrFields: {
        withCredentials: true
      },
      xhr: function() {
        var xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', function(event) {
          if (event.lengthComputable && isCurrent()) {
            ImportKeys.onProgress(event.loaded, event.total, $uploadRow);
          }
        });
        return xhr;
      },
      beforeSend: function(xhr) {
        ImportKeys.xhr = xhr;
        if (isCurrent()) ImportKeys.onProgress(0, 1, $uploadRow);
      },
      success: function (result) {
        if (!isCurrent()) return;
        ImportKeys.xhr = null;
        $uploadRow.attr('data-label', l('WEB_IMPORT_UPLOAD_FILE')).attr('aria-busy', 'false');
        $('.tr-upload-row-progress', $uploadRow).width(0);
        $('.tr-upload-status', $uploadRow).text('');
        if (result.error) {
          return showAlert(result.error);
        }
        if (result.import_id) {
          Aj.state.importId = result.import_id;
          if (result.href) {
            Aj.setLocation(result.href);
          }
          if (result.html) {
            $('.tr-keys-blocks').html(result.html);
          }
        }
      },
      error: function (xhr) {
        if (!isCurrent()) return;
        ImportKeys.xhr = null;
        $uploadRow.attr('data-label', l('WEB_IMPORT_UPLOAD_FILE')).attr('aria-busy', 'false');
        $('.tr-upload-row-progress', $uploadRow).width(0);
        $('.tr-upload-status', $uploadRow).text('Upload failed');
        showAlert('Network error');
      }
    });
    $('.tr-keys-blocks').html('');
  },
  cancel: function() {
    ImportKeys.generation++;
    if (ImportKeys.xhr && typeof ImportKeys.xhr.abort === 'function') ImportKeys.xhr.abort();
    ImportKeys.xhr = null;
  },
  onProgress: function(loaded, total, $row) {
    $row = $row && $row.length ? $row : $('.tr-upload-row').first();
    var progress = total ? loaded / total : 0;
    progress = Math.max(0, Math.min(progress, 1)) * 100;
    var label = progress >= 100 ? l('WEB_IMPORT_PROCESSING') : l('WEB_IMPORT_UPLOADING', {percent: Math.round(progress)});
    $row.attr('data-label', label).attr('aria-busy', progress < 100 ? 'true' : 'false');
    $('.tr-upload-status', $row).text(label);
    $('.tr-upload-row-progress', $row).width(progress + '%');
  },
  toggleRow: function(e) {
    if (e && $(e.target).closest('a,button,input,select,textarea').length) return;
    if (e) e.preventDefault();
    ImportKeys.setSelected($(this));
    var $blockEl = $(this).parents('.tr-keys-block');
    ImportKeys.updateButtonsState($blockEl);
  },
  toggleControl: function(e) {
    e.preventDefault();
    e.stopPropagation();
    var $row = $(this).closest('.tr-plain-key-row');
    ImportKeys.setSelected($row);
    ImportKeys.updateButtonsState($row.parents('.tr-keys-block'));
  },
  setSelected: function($row, selected) {
    if (typeof selected === 'undefined') selected = !$row.hasClass('selected');
    $row.toggleClass('selected', selected);
    $row.attr('aria-selected', selected ? 'true' : 'false');
    $('.tr-row-select', $row).attr('aria-pressed', selected ? 'true' : 'false');
  },
  updateButtonsState: function($blockEl) {
    var selected_cnt = $('.tr-plain-key-row.selected', $blockEl).size();
    $('.selected-btn', $blockEl).fadeToggle(selected_cnt > 0);
    $('.tr-selection-status', $blockEl).text(selected_cnt ? selected_cnt + ' selected' : '');
  },
  addSelected: function(e) {
    var $rows = $('.tr-add-keys-block .tr-plain-key-row.selected');
    if (!$rows.size()) return;
    showConfirm(l('WEB_IMPORT_ADD_SELECTED_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      ImportKeys.affectRows('addImportedKeys', grouped_rows);
    }, l('WEB_IMPORT_ADD_SELECTED_PHRASES_CONFIRM_BUTTON'));
  },
  addAll: function(e) {
    var $rows = $('.tr-add-keys-block .tr-plain-key-row');
    if (!$rows.size()) return;
    showConfirm(l('WEB_IMPORT_ADD_ALL_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      ImportKeys.affectRows('addImportedKeys', grouped_rows);
    }, l('WEB_IMPORT_ADD_ALL_PHRASES_CONFIRM_BUTTON'));
  },
  changeSelected: function(e) {
    var $rows = $('.tr-change-keys-block .tr-plain-key-row.selected');
    if (!$rows.size()) return;
    showConfirm(l('WEB_IMPORT_CHANGE_SELECTED_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      ImportKeys.affectRows('editImportedKeys', grouped_rows);
    }, l('WEB_IMPORT_CHANGE_SELECTED_PHRASES_CONFIRM_BUTTON'));
  },
  changeAll: function(e) {
    var $rows = $('.tr-change-keys-block .tr-plain-key-row');
    if (!$rows.size()) return;
    showConfirm(l('WEB_IMPORT_CHANGE_ALL_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      ImportKeys.affectRows('editImportedKeys', grouped_rows);
    }, l('WEB_IMPORT_CHANGE_ALL_PHRASES_CONFIRM_BUTTON'));
  },
  removeSelected: function(e) {
    var $rows = $('.tr-remove-keys-block .tr-plain-key-row.selected');
    if (!$rows.size()) return;
    showConfirm(l('WEB_IMPORT_REMOVE_SELECTED_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      ImportKeys.affectRows('removeImportedKeys', grouped_rows);
    }, l('WEB_IMPORT_REMOVE_SELECTED_PHRASES_CONFIRM_BUTTON'));
  },
  removeAll: function(e) {
    var $rows = $('.tr-remove-keys-block .tr-plain-key-row');
    if (!$rows.size()) return;
    showConfirm(l('WEB_IMPORT_REMOVE_ALL_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      ImportKeys.affectRows('removeImportedKeys', grouped_rows);
    }, l('WEB_IMPORT_REMOVE_ALL_PHRASES_CONFIRM_BUTTON'));
  },
  restoreSelected: function(e) {
    var $rows = $('.tr-restore-keys-block .tr-plain-key-row.selected');
    if (!$rows.size()) return;
    showConfirm(l('WEB_IMPORT_RESTORE_SELECTED_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      ImportKeys.affectRows('restoreImportedKeys', grouped_rows);
    }, l('WEB_IMPORT_RESTORE_SELECTED_PHRASES_CONFIRM_BUTTON'));
  },
  restoreAll: function(e) {
    var $rows = $('.tr-restore-keys-block .tr-plain-key-row');
    if (!$rows.size()) return;
    showConfirm(l('WEB_IMPORT_RESTORE_ALL_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      ImportKeys.affectRows('restoreImportedKeys', grouped_rows);
    }, l('WEB_IMPORT_RESTORE_ALL_PHRASES_CONFIRM_BUTTON'));
  },
  hideRows: function($rows) {
    var $blockEl = $rows.parents('.tr-keys-block');
    var $rowsWrap = $rows.parents('.tr-plain-key-row-wrap');
    var $counterEl = $('.tr-header-counter', $blockEl);
    var cnt = $('.tr-plain-key-row-wrap:not(.shide)', $blockEl).not($rowsWrap).size();
    $counterEl.text(cnt || '');
    if (cnt > 0) {
      if ($rows.size() > 3) {
        $rowsWrap.remove();
      } else {
        $rowsWrap.slideHide('remove');
      }
    } else {
      $blockEl.slideHide();
    }
  },
  toggleProcessing: function($rows, show) {
    var $blockEl = $rows.parents('.tr-keys-block');
    $('.tr-header-buttons', $blockEl).fadeToggle(!show);
    $('.tr-header-processing', $blockEl).fadeToggle(show);
    $('.tr-selection-status', $blockEl).text(show ? l('WEB_PROCESSING') : '');
  },
  affectRows: function(method, keys_list, keys_item, lang_keys, affected_cnt) {
    if (!keys_list.length) {
      return;
    }
    if (!keys_item) {
      keys_item = keys_list.shift();
    }
    var $rows = keys_item.$rows;
    if (!lang_keys) {
      lang_keys = $rows.map(function(){ return $(this).attr('data-key'); }).get();
    }
    if (!lang_keys.length) {
      return;
    }
    ImportKeys.toggleProcessing($rows, true);
    var lang_pack = keys_item.lang_pack;
    var lang = keys_item.lang;
    var generation = ImportKeys.generation;
    var routeGeneration = TrResponsiveLifecycle.generation;
    var route = Aj.location().href;
    Aj.apiRequest(method, {
      lang_pack: lang_pack,
      lang: lang,
      import_id: Aj.state.importId,
      lang_keys: lang_keys.join(','),
      affected_cnt: affected_cnt || 0
    }, function(result) {
      if (generation !== ImportKeys.generation || !TrResponsiveLifecycle.isCurrent(routeGeneration) || Aj.location().href !== route) return;
      if (result.lang_keys) {
        Search.clearData(lang, lang_pack);
        ImportKeys.hideAffectedRows($rows, result.lang_keys);
      }
      if (result.repeat_lang_keys && result.repeat_lang_keys.length) {
        keys_list.unshift(keys_item);
        ImportKeys.affectRows(method, keys_list, keys_item, result.repeat_lang_keys, result.affected_cnt);
      } else if (keys_list.length) {
        ImportKeys.affectRows(method, keys_list);
      } else {
        ImportKeys.toggleProcessing($rows);
      }
      if (result.error) {
        return showAlert(result.error);
      }
    });
  },
  hideAffectedRows: function($rows, lang_keys) {
    var langKeysMap = {};
    $.each(lang_keys, function(i, lang_key) {
      langKeysMap[lang_key] = true;
    });
    var $affectedRows = $rows.filter(function() {
      return !!langKeysMap[$(this).attr('data-key')];
    });
    ImportKeys.hideRows($affectedRows);
    if (!$('.tr-keys-block:not(.shide)').size()) {
      $('.tr-keys-block-empty').fadeShow();
    }
  }
};

var LangEditLayer = {
  generation: 0,
  init: function() {
    Aj.onLayerLoad(function(layerState) {
      LangEditLayer.generation++;
      layerState.routeHref = Aj.location().href;
      layerState.routeGeneration = TrResponsiveLifecycle.generation;
      layerState.validationGeneration = 0;
      layerState.submitPending = false;
      var renderItem = function(item) {
        return item.title + (item.rtl ? '<b class="small"><small>RTL</small></b>' : '') + '<span class="small">(' + item.locale + ')</span>';
      };
      $('.language-locale', Aj.layer).initDropdown({
        renderItem: renderItem,
        renderNoItems: function() {
          return '<div class="form-control-dropdown-list-no-results">' + l('WEB_NO_LANGUAGES_FOUND') + '</div>';
        },
        getData: function() {
          var data = Aj.layerState.localesData;
          for (var i = 0; i < data.length; i++) {
            var item = data[i];
            item._values = [item.title.toLowerCase(), item.locale.toLowerCase()];
          }
          return data;
        },
        onSelect: function(item) {
          $('.language-locale .form-control-dropdown-select', Aj.layer).html(renderItem(item)).addClass('is-dirty');
          for (var p = 0; p < 6; p++) {
            $('.lang-p' + p).prop('checked', (item.plurals & (1 << p)) > 0);
          }
          Aj.layerState.languageLocale = item.locale;
          Aj.layerState.languageBaseLang = item.lang || '';
        },
      });
      $('.language-code', Aj.layer).on('input keyup', LangEditLayer.onCodeKeyUp);
      setTimeout(function(){ $('.language-edit-form input.form-control').eq(0).focus(); }, 100);
      $('form', Aj.layer).on('submit', LangEditLayer.eSubmitForm);
    });
    Aj.onLayerUnload(function(layerState) {
      LangEditLayer.generation++;
      clearTimeout(layerState && layerState.lcTimeout);
      $('.language-locale', Aj.layer).destroyDropdown();
      $('.language-code', Aj.layer).off('input keyup', LangEditLayer.onCodeKeyUp);
      $('form', Aj.layer).off('submit', LangEditLayer.eSubmitForm);
    });
  },
  onCodeKeyUp: function() {
    var layer = Aj.layer;
    var layerState = Aj.layerState;
    clearTimeout(layerState.lcTimeout);
    var generation = ++layerState.validationGeneration;
    layerState.lcTimeout = setTimeout(function() {
      var short_name = $('.language-code', layer).val();
      LangEditLayer.checkShortName(short_name, layer, layerState, generation);
    }, 300);
  },
  checkShortName: function(short_name, layer, layerState, generation) {
    layer = layer || Aj.layer;
    layerState = layerState || Aj.layerState;
    generation = generation || ++layerState.validationGeneration;
    var $checkStatus = $('.language-code-check-status', layer);
    var $languageCodeItem = $('.language-code', layer).parents('.textfield-item');
    Aj.apiRequest('checkLanguage', {
      short_name: short_name,
      official: layerState.official
    }, function(result) {
      if (Aj.layer !== layer || Aj.layerState !== layerState || layerState.validationGeneration !== generation || layerState.routeHref !== Aj.location().href || !TrResponsiveLifecycle.isCurrent(layerState.routeGeneration) || $('.language-code', layer).val() !== short_name) return;
      if (result.error) {
        $languageCodeItem.addClass('is-invalid');
        $checkStatus.html(result.error).slideShow();
        Aj.layerState.lastShortNameCheck = false;
      } else {
        $languageCodeItem.removeClass('is-invalid');
        $checkStatus.slideHide();
        Aj.layerState.lastShortNameCheck = true;
      }
    });
  },
  eSubmitForm: function(e) {
    e.preventDefault();
    var layer = Aj.layer;
    var layerState = Aj.layerState;
    if (layerState.submitPending) return false;
    var cur_lang = layerState.curLang;
    if (!cur_lang) {
      var $languageCode = $('.language-code', layer);
      var short_name    = $languageCode.val();
      if (!short_name || !Aj.layerState.lastShortNameCheck) {
        $languageCode.focus();
        return false;
      }
    }
    var $languageName = $('.language-name', layer);
    var lang_name     = $languageName.val();
    if (!lang_name) {
      $languageName.focus();
      return false;
    }
    var $languageNativeName = $('.language-native-name', layer);
    var lang_native_name    = $languageNativeName.val();
    if (!lang_native_name) {
      $languageNativeName.focus();
      return false;
    }
    if (!cur_lang) {
      var lang_locale = Aj.layerState.languageLocale;
      if (!lang_locale) {
        $('.language-locale .form-control-dropdown-select', layer).focus();
        return false;
      }
    }
    var lang_base_lang = layerState.languageBaseLang;
    var routeHref = layerState.routeHref || Aj.location().href;
    var routeGeneration = layerState.routeGeneration;
    layerState.submitPending = true;
    var generation = ++LangEditLayer.generation;
    var complete = function() { if (Aj.layer === layer && Aj.layerState === layerState && generation === LangEditLayer.generation) layerState.submitPending = false; };
    if (cur_lang) {
      Aj.apiRequest('editLanguage', {
        lang: cur_lang,
        lang_name: lang_name,
        lang_native_name: lang_native_name,
        lang_base_lang: lang_base_lang
      }, function(result) {
        if (Aj.layer !== layer || Aj.layerState !== layerState || generation !== LangEditLayer.generation || routeHref !== Aj.location().href || !TrResponsiveLifecycle.isCurrent(routeGeneration)) return;
        complete();
        if (result.error) {
          showAlert(result.error);
        }
        if (result.ok) {
          closePopup(layer);
          if (result.href) {
            Aj.location(result.href);
          }
        }
      });
    } else {
      Aj.apiRequest('addLanguage', {
        short_name: short_name,
        lang_name: lang_name,
        lang_native_name: lang_native_name,
        lang_locale: lang_locale,
        lang_base_lang: lang_base_lang,
        official: layerState.official
      }, function(result) {
        if (Aj.layer !== layer || Aj.layerState !== layerState || generation !== LangEditLayer.generation || routeHref !== Aj.location().href || !TrResponsiveLifecycle.isCurrent(routeGeneration)) return;
        complete();
        if (result.error) {
          showAlert(result.error);
        }
        if (result.ok) {
          closePopup(layer);
          if (result.href) {
            Aj.location(result.href);
          }
        }
      });
    }
  }
};

var TeamAddLayer = {
  generation: 0,
  init: function() {
    Aj.onLayerLoad(function(layerState) {
      TeamAddLayer.generation++;
      layerState.teamLayer = Aj.layer;
      layerState.routeHref = Aj.location().href;
      layerState.routeGeneration = TrResponsiveLifecycle.generation;
      layerState.teamSearchGeneration = 0;
      layerState.teamSearchState = 'idle';
      layerState.teamSearchStatus = $('.tr-team-add-status', Aj.layer);
      var $field   = $('.tr-team-add-search-field');
      var $results = $('.tr-team-add-results');
      layerState.teamSearchField = $field;
      $field.initSearch({
        $results: $results,
        emptyQueryEnabled: true,
        updateOnInit: true,
        enterEnabled: function() {
          return false;
        },
        renderItem: function(item, query) {
          return '<div class="tr-member-row" data-member-id="' + item.id + '"><div class="tr-member-photo">' + item.photo + '</div><div class="tr-member-body' + (!item.info.length ? ' tr-member-name-only' : '') + '"><div class="tr-member-name">' + item.title + '</div><div class="tr-member-info">' + item.info + '</div></div><div class="tr-member-buttons"><button type="button" class="btn btn-primary btn-sm tr-team-candidate-add" data-member-id="' + item.id + '">' + (layerState.addLabel || 'Add') + '</button></div></div>';
        },
        renderNoItems: function() {
          var retry = layerState.teamSearchState === 'error' ? ' <button type="button" class="btn btn-default btn-sm tr-team-add-retry">Retry</button>' : '';
          return '<div class="tr-languages-no-results" role="status">' + (layerState.teamSearchState === 'error' ? 'Network error' : l('WEB_NO_LANGUAGES_FOUND')) + retry + '</div>';
        },
        getData: function() {
          return TeamAddLayer.getCandidatesData(layerState);
        },
        onSelect: function(item) {
          if (Members.addMember(layerState.level, item.id)) {
            closePopup(layerState.teamLayer);
          }
        },
        onInput: function(value) {
          layerState.foundCandidate = false;
          layerState.teamSearchState = value ? 'loading' : 'idle';
          layerState.teamSearchStatus.text(value ? 'Loading candidates' : '');
          $field.trigger('datachange');
          clearTimeout(layerState.searchTimeout);
          layerState.searchTimeout = setTimeout(TeamAddLayer.searchMember, 600, value);
        }
      });
      layerState.teamLayer.on('click.team-add', '.tr-team-candidate-add', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (Members.addMember(layerState.level, $(this).attr('data-member-id'), this)) {
          closePopup(layerState.teamLayer);
        }
      });
      layerState.teamLayer.on('click.team-add', '.tr-team-add-retry', function(e) {
        e.preventDefault();
        TeamAddLayer.searchMember($field.val() || '');
      });
      layerState.teamLayer.one('popup:open', function() {
        $field.focus();
      });
    });
    Aj.onLayerUnload(function(layerState) {
      TeamAddLayer.generation++;
      clearTimeout(layerState && layerState.searchTimeout);
      if (layerState && layerState.teamLayer) layerState.teamLayer.off('.team-add');
      if (layerState && layerState.teamSearchField) layerState.teamSearchField.destroySearch();
    });
  },
  searchMember: function(query) {
    var layer = Aj.layer;
    var layerState = Aj.layerState;
    if (!layer || !layerState) return;
    var routeHref = layerState.routeHref || Aj.location().href;
    var routeGeneration = layerState.routeGeneration;
    var generation = ++layerState.teamSearchGeneration;
    layerState.teamSearchState = 'loading';
    if (layerState.teamSearchStatus) layerState.teamSearchStatus.text('Loading candidates');
    $('.tr-team-add-results', layer).attr('aria-busy', 'true');
    Aj.apiRequest('rightsSearchMember', {
      level: layerState.level,
      query: query
    }, function(result) {
      if (Aj.layer !== layer || Aj.layerState !== layerState || layerState.teamSearchGeneration !== generation || routeHref !== Aj.location().href || !TrResponsiveLifecycle.isCurrent(routeGeneration)) return;
      layerState.teamSearchState = result.error ? 'error' : (result.candidate ? 'populated' : 'empty');
      if (layerState.teamSearchStatus) layerState.teamSearchStatus.text(result.error ? 'Network error' : (result.candidate ? 'Candidates loaded' : 'No candidates found'));
      $('.tr-team-add-results', layer).attr('aria-busy', 'false');
      if (result.error) {
        $('.tr-team-add-search-field', layer).trigger('datachange');
        return;
      }
      if (layerState && result.candidate) {
        var item = result.candidate;
        if (layerState.candidatesDataMap[item.id]) {
          layerState.candidatesDataMap[item.id]._values.unshift(query);
        } else {
          item._values = [query];
          layerState.foundCandidate = item;
        }
      } else {
        layerState.foundCandidate = false;
      }
      $('.tr-team-add-search-field', layer).trigger('datachange');
    });
  },
  getCandidatesData: function(layerState) {
    layerState = layerState || Aj.layerState;
    if (!layerState || !layerState.candidatesDataMap) {
      if (!layerState) return [];
      layerState.candidatesDataMap = {};
      var data = layerState.candidatesData || [];
      for (var i = 0; i < data.length; i++) {
        var item = data[i];
        item._values = [item.name.toLowerCase()];
        layerState.candidatesDataMap[item.id] = item;
      }
    }
    return (layerState.foundCandidate ? [layerState.foundCandidate] : []).concat(layerState.candidatesData || []);
  }
};

var ImportTranslationsLayer = {
  init: function() {
    Aj.onLayerLoad(function(layerState) {
      layerState.routeHref = Aj.location().href;
      layerState.routeGeneration = TrResponsiveLifecycle.generation;
      layerState.requestGeneration = 0;
      $('.search-phrases-btn', Aj.layer).on('click', ImportTranslationsLayer.searchPhrases);
      $('.import-phrases-btn', Aj.layer).on('click', ImportTranslationsLayer.importPhrases);
      Aj.onBeforeLayerUnload(function () {
        if (Aj.layerState.inProgress) {
          return l('WEB_IMPORT_POPUP_LEAVE_CONFIRM_TEXT');
        }
        return false;
      });
    });
    Aj.onLayerUnload(function(layerState) {
      if (layerState) layerState.requestGeneration = (layerState.requestGeneration || 0) + 1;
      $('.search-phrases-btn', Aj.layer).off('click', ImportTranslationsLayer.searchPhrases);
      $('.import-phrases-btn', Aj.layer).off('click', ImportTranslationsLayer.importPhrases);
    });
  },
  searchPhrases: function(e) {
    e.preventDefault();
    Aj.layerState.isImport = false;
    Aj.layerState.inProgress = true;
    Aj.layerState.phrasesCount = 0;
    Aj.layerState.requestGeneration++;
    $('.langs-progress', Aj.layer).html(l('WEB_IMPORT_POPUP_LANGUAGES_PROCESSED', {n: 0, total: Aj.layerState.langsCount}));
    $('.phrases-progress', Aj.layer).html(l('WEB_IMPORT_POPUP_PHRASES_PROCESSED', {n: Aj.layerState.phrasesCount}));
    ImportTranslationsLayer.importTranslations();
    $('.search-phrases-btn', Aj.layer).addClass('hide');
    $('.popup-cancel-btn', Aj.layer).html(l('WEB_IMPORT_CANCEL_BUTTON'));
  },
  importPhrases: function(e) {
    e.preventDefault();
    Aj.layerState.isImport = true;
    Aj.layerState.inProgress = true;
    Aj.layerState.importedCount = 0;
    Aj.layerState.requestGeneration++;
    $('.phrases-progress', Aj.layer).html(l('WEB_IMPORT_POPUP_PHRASES_IMPORTED', {n: Aj.layerState.importedCount, total: Aj.layerState.phrasesCount}));
    ImportTranslationsLayer.importTranslations();
    $('.import-phrases-btn', Aj.layer).addClass('hide');
    $('.popup-cancel-btn', Aj.layer).html(l('WEB_IMPORT_CANCEL_BUTTON'));
  },
  importTranslations: function(lang_code) {
    var layer = Aj.layer;
    var layerState = Aj.layerState;
    if (!layer || !layerState) return;
    var requestGeneration = layerState.requestGeneration;
    var routeHref = layerState.routeHref || Aj.location().href;
    var routeGeneration = layerState.routeGeneration;
    Aj.apiRequest('importTranslations', {
      lang_pack: layerState.curLangpack,
      lang: lang_code || '',
      search_only: layerState.isImport ? 0 : 1,
      phrases_cnt: layerState.isImport ? layerState.importedCount : layerState.phrasesCount
    }, function(result) {
      if (Aj.layer !== layer || Aj.layerState !== layerState || layerState.requestGeneration !== requestGeneration || routeHref !== Aj.location().href || !TrResponsiveLifecycle.isCurrent(routeGeneration)) return;
      if (result.error) {
        layerState.inProgress = false;
        $('.langs-progress, .phrases-progress', layer).attr('role', 'alert').text(result.error);
        return showAlert(result.error);
      }
      if (Aj.layer) {
        if (layerState.isImport) {
          if (typeof result.phrases_cnt !== 'undefined') {
            layerState.importedCount = result.phrases_cnt;
            $('.phrases-progress', layer).html(l('WEB_IMPORT_POPUP_PHRASES_IMPORTED', {n: layerState.importedCount, total: layerState.phrasesCount}));
          }
        } else {
          if (typeof result.langs_total !== 'undefined') {
            $('.langs-progress', Aj.layer).html(l('WEB_IMPORT_POPUP_LANGUAGES_PROCESSED', {n: result.langs_cnt, total: result.langs_total}));
          }
          if (typeof result.phrases_cnt !== 'undefined') {
            layerState.phrasesCount = result.phrases_cnt;
            $('.phrases-progress', layer).html(l('WEB_IMPORT_POPUP_PHRASES_PROCESSED', {n: layerState.phrasesCount}));
          }
        }
        if (result.next_lang) {
          ImportTranslationsLayer.importTranslations(result.next_lang);
        } else {
          $('.popup-cancel-btn', layer).html(l('WEB_IMPORT_CLOSE_BUTTON'));
          layerState.inProgress = false;
          if (!layerState.isImport) {
            $('.import-phrases-btn', layer).fadeShow();
          }
        }
      }
    });
  }
};

function strEmojiToHex(emoji, trim_ef0f) {
  var hex = encodeURIComponent(emoji).replace(/%([0-9a-f]{2})|(.)/gi, function(m, m1, m2){ return m1 || m2.charCodeAt(0).toString(16); }).toUpperCase();
  if (trim_ef0f !== false) hex = hex.replace(/EFB88F/g, '');
  return hex;
}

var EmojiSearch = {
  _registered: false,
  _state: null,
  _suggestionsMode: false,
  generation: 0,
  _scrollLocked: false,
  init: function(suggestions_mode) {
    EmojiSearch._suggestionsMode = !!suggestions_mode;
    if (EmojiSearch._registered) return;
    EmojiSearch._registered = true;
    Aj.onLoad(function(state) {
      /* Initialize only on emoji routes. */
      if (!state || !state.emojiGroupedList || !$('.tr-emoji-keyword-add-form').length) return;
      EmojiSearch.generation++;
      state.emojiGeneration = EmojiSearch.generation;
      EmojiSearch._state = state;
      var $suggestionHeader = $('.tr-emoji-keywords-suggestion-header');
      var suggestionHeaderText = l('WEB_EMOJI_KEYWORD_SUGGESTIONS_HEADER');
      $suggestionHeader.attr('data-label', suggestionHeaderText).contents().filter(function() { return this.nodeType === 3; }).last().replaceWith(document.createTextNode(suggestionHeaderText));
      var $field = $('.tr-search-field');
      var $panel = $('.tr-search-emoji-panel');
      state.$esResults = $('.tr-emoji-keywords');
      $('.header-search-btn,.tr-compact-search').off('click.esearch').on('click.esearch', EmojiSearch.eOpen);
      $('.tr-search-reset').off('click.esearch').on('click.esearch', EmojiSearch.eClearField);
      $('.tr-search-close').off('click.esearch').on('click.esearch', EmojiSearch.close);
      $('.tr-search-field-wrap').on('mousedown.esearch', '.tr-search-emoji-icon,.tr-search-filters', stopImmediatePropagation);
      $('.tr-search-field-wrap').on('mousedown.esearch', EmojiSearch.eOpen);
      $('.tr-search-emoji-icon').on('click.esearch', EmojiSearch.eToggleMode);
      $('.tr-emoji-keyword-add-form').on('submit', EmojiSearch.eSubmit);
      $('.tr-emoji-keyword-add-form .btn-default').on('click', EmojiSearch.eCancel);
      $('.tr-emoji-keyword-new .tr-back').on('click', EmojiSearch.eCancel);
      $('.tr-emoji-keywords-suggestion-btn').on('click', EmojiSearch.eSuggestionsOpen);
      $('.tr-emoji-keywords-suggestion-header .tr-back').on('click', EmojiSearch.eSuggestionsClose);
      $(document).off('keydown.esearch-a11y').on('keydown.esearch-a11y', '.tr-emoji-keywords-suggestion-btn,.tr-emoji-keywords-suggestion-header .tr-back,.tr-emoji-keyword-new .tr-back', EmojiSearch.onControlKeyDown);
      state.$esResults.on('click.esearch', '.tr-emoji-add,.keyword-def', EmojiSearch.eEmojiAdd);
      state.$esResults.on('click.esearch', '.tr-emoji-delete', EmojiSearch.eEmojiDelete);
      state.$esResults.on('keydown.esearch', '.tr-emoji-delete', function(e) { if (e.which == 13 || e.which == 32) { e.preventDefault(); EmojiSearch.eEmojiDelete.call(this, e); } });
      state.$esResults.on('click.esearch', '.tr-emoji-keyword-expand', EmojiSearch.eKeywordToggle);
      state.$esResults.on('click.esearch', '.tr-emoji-keyword-wrap', function(e) {
        if ($(e.target).closest('button,.keyword-md,.keyword-def').length) return;
        var trigger = $('.tr-emoji-keyword-expand', this).get(0);
        if (trigger) EmojiSearch.eKeywordToggle.call(trigger, e);
      });
      state.$esResults.on('click.esearch', '.keyword-md,.emoji-md', EmojiSearch.eEmojiKeywordSelect);
      state.$esResults.on('keydown.esearch', '.keyword-md,.emoji-md', function(e) { if (e.which == 13 || e.which == 32) { e.preventDefault(); EmojiSearch.eEmojiKeywordSelect.call(this, e); } });
      $field.on('blur', EmojiSearch.onScroll);
      state.keywords = {};
      state.searchData = [];
      state.emojis = {};
      state.emojiSearchData = [];
      state.suggestionKeywords = {};
      state.suggestionData = [];
      state.suggestionEmojis = {};
      state.suggestionEmojiData = [];
      EmojiSearch.initEmojiList();
      state.$searchEmojiPanel = $(EmojiSearch.initEmojiPanel());
      $panel.append(state.$searchEmojiPanel);
      state.$searchEmojiPanel.blockBodyScroll();
      state.$searchEmojiPanel.on('mousedown', '.emoji-btn', function(e) {
        e.preventDefault();
        document.execCommand('insertText', false, $(this).text());
        $field.focus();
      });
      state.$emojiPanel = $(EmojiSearch.initEmojiPanel());
      var $emojiForm  = $('.tr-emoji-keyword-add-form');
      state.$keywordField = $emojiForm.field('keyword');
      state.$keywordField.initTextarea({
        checkText: function(text) {
          return text.replace(Aj.state.emojiRE, '');
        },
      });
      state.$emojiField = $emojiForm.field('emoji');
      state.$emojiPanel.insertAfter(state.$emojiField);
      state.$emojiPanel.on('mousedown', '.emoji-btn', function(e) {
        e.preventDefault();
        document.execCommand('insertText', false, $(this).text());
        Aj.state.$emojiField.focus();
      });
      state.$emojiField.initTextarea({
        singleLine: true,
        allowEmoji: true,
        emojiRE: Aj.state.emojiRE,
        checkText: function(text) {
          var emoji_arr = text.match(Aj.state.emojiRE) || [], emoji_map = {}, result_arr = [];
          for (var i = 0; i < emoji_arr.length; i++) {
            var emoji = emoji_arr[i].replace(/🏻|🏼|🏽|🏾|🏿/g, '');
            var hex = strEmojiToHex(emoji);
            if (!emoji_map[hex]) {
              emoji_map[hex] = true;
              result_arr.push(emoji);
            }
          }
          return result_arr.join('');
        },
      });
      EmojiSearch.applyDiff(state.initKeywords);
      $field.initSearch({
        $results: state.$esResults,
        emptyQueryEnabled: true,
        updateOnInit: true,
        prefixOnly: true,
        resultsNotScrollable: true,
        initTextarea: {
          singleLine: true,
          allowEmoji: true,
          emojiRE: Aj.state.emojiRE,
          checkText: function(text) {
            var m;
            if ((m = text.match(Aj.state.emojiRE))) {
              var emoji = m.pop();
              emoji = emoji.replace(/🏻|🏼|🏽|🏾|🏿/g, '');
              return emoji;
            }
            return text;
          },
        },
        enterEnabled: function() {
          return false;
        },
        prepareQuery: function(str) {
          return strEmojiToHex(str.toLowerCase());
        },
        renderItem: function(item, query) {
          var delete_btn = Aj.state.canEdit ? '<button type="button" aria-label="' + (item.s ? 'Decline keyword suggestion' : 'Delete emoji keyword') + '" class="tr-emoji-delete' + (item.s ? ' decline' : '') + ' close"></button>' : '';
          var add_btn = '<button type="button" class="btn btn-primary btn-sm tr-emoji-add need-auth">' + l('WEB_EMOJI_KEYWORD_ADD_BUTTON') + '</button>';
          var expand_btn = '<button type="button" class="tr-emoji-keyword-expand" aria-expanded="false" aria-label="Expand emoji keywords"></button>';
          var sugg_header = item.s && !Aj.state.suggestionsMode ? '<h4 class="tr-emoji-keyword-subheader">' + l('WEB_EMOJI_KEYWORD_SUGGESTIONS_HEADER') + '</h4>' : '';
          if (Aj.state.byEmojiMode) {
            var html = '', keywords = [];
            var emoji_html = EmojiSearch.emojiHtml(item.e);
            for (var i = 0; i < item.k.length; i++) {
              var keyword_html = '<span role="button" tabindex="0" class="keyword-md">' + Search.wrapHighlight(item.k[i], query, false, true) + '</span>';
              html += '<div class="tr-emoji-keyword by-emoji">' + delete_btn + add_btn + '<div class="tr-emoji">' + emoji_html + '</div><div class="tr-keyword">' + keyword_html + '</div></div>';
              keywords.push(keyword_html);
            }
            if (keywords.length > 1) {
              return sugg_header + '<div class="tr-emoji-keyword-wrap collapsed">' + expand_btn + '<div class="tr-emoji-keyword-multi"><div class="tr-emoji-keyword by-emoji">' + delete_btn + add_btn + '<div class="tr-emoji">' + emoji_html + '</div><div class="tr-keyword">' + keywords.join('<br>\n') + '</div></div></div><div class="tr-emoji-keyword-by-one by-emoji">' + html + '</div></div>';
            } else if (!keywords.length) {
              var def_keywords = Aj.state.defKeywords && Aj.state.defKeywords[strEmojiToHex(item.e)] || [];
              var def_keywords_htmls = [];
              for (var i = 0; i < def_keywords.length; i++) {
                var keyword_html = '<span role="button" tabindex="0" class="keyword-def">' + Search.wrapHighlight(def_keywords[i], query, false, true) + '</span>';
                def_keywords_htmls.push(keyword_html);
              }
              return sugg_header + '<div class="tr-emoji-keyword-wrap collapsed">' + expand_btn + '<div class="tr-emoji-keyword by-emoji">' + add_btn + '<div class="tr-emoji">' + emoji_html + '</div><div class="tr-keyword default">' + def_keywords_htmls.join('<br>\n') + '</div></div></div>';
            } else {
              return sugg_header + '<div class="tr-emoji-keyword-wrap collapsed">' + expand_btn + html + '</div>';
            }
          } else {
            var html = '', emojis = [];
            var query_hex = strEmojiToHex(query);
            var keyword_html = '<span role="button" tabindex="0" class="keyword-md">' + Search.wrapHighlight(item.k, query, false, true) + '</span>';
            for (var i = 0; i < item.e.length; i++) {
              var emoji_html = EmojiSearch.emojiHtml(item.e[i]);
              html += '<div class="tr-emoji-keyword by-keyword">' + delete_btn + add_btn + '<div class="tr-emoji">' + emoji_html + '</div><div class="tr-keyword">' + keyword_html + '</div></div>';
              emojis.push(emoji_html);
            }
            if (emojis.length > 1) {
              return sugg_header + '<div class="tr-emoji-keyword-wrap collapsed">' + expand_btn + '<div class="tr-emoji-keyword-multi"><div class="tr-emoji-keyword by-keyword">' + delete_btn + add_btn + '<div class="tr-emoji">' + emojis.join('') + '</div><div class="tr-keyword">' + keyword_html + '</div></div></div><div class="tr-emoji-keyword-by-one by-keyword">' + html + '</div></div>';
            } else {
              return sugg_header + '<div class="tr-emoji-keyword-wrap collapsed">' + expand_btn + html + '</div>';
            }
          }
        },
        renderLoading: function() {
          return '<div class="tr-emoji-keywords-loading dots-animated">' + l('WEB_TRANSLATIONS_LOADING') + '</div>';
        },
        renderNoItems: function(query) {
          var text;
          if (query) {
            query = EmojiSearch.wrapEmojiHtml(query);
            text = l('WEB_EMOJI_KEYWORD_NOT_FOUND', {query: query});
          } else {
            text = l('WEB_EMOJI_KEYWORD_NO_ITEMS');
          }
          return '<div class="tr-emoji-keyword-not-found"><div class="tr-emoji-keyword-not-found-text">' + text + '</div><div class="tr-emoji-keyword-not-found-button"><button class="btn btn-primary btn-sm tr-emoji-add">' + l('WEB_EMOJI_KEYWORD_SUGGEST_BUTTON') + '</button></div></div>';
        },
        getData: function() {
          if (Aj.state.suggestionsMode) {
            if (!Aj.state.suggestionsLoaded) {
              return false;
            }
            if (Aj.state.byEmojiMode) {
              return Aj.state.suggestionEmojiData;
            } else {
              return Aj.state.suggestionData;
            }
          } else {
            if (Aj.state.byEmojiMode) {
              return Aj.state.emojiSearchData.concat(Aj.state.suggestionEmojiData);
            } else {
              return Aj.state.searchData.concat(Aj.state.suggestionData);
            }
          }
        },
        onInputBeforeChange: function(value) {
          EmojiSearch.updateField();
          // EmojiSearch.applySuggestionsDiff();
          $('.tr-search-field').trigger('contentchange');
          clearTimeout(Aj.state.searchTimeout);
          if (value) {
            Aj.state.searchTimeout = setTimeout(EmojiSearch.getSuggestions, 600, value);
          }
        },
        onOpen: function(item) {
          $('.tr-search').addClass('tr-search-open');
          EmojiSearch.toggleNewKeyword(false);
        },
        onClose: function(item) {
          $('.tr-search').removeClass('tr-search-open');
        }
      });
      EmojiSearch.updateField();
      $(window).on('scroll', EmojiSearch.onScroll);
      EmojiSearch.toggleNewKeyword(false);
      EmojiSearch.toggleMode(state.canEdit);
      if (EmojiSearch._suggestionsMode) {
        EmojiSearch.toggleSuggestions(true);
      }
    });
    Aj.onUnload(function(state) {
      EmojiSearch.generation++;
      EmojiSearch.releaseScrollLock();
      var cleanupState = EmojiSearch._state || state;
      if (cleanupState && cleanupState.$searchEmojiPanel && cleanupState.$searchEmojiPanel.unblockBodyScroll) cleanupState.$searchEmojiPanel.unblockBodyScroll();
      if (!cleanupState || !cleanupState.$esResults) return;
      var $field = $('.tr-search-field');
      $field.destroySearch();
      $('.header-search-btn,.tr-compact-search').off('click.esearch');
      $('.tr-search-close').off('click.esearch');
      $('.tr-search-reset').off('click.esearch');
      $('.tr-search-field-wrap').off('.esearch');
      $('.tr-search-emoji-icon').off('.esearch');
      $('.tr-emoji-keyword-add-form').off('submit', EmojiSearch.eSubmit);
      $('.tr-emoji-keyword-add-form .btn-default').off('click', EmojiSearch.eCancel);
      $('.tr-emoji-keyword-new .tr-back').off('click', EmojiSearch.eCancel);
      $('.tr-emoji-keywords-suggestion-btn').off('click', EmojiSearch.eSuggestionsOpen);
      $('.tr-emoji-keywords-suggestion-header .tr-back').off('click', EmojiSearch.eSuggestionsClose);
      $(document).off('keydown.esearch-a11y');
      cleanupState.$esResults.off('.esearch');
      $field.off('blur', EmojiSearch.onScroll);
      if (cleanupState.$searchEmojiPanel) cleanupState.$searchEmojiPanel.off('mousedown');
      if (cleanupState.$emojiPanel) cleanupState.$emojiPanel.off('mousedown');
      if (cleanupState.$keywordField) cleanupState.$keywordField.destroyTextarea();
      if (cleanupState.$emojiField) cleanupState.$emojiField.destroyTextarea();
      $(window).off('scroll', EmojiSearch.onScroll);
      EmojiSearch._state = null;
    });
  },
  toggleNewKeyword: function(opened) {
    if (opened) {
      Aj.state.emojiScroll = $(window).scrollTop();
      $('.tr-content').addClass('new-keyword');
      $(window).scrollTop(0);
    } else {
      $('.tr-content').removeClass('new-keyword');
      $(window).scrollTop(Aj.state.emojiScroll || 0);
    }
  },
  toggleSuggestions: function(opened) {
    Aj.state.suggestionsMode = opened;
    if (opened) {
      EmojiSearch.toggleMode(false);
      EmojiSearch.getSuggestions();
    } else {
      EmojiSearch.toggleMode(Aj.state.canEdit);
    }
    $('.tr-content').toggleClass('suggestions', opened);
    $(window).scrollTop(0);
    $('.tr-search-field').trigger('datachange');
  },
  eSuggestionsOpen: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    EmojiSearch.toggleSuggestions(true);
  },
  eSuggestionsClose: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    EmojiSearch.toggleSuggestions(false);
  },
  onControlKeyDown: function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (this.tagName === 'BUTTON') return;
    e.preventDefault();
    e.stopPropagation();
    $(this).trigger('click');
  },
  updateSuggestionsButton: function(cnt) {
    $('.tr-emoji-keywords-suggestion-btn').html(l('WEB_EMOJI_KEYWORD_SUGGESTIONS', {n: cnt})).toggleClass('hide', !cnt);
  },
  initEmojiList: function() {
    Aj.state.emojiHexList = [];
    Aj.state.emojiByHex = {};
    for (var group_id = 0, index = 0; group_id < Aj.state.emojiGroupedList.length; group_id++) {
      var group = Aj.state.emojiGroupedList[group_id];
      var emojis = group.e.split(' ');
      var hexes = group.h.split(' ');
      for (var i = 0; i < emojis.length; i++) {
        var hex = strEmojiToHex(emojis[i]);
        Aj.state.emojiByHex[hex] = {
          img_hex: hexes[i],
          i: (i % 10),
          j: Math.floor(i / 10),
          group_id: group_id,
          index: index++,
          emoji: emojis[i]
        };
        Aj.state.emojiHexList.push(hex);
        if (hex.slice(-12) == 'e2808de29982' ||
            hex.slice(-12) == 'e2808de29980') {
          Aj.state.emojiByHex[hex.slice(0, -12)] = Aj.state.emojiByHex[hex];
        }
      }
    }
    Aj.state.emojiRE = new RegExp(Aj.state.emojiRE, 'g');
  },
  initEmojiPanel: function() {
    var html = '<div class="emoji-panel">';
    for (var group_id = 0; group_id < Aj.state.emojiGroupedList.length; group_id++) {
      var group = Aj.state.emojiGroupedList[group_id];
      var emojis = group.e.split(' ');
      var hexes = group.h.split(' ');
      html += '<div class="emoji-group-wrap">';
      html += '<h4 class="emoji-group-header">' + group.t + '</h4>';
      html += '<div class="emoji-group">';
      for (var i = 0; i < emojis.length; i++) {
        html += '<button type="button" class="emoji-btn" aria-label="' + cleanHTML(emojis[i]) + '">' + EmojiSearch.emojiHtml(emojis[i], true) + '</button>';
      }
      for (i = 0; i < 30; i++) {
        html += '<div class="emoji-btn-hidden"></div>';
      }
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  },
  wrapEmojiHtml: function(text, lg) {
    text = cleanHTML(text);
    if (!Aj.state.emojiRE) {
      return text;
    }
    return text.replace(/🏻|🏼|🏽|🏾|🏿/g, '').replace(Aj.state.emojiRE, function(emoji) {
      return EmojiSearch.emojiHtml(emoji, lg);
    });
  },
  emojiHtml: function(emoji, lg) {
    var hex = strEmojiToHex(emoji);
    var data = Aj.state.emojiByHex[hex];
    if (!data) {
      return cleanHTML(emoji);
    }
    // var emoji_url = '//telegram.org/img/emoji/40/' + data.img_hex + '.png';
    // return '<img class="emoji" src="' + emoji_url + '" width="20" height="20" alt="' + cleanHTML(emoji) + '" />';
    var size = lg ? 31 : 25;
    var i_class = lg ? 'emoji-lg' : 'emoji-md lg';
    return '<i class="' + i_class + ' g' + data.group_id + '" style="background-position:' + (-size * data.i) + 'px ' + (-size * data.j) + 'px"><b>' + cleanHTML(emoji) + '</b></i>';
  },
  updateField: function() {
    var $field = $('.tr-search-field');
    var value = $field.value() || '';
    // Aj.state.emojiMode = Aj.state.emojiRE.test(value);
    if (value.length) {
      Aj.state.emojiRE.lastIndex = 0;
      EmojiSearch.toggleMode(Aj.state.emojiRE.test(value));
    }
    $('.tr-search').toggleClass('tr-search-has-value', value.length > 0);
  },
  updateSearchFilter: function($filter, value, text) {
    $('li.selected', $filter).removeClass('selected');
    $('a.tr-search-filter-item', $filter).attr('aria-selected', 'false');
    $('a.tr-search-filter-item[data-value="' + value + '"]', $filter).parent('li').addClass('selected');
    $('a.tr-search-filter-item[data-value="' + value + '"]', $filter).attr('aria-selected', 'true');
    $('.tr-search-filter', $filter).text(text);
  },
  toggleMode: function(by_emoji) {
    if (!Aj.state.byEmojiMode == !by_emoji) {
      return;
    }
    $(window).scrollTop(0);
    Aj.state.byEmojiMode = !!by_emoji;
    $('.tr-search-field').trigger('datachange');
    $('.tr-search-field-wrap').toggleClass('by-emoji', Aj.state.byEmojiMode);
    $('.tr-search-emoji-icon').attr('aria-pressed', Aj.state.byEmojiMode ? 'true' : 'false');
  },
  eOpen: function(e) {
    EmojiSearch.focus();
  },
  close: function(e) {
    e && e.preventDefault();
    $('.tr-search').removeClass('tr-search-open');
    EmojiSearch.releaseScrollLock();
    var btn = document.querySelector('.tr-compact-search, .header-search-btn');
    if (btn && window.matchMedia && window.matchMedia('(max-width: 991px)').matches) btn.focus();
  },
  eToggleMode: function(e) {
    e.stopImmediatePropagation();
    e.preventDefault();
    $('.tr-search').removeClass('tr-search-open');
    EmojiSearch.toggleMode(!Aj.state.byEmojiMode);
  },
  eKeywordToggle: function(e) {
    var $trigger = $(this), $wrap = $trigger.closest('.tr-emoji-keyword-wrap').toggleClass('collapsed');
    var expanded = !$wrap.hasClass('collapsed');
    $trigger.attr({'aria-expanded': expanded ? 'true' : 'false', 'aria-label': expanded ? 'Collapse emoji keywords' : 'Expand emoji keywords'});
  },
  focus: function(e) {
    $('.tr-search').addClass('tr-search-open');
    var state = Aj.state, route = Aj.location().href, generation = EmojiSearch.generation;
    setTimeout(function(){ if (state === Aj.state && route === Aj.location().href && generation === EmojiSearch.generation && EmojiSearch._state === state) $('.tr-search-field').first().focus(); }, 100);
  },
  releaseScrollLock: function() {
    if (!EmojiSearch._scrollLocked) return;
    EmojiSearch._scrollLocked = false;
    TrCompactScrollLock.unlock();
  },
  eClearField: function(e) {
    $('.tr-search-field').value('').trigger('input');
  },
  eSubmit: function(e) {
    e.preventDefault();
    var $form = $(this);
    var keyword = $.trim($form.field('keyword').value());
    var emoji = $.trim($form.field('emoji').value());
    if (!keyword.length || !emoji.length) {
      return false;
    }
    var method = !Aj.state.canEdit ? 'suggestEmojiKeywords' : 'addEmojiKeywords';
    var layerGeneration = EmojiSearch.generation;
    var route = Aj.location().href;
    Aj.apiRequest(method, {
      lang: Aj.state.curLang,
      from_version: Aj.state.keywordsVersion,
      keyword: keyword,
      emoji: emoji
    }, function(result) {
      if (layerGeneration !== EmojiSearch.generation || Aj.location().href !== route || EmojiSearch._state !== Aj.state) return;
      if (result.error) {
        showAlert(result.error);
      }
      if (result.ok) {
        if (result.message) {
          showAlert(result.message);
        }
        $form.field('keyword').value('');
        $form.field('emoji').value('');
        if (result.sdiff) {
          EmojiSearch.applySuggestionsDiff(result.sdiff);
        }
        if (result.scount >= 0) {
          EmojiSearch.updateSuggestionsButton(result.scount);
        }
        if (result.diff) {
          EmojiSearch.applyDiff(result.diff);
          if (result.version) {
            Aj.state.keywordsVersion = result.version;
          }
          $('.tr-search-field').trigger('contentchange');
        }
        EmojiSearch.toggleNewKeyword(false);
      }
    });
  },
  eCancel: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    EmojiSearch.toggleNewKeyword(false);
  },
  eEmojiAdd: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (Aj.needAuth()) return false;
    var $emojiForm = $('.tr-emoji-keyword-add-form');
    EmojiSearch.toggleNewKeyword(true);
    if ($(this).parents('.tr-emoji-keyword-not-found').size()) {
      var $searchField = $('.tr-search-field');
      var value = $searchField.value();
      Aj.state.emojiRE.lastIndex = 0;
      if (Aj.state.emojiRE.test(value)) {
        $emojiForm.field('emoji').value(value);
        $emojiForm.field('keyword').value('').focus();
      } else {
        $emojiForm.field('keyword').value(value);
        $emojiForm.field('emoji').value('').focus();
      }
    } else {
      var $keyword = $(this).parents('.tr-emoji-keyword');
      var $trKeyword = $keyword.find('.tr-keyword');
      var focusOnEmoji = Aj.state.byEmojiMode && !$trKeyword.hasClass('default');
      var keyword = $trKeyword.text();
      var emoji = $keyword.find('.tr-emoji').text();
      $emojiForm.field('emoji').value(emoji.match(Aj.state.emojiRE).join(''));
      $emojiForm.field('keyword').value(keyword);
      $emojiForm.field(focusOnEmoji ? 'emoji' : 'keyword').focusAndSelectAll();
    }
  },
  eEmojiKeywordSelect: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    var value = $(this).text();
    $('.tr-search-field').value(value);
    EmojiSearch.updateField();
    clearTimeout(Aj.state.searchTimeout);
    if (value) {
      Aj.state.searchTimeout = setTimeout(EmojiSearch.getSuggestions, 600, value);
    }
  },
  eEmojiDelete: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    var $keyword = $(this).parents('.tr-emoji-keyword');
    var keyword = $keyword.find('.tr-keyword').text();
    var $emoji = $keyword.find('.tr-emoji');
    var $emoji_clone = $emoji.clone();
    $emoji_clone.find('.emoji-md + .emoji-md').before(' ');
    var emoji = $emoji.text();
    var decline = $(this).hasClass('decline');
    var layerGeneration = EmojiSearch.generation;
    var route = Aj.location().href;
    var decline_func = function() {
      var method = decline ? 'declineKeywordSuggestions' : 'deleteEmojiKeywords';
      Aj.apiRequest(method, {
        lang: Aj.state.curLang,
        from_version: Aj.state.keywordsVersion,
        keyword: keyword,
        emoji: emoji
      }, function(result) {
        if (layerGeneration !== EmojiSearch.generation || Aj.location().href !== route || EmojiSearch._state !== Aj.state) return;
        if (result.error) {
          showAlert(result.error);
        }
        if (result.sdiff) {
          EmojiSearch.applySuggestionsDiff(result.sdiff);
        }
        if (result.scount >= 0) {
          EmojiSearch.updateSuggestionsButton(result.scount);
        }
        if (result.diff) {
          EmojiSearch.applyDiff(result.diff);
          if (result.version) {
            Aj.state.keywordsVersion = result.version;
          }
          $('.tr-search-field').trigger('contentchange');
        }
      });
    };
    if (decline) {
      decline_func();
    } else {
      var confirm_text = l('WEB_DELETE_EMOJI_KEYWORD_CONFIRM_TEXT', {keyword: cleanHTML(keyword), emoji: $emoji_clone.html()});
      showConfirm(confirm_text, decline_func, l('WEB_DELETE_EMOJI_KEYWORD_CONFIRM_BUTTON'));
    }
  },
  getSuggestions: function(query) {
    if (!Aj.state.canEdit) return;
    var layerGeneration = EmojiSearch.generation;
    var route = Aj.location().href;
    var state = Aj.state;
    Aj.apiRequest('getEmojiSuggestions', {
      lang: Aj.state.curLang,
      query: query || ''
    }, function(result) {
      if (layerGeneration !== EmojiSearch.generation || Aj.location().href !== route || EmojiSearch._state !== state) return;
      if (result.sdiff) {
        if (!query) {
          Aj.state.suggestionsLoaded = true;
        }
        EmojiSearch.applySuggestionsDiff(result.sdiff);
        $('.tr-search-field').trigger('contentchange');
      }
      if (result.scount >= 0) {
        EmojiSearch.updateSuggestionsButton(result.scount);
      }
    });
  },
  updateKeywords: function(keywords, diff) {
    for (var i = 0; i < diff.length; i++) {
      var item = diff[i];
      var keyword = item.k;
      var emojis = item.e.split(' ');
      if (!keywords[keyword]) {
        keywords[keyword] = {};
      }
      for (var j = 0; j < emojis.length; j++) {
        if (item.d) {
          delete keywords[keyword][emojis[j]];
        } else {
          keywords[keyword][emojis[j]] = true;
        }
      }
    }
  },
  updateSearchData: function(searchData, keywords, add_data) {
    searchData.splice(0);
    for (var keyword in keywords) {
      var emojis = [];
      for (var emoji in keywords[keyword]) {
        emojis.push(emoji);
      }
      if (emojis.length) {
        var _values = [keyword].concat(emojis);
        for (var i = 0; i < _values.length; i++) {
          _values[i] = strEmojiToHex(_values[i].toLowerCase());
        }
        var data = {
          k: keyword,
          e: emojis,
          _values: _values
        };
        if (add_data) {
          $.extend(data, add_data);
        }
        searchData.push(data);
      }
    }
    searchData.sort(function(a, b) {
      if (a.k.localeCompare) return a.k.localeCompare(b.k);
      if (a.k > b.k) return 1;
      if (a.k < b.k) return -1;
      return 0;
    });
  },
  updateEmojis: function(emojis, diff) {
    for (var i = 0; i < diff.length; i++) {
      var item = diff[i];
      var keyword = item.k;
      var es = item.e.split(' ');
      for (var j = 0; j < es.length; j++) {
        var emoji_hex = strEmojiToHex(es[j]);
        if (!emojis[emoji_hex]) {
          emojis[emoji_hex] = {};
        }
        if (item.d) {
          delete emojis[emoji_hex][keyword];
        } else {
          emojis[emoji_hex][keyword] = true;
        }
      }
    }
  },
  updateEmojiSearchData: function(searchData, emojis, force_all, add_data) {
    searchData.splice(0);
    var emoji_map = force_all ? Aj.state.emojiByHex : emojis;
    for (var emoji_hex in emoji_map) {
      var emoji_data = Aj.state.emojiByHex[emoji_hex];
      if (!emoji_data) continue;
      var emoji = emoji_data.emoji;
      var keywords = [];
      for (var keyword in emojis[emoji_hex]) {
        keywords.push(keyword);
      }
      if (keywords.length || force_all) {
        var _values = [emoji].concat(keywords);
        for (var i = 0; i < _values.length; i++) {
          _values[i] = strEmojiToHex(_values[i].toLowerCase());
        }
        var k = !keywords.length ? -1e9 : 0;
        var data = {
          k: keywords,
          e: emoji,
          _values: _values,
          _i: emoji_data.index + k,
        };
        if (add_data) {
          $.extend(data, add_data);
        }
        searchData.push(data);
      }
    }
    searchData.sort(function(a, b) {
      return (a._i - b._i);
    });
  },
  applyDiff: function(diff) {
    diff = diff || [];
    EmojiSearch.updateKeywords(Aj.state.keywords, diff);
    EmojiSearch.updateSearchData(Aj.state.searchData, Aj.state.keywords);

    for (var keyword in Aj.state.keywords) {
      for (var emoji in Aj.state.keywords[keyword]) {
        if (Aj.state.suggestionKeywords[keyword]) {
          delete Aj.state.suggestionKeywords[keyword][emoji];
        }
      }
    }
    EmojiSearch.updateSearchData(Aj.state.suggestionData, Aj.state.suggestionKeywords, {s: true, className: 'suggestion', _bottom: true});

    EmojiSearch.updateEmojis(Aj.state.emojis, diff);
    EmojiSearch.updateEmojiSearchData(Aj.state.emojiSearchData, Aj.state.emojis, true);
    for (var emoji_hex in Aj.state.emojis) {
      for (var keyword in Aj.state.emojis[emoji_hex]) {
        if (Aj.state.suggestionEmojis[emoji_hex]) {
          delete Aj.state.suggestionEmojis[emoji_hex][keyword];
        }
      }
    }
    EmojiSearch.updateEmojiSearchData(Aj.state.suggestionEmojiData, Aj.state.suggestionEmojis, false, {s: true, className: 'suggestion', _bottom: true});
  },
  applySuggestionsDiff: function(diff) {
    diff = diff || [];
    EmojiSearch.updateKeywords(Aj.state.suggestionKeywords, diff);
    for (var keyword in Aj.state.keywords) {
      for (var emoji in Aj.state.keywords[keyword]) {
        if (Aj.state.suggestionKeywords[keyword]) {
          delete Aj.state.suggestionKeywords[keyword][emoji];
        }
      }
    }
    EmojiSearch.updateSearchData(Aj.state.suggestionData, Aj.state.suggestionKeywords, {s: true, className: 'suggestion', _bottom: true});
    EmojiSearch.updateEmojis(Aj.state.suggestionEmojis, diff);
    for (var emoji_hex in Aj.state.emojis) {
      for (var keyword in Aj.state.emojis[emoji_hex]) {
        if (Aj.state.suggestionEmojis[emoji_hex]) {
          delete Aj.state.suggestionEmojis[emoji_hex][keyword];
        }
      }
    }
    EmojiSearch.updateEmojiSearchData(Aj.state.suggestionEmojiData, Aj.state.suggestionEmojis, false, {s: true, className: 'suggestion', _bottom: true});
  },
  onScroll: function() {
    var scrollTop = $(window).scrollTop();
    $('header').toggleClass('search-collapsed', scrollTop > 20);
  },
  _data: {}
};

var StatsGraphs = {
  registered: false,
  resizeObserver: null,
  mutationObserver: null,
  mutationSuppressed: false,
  resizeFrame: 0,
  mediaQuery: null,
  init: function() {
    if (StatsGraphs.registered) return;
    StatsGraphs.registered = true;
    Aj.onLoad(function() {
      StatsGraphs.bind();
    });
    Aj.onUnload(function() {
      StatsGraphs.unbind();
    });
  },
  bind: function() {
    StatsGraphs.unbind();
    var blocks = $('.tr-graph-block');
    if (!blocks.length) return;
    var route = Aj.location().href;
    var state = Aj.state;
    var compact = function() {
      return !window.matchMedia || window.matchMedia('(max-width: 991px)').matches;
    };
    var applyA11y = function(isCompact) {
      blocks.find('.rickshaw_graph').each(function() {
        var $graph = $(this);
        if (isCompact) {
          if (!$graph.data('tr-stats-a11y')) $graph.data('tr-stats-a11y', {role: this.getAttribute('role'), tabindex: this.getAttribute('tabindex'), label: this.getAttribute('aria-label')});
          $graph.attr({role: 'img', tabindex: '0', 'aria-label': l('WEB_STATISTICS_HEADER')});
        } else {
          var prior = $graph.data('tr-stats-a11y');
          if (!prior) return;
          if (prior.role == null) $graph.removeAttr('role'); else $graph.attr('role', prior.role);
          if (prior.tabindex == null) $graph.removeAttr('tabindex'); else $graph.attr('tabindex', prior.tabindex);
          if (prior.label == null) $graph.removeAttr('aria-label'); else $graph.attr('aria-label', prior.label);
          $graph.removeData('tr-stats-a11y');
        }
      });
    };
    applyA11y(compact());
    StatsGraphs.resize = function() {
      if (StatsGraphs.resizeFrame) return;
      var frame = window.requestAnimationFrame || function(callback) { return window.setTimeout(callback, 0); };
      StatsGraphs.resizeFrame = frame(function() {
        StatsGraphs.resizeFrame = 0;
        if (state !== Aj.state || route !== Aj.location().href) return;
        var isCompact = compact();
        applyA11y(isCompact);
        StatsGraphs.mutationSuppressed = true;
        try { blocks.each(function() {
          var root = this.querySelector('.rickshaw_graph, .chart, .chart_wrap') || this;
          var chart = root.__chart__ || root.chart || root._chart || $(root).data('chart') || $(root).data('graph');
          if (!chart && root.parentNode) {
            chart = root.parentNode.__chart__ || root.parentNode.chart || root.parentNode._chart || $(root.parentNode).data('chart') || $(root.parentNode).data('graph');
          }
          if (!chart) return;
          var width = isCompact ? Math.round(root.clientWidth) : 704;
          if (!width) return;
          var dimensions = {width: width};
          if (!isCompact) dimensions.height = 300;
          if (typeof chart.onResize === 'function') {
            if ('ww' in chart) chart.ww = null;
            chart.onResize();
          } else if (chart.graph && typeof chart.graph.configure === 'function') {
            chart.graph.configure(dimensions);
            if (typeof chart.graph.render === 'function') chart.graph.render();
          } else if (typeof chart.resize === 'function') {
            if (chart.resize.length) chart.resize(dimensions);
            else chart.resize();
          } else if (typeof chart.configure === 'function') {
            chart.configure(dimensions);
          }
        }); } finally { StatsGraphs.mutationSuppressed = false; }
      });
    };
    StatsGraphs.resize();
    if (window.ResizeObserver) {
      StatsGraphs.resizeObserver = new ResizeObserver(StatsGraphs.resize);
      blocks.each(function() { StatsGraphs.resizeObserver.observe(this); });
    }
    if (window.MutationObserver) {
      StatsGraphs.mutationObserver = new MutationObserver(function(records) {
        if (StatsGraphs.mutationSuppressed) return;
        for (var i = 0; i < records.length; i++) {
          var nodes = records[i].addedNodes || [];
          for (var j = 0; j < nodes.length; j++) {
            if (nodes[j].nodeType === 1 && ($(nodes[j]).is('.rickshaw_graph,.chart,.chart_wrap') || $(nodes[j]).find('.rickshaw_graph,.chart,.chart_wrap').length)) {
              StatsGraphs.resize();
              return;
            }
          }
        }
      });
      blocks.each(function() { StatsGraphs.mutationObserver.observe(this, {childList: true, subtree: true}); });
    }
    if (window.matchMedia) {
      StatsGraphs.mediaQuery = window.matchMedia('(max-width: 991px)');
      if (StatsGraphs.mediaQuery.addEventListener) StatsGraphs.mediaQuery.addEventListener('change', StatsGraphs.resize);
      else if (StatsGraphs.mediaQuery.addListener) StatsGraphs.mediaQuery.addListener(StatsGraphs.resize);
    }
    $(window).on('resize.tr-stats orientationchange.tr-stats', StatsGraphs.resize);
    if (window.visualViewport) $(window.visualViewport).on('resize.tr-stats scroll.tr-stats', StatsGraphs.resize);
  },
  unbind: function() {
    $(window).off('.tr-stats');
    if (window.visualViewport) $(window.visualViewport).off('.tr-stats');
    if (StatsGraphs.resizeObserver) StatsGraphs.resizeObserver.disconnect();
    if (StatsGraphs.mutationObserver) StatsGraphs.mutationObserver.disconnect();
    if (StatsGraphs.mediaQuery) {
      if (StatsGraphs.mediaQuery.removeEventListener) StatsGraphs.mediaQuery.removeEventListener('change', StatsGraphs.resize);
      else if (StatsGraphs.mediaQuery.removeListener) StatsGraphs.mediaQuery.removeListener(StatsGraphs.resize);
    }
    if (StatsGraphs.resizeFrame) {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(StatsGraphs.resizeFrame);
      else window.clearTimeout(StatsGraphs.resizeFrame);
    }
    StatsGraphs.resizeObserver = StatsGraphs.mutationObserver = StatsGraphs.mediaQuery = null;
    StatsGraphs.mutationSuppressed = false;
    StatsGraphs.resizeFrame = 0;
    StatsGraphs.resize = null;
  }
};

var TrResponsiveLifecycle = {
  generation: 0,
  registered: false,
  stateKeys: ['curLang', 'curLangData', 'curLangpack', 'curSection', 'selection', 'isSearchPage', 'isReplacePage', 'binding', 'searchModeBinding', 'importId', 'replaceId', 'searchLang', 'searchLangpack', 'searchQuery', 'searchWhere', 'searchBindToWrapEl', 'searchBindTo', 'searchBindPrevLangpack', 'searchBindPrevValue', 'searchTimeout', 'searchData', 'languagesData', 'languagesDataError', 'languagesDataRequestGeneration', 'loadMoreGeneration', 'trRouteGeneration', 'canEdit', 'defKeywords', 'emojiGroupedList', 'emojiHexList', 'emojiByHex', 'emojiGeneration', 'emojiMode', 'emojiRE', 'emojiScroll', 'initKeywords', 'keywords', 'keywordsVersion', 'emojis', 'emojiSearchData', 'suggestionData', 'suggestionEmojiData', 'suggestionEmojis', 'suggestionKeywords', 'suggestionsLoaded', 'suggestionsMode', 'byEmojiMode', '$esResults', '$searchEmojiPanel', '$emojiPanel', '$keywordField', '$emojiField'],
  init: function() {
    if (this.registered || !window.Aj) return;
    this.registered = true;
    var self = this;
    Aj.onLoad(function(state) {
      self.generation++;
      state = state || Aj.state || {};
      if (typeof state.curLang === 'undefined') state.curLang = '';
      if (typeof state.curLangpack === 'undefined') state.curLangpack = '';
      if (typeof state.curSection === 'undefined') state.curSection = '';
      if (typeof state.selection === 'undefined') state.selection = false;
      if (typeof state.isSearchPage === 'undefined') state.isSearchPage = false;
      if (typeof state.isReplacePage === 'undefined') state.isReplacePage = false;
      if (typeof state.binding === 'undefined') state.binding = false;
      if (typeof state.searchModeBinding === 'undefined') state.searchModeBinding = false;
      state.trRouteGeneration = self.generation;
      if (window.TrThemeToggle) TrThemeToggle.init();
      $('.tr-header-tabs').each(function() {
        var active = this.querySelector('.tr-header-tab.active, .tr-header-tab a.active');
        if (active && active.scrollIntoView) active.scrollIntoView({block: 'nearest', inline: 'nearest'});
      });
    });
    Aj.onUnload(function(state) {
      self.generation++;
      Screenshots.cancelPageUpload();
      if (state) {
        self.stateKeys.forEach(function(key) { delete state[key]; });
        state.trRouteGeneration = self.generation;
      }
      $('.tr-search').removeClass('tr-search-open tr-search-binding-mode');
      $('body').removeClass('tr-drawer-open tr-scroll-locked');
      $('.screenshot-layer,.screenshot-layer-wrap').removeClass('active hover screenshot-layer-mode-edit');
      while (TrCompactScrollLock.depth) TrCompactScrollLock.unlock();
    });
  },
  isCurrent: function(generation) {
    return generation === this.generation;
  },
  requestGuard: function(component, el, identity, layer) {
    var self = this;
    var route = Aj.location().href;
    var state = Aj.state;
    var generation = this.generation;
    var expected = typeof identity === 'function' ? identity() : identity;
    return function() {
      if (generation !== self.generation || state !== Aj.state || route !== Aj.location().href) return false;
      if (layer && Aj.layerState !== layer) return false;
      if (el && (!document.documentElement.contains(el))) return false;
      if (typeof identity === 'function' && identity() !== expected) return false;
      return true;
    };
  }
};
TrInitAfterAj(function() { TrResponsiveLifecycle.init(); });






/*!
  Autosize 3.0.20
  license: MIT
  http://www.jacklmoore.com/autosize
*/
!function(e,t){if("function"==typeof define&&define.amd)define(["exports","module"],t);else if("undefined"!=typeof exports&&"undefined"!=typeof module)t(exports,module);else{var n={exports:{}};t(n.exports,n),e.autosize=n.exports}}(this,function(e,t){"use strict";function n(e){function t(){var t=window.getComputedStyle(e,null);"vertical"===t.resize?e.style.resize="none":"both"===t.resize&&(e.style.resize="horizontal"),s="content-box"===t.boxSizing?-(parseFloat(t.paddingTop)+parseFloat(t.paddingBottom)):parseFloat(t.borderTopWidth)+parseFloat(t.borderBottomWidth),isNaN(s)&&(s=0),l()}function n(t){var n=e.style.width;e.style.width="0px",e.offsetWidth,e.style.width=n,e.style.overflowY=t}function o(e){for(var t=[];e&&e.parentNode&&e.parentNode instanceof Element;)e.parentNode.scrollTop&&t.push({node:e.parentNode,scrollTop:e.parentNode.scrollTop}),e=e.parentNode;return t}function r(){var t=e.style.height,n=o(e),r=document.documentElement&&document.documentElement.scrollTop;e.style.height="auto";var i=e.scrollHeight+s;return 0===e.scrollHeight?void(e.style.height=t):(e.style.height=i+"px",u=e.clientWidth,n.forEach(function(e){e.node.scrollTop=e.scrollTop}),void(r&&(document.documentElement.scrollTop=r)))}function l(){r();var t=Math.round(parseFloat(e.style.height)),o=window.getComputedStyle(e,null),i=Math.round(parseFloat(o.height));if(i!==t?"visible"!==o.overflowY&&(n("visible"),r(),i=Math.round(parseFloat(window.getComputedStyle(e,null).height))):"hidden"!==o.overflowY&&(n("hidden"),r(),i=Math.round(parseFloat(window.getComputedStyle(e,null).height))),a!==i){a=i;var l=d("autosize:resized");try{e.dispatchEvent(l)}catch(e){}}}if(e&&e.nodeName&&"TEXTAREA"===e.nodeName&&!i.has(e)){var s=null,u=e.clientWidth,a=null,p=function(){e.clientWidth!==u&&l()},c=function(t){window.removeEventListener("resize",p,!1),e.removeEventListener("input",l,!1),e.removeEventListener("keyup",l,!1),e.removeEventListener("autosize:destroy",c,!1),e.removeEventListener("autosize:update",l,!1),Object.keys(t).forEach(function(n){e.style[n]=t[n]}),i.delete(e)}.bind(e,{height:e.style.height,resize:e.style.resize,overflowY:e.style.overflowY,overflowX:e.style.overflowX,wordWrap:e.style.wordWrap});e.addEventListener("autosize:destroy",c,!1),"onpropertychange"in e&&"oninput"in e&&e.addEventListener("keyup",l,!1),window.addEventListener("resize",p,!1),e.addEventListener("input",l,!1),e.addEventListener("autosize:update",l,!1),e.style.overflowX="hidden",e.style.wordWrap="break-word",i.set(e,{destroy:c,update:l}),t()}}function o(e){var t=i.get(e);t&&t.destroy()}function r(e){var t=i.get(e);t&&t.update()}var i="function"==typeof Map?new Map:function(){var e=[],t=[];return{has:function(t){return e.indexOf(t)>-1},get:function(n){return t[e.indexOf(n)]},set:function(n,o){e.indexOf(n)===-1&&(e.push(n),t.push(o))},delete:function(n){var o=e.indexOf(n);o>-1&&(e.splice(o,1),t.splice(o,1))}}}(),d=function(e){return new Event(e,{bubbles:!0})};try{new Event("test")}catch(e){d=function(e){var t=document.createEvent("Event");return t.initEvent(e,!0,!1),t}}var l=null;"undefined"==typeof window||"function"!=typeof window.getComputedStyle?(l=function(e){return e},l.destroy=function(e){return e},l.update=function(e){return e}):(l=function(e,t){return e&&Array.prototype.forEach.call(e.length?e:[e],function(e){return n(e,t)}),e},l.destroy=function(e){return e&&Array.prototype.forEach.call(e.length?e:[e],o),e},l.update=function(e){return e&&Array.prototype.forEach.call(e.length?e:[e],r),e}),t.exports=l});

/*
 JavaScript Cookie v2.1.4
 https://github.com/js-cookie/js-cookie

 Copyright 2006, 2015 Klaus Hartl & Fagner Brack
 Released under the MIT license
*/
(function(m){var h=!1;"function"===typeof define&&define.amd&&(define(m),h=!0);"object"===typeof exports&&(module.exports=m(),h=!0);if(!h){var e=window.Cookies,a=window.Cookies=m();a.noConflict=function(){window.Cookies=e;return a}}})(function(){function m(){for(var e=0,a={};e<arguments.length;e++){var b=arguments[e],c;for(c in b)a[c]=b[c]}return a}function h(e){function a(b,c,d){if("undefined"!==typeof document){if(1<arguments.length){d=m({path:"/"},a.defaults,d);if("number"===typeof d.expires){var k=
new Date;k.setMilliseconds(k.getMilliseconds()+864E5*d.expires);d.expires=k}d.expires=d.expires?d.expires.toUTCString():"";try{var g=JSON.stringify(c);/^[\{\[]/.test(g)&&(c=g)}catch(p){}c=e.write?e.write(c,b):encodeURIComponent(String(c)).replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g,decodeURIComponent);b=encodeURIComponent(String(b));b=b.replace(/%(23|24|26|2B|5E|60|7C)/g,decodeURIComponent);b=b.replace(/[\(\)]/g,escape);g="";for(var l in d)d[l]&&(g+="; "+l,!0!==d[l]&&(g+="="+
d[l]));return document.cookie=b+"="+c+g}b||(g={});l=document.cookie?document.cookie.split("; "):[];for(var h=/(%[0-9A-Z]{2})+/g,n=0;n<l.length;n++){var q=l[n].split("="),f=q.slice(1).join("=");'"'===f.charAt(0)&&(f=f.slice(1,-1));try{k=q[0].replace(h,decodeURIComponent);f=e.read?e.read(f,k):e(f,k)||f.replace(h,decodeURIComponent);if(this.json)try{f=JSON.parse(f)}catch(p){}if(b===k){g=f;break}b||(g[k]=f)}catch(p){}}return g}}a.set=a;a.get=function(b){return a.call(a,b)};a.getJSON=function(){return a.apply({json:!0},
[].slice.call(arguments))};a.defaults={};a.remove=function(b,c){a(b,"",m(c,{expires:-1}))};a.withConverter=h;return a}return h(function(){})});
