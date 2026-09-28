// art-core.js — 贴纸绘制基础：调色板、画笔、烘焙（墨线描边 + 白色模切边 + 投影）
// 普通 <script> 加载（不用 ES module），这样双击 index.html 走 file:// 也能跑。
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  // 统一调色板：暖色、低饱和一点的扁平插画风
  const PAL = {
    ink: '#4a3b32', white: '#fffdf8',
    trunk: '#9a6a45', trunkD: '#7b5236', trunkL: '#b7865c',
    leafSp: '#a9d98c', leafSpD: '#8cc672',
    leafSu: '#63b85a', leafSuD: '#4c9d4a', leafSuL: '#8ad17a',
    leafAu: '#f29a3f', leafAuD: '#de6f33', leafAuL: '#f7c55a',
    blossom: '#f8c3d3', blossomD: '#ee9fb8', blossomL: '#fde3ea',
    pine: '#4f9a6a', pineD: '#3d7f57', pineL: '#6cb483',
    snow: '#ffffff', snowD: '#dce8f3',
    water: '#7cc8e8', waterL: '#b6e5f6', waterD: '#5aaed4',
    ice: '#e2f3fb', iceD: '#b9dcef',
    wall: '#f6e3c4', wallD: '#e5c9a0', roof: '#d9624e', roofD: '#b44b3a',
    wood: '#d9a86a', woodD: '#b8854c', woodL: '#ebc590',
    stone: '#aaa49b', stoneD: '#8c857c', stoneL: '#cbc5bc',
    glass: '#8cc4e0', gold: '#ffcf4a', goldD: '#f0a92e',
    pink: '#f7a8b8', red: '#e25b4a', orange: '#f39a3d', yellow: '#ffd84d',
    purple: '#b48fd8', blue: '#6fb5e0', cream: '#fff4dc',
    blush: 'rgba(255,120,120,0.45)',
  };

  // ---------- 画笔 ----------
  // 所有坐标都是贴纸本地单位；烘焙时会乘以 S 放大。
  class Painter {
    constructor(ctx) { this.ctx = ctx; this.lights = []; this.emitters = []; }
    _fill(c) { this.ctx.fillStyle = c; this.ctx.fill(); return this; }
    circle(x, y, r, c) { const k = this.ctx; k.beginPath(); k.arc(x, y, r, 0, TAU); return this._fill(c); }
    ellipse(x, y, rx, ry, c, rot = 0) { const k = this.ctx; k.beginPath(); k.ellipse(x, y, rx, ry, rot, 0, TAU); return this._fill(c); }
    rect(x, y, w, h, r, c) { const k = this.ctx; k.beginPath(); k.roundRect(x, y, w, h, r); return this._fill(c); }
    // pts: [x1,y1,x2,y2,...]
    poly(pts, c) {
      const k = this.ctx; k.beginPath(); k.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) k.lineTo(pts[i], pts[i + 1]);
      k.closePath(); return this._fill(c);
    }
    // SVG path 字符串，填充
    path(d, c) { this.ctx.fillStyle = c; this.ctx.fill(new Path2D(d)); return this; }
    // SVG path 字符串，描线
    stroke(d, c, w = 3) {
      const k = this.ctx; k.strokeStyle = c; k.lineWidth = w; k.lineCap = 'round'; k.lineJoin = 'round';
      k.stroke(new Path2D(d)); return this;
    }
    line(x1, y1, x2, y2, c, w = 3) {
      const k = this.ctx; k.beginPath(); k.moveTo(x1, y1); k.lineTo(x2, y2);
      k.strokeStyle = c; k.lineWidth = w; k.lineCap = 'round'; k.stroke(); return this;
    }
    arc(x, y, r, a0, a1, c, w = 3) {
      const k = this.ctx; k.beginPath(); k.arc(x, y, r, a0, a1);
      k.strokeStyle = c; k.lineWidth = w; k.lineCap = 'round'; k.stroke(); return this;
    }
    // 小黑豆眼 + 高光
    eye(x, y, r = 2.6) { this.circle(x, y, r, PAL.ink); this.circle(x - r * 0.35, y - r * 0.4, r * 0.38, '#fff'); return this; }
    blush(x, y, rx = 4, ry = rx * 0.6) { return this.ellipse(x, y, rx, ry, PAL.blush); }
    smile(x, y, w = 3.5) { return this.arc(x, y - w * 0.4, w, 0.2 * Math.PI, 0.8 * Math.PI, PAL.ink, 1.6); }
    // 变换块：g.at(x, y, rot, sx, sy, () => {...})
    at(x, y, rot, sx, sy, fn) {
      const k = this.ctx; k.save(); k.translate(x, y); if (rot) k.rotate(rot);
      if (sx !== undefined) k.scale(sx, sy === undefined ? sx : sy);
      fn(); k.restore(); return this;
    }
    alpha(a, fn) { const k = this.ctx; const o = k.globalAlpha; k.globalAlpha = o * a; fn(); k.globalAlpha = o; return this; }
    // 不画，只登记：夜里发光的位置（窗户、灯）
    light(x, y, r, color = '#ffd36b') { this.lights.push({ x, y, r, color }); return this; }
    // 不画，只登记：粒子发射点（烟囱 smoke 等）
    emit(x, y, type) { this.emitters.push({ x, y, type }); return this; }
  }

  // ---------- 烘焙 ----------
  const S = 2;              // 烘焙分辨率：每单位 2px
  const R_EDGE = 7.4;       // 模切边外面那圈浅灰细边
  const R_WHITE = 6.4;      // 白色模切边
  const R_INK = 1.9;        // 墨线外轮廓
  const SZ = 1000, O = 500; // 草稿画布尺寸与原点（可画 ±250 单位）

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // 以 src 的 alpha 为形状，向外膨胀 r 像素，返回黑色剪影
  function dilate(src, r) {
    const c = mk(src.width, src.height), k = c.getContext('2d');
    k.drawImage(src, 0, 0);
    const rings = r > 6 ? [1, 0.66, 0.33] : [1, 0.5];
    for (const f of rings) {
      const rr = r * f, n = Math.max(8, Math.ceil(rr * 5));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        k.drawImage(src, Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }
    return c;
  }
  function tint(src, color) {
    const c = mk(src.width, src.height), k = c.getContext('2d');
    k.drawImage(src, 0, 0);
    k.globalCompositeOperation = 'source-in'; k.fillStyle = color; k.fillRect(0, 0, c.width, c.height);
    return c;
  }

  const fns = {};       // id -> (g, v) => void
  const previews = {};  // id -> [v, ...] 预览表里要展示的变体
  const cache = new Map();

  function keyOf(id, v) {
    const st = v && v.state ? Object.keys(v.state).filter(k => v.state[k]).sort().join(',') : '';
    return `${id}|${(v && v.season) || 'summer'}|${(v && v.variant) || ''}|${st}`;
  }

  // 返回 { img, shadow, ax, ay, w, h, S, lights, emitters, mask }
  // ax/ay：本地原点 (0,0) 在 img 里的像素位置；本地 (u,v) -> img 像素 (ax+u*S, ay+v*S)
  function bake(id, v) {
    v = v || {};
    if (!v.season) v = Object.assign({ season: 'summer' }, v);
    if (!v.state) v = Object.assign({ state: {} }, v);
    const key = keyOf(id, v);
    const hit = cache.get(key);
    if (hit) return hit;
    const fn = fns[id];
    if (!fn) throw new Error('no art: ' + id);

    const c = mk(SZ, SZ), k = c.getContext('2d', { willReadFrequently: true });
    k.translate(O, O); k.scale(S, S);
    const g = new Painter(k);
    fn(g, v);

    // 找出实际画到的范围
    const d = k.getImageData(0, 0, SZ, SZ).data;
    let x0 = SZ, y0 = SZ, x1 = -1, y1 = -1;
    for (let y = 0; y < SZ; y++) {
      const row = y * SZ * 4;
      for (let x = 0; x < SZ; x++) {
        if (d[row + x * 4 + 3] > 8) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) { x0 = O; y0 = O; x1 = O + 1; y1 = O + 1; }
    const pad = Math.ceil(R_EDGE * S) + 4;
    const w = x1 - x0 + 1 + pad * 2, h = y1 - y0 + 1 + pad * 2;
    const sx = x0 - pad, sy = y0 - pad;

    const art = mk(w, h);
    art.getContext('2d').drawImage(c, sx, sy, w, h, 0, 0, w, h);

    const edgeSil = dilate(art, R_EDGE * S);
    const whiteSil = dilate(art, R_WHITE * S);
    const inkSil = dilate(art, R_INK * S);

    const out = mk(w, h), ok = out.getContext('2d', { willReadFrequently: true });
    ok.drawImage(tint(edgeSil, '#d9cdb9'), 0, 0);
    ok.drawImage(tint(whiteSil, PAL.white), 0, 0);
    ok.drawImage(tint(inkSil, PAL.ink), 0, 0);
    ok.drawImage(art, 0, 0);

    // 投影：模切外形模糊
    const blur = 7, sp = blur * 2;
    const shadow = mk(w + sp * 2, h + sp * 2), sk = shadow.getContext('2d');
    sk.filter = `blur(${blur}px)`;
    sk.drawImage(tint(edgeSil, '#2b1d12'), sp, sp);

    // 点选用的 alpha 遮罩
    const od = ok.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = od[i * 4 + 3];

    const res = {
      img: out, shadow, shadowPad: sp, ax: O - sx, ay: O - sy, w, h, S,
      lights: g.lights, emitters: g.emitters, mask,
      // 本地单位下的包围盒（含模切边）
      box: { x: -(O - sx) / S, y: -(O - sy) / S, w: w / S, h: h / S },
    };
    cache.set(key, res);
    return res;
  }

  // 注册一张贴纸的画法。pv：预览表要展示的变体数组，如 [{season:'spring'},{season:'winter'}]
  function add(id, fn, pv) { fns[id] = fn; previews[id] = pv || [{ season: 'summer' }]; }

  const SEASONS4 = [{ season: 'spring' }, { season: 'summer' }, { season: 'autumn' }, { season: 'winter' }];

  window.ART = { PAL, TAU, Painter, bake, add, fns, previews, keyOf, cache, S, SEASONS4, clear: () => cache.clear() };
})();
