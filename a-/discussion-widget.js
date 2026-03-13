
/*!
  autosize 4.0.2
  license: MIT
  http://www.jacklmoore.com/autosize
*/
!function(e,t){if("function"==typeof define&&define.amd)define(["module","exports"],t);else if("undefined"!=typeof exports)t(module,exports);else{var n={exports:{}};t(n,n.exports),e.autosize=n.exports}}(this,function(e,t){"use strict";var n,o,p="function"==typeof Map?new Map:(n=[],o=[],{has:function(e){return-1<n.indexOf(e)},get:function(e){return o[n.indexOf(e)]},set:function(e,t){-1===n.indexOf(e)&&(n.push(e),o.push(t))},delete:function(e){var t=n.indexOf(e);-1<t&&(n.splice(t,1),o.splice(t,1))}}),c=function(e){return new Event(e,{bubbles:!0})};try{new Event("test")}catch(e){c=function(e){var t=document.createEvent("Event");return t.initEvent(e,!0,!1),t}}function r(r){if(r&&r.nodeName&&"TEXTAREA"===r.nodeName&&!p.has(r)){var e,n=null,o=null,i=null,d=function(){r.clientWidth!==o&&a()},l=function(t){window.removeEventListener("resize",d,!1),r.removeEventListener("input",a,!1),r.removeEventListener("keyup",a,!1),r.removeEventListener("autosize:destroy",l,!1),r.removeEventListener("autosize:update",a,!1),Object.keys(t).forEach(function(e){r.style[e]=t[e]}),p.delete(r)}.bind(r,{height:r.style.height,resize:r.style.resize,overflowY:r.style.overflowY,overflowX:r.style.overflowX,wordWrap:r.style.wordWrap});r.addEventListener("autosize:destroy",l,!1),"onpropertychange"in r&&"oninput"in r&&r.addEventListener("keyup",a,!1),window.addEventListener("resize",d,!1),r.addEventListener("input",a,!1),r.addEventListener("autosize:update",a,!1),r.style.overflowX="hidden",r.style.wordWrap="break-word",p.set(r,{destroy:l,update:a}),"vertical"===(e=window.getComputedStyle(r,null)).resize?r.style.resize="none":"both"===e.resize&&(r.style.resize="horizontal"),n="content-box"===e.boxSizing?-(parseFloat(e.paddingTop)+parseFloat(e.paddingBottom)):parseFloat(e.borderTopWidth)+parseFloat(e.borderBottomWidth),isNaN(n)&&(n=0),a()}function s(e){var t=r.style.width;r.style.width="0px",r.offsetWidth,r.style.width=t,r.style.overflowY=e}function u(){if(0!==r.scrollHeight){var e=function(e){for(var t=[];e&&e.parentNode&&e.parentNode instanceof Element;)e.parentNode.scrollTop&&t.push({node:e.parentNode,scrollTop:e.parentNode.scrollTop}),e=e.parentNode;return t}(r),t=document.documentElement&&document.documentElement.scrollTop;r.style.height="",r.style.height=r.scrollHeight+n+"px",o=r.clientWidth,e.forEach(function(e){e.node.scrollTop=e.scrollTop}),t&&(document.documentElement.scrollTop=t)}}function a(){u();var e=Math.round(parseFloat(r.style.height)),t=window.getComputedStyle(r,null),n="content-box"===t.boxSizing?Math.round(parseFloat(t.height)):r.offsetHeight;if(n<e?"hidden"===t.overflowY&&(s("scroll"),u(),n="content-box"===t.boxSizing?Math.round(parseFloat(window.getComputedStyle(r,null).height)):r.offsetHeight):"hidden"!==t.overflowY&&(s("hidden"),u(),n="content-box"===t.boxSizing?Math.round(parseFloat(window.getComputedStyle(r,null).height)):r.offsetHeight),i!==n){i=n;var o=c("autosize:resized");try{r.dispatchEvent(o)}catch(e){}}}}function i(e){var t=p.get(e);t&&t.destroy()}function d(e){var t=p.get(e);t&&t.update()}var l=null;"undefined"==typeof window||"function"!=typeof window.getComputedStyle?((l=function(e){return e}).destroy=function(e){return e},l.update=function(e){return e}):((l=function(e,t){return e&&Array.prototype.forEach.call(e.length?e:[e],function(e){return r(e)}),e}).destroy=function(e){return e&&Array.prototype.forEach.call(e.length?e:[e],i),e},l.update=function(e){return e&&Array.prototype.forEach.call(e.length?e:[e],d),e}),t.default=l,e.exports=t.default});

(function() {

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

  function redraw(el) {
    el.offsetTop + 1;
  }

  function initRipple() {
    if (!document.querySelectorAll) return;
    var rippleHandlers = document.querySelectorAll('.ripple-handler');
    for (var i = 0; i < rippleHandlers.length; i++) {
      (function(rippleHandler) {
        function onRippleStart(e) {
          var rippleMask = rippleHandler.querySelector('.ripple-mask');
          if (!rippleMask) return;
          var rect = rippleMask.getBoundingClientRect();
          if (e.type == 'touchstart') {
            var clientX = e.targetTouches[0].clientX;
            var clientY = e.targetTouches[0].clientY;
          } else {
            var clientX = e.clientX;
            var clientY = e.clientY;
          }
          var rippleX = (clientX - rect.left) - rippleMask.offsetWidth / 2;
          var rippleY = (clientY - rect.top) - rippleMask.offsetHeight / 2;
          var ripple = rippleHandler.querySelector('.ripple');
          ripple.style.transition = 'none';
          redraw(ripple);
          ripple.style.transform = 'translate3d(' + rippleX + 'px, ' + rippleY + 'px, 0) scale3d(0.2, 0.2, 1)';
          ripple.style.opacity = 1;
          redraw(ripple);
          ripple.style.transform = 'translate3d(' + rippleX + 'px, ' + rippleY + 'px, 0) scale3d(1, 1, 1)';
          ripple.style.transition = '';

          function onRippleEnd(e) {
            ripple.style.transitionDuration = '.2s';
            ripple.style.opacity = 0;
            document.removeEventListener('mouseup', onRippleEnd);
            document.removeEventListener('touchend', onRippleEnd);
            document.removeEventListener('touchcancel', onRippleEnd);
          }
          document.addEventListener('mouseup', onRippleEnd);
          document.addEventListener('touchend', onRippleEnd);
          document.addEventListener('touchcancel', onRippleEnd);
        }
        rippleHandler.removeEventListener('mousedown', onRippleStart);
        rippleHandler.removeEventListener('touchstart', onRippleStart);
        rippleHandler.addEventListener('mousedown', onRippleStart);
        rippleHandler.addEventListener('touchstart', onRippleStart);
      })(rippleHandlers[i]);
    }
  }

  window.TWidgetDiscussion = {
    UPDATE_PERIOD: 3000,
    ONBLUR_UPDATE_PERIOD: 30000,
    commentsCnt: null,
    init: function(options) {
      options = options || {};
      TWidgetDiscussion.options = options;
      TWidgetDiscussion.initComments();

      addEvent('.js-login_btn', 'click', TWidgetDiscussion.eLogin);
      gec('.js-message_input', function() {
        autosize(this);
        addEvent(this, 'input', function(e) {
          toggleClass(e.target, 'empty', !e.target.value.length);
        });
        addEvent(this, 'keydown', function(e) {
          if (e.keyCode == Keys.RETURN && (e.metaKey || e.ctrlKey)) {
            triggerEvent(this.form, 'submit');
          }
        });
      });
      TWidgetDiscussion.initSendAsPopup();
      addEvent('.js-new_message_form', 'submit', TWidgetDiscussion.eSubmitCommentForm);
      if (options.can_send_media) {
        addEvent('.js-attach_btn', 'click', TWidgetDiscussion.eAttachFile);
      }
      if (options.comments_cnt) {
        TWidgetDiscussion.commentsCnt = options.comments_cnt;
      }

      initWidgetFrame({
        auto_height: options.auto_height,
        onVisible: function() {
          var top_msg_el = ge1('.js-discuss_top_message');
          if (top_msg_el) {
            gec('.js-widget_message', function() {
              TPost.view(this);
            }, top_msg_el);
          }
        }
      });
      initRipple();
      addEvent(window, 'tg:focuschange', TWidgetDiscussion.onFocusChange);
      addEvent(window, 'tg:optionschange', TWidgetDiscussion.onOptionsChange);
      addEvent(window, 'tg:inforequest', TWidgetDiscussion.onInfoRequest);
      TWidgetDiscussion.requestCommentsUpdate();
      TWidgetDiscussion.initSlowmodeTimer();
    },
    onOptionsChange: function(e) {
      var new_options = e.detail, transition_off = false;
      if (typeof new_options.dark !== undefined) {
        transition_off = true;
        addClass(document.body, 'no_transitions');
        toggleClass(document.body, 'dark', !!new_options.dark);
        toggleClass(document.body, 'nodark', !new_options.dark);
        var root = document.documentElement;
        if (root && root.style) {
          root.style.colorScheme = !new_options.dark ? 'light' : 'dark';
        }
      }
      if (transition_off) {
        setTimeout(function() {
          removeClass(document.body, 'no_transitions');
        }, 100);
      }
    },
    onInfoRequest: function(e) {
      var detail = e.detail, callback = detail.callback;
      var info = {
        widget_type: 'discussion'
      };
      if (TWidgetDiscussion.commentsCnt != null) {
        info.comments_cnt = TWidgetDiscussion.commentsCnt;
      }
      callback && callback(info);
    },
    eLogin: function(e) {
      e.preventDefault();
      TWidgetAuth.logIn();
    },
    initComments: function(context) {
      gec('.js-widget_message', function() {
        TPost.init(this);
        addEvent(ge('.js-reply_btn', this), 'click', TWidgetDiscussion.eReplyComment);
        addEvent(ge('.js-delete_btn', this), 'click', TWidgetDiscussion.eDeleteComment);
        addEvent(ge('.js-reply_to', this), 'click', TWidgetDiscussion.eCommentHighlight);
        addEvent(ge('.js-poll_option', this), 'click', TWidgetPost.eSelectPollOption);
        addEvent(ge('.js-poll_vote_btn', this), 'click', TWidgetPost.eSendVotes);
      }, context);
      gec('.js-messages_more', function (moreEl) {
        addEvent(moreEl, 'click', function loadMore(e) {
          e.preventDefault();
          if (moreEl._loading) {
            return false;
          }
          var before = getAttr(moreEl, 'data-before');
          var after  = getAttr(moreEl, 'data-after');
          moreEl._loading = true;
          addClass(moreEl, 'dots-animated');

          var form = ge1('.js-new_message_form');
          if (form && form.peer) {
            var params = {
              peer: form.peer.value,
              top_msg_id: form.top_msg_id.value,
              discussion_hash: form.discussion_hash.value
            };
            if (before) {
              params.before_id = before;
            }
            if (after) {
              params.after_id = after;
            }
            TWidgetDiscussion.loadMore(moreEl, params);
          }
        });
      }, context);
    },
    initCommentsHelper(wrap, html) {
      var helper = newEl('div', 'tgme_widget_messages_helper', html);
      wrap.appendChild(helper);
      TWidgetDiscussion.initComments(helper);
      wrap.removeChild(helper);
      return helper;
    },
    loadMore: function(moreEl, params) {
      if (params.after) {
        TWidgetDiscussion.requestCommentsUpdate();
      }
      apiRequest('loadComments', params, function(err, result) {
        if (err || result.error) {
          console.error(err || result.error);
          return false;
        }
        var wrap = ge1('.js-message_history');
        if (!wrap) {
          return false;
        }
        if (result.header_html) {
          setHtml('.js-header', result.header_html);
        }
        var helper = TWidgetDiscussion.initCommentsHelper(wrap, result.comments_html);
        if (params.before_id) {
          moreEl = ge1('.js-messages_more[data-before]', wrap);
          if (!moreEl || getAttr(moreEl, 'data-before') != params.before_id) {
            return false;
          }
          var scrollHelper = newEl();
          wrap.insertBefore(scrollHelper, moreEl.nextSibling);
          getCoords(function(coords) {
            var y = coords.elTop;
            console.log('before', coords.elTop + coords.scrollTop);
            while (helper.lastChild) {
              wrap.insertBefore(helper.lastChild, wrap.firstChild);
            }
            removeEl(moreEl);
            checkFrameSize();
            getCoords(function(coords) {
              var st = coords.elTop - y + coords.scrollTop;
              scrollToY(st);
              removeEl(scrollHelper);
            }, scrollHelper);
          }, scrollHelper);
        } else {
          while (helper.firstChild) {
            wrap.insertBefore(helper.firstChild, moreEl);
          }
          removeEl(moreEl);
        }
        if (result.comments_cnt > 0) {
          removeEl('.js-no_messages_wrap');
        }
        TWidgetDiscussion.commentsCnt = result.comments_cnt;
        TWidgetDiscussion.initSlowmodeTimer(result.slowmode_wait);
      });
    },
    onFocusChange: function() {
      if (isFocused()) {
        if ((new Date) - TWidgetDiscussion.lastUpdate > TWidgetDiscussion.UPDATE_PERIOD / 2) {
          TWidgetDiscussion.updateComments();
        } else {
          TWidgetDiscussion.requestCommentsUpdate();
        }
      }
    },
    requestCommentsUpdate: function() {
      var options = TWidgetDiscussion.options || {};
      if (!options.autoload) {
        return;
      }
      clearTimeout(TWidgetDiscussion.updateTo);
      TWidgetDiscussion.updateTo = setTimeout(TWidgetDiscussion.updateComments, isFocused() ? TWidgetDiscussion.UPDATE_PERIOD : TWidgetDiscussion.ONBLUR_UPDATE_PERIOD);
    },
    updateComments: function() {
      clearTimeout(TWidgetDiscussion.updateTo);
      var moreEl = ge1('.js-messages_more.autoload[data-after]');
      if (!moreEl) {
        TWidgetDiscussion.requestCommentsUpdate();
        return false;
      }
      var after = getAttr(moreEl, 'data-after');
      moreEl._loading = true;

      var form = ge1('.js-new_message_form');
      if (form && form.peer) {
        var params = {
          peer: form.peer.value,
          top_msg_id: form.top_msg_id.value,
          discussion_hash: form.discussion_hash.value,
          after_id: after,
          focused: isFocused() ? 1 : 0,
          auto: 1
        };
        TWidgetDiscussion.autoLoadMore(moreEl, params);
      }
    },
    autoLoadMore: function(moreEl, params) {
      apiRequest('loadComments', params, function(err, result) {
        TWidgetDiscussion.lastUpdate = +(new Date);
        if (err || result.error) {
          console.error(err || result.error);
          return false;
        }
        moreEl = ge1('.js-messages_more.autoload[data-after]');
        if (!moreEl) {
          TWidgetDiscussion.requestCommentsUpdate();
          return false;
        }
        if (getAttr(moreEl, 'data-after') != params.after_id) {
          TWidgetDiscussion.requestCommentsUpdate();
          return false;
        }
        var wrap = ge1('.js-message_history');
        if (!wrap) {
          return false;
        }
        if (result.header_html) {
          setHtml('.js-header', result.header_html);
        }
        var helper = TWidgetDiscussion.initCommentsHelper(wrap, result.comments_html);
        while (helper.firstChild) {
          wrap.insertBefore(helper.firstChild, moreEl);
        }
        removeEl(moreEl);
        if (result.comments_cnt > 0) {
          removeEl('.js-no_messages_wrap');
        }
        TWidgetDiscussion.commentsCnt = result.comments_cnt;
        TWidgetDiscussion.requestCommentsUpdate();
        TWidgetDiscussion.initSlowmodeTimer(result.slowmode_wait);
      });
    },
    loadComment: function(comment_id) {
      var wrap = ge1('.js-message_history');
      if (!wrap || wrap._loading) {
        return false;
      }
      wrap._loading = true;

      var form = ge1('.js-new_message_form');
      if (form && form.peer) {
        apiRequest('loadComments', {
          peer: form.peer.value,
          top_msg_id: form.top_msg_id.value,
          discussion_hash: form.discussion_hash.value,
          comment_id: comment_id
        }, function(err, result) {
          if (!err) {
            var wrap = ge1('.js-message_history');
            if (!wrap) {
              return false;
            }
            if (result.header_html) {
              setHtml('.js-header', result.header_html);
            }
            if (result.comments_html) {
              var helper = TWidgetDiscussion.initCommentsHelper(wrap, result.comments_html);
              while (wrap.firstChild) {
                wrap.removeChild(wrap.firstChild);
              }
              while (helper.firstChild) {
                wrap.appendChild(helper.firstChild);
              }
              TWidgetDiscussion.requestCommentsUpdate();
            }
            TWidgetDiscussion.commentsCnt = result.comments_cnt;
            TWidgetDiscussion.initSlowmodeTimer(result.slowmode_wait);
            TWidgetDiscussion.highlightComment(comment_id, true);
            wrap._loading = false;
          }
        });
      }
    },
    initSendAsPopup: function() {
      var popup = ge1('.js-sendas_popup');
      if (popup) {
        var form   = ge1('.js-sendas_form', popup);
        var button = ge1('.js-submit_btn', popup);
        addEvent(popup, 'tg:popupopen', function() {
          addEvent(button, 'click', TWidgetDiscussion.eSubmitSendAsForm);
        });
        addEvent(popup, 'tg:popupclose', function() {
          removeEvent(button, 'click', TWidgetDiscussion.eSubmitSendAsForm);
        });
        addEvent('.js-sendas_btn', 'click', TWidgetDiscussion.eOpenSendAsPopup);
      }
    },
    eOpenSendAsPopup: function(e) {
      var popup = ge1('.js-sendas_popup');
      var form  = ge1('.js-sendas_form', popup);
      form.reset();
      return TPopups.open(popup);
    },
    eSubmitSendAsForm: function(e) {
      e.preventDefault();
      var form = ge1('.js-sendas_form');
      if (!form || form._submitting) {
        return false;
      }
      var params = {
        peer: form.peer.value,
        send_as: form.send_as.value
      };
      if (!params.peer && !params.send_as) {
        return false;
      }
      gec(form.send_as, function() {
        this.disabled = true;
      });
      form._submitting = true;
      apiRequest('saveDefaultSendAs', params, function(err, result) {
        form._submitting = false;
        gec(form.send_as, function() {
          this.disabled = false;
        });
        if (err) {
          console.error(err);
          return false;
        }
        if (result.error) {
          showAlert(result.error);
          return false;
        }
        if (result.ok) {
          var popup = ge1('.js-sendas_popup');
          var sendas_btn = ge1('.js-sendas_btn');
          setHtml(sendas_btn, '');
          gec(form.send_as, function() {
            var sendas_item, sendas_photo, selected;
            this.defaultChecked = selected = (this.value == params.send_as);
            if (selected &&
                (sendas_item = gpeByClass(this, 'js-sendas_item')) &&
                (sendas_photo = ge1('.js-sendas_photo', sendas_item))) {
              setHtml(sendas_btn, getHtml(sendas_photo));
            }
          });
          var msg_form = ge1('.js-new_message_form');
          if (msg_form && msg_form.send_as) {
            msg_form.send_as.defaultValue = msg_form.send_as.value = params.send_as;
          }
          TPopups.close(popup);
        }
      });
      return false;
    },
    eSubmitCommentForm: function(e) {
      e.preventDefault();
      if (TWidgetDiscussion.isSlowmodeActive()) {
        return false;
      }
      var options = TWidgetDiscussion.options || {};
      var form   = ge1('.js-new_message_form');
      if (!form) {
        return false;
      }
      var params = {
        peer: form.peer.value,
        send_as: form.send_as.value,
        top_msg_id: form.top_msg_id.value,
        discussion_hash: form.discussion_hash.value,
        message: form.message.value
      };
      if (form.reply_to_id) {
        params.reply_to_id = form.reply_to_id.value;
      }
      if (form._submitting) {
        return false;
      }
      var loading_els = ge('.file_loading', form);
      if (loading_els.length > 0) {
        showAlert('Uploading in progress');
        return false;
      }
      var moreEl = ge1('.js-messages_more[data-after]');
      if (moreEl) {
        var after = getAttr(moreEl, 'data-after');
        if (after) {
          params.after_id = after;
        }
      }
      if (form.photo) {
        params.photo = form.photo.value;
      }
      if (!params.message.length && !params.photo) {
        form.message.focus();
        return false;
      }
      var button = ge1('button[type="submit"]', form);
      form._submitting = true;
      button.disabled = true;
      TWidgetDiscussion.requestCommentsUpdate();
      apiRequest('sendComment', params, function(err, result) {
        form._submitting = false;
        button.disabled = false;
        if (err) {
          console.error(err);
          return false;
        }
        TWidgetDiscussion.initSlowmodeTimer(result.slowmode_wait);
        if (result.error) {
          if (!result.slowmode_wait) {
            showAlert(result.error);
          }
          return false;
        }
        form.reset();
        gec('.js-message_input', function() {
          autosize.update(this);
        });
        gec('.js-attach', function (attach_el) {
          var attach_remove = ge1('.js-attach_remove', attach_el);
          removeEvent(attach_remove, 'click', TWidgetDiscussion.eDeleteFile);
          removeEl(attach_el);
        }, form);
        if (options.can_send_media) {
          removeClass('.js-attach_btn', 'ohide');
        }
        TWidgetDiscussion.cancelReply();
        var wrap = ge1('.js-message_history');
        if (!wrap) {
          return false;
        }
        if (result.header_html) {
          setHtml('.js-header', result.header_html);
        }
        var moreEl = ge1('.js-messages_more[data-after]');
        if (result.comments_html) {
          var helper = TWidgetDiscussion.initCommentsHelper(wrap, result.comments_html);
          if (result.replace) {
            while (wrap.firstChild) {
              wrap.removeChild(wrap.firstChild);
            }
            while (helper.firstChild) {
              wrap.appendChild(helper.firstChild);
            }
          } else {
            while (helper.firstChild) {
              wrap.insertBefore(helper.firstChild, moreEl);
            }
            removeEl(moreEl);
          }
          TWidgetDiscussion.requestCommentsUpdate();
        }
        TWidgetDiscussion.commentsCnt = result.comments_cnt;
        TWidgetDiscussion.scrollDown();
      });
      return false;
    },
    scrollDown: function() {
      getCoords(function(coords) {
        var page_bottom = coords.elBottom + coords.scrollTop;
        var new_scroll_top = page_bottom - coords.clientHeight + 10;
        scrollToY(new_scroll_top);
      }, document.body);
    },
    eAttachFile: function(e) {
      if (e.target !== this) return;
      e.stopPropagation();
      e.preventDefault();
      var input = newEl('input', 'file-upload');
      input.type = 'file';
      input.accept = 'image/gif,image/jpeg,image/jpg,image/png';
      this.appendChild(input);
      addEvent(input, 'change', TWidgetDiscussion.eSelectFile);
      input.click();
    },
    eDeleteFile: function(e) {
      var el = this
        , attach_el = gpeByClass(el, 'js-attach')
        , _xhr;
      if (attach_el) {
        if (hasClass(attach_el, 'file_loading')) {
          if (_xhr = attach_el._xhr) {
            _xhr.aborted = true;
            _xhr.abort();
          }
        }
        removeEl(attach_el);
      }
      var options = TWidgetDiscussion.options || {};
      if (options.can_send_media) {
        removeClass('.js-attach_btn', 'ohide');
      }
    },
    eSelectFile: function(e) {
      var input = this,
          form = this.form,
          attach_wrap = ge1('.js-attach_wrap', form),
          size_limit = 5 * 1024 * 1024,
          file = input.files && input.files[0] || false;
      if (file) {
        if (file.size > size_limit) {
          showAlert('File is too big: ' + wrapSize(file.size));
          return false;
        }
        loadImage(file, function(err, result) {
          console.log(result);

          var attach_el = newEl('div', 'tgme_post_discussion_attach js-attach file_loading', '<div class="tgme_post_discussion_attach_photo_wrap js-attach_photo_wrap"><div class="tgme_post_discussion_attach_photo js-attach_photo"><svg class="tgme_post_discussion_progress_wrap" viewport="0 0 66 66" width="66px" height="66px"><circle class="tgme_post_discussion_progress_bg" cx="50%" cy="50%"></circle><circle class="tgme_post_discussion_progress js-attach_progress" cx="50%" cy="50%" stroke-dashoffset="0"></circle></svg></div></div><div class="tgme_post_discussion_attach_remove js-attach_remove"></div>');
          var attach_photo_wrap = ge1('.js-attach_photo_wrap', attach_el);
          var attach_photo  = ge1('.js-attach_photo', attach_el);
          var attach_remove = ge1('.js-attach_remove', attach_el);

          var max_width = 360, max_height = 240;
          var scale = Math.min(1, Math.min(max_width / result.width, max_height / result.height));
          var img_w = result.width * scale;
          var img_h = result.height * scale;
          attach_photo.style.backgroundImage = "url('" + result.url + "')";
          var padding_top = result.height / result.width * 100;
          attach_photo_wrap.style.width = img_w + 'px';
          attach_photo.style.paddingTop = padding_top + '%';

          attach_wrap.appendChild(attach_el);
          addEvent(attach_remove, 'click', TWidgetDiscussion.eDeleteFile);

          addClass('.js-attach_btn', 'ohide');
          TWidgetDiscussion.scrollDown();

          var params = {
            peer: form.peer.value,
            top_msg_id: form.top_msg_id.value,
            discussion_hash: form.discussion_hash.value,
            file: file
          };
          var xhr = uploadRequest(params, function onComplete(err, result) {
            if (err || result.error) {
              if (xhr.aborted) return;
              removeEl(attach_el);
              showAlert(err || result.error);
              return;
            }
            var hidden_input = newEl('input');
            hidden_input.type = 'hidden';
            hidden_input.name = 'photo';
            hidden_input.value = result.photo_id;
            attach_el.appendChild(hidden_input);
            removeClass(attach_el, 'file_loading');
            addClass(attach_el, 'file_loaded');
          }, function onProgress(loaded, total) {
            var progress = total ? loaded / total : 0;
            progress = Math.max(0, Math.min(progress, 1));
            var progress_el = ge1('.js-attach_progress', attach_el);
            if (progress_el) {
              progress_el.style.strokeDashoffset = 106 * (1 - progress);
            }
          });
          attach_el._xhr = xhr;
        });
      }
    },
    isSlowmodeActive: function() {
      if (!TWidgetDiscussion.slowmodeEndTime) {
        return false;
      }
      return TWidgetDiscussion.slowmodeEndTime > +(new Date);
    },
    initSlowmodeTimer: function(time_wait) {
      var timer = ge1('.js-slowmode'), wait;
      if (typeof time_wait === 'undefined') {
        wait = getAttr(timer, 'data-wait');
      } else {
        wait = time_wait;
      }
      TWidgetDiscussion.slowmodeEndTime = +(new Date) + parseInt(wait) * 1000;
      TWidgetDiscussion.redrawSlowmodeTimer();
    },
    redrawSlowmodeTimer: function() {
      var timer = ge1('.js-slowmode');
      var form = gpeByClass(timer, 'js-new_message_form');
      if (!timer || !TWidgetDiscussion.slowmodeEndTime) {
        return;
      }
      var left = (TWidgetDiscussion.slowmodeEndTime - (new Date)) / 1000;
      var progress, timer_class = '';
      if (left <= 0) {
        removeClass(form, 'slowmode_active');
      } else {
        addClass(form, 'slowmode_active');
        requestAnimationFrame(TWidgetDiscussion.redrawSlowmodeTimer);
      }
      var sec_left = Math.ceil(left);
      if (sec_left < 0) sec_left = 0;
      var min = Math.floor(sec_left / 60);
      var sec = sec_left % 60;
      timer.innerHTML = (min + ':' + (sec >= 10 ? sec : '0' + sec));
    },
    eReplyComment: function(e) {
      e.preventDefault();
      var form = ge1('.js-new_message_form');
      var reply_wrap = ge1('.js-reply_wrap', form);
      if (form && reply_wrap) {
        var reply_btn  = this;
        var comment_el = gpeByClass(reply_btn, 'js-widget_message');
        var reply_tpl  = ge1('.js-reply_tpl', comment_el);
        var reply_box  = newEl('div', 'tgme_widget_message_reply_box');
        var reply_el   = newEl('div', 'tgme_widget_message_reply', reply_tpl.innerHTML);
        var reply_remove_btn = newEl('div', 'tgme_widget_message_reply_remove js-reply_remove');
        reply_box.appendChild(reply_el);
        reply_box.appendChild(reply_remove_btn);
        reply_wrap.innerHTML = '';
        reply_wrap.appendChild(reply_box);
        setAttr(reply_el, 'data-reply-to', form.reply_to_id.value);
        addEvent(reply_remove_btn, 'click', TWidgetDiscussion.eCancelReply);
        addEvent(reply_el, 'click', TWidgetDiscussion.eCommentHighlight);
        form.message && form.message.focus();
        setTimeout(function() {
          TWidgetDiscussion.scrollDown();
        }, 100);
      }
    },
    eDeleteComment: function(e) {
      e.preventDefault();
      var form = ge1('.js-new_message_form');
      if (!form) {
        return false;
      }
      var delete_btn = this;
      var comment_el = gpeByClass(delete_btn, 'js-widget_message');
      var comment_id = getAttr(comment_el, 'data-post-id');
      if (!comment_id) {
        return false;
      }
      var comment_wrap = gpeByClass(comment_el, 'js-widget_message_wrap');
      var params = {
        peer: form.peer.value,
        top_msg_id: form.top_msg_id.value,
        discussion_hash: form.discussion_hash.value,
        comment_id: comment_id
      };
      if (hasClass(comment_wrap, 'deleted')) {
        return false;
      }
      showConfirm(l('WIDGET_DISCUSS_DELETE_COMMENT_CONFIRM_TEXT'), function() {
        addClass(comment_wrap, 'deleted');
        apiRequest('deleteComment', params, function(err, result) {
          if (err || result.error) {
            removeClass(comment_wrap, 'deleted');
          }
          if (result.header_html) {
            setHtml('.js-header', result.header_html);
          }
        });
      }, l('WIDGET_DISCUSS_DELETE_COMMENT_CONFIRM_BUTTON'));
    },
    eCancelReply: function(e) {
      e.preventDefault();
      TWidgetDiscussion.cancelReply();
    },
    cancelReply: function() {
      var form = ge1('.js-new_message_form');
      var reply_wrap = ge1('.js-reply_wrap', form);
      if (form && reply_wrap) {
        reply_wrap.innerHTML = '';
      }
    },
    eCommentHighlight: function(e) {
      e.preventDefault();
      var comment_id = getAttr(this, 'data-reply-to');
      if (comment_id) {
        TWidgetDiscussion.highlightComment(comment_id);
      }
    },
    highlightComment: function(comment_id, noload) {
      var wrapEl = null;
      gec('.js-widget_message[data-post-id]', function() {
        if (getAttr(this, 'data-post-id') == comment_id) {
          wrapEl = gpeByClass(this, 'js-widget_message_wrap');
          return false;
        }
      });
      if (wrapEl) {
        getCoords(function(coords) {
          if (coords.elTop < 15 || coords.elBottom > coords.clientHeight - 15) {
            var paddingTop = (coords.clientHeight - coords.elHeight) / 2;
            if (paddingTop < 15) paddingTop = 15;
            var st = coords.elTop + coords.scrollTop - paddingTop;
            scrollToY(st);
          }
          addClass(wrapEl, 'highlight');
          setTimeout(function() {
            removeClass(wrapEl, 'highlight');
          }, 1500);
          found = true;
        }, wrapEl);
      } else if (!noload) {
        TWidgetDiscussion.loadComment(comment_id);
      }
    }
  };
})();