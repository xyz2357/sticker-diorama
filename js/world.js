// world.js — 纸盒几何、贴纸定义、场景状态、粒子、渲染
(function () {
  'use strict';
  const PB = window.PB = window.PB || {};
  const TAU = Math.PI * 2;

  // ---------- 几何 ----------
  // 世界坐标 1280×760。盒口（前沿内侧）+ 后墙 + 地面梯形，地面越靠前贴纸越大。
  const W = 1280, H = 760;
  // 景深 = 后墙宽度 / 盒口宽度：越小盒子越深（玩家可以在滑块上调）。贴纸的纵深缩放由它推出来，两者始终一致
  const DEPTH_MIN = 0.5, DEPTH_MAX = 0.9, DEPTH_DEFAULT = 0.7;
  const K_FRONT = 1.35;             // 贴在最前沿时的缩放
  const OPEN = { x0: 40, y0: 40, x1: 1240, y1: 740 };
  const CX = (OPEN.x0 + OPEN.x1) / 2;
  const BACK = { x0: 0, y0: 88, x1: 0, y1: 388 };   // x0 / x1 随景深变（原地改，别处拿到的引用一直有效）
  const FY0 = BACK.y1, FY1 = OPEN.y1;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const floorT = y => clamp((y - FY0) / (FY1 - FY0), 0, 1);
  // 地面两条侧边的交点就是消失点；站在地上的东西，大小和它离消失点的距离成正比
  let depth = DEPTH_DEFAULT, VY = 0;
  const depthK = y => K_FRONT * (clamp(y, FY0, FY1) - VY) / (FY1 - VY);
  const floorX = y => { const t = floorT(y); return [lerp(BACK.x0, OPEN.x0, t), lerp(BACK.x1, OPEN.x1, t)]; };
  const FLOOR_PTS = [], LWALL = [], RWALL = [], CEIL = [], STARS = [];
  function applyDepth(r) {
    depth = clamp(r, DEPTH_MIN, DEPTH_MAX);
    const bw = (OPEN.x1 - OPEN.x0) * depth;
    BACK.x0 = Math.round(CX - bw / 2); BACK.x1 = Math.round(CX + bw / 2);
    VY = FY1 - (FY1 - FY0) / (1 - depth);
    FLOOR_PTS.splice(0, 8, BACK.x0, BACK.y1, BACK.x1, BACK.y1, OPEN.x1, OPEN.y1, OPEN.x0, OPEN.y1);
    LWALL.splice(0, 8, OPEN.x0, OPEN.y0, BACK.x0, BACK.y0, BACK.x0, BACK.y1, OPEN.x0, OPEN.y1);
    RWALL.splice(0, 8, OPEN.x1, OPEN.y0, BACK.x1, BACK.y0, BACK.x1, BACK.y1, OPEN.x1, OPEN.y1);
    CEIL.splice(0, 8, OPEN.x0, OPEN.y0, OPEN.x1, OPEN.y0, BACK.x1, BACK.y0, BACK.x0, BACK.y0);
    const rr = seeded(77);
    STARS.length = 0;
    for (let i = 0; i < 70; i++) STARS.push({ x: lerp(BACK.x0 + 8, BACK.x1 - 8, rr()), y: lerp(BACK.y0 + 8, 290, Math.pow(rr(), 1.3)), s: 0.6 + rr() * 1.4, p: rr() * 9 });
  }
  applyDepth(DEPTH_DEFAULT);

  // ---------- 贴纸定义 ----------
  // zone: ground 站在地上（原点=接地点，按纵深缩放）| flat 贴地（池塘）| air 挂在盒子里 | celestial 画在后墙上
  // light: 各时段的发光强度；emissive: 夜里自身也亮
  const DEFS = {
    tree: { name: '大树', tab: 'nature', zone: 'ground', base: 1, anim: 'sway', plant: 1 },
    pine: { name: '松树', tab: 'nature', zone: 'ground', base: 1, anim: 'sway', plant: 1 },
    sapling: { name: '树苗', tab: 'nature', zone: 'ground', base: 1, anim: 'sway', plant: 1 },
    flowers: { name: '花丛', tab: 'nature', zone: 'ground', base: 1, anim: 'sway', plant: 1 },
    grass: { name: '草丛', tab: 'nature', zone: 'ground', base: 1, anim: 'sway', plant: 1 },
    rock: { name: '石头', tab: 'nature', zone: 'ground', base: 1 },
    pond: { name: '池塘', tab: 'nature', zone: 'flat', base: 1, foot: { rx: 108, ry: 33 } },
    mushroom: { name: '蘑菇', tab: 'nature', zone: 'ground', plant: 1, light: { night: 1 } },
    lotus: { name: '荷花', tab: 'nature', zone: 'flat', plant: 1, anim: 'bob' },
    house: { name: '小屋', tab: 'build', zone: 'ground', base: 1, light: { dusk: 0.55, night: 1 } },
    fence: { name: '篱笆', tab: 'build', zone: 'ground', base: 1 },
    bridge: { name: '小木桥', tab: 'build', zone: 'ground', base: 1 },
    lantern: { name: '路灯', tab: 'build', zone: 'ground', base: 1, light: { dusk: 0.6, night: 1 }, pool: 1 },
    bench: { name: '长椅', tab: 'build', zone: 'ground', base: 1 },
    boat: { name: '小船', tab: 'build', zone: 'ground' },
    snowman: { name: '雪人', tab: 'build', zone: 'ground' },
    duck: { name: '鸭子', tab: 'animal', zone: 'ground', base: 1, animal: 1, voice: 'quack' },
    bird: { name: '小鸟', tab: 'animal', zone: 'ground', base: 1, animal: 1, anim: 'hop', voice: 'chirp' },
    rabbit: { name: '兔子', tab: 'animal', zone: 'ground', base: 1, animal: 1, anim: 'hop2' },
    cat: { name: '猫', tab: 'animal', zone: 'ground', base: 1, animal: 1, voice: 'meow' },
    frog: { name: '青蛙', tab: 'animal', zone: 'ground', animal: 1, voice: 'croak' },
    ducklings: { name: '小鸭', tab: 'animal', zone: 'ground', animal: 1, voice: 'chirp' },
    butterfly: { name: '蝴蝶', tab: 'animal', zone: 'air', animal: 1, anim: 'flap' },
    firefly: { name: '萤火虫', tab: 'animal', zone: 'air', animal: 1, anim: 'wander', light: { dusk: 0.5, night: 1 }, emissive: 1 },
    birdfly: { name: '飞鸟', tab: 'animal', zone: 'air', animal: 1, anim: 'glide', voice: 'chirp' },
    cloud: { name: '白云', tab: 'sky', zone: 'air', base: 1, anim: 'float' },
    raincloud: { name: '雨云', wname: '雪云', tab: 'sky', zone: 'air', base: 1, anim: 'float' },
    sun: { name: '太阳', tab: 'sky', zone: 'celestial', base: 1, anim: 'pulse', light: { day: 0.35, dusk: 0.7 }, emissive: 1 },
    moon: { name: '月亮', tab: 'sky', zone: 'celestial', base: 1, anim: 'float', light: { dusk: 0.5, night: 1 }, emissive: 1 },
    rainbow: { name: '彩虹', tab: 'sky', zone: 'celestial', zo: -1 },
    star: { name: '星星', tab: 'sky', zone: 'celestial', anim: 'twinkle', light: { dusk: 0.4, night: 1 }, emissive: 1 },
    sheep: { name: '绵羊', tab: 'animal', zone: 'ground', base: 1, animal: 1, voice: 'baa' },
    windmill: { name: '风车', tab: 'build', zone: 'ground', base: 1, light: { dusk: 0.5, night: 1 } },
    scarecrow: { name: '稻草人', tab: 'build', zone: 'ground', base: 1, anim: 'sway' },
    pumpkin: { name: '南瓜', tab: 'nature', zone: 'ground', plant: 1, light: { dusk: 0.5, night: 1 } },
    hedgehog: { name: '刺猬', tab: 'animal', zone: 'ground', animal: 1, anim: 'hop' },
    snail: { name: '蜗牛', tab: 'animal', zone: 'ground', animal: 1 },
    mouse: { name: '老鼠', tab: 'animal', zone: 'ground', base: 1, animal: 1, voice: 'squeak' },
  };
  const TABS = [
    { id: 'nature', name: '自然' }, { id: 'build', name: '小物' },
    { id: 'animal', name: '动物' }, { id: 'sky', name: '天空' },
  ];
  const nameOf = (id, season) => (season === 'winter' && DEFS[id].wname) || DEFS[id].name;

  // 美术文件缺了某张时先用占位，方便单独调引擎
  function ensureArt() {
    for (const id of Object.keys(DEFS)) {
      if (ART.fns[id]) continue;
      ART.add(id, (g) => {
        const z = DEFS[id].zone;
        const cy = z === 'ground' ? -26 : 0;
        g.circle(0, cy, 26, '#e8d9c0'); g.circle(0, cy, 20, '#f6ecdc');
        g.ctx.fillStyle = '#4a3b32'; g.ctx.font = 'bold 13px sans-serif'; g.ctx.textAlign = 'center';
        g.ctx.fillText(DEFS[id].name, 0, cy + 5);
      });
    }
  }

  // ---------- 场景 ----------
  const scene = { season: 'summer', time: 'day', items: [], uid: 1 };
  const now = () => performance.now() / 1000;

  function mkItem(id, x, y, o = {}) {
    return {
      uid: scene.uid++, id, x, y, s: o.s || 1, flip: !!o.flip,
      state: o.state || {}, flags: o.flags || {},
      pop: o.pop ? { type: o.pop, t0: now() } : null,
    };
  }
  const live = () => scene.items.filter(s => !s.dying);
  const all = id => scene.items.filter(s => s.id === id && !s.dying);

  function kOf(st) {
    if (st.kLock) return st.kLock;
    const z = DEFS[st.id].zone;
    return (z === 'ground' || z === 'flat' ? depthK(st.y) : 1) * st.s;
  }

  function pondAt(x, y, grow = 1) {
    for (const p of all('pond')) {
      const k = kOf(p), f = DEFS.pond.foot;
      const dx = (x - p.x) / (f.rx * k * grow), dy = (y - p.y) / (f.ry * k * grow);
      if (dx * dx + dy * dy < 1) return p;
    }
    return null;
  }

  function variantOf(st, season) {
    if (st.id === 'duck' || st.id === 'ducklings') {
      if (st.tw || st === PB.dragItem) return '';
      const p = pondAt(st.x, st.y);
      if (p) return season === 'winter' ? (st.id === 'duck' ? 'skate' : '') : 'swim';
    }
    return '';
  }
  function bakeOf(st, season) {
    season = season || scene.season;
    return ART.bake(st.id, { season, variant: variantOf(st, season), state: st.state });
  }

  // ---------- 动画 ----------
  const easeOutBack = e => { const c = 1.9; return 1 + (c + 1) * Math.pow(e - 1, 3) + c * Math.pow(e - 1, 2); };
  const easeOutElastic = e => e <= 0 ? 0 : e >= 1 ? 1 : Math.pow(2, -9 * e) * Math.sin((e * 10 - 0.75) * (TAU / 3)) + 1;

  function popScale(st, t) {
    if (!st.pop) return 1;
    const P = st.pop, el = t - P.t0;
    if (P.type === 'stick') {
      const e = el / 0.38; if (e >= 1) { st.pop = null; return 1; }
      return 1 + 0.1 * Math.sin(e * Math.PI * 2.4) * (1 - e);
    }
    if (P.type === 'spawn') {
      const e = el / 0.5; if (e >= 1) { st.pop = null; return 1; }
      return Math.max(0.01, easeOutBack(e));
    }
    if (P.type === 'grow') {
      const e = el / 1.0; if (e >= 1) { st.pop = null; return 1; }
      return 0.3 + 0.7 * easeOutElastic(e);
    }
    return 1;
  }

  // 返回 {ox, oy, rot, sx, sy}，ox/oy 是本地单位
  function animOf(st, t) {
    const d = DEFS[st.id];
    let ox = 0, oy = 0, rot = 0, sx = 1, sy = 1;
    const ph = st.uid * 1.731;
    if (st === PB.dragItem) return { ox, oy, rot, sx, sy };
    switch (d.anim) {
      case 'sway': rot = Math.sin(t * 1.25 + ph) * 0.016; break;
      case 'float': ox = Math.sin(t * 0.33 + ph) * 7; oy = Math.sin(t * 0.8 + ph) * 3.5; break;
      case 'bob': oy = Math.sin(t * 1.8 + ph) * 1.2; rot = Math.sin(t * 1.3 + ph) * 0.03; break;
      case 'flap': sx = 0.35 + 0.65 * Math.abs(Math.cos(t * 8 + ph)); ox = Math.sin(t * 0.9 + ph) * 16; oy = Math.sin(t * 1.7 + ph) * 9; break;
      case 'wander': ox = Math.sin(t * 0.7 + ph) * 20; oy = Math.cos(t * 1.1 + ph) * 12; rot = Math.sin(t * 2 + ph) * 0.15; break;
      case 'glide': oy = Math.sin(t * 1.2 + ph) * 7; sy = 1 + Math.sin(t * 7 + ph) * 0.09; rot = Math.sin(t * 0.8 + ph) * 0.05; break;
      case 'pulse': sx = sy = 1 + Math.sin(t * 1.6 + ph) * 0.025; rot = Math.sin(t * 0.7 + ph) * 0.05; break;
      case 'twinkle': sx = sy = 1 + Math.sin(t * 2.6 + ph) * 0.07; rot = Math.sin(t * 1.1 + ph) * 0.09; break;
      case 'hop': { const c = (t * 0.6 + ph) % 3.2; if (c < 0.25) oy = -Math.sin(c / 0.25 * Math.PI) * 7; break; }
      case 'hop2': { const c = (t * 0.45 + ph) % 4.5; if (c < 0.35) { oy = -Math.sin(c / 0.35 * Math.PI) * 12; rot = -0.08 * Math.sin(c / 0.35 * Math.PI); } break; }
    }
    const v = variantOf(st, scene.season);
    if (v === 'swim') { oy += Math.sin(t * 2.1 + ph) * 1.4; rot += Math.sin(t * 1.5 + ph) * 0.05; ox += Math.sin(t * 0.25 + ph) * 10; }
    if (v === 'skate') { ox += Math.sin(t * 0.7 + ph) * 26; rot += Math.cos(t * 0.7 + ph) * 0.12; }
    if (st.id === 'boat' && pondAt(st.x, st.y) && scene.season !== 'winter') {
      oy += Math.sin(t * 1.6 + ph) * 1.6; rot += Math.sin(t * 1.2 + ph) * 0.045;
    }
    return { ox, oy, rot, sx, sy };
  }

  // ---------- 纸偶移动 ----------
  // 像舞台上被人拿着走的纸片：位置不逐帧插值，而是一格一格地跳（每秒 fps 格），
  // 每一格随机歪一点、抖一下；走路的会一跳一跳。贴纸本身不做任何动画。
  const PUPPET_FPS = 10;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  // 返回 { x, y（画的位置）, gy（脚下的地面 y，用来算大小和排前后）, rot }
  function twPose(T, t) {
    if (!T.puppet) {
      const e = clamp((t - T.t0) / T.dur, 0, 1), ee = e * e * (3 - 2 * e);
      const gy = lerp(T.y0, T.y1, ee);
      return { x: lerp(T.x0, T.x1, ee), y: gy - Math.sin(e * Math.PI) * (T.arc || 0), gy, rot: 0 };
    }
    const fps = T.fps || PUPPET_FPS;
    const step = Math.max(0, Math.floor((t - T.t0) * fps));
    const e = clamp(step / fps / T.dur, 0, 1);
    const ee = T.ease === 'in-out' ? e * e * (3 - 2 * e) : e;
    const gy = lerp(T.y0, T.y1, ee);
    let x = lerp(T.x0, T.x1, ee), y = gy - Math.sin(ee * Math.PI) * (T.arc || 0), rot = 0;
    if (e < 1) {
      const j = T.jitter === undefined ? 1 : T.jitter, sd = (T.seed || 0) + step;
      rot = (hash(sd) - 0.5) * 0.1 * j;
      x += (hash(sd + 7.3) - 0.5) * 2.6 * j;
      y += (hash(sd + 3.1) - 0.5) * 2.6 * j;
      if (T.hops) y -= Math.abs(Math.sin(ee * Math.PI * T.hops)) * (T.hopH || 6);
    }
    return { x, y, gy, rot };
  }
  // 贴纸此刻脚下的位置（移动中取当前这一格）
  function posOf(st, t = now()) {
    if (!st.tw) return { x: st.x, y: st.y };
    const P = twPose(st.tw, t);
    return { x: P.x, y: P.gy };
  }

  // 贴纸在世界里的完整变换（渲染和点选共用）
  function xformOf(st, t) {
    let x = st.x, y = st.y, trot = 0, k0 = kOf(st);
    if (st.tw) {
      const P = twPose(st.tw, t);
      x = P.x; y = P.y; trot = P.rot;
      const z = DEFS[st.id].zone;
      // 地上走的纸偶：大小跟着它此刻的前后位置变
      if (st.tw.puppet && !st.kLock && (z === 'ground' || z === 'flat')) k0 = depthK(P.gy) * st.s;
    }
    const k = k0 * popScale(st, t);
    const a = st.tw && st.tw.puppet ? { ox: 0, oy: 0, rot: 0, sx: 1, sy: 1 } : animOf(st, t);
    const dir = st.flip ? -1 : 1;
    return {
      x: x + a.ox * k * dir, y: y + a.oy * k, rot: a.rot * dir + (st.lean || 0) + trot,
      kx: k * a.sx * dir, ky: k * a.sy, k,
    };
  }

  function drawSticker(ctx, st, t, season, opt = {}) {
    const b = bakeOf(st, season), S = b.S;
    const X = xformOf(st, t);
    let alpha = opt.alpha === undefined ? 1 : opt.alpha;
    let rot = X.rot, y = X.y, kx = X.kx, ky = X.ky;
    if (st.dying) {
      const e = clamp((t - st.dying.t0) / 0.38, 0, 1);
      alpha *= 1 - e; rot += e * 0.7 * (st.dying.dir || 1); y -= e * 40; kx *= 1 + e * 0.15; ky *= 1 + e * 0.15;
    }
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.translate(X.x, y); ctx.rotate(rot); ctx.scale(kx, ky);
    // 投影（世界方向右下），抬起时更远更淡
    const lift = st.lift || 0;
    if (!opt.noShadow) {
      const sdx = (3 + lift * 12) / kx, sdy = (4 + lift * 16) / ky;
      ctx.globalAlpha = alpha * (0.2 - lift * 0.04);
      ctx.drawImage(b.shadow, -(b.ax + b.shadowPad) / S + sdx, -(b.ay + b.shadowPad) / S + sdy, b.shadow.width / S, b.shadow.height / S);
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(b.img, -b.ax / S, -b.ay / S, b.w / S, b.h / S);
    // 风车：叶片是另一张贴纸，绕轮轴转；附近有云就转得快
    if (st.id === 'windmill' && !opt.noBlades) {
      const hub = b.emitters.find(e => e.type === 'hub');
      if (hub) {
        const bb = ART.bake('windmill_blades', { season });
        const ang = st === PB.dragItem ? 0 : windmillAngle(st, t);
        ctx.save();
        ctx.translate(hub.x, hub.y); ctx.rotate(ang);
        if (!opt.noShadow) {
          ctx.globalAlpha = alpha * 0.18;
          ctx.drawImage(bb.shadow, -(bb.ax + bb.shadowPad) / S + 3, -(bb.ay + bb.shadowPad) / S + 4, bb.shadow.width / S, bb.shadow.height / S);
        }
        ctx.globalAlpha = alpha;
        ctx.drawImage(bb.img, -bb.ax / S, -bb.ay / S, bb.w / S, bb.h / S);
        ctx.restore();
      }
    }
    if (lift > 0.01) {
      // 抬起时左上角一点反光，像塑料贴纸翘起来
      ctx.globalAlpha = alpha * lift * 0.18;
      const g = ctx.createLinearGradient(-b.ax / S, -b.ay / S, (b.w - b.ax) / S, (b.h - b.ay) / S);
      g.addColorStop(0, '#fff'); g.addColorStop(0.4, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = g; ctx.fillRect(-b.ax / S, -b.ay / S, b.w / S, b.h / S);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // 风车转角：按时间积分，风大时加速（不回跳）
  function windy(st) {
    return scene.items.some(c => (c.id === 'cloud' || c.id === 'raincloud') && !c.dying && Math.abs(c.x - st.x) < 280 && c.y < st.y);
  }
  function windmillAngle(st, t) {
    const w = st._wind || (st._wind = { a: st.uid, t, v: 0.7 });
    const target = windy(st) ? 4.2 : 0.7;
    const dt = Math.min(0.1, Math.max(0, t - w.t));
    w.v += (target - w.v) * Math.min(1, dt * 1.5);
    w.a += w.v * dt; w.t = t;
    return w.a;
  }

  function hitTest(st, wx, wy, t) {
    const b = bakeOf(st), X = xformOf(st, t);
    let lx = wx - X.x, ly = wy - X.y;
    const c = Math.cos(-X.rot), s = Math.sin(-X.rot);
    const rx = lx * c - ly * s, ry = lx * s + ly * c;
    const px = Math.round(b.ax + rx / X.kx * b.S), py = Math.round(b.ay + ry / X.ky * b.S);
    if (px < 0 || py < 0 || px >= b.w || py >= b.h) return false;
    return b.mask[py * b.w + px] > 40;
  }

  // 贴纸的世界包围盒（不算动画）
  function boxOf(st) {
    const b = bakeOf(st), k = kOf(st), B = b.box;
    let x0 = B.x * k, x1 = (B.x + B.w) * k;
    if (st.flip) { const t0 = -x1; x1 = -x0; x0 = t0; }
    return { x: st.x + x0, y: st.y + B.y * k, w: x1 - x0, h: B.h * k };
  }

  // 绘制顺序：后墙天体 → (背景中层) → 贴地 → 站立(按 y) → 空中
  function layersOf(items) {
    const cel = [], flat = [], ground = [], air = [];
    for (const st of items) {
      if (st === PB.dragItem) continue;
      const z = DEFS[st.id].zone;
      if (z === 'celestial') cel.push(st);
      else if (z === 'flat') flat.push(st);
      else if (z === 'ground') ground.push(st);
      else air.push(st);
    }
    const tNow = now();
    const yOf = st => !st.tw ? st.y : st.tw.puppet ? (st.tw.sk !== undefined ? st.tw.sk : twPose(st.tw, tNow).gy) : Math.max(st.tw.y0, st.tw.y1);
    flat.sort((a, b) => a.y - b.y);
    cel.sort((a, b) => (DEFS[a.id].zo || 0) - (DEFS[b.id].zo || 0));
    ground.sort((a, b) => yOf(a) - yOf(b) || a.uid - b.uid);
    return { cel, flat, ground, air };
  }
  function pickOrder() {
    const L = layersOf(scene.items.filter(s => !s.dying));
    return [...L.cel, ...L.flat, ...L.ground, ...L.air].reverse();
  }

  // ---------- 放置约束 ----------
  function constrain(id, x, y) {
    const z = DEFS[id].zone;
    if (z === 'ground' || z === 'flat') {
      y = clamp(y, FY0 + 6, FY1 - 8);
      const [a, b] = floorX(y);
      x = clamp(x, a + 14, b - 14);
    } else if (z === 'celestial') {
      x = clamp(x, BACK.x0 + 10, BACK.x1 - 10); y = clamp(y, BACK.y0 + 10, BACK.y1 - 30);
    } else {
      x = clamp(x, OPEN.x0 + 20, OPEN.x1 - 20); y = clamp(y, OPEN.y0 + 20, OPEN.y1 - 30);
    }
    return [x, y];
  }
  // 现在拖着的位置是否在合法区域（地面贴纸拖到天上会落到后沿）
  function inZone(id, x, y) {
    const z = DEFS[id].zone;
    if (x < OPEN.x0 - 10 || x > OPEN.x1 + 10 || y < OPEN.y0 - 10 || y > OPEN.y1 + 10) return false;
    return true;
  }

  // ---------- 粒子 ----------
  const parts = [];
  const addPart = p => { if (parts.length < 1200) parts.push(p); };
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- 背景 ----------
  const SKY = {
    day: { spring: ['#8fd3f0', '#e8f7fb'], summer: ['#6cc3ec', '#dcf3fb'], autumn: ['#a3cbe3', '#f7eedb'], winter: ['#b1cbdd', '#eff5f9'] },
    dusk: ['#f2b3a6', '#ffe3b2'],
    night: ['#6f88b8', '#a3b6d2'],
  };
  const OVER = { dusk: ['rgb(226,190,236)', 'rgb(255,208,170)'], night: ['rgb(82,94,158)', 'rgb(106,118,178)'] };
  const LAND = {
    spring: { far: '#c9e4b8', near: '#a6d68b', f0: '#c6e6a2', f1: '#9fd07d', band: '#8cc46c', dots: ['#ffffff', '#f8c3d3', '#ffe38a', '#f8c3d3'] },
    summer: { far: '#aed6a0', near: '#80c16a', f0: '#a5d383', f1: '#77b85b', band: '#63a74c', dots: ['#5fa84e', '#ffe38a', '#4f9a44', '#ffffff'] },
    autumn: { far: '#e9cc9b', near: '#dba96a', f0: '#ead292', f1: '#d4ad63', band: '#c19550', dots: ['#e8793a', '#f2a93f', '#b8563a', '#f5c451'] },
    winter: { far: '#e4ecf3', near: '#d1dfeb', f0: '#f3f7fb', f1: '#e1eaf3', band: '#cbd9e6', dots: ['#ffffff', '#cfe0ee', '#ffffff', '#bcd2e4'] },
  };

  let grain = null;
  function grainPattern(ctx) {
    if (!grain) {
      const c = document.createElement('canvas'); c.width = c.height = 200;
      const k = c.getContext('2d'), id = k.createImageData(200, 200);
      for (let i = 0; i < 200 * 200; i++) {
        const v = Math.random();
        const on = v < 0.5;
        id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = on ? 60 : 255;
        id.data[i * 4 + 3] = on ? Math.random() * 16 : Math.random() * 20;
      }
      // 几根纸纤维
      k.putImageData(id, 0, 0);
      k.strokeStyle = 'rgba(120,90,60,0.07)'; k.lineWidth = 0.8;
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * 200, y = Math.random() * 200, a = Math.random() * TAU, l = 6 + Math.random() * 14;
        k.beginPath(); k.moveTo(x, y); k.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); k.stroke();
      }
      grain = c;
    }
    return ctx.createPattern(grain, 'repeat');
  }

  // 可复现的随机数（背景装饰每次一样）
  function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function pathPoly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }

  // 只留远山以上的天空（日落时太阳要沉到山后面）
  function skyClip(ctx) {
    ctx.beginPath();
    ctx.rect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0);
    ridge(ctx, BACK.x0, BACK.x1, 306, 40, 11, BACK.y1, true);
    ctx.clip('evenodd');
  }
  function ridge(ctx, x0, x1, base, amp, seed, bottom, keepPath) {
    const r = seeded(seed);
    const f = [r() * 0.008 + 0.004, r() * 0.02 + 0.01, r() * 0.04 + 0.02], p = [r() * 9, r() * 9, r() * 9];
    if (!keepPath) ctx.beginPath();
    ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1 + 1; x += 6) {
      const y = base - amp * (0.6 * Math.sin(x * f[0] + p[0]) + 0.3 * Math.sin(x * f[1] + p[1]) + 0.1 * Math.sin(x * f[2] + p[2]));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, bottom); ctx.closePath();
  }

  // 后墙：天空（只随时段/季节变），缓存
  function paintSky(ctx, season, time) {
    const c = time === 'day' ? SKY.day[season] : SKY[time];
    const g = ctx.createLinearGradient(0, BACK.y0, 0, BACK.y1);
    g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = g; ctx.fillRect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0);
    ctx.globalAlpha = 0.35; ctx.fillStyle = grainPattern(ctx); ctx.fillRect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0);
    ctx.globalAlpha = 1;
  }

  // 远山、侧墙、顶、地面
  function paintMid(ctx, season) {
    const L = LAND[season];
    // 两层纸片山，剪在后墙上
    ctx.save();
    ctx.beginPath(); ctx.rect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0); ctx.clip();
    ctx.shadowColor = 'rgba(40,30,20,0.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ridge(ctx, BACK.x0, BACK.x1, 306, 40, 11, BACK.y1 + 2); ctx.fillStyle = L.far; ctx.fill();
    ridge(ctx, BACK.x0, BACK.x1, 348, 26, 29, BACK.y1 + 2); ctx.fillStyle = L.near; ctx.fill();
    ctx.shadowColor = 'transparent';
    if (season === 'winter') { // 远山山脊积雪高光
      ridge(ctx, BACK.x0, BACK.x1, 306, 40, 11, BACK.y1 + 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.fillStyle = grainPattern(ctx); ctx.fillRect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0);
    ctx.restore();

    // 侧墙和顶：纸盒内壁
    const wall = (pts, c0, c1, x0, x1) => {
      pathPoly(ctx, pts);
      const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, c0); g.addColorStop(1, c1);
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = grainPattern(ctx); ctx.fill();
    };
    wall(LWALL, '#e8cfa6', '#cfae80', OPEN.x0, BACK.x0);
    wall(RWALL, '#c9a677', '#b8956a', OPEN.x1, BACK.x1);
    pathPoly(ctx, CEIL);
    { const g = ctx.createLinearGradient(0, OPEN.y0, 0, BACK.y0); g.addColorStop(0, '#c7a171'); g.addColorStop(1, '#a8845a'); ctx.fillStyle = g; ctx.fill(); }
    // 内角暗线
    ctx.strokeStyle = 'rgba(80,55,30,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(OPEN.x0, OPEN.y0); ctx.lineTo(BACK.x0, BACK.y0); ctx.moveTo(OPEN.x1, OPEN.y0); ctx.lineTo(BACK.x1, BACK.y0);
    ctx.moveTo(OPEN.x0, OPEN.y1); ctx.lineTo(BACK.x0, BACK.y1); ctx.moveTo(OPEN.x1, OPEN.y1); ctx.lineTo(BACK.x1, BACK.y1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(80,55,30,0.25)'; ctx.strokeRect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0);

    // 地面
    ctx.save();
    pathPoly(ctx, FLOOR_PTS); ctx.clip();
    { const g = ctx.createLinearGradient(0, FY0, 0, FY1); g.addColorStop(0, L.f0); g.addColorStop(1, L.f1); ctx.fillStyle = g; ctx.fillRect(0, FY0 - 2, W, FY1 - FY0 + 4); }
    // 两条波浪纸边，像一层层叠起来的卡纸
    [[0.3, 7, 5], [0.64, 9, 13]].forEach(([t, amp, seed], i) => {
      const yb = lerp(FY0, FY1, t);
      ridge(ctx, 0, W, yb, amp, seed, FY1 + 10);
      ctx.save();
      ctx.shadowColor = 'rgba(40,30,20,0.16)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = -2;
      const g = ctx.createLinearGradient(0, yb, 0, FY1);
      g.addColorStop(0, i ? L.f1 : L.f0); g.addColorStop(1, L.f1);
      ctx.fillStyle = g; ctx.globalAlpha = 0.9; ctx.fill();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
      ridge(ctx, 0, W, yb, amp, seed, FY1 + 10); ctx.stroke(); ctx.restore();
    });
    // 地面小笔触
    const r = seeded(season.length * 97 + 3);
    for (let i = 0; i < 170; i++) {
      const y = lerp(FY0 + 8, FY1 - 6, Math.pow(r(), 0.8));
      const [a, b] = floorX(y), x = lerp(a, b, r());
      const k = depthK(y), c = L.dots[i % L.dots.length];
      ctx.fillStyle = c; ctx.strokeStyle = c;
      if (season === 'summer' || season === 'spring' && i % 3 === 0) {
        ctx.lineWidth = 1.6 * k; ctx.lineCap = 'round'; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(x - 3 * k, y); ctx.lineTo(x - 5 * k, y - 6 * k); ctx.moveTo(x, y); ctx.lineTo(x, y - 8 * k); ctx.moveTo(x + 3 * k, y); ctx.lineTo(x + 5 * k, y - 6 * k); ctx.stroke();
      } else if (season === 'autumn') {
        ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(x, y, 4 * k, 2.2 * k, r() * 3, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, y, (1.4 + r() * 1.6) * k, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = grainPattern(ctx); ctx.fillRect(0, FY0, W, FY1 - FY0);
    // 后沿一点阴影，让地面和后墙分开
    { const g = ctx.createLinearGradient(0, FY0, 0, FY0 + 26); g.addColorStop(0, 'rgba(60,40,20,0.18)'); g.addColorStop(1, 'rgba(60,40,20,0)'); ctx.fillStyle = g; ctx.fillRect(0, FY0, W, 26); }
    ctx.restore();
  }

  // 盒子前沿：瓦楞纸板截面 + 胶带
  function paintFrame(ctx, season, time) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 16);
    ctx.rect(OPEN.x1, OPEN.y0, OPEN.x0 - OPEN.x1, OPEN.y1 - OPEN.y0); // 反向挖洞
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#e6c797'); g.addColorStop(1, '#d4ad76');
    ctx.fillStyle = g; ctx.fill('evenodd');
    ctx.fillStyle = grainPattern(ctx); ctx.fill('evenodd');
    ctx.restore();
    // 瓦楞：内沿一圈波浪
    ctx.save();
    const band = 9, x0 = OPEN.x0 - band - 3, y0 = OPEN.y0 - band - 3, x1 = OPEN.x1 + band + 3, y1 = OPEN.y1 + band + 3;
    ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.rect(OPEN.x1 + 1, OPEN.y0 - 1, OPEN.x0 - OPEN.x1 - 2, OPEN.y1 - OPEN.y0 + 2); ctx.clip('evenodd');
    ctx.fillStyle = '#c69a62'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = '#a97c47'; ctx.lineWidth = 1.6;
    const wave = (ax, ay, bx, by) => {
      const len = Math.hypot(bx - ax, by - ay), nx = (bx - ax) / len, ny = (by - ay) / len, px = -ny, py = nx;
      ctx.beginPath();
      for (let s = 0; s <= len; s += 2) {
        const o = Math.sin(s / 7 * Math.PI) * 3.4;
        const X = ax + nx * s + px * o, Y = ay + ny * s + py * o;
        s === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.stroke();
    };
    const m = band / 2 + 1.5;
    wave(x0, OPEN.y0 - m, x1, OPEN.y0 - m); wave(x0, OPEN.y1 + m, x1, OPEN.y1 + m);
    wave(OPEN.x0 - m, y0, OPEN.x0 - m, y1); wave(OPEN.x1 + m, y0, OPEN.x1 + m, y1);
    ctx.restore();
    ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = 'rgba(70,45,20,0.6)'; ctx.strokeRect(OPEN.x0, OPEN.y0, OPEN.x1 - OPEN.x0, OPEN.y1 - OPEN.y0);
    // 外沿高光
    ctx.strokeStyle = 'rgba(255,240,210,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(2, 2, W - 4, H - 4, 14); ctx.stroke();

    // 四角胶带
    const tape = (x, y, a, w = 92) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = 'rgba(250,240,205,0.82)'; ctx.fillRect(-w / 2, -13, w, 26);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-w / 2, -13, w, 5);
      ctx.strokeStyle = 'rgba(180,160,120,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const yy = -13 + i * 26 / 8; ctx.lineTo(-w / 2 + (i % 2 ? 3 : 0), yy); }
      for (let i = 8; i >= 0; i--) { const yy = -13 + i * 26 / 8; ctx.lineTo(w / 2 - (i % 2 ? 3 : 0), yy); }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
    };
    tape(34, 30, -0.72); tape(W - 34, 30, 0.72);

    // 底边标签
    const label = `${{ spring: '春', summer: '夏', autumn: '秋', winter: '冬' }[season]} · ${{ day: '白天', dusk: '黄昏', night: '夜晚' }[time]}`;
    ctx.save();
    ctx.translate(W / 2, H - 20); ctx.rotate(-0.012);
    ctx.fillStyle = '#fffaf0'; ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.roundRect(-78, -14, 156, 28, 4); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e46b5b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-70, 7); ctx.lineTo(70, 7); ctx.stroke();
    ctx.fillStyle = '#4a3b32'; ctx.font = '17px "ZCOOL KuaiLe", "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('纸盒小景  ' + label, 0, -1);
    ctx.restore();
  }

  // ---------- 缓存背景 ----------
  const bg = { key: '', sky: null, mid: null, frame: null };
  function ensureBg(px, season, time) {
    const key = `${px}|${season}|${time}|${depth}|${PB.fontReady ? 1 : 0}`;
    if (bg.key === key) return bg;
    const mk = () => { const c = document.createElement('canvas'); c.width = Math.round(W * px); c.height = Math.round(H * px); const k = c.getContext('2d'); k.setTransform(px, 0, 0, px, 0, 0); return [c, k]; };
    const [a, ak] = mk(); paintSky(ak, season, time);
    const [b, bk] = mk(); paintMid(bk, season);
    const [c, ck] = mk(); paintFrame(ck, season, time);
    Object.assign(bg, { key, sky: a, mid: b, frame: c });
    return bg;
  }

  // 夜空的星星（画在后墙上）
  /**
   * 改景深。贴纸按"在地面上左右的相对位置"跟着挪（后墙上的按在后墙里的相对位置），
   * 所以来回拖滑块不会越挪越偏。
   */
  function setDepth(r) {
    r = clamp(r, DEPTH_MIN, DEPTH_MAX);
    if (Math.abs(r - depth) < 1e-4) return;
    const rel = scene.items.map(st => {
      const z = DEFS[st.id].zone;
      if (z === 'ground' || z === 'flat') { const [a, b] = floorX(st.y); return (st.x - a) / (b - a); }
      if (z === 'celestial') return (st.x - BACK.x0) / (BACK.x1 - BACK.x0);
      return null;
    });
    applyDepth(r);
    scene.items.forEach((st, i) => {
      const u = rel[i];
      if (u === null) return;
      const z = DEFS[st.id].zone;
      if (z === 'celestial') st.x = lerp(BACK.x0, BACK.x1, u);
      else { const [a, b] = floorX(st.y); st.x = lerp(a, b, u); }
      st.tw = null;
    });
  }

  // ---------- 主渲染 ----------
  function render(ctx, px, t, opt = {}) {
    const season = opt.season || scene.season, time = opt.time || scene.time;
    const B = ensureBg(px, season, time);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(B.sky, 0, 0);
    ctx.setTransform(px, 0, 0, px, 0, 0);

    const L = layersOf(scene.items);
    // 后墙上的天体
    ctx.save(); ctx.beginPath(); ctx.rect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0); ctx.clip();
    for (const st of L.cel) drawSticker(ctx, st, t, season);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(B.mid, 0, 0); ctx.setTransform(px, 0, 0, px, 0, 0);

    ctx.save(); ctx.beginPath(); ctx.rect(OPEN.x0, OPEN.y0, OPEN.x1 - OPEN.x0, OPEN.y1 - OPEN.y0); ctx.clip();
    for (const st of L.flat) drawSticker(ctx, st, t, season);
    drawRipples(ctx, t, season);
    // 站立贴纸：接地阴影 + 本体
    for (const st of L.ground) {
      if ((!st.tw || st.tw.walk) && !st.dying && variantOf(st, season) === '') {
        const p = posOf(st, t), b = bakeOf(st, season), k = depthK(p.y) * st.s * popScale(st, t);
        const rw = Math.min(b.box.w * 0.36, 70) * k;
        ctx.fillStyle = 'rgba(50,35,20,0.16)';
        ctx.beginPath(); ctx.ellipse(p.x + 3 * k, p.y + 1.5 * k, rw, rw * 0.2, 0, 0, TAU); ctx.fill();
      }
      drawSticker(ctx, st, t, season);
    }
    for (const st of L.air) drawSticker(ctx, st, t, season);
    drawParts(ctx, t, 'pre');

    // 时段叠色
    if (time !== 'day') {
      const o = OVER[time];
      const g = ctx.createLinearGradient(0, OPEN.y0, 0, OPEN.y1); g.addColorStop(0, o[0]); g.addColorStop(1, o[1]);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g;
      ctx.fillRect(OPEN.x0, OPEN.y0, OPEN.x1 - OPEN.x0, OPEN.y1 - OPEN.y0);
      ctx.globalCompositeOperation = 'source-over';
    }
    drawGlow(ctx, t, season, time, L);
    ctx.restore();

    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(B.frame, 0, 0); ctx.setTransform(px, 0, 0, px, 0, 0);
  }

  function lightLevel(id, time) { const l = DEFS[id].light; return l ? (l[time] || 0) : 0; }

  function drawGlow(ctx, t, season, time, L) {
    // 夜空星星
    if (time !== 'day') {
      ctx.save(); ctx.beginPath(); ctx.rect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, 300 - BACK.y0); ctx.clip();
      const base = time === 'night' ? 0.9 : 0.25;
      ctx.fillStyle = '#fff8dc';
      for (const s of STARS) {
        ctx.globalAlpha = base * (0.55 + 0.45 * Math.sin(t * 2 + s.p));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, TAU); ctx.fill();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // 自发光贴纸重画一遍（不被夜色压暗）
    if (time !== 'day') {
      for (const st of [...L.cel, ...L.air, ...L.ground]) {
        if (!DEFS[st.id].emissive) continue;
        const lv = lightLevel(st.id, time); if (!lv) continue;
        if (DEFS[st.id].zone === 'celestial') {
          ctx.save(); skyClip(ctx);
          drawSticker(ctx, st, t, season, { alpha: 0.85 * lv, noShadow: true }); ctx.restore();
        } else drawSticker(ctx, st, t, season, { alpha: 0.85 * lv, noShadow: true });
      }
    }
    // 光晕
    ctx.globalCompositeOperation = 'lighter';
    for (const st of [...L.cel, ...L.flat, ...L.ground, ...L.air]) {
      if (st.dying) continue;
      let lv = lightLevel(st.id, time); if (!lv) continue;
      const b = bakeOf(st, season), X = xformOf(st, t);
      const cel = DEFS[st.id].zone === 'celestial';
      // 后墙上的太阳 / 月亮沉到山后面时光晕跟着淡掉，也只亮在后墙范围里
      if (cel) {
        lv *= clamp((BACK.y1 - 40 - X.y) / 90, 0, 1);
        if (lv <= 0.01) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0); ctx.clip();
      }
      for (const Lt of b.lights) {
        const x = X.x + Lt.x * X.kx, y = X.y + Lt.y * X.ky, r = Lt.r * X.k * 2.3;
        const flick = 0.92 + 0.08 * Math.sin(t * 7 + st.uid + Lt.x);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, hexA(Lt.color, 0.75 * lv * flick)); g.addColorStop(0.35, hexA(Lt.color, 0.3 * lv * flick)); g.addColorStop(1, hexA(Lt.color, 0));
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (cel) ctx.restore();
      if (DEFS[st.id].pool && time === 'night') { // 路灯在地上的光斑
        const r = 70 * X.k;
        ctx.save(); ctx.translate(X.x, st.y); ctx.scale(1, 0.28);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(255,210,120,0.35)'); g.addColorStop(1, 'rgba(255,210,120,0)');
        ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    drawParts(ctx, t, 'glow');
  }

  const hexCache = {};
  function hexA(hex, a) {
    let c = hexCache[hex];
    if (!c) { const n = parseInt(hex.slice(1), 16); c = hexCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
  }

  // ---------- 粒子更新与绘制 ----------
  const ripples = [];
  const emitAcc = new Map();
  function rate(key, perSec, dt) {
    const v = (emitAcc.get(key) || 0) + perSec * dt;
    const n = Math.floor(v); emitAcc.set(key, v - n); return n;
  }

  function updateParts(dt, t) {
    const season = scene.season, time = scene.time;
    const items = live();
    for (const st of items) {
      if (st.tw || st === PB.dragItem) continue;
      const k = kOf(st);
      if (st.id === 'raincloud') {
        const b = bakeOf(st), X = xformOf(st, t);
        const em = b.emitters.find(e => e.type === 'rain') || { x: 0, y: 26 };
        const n = rate('r' + st.uid, season === 'winter' ? 12 : 32, dt);
        for (let i = 0; i < n; i++) {
          const x = X.x + rnd(-58, 58) * k, y = X.y + em.y * k;
          const end = y < FY0 ? clamp(y + rnd(230, 420), FY0 + 6, FY1 - 4) : Math.min(FY1 - 4, y + rnd(60, 200));
          if (season === 'winter') addPart({ type: 'snow', x, y, vx: rnd(-8, 8), vy: rnd(38, 60), r: rnd(1.6, 3.2), end, ph: rnd(0, 9), life: 0, max: 99 });
          else addPart({ type: 'rain', x, y, vx: -30, vy: rnd(420, 520), end, life: 0, max: 9 });
        }
      } else if (st.id === 'tree' && (season === 'spring' || season === 'autumn')) {
        const n = rate('t' + st.uid, season === 'spring' ? 0.7 : 0.9, dt);
        for (let i = 0; i < n; i++) {
          const x = st.x + rnd(-55, 55) * k, y = st.y - rnd(70, 130) * k;
          addPart({ type: season === 'spring' ? 'petal' : 'leaf', x, y, vx: rnd(-6, 14), vy: rnd(16, 26), rot: rnd(0, 6), vr: rnd(-2, 2), end: st.y + rnd(-6, 14) * k, k, life: 0, max: 30, c: season === 'spring' ? (Math.random() < 0.5 ? '#f8c3d3' : '#fde3ea') : ['#f29a3f', '#de6f33', '#f7c55a'][i % 3] });
        }
      } else if (st.id === 'house' && (season === 'autumn' || season === 'winter' || time === 'dusk')) {
        const b = bakeOf(st), X = xformOf(st, t);
        for (const em of b.emitters) if (em.type === 'smoke') {
          const n = rate('h' + st.uid, 2.6, dt);
          for (let i = 0; i < n; i++) addPart({ type: 'smoke', x: X.x + em.x * X.kx, y: X.y + em.y * X.ky, vx: rnd(4, 12), vy: rnd(-22, -14), r: 4 * k, gr: 11 * k, life: 0, max: rnd(2.2, 3) });
        }
      } else if (st.id === 'bench' && st.state.cat) {
        const b = bakeOf(st), X = xformOf(st, t);
        for (const em of b.emitters) if (em.type === 'zzz') {
          if (rate('z' + st.uid, 0.55, dt)) addPart({ type: 'zzz', x: X.x + em.x * X.kx, y: X.y + em.y * X.ky, vx: 7, vy: -12, k, life: 0, max: 2.2 });
        }
      } else if (st.id === 'pond' && season !== 'winter') {
        if (rate('p' + st.uid, 0.45, dt)) {
          const a = rnd(0, TAU), rr = Math.sqrt(Math.random()) * 0.65, f = DEFS.pond.foot;
          ripples.push({ x: st.x + Math.cos(a) * rr * f.rx * k, y: st.y + Math.sin(a) * rr * f.ry * k, k, t0: t, dur: 2.2 });
        }
      } else if ((st.id === 'duck' || st.id === 'ducklings' || st.id === 'boat') && season !== 'winter' && pondAt(st.x, st.y)) {
        if (rate('d' + st.uid, 0.8, dt)) ripples.push({ x: xformOf(st, t).x, y: st.y + 1, k: k * 0.8, t0: t, dur: 1.8 });
      }
    }
    // 冬天整个盒子里飘点小雪
    if (season === 'winter') {
      const n = rate('gsnow', 7, dt);
      for (let i = 0; i < n; i++) addPart({ type: 'snow', x: rnd(OPEN.x0, OPEN.x1), y: OPEN.y0 + rnd(0, 20), vx: rnd(-6, 6), vy: rnd(22, 40), r: rnd(1.2, 2.4), end: rnd(FY0, FY1), ph: rnd(0, 9), life: 0, max: 99 });
    }
    // 夏夜草丛萤火
    if (season === 'summer' && time === 'night') {
      const grass = all('grass');
      const want = Math.min(26, grass.length * 4);
      let have = 0; for (const p of parts) if (p.type === 'ffly') have++;
      if (have < want && grass.length && Math.random() < dt * 6) {
        const g = grass[(Math.random() * grass.length) | 0], k = kOf(g);
        addPart({ type: 'ffly', x: g.x + rnd(-40, 40) * k, y: g.y - rnd(10, 60) * k, hx: g.x, hy: g.y - 30 * k, ph: rnd(0, 9), life: 0, max: rnd(5, 9) });
      }
    }
    if (PB.meteorOn && PB.meteorOn()) {
      if (rate('meteor', 0.16, dt)) addPart({ type: 'meteor', x: rnd(BACK.x0 + 200, BACK.x1 - 40), y: rnd(BACK.y0 + 10, 170), vx: -rnd(380, 460), vy: rnd(110, 160), life: 0, max: 0.9 });
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      switch (p.type) {
        case 'rain':
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y >= p.end) { parts.splice(i, 1); if (Math.random() < 0.5) addPart({ type: 'splash', x: p.x, y: p.end, life: 0, max: 0.3, k: depthK(p.end) }); continue; }
          break;
        case 'snow':
          p.x += (p.vx + Math.sin(t * 1.5 + p.ph) * 10) * dt; p.y += p.vy * dt;
          if (p.y >= p.end) { p.melt = (p.melt || 0) + dt; p.y = p.end; if (p.melt > 1.2) { parts.splice(i, 1); continue; } }
          break;
        case 'petal': case 'leaf':
          if (p.y < p.end) { p.x += (p.vx + Math.sin(t * 2 + p.rot) * 16) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
          else if (p.life > 12) { parts.splice(i, 1); continue; }
          else { p.rest = (p.rest || 0) + dt; if (p.rest > 4) { parts.splice(i, 1); continue; } }
          break;
        case 'smoke': p.x += p.vx * dt; p.y += p.vy * dt; p.vx += 4 * dt; break;
        case 'zzz': p.x += p.vx * dt + Math.sin(p.life * 3) * 0.3; p.y += p.vy * dt; break;
        case 'sparkle': p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy = p.vy * 0.92 + 30 * dt; break;
        case 'dust': p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; break;
        case 'ffly': p.x = p.hx + Math.sin(t * 0.6 + p.ph) * 50 + Math.sin(t * 1.7 + p.ph * 2) * 14; p.y = p.hy + Math.sin(t * 0.9 + p.ph * 3) * 30; break;
        case 'meteor': p.x += p.vx * dt; p.y += p.vy * dt; break;
      }
      if (p.life > p.max) parts.splice(i, 1);
    }
    for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t0 > ripples[i].dur) ripples.splice(i, 1);
  }

  function drawRipples(ctx, t, season) {
    if (season === 'winter') return;
    ctx.save(); ctx.lineWidth = 1.4;
    for (const r of ripples) {
      const e = (t - r.t0) / r.dur, rx = (6 + e * 26) * r.k;
      ctx.strokeStyle = `rgba(255,255,255,${0.65 * (1 - e)})`;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, rx, rx * 0.32, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawParts(ctx, t, layer) {
    for (const p of parts) {
      const glow = p.type === 'sparkle' || p.type === 'ffly' || p.type === 'meteor';
      if ((layer === 'glow') !== glow) continue;
      const e = p.life / p.max;
      switch (p.type) {
        case 'rain':
          ctx.strokeStyle = 'rgba(70,125,190,0.8)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 2, p.y - 15); ctx.stroke(); break;
        case 'splash':
          ctx.strokeStyle = `rgba(90,140,200,${0.75 * (1 - e)})`; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, (2 + e * 6) * p.k, (1 + e * 2) * p.k, 0, 0, TAU); ctx.stroke(); break;
        case 'snow':
          ctx.fillStyle = `rgba(255,255,255,${p.melt ? 0.9 * (1 - p.melt / 1.2) : 0.95})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); break;
        case 'petal': case 'leaf': {
          const a = p.rest ? 1 - p.rest / 4 : 1;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a;
          ctx.fillStyle = p.c; ctx.beginPath();
          if (p.type === 'petal') ctx.ellipse(0, 0, 3.4 * p.k, 2.2 * p.k, 0, 0, TAU);
          else { ctx.moveTo(-4.5 * p.k, 0); ctx.quadraticCurveTo(0, -4 * p.k, 4.5 * p.k, 0); ctx.quadraticCurveTo(0, 4 * p.k, -4.5 * p.k, 0); }
          ctx.fill(); ctx.restore(); break;
        }
        case 'smoke': {
          const r = p.r + (p.gr - p.r) * e;
          ctx.fillStyle = `rgba(235,232,228,${0.55 * (1 - e)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); break;
        }
        case 'zzz':
          ctx.save(); ctx.globalAlpha = 1 - e; ctx.fillStyle = '#6b7fb0';
          ctx.font = `bold ${Math.round((11 + e * 7) * p.k)}px "ZCOOL KuaiLe", sans-serif`; ctx.fillText('z', p.x, p.y); ctx.restore(); break;
        case 'dust':
          ctx.fillStyle = `rgba(240,230,210,${0.8 * (1 - e)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + e), 0, TAU); ctx.fill(); break;
        case 'sparkle': {
          const s = p.s * (1 - e * 0.6);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 3); ctx.globalAlpha = 1 - e * e;
          ctx.fillStyle = p.c || '#ffe27a';
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? s * 0.35 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.fill(); ctx.restore(); break;
        }
        case 'ffly': {
          const a = Math.min(1, p.life / 0.8, (p.max - p.life) / 0.8) * (0.6 + 0.4 * Math.sin(t * 5 + p.ph));
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 12);
          g.addColorStop(0, `rgba(255,250,170,${a})`); g.addColorStop(0.3, `rgba(220,255,120,${a * 0.4})`); g.addColorStop(1, 'rgba(200,255,100,0)');
          ctx.fillStyle = g; ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
          ctx.globalCompositeOperation = 'source-over'; break;
        }
        case 'meteor': {
          const a = Math.sin(e * Math.PI);
          const g = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 0.22, p.y - p.vy * 0.22);
          g.addColorStop(0, `rgba(255,250,220,${a})`); g.addColorStop(1, 'rgba(255,250,220,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.22, p.y - p.vy * 0.22); ctx.stroke(); break;
        }
      }
    }
  }

  function sparkle(x, y, n = 14, spread = 1, color) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), v = rnd(60, 190) * spread;
      addPart({ type: 'sparkle', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, s: rnd(4, 8), life: 0, max: rnd(0.6, 1.0), c: color || ['#ffe27a', '#fff6c2', '#ffd0e0', '#c9f0ff'][i % 4] });
    }
  }
  function dust(x, y, k) {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI + rnd(-0.2, 0.2);
      addPart({ type: 'dust', x: x + Math.cos(a) * 20 * k * (i % 2 ? 1 : -1), y: y - 2, vx: Math.cos(a) * 70 * (i % 2 ? 1 : -1), vy: -rnd(8, 30), r: rnd(2, 4) * k, life: 0, max: 0.45 });
    }
  }

  Object.assign(PB, {
    W, H, OPEN, BACK, FY0, FY1, clamp, lerp, depthK, floorX, floorT, DEFS, TABS, nameOf, ensureArt,
    setDepth, getDepth: () => depth, DEPTH_MIN, DEPTH_MAX, DEPTH_DEFAULT,
    scene, now, mkItem, windy, twPose, posOf, live, all, kOf, pondAt, variantOf, bakeOf, xformOf, drawSticker, hitTest, boxOf,
    layersOf, pickOrder, constrain, inZone, render, updateParts, parts, ripples, sparkle, dust, addPart, rnd,
    lightLevel, easeOutBack, seeded,
  });
})();
