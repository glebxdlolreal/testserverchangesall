(function($) {
  $.fn.redraw = function() {
    return this.map(function(){ this.offsetTop; return this; });
  };
  $.fn.prepareSlideX = function(callback) {
    return this.map(function(){
      $(this).css({width: this.scrollWidth, overflow: 'hidden'});
      return this;
    }).one('transitionend', function(){
      $(this).css({width: '', overflow: ''});
      callback && callback.call(this);
    }).redraw();
  };
  $.fn.prepareSlideY = function(callback) {
    return this.map(function(){
      $(this).css({height: this.scrollHeight, overflow: 'hidden'});
      return this;
    }).one('transitionend', function(){
      $(this).css({height: '', overflow: ''});
      callback && callback.call(this);
    }).redraw();
  };
  $.fn.animOff = function(this_el) {
    if (this_el) {
      return this.css('transition', 'none').redraw();
    }
    return this.addClass('no-transition').redraw();
  };
  $.fn.animOn = function(this_el) {
    if (this_el) {
      return this.redraw().css('transition', '');
    }
    return this.redraw().removeClass('no-transition');
  };
  $.fn.fadeShow = function() {
    return this.removeClass('ohide');
  };
  $.fn.fadeHide = function() {
    return this.addClass('ohide');
  };
  $.fn.isFadeHidden = function() {
    return this.hasClass('ohide');
  };
  $.fn.isFixed = function() {
    return this.parents().map(function(){ return $(this).css('position'); }).get().indexOf('fixed') != -1;
  };
  $.fn.focusAndSelectAll = function() {
    var range = document.createRange(), field, sel;
    if (field = this.get(0)) {
      field.focus();
      range.selectNodeContents(field);
      sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    return this;
  };
  $.fn.fadeToggle = function(state) {
    if (state === true || state === false) {
      state = !state;
    }
    return this.toggleClass('ohide', state);
  };
  $.fn.slideShow = function(callback) {
    return this.prepareSlideY(callback).removeClass('shide');
  };
  $.fn.slideHide = function(callback) {
    if (callback == 'remove') {
      callback = function(){ $(this).remove(); };
    }
    return this.prepareSlideY(callback).addClass('shide');
  };
  $.fn.slideXShow = function(callback) {
    return this.prepareSlideX(callback).removeClass('sxhide');
  };
  $.fn.slideXHide = function(callback) {
    if (callback == 'remove') {
      callback = function(){ $(this).remove(); };
    }
    return this.prepareSlideX(callback).addClass('sxhide');
  };
  $.fn.isSlideHidden = function() {
    return this.hasClass('shide');
  };
  $.fn.slideToggle = function(state, callback) {
    if (state === true || state === false) {
      state = !state;
    }
    return this.prepareSlideY(callback).toggleClass('shide', state);
  };
  $.fn.highlight = function(delay) {
    var $this = this;
    $this.addClass('highlight');
    setTimeout(function() { $this.removeClass('highlight'); }, delay);
    return $this;
  };
  $.fn.scrollIntoView = function(options) {
    options = options || {}
    return this.first().each(function() {
      var position = options.position || 'auto',
          padding = options.padding || 0,
          duration = options.duration || 0;
      var $item       = $(this),
          $cont       = $item.scrollParent(),
          scrollTop   = $cont.scrollTop(),
          positionTop = 0,
          paddingTop  = 0,
          itemHeight  = $item.outerHeight(),
          isBody      = false;
      if ($cont.get(0) === document) {
        isBody     = true;
        $cont      = $(window);
        positionTop = $item.offset().top;
        paddingTop = $('header').height() + 1;
      } else {
        positionTop = $item.offset().top - $cont.offset().top + scrollTop;
      }
      if (options.slidedEl) {
        if (options.slidedEl === 'this') {
          options.slidedEl = this;
        }
        $(options.slidedEl, this).each(function() {
          itemHeight += (this.scrollHeight - this.clientHeight);
        });
      }
      var itemTop     = positionTop,
          itemBottom  = itemTop + itemHeight,
          contHeight  = $cont.height(),
          contTop     = scrollTop + padding + paddingTop,
          contBottom  = scrollTop + contHeight - padding,
          scrollTo    = null;
      if (position == 'auto') {
        if (itemTop < contTop) {
          scrollTo = itemTop - padding - paddingTop;
        } else if (itemBottom > contBottom) {
          if (itemHeight > contHeight - padding - padding) {
            scrollTo = itemTop - padding - paddingTop;
          } else {
            scrollTo = itemBottom - contHeight + padding;
          }
        }
      } else if (position == 'top' || position == 'center') {
        if (contHeight > itemHeight) {
          padding = (contHeight - paddingTop - itemHeight) / 2;
        }
        scrollTo = itemTop - padding - paddingTop;
      } else if (position == 'bottom') {
        if (itemHeight > contHeight - padding - padding) {
          scrollTo = itemTop - padding - paddingTop;
        } else {
          scrollTo = itemBottom - contHeight + padding;
        }
      }
      if (scrollTo) {
        if (duration) {
          if (isBody) {
            $cont = $('html');
          }
          $cont.stop().animate({scrollTop: scrollTo}, duration);
        } else {
          $cont.scrollTop(scrollTo);
        }
      }
    });
  };
  $.fn.hasField = function(name) {
    return this.first().map(function() {
      if (this.tagName == 'FORM') {
        if (this[name]) {
          return true;
        }
        return $('.input[data-name]', this).filter(function() {
          return ($(this).attr('data-name') == name);
        }).size() > 0;
      }
      return false;
    }).get(0) || false;
  };
  $.fn.field = function(name) {
    return this.first().map(function() {
      if (this.tagName == 'FORM') {
        if (this[name]) {
          return this[name];
        }
        return $('.input[data-name]', this).filter(function() {
          return ($(this).attr('data-name') == name);
        }).get(0);
      }
    });
  };
  $.fn.reset = function(val) {
    return this.each(function() {
      if (this.tagName == 'FORM') {
        this.reset();
        $('.input[data-name]', this).each(function() {
          $(this).text($(this).attr('data-value')).trigger('input');
        });
      }
    });
  };
  $.fn.defaultValue = function(val) {
    if (typeof val !== 'undefined') {
      return this.each(function() {
        if (this.tagName == 'TEXTAREA' || this.tagName == 'INPUT') {
          this.defaultValue = val;
        } else {
          $(this).attr('data-value', val);
        }
      });
    }
    return this.first().map(function() {
      if (this.tagName == 'TEXTAREA' || this.tagName == 'INPUT') {
        return this.defaultValue || '';
      } else {
        return $(this).attr('data-value') || '';
      }
    }).get(0) || '';
  };
  $.fn.value = function(val) {
    if (typeof val !== 'undefined') {
      return this.each(function() {
        if (this.tagName == 'TEXTAREA' || this.tagName == 'INPUT') {
          this.value = val;
        } else {
          $(this).text(val).trigger('input');
        }
      });
    }
    return this.first().map(function() {
      if (this.tagName == 'TEXTAREA' || this.tagName == 'INPUT') {
        return this.value || '';
      } else {
        return $(this).text() || '';
      }
    }).get(0) || '';
  };
  $.fn.values = function(val) {
    if (typeof val !== 'undefined') {
      return this.value(val);
    }
    return this.map(function() {
      if (this.tagName == 'TEXTAREA' || this.tagName == 'INPUT') {
        return this.value || '';
      } else {
        return $(this).text() || '';
      }
    }).get() || [];
  };

  $.fn.initTextarea = function(options) {
    options = options || {};

    function getRangeText(range) {
      var div = document.createElement('DIV');
      div.appendChild(range.cloneContents());
      return getText(div, true);
    }
    function isBlockEl(el) {
      var blockTags = {ADDRESS: 1, ARTICLE: 1, ASIDE: 1, AUDIO: 1, BLOCKQUOTE: 1, CANVAS: 1, DD: 1, DIV: 1, DL: 1, FIELDSET: 1, FIGCAPTION: 1, FIGURE: 1, FIGURE: 1, FIGCAPTION: 1, FOOTER: 1, FORM: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, HEADER: 1, HGROUP: 1, HR: 1, LI: 1, MAIN: 1, NAV: 1, NOSCRIPT: 1, OL: 1, OUTPUT: 1, P: 1, PRE: 1, SECTION: 1, TABLE: 1, TFOOT: 1, UL: 1, VIDEO: 1};
      // return (el.nodeType == el.ELEMENT_NODE && blockTags[el.tagName]);
      if (el.nodeType == el.ELEMENT_NODE) {
        var display = $(el).css('display');
        if (!display) return blockTags[el.tagName];
        return (display == 'block' || display == 'table' || display == 'table-row');
      }
      return false;
    }
    function isMetadataEl(el) {
      var metadataTags = {HEAD: 1, TITLE: 1, BASE: 1, LINK: 1, META: 1, STYLE: 1, SCRIPT: 1};
      return (el.nodeType == el.ELEMENT_NODE && metadataTags[el.tagName]);
    }
    function getText(el, safe_last_br) {
      var child = el.firstChild, blocks = [], block = '';
      while (child) {
        if (child.nodeType == child.TEXT_NODE) {
          block += child.nodeValue;
        } else if (child.nodeType == child.ELEMENT_NODE && !isMetadataEl(child)) {
          if (child.tagName == 'BR') {
            block += '\n';
          } else if (child.tagName == 'IMG') {
            block += child.getAttribute('alt') || '';
          } else if (!isBlockEl(child)) {
            block += getText(child);
          } else {
            if (block.length > 0) {
              if (block.substr(-1) == '\n') {
                block = block.slice(0, -1);
              }
              blocks.push(block);
              block = '';
            }
            blocks.push(getText(child, safe_last_br));
          }
        }
        child = child.nextSibling;
      }
      if (block.length > 0) {
        if (!safe_last_br && block.substr(-1) == '\n') {
          block = block.slice(0, -1);
        }
        blocks.push(block);
      }
      return blocks.join('\n');
    }
    function getTextNodesIn(node) {
      var textNodes = [];
      if (node.nodeType == node.TEXT_NODE) {
        textNodes.push(node);
      } else {
        for (var i = 0, len = node.childNodes.length; i < len; ++i) {
          textNodes.push.apply(textNodes, getTextNodesIn(node.childNodes[i]));
        }
      }
      return textNodes;
    }
    function editableClosest(el) {
      while (el) {
        if (el.nodeType == el.ELEMENT_NODE &&
            el.getAttribute('contenteditable') == 'true') {
          return el;
        }
        el = el.parentNode;
      }
      return null;
    }
    function nonEditableClosest(el) {
      while (el) {
        if (el.tagName == 'MARK' &&
            el.getAttribute('contenteditable') == 'false') {
          return el;
        }
        el = el.parentNode;
      }
      return null;
    }
    function setSelectionRange(el, start, end) {
      var sel = window.getSelection();
      sel.removeAllRanges();
      var textNodes = getTextNodesIn(el);
      var charCount = 0, endCharCount, i, textNode, node, offset, nonEditEl;
      for (i = 0, charCount = 0; textNode = textNodes[i++]; ) {
        endCharCount = charCount + textNode.length;
        if (start >= charCount && (start < endCharCount ||
            (start == endCharCount && i <= textNodes.length))) {
          if (nonEditEl = nonEditableClosest(textNode)) {
            var range = document.createRange();
            if (start < end) range.setStartBefore(nonEditEl);
            else range.setStartAfter(nonEditEl);
            node = range.startContainer;
            offset = range.startOffset;
          } else {
            node = textNode;
            offset = start - charCount;
          }
          sel.collapse(node, offset);
          break;
        }
        charCount = endCharCount;
      }
      if (start != end) {
        for (i = 0, charCount = 0; textNode = textNodes[i++]; ) {
          endCharCount = charCount + textNode.length;
          if (end >= charCount && (end < endCharCount ||
              (end == endCharCount && i <= textNodes.length))) {
            if (nonEditEl = nonEditableClosest(textNode)) {
              var range = document.createRange();
              if (start < end) range.setStartAfter(nonEditEl);
              else range.setStartBefore(nonEditEl);
              node = range.startContainer;
              offset = range.startOffset;
            } else {
              node = textNode;
              offset = end - charCount;
            }
            sel.extend(node, offset);
            break;
          }
          charCount = endCharCount;
        }
      }
    }
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey &&
          e.which == 90) { // Z
        e.preventDefault();
        if (e.shiftKey) {
          redo(this);
        } else {
          undo(this);
        }
      }
      else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey &&
               e.which == 89) { // Y
        e.preventDefault();
        redo(this);
      }
      else if ((e.metaKey || e.ctrlKey) &&
          !e.shiftKey && !e.altKey && e.which == 73 &&
          $(this).data('textOptions').allowTokens) { // I
        e.preventDefault();
        $(this).data('$tokens').filter(':not(.used)').eq(0).trigger('click');
      }
      else if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey &&
               (e.which == Keys.LEFT || e.which == Keys.RIGHT || e.which == Keys.BACKSPACE)) {
        var isLeft = e.which == Keys.LEFT || e.which == Keys.BACKSPACE;
        var isBackspace = e.which == Keys.BACKSPACE;
        var sel = window.getSelection();
        if (sel.isCollapsed && sel.focusNode) {
          if (sel.focusNode.nodeType == sel.focusNode.TEXT_NODE) {
            var newOffset = sel.focusOffset + (isLeft ? -1 : 1);
            if (newOffset < 0) {
              var prevNode = sel.focusNode.previousSibling;
              if (prevNode && prevNode.nodeType == prevNode.ELEMENT_NODE) {
                var range = document.createRange();
                range.setStartBefore(prevNode);
                if (isBackspace) {
                  range.setEnd(sel.focusNode, sel.focusOffset);
                  range.deleteContents();
                  $(sel.focusNode).closest('.input').trigger('input');
                } else {
                  sel.collapse(range.startContainer, range.startOffset);
                }
                e.preventDefault();
              }
            } else if (newOffset > sel.focusNode.nodeValue.length) {
              var nextNode = sel.focusNode.nextSibling;
              if (nextNode.nodeType == nextNode.ELEMENT_NODE && nextNode.tagName != 'BR') {
                var range = document.createRange();
                range.setStartAfter(nextNode);
                if (!isBackspace) {
                  sel.collapse(range.startContainer, range.startOffset);
                }
                e.preventDefault();
              }
            }
          }
          else if (sel.focusNode.nodeType == sel.focusNode.ELEMENT_NODE) {
            var curNode = sel.focusNode.childNodes[sel.focusOffset];
            if (isLeft) {
              var prevNode = curNode ? curNode.previousSibling : sel.focusNode.lastChild;
              while (prevNode &&
                     prevNode.nodeType == prevNode.TEXT_NODE &&
                     !prevNode.nodeValue.length) {
                prevNode = prevNode.previousSibling;
              }
              if (prevNode && prevNode.nodeType == prevNode.ELEMENT_NODE) {
                if (isBackspace) {
                  var range = document.createRange();
                  range.selectNode(prevNode);
                  range.deleteContents();
                  $(sel.focusNode).closest('.input').trigger('input');
                } else {
                  sel.collapse(sel.focusNode, sel.focusOffset - 1);
                }
                e.preventDefault();
              } else if (prevNode && prevNode.nodeType == prevNode.TEXT_NODE) {
                if (isBackspace) {
                  var range = document.createRange();
                  range.setStart(prevNode, prevNode.nodeValue.length - 1);
                  range.setEnd(prevNode, prevNode.nodeValue.length);
                  range.deleteContents();
                  $(sel.focusNode).closest('.input').trigger('input');
                } else {
                  sel.collapse(prevNode, prevNode.nodeValue.length - 1);
                }
                e.preventDefault();
              }
            } else {
              if (curNode && curNode.nodeType == curNode.ELEMENT_NODE && curNode.tagName != 'BR') {
                sel.collapse(sel.focusNode, sel.focusOffset + 1);
                e.preventDefault();
              } else if (curNode && curNode.nodeType == curNode.TEXT_NODE) {
                sel.collapse(curNode, 1);
                e.preventDefault();
              }
            }
          }
        }
      }
    }
    function getFieldRange(field) {
      var sel = window.getSelection();
      if (sel.anchorNode && sel.focusNode) {
        var rng = document.createRange();
        rng.setStart(field, 0);
        rng.setEnd(sel.anchorNode, sel.anchorOffset);
        var startOffset = getRangeText(rng).length;
        rng.setEnd(sel.focusNode, sel.focusOffset);
        var endOffset = getRangeText(rng).length;
        return {startOffset: startOffset, endOffset: endOffset};
      }
      var offset = field.childNodes.length;
      if (field.lastChild && field.lastChild.tagName == 'BR') {
        offset--;
      }
      return {startOffset: offset, endOffset: offset};
    }
    function setFieldRange(field, fieldRange) {
      if (fieldRange) {
        setSelectionRange(field, fieldRange.startOffset, fieldRange.endOffset);
      }
    }
    function onSetFocus() {
      setFieldRange(this, $(this).data('prevSelRange'));
    }
    function update(field, text, fieldRange) {
      var $field = $(field);
      var tokens = $field.data('tokens');
      var options = $field.data('textOptions');
      if (options.checkText) {
        text = options.checkText(text);
      }
      var html = cleanHTML(text), fhtml;
      if (options.allowTokens) {
        var avail_tokens = [];
        $.each(tokens, function(i, value) {
          avail_tokens[i] = cleanHTML(value);
        });
        var avail_count = tokens.length;
        var $tokens = $field.data('$tokens');
        if (avail_count > 0) {
          html = html.replace(TOKEN_REGEX, function(s) {
            var i = avail_tokens.indexOf(s);
            if (i >= 0) {
              avail_tokens[i] = null;
              avail_count--;
              var $token = $tokens.eq(i);
              if (!$token.hasClass('used')) {
                $token.prepareSlideX().addClass('used');
              }
              return '<mark class="token" contenteditable="false">' + s + '</mark>';
            } else {
              return s;
            }
          });
          $tokens.each(function(i) {
            if (avail_tokens[i] !== null) {
              var $token = $(this);
              if ($token.hasClass('used')) {
                $token.prepareSlideX().removeClass('used');
              }
            }
          });
        }
        $tokens.parents('.key-add-tokens-wrap').toggleClass('empty', !avail_count)
      }
      if (options.allowEmoji && options.emojiRE) {
        html = html.replace(options.emojiRE, function(s) {
          return '<mark class="emoji" contenteditable="false">' + EmojiSearch.emojiHtml(s) + '</mark>';
        });
      }
      html = html.split(getBR()).join('\n');
      if (options.singleLine) {
        html = html.replace(/^\n+|\n+$/g, '').replace(/\n+/g, ' ');
      }
      fhtml = $field.html();
      if (fhtml === html) {
        $field.append('<br/>').toggleClass('empty', !$field.text().length);
        return;
      }
      if (fhtml === html + getBR()) {
        $field.toggleClass('empty', !$field.text().length);
        return;
      }

      fieldRange = fieldRange || getFieldRange(field);
      $field.html(html + getBR()).toggleClass('empty', !$field.text().length);
      setFieldRange(field, fieldRange);
    }
    function onInput() {
      var field = this;
      var $field = $(this);
      var text = getText(field);
      update(field, text);

      var history = $field.data('history');
      var fieldRange = getFieldRange(field);
      var prevSelRange = $field.data('prevSelRange');
      var time = +(new Date);
      history.list = history.index >= 0 ? history.list.slice(0, history.index + 1) : [];
      if (history.index >= 0 && history.list[history.index]) {
        var entry = history.list[history.index];
        if (entry.text == text) {
          return;
        }
        if (time - entry.time < 1000 &&
            entry.redoSel.startOffset == entry.redoSel.endOffset &&
            (entry.text.length - entry.redoSel.endOffset) ==
            (text.length - fieldRange.endOffset)) {
          entry.text = text;
          entry.redoSel = fieldRange;
          return;
        }
        entry.undoSel = prevSelRange;
      }
      history.list.push({text: text, redoSel: fieldRange, time: time});
      history.index++;
    }
    function undo(field) {
      var $field = $(field);
      var history = $field.data('history');
      if (history.index > 0) {
        history.index--;
        var entry = history.list[history.index];
        update(field, entry.text, entry.undoSel);
      }
    }
    function redo(field) {
      var $field = $(field);
      var history = $field.data('history');
      if (history.index < history.list.length - 1) {
        history.index++;
        var entry = history.list[history.index];
        update(field, entry.text, entry.redoSel);
      }
    }
    function onSelectionChange() {
      $(this).data('prevSelRange', getFieldRange(this));
      var sel = window.getSelection();
      if (sel.isCollapsed) {
        var nonEditEl;
        if (nonEditEl = nonEditableClosest(sel.focusNode)) {
          var range = document.createRange();
          if (sel.focusOffset < $(nonEditEl).text().length / 2) {
            range.setStartBefore(nonEditEl);
          } else {
            range.setStartAfter(nonEditEl);
          }
          sel.collapse(range.startContainer, range.startOffset);
        }
        else if (sel.focusNode === this && sel.focusOffset == this.childNodes.length && this.lastChild && this.lastChild.nodeType == 'BR') {
          sel.collapse(this, this.childNodes.length - 1);
        }
        else if (sel.focusNode.nodeType == sel.focusNode.TEXT_NODE && sel.focusOffset == sel.focusNode.nodeValue.length) {
          var range = document.createRange();
          range.setStartAfter(sel.focusNode);
          sel.collapse(range.startContainer, range.startOffset);
        }
      }
    }

    if (!$(document).data('selectionchange_inited')) {
      $(document).data('selectionchange_inited', true);
      document.execCommand('autoUrlDetect', false, false);
      $(document).on('selectionchange', function() {
        var sel = window.getSelection();
        var anchorField, focusField;
        var field, offset;
        if (sel.anchorNode && (anchorField = editableClosest(sel.anchorNode))) {
          $(anchorField).triggerHandler('selectionchange');
        }
        if (sel.focusNode && (focusField = editableClosest(sel.focusNode)) &&
            anchorField != focusField) {
          $(focusField).triggerHandler('selectionchange');
        }
        if (!sel.focusNode &&
            document.activeElement &&
            document.activeElement.getAttribute('contenteditable') == 'true') {
          field = document.activeElement;
          offset = field.childNodes.length;
          if (field.lastChild.tagName == 'BR') {
            offset--;
          }
          sel.collapse(field, offset);
        }
      });
    }

    return this.each(function() {
      var field = this;
      var $field = $(field);
      var textOptions = $.extend({}, options);
      $field.attr('contenteditable', 'true');
      $field.data('textOptions', textOptions);

      function insertTag(e) {
        e.preventDefault();
        document.execCommand('insertText', false, $(this).attr('data-token'));
        $field.focus();
      }

      $field.data('history', {list: [], index: -1});

      if (options.allowTokens) {
        var tokens_attr = $field.attr('data-tokens');
        var tokens = tokens_attr ? tokens_attr.split(' ') : [];

        var $tokensBtns = $('<div class="field-ins-btns"></div>');
        for (var i = 0; i < tokens.length; i++) {
          var token = tokens[i] = tokens[i].replace('\xa0', ' ');
          var $token = $('<button class="field-ins-btn" tabindex="-1"></button>');
          $token.attr('data-token', token).appendTo($tokensBtns);
        }
        var ua = navigator.userAgent || '',
            is_mac = ua.indexOf('Mac') >= 0 ||
                     ua.indexOf('AppleWebKit') >= 0 &&
                     /Mobile\/\w+/.test(ua);
        var shortcut = is_mac ? '⌘I' : 'Ctrl+I';
        $tokensBtns.attr('data-shortcut', shortcut).wrap('<div class="key-add-tokens"></div>').parent().wrap('<div class="key-add-tokens-wrap"></div>').parent().toggleClass('empty', !tokens.length).insertAfter($field);
        var $tokens = $('.field-ins-btn', $tokensBtns);
        $tokens.on('click.tr-textarea', insertTag);
        $field.data('$tokens', $tokens);
        $field.data('tokens', tokens);
      }
      if ($field.is('[data-single-line]')) {
        textOptions.singleLine = true;
      }

      $field.on('selectionchange.tr-textarea', onSelectionChange);
      $field.on('keydown.tr-textarea', onKeyDown);
      $field.on('input.tr-textarea', onInput);
      $field.on('setfocus.tr-textarea', onSetFocus);
      $field.trigger('input');
    });

  };
  $.fn.destroyTextarea = function() {
    return this.off('.tr-textarea').each(function() {
      var $tokens = $(this).data('$tokens');
      if ($tokens) {
        $tokens.off('.tr-textarea');
      }
    });
  };

  $.fn.blockBodyScroll = function() {
    function onResultsMouseWheel(e) {
      var d = e.originalEvent.wheelDelta;
      if((this.scrollTop === (this.scrollHeight - this.clientHeight) && d < 0) ||
         (this.scrollTop === 0 && d > 0)) {
        e.preventDefault();
      }
    }
    return this.on('mousewheel', onResultsMouseWheel);
  };

  $.fn.updateAboveLikeText = function() {
    return this.map(function (footerEl) {
      var textEl = $('.cd-issue-device:not(:empty)', this).get(0);
      if (!textEl) {
        textEl = $('.cd-issue-files:not(:empty)', this).get(0);
      }
      if (!textEl) {
        textEl = $('.cd-issue-text:not(:empty)', this).get(0);
      }
      if (textEl) {
        var r = document.createRange();
        r.setStartBefore(textEl);
        r.setEndAfter(textEl);
        var text_rect = r.getBoundingClientRect();
        var tnode = textEl.firstChild;
        while (tnode && tnode.nodeType == tnode.ELEMENT_NODE) {
          tnode = tnode.firstChild;
        }
        r.setStart(tnode, 0);
        r.setEnd(tnode, 1);
        var char_rect = r.getBoundingClientRect();
        if (Math.abs(char_rect.right - text_rect.right) > 3) {
          var likeEl = $('.cd-issue-like', this).get(0);
          if (likeEl) {
            var shadowEl = textEl._shadow || document.createElement('span');
            shadowEl.style.width = likeEl.offsetWidth + 'px';
            shadowEl.className = 'cd-like-shadow';
            textEl.appendChild(shadowEl);
            textEl._shadow = shadowEl;
          }
        }
      }
    });
  };

})(jQuery);

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

function wrapHighlight(value, highlight, wrap_tag, prefix_only) {
  value = cleanHTML(value);
  if (highlight) {
    var pattern = cleanRE(cleanHTML(highlight));
    if (prefix_only) {
      pattern = '^' + pattern;
    }
    value = value.replace(new RegExp(pattern, 'gi'), '<strong>$&<\/strong>');
  }
  if (wrap_tag) {
    value = value.replace(TOKEN_REGEX, '<mark>$&</mark>');
  }
  return value;
}
function wrapSize(size) {
  if (size < 1024) {
    return size + ' B';
  } else if (size < 1048576) {
    return (Math.round(size * 10 / 1024.0) / 10) + ' KB';
  } else if (size < 1073741824) {
    return (Math.round(size * 10 / 1048576.0) / 10) + ' MB';
  } else {
    return (Math.round(size * 10 / 1073741824.0) / 10) + ' GB';
  }
}
function dataUrlToBlob(url) {
  try {
    var match = null;
    if (match = url.match(/^data:(image\/gif|image\/jpe?g|image\/png|video\/mp4);base64,(.*)$/)) {
      var type = match[1], b64 = match[2];
      var binary = atob(b64);
      var array = [];
      for(var i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
      }
      return new Blob([new Uint8Array(array)], {type: type});
    }
  } catch (e) {}
  return false;
}

function stopImmediatePropagation(e) {
  e.stopImmediatePropagation();
}
function preventDefault(e) {
  e.preventDefault();
}

var Issues = {
  init: function() {
    Aj.onLoad(function(state) {
      $('div.input[contenteditable]').initTextarea();
      $(document).on('click.curPage', '.cd-issue-like', Issues.eLikeIssue.pbind('liked'));
      $(document).on('click.curPage', '.cd-entry-like', Issues.eLikeEntry.pbind('liked'));
      $(document).on('click.curPage', '.cd-entry-dislike', Issues.eLikeEntry.pbind('disliked'));
      $(document).on('click.curPage', '.cd-edit-btn', Issues.eOpenEdit);
      $(document).on('click.curPage', '.cd-edit-close', Issues.eCloseEdit);
      $(document).on('click.curPage', '.cd-reply-btn', Issues.eOpenReply);
      $(document).on('click.curPage', '.cd-reply-close', Issues.eCloseReply);
      $(document).on('click.curPage', '.cd-reply-delete', Issues.eDeleteReply);
      $(document).on('click.curPage', '.cd-issue-delete', Issues.eDeleteIssue);
      $(document).on('click.curPage', '.cd-view-media', Issues.eShowMedia);
      $(document).on('click.curPage', '.cd-attach-btn', Issues.eAttachFile);
      $(document).on('click.curPage', '.file-upload', stopImmediatePropagation);
      $(document).on('click.curPage', 'a[data-add-hashtag]', Issues.eAddHashtag);
      $(document).on('click.curPage', 'a[data-issue-link]', Issues.eIssueHighlight);
      $(document).on('click.curPage', '.cd-issue-file-close', Issues.eDeleteFile);
      $(document).on('change.curPage', '.file-upload', Issues.eSelectFile);
      $(document).on('submit.curPage', '.cd-edit-form', Issues.eSubmitEditForm);
      $(document).on('submit.curPage', '.cd-reply-form', Issues.eSubmitReplyForm);
      $(document).on('submit.curPage', '.cd-issue-form', Issues.eSubmitIssueForm);
      $(document).on('focus.curPage', '.cd-reply-form, .cd-issue-form', Issues.checkAuth);
      $('.cd-entry-voting.need_tt').one('mouseover touchstart', Issues.ePreloadEntryLikes);
      $('.cd-issue-voting-buttons.need_tt').one('mouseover touchstart', Issues.ePreloadIssueLikes);
      $('.cd-issue').updateAboveLikeText();
      var loc_hash = Aj.location().hash.substr(1);
      $('a[name]').each(function() {
        var issue = this;
        if ($(issue).attr('name') == loc_hash) {
          setTimeout(function(){ Issues.eIssueHighlight.apply(issue); }, 100);
        }
      });
    });
    Aj.onUnload(function(state) {
      $('div.input[contenteditable]').destroyTextarea();
      $('.need_tt').off('mouseover touchstart');
    });
  },
  eOpenReply: function() {
    var $issue = $(this).parents('.cd-issue');
    $('.cd-reply-btn', $issue).fadeHide();
    $('.cd-issue-reply-wrap', $issue).slideShow(function() {
      $('.cd-reply-form', $issue).field('text').focus();
    });
  },
  eCloseReply: function() {
    var $issue = $(this).parents('.cd-issue');
    $('.cd-reply-btn', $issue).fadeShow();
    $('.cd-issue-reply-wrap', $issue).slideHide();
  },
  restoreEditForm: function($form) {
    if (!$form.data('initSaved')) {
      $form.data('initSaved', true);
      $form.data('text', $form.field('text').value());
      $form.data('device', $form.field('device').value());
      $form.data('files_html', $('.cd-issue-files', $form).html());
    } else {
      $form.field('text').value($form.data('text'));
      $form.field('device').value($form.data('device'));
      $('.cd-issue-files', $form).html($form.data('files_html'));
    }
  },
  eOpenEdit: function() {
    var $issue = $(this).parents('.cd-issue');
    var $form = $('.cd-edit-form', $issue);
    Issues.restoreEditForm($form);
    $('.cd-edit-btn,.cd-issue-delete', $issue).fadeHide();
    $('.cd-issue-edit-wrap', $issue).slideShow(function() {
      $('.cd-edit-form', $issue).field('text').focusAndSelectAll();
    });
  },
  eCloseEdit: function() {
    var $issue = $(this).parents('.cd-issue');
    $('.cd-edit-btn,.cd-issue-delete', $issue).fadeShow();
    $('.cd-issue-edit-wrap', $issue).slideHide();
  },
  eIssueHighlight: function(e) {
    if (e && (e.metaKey || e.ctrlKey)) return true;
    if ($(this).attr('target') == '_blank') return true;
    var issue_id = $(this).attr('data-issue-link');
    if (issue_id) {
      e && e.preventDefault();
      Issues.highlightComment(issue_id);
    }
  },
  highlightComment: function(issue_id) {
    $('.cd-issue[data-issue-id]').each(function() {
      var $issue = $(this);
      if ($issue.attr('data-issue-id') == issue_id) {
        $issue.scrollIntoView({position: 'center', padding: 15}).highlight(1500);
      }
    });
  },
  eAddHashtag: function(e) {
    if (e && (e.metaKey || e.ctrlKey)) return true;
    e.stopImmediatePropagation();
    e.preventDefault();
    var hashtag = $(this).attr('data-add-hashtag') + ' ';
    $('.cd-issue-input').focus();
    document.execCommand('insertText', false, hashtag);
    $('.cd-issue-input').focus().scrollIntoView({position: 'center'});
  },
  eAttachFile: function(e) {
    e && e.stopImmediatePropagation();
    e && e.preventDefault();
    if (Aj.needAuth()) return false;
    var limit = Aj.state.fileLimit || 5;
    if ($(this.form.file).values().length >= limit) {
      showAlert(l('WEB_TOO_MANY_FILES', {limit: limit}));
      return false;
    }
    $('<input type="file" accept="image/gif,image/jpeg,image/jpg,image/png,video/mp4" class="file-upload hide" multiple>').appendTo(this).click();
  },
  eDeleteFile: function(e) {
    var $file = $(this).parents('.cd-issue-file');
    if ($file.hasClass('file-loading')) {
      var xhr = $file.data('xhr');
      if (xhr) {
        xhr.aborted = true;
        xhr.abort();
      }
    }
    $file.slideHide('remove');
  },
  eSelectFile: function(e) {
    var input = this,
        $form = $(input).parents('form'),
        form = $form.get(0),
        $files = $('.cd-issue-files', $form),
        limit = Aj.state.fileLimit || 5,
        size_limit = Aj.state.fileSizeLimit || 1048576,
        alert_shown = false;
    if (input.files != null) {
      var files = Array.prototype.slice.apply(input.files);
      files.forEach(function(file) {
        if (file.size > size_limit) {
          if (!alert_shown) {
            alert_shown = true;
            showAlert(l('WEB_FILE_IS_TOO_BIG', {
              file_name: cleanHTML(file.name),
              file_size: cleanHTML(wrapSize(file.size)),
              file_size_max: cleanHTML(wrapSize(size_limit)),
            }));
          }
          return false;
        }
        if ($(form.file).values().length >= limit) {
          showAlert(l('WEB_TOO_MANY_FILES', {limit: limit}));
          return false;
        }
        var file_parts = (file.name || '').split('.'),
            file_ext = file_parts.length > 1 ? '.' + file_parts.pop() : '',
            file_name_without_ext = file_parts.join('.'),
            $file_delete = $('<span class="cd-issue-file-close close"></span>'),
            $file_thumb = $('<div class="cd-issue-file-thumb"><svg class="cd-issue-file-progress-wrap" viewPort="0 0 66 66" width="66px" height="66px"><circle class="cd-issue-file-progress-bg" cx="50%" cy="50%"></circle><circle class="cd-issue-file-progress" cx="50%" cy="50%" stroke-dashoffset="106"></circle></svg></div>'),
            $file_title = $('<div class="cd-issue-file-title"></div>').append($('<span class="filename"/>').text(file_name_without_ext)).append($('<span class="ext"/>').text(file_ext)).attr('title', file_name_without_ext + file_ext),
            $file_loaded = $('<span class="cd-issue-file-loaded" data-loaded="Generating thumb... "></span>'),
            $file_label = $('<div class="cd-issue-file-label"></div>').text(wrapSize(file.size)).prepend($file_loaded);

        var $file = $('<div class="cd-issue-file shide"></div>').append($file_delete).append($file_thumb).append($file_title).append($file_label).appendTo($files).slideShow();

        Issues.getThumb(file, 480, function onSuccess(thumb) {
          if (thumb) {
            var thumb_url = URL.createObjectURL(thumb);
            $file_thumb.css('background-image', "url('" + thumb_url + "')");
          }
          var xhr = Issues.uploadFile(file, thumb, function onSuccess(file) {
            if (file.thumb_src &&
                !$file_thumb.css('background-image')) {
              var thumb_src = Aj.state.uploadBaseUrl + file.thumb_src;
              $file_thumb.css('background-image', "url('" + thumb_src + "')");
            }
            if (file.src) {
              var src = Aj.state.uploadBaseUrl + file.src;
              $file_thumb.wrap('<a href="' + src + '" target="_blank" />');
            }
            $('<input type="hidden" name="file">').value(file.file_data).prependTo($file);
            $file_loaded.slideXHide('remove');
            $file.removeClass('file-loading').addClass('file-loaded');
          }, function onProgress(loaded, total) {
            progress = total ? loaded / total : 0;
            progress = Math.max(0, Math.min(progress, 1));
            $file_loaded.attr('data-loaded', 'Uploading... ' + wrapSize(progress * file.size) + '\xa0/\xa0');
            $('.cd-issue-file-progress', $file_thumb).attr('stroke-dashoffset', 106 * (1 - progress));
          }, function onError(error) {
            if (xhr.aborted) return;
            $file.slideHide('remove');
            showAlert(error);
          });
          $file.data('xhr', xhr);
          $file.addClass('file-loading');
        });
      });
    }
  },
  uploadFile: function(file, thumb, onSuccess, onProgress, onError) {
    var data = new FormData();
    data.append('file', file, file.name);
    if (thumb) {
      data.append('thumb', thumb, 'thumb.jpg');
    }
    return $.ajax({
      url: Aj.state.uploadBaseUrl + '/upload?source=contest_screenshot',
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
            onProgress && onProgress(event.loaded, event.total);
          }
        });
        return xhr;
      },
      beforeSend: function(xhr) {
        onProgress && onProgress(0, 1);
      },
      success: function (result) {
        if (result.error) {
          return onError && onError(result.error);
        }
        onSuccess && onSuccess(result);
      },
      error: function (xhr) {
        return onError && onError('Network error');
      }
    });
  },
  getThumb: function(file, width, onResult) {
    var thumb = false, got = false
        ready = function() {
          clearTimeout(thumbTo);
          if (!got) {
            got = true; onResult(thumb);
          }
        },
        thumbTo = setTimeout(ready, 2000);
    try {
      var url = URL.createObjectURL(file);
      var finishThumb = function(el, w, h) {
        try {
          var max = Math.max(w, h);
          var scale = width / max;
          var dw = Math.round(w * scale);
          var dh = Math.round(h * scale);
          if (dw && dh) {
            var canvas = document.createElement('canvas'), blob;
            canvas.width = dw
            canvas.height = dh;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, dw, dh);
            ctx.drawImage(el, 0, 0, dw, dh);
            URL.revokeObjectURL(url);
            if (canvas.toBlob) {
              canvas.toBlob(function(blob) {
                if (blob) { thumb = blob; }
                ready();
              }, 'image/jpeg', 0.92);
            } else {
              var blob = dataUrlToBlob(canvas.toDataURL('image/jpeg', 0.92));
              if (blob) { thumb = blob; }
              ready();
            }
          }
        } catch (e) { ready(); }
      }
      if (file.type == 'video/mp4') {
        var video = document.createElement('video');
        video.src = url;
        video.load();
        video.addEventListener('loadedmetadata', function metadataLoaded() {
          video.removeEventListener('loadedmetadata', metadataLoaded);
          video.addEventListener('timeupdate', function timeUpdated() {
            video.removeEventListener('timeupdate', timeUpdated);
            finishThumb(video, video.videoWidth, video.videoHeight);
          });
          video.currentTime = 0;
        });
        video.addEventListener('error', function onError() {
          video.removeEventListener('error', onError);
          ready();
        });
      } else {
        var image = document.createElement('img');
        image.src = url;
        image.addEventListener('load', function imgLoaded() {
          image.removeEventListener('load', imgLoaded);
          finishThumb(image, image.naturalWidth, image.naturalHeight);
        });
        image.addEventListener('error', function onError() {
          image.removeEventListener('error', onError);
          ready();
        });
      }
    } catch (e) { ready(); }
  },
  checkAuth: function(e) {
    if (Aj.needAuth()) {
      e.preventDefault();
      return false;
    }
  },
  ePreloadIssueLikes: function(e) {
    if (Aj.needAuth()) return false;
    var $voting = $(this);
    if (!$voting.hasClass('need_tt')) return false;
    $voting.removeClass('need_tt');
    Aj.apiRequest('getIssueLikes', {
      issue_id: $voting.parents('.cd-issue').attr('data-issue-id')
    }, function(result) {
      if (!result.error) {
        Issues.updateIssueLikes($voting, result);
      }
    });
    return false;
  },
  eLikeIssue: function(state, e) {
    e.stopPropagation();
    e.preventDefault();
    if (Aj.needAuth()) return false;
    if (Aj.state.votingClosed) {
      showAlert(l('WEB_ISSUE_VOTING_IS_CLOSED'));
      return false;
    }
    if (Aj.state.votingDisabled) {
      showAlert(l('WEB_ENTRY_VOTING_DISABLED'));
      return false;
    }
    var $voting = $(this).parents('.cd-issue-voting-buttons');
    var issue_id = $voting.parents('.cd-issue').attr('data-issue-id');
    var cur_state = '';
    if ($voting.hasClass('liked')) cur_state = 'liked';
    var prev_likes = {
      likes: +$('.cd-issue-like .value', $voting).text() || 0,
      state: cur_state
    };
    var likes = $.extend({}, prev_likes);
    var method;
    if (state == 'liked') {
      if ($voting.hasClass('liked')) {
        method = 'unlikeIssue';
        likes.state = '';
        likes.likes -= Aj.state.likeVal;
      } else {
        method = 'likeIssue';
        likes.state = state;
        likes.likes += Aj.state.likeVal;
      }
    }
    Aj.apiRequest(method, {
      issue_id: issue_id
    }, function(result) {
      if (result.error) {
        Issues.updateIssueLikes($voting, prev_likes);
        return showAlert(result.error);
      }
      Issues.updateIssueLikes($voting, result);
    });
    Issues.updateIssueLikes($voting, likes);
    return false;
  },
  updateIssueLikes: function($voting, likes) {
    $('.cd-issue-like .value', $voting).text(likes.likes || '');
    Issues.updateLikeTooltip($('.cd-issue-like', $voting), likes.likes_tt);
    $voting.removeClass('liked');
    if (likes.state) {
      $voting.addClass(likes.state);
    }
    $voting.parents('.cd-issue').updateAboveLikeText();
  },
  ePreloadEntryLikes: function(e) {
    if (Aj.needAuth()) return false;
    var $voting = $(this);
    if (!$voting.hasClass('need_tt')) return false;
    $voting.removeClass('need_tt');
    Aj.apiRequest('getEntryLikes', {
      entry_id: $voting.attr('data-entry-id')
    }, function(result) {
      if (!result.error) {
        Issues.updateEntryLikes($voting, result);
      }
    });
    return false;
  },
  eLikeEntry: function(state, e) {
    e.stopPropagation();
    e.preventDefault();
    if (Aj.needAuth()) return false;
    if (Aj.state.votingClosed) {
      showAlert(l('WEB_ENTRY_VOTING_IS_CLOSED'));
      return false;
    }
    if (Aj.state.votingDisabled) {
      showAlert(l('WEB_ENTRY_VOTING_DISABLED'));
      return false;
    }
    var $voting = $(this).parents('.cd-entry-voting');
    var entry_id = $voting.attr('data-entry-id');
    var cur_state = '';
    if ($voting.hasClass('liked')) cur_state = 'liked';
    if ($voting.hasClass('disliked')) cur_state = 'disliked';
    var prev_likes = {
      likes: +$('.cd-entry-like .value', $voting).text() || 0,
      dislikes: +$('.cd-entry-dislike .value', $voting).text() || 0,
      state: cur_state
    };
    var likes = $.extend({}, prev_likes);
    var method;
    if (state == 'liked') {
      if ($voting.hasClass('liked')) {
        method = 'unlikeEntry';
        likes.state = '';
        likes.likes -= Aj.state.likeVal;
      } else {
        if ($voting.hasClass('disliked')) {
          likes.dislikes -= Aj.state.likeVal;
        }
        method = 'likeEntry';
        likes.state = state;
        likes.likes += Aj.state.likeVal;
      }
    } else if (state == 'disliked') {
      if ($voting.hasClass('disliked')) {
        method = 'unlikeEntry';
        likes.state = '';
        likes.dislikes -= Aj.state.likeVal;
      } else {
        if ($voting.hasClass('liked')) {
          likes.likes -= Aj.state.likeVal;
        }
        method = 'dislikeEntry';
        likes.state = state;
        likes.dislikes += Aj.state.likeVal;
      }
    }
    Aj.apiRequest(method, {
      entry_id: entry_id
    }, function(result) {
      if (result.error) {
        Issues.updateEntryLikes($voting, prev_likes);
        return showAlert(result.error);
      }
      Issues.updateEntryLikes($voting, result);
    });
    Issues.updateEntryLikes($voting, likes);
    return false;
  },
  updateEntryLikes: function($voting, likes) {
    $('.cd-entry-like .value', $voting).text(likes.likes || '');
    $('.cd-entry-dislike .value', $voting).text(likes.dislikes || '');
    Issues.updateLikeTooltip($('.cd-entry-like', $voting), likes.likes_tt);
    Issues.updateLikeTooltip($('.cd-entry-dislike', $voting), likes.dislikes_tt);
    $voting.removeClass('liked').removeClass('disliked');
    if (likes.state) {
      $voting.addClass(likes.state);
    }
    var total = likes.likes + likes.dislikes;
    var percent = total ? 100 * likes.likes / total : 0;
    $('.cd-entry-voting-bar-value').css('width', percent + '%');
    $('.cd-entry-voting-bar').fadeToggle(total > 0);
  },
  updateLikeTooltip: function($like, tt) {
    var $tt = $('.like-tooltip-wrap', $like);
    if (tt) {
      if (!$tt.size()) {
        $tt = $('<div class="like-tooltip-wrap tt-hidden">').appendTo($like);
      }
      $tt.html('<div class="like-tooltip">' + tt + '</div>').redraw().removeClass('tt-hidden');
    } else {
      $tt.addClass('tt-hidden');
    }
  },
  eSubmitReplyForm: function(e) {
    e.preventDefault();
    var form = this;
    var $button  = $('.cd-submit-issue-btn', this);
    var issue_id = $(this).field('issue_id').value();
    var text     = $(this).field('text').value();
    var files    = $(this.file).values();
    var device   = $(this).field('device').value();
    if (!text.length) {
      $(this).field('text').focus();
      return false;
    }
    var limit = Aj.state.fileLimit || 5;
    if (files.length > limit) {
      showAlert(l('WEB_TOO_MANY_FILES', {limit: limit}));
      return false;
    }
    if ($('.file-loading', this).size()) {
      showAlert(l('WEB_UPLOADING_IN_PROGRESS'));
      return false;
    }
    $button.prop('disabled', true);
    Aj.apiRequest('submitIssueReply', {
      issue_id: issue_id,
      text: text,
      files: files.join(';'),
      device: device
    }, function(result) {
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.reply_html) {
        var $issue = $(form).parents('.cd-issue');
        $('.cd-reply-btn', $issue).fadeHide();
        $('.cd-issue-reply-wrap', $issue).replaceWith(result.reply_html);
      }
    });
    return false;
  },
  eDeleteReply: function(e) {
    e.preventDefault();
    var issue_id = $(this).parents('.cd-issue').attr('data-issue-id');
    var $issue = $(this).parents('.cd-issue');
    var confirm_text = l('WEB_DELETE_ISSUE_REPLY_CONFIRM_TEXT');
    showConfirm(confirm_text, function() {
      Aj.apiRequest('deleteIssueReply', {
        issue_id: issue_id
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
      if (result.reply_html) {
        $('.cd-reply-btn', $issue).fadeShow();
        $('.cd-issue-reply-wrap', $issue).replaceWith(result.reply_html);
        $('div.input[contenteditable]', $issue).initTextarea();
      }
      });
    }, l('WEB_DELETE_ISSUE_REPLY_CONFIRM_BUTTON'));
    return false;
  },
  eSubmitEditForm: function(e) {
    e.preventDefault();
    var form = this;
    var $issue     = $(this).parents('.cd-issue');
    var $button    = $('.cd-submit-edit-btn', this);
    var attach_btn = $('.cd-attach-btn', this).get(0);
    var issue_id   = $(this).field('issue_id').value();
    var text       = $(this).field('text').value();
    var files      = $(this.file).values();
    var device     = $(this).field('device').value();
    if (!text.length) {
      $(this).field('text').focus();
      return false;
    }
    var limit = Aj.state.fileLimit || 5;
    if (files.length > limit) {
      showAlert(l('WEB_TOO_MANY_FILES', {limit: limit}));
      return false;
    }
    if ($('.file-loading', this).size()) {
      showAlert(l('WEB_UPLOADING_IN_PROGRESS'));
      return false;
    }
    $button.prop('disabled', true);
    Aj.apiRequest('editIssue', {
      issue_id: issue_id,
      text: text,
      files: files.join(';'),
      device: device
    }, function(result) {
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.issue_html) {
        var $new_issue = $(result.issue_html);
        $issue.replaceWith($new_issue).updateAboveLikeText();
        $('.cd-issue-voting-buttons.need_tt', $new_issue).one('mouseover touchstart', Issues.ePreloadIssueLikes);
        $('div.input[contenteditable]', $new_issue).initTextarea();
      }
    });
    return false;
  },
  eSubmitIssueForm: function(e) {
    e.preventDefault();
    var form       = this;
    var $issues    = $(this).parents('.cd-issues-wrap').find('.cd-issues');
    var $button    = $('.cd-submit-issue-btn', this);
    var attach_btn = $('.cd-attach-btn', this).get(0);
    var entry_id   = $(this).field('entry_id').value();
    var text       = $(this).field('text').value();
    var files      = $(this.file).values();
    var device     = $(this).field('device').value();
    if (!text.length) {
      $(this).field('text').focus();
      return false;
    }
    var limit = Aj.state.fileLimit || 5;
    if (files.length > limit) {
      showAlert(l('WEB_TOO_MANY_FILES', {limit: limit}));
      return false;
    }
    if ($('.file-loading', this).size()) {
      showAlert(l('WEB_UPLOADING_IN_PROGRESS'));
      return false;
    }
    var submitIssue = function() {
      $button.prop('disabled', true);
      Aj.apiRequest('submitNewIssue', {
        entry_id: entry_id,
        text: text,
        files: files.join(';'),
        device: device
      }, function(result) {
        $button.prop('disabled', false);
        if (result.error) {
          return showAlert(result.error);
        }
        if (result.issue_html) {
          $(form).field('device').defaultValue(device);
          $(form).reset();
          var $issue = $(result.issue_html);
          $issue.appendTo($issues).updateAboveLikeText();
          $('div.input[contenteditable]', $issue).initTextarea();
          var issues_count = $('.cd-issue:not(.shide)', $issues).size();
          $('.cd-filter-wrap').fadeToggle(issues_count > 1);
          $('.cd-list-empty-wrap', $issues).hide().fadeHide();
          $('.cd-issue-files', form).empty();
          $('.cd-issue-voting-buttons.need_tt', $issue).one('mouseover touchstart', Issues.ePreloadIssueLikes);
        }
      });
    };
    if (!files.length) {
      var confirm_text = l('WEB_ADD_ATTACH_CONFIRM_TEXT');
      showConfirm(confirm_text, function() {
        Issues.eAttachFile.apply(attach_btn);
      }, l('WEB_ADD_ATTACH_CONFIRM_BUTTON'), function() {
        submitIssue();
      }, l('WEB_ADD_ATTACH_SKIP_BUTTON'));
    } else {
      submitIssue();
    }
    return false;
  },
  eDeleteIssue: function(e) {
    e.preventDefault();
    var issue_id = $(this).parents('.cd-issue').attr('data-issue-id');
    var $issue = $(this).parents('.cd-issue');
    var $issues = $issue.parents('.cd-issues-wrap').find('.cd-issues');
    var confirm_text = l('WEB_DELETE_ISSUE_CONFIRM_TEXT');
    showConfirm(confirm_text, function() {
      Aj.apiRequest('deleteIssue', {
        issue_id: issue_id
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        $issue.remove();
        var issues_count = $('.cd-issue:not(.shide)', $issues).size();
        $('.cd-filter-wrap').fadeToggle(issues_count > 1);
        if (!issues_count) {
          $('.cd-list-empty-wrap', $issues).show().fadeShow();
        }
      });
    }, l('WEB_DELETE_ISSUE_CONFIRM_BUTTON'));
    return false;
  },
  showMedia: function(el, scroll) {
    var $items = $(el).parents('.cd-view-medias').find('.cd-view-media');
    var num = -1, cur = el;
    var total = $items.each(function(i) {
      if (this === cur) { num = i; }
    }).size();
    var prev = $items.get(num > 0 ? num - 1 : total - 1);
    var next = $items.get(num < total - 1 ? num + 1 : 0);
    Issues.showGroupedMedia(cur, prev, next, num, total);
    if (scroll) {
      $(el).scrollIntoView();
    }
  },
  showGroupedMedia: function(el, prev, next, num, total) {
    var src = $(el).attr('href');
    var options = {
      width: parseInt($(el).attr('data-width')),
      height: parseInt($(el).attr('data-height')),
      cover: $(el).attr('data-cover'),
    };
    if (total > 1 && num >= 0) {
      options.pagination = {
        num: num,
        total: total,
        prev: function() {
          Issues.showMedia(prev, true);
        },
        next: function() {
          Issues.showMedia(next, true);
        }
      };
    }
    var is_video = el.hasAttribute('data-video');
    showMedia(src, is_video, options);
  },
  eShowMedia: function(e) {
    if (e.metaKey || e.ctrlKey) return true;
    e.preventDefault();
    e.stopImmediatePropagation();
    Issues.showMedia(this);
  },
  initLinks: function(cont) {
    Aj.onLoad(function(state) {
      $(cont).on('mouseover click', 'a [data-href]', Issues.eSublinkOver);
      $(cont).on('mouseout', 'a [data-href]', Issues.eSublinkOut);
    });
    Aj.onUnload(function(state) {
      $(cont).off('mouseover click', 'a [data-href]', Issues.eSublinkOver);
      $(cont).off('mouseout', 'a [data-href]', Issues.eSublinkOut);
    });
  },
  eSublinkOver: function() {
    var $a = $(this).parents('a');
    var original_href = $a.attr('href');
    var new_href = $(this).attr('data-href');
    $a.data('original_href', original_href);
    $a.attr('href', new_href);
  },
  eSublinkOut: function() {
    var $a = $(this).parents('a');
    var original_href = $a.data('original_href');
    $a.attr('href', original_href);
  }
};
