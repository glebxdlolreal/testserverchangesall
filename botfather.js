var Main = {
  init(api_hash = null) {
    if (api_hash) {
      Aj.apiUrl = '/botfather/api?hash=' + api_hash;
    }
    Main.initOnce();
    Aj.viewTransition = true;

    $('form').on('submit', e => e.preventDefault());
    setBackButton(Aj.state.backButton);
    Aj.state.files = Aj.state.files || {};

    function adjustTextArea () {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    }

    $('textarea[expandable]').each(adjustTextArea).on('input focus', adjustTextArea);

    WebApp.MainButton.enable();
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
    WebApp.disableVerticalSwipes();

    if (['android', 'ios'].includes(WebApp.platform)) {
      $('body').addClass('mobile');
      $('body').addClass('platform-'+WebApp.platform);
      WebApp.requestFullscreen();
      initBackSwipe();
    }

    $(document).on('click', '.tm-bot-anchor', () => {
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
      if (!res.ok) {
        if (!authPage) {
          window.location = '/botfather/auth';          
        } else {
          AuthPage.showExpired();          
        }
      } else if (authPage) {
        window.location = '/botfather';
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
    Main.showToast(text || 'Success.', { class: 'tm-toast-success' });
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
  }
}

var AuthPage = {
  init () {},
  showExpired() {
    $('.tm-auth-expired').toggle(true);
    WebApp.MainButton.setText('Close');
    WebApp.MainButton.onClick(() => {
      WebApp.close();
    });
    WebApp.MainButton.show();
  }
}

var BotList = {
  init() {
    $('input[name=query]').on('input', BotList.eSearchInput);
    $('.js-form-clear').on('click', function () {
      $('input', this.closest('.tm-field')).val('').trigger('input');
    });
  },
  eSearchInput() {
    var value = this.value || '';
    var empty = true;
    $('.tm-row').each((i, el) => {
      let hide = el.classList.contains('tm-row-add') || !fuzzyMatch(value, el.textContent);
      hide = hide && !!value;
      empty = empty && hide;
      $(el).toggleClass('hidden', hide);
    });
    $('.js-results-empty').toggleClass('hidden', !empty);
    $('.js-results-empty-help').text(l('WEB_BOTFATHER_NO_RESULTS_INFO', {query: value}))
  }
}

var CreateBot = {
  init() {
    WebApp.MainButton.onClick(CreateBot.submit);
    WebApp.MainButton.setText('Create Bot');
    WebApp.MainButton.show();

    Aj.onUnload(() => {
      WebApp.MainButton.offClick(CreateBot.submit);
      WebApp.MainButton.hide();
    });

    Aj.state.files = {};

    Aj.onLoad(() => {
      Aj.state.username_valid = false;
    });

    $('#bot_form').on('input', CreateBot.validateForm);

    var usernameDebounce = Aj.state.usernameDebounce = debounce();

    $('input[name=username]').on('change', (ev) => {
      usernameDebounce(CreateBot.checkUsername, 0);
    });
    $('.js-upload-button').click(CreateBot.uploadUserpic);
    
    $('input[name=username]').on('input', (ev) => {
      var $hint = $('.hint-text[data-for=username]');
      $hint.attr('class', 'hint-text hint-text-loading');
      $hint.text('Checking username');
      usernameDebounce(CreateBot.checkUsername, 400);
    })

  },
  checkUsername() {
    var $hint = $('.hint-text[data-for=username]');
    var $input = $('input[name=username]');
    var value = $input.val();
    $hint.attr('class', 'hint-text hint-text-loading');
    $hint.text('Checking username');
    Aj.apiRequest('checkBotUsername', { username: value }, res => {
      if ($input.val() !== value) return;
      if (res.ok) {
        Aj.state.username_valid = true;
        $hint.attr('class', 'hint-text hint-text-success');
        $hint.text(value + ' is available.');
      } else {
        Aj.state.username_valid = false;
        $hint.attr('class', 'hint-text hint-text-error');
        $hint.html(res.error);
      }
    });
  },
  uploadUserpic() {
    let replace = this.dataset.replace ? $(this.dataset.replace) : $(this);
    let target = this.dataset.target;

    requestUpload('bot_userpic', res => { 
      if (res.ok) {
        $(this).attr('src', res.media.src);
      }
    });
  },
  submit() {
    var title = $('input[name="title"]').val()?.trim();

    if (!title) {
      Main.showErrorToast('Name is required.');
      var title = $('input[name="title"]').focus();
      return;
    }

    if (!Aj.state.username_valid) {
      Main.showErrorToast('Username is required.');
      var title = $('input[name="username"]').focus();
      return;
    }

    WebApp.MainButton.showProgress();
    Aj.apiRequest('createBot', {
        title: title,
        about: $('textarea[name="about"]').val(),
        username: $('input[name="username"]').val(),
        userpic: Aj.state.files?.['bot_userpic']?.photo_id || '',
    }, res => {
        WebApp.MainButton.hideProgress();
        if (res.ok) {
          Aj.location(`/botfather/bot/${res.bot_id}`);
          Aj.onUnload(() => Main.showSuccessToast(res.msg));
        }
        if (res.error) {
          Main.showErrorToast(res.error);
        }
    });
  }
}

var BotProfile = {
  init() {
    Aj.state.files ||= {};
    WebApp.MainButton.setText('Update');
    WebApp.MainButton.show();
    WebApp.MainButton.onClick(BotProfile.eMainClick);

    Aj.state.savedModel = BotProfile.model();

    $(document).on('click.curPage', '.js-set-lang', BotProfile.eClickLang);

    Aj.onUnload(() => {
      WebApp.MainButton.hide();
      WebApp.MainButton.offClick(BotProfile.eMainClick);
    });

    Aj.onBeforeUnload(() => {
      if (BotProfile.hasChanges()) {
        return 'Changes that you made may not be saved.';
      }
    });

    $('textarea[name=welcome_msg]').on('input', function () {
      var value = this.value.trim();
      $('.tm-welcome-message-content').text(value);
    });

    $('.js-delete-welcome-pic').on('click', BotProfile.eClickRemoveWelcomePic);
    $('.js-upload-button').on('click', BotProfile.eUploadClick);
    $('.js-welcome-pic').on('click', function (e) {
      if ($(this).hasClass('empty')) {
        e.stopPropagation();
        var $upload_btn = $('.js-upload-button[data-target=welcome_msg_pic]');
        BotProfile.eUploadClick.call($upload_btn[0]);
      }
    });
  },
  setWelcomePic(src, loading = false) {
    $pic = $('.js-welcome-pic');
    if (!src) {
      $pic.attr('style', '').addClass('empty');
      Aj.state.files['welcome_msg_pic'] = 0;
      return;
    }

    $pic.removeClass('empty');

    var blur = loading ? 'blur(15px)' : 'blur(0px)';
    $pic.css({ 
      'background-image': `url(${src})`,
      'background-size': 'cover',
      'filter': blur,
      'border': 'none',
    });  
  },
  eClickRemoveWelcomePic() {
    BotProfile.setWelcomePic(false);
  },
  eUploadClick() {
    var target = this.dataset.target;
    if (!target) return;

    if (Aj.state.lang) {
      WebApp.showAlert('Media localization is not available. Please switch to default localization.');
      return;
    }

    if (target == 'bot_userpic') {
      requestUpload(target, res => {
        if (res.ok) {
          $('.tm-main-intro-picture').attr('src', res.media.src);
        }
      }); 
    }

    var bg = null;
    if (target == 'welcome_msg_pic') {
      requestUpload(target, res => {
        if (res.cancel) {
          return;
        }
        if (!res.ok) {
          BotProfile.setWelcomePic(false);
          return;
        }
        BotProfile.setWelcomePic(bg || res.media.src);
      }, 
      {
        onSelected(file) {
          debugger;
          if (!file) return;
          var src = URL.createObjectURL(file);
          bg = src;
          BotProfile.setWelcomePic(src, true);
        }
      });
    }
  },
  eClickLang() {
    var lang = $(this).data('value');
    if (lang == Aj.state.lang) return;
    var href = '?lang=' + lang;

    if (BotProfile.hasChanges()) {
      WebApp.showPopup({
        message: 'Do you want to apply current changes?',
        buttons: [
          { type: 'default', text: 'Save', id: 'save' },
          { type: 'cancel' },
          { type: 'destructive', text: 'Don\'t save', id: 'ignore' },
        ]
      }, button_id => {
        if (button_id == 'ignore') {
          Aj.state.savedModel = BotProfile.model();
          Aj.location(href);
        } else if (button_id == 'save') {
          BotProfile.submit(href);
        }
      });
      return;
    }

    Aj.location(href);
  },
  hasChanges() {
    var old = Aj.state.savedModel;
    var model = BotProfile.model();
    return JSON.stringify(old) != JSON.stringify(model);
  },
  model() {
    return {
      bid: Aj.state.botId,
      title: $('input[name=title]').val(),
      about: $('textarea[name=about]').val(),
      userpic: Aj.state.files['bot_userpic']?.photo_id || '',
      welcome_msg: $('textarea[name=welcome_msg]').val(),
      welcome_msg_pic: Aj.state.files['welcome_msg_pic']?.photo_id || '',
      lang_code: Aj.state.lang,
    };
  },
  eMainClick() {
    BotProfile.submit(`/botfather/bot/${Aj.state.botId}`);
  },
  submit(redirect = false) {
    WebApp.MainButton.showProgress();
    var model = BotProfile.model();
    Aj.apiRequest('updateBotProfile', {...model}, res => {
      WebApp.MainButton.hideProgress();
      if (res.ok) {
        Aj.state.savedModel = model;
        Aj.onUnload(() => Main.showSuccessToast(res.msg));
        if (redirect) {
          Aj.location(redirect);          
        }
      }
      if (res.error) {
        Main.showErrorToast(res.error);
      }
    })
  }
}

var BotCommandsList = {
  init() {
    $('.js-edit-command-list').sortable({items: '.js-sortable'}).on('sortchange', function( event, ui ) {
      WebApp.HapticFeedback.selectionChanged();
    });

    Aj.state.edit = false;
    $('.js-edit-command-list').sortable('disable');

    $(document).on('click.curPage', '.js-set-lang', function (e) {
      var lang = $(this).data('value');
      if (lang == Aj.state.lang) return;
      var href = '?lang=' + lang;
      Aj.location(href);
    });

    $('.js-edit-command-list').on('click', '.tm-row-close', function(e) {
      e.stopPropagation()
      this.closest('.tm-row')?.remove();
      WebApp.HapticFeedback.impactOccurred('light');
      if ($('.js-sortable').length == 0) {
        BotCommandsList.toggleEdit(false);
        $('.js-commands-header').addClass('hidden');
      }
    });

    $('.js-edit-command-list').on('click', '.tm-row-link', function () {
      var command = this.dataset.command;
      if (!Aj.state.edit && command) {
        var q = Aj.state.lang ? '?lang=' + Aj.state.lang : '';
        Aj.location('/botfather/bot/' + Aj.state.botId + '/commands/' + command + q);
      }
    });

    Aj.state.$editBtn = $('.edit-button').on('click', BotCommandsList.toggleEdit);
  },
  toggleEdit(value) {
    var edit = value !== undefined ? !Aj.state.edit : value;
    Aj.state.edit = edit;
    if (!edit) {
      BotCommandsList.submit();
    }
    $('.js-edit-command-list').toggleClass('list-prevent-edit', !edit);
    $('.js-edit-command-list').sortable(edit ? 'enable' : 'disable');
    Aj.state.$editBtn.text(edit ? l('WEB_COMMANDS_DONE_BTN') : l('WEB_COMMANDS_EDIT_BTN'));
  },
  submit() {
    var commands = $('.js-edit-command-list .js-sortable').toArray().map(el => {
      var name = $('.js-command-name', el).text().replace('/', '');
      return name;
    });

    Aj.apiRequest('reorderCommands', { 
      bid: Aj.state.botId,
      lang_code: Aj.state.lang,
      commands: commands,
    }, (res) => {
      if (res.error) {
        Main.showErrorToast(res.error);
      }
    })
  }
}

function botChangeSettings(key, value, callback = false) {
  Aj.apiRequest('changeSettings', { settings: { [key]: value }, bid: Aj.state.botId }, res => {
      if (res.error) {
        Main.showErrorToast(res.error);
      }
      if (callback) callback(res);
    });
}

var BotCommandEdit = {
  init() {
    WebApp.MainButton.setText(l('WEB_COMMANDS_ADD'));
    if (Aj.state.editingCommand) {
      WebApp.MainButton.setText(l('WEB_COMMANDS_SAVE'));
    }
    WebApp.MainButton.show();
    WebApp.MainButton.onClick(BotCommandEdit.submit);

    var $command = $('#command');
    var $desc = $('#desc');

    $('.tm-row-toggle').on('click', function () {
      $('.tm-toggle', this).toggleClass('tm-toggle-on');
      WebApp.HapticFeedback.impactOccurred('light');
    });

    $command.on('input', function () {
      var filtered = $command.val().toLowerCase().replaceAll(/[^a-z0-9_]/g, '');
      $command.val(filtered);
    });

    Aj.onUnload(() => {
      WebApp.MainButton.hide();
      WebApp.MainButton.offClick(BotCommandEdit.submit);
    })
  },
  submit() {
    var value = $('#command').val().trim();
    var desc  = $('#desc').val().trim();

    if (!value) {
      Main.showErrorToast('Command is required');
      $('#command').focus();
      return;
    }
    if (!desc) {
      Main.showErrorToast('Description is required');
      $('#desc').focus();
      return;
    }

    var scopes = [];
    $('[data-field=scope]').each(function () {
      var value = $('.tm-toggle', this).hasClass('tm-toggle-on');
      if (value) {
        scopes.push($(this).data('value'));
      }
    })

    WebApp.MainButton.showProgress();
    Aj.apiRequest('setCommand', { 
      bid: Aj.state.botId,
      lang_code: Aj.state.lang || '',
      scopes: scopes,
      command: value, 
      description: desc, 
      replace: Aj.state.editingCommand || '',
    }, (res) => {
      if (res.error) {
        WebApp.MainButton.hideProgress();
        Main.showErrorToast(res.error);
      }
      if (res.ok) {
        Aj.onUnload(() => Main.showSuccessToast(res.msg));
        setTimeout(() => {
          WebApp.MainButton.hideProgress();
          _backButton();
        }, 1000); // temp hack
      }
    });
  }
}


var BotGeneral = {
  init() {
    Aj.onLoad(() => {
      $('.tm-api-token-actions .tm-active-button').on('click', BotGeneral.copyToken);
      $('.tm-api-token-actions .tm-revoke-button').on('click', BotGeneral.askRevoke);
      $('.js-delete-button').on('click', BotGeneral.eDeleteClick)
      $('.js-usernames').on('click', BotGeneral.eUsernameClick);
      $('.js-spoiler').each(function () {
        SimpleSpoiler.init(this);
      });
      $('body').on('click', '.js-spoiler', BotGeneral.eClickSpoiler);
    });
    Aj.onUnload(() => {
      $('body').off('click', '.js-spoiler', BotGeneral.eClickSpoiler);
    });
  },
  eClickSpoiler() {
    if (this.classList.contains('js-spoiler-revealed')) {
      return BotGeneral.copyToken();
    }
    SimpleSpoiler.destroy(this);
    this.classList.add('js-spoiler-revealed');
  },
  copyToken() {
    var token = $('.tm-api-token').text().trim();
    navigator.clipboard.writeText(token);
    Main.showSuccessToast(l('WEB_TOKEN_COPY_SUCCESS'));
  },
  eUsernameClick() {
    WebApp.openTelegramLink(this.dataset.href);
  },
  eDeleteClick() {
    WebApp.requestWriteAccess(() => {
      Aj.apiRequest('requestDeleteBot', { bid: Aj.state.botId }, res => {
        if (res.ok) {
          WebApp.openTelegramLink(res.open);
          Main.iosChatFix();
          Aj.location('/botfather');
        }
      });
    });
  },
  askRevoke() {
    WebApp.showPopup({
      title: l('WEB_API_TOKEN_REVOKE_TITLE'),
      message: l('WEB_API_TOKEN_REVOKE_TEXT'),
      buttons: [
        {
          type: 'cancel',
        },
        {
          id: 'revoke',
          text: l('WEB_API_TOKEN_REVOKE_BTN'),
          type: 'destructive',
        }
      ]
    }, (result) => {
      if (result === 'revoke') {
        Aj.apiRequest('revokeAccessToken', {
          bid: Aj.state.botId,
        }, (response) => {
          if (response.error) {
            Main.showErrorToast(response.error);
          } 
          if (response.ok) {
            $('.tm-api-token').html(`<span class="js-spoiler">${response.token}</span>`);
            $('.tm-api-token .js-spoiler').each(function () {
              SimpleSpoiler.init(this);
            });
            Main.showSuccessToast(l('WEB_TOKEN_REVOKE_SUCCESS'));
          }
        });
      }
    });
  }
}

var BotSettings = {
  init() {
    $('.js-add-allowed-url').on('click', function () {
      var field_type = this.dataset.type;
      var placeholder = field_type == 'redirect_uri' ? 'Enter redirect URI' : 'Enter origin';
      $(this).parents('.tm-table-wrap').prepend(`<div class="tm-row tm-field">
        <input type="url" class="form-control tm-input" name="allowed_url[]" data-type="${field_type}" placeholder="${placeholder}" autocomplete="off" spellcheck="false" />
      </div>`);
    });

    $('.tm-row-toggle').on('click', function () {
      var toggleEl = this.querySelector('.tm-toggle');
      var value = toggleEl.classList.toggle('tm-toggle-on');
      WebApp.HapticFeedback.impactOccurred('light');
      var field = this.dataset.field;

      if (!field) return;
      if (!value) value = 0;

      if (field == 'biz') {
        botChangeSettings(field, value);
      }
      if (field == 'btfrm') {
        botChangeSettings(field, value);
      }
      if (field == 'btfnu') {
        botChangeSettings(field, value);
      }
      if (field == 'grps') {
        botChangeSettings(field, value);
      }
      if (field == 'priv') {
        botChangeSettings(field, value);
      }
      if (field == 'flskp') {
        botChangeSettings(field, value);
      }
    });

    $('.js-group-admin-rights-toggle').on('click', () => {
      $('.js-group-admin-rights').toggleClass('hidden');
      WebApp.HapticFeedback.impactOccurred('soft');
    });

    $('.js-broadcast-admin-rights-toggle').on('click', () => {
      $('.js-broadcast-admin-rights').toggleClass('hidden');
      WebApp.HapticFeedback.impactOccurred('soft');
    });

    $('.js-threaded-mode-toggle').on('click', () => {
      $('.js-threaded-mode-nouser-toggle').toggleClass('hidden');
      WebApp.HapticFeedback.impactOccurred('soft');
    });

    Aj.state.privacyUrlDebounce = debounce();
    function submitPrivacy() {
      var val = $('input[name=privacy_url]').val();
      Aj.apiRequest('changeSettings', {
        settings: {
          privacy_policy_url: val,
        },
        bid: Aj.state.botId,
      }, res => {
        if (res.error) {
          $('.hint-text[data-for=privacy]').text('URL is invalid').toggleClass('hint-text-error', true);
        } else {
          $('.hint-text[data-for=privacy]').text('');
        }
      })
    }
    $('input[name=privacy_url]').on('input', () => {
      Aj.state.privacyUrlDebounce(submitPrivacy, 600);
    });
    $('input[name=privacy_url]').on('change', () => {
      Aj.state.privacyUrlDebounce(submitPrivacy, 0);
    });

    Aj.state.webLoginDebounce = debounce();
    function submitWebLogic() {
      var val = $('input[name=web_login]').val();
      Aj.apiRequest('changeSettings', {
        settings: {
          domain: val,
        },
        bid: Aj.state.botId,
      }, res => {
        if (res.error) {
          $('.hint-text[data-for=web_login]').text('Domain is invalid').toggleClass('hint-text-error', true);
        } else {
          $('.hint-text[data-for=web_login]').text('').toggleClass('hint-text-error', false);
        }
      })
    }
    $('input[name=web_login]').on('input', () => {
      Aj.state.webLoginDebounce(submitWebLogic, 600);
    });
    $('input[name=web_login]').on('change', () => {
      Aj.state.webLoginDebounce(submitWebLogic, 0);
    });

    $('.js-group-admin-rights-toggle .tm-toggle').on('click', function (event) {
      event.stopPropagation();

      var $this = $(this);
      $this.toggleClass('tm-toggle-on');
      var newState = $this.hasClass('tm-toggle-on');

      $('.js-group-admin-rights').toggleClass('hidden', !newState);
      Aj.state.blockChecks = true;
      $('.js-group-admin-rights input').prop('checked', newState);
      Aj.state.blockChecks = false;
      updateAdminRights();
    });

    function updateAdminRights() {
      var new_values = [];
      var total = 0;
      $('.js-group-admin-rights input').each((i, el) => {
        total++;
        if (el.checked) {
          new_values.push(el.name);
        }
      });
      $('.js-group-admin-rights-toggle .tm-row-count').text(new_values.length + '/' + total);
      if (new_values.length === 0) {
        new_values = null;
        $('.js-group-admin-rights-toggle .tm-toggle').removeClass('tm-toggle-on');
      } else {
        $('.js-group-admin-rights-toggle .tm-toggle').addClass('tm-toggle-on');
      }
      botChangeSettings('group_admin_rights', new_values);
    }

    $('.js-group-admin-rights input').on('change', function () {
      if (Aj.state.blockChecks) return;
      updateAdminRights();
    })

    $('.js-broadcast-admin-rights-toggle .tm-toggle').on('click', function (event) {
      event.stopPropagation();
    
      var $this = $(this);
      $this.toggleClass('tm-toggle-on');
      var newState = $this.hasClass('tm-toggle-on');

      $('.js-broadcast-admin-rights').toggleClass('hidden', !newState);
      Aj.state.blockChecks = true;
      $('.js-broadcast-admin-rights input').prop('checked', newState);
      Aj.state.blockChecks = false;
      updateBroadcastAdminRights();
    });

    function updateBroadcastAdminRights() {
      var new_values = [];
      var total = 0;
      $('.js-broadcast-admin-rights input').each((i, el) => {
        total++;
        if (el.checked) {
          new_values.push(el.name);
        }
      });
      $('.js-broadcast-admin-rights-toggle .tm-row-count').text(new_values.length + '/' + total);
      if (new_values.length === 0) {
        new_values = null;
        $('.js-broadcast-admin-rights-toggle .tm-toggle').removeClass('tm-toggle-on');
      } else {
        $('.js-broadcast-admin-rights-toggle .tm-toggle').addClass('tm-toggle-on');
      }
      botChangeSettings('broadcast_admin_rights', new_values);
    }

    $('.js-broadcast-admin-rights input').on('change', function () {
      if (Aj.state.blockChecks) return;
      updateBroadcastAdminRights();
    });

    $('.js-spoiler').each(function () {
      SimpleSpoiler.init(this);
    });
    $('body').on('click', '.js-spoiler', BotSettings.eClickSpoiler);

    $('.copy-btn').on('click', function () {
      navigator.clipboard.writeText(this.dataset.value);
      Main.showSuccessToast(l('WEB_GENERIC_COPY_SUCCESS'));
    })

    $('.js-revoke-client-secret').on('click', function () {
      BotSettings.askRevokeClientSecret();
    })

    $('.js-migrate-oauth').on('click', function () {
      BotSettings.askMigrateOauth();
    });
  },

  eClickSpoiler() {
    SimpleSpoiler.destroy(this);
    this.classList.add('js-spoiler-revealed');
  },

  askMigrateOauth() {
    WebApp.showPopup({
      title: l('WEB_LOGIN_MIGRATE_TITLE'),
      message: l('WEB_LOGIN_MIGRATE_TEXT'),
      buttons: [
        {
          id: 'confirm',
          text: l('WEB_LOGIN_MIGRATE_CONFIRM_BTN'),
          type: 'default',
        },
        {
          type: 'cancel',
        },
      ]
    }, (result) => {
      if (result === 'confirm') {
        Aj.apiRequest('revokeOIDCClientSecret', {
          bid: Aj.state.botId,
        }, (response) => {
          if (response.error) {
            Main.showErrorToast(response.error);
          } 
          if (response.ok) {
            window.location.search += '?migrate=1';
          }
        });
      }
    });
  },

  askRevokeClientSecret() {
    WebApp.showPopup({
      title: l('WEB_CLIENT_SECRET_REVOKE_TITLE'),
      message: l('WEB_CLIENT_SECRET_REVOKE_TEXT'),
      buttons: [
        {
          type: 'cancel',
        },
        {
          id: 'revoke',
          text: l('WEB_API_TOKEN_REVOKE_BTN'),
          type: 'destructive',
        }
      ]
    }, (result) => {
      if (result === 'revoke') {
        Aj.apiRequest('revokeOIDCClientSecret', {
          bid: Aj.state.botId,
        }, (response) => {
          if (response.error) {
            Main.showErrorToast(response.error);
          } 
          if (response.ok) {
            $('.js-spoiler.js-secret-val').html(response.token);
            $('.copy-btn.js-secret-val').data('value', response.token);

            $('.js-spoiler.js-secret-val').each(function () {
              SimpleSpoiler.init(this);
            });
            Main.showSuccessToast(l('WEB_CLIENT_SECRET_REVOKE_SUCCESS'));
          }
        });
      }
    });
  }
}

var BotSettingsInline = {
  init() {
    $('.tm-row-toggle').on('click', function () {
      var toggleEl = this.querySelector('.tm-toggle');
      var value = toggleEl.classList.toggle('tm-toggle-on');
      WebApp.HapticFeedback.impactOccurred('light');
      var field = this.dataset.field;
      if (!field) return;
      if (!value) value = 0;

      if (field == 'inline') {
        $('.tr-enter').toggleClass('hidden', !value);
        botChangeSettings(field, value);
      }
      if (field == 'ingeo') {
        botChangeSettings(field, value);
      }
    });

    $('.js-infdb-dd-item').on('click', function () {
      var value = this.dataset.value;
      $('.js-infdb-value').text(this.text);
      $('li.selected:has(.js-infdb-dd-item)').toggleClass('selected');
      $(this).parent().toggleClass('selected');
      botChangeSettings('infdb', value);
    });

    $('input[name=inph]').on('change', function () {
      botChangeSettings('inph', this.value);
    })
  },
}

var BotGames = {
  init() {
    $('.tm-row-toggle').on('click', function () {
      var toggleEl = this.querySelector('.tm-toggle');
      var value = toggleEl.classList.toggle('tm-toggle-on');
      WebApp.HapticFeedback.impactOccurred('light');
      var field = this.dataset.field;
      if (!field) return;
      if (!value) value = 0;

      if (field == 'inline') {
        $('.tr-enter').toggleClass('hidden', !value);
        botChangeSettings(field, value);
      }
    });

    $('.js-game-copy').on('click', function (e) {
      // e.stopPropagation();
      navigator.clipboard.writeText(this.dataset.value);
      Main.showToast(l('WEB_LINK_COPIED'), { class: 'success' });
      WebApp.HapticFeedback.notificationOccurred('success');
    })

    $('.js-game-delete').on('click', function (e) {
      // e.stopPropagation();
      var gameId = this.dataset.id;
      WebApp.showPopup({
        title: l('WEB_GAMES_DELETE_CONFIRM_TITLE'),
        message: l('WEB_GAMES_DELETE_CONFIRM_BODY'),
        buttons: [
          {
            id: 'delete',
            text: l('WEB_GAMES_DELETE'),
            type: 'destructive',
          },
          {
            type: 'cancel',
          },
        ]
      }, (result) => {
        if (result !== 'delete') return;
        Aj.apiRequest('setApp', {
          bid: Aj.state.botId,
          type: 'game',
          game_id: gameId,
          delete: true,
        }, res => {
          if (res.error) {
            Main.showErrorToast(res.error);
          } else {
            Main.showSuccessToast(res.msg);
            this.closest('.tm-row').remove();
          }
        });
      });
    });
  }
}

var BotGameEdit = {
  init() {
    if (!Aj.state.editingGame) {
      WebApp.MainButton.setText('Create');
    } else {
      WebApp.MainButton.setText('Save');
    }
    WebApp.MainButton.show();
    WebApp.MainButton.onClick(BotGameEdit.submit);

    Aj.state.files = Aj.state.files || {};

    Aj.onUnload(() => {
      WebApp.MainButton.hide();
      WebApp.MainButton.offClick(BotGameEdit.submit);
    })

    $('input[name=short_name]').on('input', function () {
      var value = this.value.trim();
      value = value.toLowerCase();
      value = value.replaceAll(/[^a-z0-9_]/g, '');
      value = value.replaceAll(/^[_0-9]/g, '');
      this.value = value || '';
    });

    $('input[name=title]').on('input', function () {
      var value = this.value.trim();
      $('.tm-welcome-message-title').text(value);
    });

    $('textarea[name=description]').on('input', function () {
      var value = this.value.trim();
      $('.tm-welcome-message-content').text(value);
    });

    $('.js-upload-button').on('click', function () {
      var target = this.dataset.target;
      if (!target) return;

      if (target == 'game_pic') {
        requestUpload(target, res => {
          if (res.ok) {
            $('.tm-image-input-container').css({
              'background-image': `url(${res.media.src})`,
              'background-size': 'cover',
              'filter': 'none',
              'border': 'none',
            });
          } else {
            $('.tm-image-input-container').attr('style', '');
          }
        }, {
          onSelected(file) {
            if (!file) return;

            if (file) {
              var src = URL.createObjectURL(file);
              $('.tm-image-input-container').css({
                'background-image': `url(${src})`,
                'background-size': 'cover',
                'filter': 'blur(15px)',
                'border': 'none',
              });
            }
          }
        });
      }
    });
  },
  submit() {
    var short_name = $('input[name=short_name]').val()?.trim() || (Aj.state.editingGame ? 'b92389418239' : '');
    var title = $('input[name=title]').val()?.trim();
    var description = $('textarea[name=description]').val()?.trim();
    var game_pic = Aj.state.files['game_pic']?.photo_id || '';

    if (!short_name || short_name.length < 3) {
      Main.showErrorToast('Short name must be at least 3 characters long.');
      $('input[name=short_name]').focus();
      return;
    }
    if (!title) {
      Main.showErrorToast('Title is required.');
      $('input[name=title]').focus();
      return;
    }
    if (!game_pic) {
      Main.showErrorToast('Picture is required.');
      return;
    }
    WebApp.MainButton.showProgress();
    Aj.apiRequest('setApp', {
      bid: Aj.state.botId,
      type: 'game',
      game_id: Aj.state.editingGame || '',
      short_name: short_name,
      title: title,
      desc: description,
      app_pic: game_pic,
    }, res => {
      WebApp.MainButton.hideProgress();
      if (res.ok) {
        Aj.onUnload(() => Main.showSuccessToast(res.msg));
        Aj.location(`/botfather/bot/${Aj.state.botId}/games`);
      } else if (res.error) {
        Main.showErrorToast(res.error);
      }
    });
  }
}

var BotAppEdit = {
  init() {
    if (!Aj.s
