// rules.js — 贴纸之间的反应、图鉴发现、委托
(function () {
  'use strict';
  const PB = window.PB;
  const { DEFS, scene, all, live, kOf, pondAt, mkItem, sparkle, constrain, now, clamp } = PB;

  // ---------- 关系判断 ----------
  // 云在目标正上方（雨会落到它身上）
  const above = (c, t) => Math.abs(c.x - t.x) < 64 * kOf(c) && t.y - c.y > 20 && t.y - c.y < 560;
  const near = (a, b, r) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.5) < r * (kOf(a) + kOf(b)) / 2;
  const idle = st => !st.tw && !st.dying && !st.busy && st !== PB.dragItem;

  // ---------- 延时任务（可被撤销清掉） ----------
  const jobs = [];
  function later(sec, fn) { jobs.push({ at: now() + sec, fn }); }
  function runJobs(t) {
    for (let i = 0; i < jobs.length; i++) {
      if (t >= jobs[i].at) { const j = jobs.splice(i, 1)[0]; i--; j.fn(); }
    }
  }

  // ---------- 效果 ----------
  function spawn(id, x, y, o = {}) {
    [x, y] = constrain(id, x, y);
    const st = mkItem(id, x, y, { pop: 'spawn', flip: o.flip });
    scene.items.push(st);
    PB.sfx('pop');
    if (o.from) flyTo(st, o.from[0], o.from[1], x, y, o.dur || 0.55, o.arc || 50);
    else PB.changed('react');
    return st;
  }
  function flyTo(st, x0, y0, x1, y1, dur, arc, done) {
    st.kLock = kOf(st);
    st.tw = { x0, y0, x1, y1, t0: now(), dur, arc };
    later(dur, () => { st.x = x1; st.y = y1; st.tw = null; st.kLock = null; if (done) done(); PB.changed('react'); });
  }
  function transform(st, id) {
    st.id = id; st.state = {}; st.pop = { type: 'grow', t0: now() };
    PB.sfx('grow');
  }
  function removeNow(st) { const i = scene.items.indexOf(st); if (i >= 0) scene.items.splice(i, 1); }
  const top = st => { const b = PB.boxOf(st); return [b.x + b.w / 2, b.y + b.h * 0.35]; };

  // ---------- 图鉴 ----------
  const DISC = [
    { id: 'chunyu', name: '春雨', icon: 'sapling', hint: '雨云 + 树苗', desc: '雨落在树苗上，它一口气长成了大树。' },
    { id: 'wa', name: '蛙鸣', icon: 'frog', unlock: 'frog', hint: '雨云 + 池塘', desc: '雨点落进池塘，一只青蛙跳了出来。' },
    { id: 'hetang', name: '荷塘', icon: 'lotus', unlock: 'lotus', hint: '夏天 · 青蛙 + 池塘', desc: '夏天的池塘边蹲着青蛙，荷花开了。' },
    { id: 'caihong', name: '彩虹', icon: 'rainbow', unlock: 'rainbow', hint: '雨云 + 太阳', desc: '太阳照着雨，天上挂起一道彩虹。' },
    { id: 'diewu', name: '蝶舞', icon: 'butterfly', unlock: 'butterfly', hint: '春天白天 · 花丛', desc: '春天的花丛引来了蝴蝶。' },
    { id: 'zhuchao', name: '筑巢', icon: 'tree', iconV: { state: { nest: true } }, hint: '春夏 · 小鸟 + 大树', desc: '小鸟飞进树冠，在那儿搭了个窝。' },
    { id: 'xiaoya', name: '一家子', icon: 'ducklings', unlock: 'ducklings', hint: '春天 · 鸭子 + 鸭子', desc: '两只鸭子凑在一起，身后跟上了一串小鸭。' },
    { id: 'xishui', name: '戏水', icon: 'duck', iconV: { variant: 'swim' }, hint: '鸭子 + 池塘', desc: '鸭子下水游起来了。' },
    { id: 'jingniao', name: '惊鸟', icon: 'birdfly', unlock: 'birdfly', hint: '猫 + 小鸟', desc: '猫一靠近，小鸟扑棱棱飞走了。' },
    { id: 'wushui', name: '午睡', icon: 'bench', iconV: { state: { cat: true } }, hint: '猫 + 长椅', desc: '猫跳上长椅，蜷成一团睡着了。' },
    { id: 'mogu', name: '雨后蘑菇', icon: 'mushroom', unlock: 'mushroom', hint: '秋天 · 雨云 + 大树', desc: '秋雨过后，树根下冒出一簇蘑菇。' },
    { id: 'yeguang', name: '夜光菇', icon: 'mushroom', hint: '夜晚 · 蘑菇', desc: '天黑以后，蘑菇发出淡淡的荧光。' },
    { id: 'luoying', name: '落樱', icon: 'tree', iconV: { season: 'spring' }, hint: '春天 · 大树', desc: '风一吹，花瓣纷纷往下落。' },
    { id: 'qiuye', name: '秋叶', icon: 'tree', iconV: { season: 'autumn' }, hint: '秋天 · 大树', desc: '秋天的树开始掉叶子了。' },
    { id: 'yinghuo', name: '萤火', icon: 'firefly', unlock: 'firefly', hint: '夏天夜晚 · 草丛', desc: '夏天夜里，草丛里飞起了萤火虫。' },
    { id: 'xueren', name: '堆雪人', icon: 'snowman', unlock: 'snowman', hint: '冬天 · 雪云 + 石头', desc: '雪落在石头上，堆成了一个雪人。' },
    { id: 'huabing', name: '滑冰', icon: 'duck', iconV: { season: 'winter', variant: 'skate' }, hint: '冬天 · 鸭子 + 池塘', desc: '池塘结冰了，鸭子围上围巾去滑冰。' },
    { id: 'xuetu', name: '雪兔', icon: 'rabbit', iconV: { season: 'winter' }, hint: '冬天 · 兔子', desc: '冬天到了，兔子换上了一身白毛。' },
    { id: 'chuiyan', name: '炊烟', icon: 'house', iconV: { season: 'autumn' }, hint: '秋冬或黄昏 · 小屋', desc: '屋顶的烟囱冒起了炊烟。' },
    { id: 'denghuo', name: '万家灯火', icon: 'house', hint: '夜晚 · 小屋', desc: '天黑了，小屋的窗子亮了起来。' },
    { id: 'tideng', name: '路灯亮了', icon: 'lantern', hint: '夜晚 · 路灯', desc: '路灯在地上照出一圈暖光。' },
    { id: 'liuxing', name: '许愿', icon: 'star', unlock: 'star', hint: '夜晚 · 月亮 + 长椅', desc: '坐在长椅上看月亮，一颗流星划了过去。' },
    { id: 'xiaoqiao', name: '小桥流水', icon: 'bridge', unlock: 'boat', hint: '小木桥 + 池塘', desc: '池塘上架起一座桥，可以划船了。' },
    { id: 'fanzhou', name: '泛舟', icon: 'boat', hint: '小船 + 池塘', desc: '小船在水面上轻轻摇。' },
    { id: 'yangjuan', name: '羊圈', icon: 'sheep', hint: '绵羊 + 篱笆', desc: '绵羊找到了篱笆，安心地在里面吃草。' },
    { id: 'yangmao', name: '红围巾', icon: 'sheep', iconV: { season: 'winter' }, hint: '冬天 · 绵羊', desc: '冬天到了，绵羊围上了红围巾。' },
    { id: 'qifeng', name: '起风了', icon: 'windmill', hint: '风车 + 云', desc: '云飘过来，风车呼呼地转起来。' },
    { id: 'daocaoren', name: '稻草人', icon: 'scarecrow', unlock: 'birdfly', hint: '稻草人 + 小鸟', desc: '小鸟被稻草人吓了一跳，飞走了。' },
    { id: 'qiushou', name: '秋收', icon: 'pumpkin', unlock: 'pumpkin', hint: '秋天 · 稻草人 + 草丛', desc: '稻草人守着的地里结出了南瓜。' },
    { id: 'nanguadeng', name: '南瓜灯', icon: 'pumpkin', hint: '夜晚 · 南瓜', desc: '天黑了，南瓜的笑脸亮了起来。' },
    { id: 'ciwei', name: '刺猬', icon: 'hedgehog', unlock: 'hedgehog', hint: '秋天 · 蘑菇 + 大树', desc: '闻到蘑菇的香味，一只刺猬钻了出来。' },
    { id: 'woniu', name: '蜗牛', icon: 'snail', unlock: 'snail', hint: '雨云 + 花丛', desc: '下雨了，花丛里爬出一只蜗牛。' },
  ];
  const DMAP = Object.fromEntries(DISC.map(d => [d.id, d]));

  function discover(id, at) {
    const d = DMAP[id];
    if (at) sparkle(at[0], at[1], 16);
    if (PB.save.disc[id]) return false;
    PB.save.disc[id] = Date.now();
    if (d.unlock && !PB.save.unlocked[d.unlock]) { PB.save.unlocked[d.unlock] = 1; PB.save.fresh[d.unlock] = 1; }
    PB.sfx('chime', 0.15);
    PB.onDiscover && PB.onDiscover(d);
    return true;
  }

  // ---------- 反应规则 ----------
  // 每条 scan 找到匹配就立刻打上标记（防重复），效果延时发生，看起来像是"雨下了一会儿"
  const REACT = [
    // 春雨：雨云 + 树苗 → 大树
    () => {
      if (scene.season === 'winter') return;
      for (const c of all('raincloud')) for (const s of all('sapling')) {
        if (!idle(s) || !idle(c) || !above(c, s)) continue;
        s.busy = 1;
        later(1.1, () => { s.busy = 0; if (!scene.items.includes(s) || s.id !== 'sapling') return; transform(s, 'tree'); discover('chunyu', top(s)); PB.changed('react'); });
      }
    },
    // 蛙鸣：雨云 + 池塘 → 青蛙
    () => {
      if (scene.season === 'winter') return;
      for (const c of all('raincloud')) for (const p of all('pond')) {
        if (p.flags.frog || !idle(c) || !idle(p) || !above(c, p)) continue;
        p.flags.frog = 1;
        later(1.0, () => {
          if (!scene.items.includes(p)) return;
          const k = kOf(p), side = Math.random() < 0.5 ? -1 : 1;
          const f = spawn('frog', p.x + side * 92 * k, p.y + 26 * k, { from: [p.x + side * 30 * k, p.y], arc: 60 * k, flip: side < 0 });
          PB.sfx('croak', 0.3);
          discover('wa', [f.x, f.y - 20]);
        });
      }
    },
    // 荷塘：夏天 青蛙在池塘边 → 荷花
    () => {
      if (scene.season !== 'summer') return;
      for (const f of all('frog')) {
        if (!idle(f)) continue;
        const p = pondAt(f.x, f.y, 1.7);
        if (!p || p.flags.lotus || !idle(p)) continue;
        p.flags.lotus = 1;
        later(0.9, () => {
          if (!scene.items.includes(p)) return;
          const k = kOf(p);
          const l = spawn('lotus', p.x - 38 * k, p.y + 4 * k);
          discover('hetang', [l.x, l.y - 20]);
        });
      }
    },
    // 彩虹：雨云 + 太阳
    () => {
      if (scene.time === 'night') return;
      for (const c of all('raincloud')) for (const s of all('sun')) {
        if (c.flags.rainbow || !idle(c) || !idle(s) || Math.hypot(c.x - s.x, c.y - s.y) > 330) continue;
        c.flags.rainbow = 1;
        later(1.0, () => {
          if (!scene.items.includes(c)) return;
          const x = (c.x + s.x) / 2, y = Math.max(c.y, s.y) + 40;
          const r = spawn('rainbow', x, y);
          discover('caihong', [r.x, r.y - 40]);
        });
      }
    },
    // 蝶舞：春天白天的花丛
    () => {
      if (scene.season !== 'spring' || scene.time !== 'day') return;
      let n = all('butterfly').length;
      for (const f of all('flowers')) {
        if (n >= 4) return;
        if (f.flags.bf || !idle(f)) continue;
        f.flags.bf = 1; n++;
        later(1.3, () => {
          if (!scene.items.includes(f)) return;
          const k = kOf(f);
          const b = spawn('butterfly', f.x + 20 * k, f.y - 95 * k, { from: [f.x, f.y - 20 * k], arc: 30 });
          discover('diewu', [b.x, b.y]);
        });
      }
    },
    // 筑巢：春夏 小鸟 + 大树
    () => {
      if (scene.season !== 'spring' && scene.season !== 'summer') return;
      for (const b of all('bird')) for (const t of all('tree')) {
        if (t.state.nest || t.nesting || !idle(b) || !idle(t)) continue;
        const k = kOf(t);
        if (Math.abs(b.x - t.x) > 80 * k || Math.abs(b.y - t.y) > 55 * k) continue;
        t.nesting = 1; b.busy = 1;
        later(0.5, () => {
          if (!scene.items.includes(b) || !scene.items.includes(t)) { t.nesting = 0; b.busy = 0; return; }
          PB.sfx('chirp');
          const nx = t.x + 24 * k * (t.flip ? -1 : 1), ny = t.y - 92 * k;
          b.flip = nx < b.x;
          flyTo(b, b.x, b.y, nx, ny, 0.8, 50, () => {
            removeNow(b); t.state = Object.assign({}, t.state, { nest: true }); t.nesting = 0;
            t.pop = { type: 'stick', t0: now() };
            discover('zhuchao', [nx, ny]);
          });
        });
      }
    },
    // 惊鸟：猫 + 小鸟 → 飞鸟
    () => {
      for (const c of all('cat')) for (const b of all('bird')) {
        if (!idle(b) || !idle(c) || !near(c, b, 115)) continue;
        b.busy = 1;
        later(0.35, () => {
          if (!scene.items.includes(b)) return;
          const k = kOf(b), dir = b.x >= c.x ? 1 : -1;
          const x0 = b.x, y0 = b.y - 16 * k;
          b.id = 'birdfly'; b.s = Math.max(0.7, k); b.flip = dir < 0; b.busy = 0;
          b.x = x0; b.y = y0;
          const [x1, y1] = constrain('birdfly', x0 + dir * 130, Math.max(PB.OPEN.y0 + 70, y0 - 260));
          PB.sfx('chirp');
          flyTo(b, x0, y0, x1, y1, 0.9, 0);
          discover('jingniao', [x0, y0]);
        });
      }
    },
    // 稻草人吓跑小鸟
    () => {
      for (const c of all('scarecrow')) for (const b of all('bird')) {
        if (!idle(b) || !idle(c) || !near(c, b, 125)) continue;
        b.busy = 1;
        later(0.35, () => {
          if (!scene.items.includes(b)) return;
          const k = kOf(b), dir = b.x >= c.x ? 1 : -1;
          const x0 = b.x, y0 = b.y - 16 * k;
          b.id = 'birdfly'; b.s = Math.max(0.7, k); b.flip = dir < 0; b.busy = 0;
          b.x = x0; b.y = y0;
          const [x1, y1] = constrain('birdfly', x0 + dir * 140, Math.max(PB.OPEN.y0 + 70, y0 - 260));
          PB.sfx('chirp');
          flyTo(b, x0, y0, x1, y1, 0.9, 0);
          discover('daocaoren', [x0, y0]);
        });
      }
    },
    // 秋收：秋天 稻草人旁边有草丛 → 南瓜
    () => {
      if (scene.season !== 'autumn') return;
      for (const c of all('scarecrow')) {
        if (c.flags.harvest || !idle(c)) continue;
        const g = [...all('grass'), ...all('flowers')].find(x => idle(x) && near(c, x, 170));
        if (!g) continue;
        c.flags.harvest = 1;
        later(1.1, () => {
          if (!scene.items.includes(c)) return;
          const k = kOf(c), side = g.x < c.x ? 1 : -1;
          const pk = spawn('pumpkin', c.x + side * 60 * k, c.y + 12 * k);
          discover('qiushou', [pk.x, pk.y - 20]);
        });
      }
    },
    // 刺猬：秋天 蘑菇在大树旁边
    () => {
      if (scene.season !== 'autumn') return;
      for (const m of all('mushroom')) {
        if (m.flags.hog || !idle(m)) continue;
        if (!all('tree').some(t => near(m, t, 140))) continue;
        m.flags.hog = 1;
        later(1.6, () => {
          if (!scene.items.includes(m)) return;
          const k = kOf(m), side = Math.random() < 0.5 ? -1 : 1;
          const h = spawn('hedgehog', m.x + side * 55 * k, m.y + 18 * k, { from: [m.x + side * 140 * k, m.y + 30 * k], arc: 0, dur: 0.9, flip: side > 0 });
          discover('ciwei', [h.x, h.y - 20]);
        });
      }
    },
    // 蜗牛：雨云 + 花丛（不是冬天）
    () => {
      if (scene.season === 'winter') return;
      for (const c of all('raincloud')) for (const f of all('flowers')) {
        if (f.flags.snail || !idle(c) || !idle(f) || !above(c, f)) continue;
        f.flags.snail = 1;
        later(1.2, () => {
          if (!scene.items.includes(f)) return;
          const k = kOf(f);
          const sn = spawn('snail', f.x + 45 * k, f.y + 10 * k);
          discover('woniu', [sn.x, sn.y - 16]);
        });
      }
    },
    // 午睡：猫 + 长椅
    () => {
      for (const c of all('cat')) for (const b of all('bench')) {
        if (b.state.cat || !idle(c) || !idle(b)) continue;
        const k = kOf(b);
        if (Math.abs(c.x - b.x) > 75 * k || Math.abs(c.y - b.y) > 45 * k) continue;
        c.busy = 1;
        later(0.4, () => {
          if (!scene.items.includes(c) || !scene.items.includes(b)) { c.busy = 0; return; }
          PB.sfx('meow');
          flyTo(c, c.x, c.y, b.x, b.y - 22 * k, 0.5, 40, () => {
            removeNow(c); b.state = Object.assign({}, b.state, { cat: true }); b.pop = { type: 'stick', t0: now() };
            discover('wushui', [b.x, b.y - 50 * k]);
          });
        });
      }
    },
    // 雨后蘑菇：秋天 雨云 + 大树
    () => {
      if (scene.season !== 'autumn') return;
      for (const c of all('raincloud')) for (const t of all('tree')) {
        if (t.flags.mush || !idle(c) || !idle(t) || !above(c, t)) continue;
        t.flags.mush = 1;
        later(1.2, () => {
          if (!scene.items.includes(t)) return;
          const k = kOf(t), side = Math.random() < 0.5 ? -1 : 1;
          const m = spawn('mushroom', t.x + side * 52 * k, t.y + 10 * k);
          discover('mogu', [m.x, m.y - 20]);
        });
      }
    },
    // 堆雪人：冬天 雪云 + 石头
    () => {
      if (scene.season !== 'winter') return;
      for (const c of all('raincloud')) for (const r of all('rock')) {
        if (!idle(r) || !idle(c) || !above(c, r)) continue;
        r.busy = 1;
        later(1.5, () => { r.busy = 0; if (!scene.items.includes(r) || r.id !== 'rock') return; transform(r, 'snowman'); discover('xueren', top(r)); PB.changed('react'); });
      }
    },
    // 一家子：春天 两只鸭子凑一起
    () => {
      if (scene.season !== 'spring') return;
      const ds = all('duck');
      for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
        const a = ds[i], b = ds[j];
        if (a.flags.kids || b.flags.kids || !idle(a) || !idle(b) || !near(a, b, 130)) continue;
        a.flags.kids = b.flags.kids = 1;
        later(1.0, () => {
          if (!scene.items.includes(a)) return;
          const k = kOf(a), dir = a.flip ? 1 : -1;
          const d = spawn('ducklings', a.x + dir * 75 * k, a.y + 14 * k, { flip: a.flip });
          PB.sfx('chirp', 0.2);
          discover('xiaoya', [d.x, d.y - 20]);
        });
      }
    },
  ];

  // ---------- 状态型发现（条件满足就算） ----------
  const firstOf = id => { const a = all(id); return a.length ? a[0] : null; };
  const at = st => st ? top(st) : null;
  const AMBIENT = [
    ['xishui', () => scene.season !== 'winter' && all('duck').find(d => idle(d) && pondAt(d.x, d.y))],
    ['huabing', () => scene.season === 'winter' && all('duck').find(d => idle(d) && pondAt(d.x, d.y))],
    ['yeguang', () => scene.time === 'night' && firstOf('mushroom')],
    ['luoying', () => scene.season === 'spring' && firstOf('tree')],
    ['qiuye', () => scene.season === 'autumn' && firstOf('tree')],
    ['yinghuo', () => scene.season === 'summer' && scene.time === 'night' && firstOf('grass')],
    ['xuetu', () => scene.season === 'winter' && firstOf('rabbit')],
    ['chuiyan', () => (scene.season === 'autumn' || scene.season === 'winter' || scene.time === 'dusk') && firstOf('house')],
    ['denghuo', () => scene.time === 'night' && firstOf('house')],
    ['tideng', () => scene.time === 'night' && firstOf('lantern')],
    ['liuxing', () => scene.time === 'night' && firstOf('bench') && firstOf('moon')],
    ['xiaoqiao', () => bridgeOverPond()],
    ['fanzhou', () => scene.season !== 'winter' && all('boat').find(b => idle(b) && pondAt(b.x, b.y))],
    ['yangjuan', () => all('sheep').find(s => idle(s) && all('fence').some(f => near(s, f, 130)))],
    ['yangmao', () => scene.season === 'winter' && firstOf('sheep')],
    ['qifeng', () => all('windmill').find(w => idle(w) && PB.windy(w))],
    ['nanguadeng', () => scene.time === 'night' && firstOf('pumpkin')],
  ];
  PB.meteorOn = () => scene.time === 'night' && all('bench').length > 0 && all('moon').length > 0;

  function bridgeOverPond() {
    for (const b of all('bridge')) for (const p of all('pond')) {
      const k = kOf(p);
      if (Math.abs(b.x - p.x) < 75 * k && Math.abs(b.y - p.y) < 42 * k) return b;
    }
    return null;
  }

  function evaluate() {
    for (const r of REACT) r();
    for (const [id, test] of AMBIENT) {
      if (PB.save.disc[id]) continue;
      const hit = test();
      if (hit) discover(id, hit === true ? null : at(hit));
    }
  }

  // ---------- 委托 ----------
  const cnt = id => all(id).length;
  const swimmers = () => all('duck').filter(d => pondAt(d.x, d.y)).length + all('ducklings').filter(d => pondAt(d.x, d.y)).length;
  const plants = () => live().filter(s => DEFS[s.id].plant).length;
  const animalKinds = () => new Set(live().filter(s => DEFS[s.id].animal).map(s => s.id === 'birdfly' ? 'bird' : s.id === 'ducklings' ? 'duck' : s.id)).size
    + (all('bench').some(b => b.state.cat) && !all('cat').length ? 1 : 0)
    + (all('tree').some(t => t.state.nest) && !all('bird').length && !all('birdfly').length ? 1 : 0);
  const animals = () => live().filter(s => DEFS[s.id].animal).length + all('bench').filter(b => b.state.cat).length + all('tree').filter(t => t.state.nest).length;
  const SEASON = { spring: '春天', summer: '夏天', autumn: '秋天', winter: '冬天' };
  const TIME = { day: '白天', dusk: '黄昏', night: '夜晚' };
  const isS = s => ({ t: SEASON[s], f: () => scene.season === s });
  const isT = s => ({ t: TIME[s], f: () => scene.time === s });
  const has = (id, n = 1, label) => ({ t: label || PB.DEFS[id].name, n, f: () => cnt(id) });

  const JOBS = [
    {
      id: 'duckhome', title: '鸭子的家', client: 'duck', text: '想要一个能游泳的池塘，旁边再种点花草。',
      req: [has('pond', 1), { t: '鸭子在水里游', h: '把鸭子拖到池塘水面上', f: () => swimmers() > 0 }],
      bonus: [{ t: '池塘上架一座小桥', h: '小木桥在「小物」里', f: () => !!bridgeOverPond() }, { t: '植物', n: 4, h: '树、花、草都算', f: plants }],
    },
    {
      id: 'spring', title: '春天来信', client: 'bird', text: '春天到了，想看看开花的树。',
      req: [isS('spring'), has('tree', 1), has('flowers', 2)],
      bonus: [{ t: '有蝴蝶', h: '春天白天，花丛会引来蝴蝶', f: () => cnt('butterfly') > 0 }, { t: '树上有鸟窝', h: '把小鸟放到树下', f: () => all('tree').some(t => t.state.nest) }],
    },
    {
      id: 'autumn', title: '秋天的小屋', client: 'rabbit', text: '秋天了，想要一间被树围着的小屋。',
      req: [isS('autumn'), has('house', 1), has('tree', 2)],
      bonus: [has('mushroom', 1), has('fence', 2)],
    },
    {
      id: 'afterrain', title: '雨过天晴', client: 'frog', text: '下过雨的池塘最舒服了。',
      req: [{ t: '彩虹', h: '雨云挨着太阳', f: () => cnt('rainbow') > 0 }, has('pond', 1), { t: '青蛙', h: '让雨落进池塘', f: () => cnt('frog') > 0 }],
      bonus: [has('lotus', 1), { t: '鸭子在水里游', f: () => swimmers() > 0 }],
    },
    {
      id: 'summernight', title: '夏夜', client: 'cat', text: '夏天的晚上，想找个凉快的地方打个盹。',
      req: [isS('summer'), isT('night'), has('bench', 1)],
      bonus: [{ t: '猫在长椅上睡觉', h: '把猫放到长椅旁边', f: () => all('bench').some(b => b.state.cat) }, { t: '有萤火虫', h: '夏夜的草丛里会有', f: () => cnt('firefly') > 0 || cnt('grass') > 0 }],
    },
    {
      id: 'snownight', title: '雪夜', client: 'snowman', text: '下雪的晚上，窗子要亮着。',
      req: [isS('winter'), isT('night'), has('house', 1), { t: '雪人', h: '冬天让雪云下在石头上', f: () => cnt('snowman') > 0 }],
      bonus: [has('lantern', 2), has('pine', 3)],
    },
    {
      id: 'wish', title: '许个愿', client: 'star', text: '想坐在长椅上，看着月亮许个愿。',
      req: [isT('night'), has('moon', 1), has('bench', 1)],
      bonus: [{ t: '星星', n: 3, h: '先在夜里看一次流星', f: () => cnt('star') }, has('rabbit', 1)],
    },
    {
      id: 'farm', title: '热闹农场', client: 'rabbit', text: '把大家都叫来吧，越热闹越好！',
      req: [{ t: '动物种类', n: 4, f: animalKinds }],
      bonus: [has('fence', 3), { t: '动物总数', n: 8, f: animals }],
    },
    {
      id: 'village', title: '水边小镇', client: 'boat', text: '想住在有池塘和小桥的小镇上。',
      req: [has('house', 3), has('pond', 1), has('bridge', 1)],
      bonus: [{ t: '小船在水上', h: '架好小桥就能解锁小船', f: () => all('boat').some(b => pondAt(b.x, b.y)) }, { t: '天黑后亮着两盏路灯', f: () => scene.time !== 'day' && cnt('lantern') >= 2 }],
    },
    {
      id: 'harvest', title: '秋收', client: 'scarecrow', text: '秋天到了，想看看地里结满南瓜。',
      req: [isS('autumn'), has('scarecrow', 1), { t: '南瓜', n: 2, h: '秋天把稻草人放在草丛旁边', f: () => cnt('pumpkin') }],
      bonus: [{ t: '刺猬', h: '秋天让雨下在大树上，等蘑菇长出来', f: () => cnt('hedgehog') > 0 }, has('windmill', 1)],
    },
    {
      id: 'ranch', title: '牧场', client: 'sheep', text: '想要一片围起来的草地，羊多一点。',
      req: [has('sheep', 3), has('fence', 3)],
      bonus: [{ t: '风车转得飞快', h: '把白云挂到风车附近', f: () => all('windmill').some(w => PB.windy(w)) }, has('house', 1)],
    },
    {
      id: 'rainy', title: '雨天', client: 'snail', text: '最喜欢下雨天了，大家都出来玩。',
      req: [has('raincloud', 1), { t: '蜗牛', h: '让雨下在花丛上', f: () => cnt('snail') > 0 }, { t: '青蛙', h: '让雨落进池塘', f: () => cnt('frog') > 0 }],
      bonus: [{ t: '彩虹', h: '雨云挨着太阳', f: () => cnt('rainbow') > 0 }, { t: '鸭子在水里游', f: () => swimmers() > 0 }],
    },
  ];
  const JMAP = Object.fromEntries(JOBS.map(j => [j.id, j]));

  function condState(c) {
    const v = c.f();
    if (c.n) return { ok: v >= c.n, text: `${c.t} ${Math.min(v, c.n)}/${c.n}`, h: c.h };
    return { ok: !!v, text: c.t, h: c.h };
  }
  function jobState(job) {
    const req = job.req.map(condState), bonus = job.bonus.map(condState);
    const ready = req.every(r => r.ok);
    const stars = ready ? 1 + bonus.filter(b => b.ok).length : 0;
    return { req, bonus, ready, stars };
  }

  Object.assign(PB, { DISC, DMAP, JOBS, JMAP, evaluate, runJobs, later, discover, jobState, clearJobs: () => { jobs.length = 0; } });
})();
