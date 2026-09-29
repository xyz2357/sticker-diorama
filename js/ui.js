// ui.js — 贴纸册、拖放、选择、撤销、委托、图鉴、相册、主循环
(function () {
  'use strict';
  const PB = window.PB;
  const { DEFS, TABS, scene, W, H, OPEN, FY0, FY1, clamp, depthK, now, mkItem, all, kOf, bakeOf, hitTest, boxOf, pickOrder, constrain, render, updateParts, dust, rnd } = PB;
  const $ = s => document.querySelector(s);
  const TAU = Math.PI * 2;

  PB.ensureArt();

  // ---------- 存档 ----------
  const KEY = 'paperbox.save.v1', AKEY = 'paperbox.album.v1';
  function freshSave() {
    const unlocked = {};
    for (const id in DEFS) if (DEFS[id].base) unlocked[id] = 1;
    return { v: 1, unlocked, fresh: {}, disc: {}, jobs: {}, active: 'duckhome', scene: null, muted: false };
  }
  let save = null;
  try { save = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 读不到就新开 */ }
  if (!save || save.v !== 1) save = freshSave();
  save = Object.assign(freshSave(), save);
  PB.save = save;
  let album = [];
  try { album = JSON.parse(localStorage.getItem(AKEY)) || []; } catch (e) { album = []; }

  function serialize() {
    return {
      season: scene.season, time: scene.time,
      items: scene.items.filter(s => !s.dying && s !== PB.dragItem).map(s => ({
        id: s.id, x: +(s.tw ? s.tw.x1 : s.x).toFixed(1), y: +(s.tw ? s.tw.y1 : s.y).toFixed(1),
        s: +s.s.toFixed(3), flip: s.flip, state: s.state, flags: s.flags,
      })),
    };
  }
  function deserialize(o) {
    scene.season = o.season || 'summer'; scene.time = o.time || 'day';
    // 盒子几何改过：读档时把贴纸挪回现在的合法范围（地面梯形、后墙）
    scene.items = (o.items || []).filter(i => DEFS[i.id]).map(i => { const [x, y] = constrain(i.id, i.x, i.y); return mkItem(i.id, x, y, { s: i.s, flip: i.flip, state: Object.assign({}, i.state), flags: Object.assign({}, i.flags) }); });
  }
  let saveTimer = 0;
  function saveNow() {
    clearTimeout(saveTimer); saveTimer = 0;
    save.scene = serialize();
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 存不下也别打断游戏 */ }
  }
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
  }
  window.addEventListener('pagehide', () => { if (saveTimer) saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) saveNow(); });

  // ---------- 画布尺寸 ----------
  const cv = $('#stage'), ctx = cv.getContext('2d');
  let px = 1, cssW = W, cssH = H;
  function resize() {
    const wrap = $('#stageWrap').getBoundingClientRect();
    const narrow = window.innerWidth <= 980;
    const w = wrap.width, h = narrow ? w * H / W : wrap.height - 52;
    const s = Math.max(0.2, Math.min(w / W, h / H));
    cssW = Math.floor(W * s); cssH = Math.floor(H * s);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    px = cv.width / W;
  }
  function toWorld(e) {
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    return [x, y, e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom];
  }
  const toCss = (wx, wy) => [wx / W * cssW, wy / H * cssH];

  // ---------- 撤销 ----------
  const hist = [];
  const snapshot = () => JSON.stringify(serialize());
  function pushUndo(s) { hist.push(s || snapshot()); if (hist.length > 80) hist.shift(); }
  function undo() {
    if (!hist.length) { PB.sfx('tick'); return; }
    const o = JSON.parse(hist.pop());
    PB.clearJobs();
    const ps = scene.season, pt = scene.time;
    if (o.season !== ps || o.time !== pt) startTransition(o.season !== ps ? 'wipe' : 'fade');
    deserialize(o);
    select(null);
    if (o.season !== ps) buildShelf();
    syncSegs(); saveSoon(); PB.sfx('peel');
    PB.changed('undo');
  }

  // ---------- 变化通知 ----------
  let evalPending = true;
  PB.changed = function (kind) {
    evalPending = true;
    saveSoon();
  };

  // ---------- 季节 / 时段 ----------
  const SEASONS = [['spring', '春', '#f8c3d3'], ['summer', '夏', '#8fd06e'], ['autumn', '秋', '#f5b057'], ['winter', '冬', '#d6e8f5']];
  const ICON = {
    day: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
    dusk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 16a5.5 5.5 0 0 1 11 0M2.5 16h19M5 20h14M12 4v3M4.2 8.2l1.8 1.8M19.8 8.2L18 10"/></svg>',
    night: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  };
  const TIMES = [['day', '白天'], ['dusk', '黄昏'], ['night', '夜晚']];
  function buildSegs() {
    $('#segSeason').innerHTML = SEASONS.map(([id, n, c]) => `<button data-s="${id}"><span class="dot" style="background:${c}"></span>${n}</button>`).join('');
    $('#segTime').innerHTML = TIMES.map(([id, n]) => `<button data-t="${id}">${ICON[id]}${n}</button>`).join('');
    $('#segSeason').onclick = e => { const b = e.target.closest('button'); if (b) setSeason(b.dataset.s); };
    $('#segTime').onclick = e => { const b = e.target.closest('button'); if (b) setTime(b.dataset.t); };
    syncSegs();
  }
  function syncSegs() {
    document.querySelectorAll('#segSeason button').forEach(b => b.classList.toggle('on', b.dataset.s === scene.season));
    document.querySelectorAll('#segTime button').forEach(b => b.classList.toggle('on', b.dataset.t === scene.time));
  }
  function setSeason(s) {
    if (s === scene.season) return;
    pushUndo(); startTransition('wipe');
    scene.season = s; PB.sfx('whoosh');
    syncSegs(); buildShelf(); PB.changed('season');
  }
  // auto = 反应引起的（日落日出）：不单独进撤销，一次撤销就退回贴月亮之前
  function setTime(t, auto) {
    if (t === scene.time) return;
    if (!auto) pushUndo();
    startTransition('fade');
    scene.time = t; PB.sfx('whoosh');
    syncSegs(); PB.changed('time');
  }
  PB.setTime = setTime;

  // ---------- 转场 ----------
  let trans = null;
  function startTransition(type) {
    if (!cv.width) return;
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    c.getContext('2d').drawImage(cv, 0, 0);
    trans = { type, snap: c, t0: now(), dur: type === 'wipe' ? 0.8 : 0.7 };
  }
  function drawTransition(t) {
    if (!trans) return;
    const e = (t - trans.t0) / trans.dur;
    if (e >= 1 || trans.snap.width !== cv.width) { trans = null; return; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (trans.type === 'fade') {
      ctx.globalAlpha = 1 - e * e * (3 - 2 * e); ctx.drawImage(trans.snap, 0, 0); ctx.globalAlpha = 1;
    } else {
      const ee = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
      const x = ee * cv.width;
      ctx.save(); ctx.beginPath(); ctx.rect(x, 0, cv.width - x, cv.height); ctx.clip();
      ctx.drawImage(trans.snap, 0, 0); ctx.restore();
      // 翻页的纸边：左边一道阴影，边上一条亮线
      const sw = 46 * px;
      const g = ctx.createLinearGradient(x - sw, 0, x, 0);
      g.addColorStop(0, 'rgba(40,25,10,0)'); g.addColorStop(1, 'rgba(40,25,10,0.28)');
      ctx.fillStyle = g; ctx.fillRect(x - sw, 0, sw, cv.height);
      ctx.fillStyle = 'rgba(255,250,235,0.85)'; ctx.fillRect(x - 1.5 * px, 0, 3 * px, cv.height);
    }
  }

  // ---------- 贴纸册 ----------
  let tab = 'nature';
  function thumb(canvas, id, v, locked) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(canvas.clientWidth * dpr) || canvas.width, ch = Math.round(canvas.clientHeight * dpr) || canvas.height;
    canvas.width = cw; canvas.height = ch;
    const b = ART.bake(id === 'windmill' ? 'windmill_full' : id, Object.assign({ season: scene.season }, v || {}));
    const k = canvas.getContext('2d');
    const sc = Math.min((cw - 6) / b.w, (ch - 6) / b.h), w = b.w * sc, h = b.h * sc, x = (cw - w) / 2, y = (ch - h) / 2;
    k.clearRect(0, 0, cw, ch);
    if (locked) {
      k.drawImage(b.img, x, y, w, h);
      k.globalCompositeOperation = 'source-in'; k.fillStyle = '#e2d6bf'; k.fillRect(0, 0, cw, ch);
      k.globalCompositeOperation = 'source-over';
    } else {
      k.globalAlpha = 0.28;
      k.drawImage(b.shadow, x - b.shadowPad * sc + 2 * dpr, y - b.shadowPad * sc + 3 * dpr, b.shadow.width * sc, b.shadow.height * sc);
      k.globalAlpha = 1; k.drawImage(b.img, x, y, w, h);
    }
  }
  function buildTabs() {
    const el = $('#tabs');
    el.innerHTML = TABS.map(t => {
      const nd = Object.keys(save.fresh).some(id => DEFS[id] && DEFS[id].tab === t.id);
      return `<button data-tab="${t.id}" class="${t.id === tab ? 'on' : ''}">${t.name}${nd ? '<span class="nd"></span>' : ''}</button>`;
    }).join('');
    el.onclick = e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.tab; PB.sfx('tick'); buildTabs(); buildShelf(); } };
  }
  function buildShelf() {
    const el = $('#shelf');
    el.innerHTML = '';
    for (const id of Object.keys(DEFS)) {
      const d = DEFS[id];
      if (d.tab !== tab) continue;
      const locked = !save.unlocked[id];
      const tile = document.createElement('div');
      tile.className = 'tile' + (locked ? ' locked' : '');
      tile.dataset.id = id;
      tile.innerHTML = `<canvas></canvas><div class="nm">${locked ? '？？？' : PB.nameOf(id, scene.season)}</div>${save.fresh[id] ? '<span class="new">新</span>' : ''}`;
      if (locked) tile.title = '还没解锁——在图鉴里找找线索';
      el.appendChild(tile);
      thumb(tile.querySelector('canvas'), id, null, locked);
    }
  }
  $('#shelf').addEventListener('pointerdown', e => {
    const tile = e.target.closest('.tile'); if (!tile || e.button !== 0) return;
    PB.unlockAudio();
    const id = tile.dataset.id;
    if (!save.unlocked[id]) {
      tile.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 250 });
      showTip('这张还没解锁。打开「图鉴」看看线索。', true);
      return;
    }
    if (e.pointerType === 'touch') {
      // 触屏：按住一小会儿才拿起；在这之前滑动就是滚动贴纸册，轻点就是直接贴
      pending = { id, x: e.clientX, y: e.clientY, tile, touch: true };
      pending.timer = setTimeout(() => {
        if (!pending || pending.id !== id || drag) return;
        const p0 = pending; pending = null;
        if (navigator.vibrate) navigator.vibrate(12);
        startNewDrag(id, { clientX: p0.x, clientY: p0.y, pointerType: 'touch' });
      }, 220);
      return;
    }
    e.preventDefault();
    pending = { id, x: e.clientX, y: e.clientY, tile };
  });
  // 拖着贴纸时不让页面跟着滚
  document.addEventListener('touchmove', e => { if (drag || (pending && !pending.touch)) e.preventDefault(); }, { passive: false });
  // 触屏拖动时贴纸浮在手指上方，不被手指挡住
  const TOUCH_LIFT = 56;
  const liftPt = (e, d) => (d && d.touch ? { clientX: e.clientX, clientY: e.clientY - TOUCH_LIFT } : e);
  function clearFresh(id) {
    if (!save.fresh[id]) return;
    delete save.fresh[id]; saveSoon();
    const t = document.querySelector(`.tile[data-id="${id}"] .new`); if (t) t.remove();
    buildTabs();
  }

  // ---------- 拖放 ----------
  let pending = null, drag = null, selected = null;
  const ghost = $('#ghost'), gctx = ghost.getContext('2d');

  function startNewDrag(id, e) {
    if (full()) return;
    const st = mkItem(id, 0, 0, {});
    const b = bakeOf(st);
    drag = { st, fromShelf: true, lox: 0, loy: -(b.box.y + b.box.h / 2), moved: true, lastX: e.clientX, vx: 0, inside: false, touch: e.pointerType === 'touch' };
    st.lift = 1; PB.dragItem = st;
    PB.sfx('peel'); clearFresh(id); select(null);
    moveDrag(e);
  }
  function startExistingDrag(st, e, wx, wy) {
    const k = kOf(st);
    drag = { st, fromShelf: false, lox: (st.x - wx) / k, loy: (st.y - wy) / k, moved: false, sx: e.clientX, sy: e.clientY, lastX: e.clientX, vx: 0, inside: true, undo: snapshot(), touch: e.pointerType === 'touch' };
  }
  function moveDrag(e0) {
    const st = drag.st, z = DEFS[st.id].zone;
    if (!drag.moved && Math.hypot(e0.clientX - drag.sx, e0.clientY - drag.sy) < (drag.touch ? 8 : 4)) return;
    const e = liftPt(e0, drag);
    const [wx, wy, inside] = toWorld(e);
    if (!drag.moved) {
      drag.moved = true; st.lift = 1; PB.dragItem = st; st.tw = null; st.pop = null;
      PB.sfx('peel');
    }
    let x = wx, y = wy;
    for (let i = 0; i < 3; i++) {
      const k = (z === 'ground' || z === 'flat' ? depthK(y) : 1) * st.s;
      x = wx + drag.lox * k; y = wy + drag.loy * k;
    }
    st.x = x; st.y = y;
    const dx = e.clientX - drag.lastX; drag.lastX = e.clientX;
    drag.vx = drag.vx * 0.7 + dx * 0.3;
    st.lean = clamp(drag.vx * 0.018, -0.28, 0.28);
    drag.inside = inside;
    if (inside) ghost.style.display = 'none';
    else drawGhost(e);
  }
  function drawGhost(e) {
    const st = drag.st, b = bakeOf(st);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = (DEFS[st.id].zone === 'ground' || DEFS[st.id].zone === 'flat' ? 0.9 : 1) * st.s * cssW / W;
    const w = b.w / b.S * k, h = b.h / b.S * k;
    if (ghost.width !== Math.round(w * dpr)) { ghost.width = Math.round(w * dpr); ghost.height = Math.round(h * dpr); }
    ghost.style.width = w + 'px'; ghost.style.height = h + 'px';
    gctx.clearRect(0, 0, ghost.width, ghost.height);
    gctx.drawImage(b.img, 0, 0, ghost.width, ghost.height);
    ghost.style.display = 'block';
    ghost.style.opacity = drag.fromShelf ? 1 : 0.6;
    ghost.style.transform = `translate(${e.clientX - w / 2}px, ${e.clientY - h / 2}px) rotate(${st.lean || 0}rad)`;
  }
  function endDrag(e) {
    const st = drag.st, d = drag; drag = null;
    ghost.style.display = 'none';
    if (!d.moved) { PB.dragItem = null; poke(st); return; }
    PB.dragItem = null; st.lift = 0; st.lean = 0;
    if (!d.inside) {
      if (d.fromShelf) { PB.sfx('tick'); return; }
      pushUndo(d.undo);
      removeSticker(st);
      return;
    }
    pushUndo(d.fromShelf ? null : d.undo);
    if (d.fromShelf) scene.items.push(st);
    land(st);
    select(st);
    PB.changed('user');
  }
  // 放下：不在合法区域就落到最近的合法位置
  const SWIMMERS = { duck: 1, ducklings: 1, boat: 1 };
  function land(st) {
    let [cx, cy] = constrain(st.id, st.x, st.y);
    // 水里的东西放到池塘附近就吸进水面
    if (SWIMMERS[st.id] && !PB.pondAt(cx, cy) && PB.pondAt(cx, cy, 1.7)) {
      const p = PB.pondAt(cx, cy, 1.7), k = kOf(p), f = DEFS.pond.foot;
      const dx = (cx - p.x) / (f.rx * k), dy = (cy - p.y) / (f.ry * k), d = Math.hypot(dx, dy) || 1;
      const r = Math.min(d, 0.6) / d;
      cx = p.x + dx * r * f.rx * k; cy = p.y + dy * r * f.ry * k;
    }
    const far = Math.hypot(cx - st.x, cy - st.y) > 24;
    const finish = () => {
      PB.lastPlaced = { st, t: now() };        // 刚贴上去的：有些反应只认"刚贴"
      st.pop = { type: 'stick', t0: now() };
      PB.sfx('stick');
      if (DEFS[st.id].zone === 'ground') dust(st.x, st.y, kOf(st));
      const v = DEFS[st.id].voice;
      if (v && Math.random() < 0.7) PB.sfx(v, 0.12);
    };
    if (far) {
      st.tw = { x0: st.x, y0: st.y, x1: cx, y1: cy, t0: now(), dur: 0.26, arc: 0 };
      st.x = cx; st.y = cy;
      PB.later(0.26, () => { st.tw = null; finish(); PB.changed('land'); });
    } else { st.x = cx; st.y = cy; finish(); }
  }
  function quickPlace(id) {
    if (full()) return;
    const st = mkItem(id, 0, 0, { pop: 'spawn' });
    const z = DEFS[id].zone;
    if (z === 'ground' || z === 'flat') { st.y = rnd(FY0 + 70, FY1 - 60); const [a, b] = PB.floorX(st.y); st.x = rnd(a + 120, b - 120); }
    else if (z === 'celestial') { st.x = rnd(PB.BACK.x0 + 120, PB.BACK.x1 - 120); st.y = rnd(PB.BACK.y0 + 50, 220); }
    else { st.x = rnd(OPEN.x0 + 200, OPEN.x1 - 200); st.y = rnd(OPEN.y0 + 80, 280); }
    pushUndo();
    scene.items.push(st);
    PB.lastPlaced = { st, t: now() };
    PB.sfx('stick'); clearFresh(id);
    const v = DEFS[id].voice; if (v) PB.sfx(v, 0.15);
    select(st);
    PB.changed('user');
  }
  function removeSticker(st) {
    if (selected === st) select(null);
    st.dying = { t0: now(), dir: Math.random() < 0.5 ? -1 : 1 };
    PB.sfx('tear');
    PB.later(0.4, () => { const i = scene.items.indexOf(st); if (i >= 0) scene.items.splice(i, 1); PB.changed('del'); });
    PB.changed('del');
  }
  // 点一下：弹一下、出声；睡着的猫会被叫醒
  function poke(st) {
    st.pop = { type: 'stick', t0: now() };
    const v = DEFS[st.id].voice;
    if (st.id === 'bench' && st.state.cat) {
      pushUndo();
      const k = kOf(st);
      st.state = Object.assign({}, st.state, { cat: false });
      const [wx, wy] = constrain('cat', st.x + 105 * k * (Math.random() < 0.5 ? -1 : 1), st.y + 16 * k);
      const c = mkItem('cat', wx, wy, { pop: 'spawn', flip: wx < st.x });
      scene.items.push(c);
      const [ex, ey] = [c.x, c.y];
      c.x = st.x; c.y = st.y - 22 * k;
      PB.move(c, ex, ey, { dur: 0.5, arc: 40, face: true });
      c.flags.woke = 1;
      PB.sfx('meow');
      PB.changed('user');
    } else if (v) PB.sfx(v);
    else PB.sfx('boing');
  }

  // 画布事件
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    PB.unlockAudio();
    const [wx, wy] = toWorld(e);
    const t = now();
    const hit = pickOrder().find(st => (!st.tw || st.tw.puppet) && hitTest(st, wx, wy, t));
    if (hit) {
      if (hit.tw) { const p = PB.posOf(hit); hit.x = p.x; hit.y = p.y; hit.tw = null; hit.kLock = null; }
      select(hit); startExistingDrag(hit, e, wx, wy);
    }
    else select(null);
  });
  window.addEventListener('pointermove', e => {
    if (pending && !drag) {
      const far = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
      if (pending.touch) { if (far > 8) { clearTimeout(pending.timer); pending = null; } return; }
      if (far > 5) { startNewDrag(pending.id, e); pending = null; }
      return;
    }
    if (drag) { moveDrag(e); return; }
    if (e.target === cv) {
      const [wx, wy] = toWorld(e), t = now();
      const hit = pickOrder().find(st => (!st.tw || st.tw.puppet) && hitTest(st, wx, wy, t));
      cv.style.cursor = hit ? 'grab' : 'default';
      hover = hit || null;
    } else hover = null;
  });
  let hover = null;
  window.addEventListener('pointerup', e => {
    if (pending) { const id = pending.id; clearTimeout(pending.timer); pending = null; quickPlace(id); return; }
    if (drag) endDrag(e);
  });
  window.addEventListener('pointercancel', () => {
    if (pending) clearTimeout(pending.timer);
    pending = null;
    if (drag) { const st = drag.st; drag = null; PB.dragItem = null; st.lift = 0; ghost.style.display = 'none'; }
  });
  let lastWheel = 0;
  cv.addEventListener('wheel', e => {
    const st = hover || selected; if (!st) return;
    e.preventDefault();
    const t = performance.now();
    if (t - lastWheel > 700) pushUndo();
    lastWheel = t;
    st.s = clamp(st.s * (e.deltaY < 0 ? 1.07 : 1 / 1.07), 0.5, 1.8);
    PB.changed('scale');
  }, { passive: false });

  // ---------- 选择 ----------
  const selBar = $('#selBar');
  function select(st) {
    selected = st;
    if (st) { $('#selName').textContent = PB.nameOf(st.id, scene.season); selBar.classList.add('show'); }
    else selBar.classList.remove('show');
  }
  selBar.addEventListener('pointerdown', e => e.stopPropagation());
  selBar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !selected) return;
    const st = selected, act = b.dataset.act;
    if (act === 'del') { pushUndo(); removeSticker(st); return; }
    if (act === 'copy') { duplicate(st); return; }
    pushUndo();
    if (act === 'flip') st.flip = !st.flip;
    if (act === 'bigger') st.s = clamp(st.s * 1.12, 0.5, 1.8);
    if (act === 'smaller') st.s = clamp(st.s / 1.12, 0.5, 1.8);
    st.pop = { type: 'stick', t0: now() }; PB.sfx('tick');
    PB.changed('user');
  });
  function duplicate(st) {
    if (full()) return;
    pushUndo();
    const k = kOf(st);
    const [x, y] = constrain(st.id, st.x + 46 * k * (st.flip ? -1 : 1), st.y + (DEFS[st.id].zone === 'ground' || DEFS[st.id].zone === 'flat' ? 14 : 20));
    const c = mkItem(st.id, x, y, { s: st.s, flip: st.flip, pop: 'spawn' });
    scene.items.push(c);
    PB.sfx('peel'); PB.sfx('stick', 0.12);
    select(c); PB.changed('user');
  }
  const MAX_ITEMS = 160;
  function full() {
    if (scene.items.filter(s => !s.dying).length < MAX_ITEMS) return false;
    showTip('盒子塞满啦，先撕掉几张再贴吧。', true); PB.sfx('tick');
    return true;
  }
  function placeSelBar() {
    if (!selected || drag && drag.moved || !scene.items.includes(selected) || selected.dying) {
      if (selected && (!scene.items.includes(selected) || selected.dying)) select(null);
      selBar.style.visibility = selected && drag && drag.moved ? 'hidden' : 'visible';
      return;
    }
    selBar.style.visibility = 'visible';
    const b = boxOf(selected);
    let [x, y] = toCss(b.x + b.w / 2, b.y);
    const [, yb] = toCss(0, b.y + b.h);
    const bw = selBar.offsetWidth || 180;
    x = clamp(x, bw / 2 + 4, cssW - bw / 2 - 4);
    if (y < 46) y = Math.min(cssH - 4, yb + 44);
    selBar.style.left = x + 'px'; selBar.style.top = (y - 6) + 'px';
  }

  // 键盘
  window.addEventListener('keydown', e => {
    if ($('#modal').classList.contains('show')) { if (e.key === 'Escape') closeModal(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (e.key === 'Escape') { select(null); return; }
    if (!selected) return;
    const st = selected;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); pushUndo(); removeSticker(st); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(st); }
    else if (e.key.toLowerCase() === 'f') { pushUndo(); st.flip = !st.flip; st.pop = { type: 'stick', t0: now() }; PB.changed('user'); }
    else if (e.key === '+' || e.key === '=') { pushUndo(); st.s = clamp(st.s * 1.12, 0.5, 1.8); PB.changed('user'); }
    else if (e.key === '-' || e.key === '_') { pushUndo(); st.s = clamp(st.s / 1.12, 0.5, 1.8); PB.changed('user'); }
  });

  // ---------- 拖动时提示能起反应的搭档 ----------
  const PAIRS = [
    ['raincloud', 'sapling', () => scene.season !== 'winter'],
    ['raincloud', 'pond', () => scene.season !== 'winter'],
    ['raincloud', 'tree', () => scene.season === 'autumn'],
    ['raincloud', 'rock', () => scene.season === 'winter'],
    ['raincloud', 'sun', () => scene.time !== 'night'],
    ['bird', 'tree', () => scene.season === 'spring' || scene.season === 'summer', t => !t.state.nest],
    ['cat', 'bird', () => true], ['cat', 'bench', () => true, b => !b.state.cat],
    ['duck', 'pond', () => true], ['duck', 'duck', () => scene.season === 'spring', d => !d.flags.kids],
    ['ducklings', 'pond', () => true], ['frog', 'pond', () => scene.season === 'summer', p => !p.flags.lotus],
    ['bridge', 'pond', () => true], ['boat', 'pond', () => true],
    ['moon', 'bench', () => scene.time === 'night'],
    ['scarecrow', 'bird', () => true], ['scarecrow', 'grass', () => scene.season === 'autumn', c => !c.flags.harvest],
    ['scarecrow', 'flowers', () => scene.season === 'autumn', c => !c.flags.harvest],
    ['raincloud', 'flowers', () => scene.season !== 'winter', f => !f.flags.snail],
    ['sheep', 'fence', () => true], ['cloud', 'windmill', () => true], ['raincloud', 'windmill', () => true],
    ['mushroom', 'tree', () => scene.season === 'autumn'],
    ['cat', 'mouse', () => true], ['moon', 'sun', () => scene.time !== 'night'], ['sun', 'moon', () => scene.time !== 'day'],
  ];
  function partnersOf(id) {
    const out = [];
    for (const [a, b, c, ok] of PAIRS) {
      if (!c()) continue;
      if (a === id) out.push([b, ok]); else if (b === id) out.push([a, null]);
    }
    return out;
  }
  function drawPartnerHints(t) {
    const st = drag.st, ps = partnersOf(st.id);
    if (!ps.length) return;
    for (const o of scene.items) {
      if (o === st || o.dying) continue;
      const m = ps.find(([id, ok]) => id === o.id && (!ok || ok(o)));
      if (!m) continue;
      const d = Math.hypot(o.x - st.x, o.y - st.y);
      if (d > 420) continue;
      const a = Math.min(1, (420 - d) / 200);
      const b = boxOf(o), cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) * 0.55 + 6;
      ctx.save();
      const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.15);
      hg.addColorStop(0, `rgba(255,226,110,${0.5 * a})`); hg.addColorStop(0.6, `rgba(255,236,150,${0.25 * a})`); hg.addColorStop(1, "rgba(255,240,170,0)");
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, r * 1.15, 0, TAU); ctx.fill();
      ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(t * 5));
      for (let i = 0; i < 4; i++) {
        const ang = t * 1.6 + i * Math.PI / 2 + o.uid, x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * 0.8, s = 13 + 4 * Math.sin(t * 6 + i);
        ctx.fillStyle = i % 2 ? '#fff6c2' : '#ffd84d';
        ctx.beginPath();
        for (let j = 0; j < 8; j++) { const aa = j * Math.PI / 4, rr = j % 2 ? s * 0.3 : s; ctx.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---------- 画布上的界面层 ----------
  function drawUi(t) {
    ctx.setTransform(px, 0, 0, px, 0, 0);
    if (drag && drag.moved) drawPartnerHints(t);
    if (selected && !(drag && drag.moved) && scene.items.includes(selected)) {
      const b = boxOf(selected), p = 6;
      ctx.save();
      ctx.lineWidth = 2.2; ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 18;
      ctx.strokeStyle = 'rgba(74,59,50,0.8)';
      ctx.beginPath(); ctx.roundRect(b.x - p, b.y - p, b.w + p * 2, b.h + p * 2, 12); ctx.stroke();
      ctx.lineDashOffset = -t * 18 + 6.5; ctx.strokeStyle = 'rgba(255,253,245,0.95)';
      ctx.beginPath(); ctx.roundRect(b.x - p, b.y - p, b.w + p * 2, b.h + p * 2, 12); ctx.stroke();
      ctx.restore();
    }
    if (drag && drag.moved && drag.inside) {
      const st = drag.st, z = DEFS[st.id].zone;
      if (z === 'ground' || z === 'flat') {
        const [cx, cy] = constrain(st.id, st.x, st.y), k = depthK(cy) * st.s;
        ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, 34 * k, 9 * k, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
      PB.drawSticker(ctx, st, t, scene.season);
    }
  }

  // ---------- 提示条 ----------
  const narrow = () => window.innerWidth <= 980;
  const TIPS = [
    () => matchMedia('(pointer: coarse)').matches
      ? `按住${narrow() ? '下面' : '右边'}贴纸册里的贴纸，拖进盒子。放得越靠下，贴纸越大、越靠前。`
      : `从${narrow() ? '下面' : '右边'}的贴纸册把贴纸拖进盒子。放得越靠下，贴纸越大、越靠前。`,
    '贴纸之间会起反应：把「雨云」挂到树苗正上方试试。',
    '换个季节、或者让天黑下来，盒子里的东西会跟着变。',
    '点一下盒子里的贴纸，可以翻转、放大、缩小；把它拖出盒子就撕掉了。',
    '下面那张委托卡写着客人的要求，全部打勾就能交付。',
    '「图鉴」里有还没发现的反应的线索。',
    '鼠标滚轮可以缩放指着的贴纸，Ctrl+Z 撤销。',
    '点一下小动物，它会叫一声。',
  ];
  let tipI = 0, tipTimer = 0;
  function showTip(text, urgent) {
    const el = $('#tipText');
    el.parentElement.style.opacity = 0;
    if (typeof text === 'function') text = text();
    setTimeout(() => { el.textContent = text; el.parentElement.style.opacity = 0.92; }, urgent ? 60 : 300);
    clearTimeout(tipTimer);
    tipTimer = setTimeout(nextTip, urgent ? 7000 : 15000);
  }
  function nextTip() { showTip(TIPS[tipI++ % TIPS.length]); }

  // ---------- 发现提示 ----------
  function toast(d) {
    const box = $('#toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div'); el.className = 'toast';
    const un = d.unlock ? `<span class="u">解锁贴纸：${DEFS[d.unlock].name}</span>` : '';
    el.innerHTML = `<canvas></canvas><div><div class="k">新发现</div><div class="n">${d.name}</div><div class="d">${d.desc}</div>${un}</div>`;
    box.appendChild(el);
    thumb(el.querySelector('canvas'), d.icon, d.iconV);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 420); }, 5200);
  }
  PB.onDiscover = d => {
    toast(d); updateCounts();
    if (d.unlock) { buildTabs(); if (DEFS[d.unlock].tab === tab) buildShelf(); }
    if (Object.keys(save.disc).length === PB.DISC.length) {
      setTimeout(() => { showTip(`${PB.DISC.length} 种反应全部找到了！这个纸盒已经没有秘密了。`, true); PB.sfx('fanfare'); for (let i = 0; i < 5; i++) setTimeout(() => PB.sparkle(rnd(200, 1080), rnd(120, 500), 20, 1.5), i * 200); }, 1200);
    }
    saveSoon();
  };
  function updateCounts() {
    $('#discCount').textContent = `${Object.keys(save.disc).length}/${PB.DISC.length}`;
    $('#jobCount').textContent = `${Object.keys(save.jobs).length}/${PB.JOBS.length}`;
  }

  // ---------- 委托卡 ----------
  let jobHtml = '';
  const starsHtml = (n, of = 3) => Array.from({ length: of }, (_, i) => i < n ? '★' : '<span class="off">★</span>').join('');
  function renderJob() {
    const el = $('#job');
    const job = PB.JMAP[save.active];
    let html;
    if (!job) {
      html = `<div class="pin"></div><div style="font:18px var(--display);margin-bottom:8px">现在没有接委托</div><button class="chip" data-act="board">去委托板挑一个</button>`;
      el.classList.add('empty');
    } else {
      el.classList.remove('empty');
      const s = PB.jobState(job), best = save.jobs[job.id] || 0;
      const li = (c, bonus) => `<li class="${c.ok ? 'ok' : ''} ${bonus ? 'bonus' : ''}"><i>${c.ok ? (bonus ? '★' : '✓') : ''}</i><span>${c.text}${c.h && !c.ok ? `<em>${c.h}</em>` : ''}</span></li>`;
      html = `<div class="pin"></div>
        <div class="hd"><canvas></canvas><div><div class="tt">${job.title}</div><div class="tx">${job.text}</div></div></div>
        <ul class="conds"><li class="sep">要求</li>${s.req.map(c => li(c)).join('')}<li class="sep">加分（每项多一颗星）</li>${s.bonus.map(c => li(c, true)).join('')}</ul>
        <div class="ft"><span class="stars" title="${best ? '最好成绩 ' + best + ' 星' : ''}">${starsHtml(s.stars)}</span>
        <button class="link" data-act="board">换一个</button>
        <button class="chip ${s.ready ? 'ready' : ''}" id="btnDeliver" data-act="deliver" ${s.ready ? '' : 'disabled'}>交付</button></div>`;
    }
    if (html === jobHtml) return;
    jobHtml = html; el.innerHTML = html;
    if (job) thumb(el.querySelector('canvas'), job.client, { season: job.client === 'snowman' ? 'winter' : scene.season });
  }
  $('#job').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'board') openJobs();
    if (b.dataset.act === 'deliver') deliver();
  });
  function deliver() {
    const job = PB.JMAP[save.active]; if (!job) return;
    const s = PB.jobState(job); if (!s.ready) return;
    const prev = save.jobs[job.id] || 0;
    save.jobs[job.id] = Math.max(prev, s.stars);
    select(null);
    const img = takePhoto(`委托 · ${job.title}`, true);
    PB.sfx('fanfare', 0.25);
    updateCounts(); saveSoon();
    showDone(job, s.stars, img, prev);
  }
  function nextJobId(from) {
    const ids = PB.JOBS.map(j => j.id), i = ids.indexOf(from);
    for (let k = 1; k <= ids.length; k++) { const id = ids[(i + k) % ids.length]; if (!save.jobs[id]) return id; }
    return null;
  }

  // ---------- 拍照 ----------
  function takePhoto(caption, quiet) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const k = c.getContext('2d');
    render(k, 1, now());
    const o = document.createElement('canvas'); o.width = 880; o.height = Math.round(880 * H / W);
    const ok = o.getContext('2d'); ok.fillStyle = '#fff'; ok.fillRect(0, 0, o.width, o.height);
    ok.drawImage(c, 0, 0, o.width, o.height);
    const url = o.toDataURL('image/jpeg', 0.86);
    const d = new Date();
    album.unshift({ img: url, t: d.getTime(), cap: caption || `${{ spring: '春', summer: '夏', autumn: '秋', winter: '冬' }[scene.season]}${{ day: '日', dusk: '暮', night: '夜' }[scene.time]}小景` });
    if (album.length > 24) album.length = 24;
    for (;;) {
      try { localStorage.setItem(AKEY, JSON.stringify(album)); break; } catch (e) { if (album.length <= 1) break; album.pop(); }
    }
    const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    PB.sfx('shutter');
    if (!quiet) showTip('拍好了，照片在「相册」里。', true);
    return url;
  }

  // ---------- 弹窗 ----------
  const modal = $('#modal');
  function openModal(title, sub, body, cls = '') {
    modal.innerHTML = `<div class="sheet ${cls}"><div class="top"><h3>${title}</h3><span class="sub">${sub || ''}</span><button class="chip icon x" data-close title="关闭（Esc）"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="body">${body}</div></div>`;
    modal.classList.add('show');
    PB.sfx('tick');
    return modal.querySelector('.body');
  }
  function closeModal() { modal.classList.remove('show'); modal.innerHTML = ''; }
  modal.addEventListener('pointerdown', e => { if (e.target === modal) closeModal(); });
  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });

  function openBook() {
    const n = Object.keys(save.disc).length;
    const body = openModal('图鉴', `发现了 ${n} / ${PB.DISC.length} 种反应`, `<div class="grid">${PB.DISC.map(d => {
      const got = save.disc[d.id];
      return got
        ? `<div class="card"><canvas data-i="${d.id}"></canvas><div><div class="n">${d.name}</div><div class="d">${d.desc}</div>${d.unlock ? `<span class="u">解锁：${DEFS[d.unlock].name}</span>` : ''}</div></div>`
        : `<div class="card lock"><canvas data-i="${d.id}"></canvas><div><div class="n">？？？</div><div class="h">线索：${d.hint}</div></div></div>`;
    }).join('')}</div>`);
    body.querySelectorAll('canvas').forEach(c => { const d = PB.DMAP[c.dataset.i]; thumb(c, d.icon, d.iconV, !save.disc[d.id]); });
  }
  $('#btnBook').onclick = openBook;

  function openJobs() {
    const done = Object.keys(save.jobs).length;
    const body = openModal('委托板', `完成了 ${done} / ${PB.JOBS.length} 个`, `<div class="grid">${PB.JOBS.map(j => {
      const best = save.jobs[j.id] || 0, cur = save.active === j.id;
      return `<div class="card jobcard ${cur ? 'cur' : ''}"><div class="pin"></div>
        <div class="row"><canvas data-c="${j.client}"></canvas><div><div class="n">${j.title}</div><div class="d">${j.text}</div></div></div>
        <div class="row" style="justify-content:space-between"><span class="stars">${best ? starsHtml(best) : '<span class="off">★★★</span>'}</span>
        <button class="chip go" data-job="${j.id}" ${cur ? 'disabled' : ''}>${cur ? '进行中' : best ? '再做一次' : '接下'}</button></div></div>`;
    }).join('')}</div>`);
    body.querySelectorAll('canvas').forEach(c => thumb(c, c.dataset.c, { season: c.dataset.c === 'snowman' ? 'winter' : scene.season }));
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-job]'); if (!b) return;
      save.active = b.dataset.job; saveSoon(); jobHtml = ''; renderJob(); closeModal(); PB.sfx('stick');
    });
  }
  $('#btnJobs').onclick = openJobs;

  function openAlbum() {
    const body = openModal('相册', album.length ? `${album.length} 张` : '', album.length
      ? `<div class="album">${album.map((p, i) => `<div class="polaroid" data-i="${i}"><img src="${p.img}" alt=""><div class="c"><span>${p.cap}</span><small>${new Date(p.t).toLocaleDateString('zh-CN')}</small></div></div>`).join('')}</div>`
      : '<div class="empty-note">还没有照片。摆好一个喜欢的场景，点顶上的「拍照」。</div>');
    body.addEventListener('click', e => { const p = e.target.closest('.polaroid'); if (p) openPhoto(+p.dataset.i); });
  }
  function openPhoto(i) {
    const p = album[i]; if (!p) return;
    const body = openModal(p.cap, new Date(p.t).toLocaleString('zh-CN'), `<div class="viewer"><img src="${p.img}" alt=""><div class="acts">
      <button class="chip" data-a="back">返回相册</button><button class="chip primary" data-a="dl">下载</button><button class="chip" data-a="del">删掉</button></div></div>`);
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'back') openAlbum();
      if (b.dataset.a === 'dl') { const a = document.createElement('a'); a.href = p.img; a.download = `纸盒小景-${p.t}.jpg`; a.click(); }
      if (b.dataset.a === 'del') { album.splice(i, 1); try { localStorage.setItem(AKEY, JSON.stringify(album)); } catch (err) { /* ignore */ } openAlbum(); }
    });
  }
  $('#btnAlbum').onclick = openAlbum;
  $('#btnPhoto').onclick = () => { PB.unlockAudio(); select(null); takePhoto(); };

  function showDone(job, stars, img, prev) {
    const nxt = nextJobId(job.id);
    const body = openModal('委托完成', '', `<div class="done">
      <div class="photo"><img src="${img}" alt=""><div class="cap">${job.title}</div>
        <div class="stamp">完成<span class="st">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span></div></div>
      <div class="thanks">${DEFS[job.client].name}：「谢谢你！${stars === 3 ? '这正是我想要的样子。' : stars === 2 ? '好喜欢！' : '挺好的！'}」${prev && stars <= prev ? '' : ''}</div>
      <div class="acts">${stars < 3 ? '<button class="chip" data-a="stay">再改改，冲三星</button>' : ''}${nxt ? '<button class="chip primary" data-a="next">下一个委托</button>' : '<button class="chip primary" data-a="board">看看委托板</button>'}</div></div>`);
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'next') { save.active = nxt; saveSoon(); jobHtml = ''; renderJob(); closeModal(); }
      if (b.dataset.a === 'stay') closeModal();
      if (b.dataset.a === 'board') openJobs();
    });
    for (let i = 0; i < 3; i++) setTimeout(() => PB.sparkle(W / 2 + rnd(-300, 300), rnd(150, 450), 18, 1.4), i * 180);
  }

  $('#btnClear').onclick = () => {
    const body = openModal('清空盒子？', '', `<div style="padding:4px 4px 8px">盒子里的 ${scene.items.length} 张贴纸会全部撕掉（可以用撤销找回来）。图鉴、相册和委托成绩不受影响。</div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="chip" data-close>算了</button><button class="chip primary" data-a="ok">全部撕掉</button></div>`);
    body.addEventListener('click', e => {
      if (!e.target.closest('[data-a="ok"]')) return;
      pushUndo(); select(null); PB.clearJobs();
      scene.items.forEach((st, i) => { st.dying = { t0: now() + i * 0.015, dir: i % 2 ? 1 : -1 }; });
      PB.later(0.7, () => { scene.items = scene.items.filter(s => !s.dying); PB.changed('clear'); });
      PB.sfx('tear'); closeModal();
    });
  };
  $('#btnUndo').onclick = undo;
  function syncMute() {
    const m = save.muted;
    document.querySelector('#icoSound .w').style.display = m ? 'none' : '';
    document.querySelector('#icoSound .m').style.display = m ? '' : 'none';
    PB.setMuted(m);
  }
  $('#btnMute').onclick = () => { save.muted = !save.muted; syncMute(); saveSoon(); if (!save.muted) PB.sfx('tick'); };

  // ---------- 环境音 ----------
  setInterval(() => {
    if (save.muted || document.hidden) return;
    const s = scene.season, t = scene.time;
    const rain = s === 'winter' ? 0 : all('raincloud').length;
    PB.setRain(rain);
    if (t !== 'night' && s !== 'winter' && (all('bird').length || all('birdfly').length) && Math.random() < 0.07) PB.sfx('chirp');
    if (all('frog').length && (t === 'night' || rain) && Math.random() < 0.08) PB.sfx('croak');
    if (s === 'summer' && t === 'night' && all('grass').length && Math.random() < 0.35) PB.sfx('cricket');
    if (all('duck').some(d => PB.pondAt(d.x, d.y)) && Math.random() < 0.025) PB.sfx('quack');
  }, 1000);

  // ---------- 开局 ----------
  function starter() {
    scene.season = 'summer'; scene.time = 'day'; scene.items = [];
    const P = (id, x, y, o) => scene.items.push(mkItem(id, x, y, o || {}));
    P('sun', 915, 170);
    P('cloud', 420, 150);
    P('pine', 300, 432);
    P('tree', 440, 530);
    P('house', 900, 455);
    P('fence', 1010, 520);
    P('grass', 470, 610, { flip: true });
    P('sapling', 700, 575);
    P('flowers', 580, 690);
    P('rock', 1040, 665);
  }

  // ---------- 主循环 ----------
  let lastT = now(), jobTick = 0;
  function frame() {
    const t = now(), dt = Math.min(0.05, t - lastT); lastT = t;
    PB.runJobs(t);
    if (evalPending) { evalPending = false; PB.evaluate(); jobTick = 1; }
    updateParts(dt, t);
    render(ctx, px, t);
    drawTransition(t);
    drawUi(t);
    placeSelBar();
    jobTick += dt;
    if (jobTick > 0.4) { jobTick = 0; renderJob(); }
    requestAnimationFrame(frame);
  }

  // ---------- 景深滑块 ----------
  const depthInput = $('#depth');
  function syncDepth() { depthInput.value = Math.round(PB.getDepth() * 100); }
  depthInput.addEventListener('input', () => {
    PB.setDepth(depthInput.value / 100);
    save.depth = PB.getDepth();
    saveSoon();
  });
  depthInput.addEventListener('change', () => PB.sfx('tick'));
  depthInput.addEventListener('pointerdown', e => e.stopPropagation());

  function boot() {
    // 先定景深，再读档（读档时按当前盒子形状约束贴纸位置）
    PB.setDepth(save.depth || PB.DEPTH_DEFAULT); syncDepth();
    if (save.scene && save.scene.items) deserialize(save.scene); else starter();
    buildSegs(); buildTabs(); resize(); buildShelf(); updateCounts(); syncMute(); renderJob();
    showTip(TIPS[0]); tipI = 1;
    if (matchMedia('(pointer: coarse)').matches) $('#bookHint').textContent = '按住拖进盒子 · 点一下也能贴';
    window.addEventListener('resize', () => { resize(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { PB.fontReady = true; buildShelf(); });
    requestAnimationFrame(frame);
  }

  // ---------- 测试接口 ----------
  window.__TEST__ = {
    place(id, x, y, o = {}) { const st = mkItem(id, x, y, o); scene.items.push(st); PB.changed('test'); return st.uid; },
    setSeason, setTime,
    clear() { scene.items = []; PB.clearJobs(); PB.parts.length = 0; PB.changed('test'); },
    unlockAll() { for (const id in DEFS) save.unlocked[id] = 1; buildShelf(); },
    resetSave() { localStorage.removeItem(KEY); localStorage.removeItem(AKEY); },
    state() { return { season: scene.season, time: scene.time, items: scene.items.map(s => ({ uid: s.uid, id: s.id, x: Math.round(s.x), y: Math.round(s.y), state: s.state })), disc: Object.keys(save.disc), unlocked: Object.keys(save.unlocked), active: save.active, jobs: save.jobs }; },
    select(uid) { select(scene.items.find(s => s.uid === uid) || null); },
    job() { const j = PB.JMAP[save.active]; return j && PB.jobState(j); },
    deliver, openBook, openJobs, openAlbum, closeModal, takePhoto, undo, starter() { starter(); PB.changed('test'); },
    toScreen(wx, wy) { const r = cv.getBoundingClientRect(); return [r.left + wx / W * r.width, r.top + wy / H * r.height]; },
    tab(t) { tab = t; buildTabs(); buildShelf(); },
  };

  boot();
})();
