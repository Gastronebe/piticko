/*
 * Pitíčko – SVG komponenty v risografickém stylu „kuchyňský sešit“:
 * 1) Vizuální nádoba (odměrná sklenice s hladinou, vlněním a tichým přelitím u překročení)
 * 2) Sloupcový graf s halftone tečkovanou výplní a přerušovanou čárou průměru
 * 3) Tisková ilustrace pro prázdný stav
 */
(function (g) {
  'use strict';
  var P = g.P = g.P || {};
  var U = P.U, s = U.s;
  var uidSeq = 0;

  /**
   * Vizuální nádoba (odměrná sklenice).
   * fillRatio: 0..1 (v režimu omezení = zbývající podíl, při překročení 1 + přelití;
   *            v režimu málo pití = plnění cíle, bez cíle 0).
   * state: 'neutral' | 'ok' | 'near' | 'over' | 'reached'
   * big: hlavní číslo (např. "750" nebo "+200")
   * small: popisek pod číslem (např. "ml zbývá")
   */
  function vessel(fillRatio, state, big, small) {
    var id = 'vsl-' + (++uidSeq);
    var shown = state === 'over' ? 1 : Math.max(0, Math.min(1, fillRatio || 0));
    var topY = 26, botY = 148, H = botY - topY; // 122 px výška vnitřku nádoby
    var waterH = shown * H;
    var waterY = botY - waterH;

    var svg = s('svg', {
      viewBox: '0 0 160 168',
      class: 'vessel is-' + (state || 'neutral'),
      'aria-hidden': 'true'
    });

    // Definice ořezu vnitřku sklenice a halftone teček pro odlišení stavů i bez barvy
    var clipPath = s('clipPath', { id: id + '-clip' },
      s('polygon', { points: '30,26 130,26 118,148 42,148' })
    );
    var dotPat = s('pattern', {
      id: id + '-dots', width: 8, height: 8, patternUnits: 'userSpaceOnUse'
    },
      s('circle', { cx: 2.5, cy: 2.5, r: 1.4, class: 'vessel-dot' }),
      s('circle', { cx: 6.5, cy: 6.5, r: 1.4, class: 'vessel-dot' })
    );
    svg.appendChild(s('defs', null, clipPath, dotPat));

    // Risografický posunutý stín sklenice (misregistration +3 px)
    svg.appendChild(s('polygon', {
      points: '34,30 134,30 122,152 46,152',
      class: 'vessel-misreg'
    }));

    // Papírové pozadí sklenice
    svg.appendChild(s('polygon', {
      points: '30,26 130,26 118,148 42,148',
      class: 'vessel-paper'
    }));

    // Hladina uvnitř ořezu sklenice
    var liquidGroup = s('g', { 'clip-path': 'url(#' + id + '-clip)' });
    if (shown > 0.005) {
      // Vlnka na povrchu hladiny (šířka 320 pro plynulý posun o -80 px)
      var wy = Math.max(topY + 3, waterY);
      var waveD = 'M -80 ' + wy +
        ' Q -60 ' + (wy - 5) + ', -40 ' + wy +
        ' T 0 ' + wy +
        ' T 40 ' + wy +
        ' T 80 ' + wy +
        ' T 120 ' + wy +
        ' T 160 ' + wy +
        ' T 200 ' + wy +
        ' T 240 ' + wy +
        ' L 240 160 L -80 160 Z';
      liquidGroup.appendChild(s('path', { d: waveD, class: 'vessel-liquid vessel-wave' }));
      // Halftone tečky přes hladinu
      liquidGroup.appendChild(s('rect', {
        x: 24, y: wy, width: 112, height: botY - wy + 6,
        fill: 'url(#' + id + '-dots)', class: 'vessel-dots-layer'
      }));
      // Zvýrazněná linka hladiny
      liquidGroup.appendChild(s('path', {
        d: 'M -80 ' + wy +
          ' Q -60 ' + (wy - 5) + ', -40 ' + wy +
          ' T 0 ' + wy +
          ' T 40 ' + wy +
          ' T 80 ' + wy +
          ' T 120 ' + wy +
          ' T 160 ' + wy +
          ' T 200 ' + wy +
          ' T 240 ' + wy,
        class: 'vessel-meniscus vessel-wave'
      }));
    }
    svg.appendChild(liquidGroup);

    // Při překročení limitu: tiché přelití přes okraj (bez blikání)
    if (state === 'over') {
      svg.appendChild(s('path', {
        d: 'M 28 26 Q 44 18, 62 25 T 98 25 T 132 26 L 135 39 Q 129 48, 124 39 L 122 31 L 36 31 L 34 45 Q 29 53, 25 45 Z',
        class: 'vessel-overflow'
      }));
      // Kapka stékající po vnější stěně
      svg.appendChild(s('path', {
        d: 'M 24 58 C 20 66, 19 72, 24 76 C 29 72, 28 66, 24 58 Z',
        class: 'vessel-overflow vessel-drip'
      }));
    }

    // Obrys nádoby (tlustá tisková linka s malým zobáčkem vlevo nahoře)
    svg.appendChild(s('path', {
      d: 'M 25 24 L 30 26 L 42 148 L 118 148 L 130 26 L 134 24',
      class: 'vessel-outline'
    }));
    svg.appendChild(s('line', { x1: 25, y1: 24, x2: 134, y2: 24, class: 'vessel-rim' }));

    // Odměrné rysky na pravé stěně (25 %, 50 %, 75 %)
    [0.25, 0.5, 0.75].forEach(function (f) {
      var ry = botY - H * f;
      var rx = 118 + (130 - 118) * f;
      var len = f === 0.5 ? 14 : 9;
      svg.appendChild(s('line', {
        x1: rx - len, y1: ry, x2: rx - 1, y2: ry,
        class: 'vessel-tick'
      }));
    });

    // Papírový štítek uprostřed nádoby s tabulkovým číslem (vždy 100% kontrastní)
    svg.appendChild(s('rect', {
      x: 34, y: 60, width: 92, height: 54, rx: 6,
      class: 'vessel-label-bg'
    }));
    svg.appendChild(s('text', {
      x: 80, y: 89, class: 'vessel-big', 'text-anchor': 'middle'
    }, big));
    svg.appendChild(s('text', {
      x: 80, y: 106, class: 'vessel-small', 'text-anchor': 'middle'
    }, small));

    return svg;
  }

  /**
   * Sloupcový graf s tečkovanou halftone výplní a přerušovanou čárou průměru.
   * bars: [{label, value, ref (limit/cíl nebo null), state: 'ok'|'near'|'over'|'reached'|''}]
   * opts: {ariaLabel, showValues, labelEvery, height, avg}
   */
  function barChart(bars, opts) {
    opts = opts || {};
    var id = 'cht-' + (++uidSeq);
    var W = 348, H = opts.height || 190;
    var top = opts.showValues ? 28 : 16, bottom = 28, left = 6, right = 6;
    var plotH = H - top - bottom;
    var max = 0;
    bars.forEach(function (b) { max = Math.max(max, b.value, b.ref || 0); });
    if (opts.avg) max = Math.max(max, opts.avg);
    if (max === 0) max = 1;
    max *= 1.10;
    var n = bars.length;
    var slot = (W - left - right) / n;
    var bw = Math.max(3, slot * (n > 12 ? 0.68 : 0.58));
    var every = opts.labelEvery || 1;

    var svg = s('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img',
      'aria-label': opts.ariaLabel || '', preserveAspectRatio: 'xMidYMid meet'
    });

    // Halftone patterny pro sloupce (akcent 1 a akcent 2)
    var pat1 = s('pattern', { id: id + '-p1', width: 6, height: 6, patternUnits: 'userSpaceOnUse' },
      s('rect', { width: 6, height: 6, class: 'chart-pat-bg1' }),
      s('circle', { cx: 3, cy: 3, r: 1.35, class: 'chart-pat-dot' })
    );
    var pat2 = s('pattern', { id: id + '-p2', width: 6, height: 6, patternUnits: 'userSpaceOnUse' },
      s('rect', { width: 6, height: 6, class: 'chart-pat-bg2' }),
      s('path', { d: 'M0 6L6 0M-1 1L1 -1M5 7L7 5', class: 'chart-pat-hatch' })
    );
    svg.appendChild(s('defs', null, pat1, pat2));

    // Základna grafu
    svg.appendChild(s('line', {
      x1: left, x2: W - right, y1: top + plotH, y2: top + plotH, class: 'chart-axis'
    }));

    // Přerušovaná čára průměru přes celý graf
    if (opts.avg && opts.avg > 0) {
      var ay = top + plotH - (opts.avg / max) * plotH;
      svg.appendChild(s('line', {
        x1: left, x2: W - right, y1: ay, y2: ay, class: 'chart-avg'
      }));
    }

    bars.forEach(function (b, i) {
      var x = left + slot * i + (slot - bw) / 2;
      var bh = b.value > 0 ? Math.max(4, (b.value / max) * plotH) : 0;
      var y = top + plotH - bh;
      var warnState = b.state === 'near' || b.state === 'over';
      if (bh > 0) {
        svg.appendChild(s('rect', {
          x: x, y: y, width: bw, height: bh, rx: 2,
          fill: 'url(#' + id + (warnState ? '-p2' : '-p1') + ')',
          class: 'chart-bar ' + (b.state ? 'is-' + b.state : '')
        }, s('title', null, b.label + ': ' + U.fmtMl(b.value))));
      }
      if (b.ref) {
        var ry = top + plotH - (b.ref / max) * plotH;
        svg.appendChild(s('line', {
          x1: x - slot * 0.14, x2: x + bw + slot * 0.14, y1: ry, y2: ry, class: 'chart-ref'
        }));
      }
      var mark = b.state === 'over' ? '!' : (b.state === 'reached' ? '✓' : '');
      if (opts.showValues && b.value > 0) {
        svg.appendChild(s('text', {
          x: x + bw / 2, y: y - 6, class: 'chart-value', 'text-anchor': 'middle'
        }, (mark ? mark + ' ' : '') + U.fmtNum(b.value)));
      } else if (mark && b.value > 0) {
        svg.appendChild(s('text', {
          x: x + bw / 2, y: y - 4, class: 'chart-mark', 'text-anchor': 'middle'
        }, mark));
      }
      if (i % every === 0) {
        svg.appendChild(s('text', {
          x: x + bw / 2, y: H - 7, class: 'chart-label', 'text-anchor': 'middle'
        }, b.label));
      }
    });
    return svg;
  }

  /** Jednobarevná tisková ilustrace prázdné sklenice s kapkou pro prázdný stav. */
  function emptyIllustration() {
    return s('svg', { viewBox: '0 0 120 76', class: 'empty-illust', 'aria-hidden': 'true' },
      // Posunutý akcentový stín
      s('polygon', { points: '45,18 81,18 76,64 50,64', class: 'empty-illust-accent' }),
      // Obrys sklenice
      s('polygon', { points: '42,15 78,15 73,61 47,61', class: 'empty-illust-ink' }),
      // Usměvavá klidná linka uvnitř
      s('path', { d: 'M53 38h5M63 38h5M55 46q5 4 10 0', class: 'empty-illust-ink' }),
      // Drobná kapka vedle
      s('path', { d: 'M92 26c-3 5-3 9 0 11c3-2 3-6 0-11z', class: 'empty-illust-accent-stroke' })
    );
  }

  P.Charts = { vessel: vessel, gauge: vessel, barChart: barChart, emptyIllustration: emptyIllustration };
})(self);
