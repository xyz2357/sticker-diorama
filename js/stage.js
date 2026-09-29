// stage.js — 舞台感：幕布、追光；设置项说明
// 在 world.js 之后、rules.js 之前加载。render() 会调 PB.drawSpot / PB.drawCurtain。
(function () {
  'use strict';
  const PB = window.PB;
  const { OPEN, clamp, lerp, now, hash } = PB;
  const TAU = Math.PI * 2;

  // 设置面板里的开关（顺序即显示顺序）
  // [键, 名字, 说明, 分组]
  PB.OPT_DEFS = [
    ['react', '贴纸互动', '贴纸之间会起反应：下雨冒青蛙、猫追老鼠、猫吓跑小鸟；太阳月亮跟着白天黑夜升起落下。关掉以后贴纸都待在原地不动，想怎么摆就怎么摆（靠反应才能找到的图鉴和贴纸也就找不到了）。', '玩法'],
    ['paper', '纸片动作', '会动的东西都一格一格地挪，带一点歪斜和抖动，像有人拿着纸片在演。关掉就是平滑动画。', '舞台感'],
    ['entrance', '舞台出场', '新出现的东西从侧幕走出来、从地板下升上来、或者从上面吊下来；变身像翻卡片。关掉就是原来的弹出放大。', '舞台感'],
    ['curtain', '幕布', '盒口挂上帷幔和两侧的幕布，打开页面和清空盒子时会拉幕。', '舞台感'],
    ['spot', '追光', '演小戏的时候打一束光跟着演员，其他地方稍微暗一点。', '舞台感'],
    ['rods', '露出木棍', '演员被拿着走的时候，下面露出一截木棍；吊着的露一根线。', '舞台感'],
  ];
  const stepped = (e, n) => PB.opt.paper ? Math.floor(e * n) / n : e;

  // ---------- 幕布 ----------
  // open：0 = 合上，1 = 拉开（系在两边）
  const cur = { from: 1, to: 1, t0: -99, dur: 1 };
  function curOpen(t) {
    const e = stepped(clamp((t - cur.t0) / cur.dur, 0, 1), 10);
    return lerp(cur.from, cur.to, e * e * (3 - 2 * e));
  }
  PB.curtainTo = (to, dur = 1.3) => { cur.from = curOpen(now()); cur.to = to; cur.t0 = now(); cur.dur = dur; };
  PB.curtainSet = v => { cur.from = cur.to = v; cur.t0 = -99; };
  PB.curtainOpen = () => curOpen(now());

  const RED = '#b8323a', RED_D = '#8a2029', RED_L = '#d75a5c', GOLD = '#e8b64c', GOLD_D = '#b98526', INK = '#4a3b32';
  const VAL_H = 34;                           // 帷幔高度
  const TIE = 0.64;                           // 系带的高度（从上往下的比例）
  const TOP = OPEN.y0 + VAL_H - 4, BOT = OPEN.y1;
  const MID = (OPEN.x0 + OPEN.x1) / 2;

  // 一侧幕布的内边缘 x（f = 从上到下 0..1）
  function innerEdge(side, f, open) {
    // 拉开时：上宽、在系带处收窄、下摆再散开
    const pinch = f < TIE ? lerp(78, 30, Math.pow(f / TIE, 1.3)) : lerp(30, 64, (f - TIE) / (1 - TIE));
    const openX = side < 0 ? OPEN.x0 + pinch : OPEN.x1 - pinch;
    return lerp(MID - side * 3, openX, open);   // 合上时两片交叠一点，不留缝
  }
  function panelPath(ctx, side, open) {
    const outer = side < 0 ? OPEN.x0 - 2 : OPEN.x1 + 2;
    ctx.beginPath();
    ctx.moveTo(outer, TOP);
    for (let i = 0; i <= 24; i++) { const f = i / 24; ctx.lineTo(innerEdge(side, f, open), lerp(TOP, BOT, f)); }
    ctx.lineTo(outer, BOT);
    ctx.closePath();
  }
  function drawPanel(ctx, side, open, t) {
    const outer = side < 0 ? OPEN.x0 - 2 : OPEN.x1 + 2;
    ctx.save();
    panelPath(ctx, side, open);
    ctx.fillStyle = RED; ctx.fill();
    ctx.clip();
    // 褶子：在外边缘和内边缘之间按比例排几道深浅条纹
    const sway = PB.opt.paper ? (hash(Math.floor(t * 5) + side * 7) - 0.5) * 2 : Math.sin(t * 1.3 + side) * 1;
    for (let i = 1; i < 7; i++) {
      const fr = i / 7;
      ctx.beginPath();
      for (let j = 0; j <= 20; j++) {
        const f = j / 20, xi = innerEdge(side, f, open);
        const x = lerp(outer, xi, fr) + sway * f, y = lerp(TOP, BOT, f);
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = i % 2 ? RED_D : RED_L; ctx.globalAlpha = i % 2 ? 0.5 : 0.35;
      ctx.lineWidth = i % 2 ? 7 : 4; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 下摆金边
    ctx.fillStyle = GOLD; ctx.fillRect(Math.min(outer, MID) - 10, BOT - 12, Math.abs(MID - outer) + 20, 12);
    ctx.fillStyle = GOLD_D; ctx.fillRect(Math.min(outer, MID) - 10, BOT - 12, Math.abs(MID - outer) + 20, 2.5);
    ctx.restore();
    panelPath(ctx, side, open);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    // 拉开以后在收窄处系一根金绳
    if (open > 0.85) {
      const y = lerp(TOP, BOT, TIE), xi = innerEdge(side, TIE, open);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(outer, y - 3); ctx.quadraticCurveTo((outer + xi) / 2, y + 6, xi + side * 4, y); ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 4.5; ctx.stroke();
      ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(xi + side * 5, y + 2, 5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xi + side * 2, y + 6); ctx.lineTo(xi + side * 8, y + 6); ctx.lineTo(xi + side * 7, y + 22); ctx.lineTo(xi + side * 3, y + 22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  function drawValance(ctx) {
    const x0 = OPEN.x0 - 2, x1 = OPEN.x1 + 2, y0 = OPEN.y0 - 2, h = VAL_H;
    const n = 12, w = (x1 - x0) / n;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y0 + h - 10);
    for (let i = n; i > 0; i--) {
      const xa = x0 + i * w, xb = xa - w;
      ctx.quadraticCurveTo((xa + xb) / 2, y0 + h + 12, xb, y0 + h - 10);
    }
    ctx.closePath();
    ctx.fillStyle = RED_D; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = RED; ctx.fillRect(x0, y0, x1 - x0, h - 12);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x0 + i * w + w * 0.18, y0, w * 0.18, h + 12);
    }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    // 金色镶边和流苏
    ctx.fillStyle = GOLD; ctx.fillRect(x0, y0 + 6, x1 - x0, 4);
    for (let i = 1; i < n; i++) {
      const x = x0 + i * w, y = y0 + h - 10;
      ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y + 2, 4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3, y + 5); ctx.lineTo(x + 3, y + 5); ctx.lineTo(x + 4, y + 17); ctx.lineTo(x - 4, y + 17); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  PB.drawCurtain = function (ctx, t) {
    if (!PB.opt.curtain) return;
    const open = curOpen(t);
    drawPanel(ctx, -1, open, t);
    drawPanel(ctx, 1, open, t);
    drawValance(ctx);
  };

  // ---------- 追光 ----------
  // 有小戏在演时，光圈跟着演员（一格一格地挪），其他地方压暗一点
  const spot = { I: 0, x: 0, y: 0, r: 160, step: -1 };
  PB.drawSpot = function (ctx, t) {
    const actors = PB.opt.spot && PB.spotActors ? PB.spotActors() : [];
    const step = Math.floor(t * 8);
    if (step !== spot.step) {
      spot.step = step;
      const target = actors.length ? 1 : 0;
      spot.I += clamp(target - spot.I, -0.25, 0.25);
      if (actors.length) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const a of actors) {
          const b = PB.boxOf(a), p = PB.posOf(a, t), dx = p.x - a.x, dy = p.y - a.y;
          x0 = Math.min(x0, b.x + dx); x1 = Math.max(x1, b.x + b.w + dx);
          y0 = Math.min(y0, b.y + dy); y1 = Math.max(y1, b.y + b.h + dy);
        }
        const tx = (x0 + x1) / 2, ty = (y0 + y1) / 2, tr = clamp(Math.max(x1 - x0, (y1 - y0) * 1.2) * 0.62 + 55, 110, 340);
        const first = spot.I <= 0.26;
        spot.x = first ? tx : lerp(spot.x, tx, 0.6);
        spot.y = first ? ty : lerp(spot.y, ty, 0.6);
        spot.r = first ? tr : lerp(spot.r, tr, 0.5);
      }
    }
    if (spot.I <= 0.01) return;
    const I = spot.I, r = spot.r;
    ctx.save();
    // 其余地方压暗
    ctx.translate(spot.x, spot.y); ctx.scale(1, 0.8);
    const g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.25);
    g.addColorStop(0, 'rgba(18,12,30,0)'); g.addColorStop(1, `rgba(18,12,30,${0.26 * I})`);
    ctx.fillStyle = g; ctx.fillRect(-3000, -3000, 6000, 6000);
    ctx.restore();
    // 从盒子上方打下来的一道很淡的光柱
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bx = spot.x * 0.7 + MID * 0.3, lg = ctx.createLinearGradient(0, OPEN.y0, 0, spot.y);
    lg.addColorStop(0, `rgba(255,240,200,${0.07 * I})`); lg.addColorStop(1, `rgba(255,240,200,${0.02 * I})`);
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.moveTo(bx - 26, OPEN.y0); ctx.lineTo(bx + 26, OPEN.y0); ctx.lineTo(spot.x + r * 0.7, spot.y); ctx.lineTo(spot.x - r * 0.7, spot.y); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
})();
