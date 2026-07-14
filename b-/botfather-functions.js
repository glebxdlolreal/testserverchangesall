var BotFunction = {
  init() {
    var isNew = Aj.state.isFunctionNew;
    var $input = $('#function-name');

    if (isNew) {
      $input.on('input', function() {
        var filtered = $input.val().replace(/[^a-zA-Z0-9_]/g, '');
        if (filtered && !/^[a-zA-Z]/.test(filtered)) {
          filtered = filtered.substring(1);
        }
        $input.val(filtered);
        BotConsole.updatePrefix(filtered);
      });
    }

    BotCodeEditor.init('function-editor', {
      apiMethod: 'saveCloudFunction',
      apiParams: isNew ? {} : { name: Aj.state.functionName },
      savedLangKey: 'WEB_FUNCTION_SAVED',
      saveErrorLangKey: 'WEB_FUNCTION_SAVE_ERROR',
    });

    BotConsole.init(isNew ? '' : Aj.state.functionName);

    if (isNew) {
      WebApp.MainButton.offClick(BotCodeEditor.onSave);
      WebApp.MainButton.onClick(BotFunction.onSave);
      Aj.onUnload(function() { WebApp.MainButton.offClick(BotFunction.onSave); });
    }

    if (!isNew) {
      $(document).on('click.curPage', '.js-editor-delete', function() {
        WebApp.showPopup({
          title: uncleanHTML(l('WEB_FUNCTION_DELETE_CONFIRM_TITLE')),
          message: uncleanHTML(l('WEB_FUNCTION_DELETE_CONFIRM_BODY')),
          buttons: [
            { id: 'delete', text: uncleanHTML(l('WEB_EDITOR_DELETE')), type: 'destructive' },
            { type: 'cancel' },
          ]
        }, function(result) {
          if (result !== 'delete') return;
          Aj.apiRequest('deleteCloudFunction', { bid: Aj.state.botId, name: Aj.state.functionName }, function(res) {
            if (res.ok) {
              Aj.onUnload(function() { TWebApp.showSuccessToast(l('WEB_FUNCTION_DELETED')); });
              TBackButton.onClick();
            } else {
              TWebApp.showErrorToast(res.error);
            }
          });
        });
      });
    }
  },
  onSave() {
    var name = $('#function-name').val().trim();
    if (!name || !/^[a-z][a-z0-9_]{0,62}[a-z0-9]$/i.test(name)) {
      TWebApp.showErrorToast(l('WEB_FUNCTION_NAME_INVALID'));
      $('#function-name').focus();
      return;
    }
    var existing = Aj.state.existingFunctions || [];
    if (existing.indexOf(name) !== -1) {
      TWebApp.showErrorToast(l('WEB_FUNCTION_NAME_EXISTS'));
      $('#function-name').focus();
      return;
    }

    var code = BotCodeEditor.cm.getValue();
    WebApp.MainButton.showProgress();
    Aj.apiRequest('saveCloudFunction', {
      bid: Aj.state.botId,
      name: name,
      code: code,
    }, function(res) {
      WebApp.MainButton.hideProgress();
      if (res.ok) {
        BotCodeEditor.savedCode = code;
        Aj.onUnload(function() { TWebApp.showSuccessToast(l('WEB_FUNCTION_SAVED')); });
        TBackButton.onClick();
      } else {
        TWebApp.showErrorToast(res.error || l('WEB_FUNCTION_SAVE_ERROR'));
      }
    });
  },
};
