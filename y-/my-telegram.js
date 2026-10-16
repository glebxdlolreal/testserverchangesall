/* my.telegram.org — shared UI logic (vanilla JS, no jQuery) */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  function postForm(url, data) {
    var body = Object.keys(data).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(data[key] == null ? '' : data[key]);
    }).join('&');
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
      credentials: 'same-origin'
    }).then(function (res) {
      return res.text().then(function (text) {
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (e) {}
        if (!res.ok) {
          throw { text: (parsed && parsed.text) || text || 'Error', field: parsed && parsed.field };
        }
        return parsed;
      });
    });
  }

  function formData(form) {
    var data = {};
    $all('input, textarea, select', form).forEach(function (el) {
      if (!el.name || el.disabled) return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      data[el.name] = el.value;
    });
    return data;
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    if (busy) {
      btn.setAttribute('data-label', btn.textContent);
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
  }

  function showAlert(slot, text) {
    if (!slot) return;
    slot.innerHTML =
      '<div class="callout danger">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
      '<div>' + escapeHtml(text) + '</div></div>';
    slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function clearAlert(slot) {
    if (slot) slot.innerHTML = '';
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fieldOf(input) {
    return input.closest('.field');
  }

  function setFieldState(input, state, msg) {
    var field = fieldOf(input);
    if (!field) return;
    field.classList.remove('ok', 'err');
    if (state) field.classList.add(state);
    var msgEl = $('.hint .msg', field);
    if (msgEl && msg != null) msgEl.textContent = msg;
  }

  function clearFieldState(input) {
    var field = fieldOf(input);
    if (!field) return;
    field.classList.remove('ok', 'err');
  }

  /* ---------- theme toggle ---------- */
  function initTheme() {
    $all('.theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var root = document.documentElement;
        var current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        var next = current === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch (e) {}
      });
    });
  }

  /* ---------- ripple (design ui.js) ---------- */
  function initMotion() {
    var sel = '.btn, .chip, .icon-btn, .side a, .theme-toggle';
    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest(sel);
      if (!el) return;
      var r = el.getBoundingClientRect();
      var d = Math.max(r.width, r.height) * 2.2;
      var s = document.createElement('span');
      s.className = 'ripple';
      s.style.width = s.style.height = d + 'px';
      s.style.left = (e.clientX - r.left - d / 2) + 'px';
      s.style.top = (e.clientY - r.top - d / 2) + 'px';
      el.appendChild(s);
      var done = function () { s.classList.add('out'); setTimeout(function () { s.remove(); }, 400); };
      el.addEventListener('pointerup', done, { once: true });
      el.addEventListener('pointerleave', done, { once: true });
    });
  }

  /* ---------- country picker ---------- */
  function countryFlag(iso2) {
    if (!/^[A-Z]{2}$/.test(iso2)) return '\u{1F310}';
    return String.fromCodePoint(0x1F1E6 + iso2.charCodeAt(0) - 65, 0x1F1E6 + iso2.charCodeAt(1) - 65);
  }

  function initPhoneField() {
    var field = $('#phoneField');
    if (!field || typeof MyCountries === 'undefined') return;

    var btn = $('#countryBtn', field);
    var pop = $('#countryPop', field);
    var list = $('#countryList', field);
    var query = $('#countryQ', field);
    var input = $('#my_login_phone', field);
    var label = $('label', field);
    var flagEl = $('#cFlag', field);
    var codeEl = $('#cCode', field);
    var current = codeEl.textContent;

    function layout() {
      var w = btn.offsetLeft + btn.offsetWidth + 12;
      input.style.paddingLeft = w + 'px';
      if (label) label.style.left = (w + 1) + 'px';
    }

    function render(filter) {
      var f = (filter || '').toLowerCase().trim();
      var dial = f.replace(/^\+/, '');
      list.innerHTML = '';
      var shown = 0;
      MyCountries.forEach(function (c) {
        if (f && c[1].toLowerCase().indexOf(f) === -1 && c[2].replace(/^\+/, '').indexOf(dial) !== 0) return;
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.className = c[2] === current ? 'sel' : '';
        li.innerHTML = '<span class="flag">' + countryFlag(c[0]) + '</span><span class="name"></span><span class="dial">' + c[2] + '</span>';
        $('.name', li).textContent = c[1];
        li.addEventListener('click', function () { pick(c); });
        list.appendChild(li);
        shown++;
      });
      if (!shown) {
        list.innerHTML = '<li class="empty">No countries found</li>';
      }
    }

    function open() {
      render('');
      query.value = '';
      field.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      setTimeout(function () { query.focus(); }, 60);
    }

    function close() {
      field.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }

    function pick(c) {
      current = c[2];
      flagEl.textContent = countryFlag(c[0]);
      codeEl.textContent = c[2];
      close();
      layout();
      input.focus();
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (field.classList.contains('open')) close(); else open();
    });
    query.addEventListener('input', function () { render(query.value); });
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    layout();

    field.getFullPhone = function () {
      var digits = input.value.replace(/\D/g, '');
      if (!digits) return '';
      if (input.value.charAt(0) === '+') return '+' + digits;
      return current + digits;
    };
  }

  /* ---------- auth: phone + code ---------- */
  function initAuth() {
    var sendForm = $('#my_send_form');
    if (!sendForm) return;

    var loginForm = $('#my_login_form');
    var alertSlot = $('#my_login_alert');
    var phoneInput = $('#my_login_phone');
    var phoneField = $('#phoneField');
    var codeInput = $('#my_password');
    var hashInput = $('#my_random_hash');
    var phoneHidden = $('#my_login_phone_input');

    var stagePhone = $('#stage_phone');
    var stageCode = $('#stage_code');
    var codePhone = $('#my_code_phone');
    var resendLink = $('#my_resend_link');
    var resendText = $('#my_resend_text');
    var resendTimer = null;

    function showCodeStage(phone) {
      if (stagePhone && stageCode) {
        stagePhone.classList.add('my-hide');
        stageCode.classList.remove('my-hide');
      }
      if (codePhone) codePhone.textContent = phone;
      if (codeInput) codeInput.focus();
      startResendCountdown(42);
    }

    function showPhoneStage() {
      if (stagePhone && stageCode) {
        stageCode.classList.add('my-hide');
        stagePhone.classList.remove('my-hide');
      }
      stopResendCountdown();
    }

    function stopResendCountdown() {
      if (resendTimer) {
        clearInterval(resendTimer);
        resendTimer = null;
      }
    }

    function startResendCountdown(seconds) {
      if (!resendLink || !resendText) return;
      stopResendCountdown();
      var left = seconds;
      resendLink.classList.add('disabled');
      var tick = function () {
        var mm = Math.floor(left / 60);
        var ss = ('0' + (left % 60)).slice(-2);
        resendText.textContent = 'Resend in ' + mm + ':' + ss;
        if (left <= 0) {
          stopResendCountdown();
          resendText.textContent = 'Resend code';
          resendLink.classList.remove('disabled');
        }
        left--;
      };
      tick();
      resendTimer = setInterval(tick, 1000);
    }

    function sendPassword(phone, btn, onDone) {
      clearAlert(alertSlot);
      setBusy(btn, true);
      postForm('/auth/send_password', { phone: phone }).then(function (result) {
        setBusy(btn, false);
        if (hashInput) hashInput.value = result.random_hash;
        if (phoneHidden) phoneHidden.value = phone;
        if (onDone) onDone(phone);
      }).catch(function (err) {
        setBusy(btn, false);
        showAlert(alertSlot, err.text);
      });
    }

    sendForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = phoneField && phoneField.getFullPhone ? phoneField.getFullPhone() : phoneInput.value.trim();
      if (phone.replace(/\D/g, '').length < 5) {
        setFieldState(phoneInput, 'err', 'Enter a valid phone number');
        phoneInput.focus();
        return;
      }
      clearFieldState(phoneInput);
      sendPassword(phone, $('button[type="submit"]', sendForm), showCodeStage);
    });

    var wrongNumber = $('#my_wrong_number');
    if (wrongNumber) {
      wrongNumber.addEventListener('click', function (e) {
        e.preventDefault();
        clearAlert(alertSlot);
        showPhoneStage();
        if (phoneInput) phoneInput.focus();
      });
    }

    if (resendLink) {
      resendLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (resendLink.classList.contains('disabled')) return;
        sendPassword(phoneHidden.value, null, function () {
          startResendCountdown(42);
        });
      });
    }

    if (codeInput) {
      codeInput.addEventListener('input', function () {
        codeInput.value = codeInput.value.replace(/\s+/g, '');
        clearFieldState(codeInput);
      });
    }

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearAlert(alertSlot);
      if (!codeInput.value) {
        setFieldState(codeInput, 'err', 'Enter the code from the Telegram message');
        codeInput.focus();
        return;
      }
      var btn = $('button[type="submit"]', loginForm);
      setBusy(btn, true);
      postForm('/auth/login', formData(loginForm)).then(function () {
        location.href = typeof MyAuthRedirect !== 'undefined' ? MyAuthRedirect : '/';
      }).catch(function (err) {
        setBusy(btn, false);
        setFieldState(codeInput, 'err', err.text);
      });
    });
  }

  /* ---------- app form validation ---------- */
  function validateTitle(input) {
    var value = input.value.trim();
    if (value.length < 5) {
      setFieldState(input, 'err', 'At least 5 characters');
      return false;
    }
    setFieldState(input, 'ok', 'Looks good');
    return true;
  }

  function validateShortname(input) {
    var value = input.value;
    if (!/^[A-Za-z0-9 ]{5,32}$/.test(value)) {
      setFieldState(input, 'err', '5–32 characters: latin letters, digits and spaces');
      return false;
    }
    setFieldState(input, 'ok', 'Looks good');
    return true;
  }

  function initCounter(input, max) {
    var field = fieldOf(input);
    if (!field) return;
    var countEl = $('.hint .count', field);
    if (!countEl) return;
    var update = function () { countEl.textContent = input.value.length + ' / ' + max; };
    input.addEventListener('input', update);
    update();
  }

  /* ---------- create app ---------- */
  function initCreateApp() {
    var form = $('#app_create_form');
    if (!form) return;

    $all('.chip input[type="radio"]', form).forEach(function (radio) {
      radio.addEventListener('change', function () {
        $all('.chip', form).forEach(function (chip) { chip.classList.remove('on'); });
        radio.closest('.chip').classList.add('on');
      });
    });

    var titleInput = $('#app_title');
    var nameInput = $('#app_shortname');
    var descInput = $('#app_desc');
    var alertSlot = $('#app_form_alert');

    initCounter(titleInput, 255);
    initCounter(nameInput, 32);
    if (descInput) initCounter(descInput, 512);

    var touched = false;
    function revalidate() {
      if (!touched) return;
      validateTitle(titleInput);
      validateShortname(nameInput);
    }
    titleInput.addEventListener('input', revalidate);
    nameInput.addEventListener('input', revalidate);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      touched = true;
      clearAlert(alertSlot);
      var okTitle = validateTitle(titleInput);
      var okName = validateShortname(nameInput);
      if (!okTitle) { titleInput.focus(); return; }
      if (!okName) { nameInput.focus(); return; }

      var btn = $('button[type="submit"]', form);
      setBusy(btn, true);
      var createUrl = '/apps/create';
      if (location.search.indexOf('_newapp=1') !== -1) {
        createUrl += '?_newapp=1';
      }
      postForm(createUrl, formData(form)).then(function () {
        location.reload();
      }).catch(function (err) {
        setBusy(btn, false);
        var target = err.field === 'app_shortname' ? nameInput : err.field === 'app_title' ? titleInput : null;
        if (target) {
          setFieldState(target, 'err', err.text);
          target.focus();
        } else {
          showAlert(alertSlot, err.text);
        }
      });
    });
  }

  /* ---------- edit app ---------- */
  function initEditApp() {
    var form = $('#app_edit_form');
    if (!form) return;

    var alertSlot = $('#app_form_alert');
    var titleInput = $('#app_title');
    var nameInput = $('#app_shortname');

    $all('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-copy');
        copyText(value, btn);
      });
    });

    $all('[data-reveal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = $(btn.getAttribute('data-reveal'));
        if (!target) return;
        var textEl = $('.vv', target) || target;
        var masked = target.classList.toggle('masked');
        if (masked) {
          textEl.textContent = '••••••••••••••••••••••••••••••••';
          btn.title = 'Show';
        } else {
          textEl.textContent = target.getAttribute('data-value');
          btn.title = 'Hide';
        }
      });
    });

    function copyText(value, btn) {
      var done = function () {
        btn.classList.add('copied');
        setTimeout(function () { btn.classList.remove('copied'); }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, done);
      } else {
        var area = document.createElement('textarea');
        area.value = value;
        document.body.appendChild(area);
        area.select();
        try { document.execCommand('copy'); } catch (e) {}
        area.remove();
        done();
      }
    }

    var touched = false;
    function revalidate() {
      if (!touched) return;
      validateTitle(titleInput);
      validateShortname(nameInput);
    }
    titleInput.addEventListener('input', revalidate);
    nameInput.addEventListener('input', revalidate);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      touched = true;
      clearAlert(alertSlot);
      var okTitle = validateTitle(titleInput);
      var okName = validateShortname(nameInput);
      if (!okTitle) { titleInput.focus(); return; }
      if (!okName) { nameInput.focus(); return; }

      var btn = $('button[type="submit"]', form);
      setBusy(btn, true);
      postForm('/apps/save', formData(form)).then(function () {
        setBusy(btn, false);
        if (alertSlot) {
          alertSlot.innerHTML =
            '<div class="callout success">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>' +
            '<div>Saved.</div></div>';
        }
      }).catch(function (err) {
        setBusy(btn, false);
        var target = err.field === 'app_shortname' ? nameInput : err.field === 'app_title' ? titleInput : null;
        if (target) {
          setFieldState(target, 'err', err.text);
          target.focus();
        } else {
          showAlert(alertSlot, err.text);
        }
      });
    });
  }

  /* ---------- delete account ---------- */
  function initDelete() {
    var form = $('#deactivate_phone_form');
    if (!form) return;

    var confirmBox = $('#deactivate_confirm_box');
    var confirmBtn = $('#deactivate_confirm_btn');
    var cancelBtn = $('#deactivate_cancel_btn');
    var alertSlot = $('#deactivate_code_alert');
    var resultWrap = $('#deactivate_result_wrap');
    var formWrap = form;
    var messageInput = $('#deactivate_message');
    var performing = false;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      confirmBox.classList.remove('my-hide');
      confirmBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    cancelBtn.addEventListener('click', function () {
      confirmBox.classList.add('my-hide');
    });

    confirmBtn.addEventListener('click', function () {
      if (performing) return;
      performing = true;
      clearAlert(alertSlot);
      setBusy(confirmBtn, true);
      postForm('/delete/do_delete', {
        hash: form.elements.hash.value,
        message: messageInput ? messageInput.value : ''
      }).then(function () {
        setBusy(confirmBtn, false);
        performing = false;
        formWrap.classList.add('my-hide');
        resultWrap.classList.remove('my-hide');
      }).catch(function (err) {
        setBusy(confirmBtn, false);
        performing = false;
        showAlert(alertSlot, err.text);
      });
    });
  }

  ready(function () {
    initTheme();
    initMotion();
    initPhoneField();
    initAuth();
    initCreateApp();
    initEditApp();
    initDelete();
  });
})();
