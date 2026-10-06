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
    } else if (callback == 'empty') {
      callback = function(){ $(this).empty(); };
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
      var in_frame = false;
      try {
        in_frame = window != window.top || document != top.document || self.location != top.location;
      } catch (e) {
        in_frame = true;
      }
      if (in_frame) {
        var nativeScroll = function(el) {
          if (!$(window).height()) {
            setTimeout(nativeScroll, 50, el);
          } else {
            if (needIframeScrollFix()) {
              try {
                window.parent.postMessage(JSON.stringify({event: 'scroll_to', y: el.getBoundingClientRect().top}), '*');
              } catch (e) {}
            } else {
              el.scrollIntoView(true);
            }
          }
        }
        nativeScroll(this);
      }
    });
  };
  function needIframeScrollFix() {
    try {
      var is_safari = navigator.userAgent.indexOf('Safari') > -1;
      var is_chrome = navigator.userAgent.indexOf('Chrome') > -1;
      return is_safari && !is_chrome;
    } catch (e) {}
  }
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
  $.fn.fields = function(name) {
    var el = this.get(0);
    if (el && el.tagName == 'FORM' && el[name]) {
      return $(el[name]);
    }
    return $([]);
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
        if (this.tagName == 'TEXTAREA' || this.tagName == 'INPUT' || this instanceof RadioNodeList) {
          this.value = val;
        } else {
          $(this).text(val).trigger('input');
        }
      });
    }
    return this.first().map(function() {
      if (this.tagName == 'TEXTAREA' || this.tagName == 'INPUT' || this instanceof RadioNodeList) {
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
      else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey &&
               e.which == 13) { // Enter
        e.preventDefault();
        $(this).parents('form').submit();
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
      var options = $field.data('textOptions');
      options.onInput && options.onInput(text);

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
      if ($field.attr('data-single-line')) {
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
      if (textEl && !textEl.classList.contains('cd-issue-files')) {
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
            shadowEl.style.display = 'inline-block';
            shadowEl.style.width = likeEl.offsetWidth + 'px';
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
  return value.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, getBR());
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
function wrapNumber(number, precise) {
  if (!+number) return '';
  if (number < 0) return '-' + wrapNumber(-number);
  if (number >= 1000000000) return wrapNumber(number / 1000000000) + 'B';
  if (number >= 1000000) return wrapNumber(number / 1000000) + 'M';
  if (number >= 1000) return wrapNumber(number / 1000) + 'K';
  if (precise) {
    var precision = number > 100 ? 0 : (number > 10 ? 1 : (number > 1 ? 2 : 3));
  } else {
    var precision = number > 10 ? 0 : (number > 1 ? 1 : 2);
  }
  var mult = 10 ^ precision;
  return Math.round(number * mult) / mult;
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

function formatDateTime(datetime) {
  var date = new Date(datetime);
  var cur_date = new Date();
  if (cur_date.getFullYear() == date.getFullYear() &&
      cur_date.getMonth() == date.getMonth() &&
      cur_date.getDate() == date.getDate()) {
    return formatTime(datetime);
  }
  return formatDate(datetime);
}

function formatDate(datetime) {
  var date = new Date(datetime);
  var cur_date = new Date();
  var j = date.getDate();
  var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
  var Y = date.getFullYear();
  if (cur_date.getFullYear() == date.getFullYear()) {
    return M + ' ' + j;
  }
  return M + ' ' + j + ', ' + Y;
}

function formatTime(datetime) {
  var date = new Date(datetime);
  var H = date.getHours();
  if (H < 10) H = '0' + H;
  var i = date.getMinutes();
  if (i < 10) i = '0' + i;
  return H + ':' + i;
}

function fixColor(color) {
  color = color.toUpperCase();
  if (color.length == 1 || color.length == 2) {
    color = color + color + color;
  } else if (color.length > 3 && color.length < 6) {
    color = color.substr(0, 3);
  } else if (color.length > 6) {
    color = color.substr(0, 6);
  }
  return color;
}
function isColorLight(color, k) {
  var hsl = rgb2hsl(color);
  if (typeof k === 'undefined') k = 0.8;
  if (k > 0) return (hsl.l > k);
  return (hsl.l < (1 + k));
}
function rgb2hsl(rgb) {
  rgb = fixColor(rgb);
  if (rgb.length == 3) {
    rgb = rgb[0] + rgb[0] + rgb[1] + rgb[1] + rgb[2] + rgb[2];
  }
  var r = parseInt(rgb.substr(0, 2), 16);
  var g = parseInt(rgb.substr(2, 2), 16);
  var b = parseInt(rgb.substr(4, 2), 16);
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b),
      min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;
  if (max == min) {
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {h: h, s: s, l: l};
}


function isLSEnabled() {
  try {
    return window.localStorage ? true : false;
  } catch (e) {
    return false;
  }
}

function setLS(xhr) {
  if (isLSEnabled()) {
    var value;
    if (value = xhr.getResponseHeader('X-Set-Local-Storage')) {
      var arr = value.split('=');
      var key = decodeURIComponent(arr[0]);
      var val = decodeURIComponent(arr[1]);
      if (val.length) {
        localStorage.setItem(key, val);
      } else {
        localStorage.removeItem(key);
      }
    }
  }
}

function getLSString() {
  if (isLSEnabled()) {
    var arr = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      arr.push(encodeURIComponent(key) + '=' + encodeURIComponent(localStorage[key]));
    }
    return arr.join('; ');
  }
  return false;
}

function getAjaxHeaders() {
  var headers = {}, str;
  if (str = getLSString()) {
    headers['X-Local-Storage'] = str;
  }
  return headers;
}

function stopImmediatePropagation(e) {
  e.stopImmediatePropagation();
}
function preventDefault(e) {
  e.preventDefault();
}

function apiRequest(method, data, onCallback) {
  $.ajax(ApiUrl, {
    type: 'POST',
    data: $.extend(data, {method: method}),
    dataType: 'json',
    xhrFields: {
      withCredentials: true
    },
    headers: getAjaxHeaders(),
    success: function(result) {
      if (result._dlog) {
        $('#dlog').append(result._dlog);
      }
      onCallback && onCallback(result);
    },
    error: function(xhr) {
      onCallback && onCallback({error: 'Server error'});
    }
  });
}

function reLogin(callback) {
  var headers = getAjaxHeaders();
  headers['X-Requested-With'] = 'relogin';
  $.ajax(location.href, {
    dataType: 'html',
    headers: headers,
    success: function(html) {
      document.open();
      document.write(html);
      document.close();
      callback && callback();
    }
  });
}

function showToast(html, delay) {
  var $toast = $('<div class="toast-container ohide"><div class="toast"></div></div>');
  $('.toast', $toast).html(html);
  var to, close = function() {
    clearTimeout(to);
    $toast.fadeHide();
    setTimeout(function() { $toast.remove(); }, 200);
  };
  $toast.appendTo('body').redraw().fadeShow();
  $(document).one('mousedown touchstart', close);
  to = setTimeout(close, delay || 2000);
}


var Login = {
  auth: function() {
    Telegram.Login.auth(window.ApiOAuthData, function(user) {
      $.ajax('/auth', {
        type: 'POST',
        data: user,
        dataType: 'json',
        xhrFields: {
          withCredentials: true
        },
        headers: getAjaxHeaders(),
        success: function(result, s, xhr) {
          if (result.ok) {
            setLS(xhr);
            reLogin();
          } else {
            location.reload();
          }
        }
      });
    });
  }
};

var Comments = {
  UPDATE_PERIOD: 3000,
  ONBLUR_UPDATE_PERIOD: 10000,
  init: function() {
    $('.bc-new-comment-form div.input[contenteditable]').initTextarea();
    $(document).on('click', '.bc-edit-btn', Comments.eOpenEdit);
    $(document).on('click', '.bc-edit-cancel-btn', Comments.eCloseEdit);
    $(document).on('click', '.bc-reply-btn', Comments.eReplyComment);
    $(document).on('click', '.bc-comment-date', Comments.eReplyComment);
    $(document).on('click', '.bc-delete-btn', Comments.eDeleteComment);
    $(document).on('click', '.bc-restore-btn', Comments.eRestoreComment);
    $(document).on('click', '.bc-comment-like', Comments.eLikeComment.pbind('liked'));
    $(document).on('click', '.bc-comment-dislike', Comments.eLikeComment.pbind('disliked'));
    $(document).on('click', '.bc-delete-all-btn', Comments.eDeleteAllComments);
    $(document).on('click', '.bc-promote-admin-btn', Comments.eSetAsAdmin);
    $(document).on('click', '.bc-promote-moder-btn', Comments.eSetAsModer);
    $(document).on('click', '.bc-demote-btn', Comments.eDemoteUser);
    $(document).on('click', '.bc-reply-close', Comments.eCancelReplyComment);
    $(document).on('click', '.bc-attach-btn', Comments.eAttachFile);
    $(document).on('click', '.file-upload', stopImmediatePropagation);
    $(document).on('click', 'a[data-comment-link]', Comments.eCommentHighlight);
    $(document).on('click', '.bc-load-more', Comments.eLoadMore);
    $(document).on('click', '.bc-comment-file-close', Comments.eDeleteFile);
    $(document).on('click', '.bc-subscribe-btn', Comments.eSubscribePopup);
    $(document).on('click', '.bc-do-subscribe-btn', Comments.eSubscribe);
    $(document).on('click', '.bc-logout-btn', Comments.eLogOut);
    $(document).on('click', '.bc-do-logout-btn', Comments.eDoLogOut);
    $(document).on('click', '.bc-arrow-down', Comments.eScrollDown);
    $(document).on('click', '.bc-comment-login-btn', Comments.eLogIn);
    $(window).on('resize scroll', Comments.onScroll);
    $(window).on('focus blur', Comments.onFocusChange);
    $(document).on('change', '.file-upload', Comments.eSelectFile);
    $(document).on('submit', '.bc-new-comment-form', Comments.eSubmitCommentForm);
    $(document).on('submit', '.bc-edit-comment-form', Comments.eSubmitEditForm);
    $(document).on('shown.bs.dropdown', '.bc-dropdown-wrap', Comments.eDropdown);
    $('.bc-post .js-widget_message').each(function() {
      TPost.init(this);
    });
    Comments.initComments('.bc-comments');
    Comments.onScroll();
    $('.bc-content').removeClass('no-transition');
    Comments.requestCommentsUpdate();
  },
  eCommentHighlight: function(e) {
    var comment_id = $(this).attr('data-comment-link');
    if (comment_id) {
      e.preventDefault();
      Comments.highlightComment(comment_id);
    }
  },
  highlightComment: function(comment_id, noload) {
    var found = false;
    $('.bc-comment[data-comment-id]').each(function() {
      if ($(this).attr('data-comment-id') == comment_id) {
        var $comment = $(this);
        $comment.scrollIntoView({position: 'center', padding: 15});
        $comment.highlight(1500);
        found = true;
      }
    });
    if (!found && !noload) {
      Comments.loadComment(comment_id);
    }
  },
  eDropdown: function(e) {
    $(this).removeClass('top');
    var el = this.querySelector('.dropdown-menu');
    var rect = el.getBoundingClientRect();
    var clientHeight = $(window).height();
    if (rect.top - rect.height - 35 > 0 &&
        rect.bottom + 15 >= clientHeight) {
      $(this).addClass('top');
    }
  },
  eLoadMore: function(e) {
    e.preventDefault();
    $moreEl = $(this);
    var loading = $moreEl.data('loading');
    if (loading) {
      return false;
    }
    var before = $moreEl.attr('data-before');
    var after  = $moreEl.attr('data-after');
    $moreEl.data('loading', true);
    $moreEl.addClass('dots-animated');

    var thread_id = $('.bc-new-comment-form').field('thread_id').value();

    var _load = function(thread_id, before, after) {
      if (after) {
        Comments.requestCommentsUpdate();
      }
      apiRequest('loadComments', {
        thread_id: thread_id,
        before_id: before,
        after_id:  after
      }, function(result) {
        if (result.error) {
          var timeout = $moreEl.data('timeout') || 1000;
          $moreEl.data('timeout', timeout > 60000 ? timeout : timeout * 2);
          setTimeout(function(){ _load(thread_id, before, after); }, timeout);
        } else {
          if (result.header_html) {
            $('.bc-header').html(result.header_html);
          }
          var $comments = $(result.comments_html);
          Comments.initComments($comments);
          if (before) {
            var y = $moreEl.offset().top + $moreEl.outerHeight(true) - $(document).scrollTop();
            $comments.insertBefore($moreEl);
            var st = $moreEl.offset().top - y;
            $moreEl.remove();
            if (!window.WidgetAutoHeight) {
              $(window).scrollTop(st);
            }
          } else {
            $comments.insertBefore($moreEl);
            $moreEl.remove();
            Comments.requestCommentsUpdate();
          }
          $('.bc-list-empty-wrap').remove();
        }
      });
    };
    _load(thread_id, before, after);
  },
  onFocusChange: function() {
    if (document.hasFocus()) {
      if ((new Date) - Comments.lastUpdate > Comments.UPDATE_PERIOD / 2) {
        Comments.updateComments();
      } else {
        Comments.requestCommentsUpdate();
      }
    }
  },
  requestCommentsUpdate: function() {
    clearTimeout(Comments.updateTo);
    Comments.updateTo = setTimeout(Comments.updateComments, document.hasFocus() ? Comments.UPDATE_PERIOD : Comments.ONBLUR_UPDATE_PERIOD);
  },
  updateComments: function() {
    clearTimeout(Comments.updateTo);
    var $moreEl = $('.bc-load-more[data-after]');
    if (!$moreEl.size() || !$moreEl.hasClass('bc-autoload')) {
      Comments.requestCommentsUpdate();
      return false;
    }
    // if (!document.hasFocus()) {
    //   Comments.requestCommentsUpdate();
    //   return false;
    // }
    var after = $moreEl.attr('data-after');
    $moreEl.data('loading', true);

    var thread_id = $('.bc-new-comment-form').field('thread_id').value();

    var _load = function(thread_id, after) {
      apiRequest('loadComments', {
        thread_id: thread_id,
        after_id:  after,
        auto: 1
      }, function(result) {
        Comments.lastUpdate = +(new Date);
        if (result.error) {
          var timeout = $moreEl.data('timeout') || 1000;
          $moreEl.data('timeout', timeout > 60000 ? timeout : timeout * 2);
          setTimeout(function(){ _load(thread_id, after); }, timeout);
        } else {
          var $curMoreEl = $('.bc-load-more.bc-autoload[data-after]');
          if (!$curMoreEl.size()) {
            Comments.requestCommentsUpdate();
            return false;
          }
          if ($curMoreEl.attr('data-after') != after) {
            Comments.requestCommentsUpdate();
            return false;
          }
          if (result.header_html) {
            $('.bc-header').html(result.header_html);
          }
          var $comments = $(result.comments_html);
          Comments.initComments($comments);
          $comments.insertBefore($curMoreEl);
          $curMoreEl.remove();
          Comments.requestCommentsUpdate();
        }
      });
    };
    _load(thread_id, after);
  },
  loadComment: function(comment_id) {
    var $comments = $('.bc-comments');
    var loading = $comments.data('loading');
    if (loading) {
      return false;
    }
    $comments.data('loading', true);

    var thread_id = $('.bc-new-comment-form').field('thread_id').value();
    apiRequest('loadComments', {
      thread_id: thread_id,
      comment_id: comment_id
    }, function(result) {
      if (!result.error) {
        if (result.header_html) {
          $('.bc-header').html(result.header_html);
        }
        if (result.comments_html) {
          $comments.html(result.comments_html);
          Comments.initComments($comments);
          Comments.requestCommentsUpdate();
        }
        Comments.highlightComment(comment_id, true);
        $comments.data('loading', false);
      }
    });
  },
  eAttachFile: function(e) {
    e && e.stopImmediatePropagation();
    e && e.preventDefault();
    $('<input type="file" accept="image/gif,image/jpeg,image/jpg,image/png" class="file-upload hide">').appendTo(this).click();
  },
  eDeleteFile: function(e) {
    var $file = $(this).parents('.bc-comment-file');
    if ($file.hasClass('file-loading')) {
      var xhr = $file.data('xhr');
      if (xhr) {
        xhr.aborted = true;
        xhr.abort();
      }
    }
    $file.parents('.bc-comment-file-wrap').slideHide('empty');
    $('.bc-attach-btn').fadeShow();
  },
  eSelectFile: function(e) {
    var input = this,
        $form = $(input).parents('form'),
        form = $form.get(0),
        $photo = $('.bc-comment-file-wrap', $form),
        size_limit = 5 * 1024 * 1024;
    if (input.files && input.files[0]) {
      var file = input.files[0];
      if (file.size > size_limit) {
        showAlert('File is too big: ' + wrapSize(file.size));
        return false;
      }
      var $file_delete = $('<span class="bc-comment-file-close close"></span>'),
          $file_thumb = $('<div class="bc-comment-file-thumb"><svg class="bc-comment-file-progress-wrap" viewPort="0 0 66 66" width="66px" height="66px"><circle class="bc-comment-file-progress-bg" cx="50%" cy="50%"></circle><circle class="bc-comment-file-progress" cx="50%" cy="50%" stroke-dashoffset="106"></circle></svg></div>'),
          $file_thumb_wrap = $('<div class="bc-comment-file-thumb-wrap">');
          $file_thumb_box = $('<div class="bc-comment-file-thumb-box">');

      var $file = $('<div class="bc-comment-file"></div>').append($file_thumb_box.append($file_thumb_wrap.append($file_thumb)).append($file_delete)).appendTo($photo).redraw();
      $photo.slideShow();
      $('.bc-attach-btn').fadeHide();

      Comments.getThumb(file, 640, function onSuccess(thumb, th_w, th_h) {
        var thumb_width = 320, thumb_height = 160;
        if (thumb) {
          var scale    = Math.min(1, Math.min(320 / th_w, 160 / th_h));
          thumb_width  = th_w * scale;
          thumb_height = th_h * scale;
          var thumb_url = URL.createObjectURL(thumb);
          $file_thumb.css('background-image', "url('" + thumb_url + "')");
        }
        var padding_top = thumb_height / thumb_width * 100;
        $file_thumb_wrap.css('width', thumb_width);
        $file_thumb.css('padding-top', padding_top + '%');
        var xhr = Comments.uploadFile(file, function onSuccess(file) {
          if (file.photo_src &&
              !$file_thumb.css('background-image')) {
            $file_thumb.css('background-image', "url('" + file.photo_src + "')");
          }
          $('<input type="hidden" name="file">').value(file.file_data).prependTo($file);
          $file.removeClass('file-loading').addClass('file-loaded');
        }, function onProgress(loaded, total) {
          progress = total ? loaded / total : 0;
          progress = Math.max(0, Math.min(progress, 1));
          $('.bc-comment-file-progress', $file_thumb).attr('stroke-dashoffset', 106 * (1 - progress));
        }, function onError(error) {
          if (xhr.aborted) return;
          $file.slideHide('remove');
          $('.bc-attach-btn').fadeShow();
          showAlert(error);
        });
        $file.data('xhr', xhr);
        $file.addClass('file-loading');
      });
    }
  },
  uploadFile: function(file, onSuccess, onProgress, onError) {
    var data = new FormData();
    data.append('file', file, file.name);
    return $.ajax({
      url: '/upload',
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
    var thumb = false, thumb_w = 0, thumb_h = 0, got = false
        ready = function() {
          clearTimeout(thumbTo);
          if (!got) {
            got = true; onResult(thumb, thumb_w, thumb_h);
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
            canvas.width = thumb_w = dw
            canvas.height = thumb_h = dh;
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
    } catch (e) { ready(); }
  },
  initComments: function(context) {
    Comments.updateTime(context);
    $('div.input[contenteditable]', context).initTextarea();
    $('.bc-comment-voting.need_tt', context).one('mouseover touchstart', Comments.ePreloadCommentLikes);
    var new_cnt = $(context).filter('.bc-autoload').attr('data-new-count');
    $('.bc-arrow-down').toggleClass('has-new', new_cnt > 0);
    $('.bc-badge').text(wrapNumber(new_cnt));
  },
  updateTime: function(context) {
    $('time[datetime]', context).each(function () {
      var $time = $(this);
      $time.html(formatDateTime($time.attr('datetime')));
    });
  },
  restoreEditForm: function($form) {
    if (!$form.data('initSaved')) {
      $form.data('initSaved', true);
      $form.data('text', $form.field('text').value());
      $form.data('files_html', $('.bc-comment-file-wrap', $form).html());
    } else {
      $form.field('text').value($form.data('text'));
      var files_html = $form.data('files_html');
      $('.bc-comment-file-wrap', $form).html(files_html).toggleClass('shide', !files_html.length);
    }
  },
  eOpenEdit: function(e) {
    e.preventDefault();
    var $commentEl = $(this).parents('.bc-comment');
    var $form = $('.bc-edit-comment-form', $commentEl);
    Comments.restoreEditForm($form);
    $commentEl.addClass('edit');
    $('.bc-edit-comment-form', $commentEl).field('text').focusAndSelectAll();
  },
  eCloseEdit: function(e) {
    e.preventDefault();
    var $commentEl = $(this).parents('.bc-comment');
    $commentEl.removeClass('edit');
  },
  eReplyComment: function(e) {
    e.preventDefault();
    var $commentEl = $(this).parents('.bc-comment');
    var reply_to_id = $commentEl.attr('data-comment-id');
    var $replyEl = $('<a class="bc-comment-reply-content"><div class="bc-reply-close close"></div><div class="bc-comment-head accent-color"></div></a>').attr('data-comment-link', reply_to_id);
    var $replyWrapEl = $('<div class="bc-comment-reply-wrap"><div class="bc-comment-reply"></div></div>');
    var $formEl = $('.bc-new-comment-form');
    var authorHtml = $('.bc-comment-author-name', $commentEl).html();
    var $textEl = $('.bc-comment-body > .bc-comment-text', $commentEl).clone();
    var thumbUrl = $('.bc-comment-file-image', $commentEl).attr('data-thumb-url');
    var $replyToInput = $('<input type="hidden" name="reply_to_id">').attr('value', reply_to_id);
    $('br', $textEl).replaceWith(' ');
    $('a', $textEl).wrapInner('<span>').find('>span').unwrap();
    $('.bc-comment-head', $replyEl).append($(authorHtml).wrapInner('<span dir="auto">').find('>span').unwrap());
    if (thumbUrl) {
      var $fileEL = $('<div class="bc-comment-thumb">').css('background-image', "url('" + thumbUrl + "')");
      $replyEl.prepend($fileEL);
      if (!$textEl.html()) {
        $textEl.html('<span class="bc-comment-reply-file">Photo</span>');
      }
    }
    $replyEl.prepend($replyToInput);
    $replyEl.append($textEl);
    $prevReplyWrapEl = $('.bc-comment-reply-wrap', $formEl);
    $('.bc-comment-reply', $replyWrapEl).append($replyEl);
    if ($prevReplyWrapEl.filter(':not(.shide)').size() > 0) {
      $prevReplyWrapEl.remove();
      $formEl.prepend($replyWrapEl.removeClass('shide'));
    } else {
      $formEl.prepend($replyWrapEl);
    }
    $replyWrapEl.data('$commentEl', $commentEl);
    setTimeout(function() {
      Comments.scrollDown();
      $('.bc-comment-input', $formEl).focus();
    }, 100);
  },
  eCancelReplyComment: function(e) {
    e && e.preventDefault();
    e && e.stopImmediatePropagation();
    $replyWrapEl = $('.bc-new-comment-form .bc-comment-reply-wrap');
    if ($('body').hasClass('bc-embed-mode')) {
      $replyWrapEl.remove();
    } else {
      $replyWrapEl.slideHide('remove');
    }
  },
  scrollDown: function(timeout) {
    var scroll_fn = function() {
      $(window).scrollTop($(document).height());
    };
    if (timeout) {
      setTimeout(scroll_fn, timeout);
    } else {
      scroll_fn();
    }
  },
  eScrollDown: function(e) {
    e && e.preventDefault();
    Comments.scrollDown();
  },
  onScroll: function() {
    var dheight = $(document).height();
    var wheight = $(window).height();
    var bottom  = $(window).scrollTop() + wheight;
    var shown   = (dheight > wheight) && (dheight - bottom > 78);
    $('.bc-arrow-down').toggleClass('ohide', !shown);
    if (!wheight) {
      setTimeout(Comments.onScroll, 50);
    }
  },
  eSubmitEditForm: function(e) {
    e.preventDefault();
    var form       = this;
    var $form      = $(form);
    var $button    = $('.bc-submit-comment-btn', form);
    var $commentEl = $form.parents('.bc-comment');
    var thread_id  = $('.bc-new-comment-form').field('thread_id').value();
    var comment_id = $commentEl.attr('data-comment-id');
    if (!comment_id || !thread_id) {
      return false;
    }
    var text = $form.field('text').value();
    var file = $form.field('file').value();

    if ($('.file-loading', form).size()) {
      showAlert('Uploading in progress');
      return false;
    }
    if ($form.data('submiting')) {
      return false;
    }
    $form.data('submiting', true);
    $button.prop('disabled', true);
    apiRequest('editComment', {
      thread_id: thread_id,
      comment_id: comment_id,
      text: text,
      file: file
    }, function(result) {
      $form.data('submiting', false);
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      $form.reset();
      $commentEl.removeClass('edit');
      if (result.comment_html) {
        var $newComment = $(result.comment_html);
        Comments.initComments($newComment);
        $newComment.insertBefore($commentEl)
        $commentEl.remove();
      }
    });
    return false;
  },
  eSubmitCommentForm: function(e) {
    e.preventDefault();
    var form        = this;
    var $form       = $(form);
    var $button     = $('.bc-submit-comment-btn', form);
    var thread_id   = $form.field('thread_id').value();
    var reply_to_id = $form.field('reply_to_id').value();
    var text        = $form.field('text').value();
    var file        = $form.field('file').value();
    if (!text.length && !file) {
      $form.field('text').focus();
      return false;
    }
    if ($('.file-loading', this).size()) {
      showAlert('Uploading in progress');
      return false;
    }
    if ($form.data('submiting')) {
      return false;
    }
    var $moreEl = $('.bc-load-more[data-after]');
    var after   = $moreEl.attr('data-after') || 0;
    $form.data('submiting', true);
    $button.prop('disabled', true);
    Comments.requestCommentsUpdate();
    apiRequest('submitNewComment', {
      thread_id: thread_id,
      reply_to_id: reply_to_id,
      after_id: after,
      text: text,
      file: file
    }, function(result) {
      $form.data('submiting', false);
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      $form.reset();
      $('.bc-comment-file-wrap', form).empty().addClass('shide');
      $('.bc-attach-btn').fadeShow();
      Comments.eCancelReplyComment();
      if (result.header_html) {
        $('.bc-header').html(result.header_html);
      }
      if (result.comments_html) {
        var $comments = $(result.comments_html);
        Comments.initComments($comments);
        if (result.replace) {
          $('.bc-comments').empty().append($comments);
        } else {
          $comments.insertBefore($moreEl);
          $moreEl.remove();
        }
        Comments.requestCommentsUpdate();
      }
      Comments.scrollDown(50);
    });
    return false;
  },
  eDeleteComment: function(e) {
    e.preventDefault();
    $(this).parents('.open').find('.dropdown-toggle').dropdown('toggle');
    var $comment    = $(this).parents('.bc-comment');
    var thread_id   = $('.bc-new-comment-form').field('thread_id').value();
    var comment_id  = $comment.attr('data-comment-id');
    if (!comment_id || !thread_id) {
      return false;
    }
    $comment.addClass('deleted');
    apiRequest('deleteComment', {
      thread_id: thread_id,
      comment_id: comment_id
    }, function(result) {
      if (result.error) {
        $comment.removeClass('deleted');
        return showAlert(result.error);
      }
    });
    return false;
  },
  eDeleteAllComments: function(e) {
    e.preventDefault();
    $(this).parents('.open').find('.dropdown-toggle').dropdown('toggle');
    var $comment    = $(this).parents('.bc-comment');
    var $deletedEl  = $(this).parents('.bc-comment-deleted');
    var thread_id   = $('.bc-new-comment-form').field('thread_id').value();
    var comment_id  = $comment.attr('data-comment-id');
    if (!comment_id || !thread_id) {
      return false;
    }
    var authorHtml  = $('.bc-comment-author-name', $comment).html();
    authorHtml = $(authorHtml).html();
    var deleteAll = function() {
      $deletedEl.html('Deleting comments').removeClass('moder-deleted').addClass('dots-animated');
      Comments.requestCommentsUpdate();
      apiRequest('deleteCommentsAndBan', {
        thread_id: thread_id,
        comment_id: comment_id
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        if (result.repeat) {
          deleteAll();
        } else {
          if (result.header_html) {
            $('.bc-header').html(result.header_html);
          }
          if (result.comments_html) {
            $('.bc-comments').html(result.comments_html);
            Comments.initComments('.bc-comments');
            Comments.requestCommentsUpdate();
          }
          Comments.scrollDown(50);
        }
      });
    }
    showConfirm('Delete all from <b dir="auto">' + authorHtml + '</b> and ban them?<br><br>This will irreversibly remove all comments from <b dir="auto">' + authorHtml + '</b> under all posts in your channel and ban them.', deleteAll, 'Delete and ban');
    return false;
  },
  eSetAsAdmin: function(e) {
    e.preventDefault();
    $(this).parents('.open').find('.dropdown-toggle').dropdown('toggle');
    var $comment    = $(this).parents('.bc-comment');
    var thread_id   = $('.bc-new-comment-form').field('thread_id').value();
    var user_id     = $comment.attr('data-user-id');
    if (!thread_id) {
      return false;
    }
    var authorHtml  = $('.bc-comment-author-name', $comment).html();
    authorHtml = $(authorHtml).html();
    showConfirm('Set <b dir="auto">' + authorHtml + '</b> as admin?', function() {
      apiRequest('promoteUser', {
        thread_id: thread_id,
        user_id: user_id,
        admin: 1
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        $('.bc-comment').each(function() {
          if (this.getAttribute('data-user-id') == user_id) {
            $(this).removeClass('bc-user-moder').addClass('bc-user-admin');
          }
        });
        showToast('Admin added.');
      });
    }, 'Set as admin');
    return false;
  },
  eSetAsModer: function(e) {
    e.preventDefault();
    $(this).parents('.open').find('.dropdown-toggle').dropdown('toggle');
    var $comment    = $(this).parents('.bc-comment');
    var thread_id   = $('.bc-new-comment-form').field('thread_id').value();
    var user_id     = $comment.attr('data-user-id');
    if (!thread_id) {
      return false;
    }
    var authorHtml  = $('.bc-comment-author-name', $comment).html();
    authorHtml = $(authorHtml).html();
    showConfirm('Set <b dir="auto">' + authorHtml + '</b> as moderator?', function() {
      apiRequest('promoteUser', {
        thread_id: thread_id,
        user_id: user_id,
        moder: 1
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        $('.bc-comment').each(function() {
          if (this.getAttribute('data-user-id') == user_id) {
            $(this).removeClass('bc-user-admin').addClass('bc-user-moder');
          }
        });
        showToast('Moderator added.');
      });
    }, 'Set as moderator');
    return false;
  },
  eDemoteUser: function(e) {
    e.preventDefault();
    $(this).parents('.open').find('.dropdown-toggle').dropdown('toggle');
    var $comment    = $(this).parents('.bc-comment');
    var thread_id   = $('.bc-new-comment-form').field('thread_id').value();
    var user_id     = $comment.attr('data-user-id');
    if (!thread_id) {
      return false;
    }
    var authorHtml  = $('.bc-comment-author-name', $comment).html();
    authorHtml = $(authorHtml).html();
    showConfirm('Demote <b dir="auto">' + authorHtml + '</b>?', function() {
      apiRequest('demoteUser', {
        thread_id: thread_id,
        user_id: user_id
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        $('.bc-comment').each(function() {
          if (this.getAttribute('data-user-id') == user_id) {
            $(this).removeClass('bc-user-moder').removeClass('bc-user-admin');
          }
        });
        showToast('User demoted.');
      });
    }, 'Demote');
    return false;
  },
  eRestoreComment: function(e) {
    e.preventDefault();
    var $comment    = $(this).parents('.bc-comment');
    var thread_id   = $('.bc-new-comment-form').field('thread_id').value();
    var comment_id  = $comment.attr('data-comment-id');
    if (!comment_id || !thread_id) {
      return false;
    }
    $comment.removeClass('deleted');
    apiRequest('restoreComment', {
      thread_id: thread_id,
      comment_id: comment_id
    }, function(result) {
      if (result.error) {
        $comment.addClass('deleted');
        return showAlert(result.error);
      }
    });
    return false;
  },
  ePreloadCommentLikes: function(e) {
    var $voting = $(this);
    if (!$voting.hasClass('need_tt')) return false;
    $voting.removeClass('need_tt');
    var $commentEl = $voting.parents('.bc-comment');
    var thread_id  = $('.bc-new-comment-form').field('thread_id').value();
    var comment_id = $commentEl.attr('data-comment-id');
    if (!comment_id || !thread_id) {
      return false;
    }
    apiRequest('getCommentLikes', {
      thread_id: thread_id,
      comment_id: comment_id
    }, function(result) {
      if (!result.error) {
        Comments.updateCommentLikes($voting, result);
      }
    });
    return false;
  },
  eLikeComment: function(state, e) {
    e.stopPropagation();
    e.preventDefault();
    if (window.ApiUnauth) {
      Login.auth();
      return false;
    }
    var $commentEl = $(this).parents('.bc-comment');
    var $voting    = $(this).parents('.bc-comment-voting');
    var thread_id  = $('.bc-new-comment-form').field('thread_id').value();
    var comment_id = $commentEl.attr('data-comment-id');
    if (!comment_id || !thread_id) {
      return false;
    }
    var cur_state = '';
    if ($voting.hasClass('liked')) cur_state = 'liked';
    if ($voting.hasClass('disliked')) cur_state = 'disliked';
    var prev_likes = {
      likes: +$('.bc-comment-like .value', $voting).attr('data-value') || 0,
      dislikes: +$('.bc-comment-dislike .value', $voting).attr('data-value') || 0,
      state: cur_state
    };
    var likes = $.extend({}, prev_likes);
    var method;
    if (state == 'liked') {
      if ($voting.hasClass('liked')) {
        method = 'unlikeComment';
        likes.state = '';
        likes.likes--;
      } else {
        if ($voting.hasClass('disliked')) {
          likes.dislikes--;
        }
        method = 'likeComment';
        likes.state = state;
        likes.likes++;
      }
    } else if (state == 'disliked') {
      if ($voting.hasClass('disliked')) {
        method = 'unlikeComment';
        likes.state = '';
        likes.dislikes--;
      } else {
        if ($voting.hasClass('liked')) {
          likes.likes--;
        }
        method = 'dislikeComment';
        likes.state = state;
        likes.dislikes++;
      }
    }
    apiRequest(method, {
      thread_id: thread_id,
      comment_id: comment_id
    }, function(result) {
      if (result.error) {
        Comments.updateCommentLikes($voting, prev_likes);
        return showAlert(result.error);
      }
      Comments.updateCommentLikes($voting, result);
    });
    Comments.updateCommentLikes($voting, likes);
    return false;
  },
  updateCommentLikes: function($voting, likes) {
    $('.bc-comment-like .value', $voting).attr('data-value', likes.likes || 0).text(wrapNumber(likes.likes));
    $('.bc-comment-dislike .value', $voting).attr('data-value', likes.dislikes || 0).text(wrapNumber(likes.dislikes));
    Comments.updateLikeTooltip($('.bc-comment-like', $voting), likes.likes_tt);
    Comments.updateLikeTooltip($('.bc-comment-dislike', $voting), likes.dislikes_tt);
    $voting.removeClass('liked').removeClass('disliked');
    if (likes.state) {
      $voting.addClass(likes.state);
    }
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
  eSubscribePopup: function(e) {
    e.preventDefault();
    $(this).parents('.open').find('.dropdown-toggle').dropdown('toggle');
    $('.bc-subscribe-all').prop('checked', false);
    openPopup('.bc-subscribe-popup', {closeByClickOutside: '.popup-body'});
    return false;
  },
  eSubscribe: function(e) {
    e.preventDefault();
    var $button   = $(this);
    var thread_id = $('.bc-new-comment-form').field('thread_id').value();
    if (!thread_id || $button.data('processing')) {
      return false;
    }
    var $sub_button = $('.bc-subscribe-btn');
    var unsubscribe = $sub_button.hasClass('unsubscribe');
    var all = $('.bc-subscribe-all').prop('checked');
    $button.data('processing', true);
    $button.prop('disabled', true);
    apiRequest('subscribeToComments', {
      thread_id: thread_id,
      unsubscribe: unsubscribe ? 1 : 0,
      all: all ? 1 : 0
    }, function(result) {
      $button.data('processing', false);
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      $sub_button.toggleClass('unsubscribe', result.subscribed);
      $('.bc-subscribe-popup').replaceWith(result.popup_html);
      if (result.toast) {
        showToast(result.toast, 3500);
      }
    });
    return false;
  },
  eLogIn: function(e) {
    e.preventDefault();
    Login.auth();
    return false;
  },
  eLogOut: function(e) {
    e.preventDefault();
    $(this).parents('.open').find('.dropdown-toggle').dropdown('toggle');
    $('.bc-logout-all').prop('checked', false);
    openPopup('.bc-logout-popup', {closeByClickOutside: '.popup-body'});
    return false;
  },
  eDoLogOut: function(e) {
    e.preventDefault();
    var logout_hash = $(this).attr('data-logout-hash');
    var logout_all = $('.bc-logout-all').prop('checked');
    $.ajax('/auth', {
      type: 'POST',
      data: {all: logout_all ? 1 : 0, logout_hash: logout_hash},
      dataType: 'json',
      xhrFields: {
        withCredentials: true
      },
      headers: getAjaxHeaders(),
      success: function(result, s, xhr) {
        if (result.ok) {
          setLS(xhr);
          reLogin();
        } else {
          location.reload();
        }
      }
    });
  }
};

var Manage = {
  init: function() {
    $(document).on('click', '.bc-unblock-btn', Manage.eUnbanUser);
    $(document).on('click', '.bc-demote-btn', Manage.eDemoteUser);
    $(document).on('click', '.bc-update-rights-btn', Manage.eUpdateRights);
    $('.bc-website-connect-form').on('submit', Manage.eConnectWebsiteForm);
    $('.bc-settings-form').on('submit', Manage.eSettingsForm);
    $('.bc-embed-form input').on('change', Manage.eEmbedChange);
    $('.bc-customize-btn').on('click', Manage.eCustomizeOpen);
    $('.bc-copy-code-btn').on('click', Manage.eCopyCode);
    $('.bc-embed-form').on('submit', preventDefault);
    $('.bc-form-input .bc-form-control').on('focus blur keyup change input', Manage.eUpdateField);
    $('.bc-embed-form').fields('color').on('change', function() {
      if ($(this).value() == 'custom') {
        $('.bc-color-field').select();
      }
      Manage.eEmbedChange();
    });
    $('.bc-embed-form').field('customcolor').on('input', function() {
      var val = this.value;
      this.value = val.toUpperCase().replace(/[^0-9A-F]+/g, '');
      var color = fixColor(this.value);
      var is_dark = $('body').hasClass('bc-dark');
      $('.bc-color-circle-custom').css('color', color ? '#' + color : '').toggleClass('light', isColorLight(color)).toggleClass('bordered', isColorLight(color, is_dark ? -0.8 : 0.95));
    });
    $('.bc-color-field').on('focus', function() {
      $('.bc-embed-form').field('color').value('custom');
      Manage.eEmbedChange();
    });
    $('.bc-content').removeClass('no-transition');
    var $embed_code = $('.bc-embed-form').field('embed_code');
    if ($embed_code.size()) {
      $embed_code.height(0).innerHeight($embed_code.get(0).scrollHeight);
    }
  },
  eConnectWebsiteForm: function(e) {
    e.preventDefault();
    var form      = this;
    var $form     = $(form);
    var $button   = $('.bc-website-connect-btn', form);
    var site_name = $form.field('website_name').value();
    var domains   = $form.field('website_domains').value();
    $form.data('submiting', true);
    $button.prop('disabled', true);
    apiRequest('connectWebsite', {
      site_name: site_name,
      domains: domains
    }, function(result) {
      $form.data('submiting', false);
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.redirect_url) {
        location.href = result.redirect_url;
      } else {
        reLogin();
      }
    });
    return false;
  },
  eSettingsForm: function(e) {
    e.preventDefault();
    var form       = this;
    var $form      = $(form);
    var $button    = $('.bc-settings-save-btn', form);
    var website_id = $('.bc-settings-form').field('websiteid').value();
    if (!website_id) {
      return false;
    }
    var site_name = $form.field('website_name').value();
    var domains   = $form.field('website_domains').value();
    $form.data('submiting', true);
    $button.prop('disabled', true);
    apiRequest('saveSettings', {
      website_id: website_id,
      site_name: site_name,
      domains: domains
    }, function(result) {
      $form.data('submiting', false);
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      showToast('Settings saved.');
    });
    return false;
  },
  eUnbanUser: function(e) {
    e.preventDefault();
    var $user      = $(this).parents('.bc-user-row-wrap');
    var user_id    = $user.attr('data-user-id');
    var website_id = $('.bc-settings-form').field('websiteid').value();
    var thread_id  = $('.bc-settings-form').field('thread_id').value();
    if (!website_id && !thread_id) {
      return false;
    }
    var authorHtml  = $('.bc-user-name', $user).html();
    authorHtml = $(authorHtml).html();
    showConfirm('Unban <b dir="auto">' + authorHtml + '</b> and allow them to comment all posts in your channel?', function() {
      apiRequest('unbanUser', {
        website_id: website_id,
        thread_id: thread_id,
        user_id: user_id
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        $user.slideHide(function() {
          if (!$user.parents('.bc-users-wrap').find('.bc-user-row-wrap:not(.shide)').size()) {
            $user.parents('.bc-users-wrap').find('.bc-user-row-empty').fadeShow();
          }
          $user.remove();
        });
      });
    }, 'Unban');
    return false;
  },
  eDemoteUser: function(e) {
    e.preventDefault();
    var $user      = $(this).parents('.bc-user-row-wrap');
    var user_id    = $user.attr('data-user-id');
    var website_id = $('.bc-settings-form').field('websiteid').value();
    var thread_id  = $('.bc-settings-form').field('thread_id').value();
    if (!website_id && !thread_id) {
      return false;
    }
    var authorHtml  = $('.bc-user-name', $user).html();
    authorHtml = $(authorHtml).html();
    showConfirm('Demote <b dir="auto">' + authorHtml + '</b>?', function() {
      apiRequest('demoteUser', {
        website_id: website_id,
        thread_id: thread_id,
        user_id: user_id
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        $user.slideHide(function() {
          if (!$user.parents('.bc-users-wrap').find('.bc-user-row-wrap:not(.shide)').size()) {
            $user.parents('.bc-users-wrap').find('.bc-user-row-empty').fadeShow();
          }
          $user.remove();
        });
      });
    }, 'Demote');
    return false;
  },
  eUpdateRights: function(e) {
    e.preventDefault();
    var $user      = $(this).parents('.bc-user-row-wrap');
    var thread_id  = $('.bc-settings-form').field('thread_id').value();
    if (!thread_id) {
      return false;
    }
    apiRequest('updateRights', {
      thread_id: thread_id
    }, function(result) {
      if (result.error) {
        return showAlert(result.error);
      }
      reLogin(function() {
        showToast('Channel admins successfully synced.');
      });
    });
    return false;
  },
  eEmbedChange: function() {
    var website_id  = $('.bc-embed-form').field('websiteid').value();
    var page_id     = $('.bc-embed-form').field('pageid').value();
    var limit       = $('.bc-embed-form').field('limit').value();
    var real_limit  = Math.max(3, Math.min(+limit || 5, 100));
    if (real_limit != limit) {
      $('.bc-embed-form').field('limit').value(real_limit);
    }
    var height      = $('.bc-embed-form').field('height').value();
    height          = +height || 0;
    var real_height = height ? Math.max(300, height) : 0;
    $('.bc-embed-form').field('height').value(real_height || 'Auto');
    var is_dark     = $('body').hasClass('bc-dark');
    var dark        = $('.bc-embed-form').field('dark').prop('checked');
    $('.bc-accent-color-item[data-color]').each(function() {
      var color = $(this).attr(dark ? 'data-dark-color' : 'data-color');
      var bg_color = $(this).attr(dark ? 'data-dark-color' : 'data-bg-color');
      var text = $(this).attr(dark ? 'data-dark-text' : 'data-text');
      $('input.radio', this).defaultValue(color);
      $('.bc-color-circle', this).css('backgroundColor', '#' + bg_color).toggleClass('light', isColorLight(color)).toggleClass('bordered', isColorLight(color, is_dark ? -0.8 : 0.95));
      if (text) {
        $('.bc-color-label', this).text(text);
      }
    });
    var color       = $('.bc-embed-form').field('color').value();
    var customcolor = $('.bc-embed-form').field('customcolor').value();
    if (color == 'default') {
      color = '';
    } else if (color == 'custom') {
      color = fixColor(customcolor);
      if (color != customcolor) {
        $('.bc-embed-form').field('customcolor').value(color);
        $('.bc-color-circle-custom').css('color', color ? '#' + color : '').toggleClass('light', isColorLight(color)).toggleClass('bordered', isColorLight(color, is_dark ? -0.8 : 0.95));
      }
    }
    if (!color) {
      color = '';
      $('.bc-embed-form').field('color').value('default');
      var custom_default = $('.bc-embed-form').field('customcolor').defaultValue();
      $('.bc-embed-form').field('customcolor').value(custom_default);
      $('.bc-color-circle-custom').css('color', custom_default ? '#' + custom_default : '').toggleClass('light', isColorLight(custom_default)).toggleClass('bordered', isColorLight(custom_default, is_dark ? -0.8 : 0.95));
    }
    var css_prefix  = is_dark ? 'body.bc-dark ' : '';
    var colorful    = $('.bc-embed-form').field('colorful').prop('checked');
    var dislikes    = $('.bc-embed-form').field('dislikes').value() > 0;
    var outlined    = $('.bc-embed-form').field('icontype').value() == 'outlined';
    var $embed_code = $('.bc-embed-form').field('embed_code');
    var embed_code  = '<script async src="' + $embed_code.attr('data-widget-url') + '" data-comments-app-website="' + cleanHTML(website_id) + '" data-limit="' + cleanHTML(real_limit) + '"' + (real_height > 0 ? ' data-height="' + cleanHTML(real_height) + '"' : '') + (page_id ? ' data-page-id="' + cleanHTML(page_id) + '"' : '') + (color ? ' data-color="' + cleanHTML(color) + '"' : '') + (dislikes ? ' data-dislikes="1"' : '') + (outlined ? ' data-outlined="1"' : '') + (colorful ? ' data-colorful="1"' : '') + (dark ? ' data-dark="1"' : '') + '></script>';
    $embed_code.value(embed_code).height(0);
    $embed_code.innerHeight($embed_code.get(0).scrollHeight);
    if (is_dark) {
      $('.bc-preview-wrap,.bc-customize-box').toggleClass('bc-nodark', !dark);
    } else {
      $('.bc-preview-wrap,.bc-customize-box').toggleClass('bc-dark', !!dark);
    }
    $('.bc-preview-wrap').toggleClass('bc-name-nocolor', !colorful);
    $('.bc-preview-wrap').toggleClass('bc-icons-outlined', !!outlined);
    $('.bc-preview-wrap').toggleClass('bc-dislikes-enabled', !!dislikes);
    $('.bc-preview-wrap style').html(color ? css_prefix + '.bc-preview-wrap a, ' + css_prefix + '.bc-preview-wrap a:hover { color: #' + color + '; } .bc-preview-wrap .liked .bc-comment-like, .bc-preview-wrap .bc-comment-reply-content .bc-comment-head { color: #' + color + '; } .bc-preview-wrap .bc-comment-reply-content:before { border-left-color: #' + color + '; } ' + css_prefix + '.bc-preview-wrap .liked .bc-comment-like:before, ' + css_prefix + '.bc-preview-wrap.bc-icons-outlined .liked .bc-comment-like:before {   background: url(\'data:image/svg+xml,%3Csvg height="16" viewBox="0 0 48 48" width="16" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="m3.34712935 19.8555842 5.45197263-10.57316098c.73509745-1.27167797 2.06235672-4.28242322 3.51213222-4.28242322h18.305758c1.9476378 0 3.3830078.57849476 3.3830078 1.29101894v20.02892816c0 1.1233158-.799747 2.2042421-1.5756832 3.009638l-12.6053622 11.6567657c-1.4805025.0922093-2.452447-.282783-2.9158337-1.1249768-.6950799-1.2632903-.5310974-3.154234-.4290005-3.6205157l2.1175956-10.1419572h-11.50784136c-2.24613106 0-4.08387464.0726838-4.08387464-2.2587259v-2.2890204c0-.5934497.12251624-1.1657048.34712935-1.6955706zm36.31953735-14.8555842h2.6666666c1.4727592 0 2.6666667 1.17525253 2.6666667 2.625v15.75c0 1.4497475-1.1939075 2.625-2.6666667 2.625h-2.6666666c-1.4727592 0-2.6666667-1.1752525-2.6666667-2.625v-15.75c0-1.44974747 1.1939075-2.625 2.6666667-2.625z" fill="%23' + color + '" transform="matrix(-1 0 0 -1 48 46)"/%3E%3C/svg%3E\') no-repeat; }' : '');
    return false;
  },
  eCustomizeOpen: function(e) {
    e.stopPropagation();
    $('.bc-customize-btn-wrap').hide();
    $('.bc-customize-box').removeClass('hide');
  },
  eCopyCode: function(e) {
    e.stopPropagation();
    $('.bc-embed-form').field('embed_code').select();
    if (document.execCommand('copy')) {
      showToast('Copied.');
    }
  },
  eUpdateField: function(e) {
    var $fieldEl = $(this);
    if (e.type == 'focus' || e.type == 'focusin') {
      Manage.updateField($fieldEl, true);
    } else if (e.type == 'blur' || e.type == 'focusout') {
      Manage.updateField($fieldEl, false);
    } else {
      Manage.updateField($fieldEl);
    }
  },
  updateField: function($fieldEl, focused) {
    var $formGroup = $fieldEl.parents('.form-group');
    if (typeof focused !== 'undefined') {
      $formGroup.toggleClass('field-focused', focused);
    }
    $formGroup.toggleClass('field-has-value', $fieldEl.value().length > 0);
  }
};
