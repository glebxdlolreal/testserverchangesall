
var Ads = {
  init: function() {
    Aj.onLoad(function(state) {
      Ads.updateTime(Aj.ajContainer);
      Ads.updateEmoji(Aj.ajContainer);
      Ads.updateAdMessagePreviews(Aj.ajContainer);
      $('.logout-link').on('click', Ads.eLogOut);
    });
    Aj.onUnload(function(state) {
      $('.logout-link').off('click', Ads.eLogOut);
    });
  },
  eFromDateClick: function(e) {
    e.preventDefault();
    var $cont = Aj.ajContainer;
    var $dateValue = $('.js-date-value', $cont);
    if ($dateValue.size()) {
      $dateValue.trigger('focusval');
    }
  },
  eFromDateChange: function() {
    var val = $(this).val();
    if (!val) return;
    var href = window.location.pathname;
    var params = Aj.state.filterParams || {};
    params.from_date = val;
    delete params.limit;
    var parts = [];
    for (var key in params) {
      if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== false && params[key] !== '') {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    }
    if (parts.length) {
      href += '?' + parts.join('&');
    }
    Aj.location(href);
  },
  onScroll: function() {
    $('.js-load-more').each(function() {
      var $loadMore = $(this);
      var top = $loadMore.offset().top - $(window).scrollTop();
      if (top < $(window).height() * 2) {
        ReviewAds.load($loadMore);
      }
    });
  },
  load: function($loadMore) {
    var offset = $loadMore.attr('data-offset');
    if (!offset) {
      $loadMore.remove();
    }
    if ($loadMore.data('loading')) {
      return;
    }
    var params = Aj.state.filterParams;
    params.offset_id = offset;
    var $loadMoreBtn = $('.pr-load-more', $loadMore);
    $loadMoreBtn.data('old-text', $loadMoreBtn.text()).text($loadMoreBtn.data('loading')).addClass('dots-animated');
    $loadMore.data('loading', true);
    Aj.apiRequest('loadReviewedAds', params, function(result) {
      $loadMore.data('loading', false);
      if (result.ads_html) {
        var $loadMoreCont = $loadMore.closest('.pr-review-list');
        if ($loadMoreCont.size()) {
          $loadMore.remove();
          $loadMoreCont.append(result.ads_html);
          Ads.updateAdMessagePreviews($loadMoreCont);
        } else {
          var $loadMoreBtn = $('.pr-load-more', $loadMore);
          $loadMoreBtn.text($loadMoreBtn.data('old-text')).removeClass('dots-animated');
        }
        ReviewAds.onScroll();
      }
    });
  },
  onSubmit: function(e) {
    e.preventDefault();
    var href = this.action;
    if (this.query.value) {
      href += href.indexOf('?') >= 0 ? '&' : '?';
      href += 'query=' + encodeURIComponent(this.query.value);
    }
    Aj.location(href);
  },
  eClearSearch: function(e) {
    Aj.state.$form.submit();
  },
  eApproveAd: function(e) {
    e.preventDefault();
    var $ad      = $(this).parents('.js-review-item');
    var owner_id = $ad.attr('data-owner-id');
    var ad_id    = $ad.attr('data-ad-id');
    var ad_hash  = $ad.attr('data-ad-hash');
    var $buttons = $ad.find('.pr-btn');

    var method, params = {};
    var $similar_wrap = $(this).parents('.js-review-similar-wrap');
    if ($similar_wrap.size()) {
      var ads_list = [];
      $('.js-review-item', $similar_wrap).each(function() {
        var owner_id = $(this).attr('data-owner-id');
        var ad_id    = $(this).attr('data-ad-id');
        ads_list.push(owner_id + '/' + ad_id);
      });
      method = 'approveAds';
      params.ads = ads_list.join(';');
      params.similar_hash = $similar_wrap.attr('data-similar-hash');
    } else {
      method = 'approveAd';
      params.owner_id = owner_id;
      params.ad_id = ad_id;
      params.ad_hash = ad_hash;
    }

    if ($buttons.prop('disabled')) {
      return false;
    }
    $buttons.prop('disabled', true);
    Aj.apiRequest(method, params, function(result) {
      $buttons.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.similar_status_html) {
        $ad.find('.js-review-similar-status').html(result.similar_status_html);
        ReviewAds.updateSimilarAds($ad, '', '');
        $ad.scrollIntoView();
      } else {
        if (result.status_html) {
          $ad.find('.js-review-ad-status').html(result.status_html);
        }
        if (result.buttons_html) {
          $ad.find('.js-review-buttons').html(result.buttons_html);
        }
        $ad.find('.js-review-similar-status').html('');
        if (result.similar_html) {
          ReviewAds.updateSimilarAds($ad, result.similar_html, result.similar_hash);
        }
        $ad.find('.js-reports-badge').hide();
      }
      if (result.ads_html) {
        var $loadMore = $('.js-load-next');
        var $loadMoreCont = $loadMore.closest('.pr-review-list');
        if ($loadMoreCont.size()) {
          $loadMore.remove();
          $loadMoreCont.append(result.ads_html);
          Ads.updateAdMessagePreviews($loadMoreCont);
        }
      }
    });
    return false;
  },
  eDeclineAd: function(e) {
    e.preventDefault();
    var $ad       = $(this).parents('.js-review-item');
    var owner_id  = $ad.attr('data-owner-id');
    var ad_id     = $ad.attr('data-ad-id');
    var ad_hash   = $ad.attr('data-ad-hash');
    var $buttons  = $ad.find('.pr-btn');
    var reason_id = $(this).attr('data-reason-id');

    var method, params = {
      reason_id: reason_id
    };
    var $similar_wrap = $(this).parents('.js-review-similar-wrap');
    if ($similar_wrap.size()) {
      var ads_list = [];
      $('.js-review-item', $similar_wrap).each(function() {
        var owner_id = $(this).attr('data-owner-id');
        var ad_id    = $(this).attr('data-ad-id');
        ads_list.push(owner_id + '/' + ad_id);
      });
      method = 'declineAds';
      params.ads = ads_list.join(';');
      params.similar_hash = $similar_wrap.attr('data-similar-hash');
    } else {
      method = 'declineAd';
      params.owner_id = owner_id;
      params.ad_id = ad_id;
      params.ad_hash = ad_hash;
    }

    if ($buttons.prop('disabled')) {
      return false;
    }
    $buttons.prop('disabled', true);
    Aj.apiRequest(method, params, function(result) {
      $buttons.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.similar_status_html) {
        $ad.find('.js-review-similar-status').html(result.similar_status_html);
        ReviewAds.updateSimilarAds($ad, '', '');
        $ad.scrollIntoView();
      } else {
        if (result.status_html) {
          $ad.find('.js-review-ad-status').html(result.status_html);
        }
        if (result.buttons_html) {
          $ad.find('.js-review-buttons').html(result.buttons_html);
        }
        $ad.find('.js-review-similar-status').html('');
        if (result.similar_html) {
          ReviewAds.updateSimilarAds($ad, result.similar_html, result.similar_hash);
        }
        $ad.find('.js-reports-badge').hide();
      }
      if (result.ads_html) {
        var $loadMore = $('.js-load-next');
        var $loadMoreCont = $loadMore.closest('.pr-review-list');
        if ($loadMoreCont.size()) {
          $loadMore.remove();
          $loadMoreCont.append(result.ads_html);
          Ads.updateAdMessagePreviews($loadMoreCont);
        }
      }
    });
    return false;
  },
  updateSimilarAds: function($ad, similar_html, similar_hash) {
    var cont = Aj.ajContainer;
    var $similar_wrap = $ad.find('.js-review-similar-wrap');
    $similar_wrap.html(similar_html).attr('data-similar-hash', similar_hash);
    $('.js-review-item', $similar_wrap).each(function() {
      var owner_id = $(this).attr('data-owner-id');
      var ad_id    = $(this).attr('data-ad-id');
      $('.js-review-list > .js-review-item[data-owner-id="' + owner_id + '"][data-ad-id="' + ad_id + '"]', cont).remove();
    });
  },
  eTranslateAd: function(e) {
    e.preventDefault();
    var $ad       = $(this).parents('.js-review-item');
    var owner_id  = $ad.attr('data-owner-id');
    var ad_id     = $ad.attr('data-ad-id');

    if ($ad.attr('translated')) {
      $ad.addClass('ad-translated');
      return false;
    }
    if ($ad.attr('translating')) {
      return false;
    }
    $ad.addClass('ad-translating');
    $ad.attr('translating', true);
    Aj.apiRequest('translateAd', {
      owner_id: owner_id,
      ad_id: ad_id
    }, function(result) {
      $ad.attr('translating', false);
      if (result.error) {
        return showAlert(result.error);
      }
      $ad.removeClass('ad-translating').addClass('ad-translated');
      $ad.attr('translated', true);
      if (result.preview_html) {
        $('.js-translated-ad', $ad).prepend(result.preview_html);
        Ads.updateAdMessagePreviews($ad);
      }
    });
    return false;
  },
  eOriginalAd: function(e) {
    e.preventDefault();
    var $ad = $(this).parents('.js-review-item');
    $ad.removeClass('ad-translated');
    return false;
  }
};

var ReviewTargets = {
  init: function() {
    var cont = Aj.ajContainer;
    Aj.onLoad(function(state) {
      state.$form = $('.pr-search-form', cont);
      state.$form.on('submit', ReviewTargets.onSubmit);
      state.$searchField = $('.pr-search-input', cont);
      Ads.fieldInit(state.$searchField);
      cont.on('click.curPage', '.pr-search-reset', ReviewTargets.eClearSearch);
      cont.on('click.curPage', '.ad-approve-btn', ReviewTargets.eApproveAd);
      cont.on('click.curPage', '.ad-decline-btn', ReviewTargets.eDeclineAd);
      var $fromDatePicker = $('.js-from-date-picker', cont);
      if ($fromDatePicker.size()) {
        $('input[type="date"]', $fromDatePicker).initDatePicker();
        state.$fromDatePicker = $fromDatePicker;
        cont.on('click.curPage', '.js-from-date-item', ReviewTargets.eFromDateClick);
        $('input[type="date"]', $fromDatePicker).on('change', ReviewTargets.eFromDateChange);
      }
      $(window).on('scroll resize', ReviewTargets.onScroll);
      ReviewTargets.onScroll();
    });
    Aj.onUnload(function(state) {
      state.$form.off('submit', ReviewTargets.onSubmit);
      Ads.fieldDestroy(state.$searchField);
      if (state.$fromDatePicker) {
        $('input[type="date"]', state.$fromDatePicker).destroyDatePicker();
        $('input[type="date"]', state.$fromDatePicker).off('change', ReviewTargets.eFromDateChange);
      }
      $(window).off('scroll resize', ReviewTargets.onScroll);
    });
  },
  eFromDateClick: function(e) {
    e.preventDefault();
    var $cont = Aj.ajContainer;
    var $dateValue = $('.js-date-value', $cont);
    if ($dateValue.size()) {
      $dateValue.trigger('focusval');
    }
  },
  eFromDateChange: function() {
    var val = $(this).val();
    if (!val) return;
    var href = window.location.pathname;
    var params = Aj.state.filterParams || {};
    params.from_date = val;
    delete params.limit;
    var parts = [];
    for (var key in params) {
      if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== false && params[key] !== '') {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    }
    if (parts.length) {
      href += '?' + parts.join('&');
    }
    Aj.location(href);
  },
  onScroll: function() {
    $('.js-load-more').each(function() {
      var $loadMore = $(this);
      var top = $loadMore.offset().top - $(window).scrollTop();
      if (top < $(window).height() * 2) {
        ReviewTargets.load($loadMore);
      }
    });
  },
  load: function($loadMore) {
    var offset = $loadMore.attr('data-offset');
    if (!offset) {
      $loadMore.remove();
    }
    if ($loadMore.data('loading')) {
      return;
    }
    var params = Aj.state.filterParams;
    params.offset_id = offset;
    var $loadMoreBtn = $('.pr-load-more', $loadMore);
    $loadMoreBtn.data('old-text', $loadMoreBtn.text()).text($loadMoreBtn.data('loading')).addClass('dots-animated');
    $loadMore.data('loading', true);
    Aj.apiRequest('loadReviewedTargets', params, function(result) {
      $loadMore.data('loading', false);
      if (result.targets_html) {
        var $loadMoreCont = $loadMore.closest('.pr-review-list');
        if ($loadMoreCont.size()) {
          $loadMore.remove();
          $loadMoreCont.append(result.targets_html);
          Ads.updateAdMessagePreviews($loadMoreCont);
        } else {
          var $loadMoreBtn = $('.pr-load-more', $loadMore);
          $loadMoreBtn.text($loadMoreBtn.data('old-text')).removeClass('dots-animated');
        }
        ReviewTargets.onScroll();
      }
    });
  },
  onSubmit: function(e) {
    e.preventDefault();
    var href = this.action;
    if (this.query.value) {
      href += href.indexOf('?') >= 0 ? '&' : '?';
      href += 'query=' + encodeURIComponent(this.query.value);
    }
    Aj.location(href);
  },
  eClearSearch: function(e) {
    Aj.state.$form.submit();
  },
  eApproveAd: function(e) {
    e.preventDefault();
    var $target     = $(this).parents('.js-review-item');
    var target      = $target.attr('data-target');
    var target_hash = $target.attr('data-target-hash');
    var $buttons    = $target.find('.pr-btn');

    if ($buttons.prop('disabled')) {
      return false;
    }
    $buttons.prop('disabled', true);
    Aj.apiRequest('approveTarget', {
      target: target,
      target_hash: target_hash
    }, function(result) {
      $buttons.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.status_html) {
        $target.find('.js-review-target-status').html(result.status_html);
      }
      if (result.buttons_html) {
        $target.find('.js-review-buttons').html(result.buttons_html);
      }
      if (result.targets_html) {
        var $loadMore = $('.js-load-next');
        var $loadMoreCont = $loadMore.closest('.pr-review-list');
        if ($loadMoreCont.size()) {
          $loadMore.remove();
          $loadMoreCont.append(result.targets_html);
          Ads.updateAdMessagePreviews($loadMoreCont);
        }
      }
    });
    return false;
  },
  eDeclineAd: function(e) {
    e.preventDefault();
    var $target     = $(this).parents('.js-review-item');
    var target      = $target.attr('data-target');
    var target_hash = $target.attr('data-target-hash');
    var $buttons    = $target.find('.pr-btn');
    var reason_id   = $(this).attr('data-reason-id');

    if ($buttons.prop('disabled')) {
      return false;
    }
    $buttons.prop('disabled', true);
    Aj.apiRequest('declineTarget', {
      target: target,
      target_hash: target_hash,
      reason_id: reason_id
    }, function(result) {
      $buttons.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.status_html) {
        $target.find('.js-review-target-status').html(result.status_html);
      }
      if (result.buttons_html) {
        $target.find('.js-review-buttons').html(result.buttons_html);
      }
      if (result.targets_html) {
        var $loadMore = $('.js-load-next');
        var $loadMoreCont = $loadMore.closest('.pr-review-list');
        if ($loadMoreCont.size()) {
          $loadMore.remove();
          $loadMoreCont.append(result.targets_html);
          Ads.updateAdMessagePreviews($loadMoreCont);
        }
      }
    });
    return false;
  }
};

var EditAd = {
  init: function() {
    var cont = Aj.ajContainer;
    Aj.onLoad(function(state) {
      state.$form = $('.js-ad-form', cont);
      Ads.formInit(state.$form);
      state.$form.on('submit', preventDefault);
      cont.on('click.curPage', '.js-promote-photo', NewAd.eReplacePromotePhoto);
      cont.on('change.curPage', '.js-promote-photo > .file-upload', NewAd.eUploadPromotePhoto);
      cont.on('click.curPage', '.js-ad-media', NewAd.ePlayAdMedia);
      cont.on('click.curPage', '.js-ad-media-remove', NewAd.eRemoveAdMedia);
      cont.on('click.curPage', '.js-add-media-btn', NewAd.eReplaceAdMedia);
      cont.on('change.curPage', '.js-add-media-btn > .file-upload', NewAd.eUploadAdMedia);
      cont.on('click.curPage', '.edit-ad-btn', EditAd.eSubmitForm);
      cont.on('click.curPage', '.js-clone-ad-btn', EditAd.eCloneAd);
      cont.on('click.curPage', '.js-send-to-review-btn', EditAd.eSendToReview);
      cont.on('click.curPage', '.delete-ad-btn', EditAd.deleteAd);
      cont.on('click.curPage', '.pr-form-select', EditAd.eSelectPlaceholder);
      cont.on('click.curPage', '.js-open-daily-budget', NewAd.eOpenDailyBudget);
      cont.on('click.curPage', '.js-remove-daily-budget', NewAd.eRemoveDailyBudget);
      cont.on('click.curPage', '.js-activate-date-link', NewAd.eOpenStartDate);
      cont.on('click.curPage', '.js-deactivate-date-link', NewAd.eOpenEndDate);
      cont.on('click.curPage', '.js-activate-date-remove', NewAd.eRemoveStartDate);
      cont.on('click.curPage', '.js-deactivate-date-remove', NewAd.eRemoveEndDate);
      cont.on('click.curPage', '.js-open-schedule', NewAd.eOpenSchedule);
      $('.js-schedule-overview', state.$form).html(NewAd.scheduleOverview(state.$form));
      NewAd.initSelectList(state);
      state.titleField = state.$form.field('title');
      state.titleField.on('change.curPage', NewAd.onTitleChange);
      state.textField = state.$form.field('text');
      state.textField.on('change.curPage', NewAd.onTextChange);
      state.textField.on('input.curPage', NewAd.onTextInput);
      state.promoteUrlField = state.$form.field('promote_url');
      state.promoteUrlField.on('change.curPage', NewAd.onPromoteUrlChange);
      state.websiteNameField = state.$form.field('website_name');
      state.websiteNameField.on('change.curPage', NewAd.onWebsiteNameChange);
      state.websitePhotoField = state.$form.field('website_photo');
      state.mediaField = state.$form.field('media');
      state.buttonField = state.$form.field('button');
      state.buttonField.on('ddchange.curPage', NewAd.onButtonChange);
      state.adInfoField = state.$form.field('ad_info');
      state.adInfoField.on('change.curPage', NewAd.onAdInfoChange);
      state.pictureCheckbox = state.$form.field('picture');
      state.pictureCheckbox.on('change.curPage', NewAd.onPictureChange);
      state.activeRadio = state.$form.field('active');
      state.activeRadio.fieldEl().on('change.curPage', NewAd.onActiveChange);
      state.useScheduleCheckbox = state.$form.field('use_schedule');
      state.useScheduleCheckbox.fieldEl().on('change.curPage', NewAd.onUseScheduleChange);
      NewAd.updateAdMedia(state.mediaField);
      NewAd.updateAdPreview(state.$form, state.previewData);
      Aj.onLoad(function(state) {
        state.initFormData = EditAd.getFormData(state.$form);
        state.initPreviewFormData = NewAd.getPreviewFormData();
        Aj.onBeforeUnload(function() {
          var curPreviewFormData = NewAd.getPreviewFormData();
          if (Aj.state.initPreviewFormData != curPreviewFormData) {
            return l('WEB_LEAVE_PAGE_CONFIRM_TEXT');
          }
          var curFormData = EditAd.getFormData(state.$form);
          if (Aj.state.initFormData != curFormData) {
            return l('WEB_LEAVE_PAGE_CONFIRM_TEXT');
          }
          return false;
        });
      });
    });
    Aj.onUnload(function(state) {
      Ads.formDestroy(state.$form);
      state.$form.off('submit', preventDefault);
      state.titleField.off('.curPage');
      state.textField.off('.curPage');
      state.promoteUrlField.off('.curPage');
      state.websiteNameField.off('.curPage');
      state.buttonField.off('.curPage');
      state.adInfoField.off('.curPage');
      state.pictureCheckbox.off('.curPage');
      state.activeRadio.fieldEl().off('.curPage');
      state.useScheduleCheckbox.off('.curPage');
    });
  },
  getFormData: function($form) {
    var form = $form.get(0);
    if (!form) return false;
    var values = [
      $form.field('title').value(),
      $form.field('text').value(),
      $form.field('button').data('value'),
      $form.field('promote_url').value(),
      $form.field('website_name').value(),
      $form.field('website_photo').value(),
      $form.field('media').value(),
      $form.field('cpm').value(),
      $form.field('daily_budget').value(),
      $form.field('active').value(),
      $form.field('ad_activate_date').value(),
      $form.field('ad_activate_time').value(),
      $form.field('ad_deactivate_date').value(),
      $form.field('ad_deactivate_time').value(),
      $form.field('use_schedule').prop('checked') ? 1 : 0,
      $form.field('schedule').value(),
      $form.field('schedule_tz_custom').value(),
      $form.field('schedule_tz').value(),
      $form.field('views_per_user').value()
    ];
    if ($form.field('picture').prop('checked')) {
      values.push('picture');
    }
    if (Aj.state.selectList) {
      for (var i = 0; i < Aj.state.selectList.length; i++) {
        var selectData = Aj.state.selectList[i];
        var vals = $form.field(selectData.field).data('value') || [];
        values.push(selectData.single_value ? vals : vals.join(';'));
      }
    }
    return values.join('|');
  },
  eSelectPlaceholder: function() {
    Ads.showHint($('.pr-form-control-hint', this), 50, 2000);
  },
  initEditTitlePopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$form = $('.pr-popup-edit-form', cont);
      Ads.formInit(layerState.$form);
      layerState.titleField = layerState.$form.field('title');
      layerState.titleField.on('change.curPage', NewAd.onTitleChange);
      Aj.layer.one('popup:open', function() {
        layerState.titleField.focusAndSelect(true);
      });
      layerState.$form.on('submit', EditAd.eSubmitEditTitlePopupForm);
      cont.on('click.curLayer', '.submit-form-btn', EditAd.eSubmitEditTitlePopupForm);
    });
    Aj.onLayerUnload(function(layerState) {
      Ads.formDestroy(layerState.$form);
      layerState.$form.off('submit', EditAd.eSubmitEditTitlePopupForm);
      layerState.titleField.off('.curPage');
    });
  },
  eSubmitEditTitlePopupForm: function(e) {
    e.preventDefault();
    var $form    = Aj.layerState.$form;
    var owner_id = $form.field('owner_id').value();
    var ad_id    = $form.field('ad_id').value();
    var title    = $form.field('title').value();
    if ($form.data('disabled')) {
      return false;
    }
    if (!title.length) {
      $form.field('title').focus();
      return false;
    }
    var params = {
      owner_id: owner_id,
      ad_id:    ad_id,
      title:    title
    };
    $form.data('disabled', true);
    Aj.apiRequest('editAdTitle', params, function(result) {
      $form.data('disabled', false);
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      closePopup(Aj.layer);
      if (owner_id == Aj.state.ownerId &&
          result.ad) {
        OwnerAds.updateAd(result.ad);
      }
    });
    return false;
  },
  initEditCPMPopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$form = $('.pr-popup-edit-form', cont);
      Ads.formInit(layerState.$form);
      layerState.cpmField = layerState.$form.field('cpm');
      Aj.layer.one('popup:open', function() {
        layerState.cpmField.focusAndSelect(true);
      });
      layerState.$form.on('submit', EditAd.eSubmitEditCPMPopupForm);
      cont.on('click.curLayer', '.submit-form-btn', EditAd.eSubmitEditCPMPopupForm);
    });
    Aj.onLayerUnload(function(layerState) {
      Ads.formDestroy(layerState.$form);
      layerState.$form.off('submit', EditAd.eSubmitEditCPMPopupForm);
    });
  },
  eSubmitEditCPMPopupForm: function(e) {
    e.preventDefault();
    var $form    = Aj.layerState.$form;
    var owner_id = $form.field('owner_id').value();
    var ad_id    = $form.field('ad_id').value();
    var cpm      = Ads.amountFieldValue($form, 'cpm');

    if ($form.data('disabled')) {
      return false;
    }
    if (cpm === false) {
      $form.field('cpm').focus();
      return false;
    }
    var params = {
      owner_id: owner_id,
      ad_id:    ad_id,
      cpm:      cpm
    };
    $form.data('disabled', true);
    Aj.apiRequest('editAdCPM', params, function(result) {
      $form.data('disabled', false);
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      closePopup(Aj.layer);
      if (owner_id == Aj.state.ownerId &&
          result.ad) {
        OwnerAds.updateAd(result.ad);
      }
    });
    return false;
  },
  initEditBudgetPopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$form = $('.pr-popup-edit-form', cont);
      Ads.formInit(layerState.$form);
      layerState.amountField = layerState.$form.field('amount');
      Aj.layer.one('popup:open', function() {
        layerState.amountField.focusAndSelect(true);
      });
      layerState.$form.on('submit', EditAd.eSubmitEditBudgetPopupForm);
      cont.on('click.curLayer', '.submit-form-btn', EditAd.eSubmitEditBudgetPopupForm);
    });
    Aj.onLayerUnload(function(layerState) {
      Ads.formDestroy(layerState.$form);
      layerState.$form.off('submit', EditAd.eSubmitEditBudgetPopupForm);
    });
  },
  eSubmitEditBudgetPopupForm: function(e) {
    e.preventDefault();
    var $form    = Aj.layerState.$form;
    var owner_id = $form.field('owner_id').value();
    var ad_id    = $form.field('ad_id').value();
    var amount   = Ads.amountFieldValue($form, 'amount');

    if ($form.data('disabled')) {
      return false;
    }
    if (amount === false) {
      $form.field('amount').focus();
      return false;
    }
    var params = {
      owner_id: owner_id,
      ad_id:    ad_id,
      amount:   amount,
      popup:    1
    };
    $form.data('disabled', true);
    Aj.apiRequest('incrAdBudget', params, function(result) {
      $form.data('disabled', false);
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      closePopup(Aj.layer);
      if (owner_id == Aj.state.ownerId &&
          result.ad) {
        OwnerAds.updateAd(result.ad);
      }
      if (result.header_owner_budget) {
        $('.js-header_owner_budget').html(result.header_owner_budget);
      }
      if (result.owner_budget) {
        $('.js-owner_budget').html(result.owner_budget);
      }
      if (result.ad_budget_val) {
        $('.js-field-budget-val').value(result.ad_budget_val);
      }
    });
    return false;
  },
  initEditDailyBudgetPopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$form = $('.pr-popup-edit-form', cont);
      Ads.formInit(layerState.$form);
      layerState.dailyBudgetField = layerState.$form.field('daily_budget');
      Aj.layer.one('popup:open', function() {
        layerState.dailyBudgetField.focusAndSelect(true);
      });
      layerState.$form.on('submit', EditAd.eSubmitEditDailyBudgetPopupForm);
      cont.on('click.curLayer', '.submit-form-btn', EditAd.eSubmitEditDailyBudgetPopupForm);
    });
    Aj.onLayerUnload(function(layerState) {
      Ads.formDestroy(layerState.$form);
      layerState.$form.off('submit', EditAd.eSubmitEditDailyBudgetPopupForm);
    });
  },
  eSubmitEditDailyBudgetPopupForm: function(e) {
    e.preventDefault();
    var $form    = Aj.layerState.$form;
    var owner_id = $form.field('owner_id').value();
    var ad_id    = $form.field('ad_id').value();
    var daily_budget = Ads.amountFieldValue($form, 'daily_budget');

    if ($form.data('disabled')) {
      return false;
    }
    if (daily_budget === false) {
      $form.field('daily_budget').focus();
      return false;
    }
    var params = {
      owner_id: owner_id,
      ad_id:    ad_id,
      daily_budget: daily_budget,
      popup:    1
    };
    $form.data('disabled', true);
    Aj.apiRequest('editAdDailyBudget', params, function(result) {
      $form.data('disabled', false);
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      closePopup(Aj.layer);
      if (owner_id == Aj.state.ownerId &&
          result.ad) {
        OwnerAds.updateAd(result.ad);
      }
    });
    return false;
  },
  initEditStatusPopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$form = $('.pr-popup-edit-form', cont);
      Ads.formInit(layerState.$form);
      cont.on('click.curPage', '.js-activate-date-link', NewAd.eOpenStartDate);
      cont.on('click.curPage', '.js-deactivate-date-link', NewAd.eOpenEndDate);
      cont.on('click.curPage', '.js-activate-date-remove', NewAd.eRemoveStartDate);
      cont.on('click.curPage', '.js-deactivate-date-remove', NewAd.eRemoveEndDate);
      cont.on('click.curPage', '.js-open-schedule', EditAd.eOpenEditStatusSchedule);
      $('.js-schedule-overview', layerState.$form).html(NewAd.scheduleOverview(layerState.$form));
      layerState.activeRadio = layerState.$form.field('active');
      layerState.activeRadio.fieldEl().on('change.curPage', NewAd.onActiveChange);
      layerState.useScheduleCheckbox = layerState.$form.field('use_schedule');
      layerState.useScheduleCheckbox.on('change.curPage', EditAd.onUseEditStatusScheduleChange);
      layerState.$form.on('submit', EditAd.eSubmitEditStatusForm);
      cont.on('click.curLayer', '.submit-form-btn', EditAd.eSubmitEditStatusForm);
    });
    Aj.onLayerUnload(function(layerState) {
      Ads.formDestroy(layerState.$form);
      layerState.$form.off('submit', EditAd.eSubmitEditStatusForm);
    });
  },
  eOpenEditStatusSchedule: function(e) {
    e.preventDefault();
    NewAd.openSchedule(Aj.layerState);
  },
  onUseEditStatusScheduleChange: function() {
    var $form = Aj.layerState.$form;
    if ($form.field('use_schedule').prop('checked')) {
      var schedule = $form.field('schedule').value();
      if (schedule == '0;0;0;0;0;0;0') {
        NewAd.openSchedule(Aj.layerState);
      }
      $('.js-schedule-wrap', $form).slideShow();
    } else {
      $('.js-schedule-wrap', $form).slideHide();
    }
  },
  eSubmitEditStatusForm: function(e) {
    e.preventDefault();
    var $form    = Aj.layerState.$form;
    var owner_id = $form.field('owner_id').value();
    var ad_id    = $form.field('ad_id').value();
    var active   = $form.field('active').value();
    var activate_date = Ads.dateTimeFieldValue($form, 'ad_activate_date', 'ad_activate_time');
    var deactivate_date = Ads.dateTimeFieldValue($form, 'ad_deactivate_date', 'ad_deactivate_time');
    var use_schedule = $form.field('use_schedule').prop('checked');
    var schedule    = $form.field('schedule').value();
    var schedule_tz_custom = $form.field('schedule_tz_custom').value();
    var schedule_tz = $form.field('schedule_tz').value();
    if ($form.data('disabled')) {
      return false;
    }
    var params = {
      owner_id: owner_id,
      ad_id:    ad_id,
      active:   active
    };
    if (activate_date) {
      params.activate_date = activate_date;
    }
    if (deactivate_date) {
      params.deactivate_date = deactivate_date;
    }
    if (use_schedule) {
      params.schedule = schedule;
      params.schedule_tz_custom = schedule_tz_custom;
      params.schedule_tz = schedule_tz;
    }
    $form.data('disabled', true);
    Aj.apiRequest('editAdStatus', params, function(result) {
      $form.data('disabled', false);
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      closePopup(Aj.layer);
      if (owner_id == Aj.state.ownerId &&
          result.ad) {
        OwnerAds.updateAd(result.ad);
      }
    });
    return false;
  },
  initShareStatsPopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$urlField = $('.js-share-url', cont);
      layerState.$copyBtn = $('.js-copy-link', cont);
      layerState.$revokeBtn = $('.js-revoke-link', cont);
      layerState.$urlField.on('click', EditAd.eSelectUrl);
      layerState.$copyBtn.on('click', EditAd.eCopyUrl);
      layerState.$revokeBtn.on('click', EditAd.eRevokeUrl);
    });
    Aj.onLayerUnload(function(layerState) {
      layerState.$urlField.off('click', EditAd.eSelectUrl);
      layerState.$copyBtn.off('click', EditAd.eCopyUrl);
      layerState.$revokeBtn.off('click', EditAd.eRevokeUrl);
    });
  },
  eSelectUrl: function() {
    Aj.layerState.$urlField.focusAndSelectAll();
  },
  eCopyUrl: function(copy) {
    Aj.layerState.$urlField.focusAndSelectAll();
    document.execCommand('copy');
    showToast(l('WEB_AD_STATS_LINK_COPIED', 'Copied.'));
  },
  eRevokeUrl: function(e) {
    e.preventDefault();
    var $btn = $(this);
    if ($btn.data('disabled')) {
      return false;
    }
    var params = {
      owner_id: Aj.layerState.ownerId,
      ad_id:    Aj.layerState.adId
    };
    $btn.data('disabled', true);
    Aj.apiRequest('revokeStatsUrl', params, function(result) {
      $btn.data('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.new_url) {
        Aj.layerState.$urlField.value(result.new_url);
      }
      if (result.toast) {
        showToast(result.toast);
      }
    });
    return false;
  },
  initIncrBudget: function() {
    var cont = Aj.ajContainer;
    Aj.onLoad(function(state) {
      state.$form = $('.pr-incr-budget-form', cont);
      Ads.formInit(state.$form);
      state.$form.on('submit', EditAd.eSubmitIncrBudgetForm);
      Aj.state.isDecr = Aj.state.$form.hasClass('decr');
      cont.on('click.curPage', '.js-toggle-sign', EditAd.onToggleAmountSign);
      cont.on('click.curPage', '.submit-form-btn', EditAd.eSubmitIncrBudgetForm);
    });
    Aj.onUnload(function(state) {
      Ads.formDestroy(state.$form);
      state.$form.off('submit', EditAd.eSubmitIncrBudgetForm);
    });
  },
  onToggleAmountSign: function(e) {
    e.preventDefault();
    if ($(this).hasClass('disabled')) {
      EditAd.checkIncrBudgetForm(this, !Aj.state.isDecr);
    } else {
      Aj.state.isDecr = !Aj.state.isDecr;
      Aj.state.$form.toggleClass('decr', Aj.state.isDecr);
      var amountField = Aj.state.isDecr ? 'decr_amount' : 'amount';
      Aj.state.$form.field(amountField).focusAndSelectAll();
    }
  },
  eSubmitIncrBudgetForm: function(e) {
    e.preventDefault();
    var $form    = Aj.state.$form;
    var owner_id = $form.field('owner_id').value();
    var ad_id    = $form.field('ad_id').value();
    var amountField = Aj.state.isDecr ? 'decr_amount' : 'amount';
    var amount   = Ads.amountFieldValue($form, amountField);

    if ($form.data('disabled')) {
      return false;
    }
    if (amount === false) {
      $form.field(amountField).focus();
      return false;
    }
    var params = {
      owner_id: owner_id,
      ad_id:    ad_id,
      amount:   amount
    };
    $form.data('disabled', true);
    Aj.apiRequest(Aj.state.isDecr ? 'decrAdBudget' : 'incrAdBudget', params, function(result) {
      $form.data('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      Aj.state.$form.reset();
      if (result.header_owner_budget) {
        $('.js-header_owner_budget').html(result.header_owner_budget);
      }
      if (result.owner_budget) {
        $('.js-owner_budget').html(result.owner_budget);
      }
      if (result.ad_budget) {
        $('.js-ad_budget').html(result.ad_budget);
      }
      if (result.history) {
        $('.js-history').html(result.history);
      }
    });
    return false;
  },
  checkIncrBudgetForm: function(link, isDecr) {
    var $form    = Aj.state.$form;
    var owner_id = $form.field('owner_id').value();
    var ad_id    = $form.field('ad_id').value();

    if ($form.data('disabled')) {
      return false;
    }
    var params = {
      owner_id: owner_id,
      ad_id:    ad_id,
      check_only: 1
    };
    $form.data('disabled', true);
    Aj.apiRequest(isDecr ? 'decrAdBudget' : 'incrAdBudget', params, function(result) {
      $form.data('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      $(link).removeClass('disabled').trigger('click');
    });
    return false;
  },
  eSubmitForm: function(e) {
    e.preventDefault();
    var $form       = Aj.state.$form;
    var $button     = $(this);
    var title       = $form.field('title').value();
    var text        = $form.field('text').value();
    var button      = $form.field('button').data('value');
    var promote_url = $form.field('promote_url').value();
    var website_name = $form.field('website_name').value();
    var website_photo = $form.field('website_photo').value();
    var media       = $form.field('media').value();
    var ad_info     = $form.field('ad_info').value();
    var cpm         = Ads.amountFieldValue($form, 'cpm');
    var daily_budget = Ads.amountFieldValue($form, 'daily_budget');
    var active      = $form.field('active').value();
    var activate_date = Ads.dateTimeFieldValue($form, 'ad_activate_date', 'ad_activate_time');
    var deactivate_date = Ads.dateTimeFieldValue($form, 'ad_deactivate_date', 'ad_deactivate_time');
    var use_schedule = $form.field('use_schedule').prop('checked');
    var schedule    = $form.field('schedule').value();
    var schedule_tz_custom = $form.field('schedule_tz_custom').value();
    var schedule_tz = $form.field('schedule_tz').value();
    var views_per_user = $form.field('views_per_user').value();

    if (!title.length) {
      $form.field('title').focus();
      return false;
    }
    if (!promote_url.length) {
      $form.field('promote_url').focus();
      return false;
    }
    if (cpm === false) {
      $form.field('cpm').focus();
      return false;
    }
    if (daily_budget === false) {
      $form.field('daily_budget').focus();
      return false;
    }
    var params = {
      owner_id: Aj.state.ownerId,
      ad_id: Aj.state.adId,
      title: title,
      text: text,
      button: button,
      promote_url: promote_url,
      website_name: website_name,
      website_photo: website_photo,
      media: media,
      ad_info: ad_info,
      cpm: cpm,
      daily_budget: daily_budget,
      active: active,
      views_per_user: views_per_user
    };
    if ($form.field('picture').prop('checked')) {
      params.picture = 1;
    }
    if (Aj.state.selectList) {
      for (var i = 0; i < Aj.state.selectList.length; i++) {
        var selectData = Aj.state.selectList[i];
        var values = $form.field(selectData.field).data('value') || [];
        params[selectData.field] = selectData.single_value ? values : values.join(';');
      }
    }
    if (activate_date) {
      params.activate_date = activate_date;
    }
    if (deactivate_date) {
      params.deactivate_date = deactivate_date;
    }
    if (use_schedule) {
      params.schedule = schedule;
      params.schedule_tz_custom = schedule_tz_custom;
      params.schedule_tz = schedule_tz;
    }
    $button.prop('disabled', true);
    Aj.apiRequest('editAd', params, function(result) {
      if (result.error) {
        $button.prop('disabled', false);
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      Aj.state.initFormData = EditAd.getFormData($form);
      if (result.redirect_to) {
        Aj.location(result.redirect_to);
      }
    });
    return false;
  },
  eSendToReview: function(e) {
    e.preventDefault();
    var $button = $(this);
    if ($button.prop('disabled')) {
      return false;
    }
    var $item = $button.parents('li');
    var ad_id = Aj.state.adId;
    if ($item.size()) {
      $item.parents('.open').find('.dropdown-toggle').dropdown('toggle');
      ad_id = $(this).parents('[data-ad-id]').attr('data-ad-id');
    }
    var params = {
      owner_id: Aj.state.ownerId,
      ad_id: ad_id
    };
    $button.prop('disabled', true);
    Aj.apiRequest('sendTargetToReview', params, function(result) {
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.toast) {
        showToast(result.toast);
      }
      $button.parents('.pr-decline-block').slideHide('remove');
    });
    return false;
  },
  eCloneAd: function(e) {
    e.preventDefault();
    var $button = $(this);
    if ($button.prop('disabled')) {
      return false;
    }
    var $item = $button.parents('li');
    var ad_id = Aj.state.adId;
    if ($item.size()) {
      $item.parents('.open').find('.dropdown-toggle').dropdown('toggle');
      ad_id = $(this).parents('[data-ad-id]').attr('data-ad-id');
    }
    var params = {
      owner_id: Aj.state.ownerId,
      ad_id: ad_id
    };
    var onSuccess = function(result) {
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.confirm_text && result.confirm_hash) {
        showConfirm(result.confirm_text, function() {
          params.confirm_hash = result.confirm_hash;
          $button.prop('disabled', true);
          Aj.apiRequest('createDraftFromAd', params, onSuccess);
        }, result.confirm_btn);
      } else if (result.redirect_to) {
        Aj.location(result.redirect_to);
      }
    };
    $button.prop('disabled', true);
    Aj.apiRequest('createDraftFromAd', params, onSuccess);
    return false;
  },
  deletePopup: function (confirm_text, onConfirm) {
    var $confirm = $('<div class="popup-container hide alert-popup-container"><section class="pr-layer-popup pr-layer-delete-ad popup-no-close"><h3 class="pr-layer-header">' + l('WEB_DELETE_AD_CONFIRM_HEADER') + '</h3><p class="pr-layer-text"></p><div class="popup-buttons"><div class="popup-button popup-cancel-btn">' + l('WEB_POPUP_CANCEL_BTN') + '</div><div class="popup-button popup-primary-btn">' + l('WEB_DELETE_AD_CONFIRM_BUTTON') + '</div></div></section></div>');
    var confirm = function() {
      onConfirm && onConfirm($confirm);
      closePopup($confirm);
    }
    $('.pr-layer-text', $confirm).html(confirm_text);
    var $primaryBtn = $('.popup-primary-btn', $confirm);
    $primaryBtn.on('click', confirm);
    $confirm.one('popup:close', function() {
      $primaryBtn.off('click', confirm);
      $confirm.remove();
    });
    openPopup($confirm, {
      closeByClickOutside: '.popup-no-close',
    });
    return $confirm;
  },
  deleteAd: function(e) {
    e.preventDefault();
    var $button = $(this);
    if ($button.prop('disabled')) {
      return false;
    }
    var $item = $button.parents('li');
    var ad_id = Aj.state.adId;
    if ($item.size()) {
      $item.parents('.open').find('.dropdown-toggle').dropdown('toggle');
      ad_id = $(this).parents('[data-ad-id]').attr('data-ad-id');
    }
    var params = {
      owner_id: Aj.state.ownerId,
      ad_id: ad_id
    };
    var onSuccess = function(result) {
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.confirm_text && result.confirm_hash) {
        EditAd.deletePopup(result.confirm_text, function() {
          params.confirm_hash = result.confirm_hash;
          $button.prop('disabled', true);
          Aj.apiRequest('deleteAd', params, onSuccess);
        });
      } else if (result.redirect_to) {
        Aj.location(result.redirect_to);
      }
    };
    $button.prop('disabled', true);
    Aj.apiRequest('deleteAd', params, onSuccess);
    return false;
  }
};

var TransferFunds = {
  init: function() {
    var cont = Aj.ajContainer;
    Aj.onLoad(function(state) {
      state.$form = $('form.add-funds-form', cont);
      Ads.formInit(state.$form);
      state.$form.on('submit', preventDefault);
      cont.on('click.curPage', '.js-toggle-sign', TransferFunds.onToggleAmountSign);
      cont.on('click.curPage', '.transfer-funds-btn', TransferFunds.eSubmitForm);
      state.submitBtn = $('.transfer-funds-btn', cont);
      state.amountField = state.$form.field('amount');
      state.amountField.on('keyup.curPage change.curPage input.curPage', TransferFunds.onAmountChange);
      state.decrAmountField = state.$form.field('decr_amount');
      state.decrAmountField.on('keyup.curPage change.curPage input.curPage', TransferFunds.onAmountChange);
      state.curAmountField = state.$form.hasClass('decr') ? 'decr_amount' : 'amount';
      Ads.initSelect(state.$form, 'account', {
        items: Aj.state.accountItems || [],
        noMultiSelect: true,
        renderSelectedItem: function(val, item) {
          return '<div class="selected-item' + (item.photo ? ' has-photo' : '') + '" data-val="' + cleanHTML(val.toString()) + '">' + (item.photo ? '<div class="selected-item-photo">' + item.photo + '</div>' : '') + '<span class="close"></span><div class="label">' + item.name + '</div></div>';
        },
        appendToItems: function(query, result_count) {
          if (Aj.state.accountItemsLoading) {
            return '<div class="select-list-item select-list-loading dots-animated">' + l('WEB_SELECT_LOADING', 'Loading') + '</div>';
          }
          return '';
        },
        getData: function(query, items) {
          return TransferFunds.getAccountsData(items);
        },
        onEnter: TransferFunds.onAccountSearch,
        onChange: TransferFunds.onAccountChange
      });
    });
    Aj.onUnload(function(state) {
      Ads.formDestroy(state.$form);
      state.$form.off('submit', preventDefault);
      state.amountField.off('.curPage');
      clearTimeout(Aj.state.transferTo);
    });
  },
  getAccountsData: function(items) {
    if (Aj.state.accountItemsNextOffset === false) {
      return items;
    }
    Aj.state.accountItemsLoading = true;
    var owner_id = Aj.state.ownerId;
    var $fieldEl = Aj.state.$form.field('account');
    var next_offset = Aj.state.accountItemsNextOffset || 0;
    Aj.state.accountItemsNextOffset = false;
    TransferFunds.loadAccountsData({
      owner_id: owner_id,
      offset: next_offset
    }, {items: items}, function() {
      $fieldEl.trigger('contentchange');
    }, function() {
      Aj.state.accountItemsLoading = false;
      $fieldEl.trigger('dataready').trigger('datachange');
    });
    return items;
  },
  loadAccountsData: function(params, opts, onUpdate, onReady) {
    Aj.apiRequest('getAccountsForTransfer', params, function(result) {
      if (result.error) {
        if (result.field) {
          onReady && onReady();
          var $field = Aj.state.$form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        } else {
          if (!opts.retry) opts.retry = 1;
          else opts.retry++;
          setTimeout(function(){ TransferFunds.loadAccountsData(params, opts, onUpdate, onReady); }, opts.retry * 1000);
        }
      } else {
        if (opts.retry) {
          opts.retry = 0;
        }
        if (result.items) {
          var items = result.items;
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item._values = [item.name.toLowerCase()];
            opts.items.push(item);
          }
          onUpdate && onUpdate();
        }
        if (result.next_offset) {
          params.offset = result.next_offset;
          TransferFunds.loadAccountsData(params, opts, onUpdate, onReady);
        } else {
          onReady && onReady();
        }
      }
    });
  },
  onToggleAmountSign: function(e) {
    e.preventDefault();
    Aj.state.$form.toggleClass('decr');
    Aj.state.curAmountField = Aj.state.$form.hasClass('decr') ? 'decr_amount' : 'amount';
    TransferFunds.onAmountChange();
    Aj.state.$form.field(Aj.state.curAmountField).focusAndSelectAll();
  },
  onAccountSearch: function(field, value) {
    var $fieldEl = Aj.state.$form.field(field);
    var $formGroup = $fieldEl.fieldEl().parents('.form-group');
    var prev_value = $fieldEl.data('prevval');
    if (prev_value && prev_value == value) {
      return false;
    }
    var owner_id = Aj.state.ownerId;
    $fieldEl.data('prevval', value);
    Ads.hideFieldError($fieldEl);
    if (!value) {
      return false;
    }
    $formGroup.addClass('field-loading');
    Aj.apiRequest('searchAccountForTransfer', {
      owner_id: owner_id,
      query: value
    }, function(result) {
      $formGroup.removeClass('field-loading');
      if (result.error) {
        Ads.showFieldError($fieldEl, result.error);
        return false;
      }
      if (result.account) {
        $fieldEl.trigger('selectval', [result.account, true]);
        $fieldEl.data('prevval', '');
      }
      else if (result.confirm_text) {
        showConfirm(result.confirm_text, function() {
          TransferFunds.linkAccount($fieldEl, owner_id, result.link_owner_id);
        }, result.confirm_btn);
      }
    });
  },
  linkAccount: function($fieldEl, owner_id, link_owner_id) {
    Aj.apiRequest('linkAccount', {
      owner_id: owner_id,
      link_owner_id: link_owner_id
    }, function(result) {
      if (result.error) {
        Ads.showFieldError($fieldEl, result.error);
        return false;
      }
      if (result.ok) {
        showAlert(result.ok);
      }
      if (result.account) {
        $fieldEl.trigger('selectval', [result.account, true]);
        $fieldEl.data('prevval', '');
      }
    });
  },
  onAccountChange: function(field, value, valueFull) {
    if (valueFull.budget) {
      $('.js-sel_account_budget', Aj.state.$form).toggleClass('disabled', !!valueFull.disabled).html(valueFull.budget);
    } else {
      $('.js-sel_account_budget', Aj.state.$form).addClass('disabled').html(Ads.wrapAmount(0));
    }
  },
  onAmountChange: function() {
    var decr = Aj.state.curAmountField == 'decr_amount';
    var amount = Ads.amountFieldValue(Aj.state.$form, Aj.state.curAmountField) || 0;
    if (amount) {
      var button_label = l(decr ? 'WEB_WITHDRAW_AMOUNT_BUTTON' : 'WEB_TRANSFER_AMOUNT_BUTTON', {amount: Ads.wrapAmount(amount, false, false, 6)});
    } else {
      var button_label = l(decr ? 'WEB_WITHDRAW_FUNDS_BUTTON' : 'WEB_TRANSFER_FUNDS_BUTTON');
    }
    Aj.state.submitBtn.prop('disabled', !amount).html(button_label);
  },
  eSubmitForm: function(e) {
    e.preventDefault();
    var $form        = Aj.state.$form;
    var $button      = $(this);
    var decr         = $form.hasClass('decr');
    var account_id   = $form.field('account').data('value');
    var amount_field = decr ? 'decr_amount' : 'amount';
    var amount       = Ads.amountFieldValue($form, amount_field);
    if ($button.prop('disabled')) {
      return false;
    }
    if (!account_id) {
      $form.field('account').trigger('click');
      return false;
    }
    if (amount === false) {
      $form.field(amount_field).focus();
      return false;
    }

    var method = decr ? 'transferWithdrawFunds' : 'transferFunds';
    var params = {
      owner_id: Aj.state.ownerId,
      account_id: account_id,
      amount: amount
    };
    var onSuccess = function(result) {
      $button.prop('disabled', false);
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        if (result.budget) {
          $('.js-owner_budget').html(result.budget);
        }
        return showAlert(result.error);
      }
      if (result.confirm_text && result.confirm_hash) {
        showConfirm(result.confirm_text, function() {
          params.confirm_hash = result.confirm_hash;
          $button.prop('disabled', true);
          Aj.apiRequest(method, params, onSuccess);
        }, result.confirm_btn);
      } else if (result.request_id) {
        $button.prop('disabled', true);
        Aj.state.transferTo = setTimeout(function() {
          params.request_id = result.request_id;
          Aj.apiRequest(method, params, onSuccess);
        }, 400);
      } else if (result.redirect_to) {
        Aj.location(result.redirect_to);
      }
    };
    $button.prop('disabled', true);
    Aj.apiRequest(method, params, onSuccess);
    return false;
  }
};

var Audiences = {
  init: function() {
    var cont = Aj.ajContainer;
    Aj.onLoad(function(state) {
      state.$searchField = $('.pr-search-input');
      state.$searchResults = $('.js-audiences-table-body');
      Ads.fieldInit(state.$searchField);
      cont.on('click.curPage', '.pr-cell-sort', Audiences.eSortList);
      cont.on('click.curPage', '.js-create-audience-ad-btn', Audiences.createAudienceAd);
      cont.on('click.curPage', '.delete-audience-btn', Audiences.deleteAudience);
      state.$searchResults.on('mouseover mouseout click', '.js-hint-tooltip', Ads.eHintEvent);
      $(document).on('touchstart click', Ads.eHideAllHints);

      state.listInited = false;
      state.needUpdateState = false;
      state.$searchField.initSearch({
        $results: state.$searchResults,
        emptyQueryEnabled: true,
        updateOnInit: true,
        resultsNotScrollable: true,
        itemTagName: 'tr',
        enterEnabled: function() {
          return false;
        },
        renderItem: function(item, query) {
          return '<td><div class="pr-cell pr-cell-title">' + item.title + '</div></td><td><div class="pr-cell">' + Ads.formatTableDate(item.date) + '</div></td><td><div class="pr-cell">' + item.used + '</div></td><td><div class="pr-hinted-cell">' + item.users + (item.processing_hint ? '<span class="pr-cell-hint js-hint-tooltip"><div class="pr-cell-hint-tooltip"><div class="bubble"></div>' + item.processing_hint + '</div></span>' : '') + '</div></td><td><div class="pr-actions-cell">' + (item.need_update ? '' : Aj.state.audienceDropdownTpl.replace(/{audience_id}/g, item.audience_id)) + '</div></td>';
        },
        getData: function() {
          if (!state.listInited) {
            state.listInited = true;
            var items = Aj.state.audiencesList;
            for (var i = 0; i < items.length; i++) {
              var item = items[i];
              item.base_url = '/account/audience/' + item.audience_id;
              item._values = [item.title.toLowerCase()];
              if (item.need_update) {
                state.needUpdateState = true;
              }
            }
            Audiences.updateAudiencesState();
          }
          return Aj.state.audiencesList;
        }
      });
    });
    Aj.onUnload(function(state) {
      state.$searchResults.off('mouseover mouseout click', '.js-hint-tooltip', Ads.eHintEvent);
      $(document).off('touchstart click', Ads.eHideAllHints);
      clearTimeout(Aj.state.updateStateTo);
      Ads.fieldDestroy(state.$searchField);
      state.$searchField.destroySearch();
    });
  },
  eSortList: function(e) {
    var $sortEl = $(this);
    var sortBy  = $sortEl.attr('data-sort-by');
    var sortAsc = $sortEl.hasClass('sort-asc');
    if (sortBy == Aj.state.audiencesListSortBy) {
      Aj.state.audiencesListSortAsc = !sortAsc;
    } else {
      Aj.state.audiencesListSortBy = sortBy;
      Aj.state.audiencesListSortAsc = false;
    }
    Audiences.updateAudiencesList();
    Aj.state.$searchField.trigger('datachange');
  },
  updateAudiencesList: function() {
    if (Aj.state.audiencesList) {
      var sortBy  = Aj.state.audiencesListSortBy;
      var sortAsc = Aj.state.audiencesListSortAsc;
      $('.pr-cell-sort').each(function() {
        var $sortEl = $(this);
        var curSortBy  = $sortEl.attr('data-sort-by');
        $sortEl.toggleClass('sort-active', sortBy == curSortBy);
        $sortEl.toggleClass('sort-asc', sortAsc && sortBy == curSortBy);
      });
      Aj.state.audiencesList.sort(function(ad1, ad2) {
        var v1 = sortAsc ? ad1 : ad2;
        var v2 = sortAsc ? ad2 : ad1;
        return (v1[sortBy] - v2[sortBy]) || (v1.date - v2.date);
      });
    }
  },
  updateAudiencesState: function() {
    if (!Aj.state || !Aj.state.audiencesList || !Aj.state.needUpdateState) {
      return;
    }
    Aj.state.needUpdateState = false;
    Aj.state.updateStateTo = setTimeout(function() {
      Aj.apiRequest('updateAudiencesState', {
        owner_id: Aj.state.ownerId
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        if (result.audiences) {
          for (var i = 0; i < result.audiences.length; i++) {
            Audiences.updateAudience(result.audiences[i], true);
          }
          Audiences.updateAudiencesList();
          Aj.state.$searchField.trigger('contentchange');
          Audiences.updateAudiencesState();
        }
      });
    }, 400);
  },
  updateAudience: function(audience, no_update) {
    if (!Aj.state || !Aj.state.audiencesList) {
      return;
    }
    var audiencesList = Aj.state.audiencesList;
    for (var i = 0; i < audiencesList.length; i++) {
      if (audience.owner_id == audiencesList[i].owner_id &&
          audience.audience_id == audiencesList[i].audience_id) {
        audience.base_url = '/account/audience/' + audience.audience_id;
        audience._values = [audience.title.toLowerCase()];
        audiencesList[i] = audience;
        if (audience.need_update) {
          Aj.state.needUpdateState = true;
        }
        if (!no_update) {
          Audiences.updateAudiencesList();
          Aj.state.$searchField.trigger('contentchange');
          Audiences.updateAudiencesState();
        }
        return;
      }
    }
  },
  initCreatePopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$form = $('.pr-popup-edit-form', cont);
      Ads.formInit(layerState.$form);
      layerState.titleField = layerState.$form.field('title');
      layerState.titleField.on('change.curPage', NewAd.onTitleChange);
      Aj.layer.one('popup:open', function() {
        layerState.titleField.focusAndSelect(true);
      });
      layerState.$form.on('submit', Audiences.eSubmitCreatePopupForm);
      cont.on('click.curLayer', '.submit-form-btn', Audiences.eSubmitCreatePopupForm);
    });
    Aj.onLayerUnload(function(layerState) {
      if (Aj.layerState.uploadRequestXhr) {
        Aj.layerState.uploadRequestXhr.abort();
      }
      Ads.formDestroy(layerState.$form);
      layerState.$form.off('submit', Audiences.eSubmitCreatePopupForm);
      layerState.titleField.off('.curPage');
    });
  },
  eSubmitCreatePopupForm: function(e) {
    e.preventDefault();
    var $form    = Aj.layerState.$form;
    var owner_id = $form.field('owner_id').value();
    var title    = $form.field('title').value();
    var $fileEl  = $form.field('file');
    var file     = $fileEl.data('file');
    if ($form.data('disabled')) {
      return false;
    }
    if (!title.length) {
      $form.field('title').focus();
      return false;
    }
    if (!file) {
      $form.field('file').focus();
      return false;
    }
    var params = {
      owner_id: owner_id,
      title:    title
    };
    var $formGroup = $fileEl.parents('.form-group');
    $formGroup.addClass('field-loading');
    $form.addClass('disabled').data('disabled', true);
    Aj.layerState.uploadRequestXhr = Aj.uploadRequest('createAudience', file, params, function(result) {
      Aj.layerState.uploadRequestXhr = null;
      $form.removeClass('disabled').data('disabled', false);
      $formGroup.removeClass('field-loading');
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      closePopup(Aj.layer);
      if (result.audience && Aj.state.audiencesList) {
        Aj.state.audiencesList.push(result.audience);
        Audiences.updateAudience(result.audience);
      }
      if (result.audience_opt && Aj.state.audienceItems) {
        Aj.state.audienceItems.push(result.audience_opt);
        for (var i = 0; i < Aj.state.selectList.length; i++) {
          var selectData = Aj.state.selectList[i];
          if (selectData.items_key == 'audienceItems') {
            var $fieldEl = Aj.state.$form.field(selectData.field);
            $fieldEl.trigger('datachange');
            if (selectData.add_new_audience) {
              $fieldEl.trigger('selectval', [result.audience_opt, true]);
            }
          }
        }
      }
    }, function(loaded, total) {
      var progress = total ? loaded / total : 0;
      $('.js-progress-value', $formGroup).html(Math.round(progress * 100) + '%');
      $formGroup.each(function() {
        this.style.setProperty('--upload-progress', progress);
      });
    });
    return false;
  },
  initEditTitlePopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$form = $('.pr-popup-edit-form', cont);
      Ads.formInit(layerState.$form);
      layerState.titleField = layerState.$form.field('title');
      layerState.titleField.on('change.curPage', NewAd.onTitleChange);
      Aj.layer.one('popup:open', function() {
        layerState.titleField.focusAndSelect(true);
      });
      layerState.$form.on('submit', Audiences.eSubmitEditTitlePopupForm);
      cont.on('click.curLayer', '.submit-form-btn', Audiences.eSubmitEditTitlePopupForm);
    });
    Aj.onLayerUnload(function(layerState) {
      Ads.formDestroy(layerState.$form);
      layerState.$form.off('submit', Audiences.eSubmitEditTitlePopupForm);
      layerState.titleField.off('.curPage');
    });
  },
  eSubmitEditTitlePopupForm: function(e) {
    e.preventDefault();
    var $form       = Aj.layerState.$form;
    var owner_id    = $form.field('owner_id').value();
    var audience_id = $form.field('audience_id').value();
    var title       = $form.field('title').value();
    if ($form.data('disabled')) {
      return false;
    }
    if (!title.length) {
      $form.field('title').focus();
      return false;
    }
    var params = {
      owner_id:    owner_id,
      audience_id: audience_id,
      title:       title
    };
    $form.data('disabled', true);
    Aj.apiRequest('editAudienceTitle', params, function(result) {
      $form.data('disabled', false);
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      closePopup(Aj.layer);
      if (result.audience) {
        Audiences.updateAudience(result.audience);
      }
    });
    return false;
  },
  initUpdateUsersPopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$form = $('.pr-popup-edit-form', cont);
      Ads.formInit(layerState.$form);
      layerState.$form.on('submit', Audiences.eSubmitUpdateUsersPopupForm);
      cont.on('click.curLayer', '.submit-form-btn', Audiences.eSubmitUpdateUsersPopupForm);
    });
    Aj.onLayerUnload(function(layerState) {
      if (Aj.layerState.uploadRequestXhr) {
        Aj.layerState.uploadRequestXhr.abort();
      }
      Ads.formDestroy(layerState.$form);
      layerState.$form.off('submit', Audiences.eSubmitUpdateUsersPopupForm);
    });
  },
  eSubmitUpdateUsersPopupForm: function(e) {
    e.preventDefault();
    var $form       = Aj.layerState.$form;
    var owner_id    = $form.field('owner_id').value();
    var audience_id = $form.field('audience_id').value();
    var $fileEl     = $form.field('file');
    var file        = $fileEl.data('file');
    if ($form.data('disabled')) {
      return false;
    }
    if (!file) {
      $form.field('file').focus();
      return false;
    }
    var params = {
      owner_id:    owner_id,
      audience_id: audience_id
    };
    var $formGroup = $fileEl.parents('.form-group');
    $formGroup.addClass('field-loading');
    $form.addClass('disabled').data('disabled', true);
    var method = Aj.layerState.updateMethod;
    Aj.layerState.uploadRequestXhr = Aj.uploadRequest(method, file, params, function(result) {
      Aj.layerState.uploadRequestXhr = null;
      $form.removeClass('disabled').data('disabled', false);
      $formGroup.removeClass('field-loading');
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      closePopup(Aj.layer);
      if (result.audience) {
        Audiences.updateAudience(result.audience);
      }
    }, function(loaded, total) {
      var progress = total ? loaded / total : 0;
      $('.js-progress-value', $formGroup).html(Math.round(progress * 100) + '%');
      $formGroup.each(function() {
        this.style.setProperty('--upload-progress', progress);
      });
    });
    return false;
  },
  createAudienceAd: function(e) {
    e.preventDefault();
    var $button = $(this);
    if ($button.prop('disabled')) {
      return false;
    }
    var $item = $button.parents('li');
    var audience_id = Aj.state.audienceId;
    if ($item.size()) {
      $item.parents('.open').find('.dropdown-toggle').dropdown('toggle');
      audience_id = $(this).parents('[data-audience-id]').attr('data-audience-id');
    }
    var params = {
      owner_id: Aj.state.ownerId,
      audience_id: audience_id
    };
    var onSuccess = function(result) {
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.confirm_text && result.confirm_hash) {
        showConfirm(result.confirm_text, function() {
          params.confirm_hash = result.confirm_hash;
          $button.prop('disabled', true);
          Aj.apiRequest('createDraftFromAudience', params, onSuccess);
        }, result.confirm_btn);
      } else if (result.redirect_to) {
        Aj.location(result.redirect_to);
      }
    };
    $button.prop('disabled', true);
    Aj.apiRequest('createDraftFromAudience', params, onSuccess);
    return false;
  },
  deletePopup: function (confirm_text, onConfirm) {
    var $confirm = $('<div class="popup-container hide alert-popup-container"><section class="pr-layer-popup pr-layer-delete-ad popup-no-close"><h3 class="pr-layer-header">' + l('WEB_DELETE_AUDIENCE_CONFIRM_HEADER') + '</h3><p class="pr-layer-text"></p><div class="popup-buttons"><div class="popup-button popup-cancel-btn">' + l('WEB_POPUP_CANCEL_BTN') + '</div><div class="popup-button popup-primary-btn">' + l('WEB_DELETE_AUDIENCE_CONFIRM_BUTTON') + '</div></div></section></div>');
    var confirm = function() {
      onConfirm && onConfirm($confirm);
      closePopup($confirm);
    }
    $('.pr-layer-text', $confirm).html(confirm_text);
    var $primaryBtn = $('.popup-primary-btn', $confirm);
    $primaryBtn.on('click', confirm);
    $confirm.one('popup:close', function() {
      $primaryBtn.off('click', confirm);
      $confirm.remove();
    });
    openPopup($confirm, {
      closeByClickOutside: '.popup-no-close',
    });
    return $confirm;
  },
  deleteAudience: function(e) {
    e.preventDefault();
    var $button = $(this);
    if ($button.prop('disabled')) {
      return false;
    }
    var $item = $button.parents('li');
    var audience_id = Aj.state.audienceId;
    if ($item.size()) {
      $item.parents('.open').find('.dropdown-toggle').dropdown('toggle');
      audience_id = $(this).parents('[data-audience-id]').attr('data-audience-id');
    }
    var params = {
      owner_id: Aj.state.ownerId,
      audience_id: audience_id
    };
    var onSuccess = function(result) {
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.confirm_text && result.confirm_hash) {
        Audiences.deletePopup(result.confirm_text, function() {
          params.confirm_hash = result.confirm_hash;
          $button.prop('disabled', true);
          Aj.apiRequest('deleteAudience', params, onSuccess);
        });
      } else if (result.redirect_to) {
        Aj.location(result.redirect_to);
      }
    };
    $button.prop('disabled', true);
    Aj.apiRequest('deleteAudience', params, onSuccess);
    return false;
  }
};

var Events = {
  init: function() {
    var cont = Aj.ajContainer;
    Aj.onLoad(function(state) {
      state.$searchField = $('.pr-search-input');
      state.$searchResults = $('.js-events-table-body');
      Ads.fieldInit(state.$searchField);
      cont.on('click.curPage', '.pr-cell-sort', Events.eSortList);
      cont.on('click.curPage', '.js-create-pixel-btn', Events.createPixel);
      cont.on('click.curPage', '.delete-event-btn', Events.deleteEvent);
      state.$searchResults.on('mouseover mouseout click', '.js-hint-tooltip', Ads.eHintEvent);
      $(document).on('touchstart click', Ads.eHideAllHints);

      state.listInited = false;
      state.needUpdateState = false;
      state.$searchField.initSearch({
        $results: state.$searchResults,
        emptyQueryEnabled: true,
        updateOnInit: true,
        resultsNotScrollable: true,
        itemTagName: 'tr',
        enterEnabled: function() {
          return false;
        },
        renderItem: function(item, query) {
          var mtime = item.mtime !== false ? '<small><br>' + Ads.formatTableDate(item.mtime) + '</small>' : '';
          return '<td><div class="pr-cell pr-cell-title">' + item.title + '<small><br>' + item.tag_id + '</small></div></td><td><div class="pr-cell">' + item.type + '</div></td><td><div class="pr-cell">' + item.status + mtime + '</div></td><td><div class="pr-cell">' + item.used + '</div></td><td><div class="pr-actions-cell">' + (item.can_edit ? Aj.state.eventDropdownTpl : Aj.state.eventReadonlyDropdownTpl).replace(/{event_id}/g, item.event_id) + '</div></td>';
        },
        getData: function() {
          if (!state.listInited) {
            state.listInited = true;
            var items = Aj.state.eventsList;
            for (var i = 0; i < items.length; i++) {
              var item = items[i];
              item.base_url = '/account/event/' + item.event_id;
              item._values = [item.title.toLowerCase()];
              if (item.need_update) {
                state.needUpdateState = true;
              }
            }
            Events.updateEventsState();
          }
          return Aj.state.eventsList;
        }
      });
    });
    Aj.onUnload(function(state) {
      state.$searchResults.off('mouseover mouseout click', '.js-hint-tooltip', Ads.eHintEvent);
      $(document).off('touchstart click', Ads.eHideAllHints);
      clearTimeout(Aj.state.updateStateTo);
      Ads.fieldDestroy(state.$searchField);
      state.$searchField.destroySearch();
    });
  },
  eSortList: function(e) {
    var $sortEl = $(this);
    var sortBy  = $sortEl.attr('data-sort-by');
    var sortAsc = $sortEl.hasClass('sort-asc');
    if (sortBy == Aj.state.eventsListSortBy) {
      Aj.state.eventsListSortAsc = !sortAsc;
    } else {
      Aj.state.eventsListSortBy = sortBy;
      Aj.state.eventsListSortAsc = false;
    }
    Events.updateEventsList();
    Aj.state.$searchField.trigger('datachange');
  },
  updateEventsList: function() {
    if (Aj.state.eventsList) {
      var sortBy  = Aj.state.eventsListSortBy;
      var sortAsc = Aj.state.eventsListSortAsc;
      $('.pr-cell-sort').each(function() {
        var $sortEl = $(this);
        var curSortBy  = $sortEl.attr('data-sort-by');
        $sortEl.toggleClass('sort-active', sortBy == curSortBy);
        $sortEl.toggleClass('sort-asc', sortAsc && sortBy == curSortBy);
      });
      Aj.state.eventsList.sort(function(ad1, ad2) {
        var v1 = sortAsc ? ad1 : ad2;
        var v2 = sortAsc ? ad2 : ad1;
        return (v1[sortBy] - v2[sortBy]) || (v1.date - v2.date);
      });
    }
  },
  updateEventsState: function() {
    if (!Aj.state || !Aj.state.eventsList || !Aj.state.needUpdateState) {
      return;
    }
    Aj.state.needUpdateState = false;
    Aj.state.updateStateTo = setTimeout(function() {
      Aj.apiRequest('updateEventsState', {
        owner_id: Aj.state.ownerId
      }, function(result) {
        if (result.error) {
          return showAlert(result.error);
        }
        if (result.events) {
          for (var i = 0; i < result.events.length; i++) {
            Events.updateEvent(result.events[i], true);
          }
          Events.updateEventsList();
          Aj.state.$searchField.trigger('contentchange');
          Events.updateEventsState();
        }
      });
    }, 400);
  },
  updateEvent: function(event, no_update) {
    if (!Aj.state || !Aj.state.eventsList) {
      return;
    }
    var eventsList = Aj.state.eventsList;
    for (var i = 0; i < eventsList.length; i++) {
      if (event.owner_id == eventsList[i].owner_id &&
          event.event_id == eventsList[i].event_id) {
        event.base_url = '/account/event/' + event.event_id;
        event._values = [event.title.toLowerCase()];
        eventsList[i] = event;
        if (event.need_update) {
          Aj.state.needUpdateState = true;
        }
        if (!no_update) {
          Events.updateEventsList();
          Aj.state.$searchField.trigger('contentchange');
          Events.updateEventsState();
        }
        return;
      }
    }
  },
  initCreatePopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$form = $('.pr-popup-edit-form', cont);
      Ads.formInit(layerState.$form);
      layerState.titleField = layerState.$form.field('title');
      layerState.titleField.on('change.curPage', NewAd.onTitleChange);
      Aj.layer.one('popup:open', function() {
        layerState.titleField.focusAndSelect(true);
      });
      layerState.$form.on('submit', Events.eSubmitCreatePopupForm);
      cont.on('click.curLayer', '.submit-form-btn', Events.eSubmitCreatePopupForm);
    });
    Aj.onLayerUnload(function(layerState) {
      Ads.formDestroy(layerState.$form);
      layerState.$form.off('submit', Events.eSubmitCreatePopupForm);
      layerState.titleField.off('.curPage');
    });
  },
  eSubmitCreatePopupForm: function(e) {
    e.preventDefault();
    var $form    = Aj.layerState.$form;
    var owner_id = $form.field('owner_id').value();
    var title    = $form.field('title').value();
    var type     = $form.field('type').data('value');
    if ($form.data('disabled')) {
      return false;
    }
    if (!title.length) {
      $form.field('title').focus();
      return false;
    }
    var params = {
      owner_id: owner_id,
      title:    title,
      type:     type
    };
    $form.data('disabled', true);
    Aj.apiRequest('createEvent', params, function(result) {
      $form.data('disabled', false);
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      closePopup(Aj.layer);
      if (result.event && Aj.state.eventsList) {
        Aj.state.eventsList.push(result.event);
        Events.updateEvent(result.event);
      }
      if (result.event_opt && Aj.state.convEventItems) {
        Aj.state.convEventItems.push(result.event_opt);
        for (var i = 0; i < Aj.state.selectList.length; i++) {
          var selectData = Aj.state.selectList[i];
          if (selectData.items_key == 'convEventItems') {
            var $fieldEl = Aj.state.$form.field(selectData.field);
            $fieldEl.trigger('datachange');
            if (selectData.add_new_event) {
              $fieldEl.trigger('selectval', [result.event_opt, true]);
            }
          }
        }
      }
      if (result.to_layer) {
        Aj.layerLocation(result.to_layer);
      }
    });
    return false;
  },
  initEditTitlePopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      layerState.$form = $('.pr-popup-edit-form', cont);
      Ads.formInit(layerState.$form);
      layerState.titleField = layerState.$form.field('title');
      layerState.titleField.on('change.curPage', NewAd.onTitleChange);
      Aj.layer.one('popup:open', function() {
        layerState.titleField.focusAndSelect(true);
      });
      layerState.$form.on('submit', Events.eSubmitEditTitlePopupForm);
      cont.on('click.curLayer', '.submit-form-btn', Events.eSubmitEditTitlePopupForm);
    });
    Aj.onLayerUnload(function(layerState) {
      Ads.formDestroy(layerState.$form);
      layerState.$form.off('submit', Events.eSubmitEditTitlePopupForm);
      layerState.titleField.off('.curPage');
    });
  },
  eSubmitEditTitlePopupForm: function(e) {
    e.preventDefault();
    var $form    = Aj.layerState.$form;
    var owner_id = $form.field('owner_id').value();
    var event_id = $form.field('event_id').value();
    var title    = $form.field('title').value();
    if ($form.data('disabled')) {
      return false;
    }
    if (!title.length) {
      $form.field('title').focus();
      return false;
    }
    var params = {
      owner_id: owner_id,
      event_id: event_id,
      title:    title
    };
    $form.data('disabled', true);
    Aj.apiRequest('editEventTitle', params, function(result) {
      $form.data('disabled', false);
      if (result.error) {
        if (result.field) {
          var $field = $form.field(result.field);
          if ($field.size()) {
            Ads.showFieldError($field, result.error, true);
            return false;
          }
        }
        return showAlert(result.error);
      }
      closePopup(Aj.layer);
      if (result.event) {
        Events.updateEvent(result.event);
      }
    });
    return false;
  },
  initSetupPopup: function() {
    var cont = Aj.layer;
    Aj.onLayerLoad(function(layerState) {
      cont.on('click.curLayer', '.js-copy-field-btn', Events.eCopyField);
    });
  },
  eCopyField: function(e) {
    e.preventDefault();
    var field = $(this).attr('data-field');
    var value = $(this).parents('.form-group').find('.form-control').val();
    copyToClipboard(value);
    showToast(l('WEB_CODE_SAMPLE_COPIED', 'Copied.'));
  },
  deletePopup: function (confirm_text, onConfirm) {
    var $confirm = $('<div class="popup-container hide alert-popup-container"><section class="pr-layer-popup pr-layer-delete-ad popup-no-close"><h3 class="pr-layer-header">' + l('WEB_DELETE_EVENT_CONFIRM_HEADER') + '</h3><p class="pr-layer-text"></p><div class="popup-buttons"><div class="popup-button popup-cancel-btn">' + l('WEB_POPUP_CANCEL_BTN') + '</div><div class="popup-button popup-primary-btn">' + l('WEB_DELETE_EVENT_CONFIRM_BUTTON') + '</div></div></section></div>');
    var confirm = function() {
      onConfirm && onConfirm($confirm);
      closePopup($confirm);
    }
    $('.pr-layer-text', $confirm).html(confirm_text);
    var $primaryBtn = $('.popup-primary-btn', $confirm);
    $primaryBtn.on('click', confirm);
    $confirm.one('popup:close', function() {
      $primaryBtn.off('click', confirm);
      $confirm.remove();
    });
    openPopup($confirm, {
      closeByClickOutside: '.popup-no-close',
    });
    return $confirm;
  },
  createPixel: function(e) {
    e.preventDefault();
    var $button = $(this);
    if ($button.prop('disabled')) {
      return false;
    }
    var params = {
      owner_id: Aj.state.ownerId
    };
    $button.prop('disabled', true);
    Aj.apiRequest('createPixel', params, function(result) {
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.redirect_to) {
        Aj.location(result.redirect_to);
      } else if (result.to_layer) {
        Aj.layerLocation(result.to_layer);
      }
    });
    return false;
  },
  deleteEvent: function(e) {
    e.preventDefault();
    var $button = $(this);
    if ($button.prop('disabled')) {
      return false;
    }
    var $item = $button.parents('li');
    var event_id = Aj.state.eventId;
    if ($item.size()) {
      $item.parents('.open').find('.dropdown-toggle').dropdown('toggle');
      event_id = $(this).parents('[data-event-id]').attr('data-event-id');
    }
    var params = {
      owner_id: Aj.state.ownerId,
      event_id: event_id
    };
    var onSuccess = function(result) {
      $button.prop('disabled', false);
      if (result.error) {
        return showAlert(result.error);
      }
      if (result.confirm_text && result.confirm_hash) {
        Events.deletePopup(result.confirm_text, function() {
          params.confirm_hash = result.confirm_hash;
          $button.prop('disabled', true);
          Aj.apiRequest('deleteEvent', params, onSuccess);
        });
      } else if (result.redirect_to) {
        Aj.location(result.redirect_to);
      }
    };
    $button.prop('disabled', true);
    Aj.apiRequest('deleteEvent', params, onSuccess);
    return false;
  }
};



(function(d){var c=function(a){this._options={checkOnLoad:!1,resetOnEnd:!1,loopCheckTime:50,loopMaxNumber:5,baitClass:"pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links ads-header ads-content",baitStyle:"width: 1px !important; height: 1px !important; position: absolute !important; left: -10000px !important; top: -1000px !important;"};this._var={version:"3.2.1",bait:null,checking:!1,loop:null,loopNumber:0,event:{detected:[],notDetected:[]}};void 0!==a&&this.setOption(a);var b=this;a=function(){setTimeout(function(){!0===b._options.checkOnLoad&&(null===b._var.bait&&b._creatBait(),setTimeout(function(){b.check()},1))},1)};void 0!==d.addEventListener?d.addEventListener("load",a,!1):d.attachEvent("onload",a)};c.prototype._options=null;c.prototype._var=null;c.prototype._bait=null;c.prototype.setOption=function(a,b){if(void 0!==b){var e=a;a={};a[e]=b}for(var f in a)this._options[f]=a[f];return this};c.prototype._creatBait=function(){var a=document.createElement("div");a.setAttribute("class",this._options.baitClass);a.setAttribute("style",this._options.baitStyle);this._var.bait=d.document.body.appendChild(a);this._var.bait.offsetParent;this._var.bait.offsetHeight;this._var.bait.offsetLeft;this._var.bait.offsetTop;this._var.bait.offsetWidth;this._var.bait.clientHeight;this._var.bait.clientWidth};c.prototype._destroyBait=function(){d.document.body.removeChild(this._var.bait);this._var.bait=null};c.prototype.check=function(a){void 0===a&&(a=!0);this._var.checking=!0;null===this._var.bait&&this._creatBait();var b=this;this._var.loopNumber=0;!0===a&&(this._var.loop=setInterval(function(){b._checkBait(a)},this._options.loopCheckTime));setTimeout(function(){b._checkBait(a)},1);return!0};c.prototype._checkBait=function(a){var b=!1;null===this._var.bait&&this._creatBait();if(null!==d.document.body.getAttribute("abp")||null===this._var.bait.offsetParent||0==this._var.bait.offsetHeight||0==this._var.bait.offsetLeft||0==this._var.bait.offsetTop||0==this._var.bait.offsetWidth||0==this._var.bait.clientHeight||0==this._var.bait.clientWidth)b=!0;if(void 0!==d.getComputedStyle){var e=d.getComputedStyle(this._var.bait,null);!e||"none"!=e.getPropertyValue("display")&&"hidden"!=e.getPropertyValue("visibility")||(b=!0)}!0===a&&(this._var.loopNumber++,this._var.loopNumber>=this._options.loopMaxNumber&&this._stopLoop());if(!0===b)this._stopLoop(),this._destroyBait(),this.emitEvent(!0),!0===a&&(this._var.checking=!1);else if(null===this._var.loop||!1===a)this._destroyBait(),this.emitEvent(!1),!0===a&&(this._var.checking=!1)};c.prototype._stopLoop=function(a){clearInterval(this._var.loop);this._var.loop=null;this._var.loopNumber=0};c.prototype.emitEvent=function(a){a=this._var.event[!0===a?"detected":"notDetected"];for(var b in a)if(a.hasOwnProperty(b))a[b]();!0===this._options.resetOnEnd&&this.clearEvent();return this};c.prototype.clearEvent=function(){this._var.event.detected=[];this._var.event.notDetected=[]};c.prototype.on=function(a){this._var.event.detected.push(a);return this};d.ABC=c;void 0===d.AB&&(d.AB=new c({checkOnLoad:!0,resetOnEnd:!0}))})(window);
AB.on(function() {
  openPopup('<div class="popup-container hide alert-popup-container"><section class="pr-layer-popup pr-layer-delete-ad popup-no-close"><h3 class="pr-layer-header">' + l('WEB_AB_WARNING_HEADER') + '</h3><p class="pr-layer-text">' + l('WEB_AB_WARNING_TEXT') + '</p><div class="popup-buttons"><div class="popup-button popup-cancel-btn">' + l('WEB_POPUP_CLOSE_BTN', 'Close') + '</div></div></section></div>');
});

(function($) {

  $.fn.initSchedule = function() {
    function getTargetElement(e) {
      if (e.toElement) {
        return e.toElement;
      }
      if (e.type == 'touchstart' ||
          e.type == 'touchmove') {
        var x = e.originalEvent.touches[0].clientX;
        var y = e.originalEvent.touches[0].clientY;
      } else {
        var x = e.clientX;
        var y = e.clientY;
      }
      return document.elementFromPoint(x, y);
    }
    function onMouseDown(e) {
      var state = $(this).data('state');
      state.onMouseMove = function(e) {
        var target = getTargetElement(e);
        if (target.tagName == 'TD') {
          var cell = $(target).data('cell');
          state.hoverValue = rectValue(state.startCell, cell);
          updateTableHover(state, state.hoverValue);
        }
      };
      state.onMouseUp = function() {
        var intersectValue = intersectValues(state.curValue, state.hoverValue);
        if (compareValues(intersectValue, state.hoverValue)) {
          state.curValue = diffValues(state.curValue, state.hoverValue);
        } else {
          state.curValue = mergeValues(state.curValue, state.hoverValue);
        }
        updateTableHover(state, emptyValue());
        updateTableValue(state, state.curValue);
        $(document).off('touchmove mousemove', state.onMouseMove);
        $(document).off('touchend touchcancel mouseup', state.onMouseUp);
      };

      var target = getTargetElement(e);
      if (target.tagName == 'TD') {
        var cell = $(target).data('cell');
        state.startCell = cell;
        state.hoverValue = rectValue(cell, cell);
        updateTableHover(state, state.hoverValue);
        $(document).on('touchmove mousemove', state.onMouseMove);
        $(document).on('touchend touchcancel mouseup', state.onMouseUp);
      }
    }
    function onMouseOver(e) {
      var state = $(this).data('state');
      var target = getTargetElement(e);
      if (target.tagName == 'TD') {
        var cell = $(target).data('cell');
        if (typeof cell.w === 'undefined') {
          var hoverValue = rectValue({w: 0, h: cell.h}, {w: 6, h: cell.h});
        } else if (typeof cell.h === 'undefined') {
          var hoverValue = rectValue({w: cell.w, h: 0}, {w: cell.w, h: 23});
        } else {
          var hoverValue = rectValue(cell, cell);
        }
        updateTableHover(state, hoverValue);
      }
    }
    function onClick(e) {
      var state = $(this).data('state');
      if (e.target.tagName == 'TD') {
        var cell = $(e.target).data('cell');
        if (typeof cell.w === 'undefined') {
          var hoverValue = rectValue({w: 0, h: cell.h}, {w: 6, h: cell.h});
        } else if (typeof cell.h === 'undefined') {
          var hoverValue = rectValue({w: cell.w, h: 0}, {w: cell.w, h: 23});
        } else {
          var hoverValue = null;
        }
        if (hoverValue) {
          var intersectValue = intersectValues(state.curValue, hoverValue);
          if (compareValues(intersectValue, hoverValue)) {
            state.curValue = diffValues(state.curValue, hoverValue);
          } else {
            state.curValue = mergeValues(state.curValue, hoverValue);
          }
          updateTableHover(state, emptyValue());
          updateTableValue(state, state.curValue);
        }
      }
    }
    function onMouseOut(e) {
      var state = $(this).data('state');
      updateTableHover(state, emptyValue());
    }
    function eSetValue(e, value) {
      var state = $(this).data('state');
      setValue(state, value);
    }

    function emptyValue() {
      return [0, 0, 0, 0, 0, 0, 0];
    }
    function rectValue(start, end) {
      var res = emptyValue();
      var sw = Math.min(start.w, end.w);
      var ew = Math.max(start.w, end.w);
      var sh = Math.min(start.h, end.h);
      var eh = Math.max(start.h, end.h);
      for (var w = sw; w <= ew; w++) {
        for (var h = sh; h <= eh; h++) {
          res[w] |= 1 << h;
        }
      }
      return res;
    }
    function mergeValues(val1, val2) {
      var res = emptyValue();
      for (var w = 0; w < 7; w++) {
        res[w] = val1[w] | val2[w];
      }
      return res;
    }
    function intersectValues(val1, val2) {
      var res = emptyValue();
      for (var w = 0; w < 7; w++) {
        res[w] = val1[w] & val2[w];
      }
      return res;
    }
    function diffValues(val1, val2) {
      var res = emptyValue();
      for (var w = 0; w < 7; w++) {
        res[w] = val1[w] & ~val2[w];
      }
      return res;
    }
    function compareValues(val1, val2) {
      for (var w = 0; w < 7; w++) {
        if (val1[w] != val2[w]) {
          return false;
        }
      }
      return true;
    }
    function updateTableHover(state, val) {
      state.$table.find('tr').each(function(w) {
        $(this).find('td').each(function(h) {
          var sel = (val[w] & (1 << h)) > 0;
          $(this).toggleClass('hover', sel);
        });
      });
    }
    function updateTableValue(state, val) {
      state.$table.find('tr').each(function(w) {
        $(this).find('td').each(function(h) {
          var sel = (val[w] & (1 << h)) > 0;
          $(this).toggleClass('selected', sel);
        });
      });
      state.$input.value(val.join(';')).trigger('change');
    }

    function setValue(state, value) {
      value = value.toString();
      var init_val = value.split(';').slice(0, 7);
      for (var w = 0; w < 7; w++) {
        init_val[w] = parseInt(init_val[w]) || 0;
      }
      state.curValue = init_val;
      updateTableValue(state, state.curValue);
    }

    return this.each(function() {
      var $input = $(this);
      var $field = $input.parents('.js-schedule-input');
      var $table = $('.js-schedule-table', $field);
      var $table_weeks = $('.js-schedule-table-weeks', $field);
      var $table_hours = $('.js-schedule-table-hours', $field);
      var state = {
        curValue: emptyValue(),
        $input: $input,
        $field: $field,
        $table: $table,
        $table_weeks: $table_weeks,
        $table_hours: $table_hours
      };
      if ($input.data('inited')) {
        return;
      }
      $input.data('inited', true);
      $input.data('state', state);
      $input.on('selectval.tr-schedule', eSetValue);
      $table.find('tr').each(function(w) {
        $(this).find('td').each(function(h) {
          $(this).data('cell', {w: w, h: h});
        });
      });
      $table_weeks.find('td').each(function(w) {
        $(this).data('cell', {w: w});
      });
      $table_hours.find('td').each(function(h) {
        $(this).data('cell', {h: h});
      });
      if (!this.hasAttribute('readonly')) {
        $table.data('state', state);
        $table.on('mouseover.tr-schedule', onMouseOver);
        $table.on('mouseout.tr-schedule', onMouseOut);
        $table.on('touchstart.tr-schedule', onMouseDown);
        $table.on('mousedown.tr-schedule', onMouseDown);
        $table_weeks.data('state', state);
        $table_weeks.on('mouseover.tr-schedule', onMouseOver);
        $table_weeks.on('mouseout.tr-schedule', onMouseOut);
        $table_weeks.on('click.tr-schedule', onClick);
        $table_hours.data('state', state);
        $table_hours.on('mouseover.tr-schedule', onMouseOver);
        $table_hours.on('mouseout.tr-schedule', onMouseOut);
        $table_hours.on('click.tr-schedule', onClick);
      }
      setValue(state, $input.value());
    });
  };
  $.fn.destroySchedule = function() {
    return this.each(function() {
      var $input = $(this);
      var state = $input.data('state');
      $input.off('.tr-schedule');
      state.$table.off('.tr-schedule');
      state.$table_weeks.off('.tr-schedule');
      state.$table_hours.off('.tr-schedule');
    });
  };

  $.fn.initDatePicker = function() {

    function getStartOfDay(d) {
      if (isNaN(d)) {
        return null;
      }
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    function getStartOfWeek(d) {
      if (isNaN(d)) {
        return null;
      }
      d = new Date(d.getFullYear(), d.getMonth(), 1);
      var day = d.getDay() || 7;
      d.setDate(2 - day);
      return d;
    }
    function getWeekDiff(d1, d2) {
      var diff = (d2.getTime() - d1.getTime()) / 86400000;
      return Math.round(diff / 7);
    }
    function getStartOfMonth(d) {
      if (isNaN(d)) {
        return null;
      }
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    function getDateValue(d) {
      if (isNaN(d) || d === null) {
        return '';
      }
      var y = d.getFullYear();
      var m = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'][d.getMonth()];
      var d = d.getDate();
      if (d < 10) {
        d = '0' + d;
      }
      return y + '-' + m + '-' + d;
    }
    function getDateText(d) {
      if (isNaN(d) || d === null) {
        return '';
      }
      var y = d.getFullYear();
      var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
      var j = d.getDate();
      return j + ' ' + M + ' ' + y;
    }

    function openDatePicker(state, selD) {
      if (state.$dpPopup) {
        closePopup(state.$dpPopup);
      }
      var $dpPopup = $('<div class="popup-container hide alert-popup-container pr-popup-container"><section class="pr-layer-popup pr-layer-date-picker-popup popup-no-close"><h3 class="pr-layer-header js-header"></h3><div class="date-picker-controls"><div class="date-picker-button-up js-month-up"></div><div class="date-picker-button-down js-month-down"></div></div><div class="date-picker-wrap"><div class="date-picker-header"><div class="date-picker-header-content"><div class="date-picker-cell">Mon</div><div class="date-picker-cell">Tue</div><div class="date-picker-cell">Wed</div><div class="date-picker-cell">Thu</div><div class="date-picker-cell">Fri</div><div class="date-picker-cell">Sat</div><div class="date-picker-cell">Sun</div></div></div><div class="date-picker-body"><div class="date-picker-body-content js-body"></div></div></div><div class="popup-buttons"><div class="popup-button popup-button-left clear-form-btn">' + l('WEB_DATEPICKER_CLEAR', 'Clear') + '</div><div class="popup-button cancel-form-btn">' + l('WEB_DATEPICKER_CLOSE', 'Close') + '</div></div></section></div>');
      var $dpBody = $('.js-body', $dpPopup);
      var $dpMonthDown = $('.js-month-down', $dpPopup);
      var $dpMonthUp = $('.js-month-up', $dpPopup);

      function setHeader() {
        var year = currentD.getFullYear();
        var month = currentD.getMonth();
        var header = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month] + ' ' + year;
        $('.js-header', $dpPopup).html(header);
        var prevMonth = true, nextMonth = true, newD;
        newD = getStartOfMonth(currentD);
        newD.setMonth(month - 1);
        if (state.minMonthD && newD < state.minMonthD ||
            state.maxMonthD && newD > state.maxMonthD) {
          prevMonth = false;
        }
        newD = getStartOfMonth(currentD);
        newD.setMonth(month + 1);
        if (state.minMonthD && newD < state.minMonthD ||
            state.maxMonthD && newD > state.maxMonthD) {
          nextMonth = false;
        }
        $dpMonthDown.toggleClass('disabled', !nextMonth);
        $dpMonthUp.toggleClass('disabled', !prevMonth);
      }
      function cellWrap(d) {
        var curDate = d.getDate();
        var curMonth = d.getMonth();
        var curYear = d.getFullYear();
        var cellClass = ' month-' + curYear + '-' + curMonth;
        if (curYear == selYear && curMonth == selMonth && curDate == selDate) {
          cellClass += ' selected';
        }
        if (state.minDayD && d < state.minDayD ||
            state.maxDayD && d > state.maxDayD) {
          cellClass += ' disabled';
        }
        return '<div class="date-picker-cell' + cellClass + '" data-value="' + getDateValue(d) + '">' + curDate + '</div>';
      }
      function updateMonth() {
        var year = currentD.getFullYear();
        var month = currentD.getMonth();
        var body = '';
        var curD = getStartOfWeek(currentD);
        fromWeekD = new Date(curD);
        curWeekD  = new Date(curD);
        for (var i = 0; i < 42; i++) {
          body += cellWrap(curD);
          curD.setDate(curD.getDate() + 1);
        }
        toWeekD = new Date(curD);
        setHeader();
        $dpBody.animOff().html(body).cssProp('--row-offset', '').cssProp('--prepend-offset', '');
        $('.date-picker-cell.month-' + year + '-' + month, $dpBody).addClass('current');
        $dpBody.animOn();
      }
      function appendMonth(diff) {
        diff = diff > 0 ? 1 : -1;
        var newD = getStartOfMonth(currentD);
        newD.setMonth(newD.getMonth() + diff);
        if (state.minMonthD && newD < state.minMonthD ||
            state.maxMonthD && newD > state.maxMonthD) {
          return;
        }
        currentD = newD;
        var year = currentD.getFullYear();
        var month = currentD.getMonth();
        var body = '';
        var curD = getStartOfWeek(currentD);
        var weeks = getWeekDiff(curWeekD, curD);
        if (curD >= fromWeekD) {
          var curToD = new Date(curD);
          curToD.setDate(curToD.getDate() + 42);
          while (toWeekD < curToD) {
            body += cellWrap(toWeekD);
            toWeekD.setDate(toWeekD.getDate() + 1);
          }
          $dpBody.append(body).redraw();
        } else {
          var curFromD = new Date(curD);
          while (curD < fromWeekD) {
            body += cellWrap(curD);
            curD.setDate(curD.getDate() + 1);
          }
          fromWeekD = new Date(curFromD);
          var weeksOffset = getWeekDiff(fromWeekD, curWeekD);
          $dpBody.prepend(body).cssProp('--prepend-offset', -weeksOffset).redraw();
        }
        $dpBody.cssProp('--row-offset', -weeks);
        $('.date-picker-cell.current', $dpBody).removeClass('current');
        $('.date-picker-cell.month-' + year + '-' + month, $dpBody).addClass('current');
        setHeader();
      }
      function onKeyDown(e) {
        if (e.keyCode == Keys.DOWN) {
          e.preventDefault();
          appendMonth(1);
        }
        else if (e.keyCode == Keys.UP) {
          e.preventDefault();
          appendMonth(-1);
        }
        else if (e.keyCode == Keys.TAB) {
          e.preventDefault();
        }
      }
      function onSelect(e) {
        var value = $(this).attr('data-value');
        setValue(state, value);
        closePopup($dpPopup);
        if (state.$time) {
          state.$time.trigger('focusval');
        }
      }
      function datePickerClear() {
        setValue(state, '');
        closePopup($dpPopup);
        if (state.$time) {
          state.$time.trigger('selectval', ['']);
        }
      }
      function onMonthDown(e) {
        appendMonth(1);
      }
      function onMonthUp(e) {
        appendMonth(-1);
      }
      function onTransitionEnd(e) {
        if (this === e.target) {
          updateMonth();
        }
      }

      if (isNaN(selD) || selD === null) {
        selD = getStartOfDay(new Date);
      }
      if (state.minDayD && selD < state.minDayD) {
        selD = getStartOfDay(state.minDayD);
      }
      if (state.maxDayD && selD > state.maxDayD) {
        selD = getStartOfDay(state.maxDayD);
      }
      var selDate  = selD.getDate();
      var selMonth = selD.getMonth();
      var selYear  = selD.getFullYear();

      var fromWeekD, curWeekD, toWeekD;

      var currentD = getStartOfMonth(selD);
      updateMonth();

      $(document).on('keydown', onKeyDown);
      $dpMonthDown.on('click', onMonthDown);
      $dpMonthUp.on('click', onMonthUp);
      $dpBody.on('click', '.date-picker-cell', onSelect);
      $dpBody.on('transitionend', onTransitionEnd);

      var datePickerCancel = function() {
        closePopup($dpPopup);
      };
      var $clearBtn = $('.clear-form-btn', $dpPopup);
      $clearBtn.on('click', datePickerClear);
      var $cancelBtn = $('.cancel-form-btn', $dpPopup);
      $cancelBtn.on('click', datePickerCancel);
      $dpPopup.one('popup:close', function() {
        delete state.$dpPopup;
        $clearBtn.off('click', datePickerClear);
        $cancelBtn.off('click', datePickerCancel);
        $(document).off('keydown', onKeyDown);
        $dpMonthDown.off('click', onMonthDown);
        $dpMonthUp.off('click', onMonthUp);
        $dpBody.off('click', '.date-picker-cell', onSelect);
        $dpBody.off('transitionend', onTransitionEnd);
        $dpPopup.remove();
      });

      openPopup($dpPopup, {
        closeByClickOutside: '.popup-no-close'
      });
      state.$dpPopup = $dpPopup;
      return $dpPopup;
    }

    function onFocusValue(e) {
      var state = $(this).data('state');
      openDatePicker(state, state.curValue);
    }
    function onFocus(e) {
      var state = $(this).data('state');
      openDatePicker(state, state.curValue);
    }
    function onClick(e) {
      var state = $(this).data('state');
      openDatePicker(state, state.curValue);
    }
    function eSetValue(e, value) {
      var state = $(this).data('state');
      setValue(state, value);
    }

    function setValue(state, value) {
      state.curValue = getStartOfDay(new Date(value));
      state.$input.value(getDateValue(state.curValue)).trigger('change');
      state.$value.value(getDateText(state.curValue));
    }

    return this.each(function() {
      var $input = $(this);
      var $field = $input.parents('.js-date-input');
      var $value = $('.js-date-value', $field);
      var minValue = new Date($input.attr('min'));
      var maxValue = new Date($input.attr('max'));
      var state = {
        curValue: null,
        minDayD: getStartOfDay(minValue),
        maxDayD: getStartOfDay(maxValue),
        minMonthD: getStartOfMonth(minValue),
        maxMonthD: getStartOfMonth(maxValue),
        $input: $input,
        $field: $field,
        $value: $value
      };
      var $datetime = $input.parents('.datetime-group');
      if ($datetime.size()) {
        state.$time = $('input[type="time"]', $datetime);
      }
      if ($input.data('inited')) {
        return;
      }
      $input.data('inited', true);
      $input.data('state', state);
      $input.on('selectval.tr-datepicker', eSetValue);
      $input.on('focusval.tr-datepicker', onFocusValue);
      $value.data('state', state);
      $value.on('focus.tr-datepicker', onFocus);
      $value.on('click.tr-datepicker', onClick);
      setValue(state, $input.attr('value'));
    });
  };
  $.fn.destroyDatePicker = function() {
    return this.each(function() {
      var $input = $(this);
      var state = $input.data('state');
      $input.off('.tr-datepicker');
      state.$value.off('.tr-datepicker');
    });
  };

  $.fn.initTimePicker = function() {

    function selectHours(state) {
      state.hoursSelected = true;
      state.minutesSelected = false;
      updateSelection(state);
      state.curHoursStr = '';
    }
    function selectMinutes(state) {
      state.hoursSelected = false;
      state.minutesSelected = true;
      updateSelection(state);
      state.curMinutesStr = '';
    }
    function updateSelection(state) {
      state.$value.each(function(){
        if (state.hoursSelected) {
          this.setSelectionRange(0, 2);
        } else if (state.minutesSelected) {
          this.setSelectionRange(3, 5);
        }
      });
    }
    function updateValue(state, apply) {
      if (state.hasValue) {
        var h = state.curHours || 0;
        var m = state.curMinutes || 0;
        if (h < 10) h = '0' + h;
        if (h > 23) h = state.curHours = 23;
        if (m < 10) m = '0' + m;
        if (m > 59 && apply) m = state.curMinutes = 59;
        var val = h + ':' + m;
      } else {
        var val = '';
      }
      state.$value.val(val);
      if (apply) {
        state.$input.val(val).trigger('change');
      }
    }
    function getDateValue(d) {
      if (isNaN(d) || d === null) {
        return '';
      }
      var y = d.getFullYear();
      var m = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'][d.getMonth()];
      var d = d.getDate();
      if (d < 10) {
        d = '0' + d;
      }
      return y + '-' + m + '-' + d;
    }

    function onFocusValue(e) {
      var state = $(this).data('state');
      state.$value.focus();
    }
    function onFocus(e) {
      var state = $(this).data('state');
      if (!state.hasValue && state.$date && !state.$date.value()) {
        state.$date.trigger('focusval');
      } else {
        if (!state.hasValue) {
          setValue(state, new Date());
        } else {
          updateValue(state);
        }
        selectHours(state);
      }
    }
    function onBlur(e) {
      var state = $(this).data('state');
      updateValue(state, true);
    }
    function onKeyDown(e) {
      var state = $(this).data('state');
      if (e.keyCode == Keys.LEFT) {
        e.preventDefault();
        selectHours(state);
      }
      else if (e.keyCode == Keys.RIGHT) {
        e.preventDefault();
        selectMinutes(state);
      }
      else if (e.keyCode == Keys.TAB) {
        if (state.hoursSelected && !e.shiftKey) {
          selectMinutes(state);
          e.preventDefault();
        } else if (state.minutesSelected && e.shiftKey) {
          selectHours(state);
          e.preventDefault();
        }
      }
      else if (e.keyCode == Keys.BACKSPACE || e.keyCode == 46 || e.keyCode == 12) {
        e.preventDefault();
        if (state.hoursSelected) {
          state.curHoursStr = '';
          state.curHours = 0;
        } else if (state.minutesSelected) {
          state.curMinutesStr = '';
          state.curMinutes = 0;
        }
      }
      else if (e.keyCode >= 48 && e.keyCode < 58 || e.keyCode >= 96 && e.keyCode < 106) {
        e.preventDefault();
        var digit = e.keyCode >= 96 ? e.keyCode - 96 : e.keyCode - 48;
        if (state.hoursSelected) {
          state.curHoursStr += digit;
          state.curHours = parseInt(state.curHoursStr);
          if (state.curHoursStr.length == 2 || state.curHoursStr > 2) {
            selectMinutes(state);
          }
        } else if (state.minutesSelected) {
          state.curMinutesStr += digit;
          state.curMinutesStr = state.curMinutesStr.substr(-2);
          state.curMinutes = parseInt(state.curMinutesStr);
        }
      }
      updateValue(state);
      updateSelection(state);
    }
    function onSelect(e) {
      if (!(this.selectionStart == 0 && this.selectionEnd == 2) &&
          !(this.selectionStart == 3 && this.selectionEnd == 5)) {
        var state = $(this).data('state');
        if (this.selectionStart >= 3) {
          selectMinutes(state);
        } else {
          selectHours(state);
        }
      }
    }

    function eSetValue(e, value) {
      var state = $(this).data('state');
      setValue(state, value);
    }

    function setValue(state, value) {
      var curDate = '';
      if (state.$date) {
        curDate = state.$date.value();
      } else {
        curDate = getDateValue(new Date);
      }
      var curD = (value instanceof Date) ? value : new Date(curDate + 'T' + value);
      if (isNaN(curD)) {
        state.curHours = 0;
        state.curMinutes = 0;
        state.hasValue = false;
      } else {
        state.curHours = curD.getHours();
        state.curMinutes = curD.getMinutes();
        state.hasValue = true;
      }
      updateValue(state, true);
    }

    return this.each(function() {
      var $input = $(this);
      var $field = $input.parents('.js-time-input');
      var $value = $('.js-time-value', $field);
      var $timezone = $('.js-time-timezone', $field);
      var state = {
        hasValue: false,
        curHoursStr: '',
        curHours: 0,
        curMinutesStr: '',
        curMinutes: 0,
        hoursSelected: true,
        minutesSelected: false,
        $input: $input,
        $field: $field,
        $value: $value
      };
      var $datetime = $input.parents('.datetime-group');
      if ($datetime.size()) {
        state.$date = $('input[type="date"]', $datetime);
      }
      if ($input.data('inited')) {
        return;
      }
      $timezone.text(Ads.getTimezoneText());
      $input.data('inited', true);
      $input.data('state', state);
      $value.on('focus.tr-timepicker', onFocus);
      $value.on('click.tr-timepicker', onSelect);
      $value.on('blur.tr-timepicker', onBlur);
      $value.on('select.tr-timepicker', onSelect);
      $value.on('keydown.tr-timepicker', onKeyDown);
      $input.on('selectval.tr-timepicker', eSetValue);
      $input.on('focusval.tr-timepicker', onFocusValue);
      $value.data('state', state);
      setValue(state, $input.attr('value'));
    });
  };
  $.fn.destroyTimePicker = function() {
    return this.each(function() {
      var $input = $(this);
      var state = $input.data('state');
      $input.off('.tr-timepicker');
      state.$value.off('.tr-timepicker');
    });
  };

})(jQuery);
