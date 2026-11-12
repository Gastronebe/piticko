/*
 * Export: obrázek týdne (PNG přes Canvas, vždy světlý v risografickém stylu „kuchyňský sešit“),
 * CSV a JSON. Vše vzniká v zařízení, nic se neodesílá na server.
 */
(function (g) {
  'use strict';
  var P = g.P = g.P || {};
  var U = P.U, DB = P.DB, t = P.t, R = P.Reminders;

  var FONT_HEAD = '"Fraunces", Georgia, serif';
  var FONT_BODY = '"Work Sans", system-ui, -apple-system, sans-serif';
  // Světlá tisková paleta „kuchyňský sešit“ (nezávisle na motivu aplikace).
  var C = {
    paper: '#F5F0E6',
    card: '#FFFBF3',
    ink: '#1E2A3A',
    accent1: '#2BA7B5',
    accent2: '#FF6A4D'
  };

  function summarize(days, mode, today) {
    var past = days.filter(function (d) { return d.date <= today; });
    var rec = past.filter(function (d) { return d.count > 0; });
    var sum = rec.reduce(function (a, d) { return a + d.total; }, 0);
    var res = { recorded: rec.length, days: past.length, avg: rec.length ? sum / rec.length : null, max: null, okDays: 0, withGoal: 0 };
    rec.forEach(function (d) {
      if (!res.max || d.total > res.max.total) res.max = d;
      if (d.goal) {
        res.withGoal++;
        if (mode === 'limit' ? d.total <= d.goal : d.total >= d.goal) res.okDays++;
      }
    });
    return res;
  }

  function dayState(d, mode) {
    if (!d.count) return '';
    if (!d.goal) return 'ok';
    if (mode === 'limit') return R.limitState(d.total, d.goal);
    return d.total >= d.goal ? 'reached' : 'ok';
  }

  /** Vykreslí sloupec s halftone tečkami (nebo šrafováním u překročení/blízko limitu pro ČB tisk). */
  function drawBarWithHalftone(c, x, y, w, h, warn) {
    c.save();
    c.fillStyle = warn ? C.accent2 : C.accent1;
    c.fillRect(x, y, w, h);

    // Ořez na obdélník sloupce
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();

    c.fillStyle = C.ink;
    c.strokeStyle = C.ink;
    if (warn) {
      // Šikmé šrafování pro jasné odlišení i na ČB tiskárně
      c.lineWidth = 2;
      for (var d = -h; d < w + h; d += 12) {
        c.beginPath();
        c.moveTo(x + d, y);
        c.lineTo(x + d - h, y + h);
        c.stroke();
      }
    } else {
      // Halftone tečky
      var step = 10;
      for (var py = y + 5; py < y + h; py += step) {
        var rowOffset = (Math.round((py - y) / step) % 2) * (step / 2);
        for (var px = x + 5 + rowOffset; px < x + w; px += step) {
          c.beginPath();
          c.arc(px, py, 1.8, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    c.restore();

    c.strokeStyle = C.ink;
    c.lineWidth = 3;
    c.strokeRect(x, y, w, h);
  }

  /** Vykreslí přehled 7 dnů končících dnem `endDate` a vrátí Blob PNG. */
  function weekPng(endDate, settings) {
    var from = U.addDays(endDate, -6);
    var readyFonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return Promise.all([DB.rangeData(from, endDate, settings), readyFonts]).then(function (res) {
      var days = res[0];
      var mode = settings.mode;
      var W = 1200, H = 1580;
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var c = cv.getContext('2d');
      c.fillStyle = C.paper;
      c.fillRect(0, 0, W, H);
      c.textBaseline = 'alphabetic';
      var M = 80;

      // Vnější sešitový rámeček s posunutým soutiskem
      c.fillStyle = C.accent1;
      c.fillRect(46, 46, W - 84, H - 84);
      c.fillStyle = C.card;
      c.fillRect(38, 38, W - 84, H - 84);
      c.strokeStyle = C.ink;
      c.lineWidth = 4;
      c.strokeRect(38, 38, W - 84, H - 84);

      function text(str, x, y, size, color, weight, align, head) {
        c.font = (weight || '400') + ' ' + size + 'px ' + (head ? FONT_HEAD : FONT_BODY);
        c.fillStyle = color || C.ink;
        c.textAlign = align || 'left';
        c.fillText(str, x, y);
      }

      // Hlavička s jemným misregistration posunem
      text(t('app.name'), M + 3, 113, 38, C.accent2, '800', 'left', true);
      text(t('app.name'), M, 110, 38, C.ink, '800', 'left', true);

      text(t('export.imgTitle'), M + 3, 181, 56, C.accent1, '800', 'left', true);
      text(t('export.imgTitle'), M, 178, 56, C.ink, '800', 'left', true);

      text(U.fmtDate(from) + ' – ' + U.fmtDate(endDate), M, 234, 32, C.ink, '600');
      text(t('export.imgMode', { mode: t(mode === 'limit' ? 'mode.limitShort' : 'mode.lowShort') }), M, 284, 28, C.ink, '400');

      var goals = days.map(function (d) { return d.goal || null; });
      var uniq = goals.filter(function (v, i, a) { return a.indexOf(v) === i; });
      var goalText = uniq.length > 1 ? t('export.imgPerDay') : (uniq[0] ? U.fmtMl(uniq[0]) : t('export.imgNotSet'));
      text(t(mode === 'limit' ? 'export.imgLimit' : 'export.imgGoal', { v: goalText }), M, 324, 28, C.ink, '400');

      var sum = summarize(days, mode, U.todayKey());

      // Graf
      var gx = M, gy = 384, gw = W - 2 * M, gh = 320;
      var max = 1;
      days.forEach(function (d) { max = Math.max(max, d.total, d.goal || 0); });
      if (sum.avg) max = Math.max(max, sum.avg);
      max *= 1.16;
      var slot = gw / 7, bw = slot * 0.56;

      // Přerušovaná čára průměru přes celý graf
      if (sum.avg) {
        var ay = gy + gh - (sum.avg / max) * gh;
        c.save();
        c.strokeStyle = C.ink;
        c.lineWidth = 2.5;
        c.setLineDash([16, 10]);
        c.beginPath();
        c.moveTo(gx, ay);
        c.lineTo(gx + gw, ay);
        c.stroke();
        c.restore();
      }

      days.forEach(function (d, i) {
        var x = gx + slot * i + (slot - bw) / 2;
        var st = dayState(d, mode);
        var bh = d.total > 0 ? Math.max(6, d.total / max * gh) : 0;
        var warn = st === 'over' || st === 'near';
        if (bh) {
          drawBarWithHalftone(c, x, gy + gh - bh, bw, bh, warn);
          var mark = st === 'over' ? '! ' : st === 'reached' ? '✓ ' : '';
          text(mark + U.fmtNum(d.total), x + bw / 2, gy + gh - bh - 12, 24, C.ink, '800', 'center', true);
        }
        if (d.goal) {
          var ry = gy + gh - d.goal / max * gh;
          c.save();
          c.strokeStyle = C.ink;
          c.lineWidth = 3.5;
          c.setLineDash([8, 6]);
          c.beginPath();
          c.moveTo(x - 12, ry);
          c.lineTo(x + bw + 12, ry);
          c.stroke();
          c.restore();
        }
        text(U.weekdayShort(d.date) + ' ' + U.fmtDateShort(d.date), x + bw / 2, gy + gh + 38, 24, C.ink, '800', 'center', true);
      });

      // Základna grafu
      c.strokeStyle = C.ink;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(gx, gy + gh);
      c.lineTo(gx + gw, gy + gh);
      c.stroke();

      text(t(mode === 'limit' ? 'stats.legendLimit' : 'stats.legendGoal') + ' · ' + t('stats.legendAvg'), M, gy + gh + 82, 22, C.ink, '400');

      // Tabulka v sešitovém stylu
      var ty = 860, rowH = 64;
      var cols = [M, M + 320, M + 550, M + 780];
      c.fillStyle = C.paper;
      c.fillRect(M - 16, ty - 42, W - 2 * M + 32, 58);
      c.strokeStyle = C.ink;
      c.lineWidth = 3;
      c.strokeRect(M - 16, ty - 42, W - 2 * M + 32, 58);

      text(t('export.colDay'), cols[0], ty, 26, C.ink, '800', 'left', true);
      text(t('export.colTotal'), cols[1], ty, 26, C.ink, '800', 'left', true);
      text(t(mode === 'limit' ? 'export.colLimit' : 'export.colGoal'), cols[2], ty, 26, C.ink, '800', 'left', true);
      text(t('export.colState'), cols[3], ty, 26, C.ink, '800', 'left', true);

      days.forEach(function (d, i) {
        var y = ty + rowH * (i + 1);
        c.strokeStyle = C.ink;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(M - 16, y + 16);
        c.lineTo(W - M + 16, y + 16);
        c.stroke();

        text(U.weekdayShort(d.date) + ' ' + U.fmtDate(d.date), cols[0], y, 27, C.ink, '400');
        text(d.count ? U.fmtMl(d.total) : '–', cols[1], y, 27, C.ink, '800', 'left', true);
        text(d.goal ? U.fmtMl(d.goal) : '–', cols[2], y, 27, C.ink, '400');
        var st = dayState(d, mode), label;
        if (!d.count) label = t('export.stNoData');
        else if (mode === 'limit') label = !d.goal ? '–' : (d.total > d.goal ? '! ' + t('export.stOver', { v: U.fmtMl(d.total - d.goal) }) : '✓ ' + t('export.stInLimit'));
        else label = st === 'reached' ? '✓ ' + t('export.stReached') : '–';
        text(label, cols[3], y, 26, C.ink, st === 'over' ? '700' : '400');
      });

      // Souhrn
      var sy = ty + rowH * 8 + 14;
      text(t('export.imgAverage', { v: sum.avg != null ? U.fmtMl(sum.avg) : '–' }), M, sy, 32, C.ink, '800', 'left', true);
      if (sum.withGoal) {
        text(t(mode === 'limit' ? 'stats.daysInLimit' : 'stats.goalDays', { n: sum.okDays, of: sum.withGoal }), M, sy + 48, 28, C.ink, '600');
      }

      // Patička
      text(t('export.imgFooter'), M, H - 90, 21, C.ink, '400');
      text(t('export.imgCreated', { date: U.fmtDate(U.todayKey()) }), M, H - 58, 21, C.ink, '600');

      return new Promise(function (resolve, reject) {
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('toBlob failed')); }, 'image/png');
      });
    });
  }

  /** Nabídne sdílení (Web Share API), jinak soubor stáhne. */
  function shareOrDownload(blob, filename) {
    var file = null;
    try { file = new File([blob], filename, { type: blob.type }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: t('export.shareTitle') }).then(function () { return 'shared'; }, function (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
        download(blob, filename);
        return 'downloaded';
      });
    }
    download(blob, filename);
    return Promise.resolve('downloaded');
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  function stamp() { return U.todayKey(); }

  function csvBlob() {
    return DB.getAllEntries().then(function (entries) {
      var rows = [['id', 'datum', 'cas', 'mnozstvi_ml', 'vytvoreno', 'upraveno']];
      entries.forEach(function (e) {
        rows.push([e.id, e.date, U.timeOf(e.timestamp), e.amountMl,
          new Date(e.createdAt).toISOString(), e.updatedAt ? new Date(e.updatedAt).toISOString() : '']);
      });
      var csv = '\uFEFF' + rows.map(function (r) { return r.join(';'); }).join('\r\n') + '\r\n';
      return new Blob([csv], { type: 'text/csv;charset=utf-8' });
    });
  }

  function jsonBlob(settings) {
    return Promise.all([DB.getAllEntries(), DB.getAllDayGoals()]).then(function (res) {
      var data = {
        app: 'piticko',
        format: 1,
        exportedAt: new Date().toISOString(),
        settings: { mode: settings.mode, limitMl: settings.limitMl, goalMl: settings.goalMl },
        dayGoals: res[1],
        entries: res[0]
      };
      return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    });
  }

  function exportKind(kind, settings) {
    if (kind === 'png') return weekPng(U.todayKey(), settings).then(function (b) { return shareOrDownload(b, 'piticko-tyden-' + stamp() + '.png'); });
    if (kind === 'csv') return csvBlob().then(function (b) { return shareOrDownload(b, 'piticko-data-' + stamp() + '.csv'); });
    if (kind === 'json') return jsonBlob(settings).then(function (b) { return shareOrDownload(b, 'piticko-data-' + stamp() + '.json'); });
    return Promise.reject(new Error('unknown'));
  }

  P.Exporter = {
    summarize: summarize, dayState: dayState, weekPng: weekPng,
    shareOrDownload: shareOrDownload, csvBlob: csvBlob, jsonBlob: jsonBlob, exportKind: exportKind
  };
})(self);
