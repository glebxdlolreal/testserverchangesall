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


var Nav = {
  init: function() {
    Aj.onLoad(function(state) {
      $('.tr-menu-items .active').map(function() {
        var $sectionEl = $(this).parents('.tr-menu-section');
        var $selectedItemEl = $('.tr-menu-selected > .tr-menu-item', $sectionEl);
        $selectedItemEl.css('marginTop', $(this).position().top);
      });
      $('.tr-menu-header').on('click', Nav.eToggleMenuSection);
      $(document).on('mouseover.curPage', '.languages-link', Nav.loadLanguagesData);
      $(document).on('click.curPage', '.languages-link', Nav.openLanguages);
      $(document).on('click.curPage', '.langpack-enable', Nav.enableLangPack);
    });
    Aj.onUnload(function(state) {
      $('.tr-menu-header').off('click', Nav.eToggleMenuSection);
    });
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
    return Nav.getLanguagesData(function() {
      $('.tr-languages-search-field').trigger('contentchange');
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
    Aj.apiRequest('getLanguages', {
      lang: Aj.state.curLang
    }, function(result) {
      if (result.data) {
        for (var i = 0; i < result.data.length; i++) {
          var item = result.data[i];
          item._values = [item.name.toLowerCase(), item.native_name.toLowerCase()];
          if (item.lang == Aj.state.curLang) {
            Aj.state.curLangData = item;
          }
        }
        Aj.state.languagesData = result.data;
        onDataReady && onDataReady();
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
    Aj.apiRequest('toggleLanguageFavorite', {
      lang: lang,
      fav:  fav ? 1 : 0
    }, function(result) {
      if (result.error) {
        showAlert(result.error);
        var lang_items = Aj.state.languagesData;
        for (var i = 0; i < lang_items.length; i++) {
          var item = lang_items[i];
          if (item.lang == lang) {
            el.checked = !!item.fav;
            break;
          }
        }
      } else if (result.ok) {
        var lang_items = Aj.state.languagesData;
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
    if ($('.tr-container').hasClass('mobile-view')) {
      var href = $(this).attr('data-href');
      if (href) {
        document.location = href;
        return true;
      }
    }
    $('#languages-popup-container').one('popup:open', function(popup) {
      $field   = $('.tr-languages-search-field');
      $results = $('.tr-languages-results');
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
          return (!Aj.unauth ? '<label class="checkbox-item"><input type="checkbox" class="checkbox" name="lang" value="' + item.lang + '"' + (item.fav ? ' checked' : '') + (item.def_fav ? ' disabled' : '') + '><span class="checkbox-input ripple-handler"><span class="ripple-mask"><span class="ripple"></span></span><span class="checkbox-input-icon"></span></span></label>' : '') + '<div class="tr-badges">' + Nav.getLanguageBadges(item) + '</div><a href="' + Nav.languageHref(item.lang) + '" class="tr-languages-result' + (item.def ? ' default' : '') + '' + (!available ? ' unavailable' : '') + '"><span class="tr-languages-name">' + item.name + '</span>' + (!item.def ? '<span class="tr-languages-native-name">' + item.native_name + '</span>' : '') + '</a>';
        },
        renderNoItems: function() {
          return '<div class="tr-languages-no-results">' + l('WEB_NO_LANGUAGES_FOUND') + '</div>';
        },
        renderLoading: function() {
          return '<div class="tr-languages-result-loading dots-animated">' + l('WEB_LOADING') + '</div>';
        },
        getData: function() {
          return Nav.getLanguagesData(function() {
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
      $results.destroyRipple();
      $field.destroySearch();
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
    showConfirm(confirm_text, function() {
        Aj.apiRequest('activateLangPack', {
          lang_pack: lang_pack,
          lang: lang
        }, function(result) {
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

var Header = {
  init: function() {
    Aj.onLoad(function(state) {
      $(window).on('scroll', Header.onScroll);
    });
    Aj.onUnload(function(state) {
      $(window).off('scroll', Header.onScroll);
    });
  },
  onScroll: function() {
    var scrollLeft = $(window).scrollLeft();
    $('header').css('marginLeft', -scrollLeft);
  }
};

var Search = {
  init: function() {
    Aj.onLoad(function(state) {
      var $field = $('.tr-search-field');
      var $results = $('.tr-search-results');
      $('.header-search-btn').on('click', Search.eOpen);
      $('.tr-search-filter-where').on('click', '.tr-search-filter-item', Search.eChangeWhere);
      $('.tr-search-filter-lang').on('click', '.tr-search-filter-item', Search.eChangeLang);
      $('.tr-search-filter-langpack').on('click', '.tr-search-filter-item', Search.eChangeLangpack);
      $('.tr-search-filter-wrap .dropdown-menu').on('mouseover mouseout', Search.eLockScroll);
      $('.tr-search-reset').on('click', Search.eClearField);
      $('.tr-search-field-wrap').on('mousedown', Search.eOpen);
      $field.on('blur', Search.onScroll);
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
          return '<a href="' + href + '" class="tr-search-result"><div class="tr-def-value">' + wrapLangValue(item.def_value, false, val_hl) + '</div><div class="tr-lang-key">' + Search.wrapHighlight(item.key, key_hl) + (!Aj.state.searchLangpack && Aj.state.langpackNames[item.lang_pack] ? '<span class="key-langpack">' + Aj.state.langpackNames[item.lang_pack] + '</span>' : '') + '</div>' + (item.value ? '<div class="tr-value">' + wrapLangValue(item.value, item.rtl, val_hl) + '</div>' : '') + '</div></a>';
        },
        renderNoItems: function() {
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
      var $field = $('.tr-search-field');
      var $results = $('.tr-search-results');
      $field.destroySearch();
      $('.header-search-btn').off('click', Search.eFocus);
      $('.tr-search-filter-where').off('click', '.tr-search-filter-item', Search.eChangeWhere);
      $('.tr-search-filter-lang').off('click', '.tr-search-filter-item', Search.eChangeLang);
      $('.tr-search-filter-langpack').off('click', '.tr-search-filter-item', Search.eChangeLangpack);
      $('.tr-search-filter-wrap .dropdown-menu').off('mouseover mouseout', Search.eLockScroll);
      $('.tr-search-reset').off('click', Search.eClearField);
      $('.tr-search-field-wrap').off('mousedown', Search.eOpen);
      $field.off('blur', Search.onScroll);
      $(window).off('scroll', Search.onScroll);
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
    $('a.tr-search-filter-item[data-value="' + value + '"]', $filter).parent('li').addClass('selected');
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
    delete Aj.state.searchBindToWrapEl;
    delete Aj.state.searchBindTo;
    if (Aj.state.searchBindPrevLangpack) {
      Search.changeLangpack(Aj.state.searchBindPrevLangpack, Aj.state.searchBindPrevValue, true);
      delete Aj.state.searchBindPrevLangpack;
      delete Aj.state.searchBindPrevValue;
    }
  },
  eOpen: function(e) {
    Search.focus();
  },
  focus: function(e) {
    $('.tr-search').addClass('tr-search-open');
    setTimeout(function(){ $('.tr-search-field').focus(); }, 100);
  },
  eLockScroll: function(e) {
    $('body').css('overflow', (e.type == 'mouseover' ? 'hidden' : ''));
  },
  eClearField: function(e) {
    $('.tr-search-field').val('').trigger('input');
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
    }
  },
  clearData: function(lang, lang_pack) {
    var data_key = lang + '_' + lang_pack;
    delete Search._data[data_key];
    delete Search._data[lang + '_'];
  },
  getData: function(lang, lang_pack, onDataReady) {
    var data_key = lang + '_' + lang_pack;
    var _data = Search._data[data_key];
    if (_data === false) {
      return false;
    } else if (_data) {
      return Search._data[data_key];
    }
    if (!lang_pack) {
      Search._data[data_key] = false;
      var checkReady = function() {
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
          Search._data[lang + '_'] = data;
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
      Search._data[data_key] = false;
      Aj.apiRequest('getLangPackFull', {
        lang: lang,
        lang_pack: lang_pack,
      }, function(result) {
        if (result.data) {
          Search.applyData(lang, result.data, result.rtl);
          onDataReady && onDataReady();
        } else {
          delete Search._data[data_key];
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
  _data: {}
};

var Screenshots = {
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
    if (screenshot_id && Aj.layerState) {
      Aj.layerState.$imgEl.fadeHide();
      Aj.layerState.$layerEl.fadeHide();
    }
    $.ajax({
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
          if (event.lengthComputable) {
            console.log('progress', event.loaded, event.total);
            // onProgress && onProgress(event.loaded, event.total);
          }
        });
        return xhr;
      },
      beforeSend: function(xhr) {
        console.log('progress', 0, 1);
        // onProgress && onProgress(0, 1);
      },
      success: function (data) {
        if (data.error) {
          if (screenshot_id && Aj.layerState) {
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
              if (result.error) {
                if (Aj.layerState) {
                  Aj.layerState.$imgEl.fadeShow();
                  Aj.layerState.$layerEl.fadeShow();
                }
                return showAlert(result.error);
              }
              if (Aj.layerState && result.src) {
                var $imgEl = Aj.layerState.$imgEl.clone();
                $imgEl.attr('src', result.src).addClass('ohide').insertBefore(Aj.layerState.$imgEl).one('load', function() {
                  if (Aj.layerState) {
                    Aj.layerState.$imgEl.remove();
                    Aj.layerState.$imgEl = $imgEl;
                    Aj.layerState.$layerEl.css('backgroundImage', 'url(\'' + result.src + '\')');
                    ScreenshotLayer.onImageLoading(true);
                    $imgEl.fadeShow();
                    Aj.layerState.$layerEl.fadeShow();
                  }
                }).one('error', function() {
                  if (Aj.layerState && Aj.layerState.$imgEl) {
                    Aj.layerState.$imgEl.fadeShow();
                  }
                });
              }
            });
          } else {
            Aj.apiRequest('addScreenshot', {
              lang: Aj.state.curLang,
              lang_pack: lang_pack || Aj.state.curLangpack,
              section: section,
              file_data: data.file_data
            }, function(result) {
              if (result.error) {
                return showAlert(result.error);
              }
              if (result.row) {
                $(result.row).insertBefore('.tr-screenshot-upload-row');
                $('.tr-screenshots').sortable('refresh');
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
        if (screenshot_id && Aj.layerState) {
          Aj.layerState.$imgEl.fadeShow();
          Aj.layerState.$layerEl.fadeShow();
        }
        showAlert('Network error');
      }
    });
  },
  orderChanged: function() {
    var screenshot_ids = [];
    $('.tr-screenshots > [data-screenshot-id]').map(function() {
      var screenshot_id = $(this).attr('data-screenshot-id');
      screenshot_ids.push(screenshot_id);
    });
    Aj.apiRequest('saveScreenshotsOrder', {
      lang_pack: Aj.state.curLangpack,
      section: Aj.state.curSection,
      screenshot_ids: screenshot_ids.join(',')
    }, function(result) {
      if (result.error) {
        showAlert(result.error);
      }
    });
  },
  eScreenshotClick: function(e) {
    if (!Aj.state.selection && !$(e.target).closest('.tr-selected-icon').size()) {
      return;
    }
    Screenshots.screenshotSelect($(this));
    e.stopImmediatePropagation();
    e.preventDefault();
  },
  screenshotSelect($screenEl) {
    $screenEl.toggleClass('selected');
    Screenshots.updateSelected();
  },
  updateSelected() {
    var $selectedEls = $('.tr-screenshot-row[data-screenshot-id].selected');
    var selectedCount = $selectedEls.size();
    var newSelection = selectedCount > 0;
    var $selectorBtn = $('.move-selected-btn');
    $selectorBtn.text($selectorBtn.attr('data-label').replace('%s', selectedCount));
    if (!Aj.state.selection !== !newSelection) {
      Aj.state.selection = newSelection;
      $('.tr-header-section-selector').fadeToggle(newSelection);
      $('.tr-screenshots').sortable('option', 'disabled', newSelection).toggleClass('selection', newSelection);
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
    $selectedEls.each(function() {
      var $screenEl = $(this);
      var screenshotId = $screenEl.attr('data-screenshot-id');
      Aj.apiRequest('editScreenshotSection', {
        lang_pack: Aj.state.curLangpack,
        lang: Aj.state.curLang,
        screenshot_id: screenshotId,
        section: section
      }, function(result) {
        if (!result.error) {
          $screenEl.remove();
          var $screenEls = $('.tr-screenshot-row[data-screenshot-id]');
          $('.tr-header-counter').text($screenEls.size() || '');
          $('.tr-screenshots').sortable('refresh');
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
    $('.tr-screenshots').sortable('refresh');
    Screenshots.updateSelected();
  },
  eSendScreenshotsToBottom: function(e) {
    var $selectedEls = $('.tr-screenshot-row[data-screenshot-id].selected');
    var selectedCount = $selectedEls.size();
    if (!selectedCount) return;
    $selectedEls.insertBefore('.tr-screenshot-upload-row').removeClass('selected');
    Screenshots.orderChanged();
    $('.tr-screenshots').sortable('refresh');
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
  getTextFromImage: function(img, x, y, width, height, onComplete, onProgress) {
    var crop_canvas = document.createElement('canvas');
    crop_canvas.width = width;
    crop_canvas.height = height;
    crop_canvas.getContext('2d').drawImage(img, x, y, width, height, 0, 0, width, height);
    Tesseract.recognize(crop_canvas)
    .progress(function(message) {
      onProgress && onProgress(message);
      console.log(message);
    })
    .then(function(result) {
      console.log(result);
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
      var $searchFieldEl = $('.screenshot-key-edit-field', Aj.layerEl);
      var $searchResultsEl = $('.screenshot-key-edit-results', Aj.layerEl);

      layerState.screenshotId = screenshot_id;
      layerState.screenshotLangpack = options.lang_pack;
      layerState.$bodyEl = $bodyEl;
      layerState.$imgEl = $imgEl;
      layerState.$imgBgEl = $imgBgEl;
      layerState.$layerEl = $layerEl;
      layerState.$layerWrapEl = $layerWrapEl;
      layerState.$searchFieldEl = $searchFieldEl;
      layerState.canEditScreenshot = options.can_edit_screenshot || false;
      layerState.canEditPhrases = options.can_edit_phrases || false;
      layerState.$keyEl = null;
      layerState.keyCoords = null;
      layerState.drawing = false;
      layerState.editMode = false;

      ScreenshotLayer.onImageLoading();

      Aj.layer.addClass('popup-no-close');
      Aj.layer.one('popup:open.curLayer', ScreenshotLayer.layerUpdate);
      $(document).on('keydown', ScreenshotLayer.onKeyDown);
      $(window).on('resize', ScreenshotLayer.layerUpdate);
      Aj.layer.on('click.curLayer', '.screenshot-close-btn', function() {
        closePopup();
      });
      Aj.layer.on('click.curLayer', '.screenshot-key', ScreenshotLayer.eOpenEdit);
      Aj.layer.on('click.curLayer', '.screenshot-key-remove', ScreenshotLayer.eRemoveScreenshotKey);
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
      if (layerState.canEditPhrases) {
        $searchFieldEl.initSearch({
          $results: $searchResultsEl,
          renderItem: function(item, query) {
            return '<div class="screenshot-key-row"><div class="screenshot-key-value-default">' + wrapLangValue(item.def_value, item.rtl, query) + '</div><div class="screenshot-key-lang-key">' + Search.wrapHighlight(item.key, query) + '</div></div></div>';
          },
          renderNoItems: function() {
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
        $layerEl.on('mousedown', ScreenshotLayer.eDrawKey);
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
      clearTimeout(Aj.layerState.imgTimeout);
      clearTimeout(Aj.layerState.hoverTimeout);
      $(document).off('keydown', ScreenshotLayer.onKeyDown);
      $(window).off('resize', ScreenshotLayer.layerUpdate);
      if (layerState.canEditPhrases) {
        layerState.$searchFieldEl.destroySearch();
        layerState.$layerEl.off('mousedown', ScreenshotLayer.eDrawKey);
        $(document).off('mousemove mouseup', ScreenshotLayer.eDrawKey);
        $('input.file-upload', layerState.$layerEl).off('change', Screenshots.eUpload);
      }
    });
  },
  onImageLoading: function(full) {
    if (!Aj.layerState) return;
    var img = Aj.layerState.$imgEl.get(0);
    if (img.naturalWidth && img.naturalHeight) {
      Aj.layerState.$bodyEl.removeClass('ohide');
      ScreenshotLayer.layerUpdate();
      if (full) {
        $('.screenshot-key', Aj.layerState.$layerEl).each(function() {
          var $keyEl = $(this),
              coords = $keyEl.attr('data-coordinates').split(',');
          ScreenshotLayer.updateScreenshotKeyPosition($keyEl, coords);
        });
      }
      return;
    }
    Aj.layerState.imgTimeout = setTimeout(ScreenshotLayer.onImageLoading, 50, full);
  },
  layerUpdate: function() {
    if (!Aj.layerState) return;
    var $imgEl = Aj.layerState.$imgEl;
    var $imgBgEl = Aj.layerState.$imgBgEl;
    var $layerWrapEl = Aj.layerState.$layerWrapEl;
    var $layerEl = Aj.layerState.$layerEl;
    var width = $imgEl.width();
    var height = $imgEl.height();
    var halfWidth = parseFloat($imgEl.css('width')) / 2;
    $imgBgEl.width(width).height(height);
    $layerWrapEl.width(width).height(height);
    $layerEl.css('backgroundSize', width + 'px ' + height + 'px');
    $('.screenshot-body-left', Aj.layer).css('marginRight', halfWidth + 'px');
    $('.screenshot-body-right', Aj.layer).css('marginLeft', halfWidth + 'px');
  },
  addScreenshotKey: function(coords) {
    if (!Aj.layerState) return;
    var $keyEl = $('<div class="screenshot-key key-hover screenshot-key-drawable screenshot-key-new"><div class="key-box"><div class="key-label"></div></div></div>');
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
      opacity: ScreenshotLayer.screenshotKeyIsAllowedSize(coords) ? 1 : 0
    });
    $keyEl.attr('data-coordinates', coords.join(','));
  },
  fixScreenshotKeyCoordinates: function(coords, precision) {
    var x = coords[0], y = coords[1], w = coords[2], h = coords[3];
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > 1) { w = 1 - x; }
    if (y + h > 1) { h = 1 - y; }
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
    if (e.type == 'mousedown') {
      if ($(e.target).closest('.screenshot-key').length) return;
      if (layerState.drawing) return;
    }
    e.preventDefault();
    e.stopPropagation();

    var $imgEl = layerState.$imgEl;
    var $layerEl = layerState.$layerEl;
    var $layerWrapEl = layerState.$layerWrapEl;
    var $keyEl = layerState.$keyEl;

    var parentOffset = $layerEl.offset();
    var relX = e.pageX - parentOffset.left;
    var relY = e.pageY - parentOffset.top;
    if (e.type == 'mousedown') {
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
        relX / $layerEl.width(),
        relY / $layerEl.height(),
        0,
        0
      ];
      layerState.$keyEl = ScreenshotLayer.addScreenshotKey(coords);
      layerState.keyCoords = coords;
      layerState.drawing = true;
      Aj.layer.addClass('popup-no-close');
      $(document).on('mousemove mouseup', ScreenshotLayer.eDrawKey);
      Search.getData(Aj.state.curLang, Aj.layerState.screenshotLangpack);
    }
    else if (e.type == 'mousemove') {
      if (!layerState.drawing) return;
      if ($keyEl && layerState.keyCoords) {
        var coords = layerState.keyCoords;
        coords[2] = relX / $layerEl.width() - coords[0];
        coords[3] = relY / $layerEl.height() - coords[1];
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
    else if (e.type == 'mouseup') {
      if (!layerState.drawing) return;
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
          Recognizer.getTextFromImage(img, x, y, width, height, function(text, coords) {
            if (!Aj.layerState || $keyEl !== Aj.layerState.$keyEl) return;
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
          });
        }
        layerState.keyCoords = null;
        $(document).off('mousemove mouseup', ScreenshotLayer.eDrawKey);
        setTimeout(function() {
          Aj.layer.removeClass('popup-no-close');
        }, 10);
      }
    }
  },
  addKeyToScreenshot: function($keyEl, lang_key, lang_item, coords, old_lang_key) {
    Aj.apiRequest('addKeyToScreenshot', {
      lang_pack: Aj.layerState.screenshotLangpack,
      lang_key: lang_key,
      screenshot_id: Aj.layerState.screenshotId,
      remove_lang_key: old_lang_key,
      x: coords[0],
      y: coords[1],
      w: coords[2],
      h: coords[3]
    }, function(result) {
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
        $keyEl.attr('data-key', lang_key);
        $('.key-label', $keyEl).html(wrapLangValue(lang_item.def_value));
        var $keys = $('.screenshot-layer-keys', Aj.layer);
        var base_url = $keys.attr('data-key-base-url') || '';
        $('<a href="' + Search.wrapHighlight(base_url + lang_key) + '" class="screenshot-key-row key-hover" data-key="' + Search.wrapHighlight(lang_key) + '"><span class="screenshot-key-remove close"></span><div class="screenshot-key-value-default">' + wrapLangValue(lang_item.value) + '</div><div class="screenshot-key-lang-key">' + Search.wrapHighlight(lang_key) + '</div></div></a>').appendTo($keys);
        ScreenshotLayer.sortKeysByCoordinates();
        var $keysList = $('.screenshot-keys-list', Aj.layer);
        var $keysCounterEl = $('.tr-header-counter', $keysList);
        var keys_count = parseInt($keysCounterEl.text(), 10) || 0;
        $keysCounterEl.text(++keys_count || '');
        $keysList.fadeToggle(keys_count > 0);
      }
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
    var screenshot_id = Aj.layerState.screenshotId;
    if (lang_key) {
      var confirm_text = l('WEB_REMOVE_SCREENSHOT_KEY_CONFIRM_TEXT', {lang_key: cleanHTML(lang_key), n: screenshot_id});
      showConfirm(confirm_text, function() {
          Aj.apiRequest('removeKeyFromScreenshot', {
            lang_pack: Aj.layerState.screenshotLangpack,
            lang_key: lang_key,
            screenshot_id: screenshot_id
          }, function(result) {
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
    var confirm_text = l('WEB_REMOVE_SCREENSHOT_CONFIRM_TEXT', {n: screenshot_id});
    showConfirm(confirm_text, function() {
      Aj.apiRequest('removeScreenshot', {
        lang_pack: Aj.layerState.screenshotLangpack,
        screenshot_id: screenshot_id
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        $('.tr-screenshot-row[data-screenshot-id="' + screenshot_id + '"]').remove();
        $('.tr-screenshots').sortable('refresh');
        closePopup(Aj.layer);
      });
    }, l('WEB_REMOVE_SCREENSHOT_CONFIRM_BUTTON'));
  },
  eEditScreenshotSection: function(e) {
    if (!Aj.layerState) return;
    e.stopPropagation();
    var section = $(this).attr('data-section');
    if ($(this).parents('li').hasClass('selected')) {
      return;
    }
    Aj.apiRequest('editScreenshotSection', {
      lang_pack: Aj.layerState.screenshotLangpack,
      lang: Aj.state.curLang,
      screenshot_id: Aj.layerState.screenshotId,
      section: section
    }, function(result) {
      if (!Aj.layerState) return;
      if (result.sections_html) {
        $('.screenshot-sections', Aj.layer).html(result.sections_html);
      }
      if (section != Aj.state.curSection) {
        $('.tr-screenshot-row[data-screenshot-id="' + Aj.layerState.screenshotId + '"]').remove();
        $('.tr-screenshots').sortable('refresh');
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
    if (!Aj.layerState.canEditPhrases) return;
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
    Aj.apiRequest('editScreenshotDescription', {
      lang_pack: Aj.layerState.screenshotLangpack,
      screenshot_id: Aj.layerState.screenshotId,
      description: form.description.value
    }, function(result) {
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
  onKeyDown: function(e) {
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
  init: function() {
    Aj.onLoad(function(state) {
      $(document).on('click.curPage', '.load-more-btn', LoadMore.onClick);
      $(window).on('scroll', LoadMore.onScroll);
    });
    Aj.onUnload(function(state) {
      $(window).off('scroll', LoadMore.onScroll);
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
    var offset = $loadMore.data('offset');
    if (!offset) {
      $loadMore.remove();
    }
    if ($loadMore.data('loading')) {
      return;
    }
    var $loadMoreBtn = $('.load-more-btn', $loadMore);
    $loadMoreBtn.data('old-text', $loadMoreBtn.text()).text('Loading').addClass('dots-animated');
    $loadMore.data('loading', true);
    $.ajax(Aj.location().href, {
      type: 'POST',
      data: {
        offset: offset,
        offset_data: $loadMore.data('offset-data'),
        more: 1
      },
      dataType: 'json',
      xhrFields: {withCredentials: true},
      success: function(result) {
        $loadMore.data('loading', false);
        if (result.more_html) {
          var $loadMoreCont = $loadMore.parents('.load-more-container');
          if (!$loadMoreCont.size()) {
            console.warn('.load-more-container not found!');
          }
          $loadMore.remove();
          $loadMoreCont.append(result.more_html);
        } else {
          var $loadMoreBtn = $('.load-more-btn', $loadMore);
          $loadMoreBtn.text($loadMoreBtn.data('old-text')).removeClass('dots-animated');
        }
      },
      error: function(xhr) {
        $loadMore.data('loading', false);
        var $loadMoreBtn = $('.load-more-btn', $loadMore);
        $loadMoreBtn.text($loadMoreBtn.data('old-text')).removeClass('dots-animated');
      }
    });
  }
}

var LangKey = {
  init: function($blockEl) {
    $('input.file-upload', $blockEl).on('change', Screenshots.eUpload);
    $('.key-add-suggestion-field', $blockEl).on('focus.curBlock blur.curBlock keyup.curBlock change.curBlock input.curBlock', LangKey.eUpdateAddSuggestionField);
    $('.key-add-suggestion-header-wrap', $blockEl).on('click', LangKey.eToggleSuggestionForm);
    $('.add-suggestion-form .form-cancel-btn', $blockEl).on('click', LangKey.eHideSuggestionForm);
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
    $blockEl.on('click.curBlock', '.key-suggestion-like', LangKey.eLikeSuggestion.pbind('liked'));
    $blockEl.on('click.curBlock', '.key-suggestion-dislike', LangKey.eLikeSuggestion.pbind('disliked'));
    $blockEl.on('click.curBlock', '.key-suggestion-comment', LangKey.eCommentSuggestion);
    $blockEl.on('click.curBlock', '.key-status-apply-btn', LangKey.eApplySuggestion);
    $blockEl.on('click.curBlock', '.key-suggestion-edit', LangKey.eEditSuggestion);
    $blockEl.on('click.curBlock', '.key-suggestion-delete', LangKey.eDeleteSuggestion);
    $blockEl.on('click.curBlock', '.key-suggestion-restore', LangKey.eRestoreSuggestion);
    $blockEl.on('click.curBlock', '.key-suggestion-delete-all', LangKey.eDeleteAllSuggestions);
    $blockEl.on('click.curBlock', '.mark-as-translated-btn', LangKey.eMarkAsTranslated);
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
    $blockEl.off('.curBlock');
  },
  eUpdateAddSuggestionField: function(e) {
    var $fieldEl = $(this);
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
    Aj.apiRequest('suggestionAddComment', {
      lang: lang,
      lang_pack: lang_pack,
      section: section,
      lang_key: lang_key,
      suggestion_id: suggestion_id,
      reply_to_id: reply_to_id,
      text: form.text.value
    }, function(result) {
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
      callback && callback();
    } else {
      if ($wrapEl.hasClass('key-suggestion-collapsed') !== !state) {
        $commentsEl.prepareSlideY(callback);
        $wrapEl.toggleClass('key-suggestion-collapsed', !state);
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
    Aj.apiRequest('editKeyDescription', {
      lang_pack: lang_pack,
      lang_key: lang_key,
      description: form.description.value
    }, function(result) {
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
    var confirm_text = l('WEB_REMOVE_LANG_KEY_CONFIRM_TEXT', {lang_key: cleanHTML(lang_key)});
    showConfirm(confirm_text, function() {
      Aj.apiRequest('removeLangKey', {
        lang_pack: lang_pack,
        lang: lang,
        section: section,
        lang_key: lang_key
      }, function(result) {
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
    var confirm_text = l('WEB_RESTORE_LANG_KEY_CONFIRM_TEXT', {lang_key: cleanHTML(lang_key)});
    showConfirm(confirm_text, function() {
      Aj.apiRequest('restoreLangKey', {
        lang_pack: lang_pack,
        lang: lang,
        section: section,
        lang_key: lang_key
      }, function(result) {
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
    var callback = function(result) {
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
    Aj.apiRequest('suggestionDeleteComment', {
      lang_pack: lang_pack,
      lang: lang,
      lang_key: lang_key,
      suggestion_id: suggestion_id,
      comment_id: comment_id
    }, function(result) {
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
    Aj.apiRequest('suggestionRestoreComment', {
      lang_pack: lang_pack,
      lang: lang,
      lang_key: lang_key,
      suggestion_id: suggestion_id,
      comment_id: comment_id
    }, function(result) {
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
    var author = $curCommentEl.attr('data-author');
    Aj.apiRequest('suggestionDeleteAllComments', {
      lang: Aj.state.curLang,
      author: author,
      confirm_only: 1
    }, function(result) {
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.confirm_text) {
        showConfirm(result.confirm_text, function() {
          Aj.apiRequest('suggestionDeleteAllComments', {
            lang: Aj.state.curLang,
            author: author
          }, function(result) {
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
    var $replyEl = $('<div class="comment-reply"><div class="comment-reply-cancel close"></div><div class="comment-head"></div></div>');
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
    var section = $(this).attr('data-section');
    var $keyBlock = $(this).parents('.tr-key-full-block');
    var lang = $keyBlock.attr('data-lang');
    var lang_pack = $keyBlock.attr('data-langpack');
    var lang_key = $keyBlock.attr('data-key');
    var method = $(this).parents('li').hasClass('selected') ? 'removeKeyFromSection' : 'addKeyToSection';
    Aj.apiRequest(method, {
      lang_pack: lang_pack,
      lang: lang,
      section: section,
      lang_key: lang_key
    }, function(result) {
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
    var likes = {
      likes: +$('.key-suggestion-like', $counters).text() || 0,
      dislikes: +$('.key-suggestion-dislike', $counters).text() || 0,
      state: state
    };
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
      if (result.error) {
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
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.ok) {
        Search.clearData(lang, lang_pack);
        LangKey.editSuggestion($wrap, true);
        LangKey.clearHistory($wrap.parents('.tr-key-full-block'));
        $('.key-suggestion-wrap.key-suggestion-applied').removeClass('key-suggestion-applied');
        $('.key-suggestion-wrap.key-suggestion-custom').slideHide('remove');
        $wrap.clone().addClass('key-suggestion-applied shide').prependTo('.key-suggestions').slideShow();
        $('.key-default-value .tr-value-untranslated').fadeHide();
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
    var confirm_text = l('WEB_MARK_AS_TRANSLATED_CONFIRM_TEXT', {lang_key: cleanHTML(lang_key)});
    showConfirm(confirm_text, function() {
      Aj.apiRequest('markAsTranslated', {
        lang: lang,
        lang_pack: lang_pack,
        section: section,
        lang_key: lang_key
      }, function(result) {
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
    var author = $curWrap.attr('data-author');
    Aj.apiRequest('suggestionDeleteAll', {
      lang: Aj.state.curLang,
      author: author,
      confirm_only: 1
    }, function(result) {
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.confirm_text) {
        showConfirm(result.confirm_text, function() {
          Aj.apiRequest('suggestionDeleteAll', {
            lang: Aj.state.curLang,
            author: author
          }, function(result) {
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
    if ($(e.target).closest('form.key-description-form,a').size()) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    var $defaultEl = $(this);
    var $keyBlock = $defaultEl.parents('.tr-key-full-block');
    var $historyWrapEL = $('.key-history-wrap', $keyBlock);
    var $history = $('.key-history', $historyWrapEL);
    if ($history.size()) {
      $history.slideToggle();
    } else {
      if ($historyWrapEL.data('loading')) {
        return;
      }
      $historyWrapEL.html('<div class="key-history"><div class="tr-key-history-row"><div class="tr-key-history-row-loading dots-animated">' + l('WEB_TRANSLATIONS_LOADING') + '</div></div></div>');
      $('.key-history', $historyWrapEL).addClass('shide').slideShow();
      $historyWrapEL.data('loading', true);
      var lang = $keyBlock.attr('data-lang');
      var lang_pack = $keyBlock.attr('data-langpack');
      var lang_key = $keyBlock.attr('data-key');
      Aj.apiRequest('getKeyHistory', {
        lang: lang,
        lang_pack: lang_pack,
        lang_key: lang_key
      }, function(result) {
        $historyWrapEL.data('loading', false);
        if (result.error) {
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
    $linesWrapEL.slideToggle();
    $releasesWrapEL.toggleClass('open');
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
    if (lang_key && bind_lang_key) {
      Aj.apiRequest('bindKeys', {
        lang_pack: lang_pack,
        lang: lang,
        section: section,
        lang_key: lang_key,
        lang_pack2: bind_lang_pack,
        lang_key2: bind_lang_key
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        if (result.bindings_html) {
          $oldBindings = $('.binding-items');
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
    Aj.apiRequest('unbindKey', {
      lang_pack: lang_pack,
      lang: lang,
      section: section,
      lang_key: lang_key,
      lang_pack2: bind_lang_pack,
      lang_key2: bind_lang_key
    }, function(result) {
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.bindings_html) {
        $oldBindings = $('.binding-items');
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
  init: function() {
    $('.tr-content').on('change.curPage', '.tr-key-row input.file-upload', Screenshots.eUpload);
    $('.tr-content').on('click.curPage', '.tr-key-row input.file-upload', stopImmediatePropagation);
    $('.tr-content').on('click.curPage', '.tr-key-row[data-href]', LangKeys.eOpenKey);
    LoadMore.init();
  },
  destroy: function() {
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
  init: function() {
    Aj.onLoad(function(state) {
      $(document).on('click.curPage', '.tr-share-link-copy', Share.copyLink);
      $(document).on('click.curPage', '.tr-share-link', Share.selectLink);
    });
  },
  selectLink: function() {
    $('.tr-share-link').focus().select();
  },
  copyLink: function() {
    Share.selectLink();
    document.execCommand('copy');
    $('.tr-share-link-copy').fadeHide();
    $('.tr-share-link-copied').fadeShow();
    setTimeout(function() {
      $('.tr-share-link-copy').fadeShow();
      $('.tr-share-link-copied').fadeHide();
    }, 2000);
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

var UnreleasedKeys = {
  init: function() {
    Aj.onLoad(function(state) {
      $(document).on('click.curPage', '.tr-plain-key-row', UnreleasedKeys.toggleRow);
      $(document).on('click.curPage', '.push-selected-btn', UnreleasedKeys.pushSelected);
      $(document).on('click.curPage', '.push-btn', UnreleasedKeys.pushAll);
    });
  },
  toggleRow: function(e) {
    $(this).toggleClass('selected');
    UnreleasedKeys.updateButtonsState();
  },
  updateButtonsState: function() {
    var selected_cnt = $('.tr-plain-key-row-wrap:not(.shide) .tr-plain-key-row.selected').size();
    $('.push-selected-btn').fadeToggle(selected_cnt > 0);
  },
  pushSelected: function(e) {
    var $rows = $('.tr-plain-key-row.selected');
    if (!$rows.size()) return;
    showConfirm(l('WEB_PUSH_SELECTED_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      UnreleasedKeys.pushToProduction(grouped_rows);
    }, l('WEB_PUSH_SELECTED_PHRASES_CONFIRM_BUTTON'));
  },
  pushAll: function(e) {
    var $rows = $('.tr-plain-key-row');
    if (!$rows.size()) return;
    showConfirm(l('WEB_PUSH_ALL_PHRASES_CONFIRM_TEXT'), function() {
      var grouped_rows = LangKeys.groupKeyRows($rows);
      UnreleasedKeys.pushToProduction(grouped_rows);
    }, l('WEB_PUSH_ALL_PHRASES_CONFIRM_BUTTON'));
  },
  hideRows: function($rows) {
    var $rowsWrap = $rows.parents('.tr-plain-key-row-wrap');
    var $counterEl = $('section.content .tr-header-counter');
    var cnt = $('.tr-plain-key-row-wrap:not(.shide)').not($rowsWrap).size();
    $counterEl.text(cnt || '');
    if ($rows.size() > 3) {
      $rowsWrap.remove();
    } else {
      $rowsWrap.slideHide('remove');
    }
    $('.tr-plain-key-row-empty-wrap').fadeToggle(!cnt);
    UnreleasedKeys.updateButtonsState();
  },
  toggleProcessing: function(show) {
    $('.tr-header-processing').fadeToggle(show);
    if (!show) {
      var $counterEl = $('section.content .tr-header-counter');
      $('.tr-header-buttons').fadeToggle(!!$counterEl.text());
    } else {
      $('.tr-header-buttons').fadeToggle(false);
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
    var lang_keys = keys_item.$rows.map(function() {
      return $(this).attr('data-key');
    }).get().join(',');
    Aj.apiRequest('pushToProduction', {
      lang_pack: keys_item.lang_pack,
      lang: keys_item.lang,
      lang_keys: lang_keys
    }, function(result) {
      if (result.ok) {
        UnreleasedKeys.hideRows(keys_item.$rows);
        setTimeout(function() {
          if (Aj.state.pushProcessing) {
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
  init: function() {
    Aj.onLoad(function(state) {
      $(document).on('click.curPage', '.tr-languages-table .checkbox', Languages.toggleLanguage);
    });
  },
  toggleLanguage: function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!this.checked) {
      return false;
    }
    var $td = $(this).parents('td');
    showConfirm(l('WEB_ENABLE_LANGUAGE_CONFIRM_TEXT'), function() {
      Languages.enableLanguage($td);
    }, l('WEB_ENABLE_LANGUAGE_CONFIRM_BUTTON'));
  },
  enableLanguage: function($td) {
    var lang = $td.attr('data-lang');
    var lang_pack = $td.attr('data-langpack');
    Aj.apiRequest('enableLanguage', {
      lang: lang,
      lang_pack: lang_pack
    }, function(result) {
      if (result.ok) {
        $td.removeClass('prepare').removeClass('ready');
        if ($td.hasClass('unavailable')) {
          $td.removeClass('unavailable').addClass('attention');
        }
        $('.checkbox', $td).prop('checked', true).prop('disabled', true);
      }
      if (result.error) {
        return showAlert(result.error);
      }
    });
  }
};

var Members = {
  init: function() {
    Aj.onLoad(function(state) {
      $('.tr-members-add-form').on('submit', Members.eSubmitAddForm);
      $(document).on('click.curPage', '.delete-member-btn', Members.eDeleteMember);
      $(document).on('click.curPage', '.add-member-btn', Members.eAddMember);
    });
    Aj.onUnload(function(state) {
      $('.tr-members-add-form').off('submit', Members.eSubmitAddForm);
    });
  },
  eSubmitAddForm: function(e) {
    e.preventDefault();
    var form = this;
    var $blockEl = $(this).parents('.tr-members-block');
    var level = $blockEl.attr('data-level');
    Aj.apiRequest('rightsAddMember', {
      level: level,
      query: this.query.value
    }, function(result) {
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
    var level = $(this).attr('data-level');
    var $blockEl = $('.tr-members-block').filter(function() {
      return this.getAttribute('data-level') == level;
    });
    var $rowEl = $(this).parents('.tr-member-row-wrap');
    var member_id = $rowEl.attr('data-member-id');
    Members.addMember(level, member_id);
  },
  addMember: function(level, member_id) {
    Aj.apiRequest('rightsAddMember', {
      level: level,
      member_id: member_id,
    }, function(result) {
      if (result.member_html) {
        $('.tr-member-row-wrap').filter(function() {
          return this.getAttribute('data-member-id') == member_id;
        }).find('.add-member-btn').fadeHide();
        var $blockEl = $('.tr-members-block').filter(function() {
          return this.getAttribute('data-level') == level;
        });
        $(result.member_html).addClass('shide').appendTo($('.tr-members', $blockEl)).slideShow();
        $('.tr-header-counter', $blockEl).text($('.tr-member-row-wrap', $blockEl).size() || '');
      }
      if (result.error) {
        return showAlert(result.error);
      }
    });
  },
  eDeleteMember: function() {
    var $blockEl = $(this).parents('.tr-members-block');
    var level = $blockEl.data('level');
    var $rowEl = $(this).parents('.tr-member-row-wrap');
    var member_id = $rowEl.attr('data-member-id');
    Aj.apiRequest('rightsDeleteMember', {
      level: level,
      member_id: member_id,
    }, function(result) {
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
        return showAlert(result.error);
      }
    });
  }
};

var ImportKeys = {
  eUpload: function(e) {
    var file = this.files && this.files[0] || null;
    if (!file) return;
    ImportKeys.upload(file);
    this.value = '';
  },
  upload: function(file) {
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
          if (event.lengthComputable) {
            ImportKeys.onProgress(event.loaded, event.total);
          }
        });
        return xhr;
      },
      beforeSend: function(xhr) {
        ImportKeys.onProgress(0, 1);
      },
      success: function (result) {
        $('.tr-upload-row').attr('data-label', l('WEB_IMPORT_UPLOAD_FILE'));
        $('.tr-upload-row-progress').width(0);
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
        $('.tr-upload-row').attr('data-label', l('WEB_IMPORT_UPLOAD_FILE'));
        $('.tr-upload-row-progress').width(0);
        showAlert('Network error');
      }
    });
    $('.tr-keys-blocks').html('');
  },
  onProgress: function(loaded, total) {
    var progress = total ? loaded / total : 0;
    progress = Math.max(0, Math.min(progress, 1)) * 100;
    $('.tr-upload-row').attr('data-label', progress >= 100 ? l('WEB_IMPORT_PROCESSING') : l('WEB_IMPORT_UPLOADING', {percent: Math.round(progress)}));
    $('.tr-upload-row-progress').width(progress + '%');
  },
  toggleRow: function(e) {
    $(this).toggleClass('selected');
    var $blockEl = $(this).parents('.tr-keys-block');
    ImportKeys.updateButtonsState($blockEl);
  },
  updateButtonsState: function($blockEl) {
    var selected_cnt = $('.tr-plain-key-row.selected', $blockEl).size();
    $('.selected-btn', $blockEl).fadeToggle(selected_cnt > 0);
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
    Aj.apiRequest(method, {
      lang_pack: lang_pack,
      lang: lang,
      import_id: Aj.state.importId,
      lang_keys: lang_keys.join(','),
      affected_cnt: affected_cnt || 0
    }, function(result) {
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
    $affectedRows = $rows.filter(function() {
      return !!langKeysMap[$(this).attr('data-key')];
    });
    ImportKeys.hideRows($affectedRows);
    if (!$('.tr-keys-block:not(.shide)').size()) {
      $('.tr-keys-block-empty').fadeShow();
    }
  }
};

var LangEditLayer = {
  init: function() {
    Aj.onLayerLoad(function(layerState) {
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
      $('.language-locale', Aj.layer).destroyDropdown();
      $('.language-code', Aj.layer).off('input keyup', LangEditLayer.onCodeKeyUp);
      $('form', Aj.layer).off('submit', LangEditLayer.eSubmitForm);
    });
  },
  onCodeKeyUp: function() {
    clearTimeout(Aj.layerState.lcTimeout);
    Aj.layerState.lcTimeout = setTimeout(function() {
      var short_name = $('.language-code', Aj.layer).val();
      LangEditLayer.checkShortName(short_name);
    }, 300);
  },
  checkShortName: function(short_name) {
    $checkStatus = $('.language-code-check-status', Aj.layer);
    $languageCodeItem = $('.language-code', Aj.layer).parents('.textfield-item');
    Aj.apiRequest('checkLanguage', {
      short_name: short_name,
      official: Aj.layerState.official
    }, function(result) {
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
    var cur_lang = Aj.layerState.curLang;
    if (!cur_lang) {
      var $languageCode = $('.language-code', Aj.layer);
      var short_name    = $languageCode.val();
      if (!short_name || !Aj.layerState.lastShortNameCheck) {
        $languageCode.focus();
        return false;
      }
    }
    var $languageName = $('.language-name', Aj.layer);
    var lang_name     = $languageName.val();
    if (!lang_name) {
      $languageName.focus();
      return false;
    }
    var $languageNativeName = $('.language-native-name', Aj.layer);
    var lang_native_name    = $languageNativeName.val();
    if (!lang_native_name) {
      $languageNativeName.focus();
      return false;
    }
    if (!cur_lang) {
      var lang_locale = Aj.layerState.languageLocale;
      if (!lang_locale) {
        $('.language-locale .form-control-dropdown-select', Aj.layer).focus();
        return false;
      }
    }
    var lang_base_lang = Aj.layerState.languageBaseLang;
    if (cur_lang) {
      Aj.apiRequest('editLanguage', {
        lang: cur_lang,
        lang_name: lang_name,
        lang_native_name: lang_native_name,
        lang_base_lang: lang_base_lang
      }, function(result) {
        if (result.error) {
          showAlert(result.error);
        }
        if (result.ok) {
          closePopup(Aj.layer);
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
        official: Aj.layerState.official
      }, function(result) {
        if (result.error) {
          showAlert(result.error);
        }
        if (result.ok) {
          closePopup(Aj.layer);
          if (result.href) {
            Aj.location(result.href);
          }
        }
      });
    }
  }
};

var TeamAddLayer = {
  init: function() {
    Aj.onLayerLoad(function(layerState) {
      $field   = $('.tr-team-add-search-field');
      $results = $('.tr-team-add-results');
      $field.initSearch({
        $results: $results,
        emptyQueryEnabled: true,
        updateOnInit: true,
        enterEnabled: function() {
          return false;
        },
        renderItem: function(item, query) {
          return '<div class="tr-member-row"><div class="tr-member-photo">' + item.photo + '</div><div class="tr-member-body' + (!item.info.length ? ' tr-member-name-only' : '') + '"><div class="tr-member-name">' + item.title + '</div><div class="tr-member-info">' + item.info + '</div></div></div>';
        },
        // renderNoItems: function() {
        //   return '<div class="tr-languages-no-results">' + l('WEB_NO_LANGUAGES_FOUND') + '</div>';
        // },
        getData: function() {
          return TeamAddLayer.getCandidatesData();
        },
        onSelect: function(item) {
          Members.addMember(Aj.layerState.level, item.id);
          closePopup(Aj.layer);
        },
        onInput: function(value) {
          Aj.layerState.foundCandidate = false;
          $('.tr-team-add-search-field').trigger('datachange');
          clearTimeout(Aj.layerState.searchTimeout);
          Aj.layerState.searchTimeout = setTimeout(TeamAddLayer.searchMember, 600, value);
        }
      });
      Aj.layer.one('popup:open', function() {
        $field.focus();
      });
    });
    Aj.onLayerUnload(function(layerState) {
      clearTimeout(Aj.layerState.searchTimeout);
      $field.destroySearch();
    });
  },
  searchMember: function(query) {
    Aj.apiRequest('rightsSearchMember', {
      level: Aj.layerState.level,
      query: query
    }, function(result) {
      if (Aj.layerState && result.candidate) {
        var item = result.candidate;
        if (Aj.layerState.candidatesDataMap[item.id]) {
          Aj.layerState.candidatesDataMap[item.id]._values.unshift(query);
        } else {
          item._values = [query];
          Aj.layerState.foundCandidate = item;
        }
        $('.tr-team-add-search-field').trigger('datachange');
      }
    });
  },
  getCandidatesData: function() {
    if (!Aj.layerState.candidatesDataMap) {
      Aj.layerState.candidatesDataMap = {};
      var data = Aj.layerState.candidatesData;
      for (var i = 0; i < data.length; i++) {
        var item = data[i];
        item._values = [item.name.toLowerCase()];
        Aj.layerState.candidatesDataMap[item.id] = item;
      }
    }
    return (Aj.layerState.foundCandidate ? [Aj.layerState.foundCandidate] : []).concat(Aj.layerState.candidatesData);
  }
};

var ImportTranslationsLayer = {
  init: function() {
    Aj.onLayerLoad(function(layerState) {
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
      $('.search-phrases-btn', Aj.layer).off('click', ImportTranslationsLayer.searchPhrases);
      $('.import-phrases-btn', Aj.layer).off('click', ImportTranslationsLayer.importPhrases);
    });
  },
  searchPhrases: function(e) {
    e.preventDefault();
    Aj.layerState.isImport = false;
    Aj.layerState.inProgress = true;
    Aj.layerState.phrasesCount = 0;
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
    $('.phrases-progress', Aj.layer).html(l('WEB_IMPORT_POPUP_PHRASES_IMPORTED', {n: Aj.layerState.importedCount, total: Aj.layerState.phrasesCount}));
    ImportTranslationsLayer.importTranslations();
    $('.import-phrases-btn', Aj.layer).addClass('hide');
    $('.popup-cancel-btn', Aj.layer).html(l('WEB_IMPORT_CANCEL_BUTTON'));
  },
  importTranslations: function(lang_code) {
    Aj.apiRequest('importTranslations', {
      lang_pack: Aj.layerState.curLangpack,
      lang: lang_code || '',
      search_only: Aj.layerState.isImport ? 0 : 1,
      phrases_cnt: Aj.layerState.isImport ? Aj.layerState.importedCount : Aj.layerState.phrasesCount
    }, function(result) {
      if (result.error) {
        return showAlert(result.error);
      }
      if (Aj.layer) {
        if (Aj.layerState.isImport) {
          if (result.phrases_cnt) {
            Aj.layerState.importedCount = result.phrases_cnt;
            $('.phrases-progress', Aj.layer).html(l('WEB_IMPORT_POPUP_PHRASES_IMPORTED', {n: Aj.layerState.importedCount, total: Aj.layerState.phrasesCount}));
          }
        } else {
          if (result.langs_total) {
            $('.langs-progress', Aj.layer).html(l('WEB_IMPORT_POPUP_LANGUAGES_PROCESSED', {n: result.langs_cnt, total: result.langs_total}));
          }
          if (result.phrases_cnt) {
            Aj.layerState.phrasesCount = result.phrases_cnt;
            $('.phrases-progress', Aj.layer).html(l('WEB_IMPORT_POPUP_PHRASES_PROCESSED', {n: Aj.layerState.phrasesCount}));
          }
        }
        if (result.next_lang) {
          ImportTranslationsLayer.importTranslations(result.next_lang);
        } else {
          $('.popup-cancel-btn', Aj.layer).html(l('WEB_IMPORT_CLOSE_BUTTON'));
          Aj.layerState.inProgress = false;
          if (!Aj.layerState.isImport) {
            $('.import-phrases-btn', Aj.layer).fadeShow();
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
  init: function(suggestions_mode) {
    Aj.onLoad(function(state) {
      var $field = $('.tr-search-field');
      var $panel = $('.tr-search-emoji-panel');
      state.$esResults = $('.tr-emoji-keywords');
      $('.header-search-btn').on('click', EmojiSearch.eOpen);
      $('.tr-search-reset').on('click', EmojiSearch.eClearField);
      $('.tr-search-field-wrap').on('mousedown.esearch', '.tr-search-emoji-icon,.tr-search-filters', stopImmediatePropagation);
      $('.tr-search-field-wrap').on('mousedown.esearch', EmojiSearch.eOpen);
      $('.tr-search-emoji-icon').on('click.esearch', EmojiSearch.eToggleMode);
      $('.tr-emoji-keyword-add-form').on('submit', EmojiSearch.eSubmit);
      $('.tr-emoji-keyword-add-form .btn-default').on('click', EmojiSearch.eCancel);
      $('.tr-emoji-keyword-new .tr-back').on('click', EmojiSearch.eCancel);
      $('.tr-emoji-keywords-suggestion-btn').on('click', EmojiSearch.eSuggestionsOpen);
      $('.tr-emoji-keywords-suggestion-header .tr-back').on('click', EmojiSearch.eSuggestionsClose);
      state.$esResults.on('click.esearch', '.tr-emoji-add,.keyword-def', EmojiSearch.eEmojiAdd);
      state.$esResults.on('click.esearch', '.tr-emoji-delete', EmojiSearch.eEmojiDelete);
      state.$esResults.on('click.esearch', '.tr-emoji-keyword-wrap', EmojiSearch.eKeywordToggle);
      state.$esResults.on('click.esearch', '.keyword-md,.emoji-md', EmojiSearch.eEmojiKeywordSelect);
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
          var delete_btn = Aj.state.canEdit ? '<div class="tr-emoji-delete' + (item.s ? ' decline' : '') + ' close"></div>' : '';
          var add_btn = '<button class="btn btn-primary btn-sm tr-emoji-add need-auth">' + l('WEB_EMOJI_KEYWORD_ADD_BUTTON') + '</button>';
          console.log(item);
          var sugg_header = item.s && !Aj.state.suggestionsMode ? '<h4 class="tr-emoji-keyword-subheader">' + l('WEB_EMOJI_KEYWORD_SUGGESTIONS_HEADER') + '</h4>' : '';
          if (Aj.state.byEmojiMode) {
            var html = '', keywords = [];
            var emoji_html = EmojiSearch.emojiHtml(item.e);
            for (var i = 0; i < item.k.length; i++) {
              var keyword_html = '<span class="keyword-md">' + Search.wrapHighlight(item.k[i], query, false, true) + '</span>';
              html += '<div class="tr-emoji-keyword by-emoji">' + delete_btn + add_btn + '<div class="tr-emoji">' + emoji_html + '</div><div class="tr-keyword">' + keyword_html + '</div></div>';
              keywords.push(keyword_html);
            }
            if (keywords.length > 1) {
              return sugg_header + '<div class="tr-emoji-keyword-wrap collapsed"><div class="tr-emoji-keyword-multi"><div class="tr-emoji-keyword by-emoji">' + delete_btn + add_btn + '<div class="tr-emoji">' + emoji_html + '</div><div class="tr-keyword">' + keywords.join('<br>\n') + '</div></div></div><div class="tr-emoji-keyword-by-one by-emoji">' + html + '</div></div>';
            } else if (!keywords.length) {
              var def_keywords = Aj.state.defKeywords && Aj.state.defKeywords[strEmojiToHex(item.e)] || [];
              var def_keywords_htmls = [];
              for (var i = 0; i < def_keywords.length; i++) {
                var keyword_html = '<span class="keyword-def">' + Search.wrapHighlight(def_keywords[i], query, false, true) + '</span>';
                def_keywords_htmls.push(keyword_html);
              }
              return sugg_header + '<div class="tr-emoji-keyword-wrap collapsed"><div class="tr-emoji-keyword by-emoji">' + add_btn + '<div class="tr-emoji">' + emoji_html + '</div><div class="tr-keyword default">' + def_keywords_htmls.join('<br>\n') + '</div></div></div>';
            } else {
              return sugg_header + '<div class="tr-emoji-keyword-wrap collapsed">' + html + '</div>';
            }
          } else {
            var html = '', emojis = [];
            var query_hex = strEmojiToHex(query);
            var keyword_html = '<span class="keyword-md">' + Search.wrapHighlight(item.k, query, false, true) + '</span>';
            for (var i = 0; i < item.e.length; i++) {
              var emoji_html = EmojiSearch.emojiHtml(item.e[i]);
              html += '<div class="tr-emoji-keyword by-keyword">' + delete_btn + add_btn + '<div class="tr-emoji">' + emoji_html + '</div><div class="tr-keyword">' + keyword_html + '</div></div>';
              emojis.push(emoji_html);
            }
            if (emojis.length > 1) {
              return sugg_header + '<div class="tr-emoji-keyword-wrap collapsed"><div class="tr-emoji-keyword-multi"><div class="tr-emoji-keyword by-keyword">' + delete_btn + add_btn + '<div class="tr-emoji">' + emojis.join('') + '</div><div class="tr-keyword">' + keyword_html + '</div></div></div><div class="tr-emoji-keyword-by-one by-keyword">' + html + '</div></div>';
            } else {
              return sugg_header + '<div class="tr-emoji-keyword-wrap collapsed">' + html + '</div>';
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
      if (suggestions_mode) {
        EmojiSearch.toggleSuggestions(true);
      }
    });
    Aj.onUnload(function(state) {
      var $field = $('.tr-search-field');
      $field.destroySearch();
      $('.header-search-btn').off('click', EmojiSearch.eFocus);
      $('.tr-search-reset').off('click', EmojiSearch.eClearField);
      $('.tr-search-field-wrap').off('.esearch');
      $('.tr-search-emoji-icon').off('.esearch');
      $('.tr-emoji-keyword-add-form').off('submit', EmojiSearch.eSubmit);
      $('.tr-emoji-keyword-add-form .btn-default').off('click', EmojiSearch.eCancel);
      $('.tr-emoji-keyword-new .tr-back').off('click', EmojiSearch.eCancel);
      $('.tr-emoji-keywords-suggestion-btn').off('click', EmojiSearch.eSuggestionsOpen);
      $('.tr-emoji-keywords-suggestion-header .tr-back').off('click', EmojiSearch.eSuggestionsClose);
      state.$esResults.off('.esearch');
      $field.off('blur', EmojiSearch.onScroll);
      state.$searchEmojiPanel.off('mousedown');
      state.$emojiPanel.off('mousedown');
      state.$keywordField.destroyTextarea();
      state.$emojiField.destroyTextarea();
      $(window).off('scroll', EmojiSearch.onScroll);
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
        html += '<div class="emoji-btn">' + EmojiSearch.emojiHtml(emojis[i], true) + '</div>';
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
      console.warn('No hex found: ' + emoji);
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
    $('a.tr-search-filter-item[data-value="' + value + '"]', $filter).parent('li').addClass('selected');
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
  },
  eOpen: function(e) {
    EmojiSearch.focus();
  },
  eToggleMode: function(e) {
    e.stopImmediatePropagation();
    e.preventDefault();
    $('.tr-search').removeClass('tr-search-open');
    EmojiSearch.toggleMode(!Aj.state.byEmojiMode);
  },
  eKeywordToggle: function(e) {
    $(this).toggleClass('collapsed');
  },
  focus: function(e) {
    $('.tr-search').addClass('tr-search-open');
    setTimeout(function(){ $('.tr-search-field').focus(); }, 100);
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
    Aj.apiRequest(method, {
      lang: Aj.state.curLang,
      from_version: Aj.state.keywordsVersion,
      keyword: keyword,
      emoji: emoji
    }, function(result) {
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
    e.stopImmediatePropagation();
    var $keyword = $(this).parents('.tr-emoji-keyword');
    var keyword = $keyword.find('.tr-keyword').text();
    var $emoji = $keyword.find('.tr-emoji');
    var $emoji_clone = $emoji.clone();
    $emoji_clone.find('.emoji-md + .emoji-md').before(' ');
    var emoji = $emoji.text();
    var decline = $(this).hasClass('decline');
    var decline_func = function() {
      var method = decline ? 'declineKeywordSuggestions' : 'deleteEmojiKeywords';
      Aj.apiRequest(method, {
        lang: Aj.state.curLang,
        from_version: Aj.state.keywordsVersion,
        keyword: keyword,
        emoji: emoji
      }, function(result) {
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
    Aj.apiRequest('getEmojiSuggestions', {
      lang: Aj.state.curLang,
      query: query || ''
    }, function(result) {
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









