// art-nature.js — 植物、地形、建筑、小物件贴纸（15 张）
// 约定见 art-core.js：ground 贴纸原点 = 底部接地中心，flat 贴纸原点 = 地面椭圆中心。
(function () {
  'use strict';
  const P = ART.PAL, TAU = ART.TAU, S4 = ART.SEASONS4;

  // ---------- 小工具 ----------
  const D = (pts) => { let d = `M${pts[0]} ${pts[1]}`; for (let i = 2; i < pts.length; i += 2) d += ` L${pts[i]} ${pts[i + 1]}`; return d + ' Z'; };
  // 圆角多边形：填充 + 同色圆头描边
  function rpoly(g, pts, c, r = 6) { g.poly(pts, c); g.stroke(D(pts), c, r); }
  // 叶片：从 (x,y) 指向 ang 方向，长 len 宽 wid
  function leaf(g, x, y, len, wid, ang, c, vein) {
    g.at(x, y, ang, 1, 1, () => {
      g.path(`M0 0 Q${len * 0.5} ${-wid} ${len} 0 Q${len * 0.5} ${wid} 0 0 Z`, c);
      if (vein) g.line(len * 0.12, 0, len * 0.78, 0, vein, 1.2);
    });
  }
  // 四角闪光
  function sparkle(g, x, y, r, c = '#fff') {
    const q = r * 0.2;
    g.path(`M${x} ${y - r} Q${x + q} ${y - q} ${x + r} ${y} Q${x + q} ${y + q} ${x} ${y + r} Q${x - q} ${y + q} ${x - r} ${y} Q${x - q} ${y - q} ${x} ${y - r} Z`, c);
  }
  // 半椭圆穹顶（蘑菇伞、雪堆）
  function dome(g, x, y, rx, ry, c, sag = 0.3) {
    const k = g.ctx; k.beginPath(); k.ellipse(x, y, rx, ry, 0, Math.PI, 0);
    k.quadraticCurveTo(x, y + ry * sag, x - rx, y); k.closePath(); k.fillStyle = c; k.fill();
  }
  // 一团圆：暗色打底 + 主色往左上偏 → 右下自然留出阴影边
  function clump(g, C, dark, main, light) {
    for (const [x, y, r] of C) g.circle(x, y, r, dark);
    for (const [x, y, r] of C) g.circle(x - 3, y - 4, r - 3, main);
    if (light) for (const [x, y, r] of C) if (r >= 26) g.ellipse(x - r * 0.38, y - r * 0.45, r * 0.3, r * 0.16, light, -0.55);
  }
  function flower5(g, x, y, r, c, cc) {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * TAU / 5;
      g.circle(x + Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58, r * 0.5, c);
    }
    g.circle(x, y, r * 0.34, cc);
  }
  function mum(g, x, y, r, c, c2, cc) {
    for (let i = 0; i < 11; i++) {
      const a = i * TAU / 11;
      g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.48, r * 0.2, c, a);
    }
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + 0.3;
      g.ellipse(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, r * 0.3, r * 0.14, c2, a);
    }
    g.circle(x, y, r * 0.2, cc);
  }
  // 雪沿着一条描边路径盖在上面（向上偏移一点）
  function snowOn(g, d, w) { g.at(0, -Math.max(2.5, w * 0.45), 0, 1, 1, () => g.stroke(d, P.snow, Math.max(3, w * 0.75))); }
  // 地上的小雪堆
  function snowDrift(g, x, w, h = 6) {
    g.path(`M${x - w} 0 Q${x - w * 0.6} ${-h} ${x} ${-h} Q${x + w * 0.6} ${-h} ${x + w} 0 Z`, P.snow);
    g.path(`M${x - w * 0.2} 0 Q${x + w * 0.4} ${-h * 0.35} ${x + w} 0 Z`, P.snowD);
  }
  const GRASS = { spring: [P.leafSpD, P.leafSp], summer: [P.leafSuD, P.leafSu], autumn: ['#c0943f', '#d8b25a'], winter: ['#8fa07c', '#a8b894'] };

  // 小草叶
  function blade(g, x, w, h, lean, c) {
    g.path(`M${x - w / 2} 0 Q${x - w * 0.2 + lean * 0.3} ${-h * 0.62} ${x + lean} ${-h} Q${x + w * 0.25 + lean * 0.45} ${-h * 0.5} ${x + w / 2} 0 Z`, c);
  }

  // ================= 大树 =================
  function nest(g, nx, ny) {
    g.at(nx, ny, 0, 1, 1, () => {
      g.ellipse(0, -1, 15, 4, P.trunkD);
      // 小蓝鸟探头
      g.path('M-3 -12 Q-1 -19 3 -16 Q1 -14 -3 -12 Z', P.blue);
      g.circle(1, -8, 8.5, P.blue);
      g.ellipse(3, -4.5, 5, 3.5, '#a9d8f2');
      g.poly([8.2, -9.8, 15.5, -7.6, 8.2, -5.2], P.orange);
      g.eye(4.2, -10, 1.9);
      g.blush(5.5, -5.8, 2.2, 1.4);
      // 窝的前沿
      g.path('M-17 -1.5 Q0 5 17 -1.5 Q16 11 0 12 Q-16 11 -17 -1.5 Z', P.woodD);
      g.stroke('M-13 3.5 Q0 7.5 13 3', P.trunkD, 1.5);
      g.stroke('M-10 8 Q0 10.5 10 7.5', P.trunkD, 1.5);
      g.stroke('M14 1 L22 -3', P.woodD, 2.5);
      g.stroke('M-14 2 L-21 5', P.woodD, 2.5);
    });
  }
  function trunk(g) {
    g.path('M-12 0 C-8 -18 -8 -44 -7 -78 L7 -78 C8 -44 8 -18 12 0 Z', P.trunk);
    g.path('M3 0 C4 -18 4 -44 3 -78 L7 -78 C8 -44 8 -18 12 0 Z', P.trunkD);
    g.stroke('M-3 -64 Q-12 -76 -22 -84', P.trunk, 6);
    g.stroke('M3 -68 Q12 -78 20 -88', P.trunk, 6);
    g.line(-4, -30, -4, -22, P.trunkD, 1.6);
  }
  ART.add('tree', (g, v) => {
    const s = v.season, st = v.state || {};
    if (s === 'winter') {
      g.path('M-12 0 C-8 -20 -7 -46 -5 -80 L5 -80 C7 -46 8 -20 12 0 Z', P.trunk);
      g.path('M3 0 C4 -20 3 -46 2 -80 L5 -80 C7 -46 8 -20 12 0 Z', P.trunkD);
      const B = [
        ['M-2 -64 Q-18 -92 -44 -116', 7], ['M-26 -96 Q-42 -97 -58 -89', 5],
        ['M2 -68 Q20 -96 40 -126', 7], ['M19 -95 Q34 -95 50 -100', 5],
        ['M0 -74 Q4 -118 -2 -158', 6], ['M-1 -122 Q-14 -132 -22 -148', 4],
        ['M2 -110 Q14 -120 21 -138', 4], ['M-38 -110 Q-41 -124 -35 -136', 4],
        ['M34 -118 Q46 -126 55 -122', 4],
      ];
      for (const [d, w] of B) g.stroke(d, P.trunk, w);
      for (const [d, w] of B) snowOn(g, d, w);
      snowDrift(g, 0, 30, 7);
    } else {
      // 树根旁一点小草
      const gr = GRASS[s];
      blade(g, -16, 7, 13, -5, gr[0]); blade(g, 16, 7, 12, 5, gr[0]);
      trunk(g);
      const C = [[-36, -92, 30], [36, -94, 28], [-18, -126, 33], [20, -128, 31], [0, -100, 36], [-2, -146, 23]];
      const cols = { spring: [P.blossomD, P.blossom, P.blossomL], summer: [P.leafSuD, P.leafSu, P.leafSuL], autumn: [P.leafAuD, P.leafAu, P.leafAuL] }[s];
      clump(g, C, ...cols);
      if (s === 'spring') {
        leaf(g, -63, -96, 12, 5, Math.PI + 0.3, P.leafSp); leaf(g, 61, -100, 12, 5, -0.2, P.leafSp);
        leaf(g, -40, -150, 11, 5, -2.4, P.leafSp); leaf(g, 30, -154, 11, 5, -0.8, P.leafSp);
        for (const [x, y, r] of [[-42, -104, 5], [6, -116, 5.5], [34, -102, 5], [-14, -140, 5], [-22, -88, 4.5], [40, -126, 4.5], [14, -148, 4.5], [-50, -84, 4], [16, -86, 4]])
          flower5(g, x, y, r, '#fff5f8', P.blossomD);
      } else if (s === 'summer') {
        for (const [x, y] of [[-44, -86], [22, -112], [-10, -132], [40, -90], [-20, -104]])
          g.stroke(`M${x - 6} ${y} Q${x} ${y + 5} ${x + 6} ${y}`, P.leafSuD, 2);
      } else {
        for (const [x, y, r] of [[-40, -100, 6], [18, -118, 7], [38, -96, 5], [-8, -142, 5], [-20, -86, 5]])
          g.ellipse(x, y, r, r * 0.7, '#e5642f', -0.4);
        for (const [x, y] of [[-4, -106], [30, -130], [-34, -122]]) leaf(g, x, y, 9, 4, 0.6, P.leafAuL);
      }
    }
    if (st.nest) nest(g, 24, -98);
  }, [...S4, { season: 'summer', state: { nest: true } }, { season: 'winter', state: { nest: true } }]);

  // ================= 松树 =================
  ART.add('pine', (g, v) => {
    const w = v.season === 'winter';
    g.rect(-7, -26, 14, 26, 2, P.trunk);
    g.rect(1, -26, 6, 26, 1, P.trunkD);
    const T = [[-18, 48, -86], [-58, 40, -124], [-96, 31, -168]]; // [底y, 半宽, 顶y]
    T.forEach(([b, hw, t], i) => {
      const d = `M${-hw} ${b} Q0 ${b + 9} ${hw} ${b} L0 ${t} Z`;
      g.stroke(d, P.pine, 7); g.path(d, P.pine);
      g.path(`M0 ${t} L${hw} ${b} Q${hw * 0.5} ${b + 4} ${hw * 0.08} ${b + 4.4} Z`, P.pineD);
      g.stroke(`M0 ${t} L${hw} ${b}`, P.pineD, 7);
      g.stroke(`M${-hw * 0.18} ${t + (b - t) * 0.35} L${-hw * 0.42} ${t + (b - t) * 0.7}`, P.pineL, 3);
      if (w) {
        const above = T[i + 1];
        const yS = above ? above[0] + (b - above[0]) * 0.5 : t + (b - t) * 0.45;
        const xs = hw * (yS - t) / (b - t);
        const sd = `M0 ${t - 1} L${xs + 2.5} ${yS} Q${xs * 0.62} ${yS + 7} ${xs * 0.32} ${yS + 0.5} Q0 ${yS + 8} ${-xs * 0.3} ${yS + 1} Q${-xs * 0.66} ${yS + 7} ${-xs - 2.5} ${yS} Z`;
        g.path(sd, P.snow); g.stroke(sd, P.snow, 4);
        g.stroke(`M${xs * 0.3} ${yS + 2.5} Q${xs * 0.6} ${yS + 6.5} ${xs + 1} ${yS + 1.5}`, P.snowD, 2);
      }
    });
    if (w) snowDrift(g, 0, 24, 6);
  }, [{ season: 'summer' }, { season: 'winter' }]);

  // ================= 树苗 =================
  ART.add('sapling', (g, v) => {
    const s = v.season;
    const lc = { spring: P.leafSp, summer: P.leafSu, autumn: P.leafAuL, winter: '#8cb37a' }[s];
    const ld = { spring: P.leafSpD, summer: P.leafSuD, autumn: P.leafAuD, winter: '#6f9460' }[s];
    g.stroke('M0 -9 Q-2 -24 1 -38', P.leafSuD, 3.5);
    leaf(g, 0, -24, 15, 7, -2.7, lc, ld);
    leaf(g, 0.5, -31, 15, 7, -0.45, lc, ld);
    leaf(g, 1, -37, 10, 5, -1.7, lc, ld);
    g.path('M-21 0 Q-19 -12 0 -12 Q19 -12 21 0 Z', '#b98a5e');
    g.path('M4 -12 Q19 -11.5 21 0 L8 0 Q12 -6 4 -12 Z', '#9a6f48');
    g.circle(-8, -5, 1.6, '#8a6040'); g.circle(3, -8, 1.3, '#8a6040');
    if (s === 'winter') {
      g.path('M-18 -5 Q-14 -13 0 -13 Q14 -13 18 -5 Q10 -8 4 -6 Q-4 -9 -18 -5 Z', P.snow);
      g.stroke('M-18 -5 Q-14 -13 0 -13 Q14 -13 18 -5', P.snow, 3);
    }
  }, [{ season: 'summer' }, { season: 'winter' }]);

  // ================= 花丛 =================
  ART.add('flowers', (g, v) => {
    const s = v.season;
    if (s === 'winter') {
      for (const d of ['M-18 -8 Q-21 -26 -25 -36', 'M-3 -10 Q0 -30 -4 -42', 'M13 -8 Q18 -24 23 -34', 'M-10 -9 Q-12 -20 -14 -26'])
        g.stroke(d, P.trunkD, 3);
      for (const [x, y] of [[-25, -36], [-4, -42], [23, -34], [-14, -26]]) {
        g.circle(x - 3, y + 1, 3.4, P.red); g.circle(x + 3, y + 1.5, 3.4, P.red); g.circle(x, y - 3, 3.4, P.red);
        g.circle(x - 1, y - 4, 1, '#fff'); g.circle(x - 4, y, 0.9, '#fff');
      }
      clump(g, [[-20, -9, 9], [0, -12, 12], [20, -9, 9]], '#5f7a5c', '#7a9674');
      g.path('M-34 0 Q-33 -14 -18 -16 Q-6 -25 6 -19 Q24 -21 32 -8 Q35 -3 34 0 Z', P.snow);
      g.stroke('M-34 0 Q-33 -14 -18 -16 Q-6 -25 6 -19 Q24 -21 32 -8', P.snow, 3);
      g.path('M2 0 Q18 -4 34 0 Z', P.snowD);
      g.path('M-20 -1 Q-8 -8 12 -3 Q0 -2 -20 -1 Z', P.snowD);
      return;
    }
    const base = { spring: [P.leafSpD, P.leafSp], summer: [P.leafSuD, P.leafSu], autumn: ['#b08a3a', '#d4ae58'] }[s];
    const C = [[-24, -13, 13], [-7, -19, 16], [13, -18, 15], [27, -11, 11], [0, -12, 12], [-30, -6, 6], [33, -5, 5]];
    g.rect(-36, -9, 72, 9, 3, base[0]);
    clump(g, C, base[0], base[1]);
    leaf(g, -34, -10, 10, 4, Math.PI + 0.4, base[1]); leaf(g, 36, -9, 10, 4, -0.4, base[1]);
    const pos = [[-24, -25, 7], [-6, -33, 7.5], [14, -31, 7], [28, -20, 6.5], [3, -18, 6.5], [-17, -12, 5.5]];
    if (s === 'autumn') {
      const cs = [[P.yellow, '#f5b83a'], [P.orange, '#e27d2e'], ['#f7d86a', P.yellow], [P.orange, '#e27d2e'], [P.yellow, '#f5b83a'], ['#f2b25a', P.orange]];
      pos.forEach(([x, y, r], i) => mum(g, x, y, r * 1.05, cs[i][0], cs[i][1], '#b86a2a'));
    } else {
      const cs = s === 'spring'
        ? [[P.pink, '#f5b942'], ['#fffaf2', '#f5b942'], ['#ffe27a', '#e8a33a'], ['#f9c9d6', '#f5b942'], ['#fffaf2', '#f5b942'], [P.pink, '#f5b942']]
        : [[P.red, '#fff2b0'], [P.purple, '#fff2b0'], [P.yellow, '#e08a2e'], [P.red, '#fff2b0'], [P.orange, '#fff2b0'], [P.purple, '#fff2b0']];
      pos.forEach(([x, y, r], i) => flower5(g, x, y, r, cs[i][0], cs[i][1]));
    }
  }, S4);

  // ================= 草丛 =================
  ART.add('grass', (g, v) => {
    const s = v.season, [dk, mn] = GRASS[s];
    const back = [[-18, 10, 30, -9], [-4, 11, 40, -3], [10, 10, 36, 6], [24, 9, 26, 10]];
    const front = [[-26, 10, 22, -10], [-11, 11, 32, -6], [3, 12, 42, 3], [17, 11, 30, 8], [28, 9, 20, 11]];
    for (const [x, w, h, l] of back) blade(g, x, w, h, l, dk);
    for (const [x, w, h, l] of front) blade(g, x, w, h, l, mn);
    g.rect(-30, -4, 60, 4, 2, mn);
    if (s === 'spring') { g.circle(-12, -30, 2.6, '#fffaf2'); g.circle(-12, -30, 1, P.yellow); }
    if (s === 'winter') {
      g.path('M-32 0 Q-28 -13 -12 -11 Q0 -19 12 -12 Q27 -13 32 0 Z', P.snow);
      g.stroke('M-32 0 Q-28 -13 -12 -11 Q0 -19 12 -12 Q27 -13 32 0', P.snow, 3);
      g.path('M4 0 Q20 -5 32 0 Z', P.snowD);
      g.circle(3, -41, 2.6, P.snow); g.circle(-5, -36, 2.2, P.snow);
    }
  }, S4);

  // ================= 石头 =================
  ART.add('rock', (g, v) => {
    const s = v.season;
    g.path('M-40 0 C-44 -24 -26 -44 -4 -44 C18 -44 32 -28 28 0 Z', P.stone);
    g.path('M-4 -44 C18 -44 32 -28 28 0 L8 0 C18 -16 12 -34 -4 -44 Z', P.stoneD);
    g.ellipse(-20, -30, 9, 5, P.stoneL, -0.55);
    g.stroke('M-8 -20 L-2 -14 L-4 -8', P.stoneD, 1.6);
    if (s === 'spring' || s === 'summer') {
      g.path('M-38 -12 Q-40 -24 -30 -30 Q-24 -24 -26 -16 Q-32 -10 -38 -12 Z', s === 'spring' ? P.leafSp : P.leafSu);
    }
    // 小石头
    g.path('M22 0 C20 -14 30 -21 39 -19 C48 -17 51 -7 49 0 Z', P.stone);
    g.path('M39 -19 C48 -17 51 -7 49 0 L40 0 C44 -8 42 -15 39 -19 Z', P.stoneD);
    g.ellipse(30, -12, 4, 2.4, P.stoneL, -0.5);
    if (s === 'autumn') leaf(g, -14, -44, 12, 5, -0.3, P.leafAu, P.leafAuD);
    if (s === 'winter') {
      const sd = 'M-38 -20 C-32 -42 -12 -48 4 -45 C20 -42 30 -30 29 -19 C22 -25 16 -20 9 -25 C0 -19 -8 -26 -16 -22 C-24 -17 -30 -24 -38 -20 Z';
      g.path(sd, P.snow); g.stroke(sd, P.snow, 2.5);
      g.stroke('M9 -25 C16 -21 22 -24 29 -19', P.snowD, 2);
      g.path('M23 -11 C24 -20 34 -23 42 -21 C48 -19 51 -13 50 -9 C45 -13 40 -10 36 -12 C31 -9 27 -13 23 -11 Z', P.snow);
    }
  }, S4);

  // ================= 池塘（flat，原点=椭圆中心） =================
  ART.add('pond', (g, v) => {
    const s = v.season, w = s === 'winter';
    const rim = { spring: ['#8cc672', '#a9d98c'], summer: ['#56a650', '#78c068'], autumn: ['#b08a3a', '#d4ad5c'], winter: [P.snowD, P.snow] }[s];
    g.ellipse(0, 3, 117, 36, rim[0]);
    g.ellipse(0, 0, 116, 34, rim[1]);
    if (!w) {
      g.ellipse(0, 1, 104, 28, P.waterD);
      g.ellipse(0, 4, 102, 25, P.water);
      g.alpha(0.75, () => g.ellipse(14, 10, 52, 8, P.waterL));
      g.stroke('M-62 -2 Q-52 -6 -42 -2', '#e6f7fd', 2.2);
      g.stroke('M-30 12 Q-22 9 -14 12', '#e6f7fd', 2);
      g.stroke('M48 -6 Q56 -9 64 -6', '#e6f7fd', 2);
    } else {
      g.ellipse(0, 1, 104, 28, P.iceD);
      g.ellipse(0, 3, 101, 25, P.ice);
      g.stroke('M-58 14 L-36 -8', '#ffffff', 4); g.stroke('M-46 16 L-32 2', '#ffffff', 2.5);
      g.stroke('M-8 -6 L6 4 L2 16', '#a3cfe6', 1.6);
      g.stroke('M6 4 L24 0 L36 7', '#a3cfe6', 1.6);
      g.stroke('M6 4 L12 -9', '#a3cfe6', 1.6);
      sparkle(g, 42, -8, 6.5); sparkle(g, 66, 10, 4); sparkle(g, -70, 2, 4.5);
      // 冰面边缘的积雪
      g.path('M-100 -6 Q-80 -24 -40 -26 Q-20 -18 -48 -16 Q-80 -14 -100 -6 Z', P.snow);
      g.path('M60 -22 Q90 -20 102 -4 Q86 -12 60 -22 Z', P.snow);
    }
    // 沿岸小石头
    const stones = [[196, 10, 6], [222, 9, 6], [292, 11, 6.5], [338, 8, 5.5], [22, 11, 7], [52, 8, 5.5], [146, 9, 6], [168, 7, 5]];
    for (const [deg, rx, ry] of stones) {
      const a = deg * Math.PI / 180, x = Math.cos(a) * 108, y = Math.sin(a) * 31;
      g.ellipse(x, y + 1.5, rx, ry, P.stoneD);
      g.ellipse(x - 0.5, y, rx - 1, ry - 1.2, P.stone);
      if (w) g.path(`M${x - rx + 1} ${y - 0.5} Q${x} ${y - ry - 2.5} ${x + rx - 1} ${y - 0.5} Q${x} ${y - ry * 0.4} ${x - rx + 1} ${y - 0.5} Z`, P.snow);
      else g.ellipse(x - rx * 0.35, y - ry * 0.35, rx * 0.32, ry * 0.28, P.stoneL);
    }
    // 左后方的矮芦苇
    const reedC = { spring: P.leafSpD, summer: P.leafSuD, autumn: '#b89a52', winter: '#b99a6a' }[s];
    const reeds = [['M-98 -18 Q-99 -28 -97 -38', -97, -38], ['M-90 -17 Q-89 -26 -86 -33', -86, -33], ['M-105 -14 Q-108 -22 -108 -28', -108, -28]];
    leaf(g, -94, -18, 16, 4, -2.1, reedC); leaf(g, -92, -18, 14, 4, -0.9, reedC);
    for (const [d, hx, hy] of reeds) {
      g.stroke(d, reedC, 2.6);
      g.ellipse(hx, hy + 2, 3, 6.5, s === 'spring' ? '#9c7a4f' : '#8a5a3b');
      if (w) g.circle(hx, hy - 4, 2.6, P.snow);
    }
    if (s === 'spring') {
      for (const [x, y, r] of [[-30, 8, 0.3], [-22, 13, -0.6], [36, -2, 0.9], [44, 4, 0.2]]) g.ellipse(x, y, 3.2, 2, P.blossom, r);
    }
    if (s === 'autumn') {
      leaf(g, 26, 8, 17, 7, -0.35, P.leafAu, P.leafAuD);
      leaf(g, -46, 10, 12, 5, 0.5, '#e5642f', '#b84a24');
    }
  }, S4);

  // ================= 小屋 =================
  ART.add('house', (g, v) => {
    const s = v.season, w = s === 'winter';
    // 烟囱（在屋顶后面）
    g.rect(26, -126, 16, 44, 2, '#c96a52');
    g.rect(35, -126, 7, 44, 1, '#a8513e');
    g.rect(23, -131, 22, 8, 3, '#8f4636');
    g.emit(34, -138, 'smoke');
    // 墙
    g.rect(-48, -80, 96, 80, 3, P.wall);
    g.rect(31, -80, 17, 80, 3, P.wallD);
    g.rect(-48, -78, 96, 6, 0, '#e2c69c');
    g.rect(-51, -8, 102, 8, 3, '#bca78a');
    g.line(-36, -4, 30, -4, '#a69276', 1.4);
    // 屋顶
    g.poly([-65, -69, 0, -127, 65, -69], P.roofD);
    rpoly(g, [-65, -74, 0, -132, 65, -74], P.roof, 6);
    for (const y of [-88, -104]) {
      const hw = 64 * (y + 132) / 58 - 8;
      let d = `M${-hw} ${y}`; const n = Math.max(2, Math.round(hw * 2 / 13));
      for (let i = 0; i < n; i++) { const x0 = -hw + (i * 2 * hw) / n, x1 = -hw + ((i + 1) * 2 * hw) / n; d += ` Q${(x0 + x1) / 2} ${y + 6} ${x1} ${y}`; }
      g.stroke(d, P.roofD, 2);
    }
    // 山墙圆窗（冬天等积雪画完再画，免得被雪盖住）
    const gable = () => {
      g.circle(0, -102, 9.5, P.woodL);
      g.circle(0, -102, 6.8, P.glass);
      g.line(0, -108.5, 0, -95.5, P.woodD, 1.6); g.line(-6.5, -102, 6.5, -102, P.woodD, 1.6);
    };
    if (!w) gable();
    g.light(0, -102, 11);
    // 窗
    for (const cx of [-30, 30]) {
      g.rect(cx - 11, -60, 22, 22, 3, P.woodL);
      g.rect(cx - 8.5, -57.5, 17, 17, 2, P.glass);
      g.poly([cx - 7, -45, cx + 2, -56, cx + 6, -56, cx - 3, -45], '#bfe0f0');
      g.line(cx, -58, cx, -40, P.woodD, 1.8); g.line(cx - 9, -49, cx + 9, -49, P.woodD, 1.8);
      g.light(cx, -49, 16);
      if (!w && s !== 'autumn') {
        g.rect(cx - 12, -38, 24, 5, 2, P.woodD);
        for (const [dx, c] of [[-7, P.red], [0, s === 'spring' ? P.pink : P.yellow], [7, P.red]]) {
          g.circle(cx + dx, -40, 3, c); g.circle(cx + dx, -40, 1.1, '#fff2b0');
        }
      }
    }
    // 门 + 门灯
    g.rect(-12.5, -44, 25, 44, [12.5, 12.5, 0, 0], '#8a5a3b');
    g.rect(-8.5, -36, 17, 14, 2, '#7a4d31'); g.rect(-8.5, -18, 17, 12, 2, '#7a4d31');
    g.circle(7, -20, 2, P.gold);
    g.rect(-15, -3, 30, 3, 1, '#a69276');
    g.line(0, -54, 0, -49, '#5b4a3e', 1.6);
    g.circle(0, -48.5, 3.2, P.gold);
    g.light(0, -48.5, 9);
    if (s === 'autumn') {
      g.ellipse(-25, -6, 8, 6, P.orange); g.ellipse(-28, -6, 4, 5.5, '#e27d2e'); g.ellipse(-22, -6, 4, 5.5, '#e27d2e');
      g.ellipse(-25, -6, 2.5, 5.8, P.orange); g.line(-25, -12, -23, -15, P.leafSuD, 2.2);
    }
    if (w) {
      let d = 'M0 -137 L63 -82';
      const xs = [63, 47, 31, 15, -1, -17, -33, -49, -63];
      for (let i = 1; i < xs.length; i++) d += ` Q${(xs[i - 1] + xs[i]) / 2} ${i % 2 ? -75 : -80} ${xs[i]} -83`;
      d += ' Z';
      g.path(d, P.snow); g.stroke('M-62 -83 L0 -137 L63 -82', P.snow, 4);
      g.stroke('M8 -84 Q25 -80 47 -84', P.snowD, 2);
      g.rect(21, -136, 26, 8, 4, P.snow);
      for (const cx of [-30, 30]) g.rect(cx - 12, -39, 24, 4, 2, P.snow);
      snowDrift(g, -40, 16, 6); snowDrift(g, 42, 14, 5);
      gable();
    }
  }, [{ season: 'summer' }, { season: 'winter' }, { season: 'autumn' }]);

  // ================= 篱笆 =================
  ART.add('fence', (g, v) => {
    const w = v.season === 'winter';
    g.rect(-60, -38, 120, 7, 3, P.woodD);
    g.rect(-60, -18, 120, 7, 3, P.woodD);
    if (w) g.rect(-59, -41, 118, 4, 2, P.snow);
    for (const x of [-48, -24, 0, 24, 48]) {
      g.rect(x - 7, -46, 14, 46, [7, 7, 1.5, 1.5], P.wood);
      g.path(`M${x + 2} -44.6 Q${x + 6} -43 ${x + 7} -38 L${x + 7} 0 L${x + 2} 0 Z`, P.woodD);
      g.line(x - 3.5, -38, x - 3.5, -8, P.woodL, 1.8);
      g.circle(x, -34.5, 1.2, P.ink); g.circle(x, -14.5, 1.2, P.ink);
      if (w) { g.ellipse(x, -46, 8.5, 4.5, P.snow); g.circle(x + 5, -42, 2.2, P.snow); }
    }
    if (w) { snowDrift(g, -30, 18, 5); snowDrift(g, 34, 16, 5); }
  }, [{ season: 'summer' }, { season: 'winter' }]);

  // ================= 小木桥 =================
  ART.add('bridge', (g, v) => {
    const w = v.season === 'winter';
    const yd = (x) => { const t = (x + 88) / 176; return -18 - 92 * t * (1 - t); };
    // 桥面（顶面浅色带 + 侧面拱）
    g.path('M-88 -18 Q0 -64 88 -18 L84 -25 Q0 -71 -84 -25 Z', w ? P.snow : P.woodL);
    g.path('M-88 0 L-88 -18 Q0 -64 88 -18 L88 0 L72 0 Q0 -46 -72 0 Z', P.wood);
    g.path('M-88 -7 Q0 -50 88 -7 L88 0 L72 0 Q0 -46 -72 0 L-88 0 Z', P.woodD);
    g.rect(-90, -8, 18, 8, 2, P.stoneD); g.rect(72, -8, 18, 8, 2, P.stoneD);
    for (let i = 1; i < 12; i++) {
      const x = -88 + i * 176 / 12, y = yd(x);
      g.line(x, y - 1, x + (x > 0 ? -1.5 : 1.5), y - 5.5, w ? P.snowD : P.woodD, 1.4);
    }
    if (w) g.stroke('M-86 -22 Q0 -68 86 -22', P.snow, 4);
    // 栏杆
    const posts = [-76, -38, 0, 38, 76];
    for (const x of posts) g.line(x, yd(x) - 2, x, yd(x) - 20, P.woodD, 5);
    g.stroke('M-80 -40 Q0 -84 80 -40', P.woodD, 5);
    g.stroke('M-80 -40 Q0 -84 80 -40', P.wood, 2);
    for (const x of posts) g.circle(x, yd(x) - 20, 3.6, P.wood);
    if (w) {
      g.at(0, -3.5, 0, 1, 1, () => g.stroke('M-80 -40 Q0 -84 80 -40', P.snow, 4));
      for (const x of posts) g.ellipse(x, yd(x) - 24, 4.5, 2.8, P.snow);
    }
  }, [{ season: 'summer' }, { season: 'winter' }]);

  // ================= 路灯 =================
  ART.add('lantern', (g, v) => {
    const w = v.season === 'winter';
    const post = '#55605b', postL = '#76827c';
    g.path('M-15 0 L-11 -9 L-1 -9 L3 0 Z', post);
    g.rect(-9, -114, 6, 106, 2, post);
    g.line(-7.5, -104, -7.5, -14, postL, 1.5);
    g.stroke('M-6 -111 Q-6 -124 5 -124 Q13 -124 13 -116', post, 4);
    g.line(13, -116, 13, -109, post, 2);
    // 灯
    g.poly([4, -103, 22, -103, 17, -110, 9, -110], post);
    g.rect(6, -103, 14, 19, 3, '#ffd978');
    g.rect(8, -101, 4, 14, 2, '#fff1bf');
    g.line(13, -103, 13, -84, post, 1.5);
    g.rect(5, -85, 16, 4, 1.5, post);
    g.circle(13, -79.5, 2, post);
    g.light(13, -93.5, 28, '#ffcf6b');
    if (w) {
      g.ellipse(13, -110.5, 9, 3.2, P.snow);
      g.path('M-8 -122 Q-4 -129 5 -128 Q11 -128 13 -124 Q6 -126 -1 -125 Q-6 -124 -8 -122 Z', P.snow);
      snowDrift(g, -6, 14, 5);
    }
  }, [{ season: 'summer' }, { season: 'winter' }]);

  // ================= 蘑菇（秋天下雨后） =================
  function shroom(g, x, sw, sh, rx, ry) {
    g.path(`M${x - sw / 2} 0 Q${x - sw / 2 - 1} ${-sh * 0.6} ${x - sw * 0.38} ${-sh} L${x + sw * 0.38} ${-sh} Q${x + sw / 2 + 1} ${-sh * 0.6} ${x + sw / 2} 0 Z`, '#f6ead6');
    g.path(`M${x + sw * 0.1} 0 Q${x + sw * 0.25} ${-sh * 0.6} ${x + sw * 0.2} ${-sh} L${x + sw * 0.38} ${-sh} Q${x + sw / 2 + 1} ${-sh * 0.6} ${x + sw / 2} 0 Z`, '#e2cfb2');
    const y = -sh;
    g.ellipse(x, y + 1, rx * 0.8, ry * 0.22, '#e8d4b4');
    dome(g, x, y, rx, ry, '#c2443a', 0.28);
    dome(g, x - 1.5, y - 1.2, rx - 2, ry - 1.8, P.red, 0.2);
    g.circle(x - rx * 0.45, y - ry * 0.45, rx * 0.17, '#fff6ee');
    g.circle(x + rx * 0.2, y - ry * 0.7, rx * 0.13, '#fff6ee');
    g.circle(x + rx * 0.55, y - ry * 0.22, rx * 0.11, '#fff6ee');
    g.ellipse(x - rx * 0.1, y - ry * 0.8, rx * 0.22, ry * 0.12, '#f48a7a', -0.2);
    g.light(x, y - ry * 0.45, 14, '#9ff5d0');
  }
  ART.add('mushroom', (g, v) => {
    const gc = GRASS[v.season] || GRASS.autumn;
    shroom(g, 17, 9, 13, 12, 10);
    shroom(g, -4, 12, 19, 19, 15);
    shroom(g, -23, 7, 8, 8.5, 7);
    blade(g, 6, 6, 10, 3, gc[1]); blade(g, -33, 6, 9, -4, gc[1]); blade(g, 29, 6, 8, 4, gc[1]);
    if (v.season === 'winter') g.path('M-18 -12 Q-4 -40 12 -34 Q-2 -34 -18 -12 Z', P.snow);
  }, [{ season: 'autumn' }, { season: 'summer' }]);

  // ================= 荷花（flat，原点=中心） =================
  function pad(g, cx, cy, rx, ry, a0, c, cd) {
    const k = g.ctx;
    k.beginPath(); k.moveTo(cx, cy); k.ellipse(cx, cy + 1.5, rx, ry, 0, a0 + 0.35, a0 + TAU - 0.05); k.closePath(); k.fillStyle = cd; k.fill();
    k.beginPath(); k.moveTo(cx, cy); k.ellipse(cx, cy, rx, ry, 0, a0 + 0.35, a0 + TAU - 0.05); k.closePath(); k.fillStyle = c; k.fill();
    for (const a of [0.9, 1.9, 2.9, 3.9, 4.9]) g.line(cx, cy, cx + Math.cos(a0 + a) * rx * 0.75, cy + Math.sin(a0 + a) * ry * 0.75, cd, 1.2);
  }
  ART.add('lotus', (g, v) => {
    pad(g, 16, 5, 18, 8, -0.5, P.leafSu, P.leafSuD);
    pad(g, -12, 2, 26, 11, -1.1, P.leafSuL, P.leafSu);
    // 花
    const fx = -8, fy = -1;
    const petal = (ang, len, c) => g.at(fx, fy, ang, 1, 1, () => g.path(`M0 0 Q${-len * 0.42} ${-len * 0.5} 0 ${-len} Q${len * 0.42} ${-len * 0.5} 0 0 Z`, c));
    for (const a of [-1.15, 1.15]) petal(a, 18, P.blossomD);
    for (const a of [-0.7, 0.7]) petal(a, 22, P.pink);
    g.ellipse(fx, fy - 6, 5, 3, P.yellow);
    for (const a of [-0.3, 0.3]) petal(a, 25, P.blossom);
    petal(0, 21, P.blossomL);
    g.at(fx, fy, 0, 1, 1, () => g.line(0, -3, 0, -17, P.blossom, 1.3));
  }, [{ season: 'summer' }]);

  // ================= 小船（原点=船底中心水线） =================
  ART.add('boat', (g, v) => {
    // 远侧船帮 + 船舱
    g.path('M-58 -30 Q0 -42 58 -30 Q0 -20 -58 -30 Z', P.woodD);
    g.rect(-12, -32, 24, 5, 1.5, P.woodL);
    // 桨（柄在船里，桨叶在船右外侧）
    g.stroke('M-30 -50 L20 -26', P.woodD, 4);
    // 船身
    g.path('M-58 -30 Q0 -18 58 -30 Q48 -2 26 0 L-26 0 Q-48 -2 -58 -30 Z', P.wood);
    g.path('M20 -21 Q44 -24 58 -30 Q48 -2 26 0 L12 0 Q30 -8 20 -21 Z', P.woodD);
    g.stroke('M-50 -14 Q0 -5 50 -14', P.blue, 4);
    g.stroke('M-58 -30 Q0 -18 58 -30', P.woodL, 3);
    g.line(-30, -22, -28, -6, P.woodD, 1.4); g.line(0, -18, 0, -3, P.woodD, 1.4); g.line(30, -22, 28, -6, P.woodD, 1.4);
    g.stroke('M20 -26 L44 -12', P.woodD, 4);
    g.ellipse(50, -8, 10, 4.5, P.woodD, 0.5);
    g.ellipse(49, -9, 8.5, 3.2, P.wood, 0.5);
    g.circle(-30, -50, 2.4, P.woodD);
  }, [{ season: 'summer' }]);

  // ================= 雪人 =================
  function ball(g, x, y, r) { g.circle(x, y, r, P.snowD); g.circle(x - 2, y - 2, r - 2, P.snow); }
  ART.add('snowman', (g, v) => {
    const br = P.trunkD;
    g.stroke('M-15 -64 L-35 -79', br, 3); g.stroke('M-28 -74 L-31 -84', br, 3); g.stroke('M-31 -77 L-39 -76', br, 2.6);
    g.stroke('M15 -64 L35 -77', br, 3); g.stroke('M28 -72 L34 -65', br, 3); g.stroke('M31 -75 L37 -83', br, 2.6);
    g.ellipse(0, -2, 32, 5, P.snowD);
    ball(g, 0, -26, 26);
    ball(g, 0, -60, 18);
    ball(g, 0, -88, 14);
    // 围巾
    g.rect(-15, -78, 30, 8, 4, P.red);
    g.path('M6 -73 L15 -56 L8.5 -54 L1 -71 Z', P.red);
    g.line(9, -60, 14, -61, '#b8412f', 1.5); g.line(7, -64, 12.5, -65, '#b8412f', 1.5);
    g.line(-8, -77, -9, -71, '#b8412f', 1.5); g.line(2, -77, 1, -71, '#b8412f', 1.5);
    // 脸
    g.eye(-5, -91, 2.2); g.eye(5, -91, 2.2);
    g.poly([0, -87.5, 13, -85, 0, -83], P.orange);
    g.blush(-8, -84, 2.8, 1.8); g.blush(9, -83, 2.4, 1.6);
    for (const [x, y] of [[-5, -80.5], [-2, -79.2], [2, -79.2], [5, -80.5]]) g.circle(x, y, 1, P.ink);
    g.circle(0, -64, 2.2, P.ink); g.circle(0, -55, 2.2, P.ink); g.circle(0, -33, 2.4, P.ink);
    // 水桶帽
    g.at(2, -100, 0.18, 1, 1, () => {
      g.poly([-11, 0, 11, 0, 8, -15, -8, -15], '#5f9fd6');
      g.poly([3, 0, 11, 0, 8, -15, 4, -15], '#4a86bd');
      g.rect(-12.5, -2, 25, 4, 2, '#4a86bd');
      g.ellipse(0, -15, 8, 2.2, '#7fb6e4');
    });
  }, [{ season: 'winter' }]);
})();
