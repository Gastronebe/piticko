/*
 * Pitíčko – hlavní logika aplikace (UI, obrazovky, toky).
 */
(function () {
  'use strict';
  var P = self.P, t = P.t, U = P.U, h = U.h, DB = P.DB;
  var Charts = P.Charts, X = P.Exporter, N = P.Notify, R = P.Reminders, I = P.Install;

  var state = {
    settings: null,
    today: U.todayKey(),
    view: 'today',
    statsDay: null,
    statsWeekEnd: null,
    statsMonth: null,
    undo: null,
    midnightTimer: null
  };
  function $(sel) { return document.querySelector(sel); }
  function cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }
  function fmtTimeShort(hhmm) { return hhmm.replace(/^0(\d)/, '$1'); }
  function save() { return DB.saveSettings(state.settings); }

  // =========================================================
  // Vzhled (světlý / tmavý)
  // =========================================================
  var darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  var reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('piticko-theme', theme); } catch (e) { /* ignore */ }
    updateThemeColor();
  }
  function updateThemeColor() {
    var th = document.documentElement.getAttribute('data-theme');
    var dark = th === 'dark' || (th !== 'light' && darkMQ.matches);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', dark ? '#141B26' : '#F5F0E6');
  }
  if (darkMQ.addEventListener) darkMQ.addEventListener('change', updateThemeColor);
  else if (darkMQ.addListener) darkMQ.addListener(updateThemeColor);

  // =========================================================
  // Toast a dialogy
  // =========================================================
  var toastTimer = null;
  function toast(msg, action) {
    var el = $('#toast');
    el.textContent = '';
    el.appendChild(h('span', { class: 'toast-msg' }, msg));
    if (action) {
      el.appendChild(h('button', {
        type: 'button', class: 'toast-btn',
        onclick: function () { hideToast(); action.fn(); }
      }, action.label));
    }
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 5000 : 3000);
  }
  function hideToast() {
    var el = $('#toast');
    el.classList.remove('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 220);
  }

  var modalSeq = 0;
  function modal(o) {
    return new Promise(function (resolve) {
      var id = 'modal-title-' + (++modalSeq);
      var err = h('p', { class: 'form-error', role: 'alert', hidden: true });
      var form = h('form', { method: 'dialog', novalidate: true },
        h('h2', { class: 'modal-title', id: id }, o.title),
        o.text ? h('p', { class: 'modal-text' }, o.text) : null,
        o.body || null,
        err,
        h('div', { class: 'modal-actions' }, o.actions.map(function (a) {
          return h('button', { type: 'submit', value: a.value, class: 'btn btn-' + (a.kind || 'secondary') }, a.label);
        }))
      );
      var dlg = h('dialog', { class: 'modal ' + (o.className || ''), 'aria-labelledby': id }, form);
      form.addEventListener('submit', function (e) {
        var v = e.submitter ? e.submitter.value : (o.actions[0] && o.actions[0].value);
        var a = o.actions.filter(function (x) { return x.value === v; })[0];
        if (a && a.validate) {
          var msg = a.validate();
          if (msg) { e.preventDefault(); err.textContent = msg; err.hidden = false; }
        }
      });
      dlg.addEventListener('close', function () {
        var v = dlg.returnValue;
        dlg.remove();
        resolve(v);
      });
      document.body.appendChild(dlg);
      dlg.returnValue = '';
      dlg.showModal();
      if (o.focus) setTimeout(function () { o.focus.focus(); }, 60);
    });
  }

  function info(title, text, extraActions) {
    return modal({ title: title, text: text, actions: (extraActions || []).concat([{ label: t('common.close'), value: 'close', kind: extraActions ? 'secondary' : 'primary' }]) });
  }

  function numberField(label, value, min, max, id) {
    var input = h('input', {
      type: 'number', inputmode: 'numeric', min: min, max: max, step: 1, id: id,
      class: 'input', autocomplete: 'off', value: value == null ? '' : String(value)
    });
    return { wrap: h('div', { class: 'field' }, h('label', { class: 'field-label', for: id }, label), input), input: input };
  }
  function timeField(label, value, id) {
    var input = h('input', { type: 'time', id: id, class: 'input', value: value, step: 60 });
    return { wrap: h('div', { class: 'field' }, h('label', { class: 'field-label', for: id }, label), input), input: input };
  }
  function readInt(input, min, max) {
    var v = String(input.value).trim();
    if (!/^\d+$/.test(v)) return null;
    var n = parseInt(v, 10);
    return n >= min && n <= max ? n : null;
  }

  // =========================================================
  // Ikony (inline SVG)
  // =========================================================
  function icon(name) {
    var paths = {
      edit: 'M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
      trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
      left: 'M15 5l-7 7 7 7',
      right: 'M9 5l7 7-7 7',
      share: 'M12 3v12M7 8l5-5 5 5M5 13v7h14v-7',
      download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
      close: 'M6 6l12 12M18 6L6 18',
      sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
      moon: 'M20 14.5A7.5 7.5 0 0 1 9.5 4a7.5 7.5 0 1 0 10.5 10.5z',
      auto: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18'
    };
    return U.s('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true' },
      U.s('path', { d: paths[name], fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }

  /** Mikrointerakce: kapka vyskočí z razítkového tlačítka směrem k nádobě (do 350 ms). */
  function flyDropFromButton(btn) {
    if (!btn || (reducedMotionMQ && reducedMotionMQ.matches)) return;
    var vesselEl = document.querySelector('.vessel');
    if (!vesselEl) return;
    var bRect = btn.getBoundingClientRect();
    var vRect = vesselEl.getBoundingClientRect();
    var startX = bRect.left + bRect.width / 2;
    var startY = bRect.top + bRect.height / 2;
    var dx = (vRect.left + vRect.width / 2) - startX;
    var dy = (vRect.top + vRect.height * 0.55) - startY;

    var drop = U.s('svg', {
      viewBox: '0 0 24 28',
      class: 'fly-drop',
      'aria-hidden': 'true'
    }, U.s('path', {
      d: 'M12 2 C6 10, 3 15, 3 19 a9 9 0 0 0 18 0 C21 15, 18 10, 12 2 Z'
    }));
    drop.style.left = (startX - 12) + 'px';
    drop.style.top = (startY - 14) + 'px';
    document.body.appendChild(drop);

    requestAnimationFrame(function () {
      drop.style.transform = 'translate3d(' + Math.round(dx) + 'px, ' + Math.round(dy) + 'px, 0) scale(0.45)';
      drop.style.opacity = '0';
    });
    setTimeout(function () { drop.remove(); }, 340);
  }

  // =========================================================
  // Záznamy: přidání, úprava, smazání se „Zpět“
  // =========================================================
  function addAmount(amount, ts, sourceBtn) {
    if (sourceBtn) {
      sourceBtn.classList.add('is-stamped');
      flyDropFromButton(sourceBtn);
    }
    return DB.addEntry(amount, ts, state.settings).then(function (entry) {
      refresh();
      toast(t('today.added', { amount: U.fmtMl(amount) }), {
        label: t('common.undo'),
        fn: function () { DB.deleteEntry(entry.id).then(refresh); }
      });
    });
  }

  function addDialog() {
    var amt = numberField(t('amount.label'), '', 1, 2000, 'f-amount');
    var time = timeField(t('entry.time'), U.timeOf(Date.now()), 'f-time');
    return modal({
      title: t('entry.addTitle'),
      body: [amt.wrap, time.wrap],
      focus: amt.input,
      actions: [
        { label: t('common.save'), value: 'save', kind: 'primary', validate: function () {
          if (readInt(amt.input, 1, 2000) == null) return t('amount.invalidEntry');
          if (!U.isValidTime(time.input.value)) return t('entry.time');
          return null;
        } },
        { label: t('common.cancel'), value: 'cancel' }
      ]
    }).then(function (v) {
      if (v !== 'save') return;
      var day = state.today;
      return addAmount(readInt(amt.input, 1, 2000), U.timestampFor(day, time.input.value));
    });
  }

  function editDialog(entry) {
    var amt = numberField(t('amount.label'), entry.amountMl, 1, 2000, 'f-amount');
    var time = timeField(t('entry.time'), U.timeOf(entry.timestamp), 'f-time');
    return modal({
      title: t('entry.editTitle'),
      body: [amt.wrap, time.wrap],
      actions: [
        { label: t('common.save'), value: 'save', kind: 'primary', validate: function () {
          if (readInt(amt.input, 1, 2000) == null) return t('amount.invalidEntry');
          if (!U.isValidTime(time.input.value)) return t('entry.time');
          return null;
        } },
        { label: t('common.cancel'), value: 'cancel' }
      ]
    }).then(function (v) {
      if (v !== 'save') return;
      var updated = Object.assign({}, entry, {
        amountMl: readInt(amt.input, 1, 2000),
        timestamp: U.timestampFor(entry.date, time.input.value)
      });
      return DB.updateEntry(updated).then(function () { refresh(); toast(t('entry.saved')); });
    });
  }

  function removeEntry(entry) {
    return DB.deleteEntry(entry.id).then(function (deleted) {
      refresh();
      if (!deleted) return;
      if (state.undo) clearTimeout(state.undo.timer);
      var u = { entry: deleted };
      u.timer = setTimeout(function () { if (state.undo === u) state.undo = null; }, 5000);
      state.undo = u;
      toast(t('today.deleted'), {
        label: t('common.undo'),
        fn: function () {
          if (state.undo !== u) return;
          clearTimeout(u.timer);
          state.undo = null;
          DB.restoreEntry(u.entry).then(refresh);
        }
      });
    });
  }

  // =========================================================
  // Obrazovka: Dnes
  // =========================================================
  function setTitle(title, sub) {
    var vt = $('#view-title');
    vt.textContent = title;
    vt.setAttribute('data-text', title);
    $('#view-sub').textContent = sub || '';
    document.title = title + ' · ' + t('app.name');
  }

  function statusBadge(st) {
    var map = {
      ok: ['✓', t('today.stateOk')],
      near: ['!', t('today.stateNear')],
      over: ['!!', t('today.stateOver')],
      reached: ['✓', t('today.goalReached')]
    };
    var m = map[st];
    if (!m) return null;
    return h('p', { class: 'badge is-' + st }, h('span', { class: 'badge-icon', 'aria-hidden': 'true' }, m[0]), ' ', m[1]);
  }

  function statusCard(total, goal) {
    var s = state.settings;
    var card = h('section', { class: 'card status-card', 'aria-live': 'polite' });
    var settingsBtn = h('a', { href: '#/settings', class: 'btn btn-secondary btn-small' }, t('today.openSettings'));

    if (s.mode === 'limit') {
      if (!goal) {
        card.appendChild(Charts.vessel(0, 'neutral', U.fmtNum(total), t('today.gaugeDrunk')));
        card.appendChild(h('div', { class: 'status-text' },
          h('p', { class: 'status-main' }, t('today.drunk', { total: U.fmtMl(total) })),
          h('p', { class: 'muted' }, t('today.noLimit')), settingsBtn));
        return card;
      }
      var st = R.limitState(total, goal);
      var over = total > goal;
      // V režimu omezení výplň ukazuje zbývající množství; při překročení se nádoba jemně přelije.
      var remRatio = over ? 1 : Math.max(0, (goal - total) / goal);
      card.appendChild(Charts.vessel(remRatio, st,
        over ? '+' + U.fmtNum(total - goal) : U.fmtNum(goal - total),
        over ? t('today.gaugeOver') : t('today.gaugeLeft')));
      card.appendChild(h('div', { class: 'status-text' },
        h('p', { class: 'status-main' }, over
          ? t('today.over', { over: U.fmtMl(total - goal) })
          : t('today.remaining', { left: U.fmtMl(goal - total), limit: U.fmtMl(goal) })),
        statusBadge(st)));
      return card;
    }

    // Režim „Piju málo“: když cíl není zadán, nádoba je prázdná (0).
    if (!goal) {
      card.appendChild(Charts.vessel(0, 'neutral', U.fmtNum(total), t('today.gaugeDrunk')));
      card.appendChild(h('div', { class: 'status-text' },
        h('p', { class: 'status-main' }, t('today.drunk', { total: U.fmtMl(total) })),
        h('p', { class: 'muted' }, t('today.noGoal')),
        h('p', { class: 'note' }, t('today.noGoalNote')),
        settingsBtn));
      return card;
    }
    var reached = total >= goal;
    card.appendChild(Charts.vessel(total / goal, reached ? 'reached' : 'ok', U.fmtNum(total), t('today.gaugeDrunk')));
    card.appendChild(h('div', { class: 'status-text' },
      h('p', { class: 'status-main' }, t('today.goalProgress', { total: U.fmtMl(total), goal: U.fmtMl(goal) })),
      reached ? statusBadge('reached') : null));
    return card;
  }

  function quickButtons() {
    var grid = h('div', { class: 'quick-grid' });
    [200, 250, 500].forEach(function (ml, idx) {
      var btn = h('button', {
        type: 'button',
        class: 'btn btn-quick btn-stamp stamp-' + (idx + 1),
        onclick: function () { addAmount(ml, null, btn); }
      },
        h('span', { class: 'stamp-inner' }, U.fmtMl(ml))
      );
      grid.appendChild(btn);
    });
    grid.appendChild(h('button', {
      type: 'button',
      class: 'btn btn-quick btn-stamp btn-quick-custom stamp-4',
      onclick: addDialog
    }, h('span', { class: 'stamp-inner' }, t('today.custom'))));
    return h('section', { class: 'quick', 'aria-labelledby': 'quick-h' },
      h('h2', { class: 'section-title', id: 'quick-h' }, t('today.quickTitle')), grid);
  }

  function entriesList(entries, total) {
    var sec = h('section', { class: 'entries-sec', 'aria-labelledby': 'entries-h' },
      h('h2', { class: 'section-title', id: 'entries-h' }, t('today.entriesTitle')));
    if (!entries.length) {
      sec.appendChild(h('div', { class: 'empty-card' },
        Charts.emptyIllustration(),
        h('p', { class: 'empty-text' }, t('today.empty'))
      ));
      return sec;
    }
    var ul = h('ul', { class: 'entries' });
    entries.slice().reverse().forEach(function (e) {
      var time = U.timeOf(e.timestamp), amount = U.fmtMl(e.amountMl);
      ul.appendChild(h('li', { class: 'entry' },
        h('span', { class: 'entry-time' }, time),
        h('span', { class: 'entry-amount' }, amount),
        h('div', { class: 'entry-actions' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('today.editAria', { amount: amount, time: time }), onclick: function () { editDialog(e); } }, icon('edit')),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('today.deleteAria', { amount: amount, time: time }), onclick: function () { removeEntry(e); } }, icon('trash'))
        )
      ));
    });
    sec.appendChild(ul);
    sec.appendChild(h('p', { class: 'entries-total' }, t('today.total', { total: U.fmtMl(total) })));
    return sec;
  }

  function installBanner() {
    if (!I.shouldOffer()) return null;
    var ios = I.platform() === 'ios';
    return h('section', { class: 'card install-card' },
      h('p', { class: 'install-title' }, t('install.title')),
      h('p', { class: 'muted' }, t('install.text')),
      h('div', { class: 'row' },
        ios
          ? h('button', { type: 'button', class: 'btn btn-primary btn-small', onclick: iosGuide }, t('install.howBtn'))
          : h('button', { type: 'button', class: 'btn btn-primary btn-small', onclick: function () { I.prompt().then(refresh); } }, t('install.installBtn')),
        h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: function () { I.dismiss(); refresh(); } }, t('common.later'))));
  }

  function iosGuide() {
    var steps = [1, 2, 3].map(function (n) {
      return h('li', { class: 'ios-step' },
        h('img', { src: '/app/img/ios-step' + n + '.svg', alt: '', width: 280, height: 120, class: 'ios-step-img' }),
        h('p', null, t('install.iosStep' + n)));
    });
    return modal({ title: t('install.iosTitle'), body: h('ol', { class: 'ios-steps' }, steps), actions: [{ label: t('common.close'), value: 'close', kind: 'primary' }] });
  }

  function renderToday(main) {
    var s = state.settings, today = state.today;
    setTitle(t('today.title'), cap(U.fmtDateLong(today)));
    return Promise.all([DB.getEntriesByDate(today), DB.getDayGoal(today)]).then(function (res) {
      var entries = res[0];
      var goal = DB.resolveGoal(today, res[1], s);
      var total = entries.reduce(function (a, e) { return a + e.amountMl; }, 0);
      main.textContent = '';
      main.appendChild(statusCard(total, goal));
      var banner = installBanner();
      if (banner) main.appendChild(banner);
      main.appendChild(quickButtons());
      main.appendChild(entriesList(entries, total));
    });
  }

  // =========================================================
  // Obrazovka: Statistiky
  // =========================================================
  function statsSection(title, label, onPrev, onNext, nextDisabled) {
    var body = h('div', { class: 'stats-body' });
    var el = h('section', { class: 'card stats-sec' },
      h('div', { class: 'stats-head' },
        h('h2', { class: 'section-title' }, title),
        h('div', { class: 'stepper' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('common.prev'), onclick: onPrev }, icon('left')),
          h('span', { class: 'stepper-label' }, label),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('common.next'), onclick: onNext, disabled: nextDisabled }, icon('right')))),
      body);
    return { el: el, body: body };
  }

  function summaryList(days, prevDays, withCompare) {
    var mode = state.settings.mode;
    var sm = X.summarize(days, mode, state.today);
    if (!sm.recorded) return h('p', { class: 'muted' }, t('stats.noData'));
    var items = [];
    items.push(h('li', null, h('strong', null, t('stats.average', { avg: U.fmtMl(sm.avg) })), h('br'), h('span', { class: 'note' }, t('stats.averageNote'))));
    if (mode === 'limit') {
      items.push(h('li', null, sm.withGoal ? t('stats.daysInLimit', { n: sm.okDays, of: sm.withGoal }) : t('stats.limitNotSet')));
      if (sm.max) items.push(h('li', null, t('stats.highestDay', { date: U.weekdayShort(sm.max.date) + ' ' + U.fmtDateShort(sm.max.date), total: U.fmtMl(sm.max.total) })));
      if (withCompare) {
        var prev = X.summarize(prevDays, mode, state.today);
        var txt;
        if (prev.avg == null) txt = t('stats.compareNone');
        else {
          var diff = Math.round(sm.avg - prev.avg);
          txt = diff === 0 ? t('stats.compareSame') : t(diff < 0 ? 'stats.compareLess' : 'stats.compareMore', { diff: U.fmtMl(Math.abs(diff)) });
        }
        items.push(h('li', null, txt));
      }
    } else {
      if (sm.withGoal) {
        items.push(h('li', null, t('stats.goalDays', { n: sm.okDays, of: sm.withGoal })));
        items.push(h('li', { class: 'muted' }, t('stats.goalPositive')));
      } else {
        items.push(h('li', null, t('stats.goalNotSet')));
      }
    }
    return h('ul', { class: 'summary' }, items);
  }

  function legend() {
    var mode = state.settings.mode;
    return h('p', { class: 'note legend' },
      t(mode === 'limit' ? 'stats.legendLimit' : 'stats.legendGoal') +
      ' · ' + t('stats.legendAvg') +
      (mode === 'limit' ? ' · ' + t('stats.overMark') : ''));
  }

  function daysToBars(days, labelFn) {
    var mode = state.settings.mode;
    return days.map(function (d) {
      return { label: labelFn(d), value: d.total, ref: d.goal, state: X.dayState(d, mode) };
    });
  }

  function renderDayStats(holder) {
    var day = state.statsDay;
    var sec = statsSection(t('stats.day'), U.weekdayShort(day) + ' ' + U.fmtDate(day),
      function () { state.statsDay = U.addDays(day, -1); renderDayStats(holder); },
      function () { state.statsDay = U.addDays(day, 1); renderDayStats(holder); },
      day >= state.today);
    holder.textContent = '';
    holder.appendChild(sec.el);
    return DB.getEntriesByDate(day).then(function (entries) {
      var hours = [];
      for (var i = 0; i < 24; i++) hours.push({ label: String(i), value: 0, ref: null, state: '' });
      var total = 0;
      entries.forEach(function (e) { hours[new Date(e.timestamp).getHours()].value += e.amountMl; total += e.amountMl; });
      sec.body.appendChild(Charts.barChart(hours, { ariaLabel: t('stats.dayChartAria') + ', ' + t('stats.dayTotal', { total: U.fmtMl(total) }), labelEvery: 3, height: 165 }));
      sec.body.appendChild(h('p', { class: entries.length ? '' : 'muted' }, entries.length ? t('stats.dayTotal', { total: U.fmtMl(total) }) : t('stats.noData')));
    });
  }

  function renderWeekStats(holder) {
    var end = state.statsWeekEnd, from = U.addDays(end, -6);
    var sec = statsSection(t('stats.week'), U.fmtDateShort(from) + ' – ' + U.fmtDateShort(end),
      function () { state.statsWeekEnd = U.addDays(end, -7); renderWeekStats(holder); },
      function () { var n = U.addDays(end, 7); state.statsWeekEnd = n > state.today ? state.today : n; renderWeekStats(holder); },
      end >= state.today);
    holder.textContent = '';
    holder.appendChild(sec.el);
    var s = state.settings;
    return Promise.all([DB.rangeData(from, end, s), DB.rangeData(U.addDays(from, -7), U.addDays(from, -1), s)]).then(function (res) {
      var days = res[0];
      var sm = X.summarize(days, s.mode, state.today);
      sec.body.appendChild(Charts.barChart(daysToBars(days, function (d) { return U.weekdayShort(d.date); }), {
        ariaLabel: t('stats.weekChartAria'), showValues: true, height: 195, avg: sm.avg
      }));
      sec.body.appendChild(legend());
      sec.body.appendChild(summaryList(days, res[1], true));
      sec.body.appendChild(h('button', {
        type: 'button', class: 'btn btn-primary btn-block',
        onclick: function () { exportWeek(end); }
      }, icon('share'), ' ', t('stats.exportWeek')));
    });
  }

  function renderMonthStats(holder) {
    var ym = state.statsMonth, range = U.monthRange(ym);
    var prevRange = U.monthRange(U.addMonths(ym, -1));
    var sec = statsSection(t('stats.month'), U.fmtMonth(ym),
      function () { state.statsMonth = U.addMonths(ym, -1); renderMonthStats(holder); },
      function () { state.statsMonth = U.addMonths(ym, 1); renderMonthStats(holder); },
      range[1] >= state.today);
    holder.textContent = '';
    holder.appendChild(sec.el);
    var s = state.settings;
    return Promise.all([DB.rangeData(range[0], range[1], s), DB.rangeData(prevRange[0], prevRange[1], s)]).then(function (res) {
      var days = res[0];
      var sm = X.summarize(days, s.mode, state.today);
      sec.body.appendChild(Charts.barChart(daysToBars(days, function (d) { return String(Number(d.date.slice(8))); }), {
        ariaLabel: t('stats.weekChartAria'), labelEvery: 5, height: 175, avg: sm.avg
      }));
      sec.body.appendChild(legend());
      sec.body.appendChild(summaryList(days, res[1], true));
    });
  }

  function renderStats(main) {
    setTitle(t('stats.title'), '');
    main.textContent = '';
    var d = h('div'), w = h('div'), m = h('div');
    main.appendChild(d); main.appendChild(w); main.appendChild(m);
    return Promise.all([renderDayStats(d), renderWeekStats(w), renderMonthStats(m)]);
  }

  // =========================================================
  // Export
  // =========================================================
  function exportWeek(end) {
    return X.weekPng(end, state.settings)
      .then(function (blob) { return X.shareOrDownload(blob, 'piticko-tyden-' + end + '.png'); })
      .then(function (r) { if (r !== 'cancelled') toast(t('export.done')); })
      .catch(function () { toast(t('export.failed')); });
  }
  function doExport(kind) {
    return X.exportKind(kind, state.settings)
      .then(function (r) { if (r !== 'cancelled') toast(t('export.done')); })
      .catch(function () { toast(t('export.failed')); });
  }
  function exportButtons() {
    return h('div', { class: 'export-buttons' },
      h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: function () { doExport('png'); } }, t('export.weekPng')),
      h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: function () { doExport('csv'); } }, t('export.csv')),
      h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: function () { doExport('json'); } }, t('export.json')));
  }
  function exportChooser() {
    return modal({ title: t('modeChange.exportChoose'), body: exportButtons(), actions: [{ label: t('common.continue'), value: 'done', kind: 'primary' }] });
  }

  // =========================================================
  // Upozornění
  // =========================================================
  function timesEditor(times) {
    var list = times.slice();
    var box = h('div', { class: 'times-editor' });
    var near = null;
    function draw() {
      box.textContent = '';
      list.forEach(function (tm, i) {
        var input = h('input', { type: 'time', class: 'input', value: tm, step: 60, 'aria-label': t('settings.timesTitle') + ' ' + (i + 1),
          onchange: function () { list[i] = input.value; } });
        box.appendChild(h('div', { class: 'time-row' }, input,
          list.length > 1 ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('settings.removeTime', { time: tm }),
            onclick: function () { list.splice(i, 1); draw(); } }, icon('close')) : null));
      });
      if (list.length < 5) {
        box.appendChild(h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: function () { list.push('20:00'); draw(); } }, '+ ' + t('settings.addTime')));
      } else {
        box.appendChild(h('p', { class: 'note' }, t('settings.maxTimes')));
      }
    }
    draw();
    var body = [box];
    if (state.settings.mode === 'limit') {
      near = h('input', { type: 'checkbox', id: 'f-near', checked: state.settings.reminders.onlyWhenNearLimit });
      body.push(h('label', { class: 'check', for: 'f-near' }, near, h('span', null, t('settings.onlyNearLimit'))));
    }
    return modal({
      title: t('settings.timesTitle'),
      body: body,
      actions: [
        { label: t('common.save'), value: 'save', kind: 'primary', validate: function () {
          return list.every(U.isValidTime) ? null : t('settings.timesTitle');
        } },
        { label: t('common.cancel'), value: 'cancel' }
      ]
    }).then(function (v) {
      if (v !== 'save') return null;
      var clean = list.filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
      if (near) state.settings.reminders.onlyWhenNearLimit = near.checked;
      return clean;
    });
  }

  function enableReminders(times) {
    state.settings.remindersAsked = true;
    return N.enable(state.settings, times).then(function (res) {
      if (res === 'ok') return save().then(function () { toast(t('settings.remindersOn', { times: state.settings.reminders.times.map(fmtTimeShort).join(', ') })); });
      if (times) state.settings.reminders.times = times;
      return save().then(function () {
        if (res === 'ios-install') return info(t('settings.remindersTitle'), t('settings.iosNotInstalled'), [{ label: t('install.howBtn'), value: 'how', kind: 'primary' }]).then(function (v) { if (v === 'how') return iosGuide(); });
        if (res === 'denied') return info(t('settings.remindersTitle'), t('settings.permissionDenied'));
        return info(t('settings.remindersTitle'), t('settings.notSupported'));
      });
    });
  }

  function timeChips(times) {
    return h('ul', { class: 'chips' }, times.map(function (x) { return h('li', { class: 'chip' }, fmtTimeShort(x)); }));
  }

  function reminderNotes() {
    var notes = [h('p', { class: 'note' }, t('settings.remindersNote'))];
    if (N.iosNeedsInstall()) notes.unshift(h('p', { class: 'warn-box' }, t('settings.iosNotInstalled')));
    return notes;
  }

  function remindersProposal() {
    var times = state.settings.reminders.times;
    return modal({
      title: t('onboarding.remindersTitle'),
      text: t('onboarding.remindersText'),
      body: [timeChips(times)].concat(reminderNotes()),
      actions: [
        { label: t('onboarding.yes'), value: 'yes', kind: 'primary' },
        { label: t('onboarding.adjust'), value: 'adjust' },
        { label: t('onboarding.no'), value: 'no' }
      ]
    }).then(function (v) {
      if (v === 'yes') return enableReminders(times);
      if (v === 'adjust') return timesEditor(times).then(function (nt) { if (nt) return enableReminders(nt); });
      if (v === 'no') { state.settings.remindersAsked = true; return save(); }
    });
  }

  // =========================================================
  // Obrazovka: Nastavení
  // =========================================================
  function settingsCard(title) {
    var c = h('section', { class: 'card settings-card' }, h('h2', { class: 'section-title' }, title));
    for (var i = 1; i < arguments.length; i++) {
      var child = arguments[i];
      if (child) c.appendChild(child instanceof Node ? child : h('div', null, child));
    }
    return c;
  }

  function renderSettings(main) {
    var s = state.settings;
    setTitle(t('settings.title'), '');
    main.textContent = '';

    // Režim
    main.appendChild(settingsCard(t('settings.modeTitle'),
      h('p', null, t('settings.modeCurrent', { mode: t(s.mode === 'limit' ? 'mode.limitShort' : 'mode.lowShort') })),
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: modeChangeFlow }, t('settings.changeMode'))));

    // Limit / cíl
    var isLimit = s.mode === 'limit';
    var f = numberField(t(isLimit ? 'amount.limitLabel' : 'amount.goalLabel'), isLimit ? s.limitMl : s.goalMl, 100, 10000, 'f-goal');
    var err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    var form = h('form', { class: 'inline-form', novalidate: true }, f.wrap,
      h('button', { type: 'submit', class: 'btn btn-primary' }, t('common.save')));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = String(f.input.value).trim();
      var val = raw === '' && !isLimit ? null : readInt(f.input, 100, 10000);
      if (raw === '' && isLimit) val = null;
      if (raw !== '' && val == null) { err.textContent = t('amount.invalidLimit'); err.hidden = false; return; }
      err.hidden = true;
      if (isLimit) s.limitMl = val; else s.goalMl = val;
      save().then(function () { return DB.setDayGoal(DB.goalRecordFromSettings(state.today, s)); })
        .then(function () { toast(t('settings.savedValue')); });
    });
    main.appendChild(settingsCard(t(isLimit ? 'settings.limitTitle' : 'settings.goalTitle'),
      form, err, h('p', { class: 'note' }, t(isLimit ? 'settings.limitHelp' : 'settings.goalHelp'))));

    // Vzhled: tři velká tlačítka s ikonou
    var themes = [
      ['system', 'settings.themeSystem', 'auto'],
      ['light', 'settings.themeLight', 'sun'],
      ['dark', 'settings.themeDark', 'moon']
    ];
    var seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t('settings.themeTitle') },
      themes.map(function (th) {
        var id = 'theme-' + th[0];
        var input = h('input', { type: 'radio', name: 'theme', id: id, value: th[0], checked: s.theme === th[0],
          onchange: function () { s.theme = th[0]; applyTheme(th[0]); save(); } });
        return [input, h('label', { for: id }, icon(th[2]), h('span', null, t(th[1])))];
      }));
    main.appendChild(settingsCard(t('settings.themeTitle'), seg));

    // Upozornění
    var rem = s.reminders;
    var remCard = settingsCard(t('settings.remindersTitle'));
    if (!N.supported()) {
      remCard.appendChild(h('p', { class: 'muted' }, t('settings.notSupported')));
    } else if (rem.enabled) {
      remCard.appendChild(h('p', null, t('settings.remindersOn', { times: rem.times.map(fmtTimeShort).join(', ') })));
      if (N.permission() === 'denied') remCard.appendChild(h('p', { class: 'warn-box' }, t('settings.permissionDenied')));
      if (isLimit) {
        var near = h('input', { type: 'checkbox', id: 's-near', checked: rem.onlyWhenNearLimit,
          onchange: function () { rem.onlyWhenNearLimit = near.checked; save(); } });
        remCard.appendChild(h('label', { class: 'check', for: 's-near' }, near, h('span', null, t('settings.onlyNearLimit'))));
      }
      remCard.appendChild(h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: function () {
          timesEditor(rem.times).then(function (nt) {
            if (!nt) return;
            rem.times = nt;
            save().then(function () { N.scheduleInApp(s); refresh(); });
          });
        } }, t('settings.remindersEdit')),
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: function () {
          N.disable(s).then(function () { refresh(); toast(t('settings.remindersOff')); });
        } }, t('settings.remindersDisable'))));
    } else {
      remCard.appendChild(h('p', null, t('settings.remindersOff')));
      remCard.appendChild(h('button', { type: 'button', class: 'btn btn-secondary', onclick: function () { remindersProposal().then(refresh); } }, t('settings.remindersSetup')));
    }
    reminderNotes().forEach(function (n) { remCard.appendChild(n); });
    if (N.supported() && !s.pushEnabled) remCard.appendChild(h('p', { class: 'note' }, t('settings.remindersInfoClosed')));
    main.appendChild(remCard);

    // Export
    main.appendChild(settingsCard(t('settings.exportTitle'), h('p', { class: 'note' }, t('settings.exportHelp')), exportButtons()));

    // Úložiště
    var storeText = h('p', null, t('settings.storageOk'));
    var storeCard = settingsCard(t('settings.storageTitle'), storeText);
    main.appendChild(storeCard);
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) {
        if (!p) storeCard.appendChild(h('p', { class: 'warn-box' }, t('settings.storageWarn')));
      });
    } else {
      storeCard.appendChild(h('p', { class: 'warn-box' }, t('settings.storageWarn')));
    }

    // O aplikaci
    main.appendChild(settingsCard(t('settings.aboutTitle'),
      h('p', { class: 'disclaimer' }, t('app.disclaimer')),
      h('p', null, h('a', { href: '/ochrana-soukromi' }, t('app.privacyLink')))));

    // Smazat vše
    main.appendChild(settingsCard(t('settings.deleteAll'),
      h('p', { class: 'note' }, t('settings.deleteAllHelp')),
      h('button', { type: 'button', class: 'btn btn-danger', onclick: deleteAllFlow }, t('settings.deleteAll'))));
    return Promise.resolve();
  }

  // =========================================================
  // Změna režimu: 1) nabídka exportu, 2) potvrzení smazání, 3) výběr režimu
  // =========================================================
  function offerExport(title, text) {
    return modal({
      title: title, text: text,
      actions: [
        { label: t('modeChange.exportBtn'), value: 'export', kind: 'primary' },
        { label: t('modeChange.skip'), value: 'skip' },
        { label: t('common.cancel'), value: 'cancel' }
      ]
    }).then(function (v) {
      if (v === 'export') return exportChooser().then(function () { return true; });
      return v === 'skip';
    });
  }

  function modeChangeFlow() {
    return offerExport(t('modeChange.exportTitle'), t('modeChange.exportText')).then(function (go) {
      if (!go) return;
      return modal({
        title: t('modeChange.confirmTitle'), text: t('modeChange.confirmText'),
        actions: [
          { label: t('common.continue'), value: 'ok', kind: 'danger' },
          { label: t('common.cancel'), value: 'cancel' }
        ]
      }).then(function (v) {
        if (v !== 'ok') return;
        return DB.clearRecords().then(function () {
          var s = state.settings;
          s.onboardingDone = false;
          s.mode = null;
          return save();
        }).then(startOnboarding);
      });
    });
  }

  function deleteAllFlow() {
    return offerExport(t('deleteAll.exportTitle'), t('deleteAll.exportText')).then(function (go) {
      if (!go) return;
      return modal({
        title: t('deleteAll.confirm1Title'), text: t('deleteAll.confirm1Text'),
        actions: [{ label: t('common.continue'), value: 'ok', kind: 'danger' }, { label: t('common.cancel'), value: 'cancel' }]
      }).then(function (v1) {
        if (v1 !== 'ok') return;
        return modal({
          title: t('deleteAll.confirm2Title'), text: t('deleteAll.confirm2Text'),
          actions: [{ label: t('deleteAll.confirmBtn'), value: 'ok', kind: 'danger' }, { label: t('common.cancel'), value: 'cancel' }]
        }).then(function (v2) {
          if (v2 !== 'ok') return;
          return N.disable(state.settings).then(function (s) {
            try {
              if (s.pendingUnsubscribe) localStorage.setItem('piticko-pending-unsub', s.pendingUnsubscribe);
              localStorage.removeItem('piticko-theme');
              localStorage.removeItem('piticko-install-dismissed');
            } catch (e) { /* ignore */ }
            return DB.wipeAll();
          }).then(function () { location.replace('/app/'); });
        });
      });
    });
  }

  // =========================================================
  // Úvodní nastavení (první spuštění / po změně režimu)
  // =========================================================
  function obScreen() {
    $('#shell').hidden = true;
    var ob = $('#onboarding');
    ob.hidden = false;
    ob.textContent = '';
    window.scrollTo(0, 0);
    return ob;
  }

  function modeTicketIcon(mode) {
    if (mode === 'limit') {
      return U.s('svg', { viewBox: '0 0 36 36', class: 'ticket-icon', 'aria-hidden': 'true' },
        U.s('polygon', { points: '9,8 27,8 25,30 11,30', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4 }),
        U.s('line', { x1: 7, y1: 15, x2: 29, y2: 15, stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-dasharray': '3 2' })
      );
    }
    return U.s('svg', { viewBox: '0 0 36 36', class: 'ticket-icon', 'aria-hidden': 'true' },
      U.s('path', { d: 'M18 6 C11 15, 9 20, 9 24 a9 9 0 0 0 18 0 C27 20, 25 15, 18 6 Z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4 })
    );
  }

  function startOnboarding() {
    hideToast();
    document.title = t('app.name');
    var ob = obScreen();
    function card(mode, num) {
      var btn = h('button', {
        type: 'button',
        class: 'mode-card ticket-card',
        onclick: function () {
          btn.classList.add('is-picked');
          var delay = reducedMotionMQ && reducedMotionMQ.matches ? 0 : 180;
          setTimeout(function () { chooseMode(mode); }, delay);
        }
      },
        h('span', { class: 'ticket-stub' },
          h('span', { class: 'ticket-num' }, num),
          modeTicketIcon(mode)
        ),
        h('span', { class: 'ticket-main' },
          h('span', { class: 'mode-card-title' }, t('mode.' + mode)),
          h('span', { class: 'mode-card-desc' }, t('mode.' + mode + 'Desc'))
        )
      );
      return btn;
    }
    var titleTxt = t('onboarding.welcome');
    ob.appendChild(h('div', { class: 'ob-inner' },
      h('img', { src: '/app/icons/favicon.svg', alt: '', width: 64, height: 64, class: 'ob-logo' }),
      h('h1', { class: 'ob-title misreg', 'data-text': titleTxt }, titleTxt),
      h('p', { class: 'ob-text' }, t('onboarding.chooseMode')),
      h('div', { class: 'mode-cards' }, card('limit', '01'), card('low', '02')),
      h('p', { class: 'disclaimer' }, t('app.disclaimer')),
      h('p', { class: 'ob-links' }, h('a', { href: '/ochrana-soukromi' }, t('app.privacyLink')))));
    var first = ob.querySelector('.mode-card');
    if (first) first.focus({ preventScroll: true });
  }

  function requestPersist() {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(null);
    return navigator.storage.persisted().then(function (p) {
      return p ? true : navigator.storage.persist();
    }).catch(function () { return false; });
  }

  function chooseMode(mode) {
    var s = state.settings;
    s.mode = mode;
    if (mode !== 'limit') s.reminders.onlyWhenNearLimit = false;
    requestPersist().then(function (p) { s.storagePersisted = p; });
    stepAmount();
  }

  function stepAmount() {
    var s = state.settings, isLimit = s.mode === 'limit';
    var ob = obScreen();
    var f = numberField(t(isLimit ? 'amount.limitLabel' : 'amount.goalLabel'), isLimit ? s.limitMl : s.goalMl, 100, 10000, 'ob-amount');
    var err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    var form = h('form', { class: 'ob-form', novalidate: true },
      f.wrap, err,
      h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, t('common.continue')),
      h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: function () {
        if (isLimit) s.limitMl = null; else s.goalMl = null;
        stepReminders();
      } }, t(isLimit ? 'onboarding.limitLater' : 'onboarding.goalSkip')),
      h('button', { type: 'button', class: 'btn btn-text', onclick: startOnboarding }, '‹ ' + t('common.back')));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var val = readInt(f.input, 100, 10000);
      if (val == null) { err.textContent = t('amount.invalidLimit'); err.hidden = false; f.input.focus(); return; }
      if (isLimit) { s.limitMl = val; s.goalMl = null; } else { s.goalMl = val; s.limitMl = null; }
      stepReminders();
    });
    ob.appendChild(h('div', { class: 'ob-inner' },
      h('h1', { class: 'ob-title' }, t(isLimit ? 'onboarding.limitTitle' : 'onboarding.goalTitle')),
      h('p', { class: 'ob-text' }, t(isLimit ? 'onboarding.limitText' : 'onboarding.goalText')),
      form));
  }

  function stepReminders() {
    var s = state.settings;
    if (s.remindersAsked) return finishOnboarding();
    var ob = obScreen();
    var times = s.reminders.times;
    ob.appendChild(h('div', { class: 'ob-inner' },
      h('h1', { class: 'ob-title' }, t('onboarding.remindersTitle')),
      h('p', { class: 'ob-text' }, t('onboarding.remindersText')),
      timeChips(times),
      reminderNotes(),
      h('div', { class: 'ob-form' },
        h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: function () {
          enableReminders(times).then(finishOnboarding);
        } }, t('onboarding.yes')),
        h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: function () {
          timesEditor(times).then(function (nt) { if (nt) enableReminders(nt).then(finishOnboarding); });
        } }, t('onboarding.adjust')),
        h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: function () {
          s.remindersAsked = true;
          finishOnboarding();
        } }, t('onboarding.no')))));
  }

  function finishOnboarding() {
    var s = state.settings;
    s.onboardingDone = true;
    return save().then(function () {
      location.hash = '#/';
      showApp();
    });
  }

  // =========================================================
  // Směrování a start
  // =========================================================
  var renderers = { today: renderToday, stats: renderStats, settings: renderSettings };

  function route() {
    if (!state.settings || !state.settings.onboardingDone) return;
    var hash = location.hash.replace(/^#\/?/, '');
    var view = renderers[hash] ? hash : 'today';
    var changed = view !== state.view;
    state.view = view;
    document.querySelectorAll('.tabs a').forEach(function (a) {
      if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var main = $('#view');
    return renderers[view](main).then(function () {
      if (changed) window.scrollTo(0, 0);
    }).catch(function (e) { console.error(e); });
  }
  function refresh() { return route(); }

  function showApp() {
    $('#onboarding').hidden = true;
    $('#shell').hidden = false;
    state.view = null;
    route();
    N.scheduleInApp(state.settings);
    if (state.settings.reminders.enabled) N.registerPeriodicSync();
  }

  function checkDayChange() {
    var k = U.todayKey();
    if (k === state.today) return;
    var old = state.today;
    state.today = k;
    if (state.statsDay === old) state.statsDay = k;
    if (state.statsWeekEnd === old) state.statsWeekEnd = k;
    if (state.statsMonth === old.slice(0, 7)) state.statsMonth = k.slice(0, 7);
    refresh();
    if (state.settings) N.scheduleInApp(state.settings);
  }
  function scheduleMidnight() {
    clearTimeout(state.midnightTimer);
    state.midnightTimer = setTimeout(function () { checkDayChange(); scheduleMidnight(); }, U.msUntilMidnight() + 1000);
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(function (e) { console.warn('SW', e); });
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloading) return;
      if (document.querySelector('dialog[open]')) return;
      reloading = true;
      try { sessionStorage.setItem('piticko-updated', '1'); } catch (e) { /* ignore */ }
      location.reload();
    });
  }

  function translateStatic() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  }

  function init() {
    translateStatic();
    registerSW();
    I.init();
    I.onChange(function () { if (state.view === 'today') refresh(); });
    $('#add-btn').addEventListener('click', addDialog);
    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) checkDayChange(); });
    scheduleMidnight();
    state.statsDay = state.statsWeekEnd = state.today;
    state.statsMonth = state.today.slice(0, 7);

    DB.getSettings().then(function (s) {
      state.settings = s;
      applyTheme(s.theme);
      var pending = null;
      try { pending = localStorage.getItem('piticko-pending-unsub'); } catch (e) { /* ignore */ }
      if (pending && !s.pendingUnsubscribe) s.pendingUnsubscribe = pending;
      N.retryPendingUnsubscribe(s).then(function (ok) { if (ok) try { localStorage.removeItem('piticko-pending-unsub'); } catch (e) { /* ignore */ } });

      if (!s.onboardingDone) startOnboarding(); else showApp();
      try {
        if (sessionStorage.getItem('piticko-updated')) { sessionStorage.removeItem('piticko-updated'); toast(t('app.updated')); }
      } catch (e) { /* ignore */ }
    }).catch(function (e) {
      console.error(e);
      var ob = obScreen();
      ob.appendChild(h('div', { class: 'ob-inner' }, h('h1', { class: 'ob-title' }, t('app.name')), h('p', { class: 'warn-box' }, t('app.noIndexedDB'))));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
