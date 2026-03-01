var Common = {
  init: function () {
    $('img').on('error', function (e) {
      var src = this.src;
      setTimeout(() => {
        var url = document.createElement('a');
        url.href = src;
        if (!url.search.includes('retry')) {
          url.search += '&retry=1';
          this.src = url.href;
        }
      }, 300);
    });
  }
}

var Main = {
  init: function () {
    Aj.onLoad(() => {
      Aj.state.actions = {};

      $('.gs-row').on('click', e => {
        if (e.target.tagName == 'BUTTON' || e.target.tagName == 'A') return;
        Aj.location('/collection/' + e.currentTarget.dataset.collectionId);
      })

      $('.gs-search-input').on('input', el => {
        const value = el.currentTarget.value;
        const cols = Aj.state.collections;
        $('.gs-row').each((i, el) => {
          var matches = fuzzyMatch(value, cols[el.dataset.collectionId]?.title);
          el.classList.toggle('hidden', !matches);
        })
      })

      $('.gs-status-select').on('click', '.dropdown-menu-item', Main.updateStatus)
      $('#rollOutBtn').on('click', Main.openRollOut)
      $('.gs-header-row').on('click', '.gs-cell-sort', Main.eSortList)
    });

    Aj.onUnload(() => {
      $('.js-lottie').each((i, el) => RLottie.destroy(el));
    })
  },
  eSortList: function (e) {
    var $sortEl = $(this);
    
    if ($sortEl.hasClass('sort-active')) {
      $sortEl.toggleClass('sort-asc')
    } else {
      $('.sort-active').toggleClass('sort-active', false);
      $sortEl.toggleClass('sort-active')
    }

    var sortBy  = $sortEl.attr('data-sort-by');
    var sortAsc = $sortEl.hasClass('sort-asc');


    function statusValue(col) {
      if (!col) return 0;

      if (col.status == 'draft') return 7;
      if (col.status == 'upgrade_ready' && !col.upgraded) return 6;
      if (col.status == 'sale_ready' && !col.released_id) return 5;
      if (col.upgraded) return 3;
      if (col.released_id) return 4;
      return 2;
    }

    var sortKeys = {
      status: function(a, b) {
        return statusValue(a) - statusValue(b)
      },
      price: function(a, b) {
        return (b?.giftData?.stars ?? 0) - (a?.giftData?.stars ?? 0);
      },
      supply: function(a, b) {
        return (b?.giftData?.limited ?? 0) - (a?.giftData?.limited ?? 0);
      },
      added: function(a, b) {
        return (a?.released_time ?? Infinity) - (b?.released_time ?? Infinity);
      },
    };

    var cols = Aj.state.collections;

    function sort(key, reverse) {
      return (a, b) => (reverse ? -1 : 1) * sortKeys[key](cols[a.dataset.collectionId], cols[b.dataset.collectionId]);
    }

    var list = $(".gs-row").get();
    list.sort(sort(sortBy, sortAsc));
    for (var i = 0; i < list.length; i++) {
        list[i].parentNode.appendChild(list[i]);
    }
  },
  updateStatus: function (e) {
    const value = this.dataset.value;
    const collection = this.dataset.collection;
    this.closest('.gs-status-select').children[0].textContent = this.textContent;

    if (['sale_ready', 'upgrade_ready', 'craft_ready'].includes(value)) {
      delete Aj.state.actions[collection];
      $(`.gs-row[data-collection-id="${collection}"]`).toggleClass('gs-row-selected', false);
    } else {
      Aj.state.actions[collection] = this.dataset.value;
      $(`.gs-row[data-collection-id="${collection}"]`).toggleClass('gs-row-selected', true);
    }

    Main.updateRollOut()
  },
  updateRollOut() {
    let num_changes = Object.keys(Aj.state.actions).length;

    $('#rollOutBtn').attr('disabled', num_changes == 0).contents()[2].nodeValue = ` Roll Out Changes (${num_changes})`;
  },
  openRollOut() {
    const cols = Aj.state.collections;

    let count = 0;

    let saleGridHtml = Object.entries(Aj.state.actions).map(([k,v], i) => {
      if (cols[k].gift_status !== 'draft') return '';
      count++;

      var ribbon_text = 'Unlimited';
      var ribbon_class = ' gs-rollout-gift-ribbon-unlimited';

      var limited = Number(cols[k]?.giftData?.limited);
      if (limited) {
        var short = Math.round(limited / 1000);
        ribbon_class = '';
        if (short === limited / 1000) {
          ribbon_text = short + 'K';
        } else {
          ribbon_text = limited;
        }
      }

      var by_text = "";
      var by_username = cols[k].giftData?.released_by_username;
      if (by_username) {
        by_text = `by <a target="_blank" href="https://t.me/${by_username}">@${by_username}</a>`;
      }

      return `<li class="gs-rollout-gift">
        <div class="gs-rollout-gift-ribbon${ribbon_class}">${ribbon_text}</div>
        <input type="hidden" name="sale[]" value="${k}">
        ${GiftStudio.renderSticker(cols[k].giftData?.sticker)}
        <span class="gift-by">${by_text}</span>
        <span class="gift-buy-button">${Aj.state.starEmoji} ${cols[k].giftData?.stars}</span>
      </li>`
    }).join('');

    let upgradeListHtml = Object.entries(Aj.state.actions).map(([k,v], i) => {
      if (v !== 'to_upgrade') return '';
      return `<div class="gs-rollout-upgrade-row">
        <img src="/emoji/${cols[k].giftData.sticker}.webp?xieworld_vf">
        <div class="rollout-upgrade-row-title">
          <div><b>${cols[k]?.title}</b></div>
          <div>${cols[k]?.slug}</div>
        </div>
        <div style="flex-grow: 1"></div>
        <div style="margin-right: 28px">
          <div><b>${cols[k]?.skins_count || '?'}</b></div>
          <div>models</div>
        </div>
        <div>
          <b><i class="icon-telegram-stars"></i> ${cols[k]?.max_upgrade || '?'} ⇨ ${cols[k]?.min_upgrade || '?'}</b>
          <div>upgrade price</div>
        </div>
        <input type="hidden" name="upgrade[]" value="${k}">
      </div>`
    }).join('');

    let craftListHtml = Object.entries(Aj.state.actions).map(([k,v], i) => {
      if (v !== 'to_craft') return '';
      return `<div class="gs-rollout-upgrade-row">
        <img src="/emoji/${cols[k].giftData.sticker}.webp?xieworld_vf">
        <div class="rollout-upgrade-row-title">
          <div><b>${cols[k]?.title}</b></div>
          <div>${cols[k]?.slug}</div>
        </div>
        <div style="flex-grow: 1"></div>
        <div style="margin-right: 28px">
          <div><b>${cols[k]?.skins2_count || '?'}</b></div>
          <div>crafted models</div>
        </div>
        <input type="hidden" name="craft[]" value="${k}">
      </div>`
    }).join('');

    let dragToReorder = count > 1 ? `<div class="gs-rollout-gallery-help">Drag to reorder</div>` : '';

    let $popup = $(
    `<div class="popup-container hide alert-popup-container">
      <form class="popup-no-close gs-layer-popup gs-layer-popup-rollout">
        <div class="gs-layer-header">Put Gifts on Sale</div>
        <p>Do you want to put <b>${Object.keys(Aj.state.actions).length} gift(s)</b> on sale?</p>
        <div class="gs-rollout-gallery">
          <ul class="gs-rollout-gift-grid">
            ${saleGridHtml}
          </ul>
          ${dragToReorder}
          ${upgradeListHtml}
          ${craftListHtml}
        </div>
        <div class="popup-buttons">
          <div class="popup-button cancel-form-btn popup-cancel-btn">Cancel</div>
          <button type="submit" class="popup-button submit-form-btn">Roll Out</button>
        </div>
      </form>
    </div>`);

    $('.gs-rollout-gift-grid', $popup).sortable().disableSelection();
    $('.js-lottie', $popup).each((_, el) => RLottie.init(el, {playOnce: true}));
    let $form = $('form', $popup).on('submit', preventDefault);
    $('.submit-form-btn', $popup).on('click', (e) => {
      let $btn = $(e.target);
      $btn.prop('disabled', true);

      let data = $form.serializeArray().reduce((o, field) => {
        if (field.name === 'sale[]') {
          o.sale.push(field.value)
        }
        if (field.name === 'upgrade[]') {
          o.upgrade.push(field.value)
        }
        if (field.name === 'craft[]') {
          o.craft.push(field.value)
        }
        return o;
      }, {sale: [], upgrade: [], craft: []});

      Aj.apiRequest('rollOutChanges', data, function (result) {
        if (result.error) {
          return showAlert(result.error);
        }
        if (result.ok) {
          Aj.location('/');
        }
      });
    });

    openPopup($popup, {
      closeByClickOutside: '.popup-no-close'
    });
  }
};

var Gift = {
  init() {
    let container = Aj.ajContainer;

    Aj.onLoad(state => {
      state.$form = $('#collection_form');
      state.$form.on('submit', preventDefault);
      state.$form.on('input', () => {
        state.hasChanges = true
      });
      $('.gs-collection-form-submit', state.$form).on('click', Gift.eSubmitForm);
      $('.gs-delete-button', container).on('click', Gift.eClickDelete);

      $('#skins_list', container).on('input', '.skin-row-prob input', () => Gift.updateCounts('skins'));
      $('#skins2_list', container).on('input', '.skin-row-prob input', () => Gift.updateCounts('skins2'));
      $('#symbols_list', container).on('input', '.skin-row-prob input', () => Gift.updateCounts('symbols'));
      $('#backdrops_list', container).on('input', '.skin-row-prob input', () => Gift.updateCounts('backdrops'));
      $('#statusDropdown').on('click', '.dropdown-menu-item', Gift.updateStatusDropdown);
      
      $('input[name="title"]').on('input', Gift.updateShortName);

      $('#f-released-by').on('change', Gift.updateReleasedBy)

      $('#emoji_url').on('input', Gift.maybeUpdateStickerPicker);

      $('.skins-url-field').on('keypress', function(e) {
        if (e.key === 'Enter') {
          Gift.updateSkins($(this).parents('.gs-skins-wrap'));
        };
      });
      $('.update-skins-button').on('click', function(e) {
        Gift.updateSkins($(this).parents('.gs-skins-wrap'));
      });

      $('.gs-csv-import').on('change', Gift.eChangeCSV);
      $('.gs-sticker-picker').on('click', 'button[data-doc-id]', Gift.setGiftDocRaw);
      $('.gs-nft-cover-btn').on('click', Gift.eNftCoverClick);

      Gift.randomizeGift();

      $('.gs-skins-list').on('click', '.skins-row img', el => {
        var skin_id = el.currentTarget.closest('.skins-row').id.substr(5);
        var old = state.curGiftPreview;
        Gift.setGiftPreview(skin_id, old.pattern_id, old.backdrop_id);
      })

      if (Aj.state.readOnly) {
        $('input', state.$form).prop('readonly', true);
        $('.gs-label-action').hide();

        if (!Aj.state.readOnlyNft) {
          $('[name=released_by_name]').prop('readonly', false);
          $('[name=nft_title]').prop('readonly', false);
        }

        if (!Aj.state.readOnlyCraft) {
          $('#gift_skins2 input', state.$form).prop('readonly', false);
          $('#gift_skins2 .gs-label-action').show();
        }
      }

      if (!Aj.state.draft_id) {
        Gift.autofillBackdrops();
        Aj.state.hasChanges = false;
      }

      Aj.onBeforeUnload(() => {
        if (Aj.state.hasChanges) return 'You have unsaved changes, are you sure you want to leave this page?';
        return false;
      })

      Gift.maybeUpdateStickerPicker();
      Gift.initLottie();
    });

    Aj.onUnload(() => {
      $('.js-lottie').each((i, el) => RLottie.destroy(el));
    });
  },

  updateReleasedBy() {
    var $input = $('#f-released-by');
    var $message = $('#f-released-by + .gs-form-control-msg');
    var $preview = $('#released-by-photo');
    var username = $input.val();
    
    $message.html('');
    $preview.html('');

    if (!username?.length) {
      $input.toggleClass('error', false);
      $('input[name=released_by_name]').val('').closest('.form-group').toggleClass('hidden', true);
      return;
    }

    Aj.apiRequest('lookupUsername', {username: username}, function (res) {
      if (res.ok) {
        $input.toggleClass('error', false);
        this.value = $input.val(res.username);
        $preview.attr('href', res.username.replace('@', 'https://t.me/'));

        $('input[name=released_by_name]').val(res.name).closest('.form-group').toggleClass('hidden', false);

        if (res.photo_url) {
          $preview.html(`<img src="${res.photo_url}"><div class="gs-tooltip">${res.name}</div>`);
        }
      }
      if (res.error) {
        $input.toggleClass('error', true);
        $message.html(res.error);
      }
    });
  },

  updateShortName() {
    const shortName = $('input[name="title"]').val().replaceAll(/[^a-z0-9]+/ig, '');
    $('input[name="slug"]').val(shortName);
  },

  eChangeCSV(e) {
    let $skins_wrap = $(this).parents('.gs-skins-wrap');
    let $skins_list = $('.gs-skins-list', $skins_wrap);
    let data_key = $skins_wrap.attr('data-key');
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const csv = e.target.result;
      
      var csvData = GiftStudio.parseCsv(csv);
      
      if (!csvData || !csvData.length) {
        return showAlert('Error parsing CSV');
      }

      if (csvData[0][1].length > 1) {
        $('#f-gift-name').val(csvData[0][1]);
        Gift.updateShortName();
      };

      $('.skin-row-name', $skins_list).each(function (i) {
        if (csvData[i + 1]) {
          this.value = csvData[i + 1][1] || '';
        } else {
          this.value = '';
        }
      });

      $('.skin-row-prob input', $skins_list).each(function (i) {
        if (csvData[i + 1]) {
          this.value = Number(csvData[i + 1][0]) || '';
        } else {
          this.value = '';
        }
      });

      Gift.updateCounts(data_key);

    };
    reader.readAsText(file);
  },

  eChangeCover(e) {
    const file = e.target.files[0];

    Aj.uploadRequest('uploadNftCover', file, {}, res => {
      if (res.error) {
        showAlert(res.error);
        return;
      }
      if (res.file_address) {
        $('#nft_cover').val(res.file_address);
        $('.gs-nft-cover-btn').html(`<img src="/file/${res.file_address}">`);
      }
    });
  },

  eNftCoverClick(e) {
    var $input = $('#nft_cover');

    if ($input.val()) {
      $input.val('');
      $('.gs-nft-cover-btn').html('');

      Aj.state.hasChanges = true;
      
      e.preventDefault();
    } else {
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.webp';
      fileInput.onchange = Gift.eChangeCover;
      fileInput.click();
    }
  },

  eSubmitForm() {
    Aj.state.hasChanges = false;
    let data = Aj.state.$form.serializeArray().reduce((o, field) => {
      let components = field.name.match(/(^[^[]+|\[.*?\])/g);

      if (components.length == 0) return o;
      if (components.length == 1) {
        o[components[0]] = field.value;
        return o;
      }

      let current = o;
      let fieldName = components[0];
      
      if (!current[fieldName]) {
          current[fieldName] = {};
      }
      current = current[fieldName];
      
      for (let i = 1; i < components.length - 1; i++) {
          let key = components[i].slice(1, -1); // Remove [ and ]
          if (!current[key]) {
              current[key] = {};
          }
          current = current[key];
      }
      
      let lastKey = components[components.length - 1].slice(1, -1);
      current[lastKey] = field.value;
      return o;
    }, {});

    Aj.apiRequest('saveCollection', data, function (result) {
      if (result.errors) {
        Gift.updateErrors(result.errors);
      }
      if (result.redirect_to) {
        Aj.location(result.redirect_to);
      }
    });
  },
  eClickDelete() {
    let body = {
      draft_id: Aj.state.draft_id
    }

    if (!Aj.state.$deletePopup) {
      Aj.state.$deletePopup = $(`
        <div class="popup-container hide alert-popup-container">
          <div class="popup-no-close gs-layer-popup">
            <div class="gs-layer-header">Delete Draft</div>
            <p>Do you to delete this collection?</p>
            <div class="popup-buttons">
              <div class="popup-button cancel-form-btn popup-cancel-btn">Cancel</div>
              <button type="submit" class="popup-button submit-form-btn">Delete</button>
            </div>
          </div>
        </div>
      `);

      $('.submit-form-btn', Aj.state.$deletePopup).on('click', () => {
        Aj.apiRequest('deleteCollection', body, function (result) {
          if (result.error) {
            return showAlert(result.error);
          }
          if (result.redirect_to) {
            Aj.location(result.redirect_to);
          }
        });
      })
    }

    openPopup(Aj.state.$deletePopup, {
      closeByClickOutside: '.popup-no-close'
    })
  },
  updateErrors(items) {
    var html = items.map(item => `<li>${item}</li>`).join('')

    $('.gs-error-banner ul').html(html);
  },
  updateStatusDropdown: function(e) {
    const value = this.dataset.value;
    $('#statusDropdown .secondary-button').text('Status: ' + {'draft': 'Draft', 'craft_ready': 'Ready for Craft', 'upgrade_ready': 'Ready for Upgrade', 'sale_ready': 'Ready for Sale'}[value]);
    $('#statusDropdown input').val(value);
  },
  updateCounts(key) {
    if (!['skins', 'skins2', 'backdrops', 'symbols'].includes(key)) return;

    var container = `#${key}_list`;
    var totalProbText = `#${key}TotalProb`;
    var countText = `#${key}Count`;

    let count = 0;
    let sum = 0;
    let max_val = null;
    $(container + ' .skin-row-prob input').each((i, el) => {
      let val = Number(el.value);
      count++;
      sum += val;
      if (max_val === null || max_val < val) {
        max_val = val;
      }
    });
    $(totalProbText).text(sum).toggleClass('warn', count > 0 && sum != 1000);
    $(countText).text(count + ' items');
    if (key == 'skins2') {
      $(container + ' .skins-row').each((i, el) => {
        let input = $('.skin-row-prob input', el);
        let val = Number(input.value());
        let badge = Gift.getBadge(val, max_val);
        let badge_class = badge ? ' badge-' + badge : '';
        $('.skin-row-badge', el).text(badge).attr('class', 'skin-row-badge' + badge_class);
      });
    }
  },
  getBadge: function (val, max_val) {
    if (val <= 0) return '';
    let next_val = max_val / 2;
    const badges = ['uncommon', 'rare', 'epic', 'legendary'];
    for (var i = 0; i < badges.length; i++) {
      if (val > next_val) {
        return badges[i];
      }
      next_val /= 2;
    }
    return badges[i - 1];
  },
  updateSkinsTable: function ($skins_wrap, stickers) {
    const new_docs = stickers;
    $('.skins-url-field', $skins_wrap).toggleClass('active', true);
    $('.gs-file-input-label', $skins_wrap).toggleClass('hidden', false);
    let data_key = $skins_wrap.attr('data-key');

    const count = new_docs.length;
    const low_price = Math.floor((1000 / count) / 5) * 5;
    const high_price = low_price + 5;
    const count_low = (high_price * count - 1000) / 5;

    var $skins_list = $('.gs-skins-list', $skins_wrap);
    var old_skins = $('.skins-row', $skins_list).toArray().map(el => {
      return {
        name: $('.skin-row-name', el).val(),
        chance: $('.skin-row-prob input', el).val(),
      }
    });
    var new_skins = stickers.reduce((o, raw, i) => {
      o[raw] = old_skins[i] || {name: '', chance: ''};
      return o;
    }, {});

    Aj.state.GiftSamples[data_key] = new_skins;

    let html = new_docs.map((doc_id, i) => {
      var prob = new_skins[doc_id].chance || (i < count_low ? low_price : high_price);
      return `<div class="skins-row" id="skin-${doc_id}">
        <img src="/emoji/${doc_id}.webp?xieworld_vf">
      <input placeholder="Name ${i}" class="skin-row-name" name="${data_key}[${doc_id}][name]" value="${new_skins[doc_id].name}">
      <span class="skin-row-badge"></span>
      <label class="skin-row-prob">
        <input type="number" min="0" max="1000" step="1" class="skin-row-prob" placeholder="0" name="${data_key}[${doc_id}][chance]" value=
          "${prob}"
        >
      </label>
    </div>`
    }).join('');
    html += `<div class="gs-row-total">
              <span id="${data_key}Count">${count} items</span>
              <span id="${data_key}TotalProb">1000</span>
            </div>`;

    $skins_list.html(html);
    $('.skin-row-prob input', $skins_list).on('input', () => Gift.updateCounts(data_key));
    $('.preview-skins-container').toggleClass('show-placeholder', false);
    Gift.updateCounts(data_key);
    Gift.randomizeGift();
  },

  autofillSymbols() {
    Aj.state.hasChanges = true;
    let sample_counts = $('.symbol-groups-grid input[data-name]').map((i, el) => ({name: el.dataset.name, val: Number(el.value)})).toArray();
    let total_count = sample_counts.reduce((t, c) => t + c.val, 0);
    let is_safe = $('input[name="safe_symbols"]').is(':checked');

    let keys = Object.keys(Aj.state.GiftSamples.patterns);
    if (is_safe) {
      keys = Aj.state.safePatterns;
    }
    GiftStudio.shuffleArray(keys);

    let selected = {};
    for (sample_count of sample_counts) {
      let {name: cat, val: cnt} = sample_count;

      let i = 0;
      while (cnt > 0) {
        const key = keys[i % keys.length];
        const pattern = Aj.state.GiftSamples.patterns[key];
        let times_included = selected[key] ?? 0;
        if (pattern.cat.includes(cat) && times_included <= i / keys.length) {
          selected[key] = times_included + 1;
          cnt--;
        }
        i++;
      }
    }

    let results = Object.entries(selected).sort((a,b) => b[1]-a[1]);
    let html = [];

    let distribution = GiftStudio.generateSteppedDistribution(total_count);
    let ptr = 0;
    GiftStudio.shuffleArray(distribution);

    results.forEach((entry, i) => {
      let prob = 0;
      for (let i = 0; i < entry[1]; i++) {
        prob += distribution[ptr++];
      }

      html.push(Gift.symbolRow(Aj.state.GiftSamples.patterns[entry[0]], entry[0], prob));
    });

    if (!html.length) html = ['<div style="padding: 4px 12px">No entries</div>']

    $('#symbols_list').html(html.join(''));

    $('#symbols_list .skin-row-prob input', Aj.ajContainer).on('input', () => Gift.updateCounts('symbols'));
    
    Gift.updateCounts('symbols');
    Gift.randomizeGift();
  },

  symbolRow(pattern, pattern_id, value) {
    return `<div class="skins-row" id="#pattern-${pattern_id}" data-pattern-id="${pattern_id}">
      <img src="${pattern.url}">
      <span disabled class="skin-row-name">${pattern.name}</span>
      <label class="skin-row-prob">
        <input type="number" min="0" max="1000" step="1" placeholder="0" value="${value}" name="symbols[${pattern_id}]">
      </label>
    </div>`
  },

  autofillBackdrops() {
    Aj.state.hasChanges = true;
    let prob_inputs = $('#backdrops_list .skin-row-prob input').toArray();
    GiftStudio.shuffleArray(prob_inputs);
    let f100_80 = (i) => {
      if (i < 22) return 10;
      if (i < 22 + 30) return 12;
      if (i < 22 + 30 + 28) return 15;
      return 0;
    }
    for (let i = 0; i < prob_inputs.length; i++) {
      prob_inputs[i].value = f100_80(i);
    }
    Gift.updateCounts('backdrops');
  },

  setGiftPreview(skin_id, pattern_id, backdrop_id) {
    const pattern = Aj.state.GiftSamples.patterns[pattern_id];
    const backdrop = Aj.state.GiftSamples.backdrops[backdrop_id];
    const skins = Aj.state.GiftSamples.skins;
    const skins2 = Aj.state.GiftSamples.skins2;

    let skin_html = GiftStudio.renderSticker(skin_id);
    $('.skin-model-preview .js-lottie').each(function(){ RLottie.destroy(this); });
    $('.skin-model-preview').html(skin_html);

    Gift.initLottie();

    $('#giftPattern').attr('xlink:href', pattern.url).detach().appendTo('#giftDefs');
    
    $('#giftGradientCenterColor').attr('stop-color', '#' + backdrop.ccolor);
    $('#giftGradienEdgeColor').attr('stop-color', '#' + backdrop.ecolor);
    $('#giftGradienPatternColor').attr('flood-color', '#' + backdrop.pcolor);
    $('#giftGradientText').attr('fill', '#' + backdrop.tcolor);

    Aj.state.curGiftPreview = {
      skin_id,
      pattern_id,
      backdrop_id,
    };

    let skinData = skins2?.[skin_id] || skins?.[skin_id] || {};

    $('.preview-info').html(`<div>
      <b>Model</b>
      <a href="#skin-${skin_id}">${skinData.name || '[Empty Name]'}</a>
    </div>
    <div>
      <b>Backdrop</b>
      <a href="#bd-${backdrop_id}">${backdrop.name}</a>
    </div>
    <div>
      <b>Symbol</b>
      <a href="#pattern-${pattern_id}">${pattern.name}</a>
    </div>`)
  },
  
  randomizeGift() {
    let skins = {};
    $('#skins_list .skins-row').each((i, el) => {
      const doc_id = el.id.substring(5);
      skins[doc_id] = {
        name: $('.skin-row-name', el).val(),
        chance: $('.skin-row-prob', el).val()
      } 
    });
    if ($.isEmptyObject(skins)) return;
    const skin_id = GiftStudio.randomProperty(skins);

    let pattern_selection = $('#symbols_list .skins-row').toArray().map(el => el.dataset.patternId);
    let pattern_idx = pattern_selection.length * Math.random() << 0;
    const pattern_id = pattern_selection[pattern_idx];
    
    const backdrop_id = Aj.state.GiftSamples.backdrops.length * Math.random() << 0;
    
    Gift.setGiftPreview(skin_id, pattern_id, backdrop_id);
  },
  parsePackUrl: function (url) {
    var slug = url?.match(/(addemoji|addstickers)\/(.+)/)?.[2];
    if (!slug) {
      slug = url?.match('[a-zA-Z0-9_-]+')?.[0];
    }
    return slug;
  },
  updateSkins: function ($skins_wrap) {
    let $field = $('.skins-url-field', $skins_wrap);
    let slug = Gift.parsePackUrl($field.val());
    if (!slug) return;
    let res = Aj.apiRequest('lookupEmojiset', {slug: slug}, function (result) {
      if ($.isEmptyObject(result.stickers)) return;
      Gift.updateSkinsTable($skins_wrap, result.stickers);
    });
  },
  updateBackground: function (el) {
    let bgid = el.value;
    let auction_bg = Aj.state.auctionBackgrounds[bgid] || null;
    let prev = $('#preview');
    if (auction_bg) {
      prev.cssProp('--ccolor', '#' + auction_bg.ccolor);
      prev.cssProp('--ecolor', '#' + auction_bg.ecolor);
      prev.cssProp('--tcolor', '#' + auction_bg.tcolor);
    } else {
      prev.cssProp('--ccolor', null);
      prev.cssProp('--ecolor', null);
      prev.cssProp('--tcolor', null);
    }
  },
  initLottie: function () {
    $('.js-lottie').each((i, el) => {
      RLottie.init(el, {playOnce: true});
    })
  },
  maybeUpdateStickerPicker: function () {
    var slug = Gift.parsePackUrl($('#emoji_url').val());
    if (!slug) {
      return;
    }

    var debounce = setTimeout(() => {
      if (debounce != Aj.state.stickerPickerDebounce) return;
      Aj.apiRequest('lookupEmojiset', {slug: slug}, function (result) {
        Gift.updateStickerPicker(result.stickers);
        Gift.updateActive();
      });
    }, 400);
    Aj.state.stickerPickerDebounce = debounce;
  },
  updateStickerPicker: function (stickers) {
    let el = $('.gs-sticker-picker');
    if ($.isEmptyObject(stickers)) {  
      el.toggleClass('hidden', true);
      $('#emoji_url').toggleClass('active', false);
      return;
    }
    el.toggleClass('hidden', false);
    $('#emoji_url').toggleClass('active', true);
    el.empty();
    stickers.forEach(doc_id => {
      $('.gs-sticker-picker').append('<button type="button" data-doc-id="' + doc_id + '"><img src="/emoji/' + doc_id + '.webp"></button>')
    })
  },
  setGiftDocRaw: function () {
    if ($('#emoji_url').attr('readonly')) return;
    var btn = this;
    $('#doc_id').val(btn.dataset.docId);
    document.activeElement.blur();
    Gift.updateActive();
    let html = `<div id="preview">${GiftStudio.renderSticker(btn.dataset.docId)}</div>`;
    let prev = $('#preview');
    $('#preview .js-lottie').each(el => RLottie.destroy(el));
    $(html).insertAfter(prev);
    prev.remove();
    Gift.initLottie();
  },
  updateActive: function () {
    let did = $('#doc_id').val();
    $('.button-active').toggleClass('button-active', false);
    $(`.gs-sticker-picker button[data-doc-id="${did}"]`).toggleClass('button-active', true);
  }
};

var GiftStudio = {
  parseCsv: function (text) {
    const lines = text.split('\n');
    const result = [];
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        const row = [];
        let cell = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(cell.trim());
                cell = '';
            } else {
                cell += char;
            }
        }
        
        row.push(cell.trim());
        result.push(row);
    }
    
    return result;
  },
  generateSteppedDistribution: function (totalOutcomes, numSteps = 3, maxRatio = 2.5, biasStrength = 0.4) {
    const stepWeights = [];
    for (let i = 0; i < numSteps; i++) {
        const baseWeight = 1.0;
        const biasWeight = Math.pow(i / (numSteps - 1), 1 + biasStrength * 2);
        stepWeights.push(baseWeight + biasWeight);
    }
    
    const totalWeight = stepWeights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = stepWeights.map(w => w / totalWeight);
    
    const outcomesPerStep = [];
    let remainingOutcomes = totalOutcomes;
    
    for (let i = 0; i < numSteps - 1; i++) {
        let count = Math.round(totalOutcomes * normalizedWeights[i]);
        count = Math.min(count, remainingOutcomes);
        outcomesPerStep.push(count);
        remainingOutcomes -= count;
    }
    outcomesPerStep.push(remainingOutcomes);
    
    for (let i = 0; i < numSteps; i++) {
        if (outcomesPerStep[i] === 0) {
            const maxIdx = outcomesPerStep.indexOf(Math.max(...outcomesPerStep));
            if (outcomesPerStep[maxIdx] > 1) {
                outcomesPerStep[maxIdx]--;
                outcomesPerStep[i] = 1;
            }
        }
    }
    
    const baseProb = 1000 / totalOutcomes;
    const probLevels = [];
    for (let i = 0; i < numSteps; i++) {
        const ratio = 1.0 + (maxRatio - 1.0) * (i / (numSteps - 1));
        probLevels.push(baseProb * ratio);
    }
    
    const totalProbWeight = probLevels.reduce((sum, prob, i) => sum + prob * outcomesPerStep[i], 0);
    const normalizationFactor = 1000 / totalProbWeight;
    const normalizedProbLevels = probLevels.map(p => p * normalizationFactor);
    
    const distribution = [];
    for (let i = 0; i < numSteps; i++) {
        const probValue = Math.round(normalizedProbLevels[i]);
        for (let j = 0; j < outcomesPerStep[i]; j++) {
            distribution.push(probValue);
        }
    }
    
    const currentSum = distribution.reduce((sum, val) => sum + val, 0);
    const diff = 1000 - currentSum;
    
    if (diff !== 0) {
        for (let i = 0; i < Math.abs(diff); i++) {
            const idx = i % distribution.length;
            distribution[idx] += diff > 0 ? 1 : -1;
        }
    }
    
    return distribution;
  },
  renderSticker: function (docId) {
    return `<picture class="js-lottie" autoplay="" playonce="" playbyclick="" onclick="RLottie.playOnce(this)">
      <source type="application/x-tgsticker" srcset="/file/tgs/${docId}">              
    </picture>`;
  },
  randomProperty: function (obj) {
    var keys = Object.keys(obj);
    return keys[ keys.length * Math.random() << 0];
  },
  shuffleArray: function(array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  },
};

function fuzzyMatch(needle, haystack) {
  if (!needle) {
    return true;
  }
  if (!haystack) {
    return false;
  }
  var needle = needle.toLowerCase();
  var haystack = haystack.toLowerCase();
  for (var i = 0, j = 0; j < haystack.length; j++) {
    if (needle[i] === haystack[j]) {
      i++;
    }
    if (i === needle.length) {
      return true;
    }
  }
  return false;
}
