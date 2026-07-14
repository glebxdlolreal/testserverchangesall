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

    var accept = (allow_phone = false) => Aj.apiRequest('confirm', {qtoken: Aj.state.qtoken, accept_allow_phone: allow_phone, accept_allow_write: Aj.state.allowMsg}, res => {
      if (res) {
        if (res.ok) {
          WebApp.HapticFeedback.notificationOccurred('success');
          if (res.redirect) {
            const webApp = WebApp;
            webApp.openLink(res.redirect);
          }
          WebApp.close();
        }
      }
    });

    Aj.state.onMainButton = () => {
      sent = true;

      if (Aj.state.request_phone) {
        WebApp.showPopup({
          title: l('WEB_FALLBACK_REQUEST_PHONE', 'Allow access?'),
          message: l('WEB_FALLBACK_REQUEST_PHONE_BODY', {
            phone: Aj.state.request_phone,
            domain: Aj.state.request_domain,
          }),
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
