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

  // ---------- 纸偶移动 ----------
  // 所有反应里的移动都走这里：一格一格跳着走、带小抖动（见 world.js 的 twPose）。
  // o: dur | speed、arc（拱起的高度）、stride（每跳多远）、hopH、fps、ease、jitter、
  //    walk（地上走：大小随前后变、脚下有影子）、face（按方向翻面）、lockK（大小不变，飞的用）、
  //    clip（上场时的遮挡）、string（露吊线）、noRod、cancel（被打断时调）
  function move(st, x1, y1, o = {}, done) {
    if (st.tw) { const p = PB.posOf(st); st.x = p.x; st.y = p.y; }
    const d = Math.hypot(x1 - st.x, y1 - st.y);
    const dur = o.dur || clamp(d / (o.speed || 200), 0.35, 5);
    const T = {
      x0: st.x, y0: st.y, x1, y1, t0: now(), dur, arc: o.arc || 0, puppet: true, fps: o.fps, ease: o.ease,
      jitter: o.jitter, hops: o.stride ? Math.max(1, Math.round(d / o.stride)) : 0, hopH: o.hopH, walk: !!o.walk,
      sk: o.sk, seed: Math.random() * 1000, clip: o.clip, string: !!o.string, noRod: !!o.noRod,
    };
    // 纸片动作关掉时退回平滑移动
    if (!PB.opt.paper) { T.puppet = false; T.walk = false; T.arc = o.arc || 0; }
    if (o.face && Math.abs(x1 - st.x) > 3) st.flip = x1 < st.x;
    st.kLock = o.lockK || !PB.opt.paper ? kOf(st) : null;
    st.tw = T;
    later(dur + 1 / (T.fps || 10), () => {
      if (st.tw !== T) { if (o.cancel) o.cancel(); return; }       // 半路被拎走了
      st.x = x1; st.y = y1; st.tw = null; st.kLock = null;
      if (done) done();
      PB.changed('react');
    });
    return T;
  }
  function transform(st, id) {
    st.id = id; st.state = {}; st.pop = { type: 'grow', t0: now() };
    PB.sfx('grow');
  }
  function removeNow(st) { const i = scene.items.indexOf(st); if (i >= 0) scene.items.splice(i, 1); }
  const top = st => { const b = PB.boxOf(st); return [b.x + b.w / 2, b.y + b.h * 0.35]; };

  // ---------- 上场 ----------
  // how: 'wing' 从侧幕走出来（地上的从侧墙后面，空中的从盒口两边）| 'trap' 从地板或水面下面升上来 |
  //      'fly' 从上面吊下来。关掉"舞台出场"时退回原来的弹出。
  // 返回 { st, done }：st 立刻在场上；done 在站定后 resolve(st)，被拎走则 resolve(CUT)
  const CUT = { cut: true };
  const MID_X = (PB.OPEN.x0 + PB.OPEN.x1) / 2;
  function enterRaw(id, x, y, how, o = {}) {
    [x, y] = constrain(id, x, y);
    const st = mkItem(id, x, y, { flip: o.flip });
    scene.items.push(st);
    if (!PB.opt.entrance) {
      st.pop = { type: 'spawn', t0: now() };
      PB.sfx('pop');
      return { st, done: new Promise(res => later(0.5, () => res(st))) };
    }
    const z = DEFS[id].zone, k = kOf(st), bb = PB.boxOf(st);
    let x0 = x, y0 = y, mo;
    if (how === 'trap') {
      const line = o.lineY !== undefined ? o.lineY : (z === 'flat' ? bb.y + bb.h - 6 * k : y + 3 * k);
      y0 = y + bb.h;
      mo = { dur: o.dur || 0.8, lockK: true, sk: y, clip: { y1: line }, jitter: 0.6, fps: 10 };
      PB.sfx('peel');
    } else if (how === 'fly') {
      const ceil = z === 'celestial' ? PB.BACK.y0 : PB.OPEN.y0;
      y0 = y - (bb.y + bb.h - ceil) - 12;
      mo = { dur: o.dur || 1.1, lockK: true, sk: y, ease: 'in-out', string: true, jitter: 0.7, fps: 10 };
      PB.sfx('whoosh');
    } else {
      const side = o.side || (x < MID_X ? -1 : 1);
      if (z === 'ground' || z === 'flat') {
        const [wa, wb] = PB.floorX(y), wall = side < 0 ? wa : wb;
        x0 = wall + side * (bb.w / 2 + 14);
        mo = { speed: o.speed || 170, stride: 28, hopH: 4 * k, walk: true, face: true, clip: side < 0 ? { x0: wall } : { x1: wall } };
      } else {
        x0 = side < 0 ? PB.OPEN.x0 - bb.w / 2 - 10 : PB.OPEN.x1 + bb.w / 2 + 10;
        mo = { speed: o.speed || 260, arc: o.arc === undefined ? 24 : o.arc, lockK: true, face: true, jitter: 1.2 };
      }
    }
    st.x = x0; st.y = y0;
    const done = new Promise(res => move(st, x, y, Object.assign(mo, o.move || {}, { cancel: () => res(CUT) }), () => res(st)));
    return { st, done };
  }
  // 变身：像翻卡片——转到侧面时换成新的一面
  function swapRaw(st, id) {
    if (!PB.opt.entrance) { transform(st, id); return new Promise(res => later(0.6, () => res(st))); }
    PB.sfx('peel');
    st.card = { t0: now(), dur: 0.7 };
    return new Promise(res => later(0.35, () => {
      st.id = id; st.state = {}; PB.sfx('stick');
      later(0.4, () => res(st));
    }));
  }

  // ---------- 小剧本 ----------
  // 一出戏 = 一个 async 函数，按顺序 await 几个动作：
  //   s.wait(秒) / s.move(演员, x, y, 选项) / s.walk(演员, x, y) / s.enter(id, x, y, 'wing'|'trap'|'fly', 选项)
  //   s.swap(演员, 新id) / s.all([...]) 同时进行 / s.release(演员) 让它下场 / s.sfx(声音)
  // 演员被拎走、被撕掉，或者撤销 / 清空，整出戏就停下（后面的步骤不再执行）。
  // 演戏期间演员是"忙"的，不会再触发别的反应；opts.spot=false 时不打追光。
  class Cut extends Error {}
  let gen = 0;
  const shows = new Set();
  function skit(actors, fn, opts = {}) {
    const g = gen, S = { actors: actors.slice(), spot: opts.spot !== false };
    const ok = st => scene.items.includes(st) && !st.dying && st !== PB.dragItem;
    const check = () => {
      if (g !== gen) throw new Cut();
      for (const a of S.actors) if (!ok(a)) throw new Cut();
    };
    const wrap = pr => {
      const q = pr.then(r => { if (r === CUT) throw new Cut(); check(); return r; });
      q.catch(() => {});             // 没被 await 的分支被打断时不报错
      return q;
    };
    const s = {
      wait: sec => wrap(new Promise(res => later(sec, () => res(true)))),
      move(st, x, y, o = {}) {
        let T;
        const q = wrap(new Promise(res => { T = move(st, x, y, Object.assign({}, o, { cancel: () => res(CUT) }), () => res(st)); }));
        q.dur = T.dur;
        return q;
      },
      walk: (st, x, y, o = {}) => s.move(st, x, y, Object.assign({ speed: 170, stride: 28, hopH: 4 * kOf(st), walk: true, face: true }, o)),
      enter(id, x, y, how, o) {
        const r = enterRaw(id, x, y, how, o);
        S.actors.push(r.st); r.st.busy = 1;
        return wrap(r.done);
      },
      swap: (st, id) => wrap(swapRaw(st, id)),
      all: ps => Promise.allSettled(ps).then(rs => { if (rs.some(r => r.status === 'rejected')) throw new Cut(); check(); }),
      release(st) { S.actors = S.actors.filter(a => a !== st); st.busy = 0; },
      sfx: (n, d) => PB.sfx(n, d),
    };
    shows.add(S);
    for (const a of S.actors) a.busy = 1;
    (async () => {
      try { await fn(s); } catch (e) { if (!(e instanceof Cut)) console.error(e); }
      finally {
        shows.delete(S);
        for (const a of S.actors) a.busy = 0;
        if (g === gen) PB.changed('react');
      }
    })();
    return S;
  }
  // 追光打在谁身上：正在演的戏里、此刻在动的演员（没人动就照全体演员）
  PB.spotActors = () => {
    const out = [];
    for (const S of shows) {
      if (!S.spot) continue;
      const here = S.actors.filter(a => scene.items.includes(a) && !a.dying);
      const moving = here.filter(a => a.tw);
      out.push(...(moving.length ? moving : here));
    }
    return out;
  };

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
    { id: 'zhuizhu', name: '猫捉老鼠', icon: 'mouse', hint: '猫 + 老鼠', desc: '把猫和老鼠贴在一起，它们就在盒子里追起来了。' },
    { id: 'riluo', name: '日落', icon: 'sun', hint: '白天 · 太阳 + 月亮', desc: '月亮一上来，太阳就沿着弧线落到山后面，天黑了。' },
    { id: 'richu', name: '日出', icon: 'moon', hint: '夜晚 · 月亮 + 太阳', desc: '太阳一上来，月亮就下山了，天亮了。' },
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
  // 每条规则只负责"什么时候开演"：找到匹配就立刻开一出小剧本（演员马上变忙，不会重复触发）。
  // "刚贴上"：有些戏只认玩家刚贴上去的那一下（读档时不会自己演）
  function justPlaced(ids) {
    const lp = PB.lastPlaced;
    if (!lp || now() - lp.t > 2 || !ids.includes(lp.st.id) || !idle(lp.st)) return null;
    return lp.st;
  }
  const REACT = [
    // 春雨：雨云 + 树苗 → 翻成大树
    () => {
      if (scene.season === 'winter') return;
      for (const c of all('raincloud')) for (const sp of all('sapling')) {
        if (!idle(sp) || !idle(c) || !above(c, sp)) continue;
        skit([sp], async s => {
          await s.wait(1.1);
          if (sp.id !== 'sapling') return;
          await s.swap(sp, 'tree');
          discover('chunyu', top(sp));
        });
      }
    },
    // 蛙鸣：雨云 + 池塘 → 青蛙从水里冒出来，跳上岸
    () => {
      if (scene.season === 'winter') return;
      for (const c of all('raincloud')) for (const p of all('pond')) {
        if (p.flags.frog || !idle(c) || !idle(p) || !above(c, p)) continue;
        p.flags.frog = 1;
        skit([p], async s => {
          await s.wait(1.0);
          const k = kOf(p), side = Math.random() < 0.5 ? -1 : 1;
          const f = await s.enter('frog', p.x + side * 36 * k, p.y + 2 * k, 'trap', { lineY: p.y + 5 * k, flip: side < 0, dur: 0.6 });
          s.sfx('croak');
          await s.move(f, p.x + side * 96 * k, p.y + 26 * k, { arc: 45 * k, face: true, dur: 0.6 });
          discover('wa', [f.x, f.y - 20]);
        });
      }
    },
    // 荷塘：夏天 青蛙在池塘边 → 荷花从水面下升上来
    () => {
      if (scene.season !== 'summer') return;
      for (const f of all('frog')) {
        if (!idle(f)) continue;
        const p = pondAt(f.x, f.y, 1.7);
        if (!p || p.flags.lotus || !idle(p)) continue;
        p.flags.lotus = 1;
        skit([f, p], async s => {
          await s.wait(0.9);
          const k = kOf(p);
          const l = await s.enter('lotus', p.x - 38 * k, p.y + 4 * k, 'trap', { dur: 0.9 });
          discover('hetang', [l.x, l.y - 20]);
        });
      }
    },
    // 彩虹：雨云 + 太阳 → 彩虹从上面吊下来
    () => {
      if (scene.time === 'night') return;
      for (const c of all('raincloud')) for (const sun of all('sun')) {
        if (c.flags.rainbow || !idle(c) || !idle(sun) || Math.hypot(c.x - sun.x, c.y - sun.y) > 330) continue;
        c.flags.rainbow = 1;
        skit([c], async s => {
          await s.wait(1.0);
          const r = await s.enter('rainbow', (c.x + sun.x) / 2, Math.max(c.y, sun.y) + 40, 'fly', { dur: 1.4 });
          discover('caihong', [r.x, r.y - 40]);
        }, { spot: false });
      }
    },
    // 蝶舞：春天白天的花丛 → 蝴蝶从侧边飞进来
    () => {
      if (scene.season !== 'spring' || scene.time !== 'day') return;
      let n = all('butterfly').length;
      for (const f of all('flowers')) {
        if (n >= 4) return;
        if (f.flags.bf || !idle(f)) continue;
        f.flags.bf = 1; n++;
        skit([f], async s => {
          await s.wait(1.3);
          const k = kOf(f);
          const b = await s.enter('butterfly', f.x + 20 * k, f.y - 95 * k, 'wing');
          discover('diewu', [b.x, b.y]);
        });
      }
    },
    // 筑巢：春夏 小鸟 + 大树 → 小鸟飞进树冠
    () => {
      if (scene.season !== 'spring' && scene.season !== 'summer') return;
      for (const b of all('bird')) for (const t of all('tree')) {
        if (t.state.nest || !idle(b) || !idle(t)) continue;
        const k = kOf(t);
        if (Math.abs(b.x - t.x) > 80 * k || Math.abs(b.y - t.y) > 55 * k) continue;
        skit([b, t], async s => {
          await s.wait(0.5);
          s.sfx('chirp');
          const nx = t.x + 24 * k * (t.flip ? -1 : 1), ny = t.y - 92 * k;
          await s.move(b, nx, ny, { dur: 0.8, arc: 50, lockK: true, face: true, sk: t.y + 0.5 });
          s.release(b); removeNow(b);
          t.state = Object.assign({}, t.state, { nest: true });
          t.pop = { type: 'stick', t0: now() };
          discover('zhuchao', [nx, ny]);
        });
      }
    },
    // 惊鸟：猫靠近小鸟 → 小鸟飞走（追老鼠的猫路过也算）
    () => {
      for (const c of all('cat')) for (const b of all('bird')) {
        if (!idle(b) || c.dying || c === PB.dragItem) continue;
        const cp = PB.posOf(c);
        if (!near({ x: cp.x, y: cp.y, id: 'cat', s: c.s }, b, 125)) continue;
        skit([b], async s => {
          await s.wait(0.3);
          await flyAway(s, b, b.x >= cp.x ? 1 : -1, () => discover('jingniao', [b.x, b.y - 20]));
        });
      }
    },
    // 稻草人吓跑小鸟
    () => {
      for (const c of all('scarecrow')) for (const b of all('bird')) {
        if (!idle(b) || !idle(c) || !near(c, b, 125)) continue;
        skit([b], async s => {
          await s.wait(0.3);
          await flyAway(s, b, b.x >= c.x ? 1 : -1, () => discover('daocaoren', [b.x, b.y - 20]));
        });
      }
    },
    // 秋收：秋天 稻草人旁边有草丛 → 南瓜从地里冒出来
    () => {
      if (scene.season !== 'autumn') return;
      for (const c of all('scarecrow')) {
        if (c.flags.harvest || !idle(c)) continue;
        const g = [...all('grass'), ...all('flowers')].find(x => idle(x) && near(c, x, 170));
        if (!g) continue;
        c.flags.harvest = 1;
        skit([c], async s => {
          await s.wait(1.1);
          const k = kOf(c), side = g.x < c.x ? 1 : -1;
          const pk = await s.enter('pumpkin', c.x + side * 60 * k, c.y + 12 * k, 'trap', { dur: 1.0 });
          discover('qiushou', [pk.x, pk.y - 20]);
        });
      }
    },
    // 刺猬：秋天 蘑菇在大树旁边 → 刺猬从土里钻出来，走到蘑菇跟前
    () => {
      if (scene.season !== 'autumn') return;
      for (const m of all('mushroom')) {
        if (m.flags.hog || !idle(m)) continue;
        if (!all('tree').some(t => near(m, t, 140))) continue;
        m.flags.hog = 1;
        skit([m], async s => {
          await s.wait(1.6);
          const k = kOf(m), side = Math.random() < 0.5 ? -1 : 1;
          const h = await s.enter('hedgehog', m.x + side * 110 * k, m.y + 22 * k, 'trap', { dur: 0.8 });
          await s.walk(h, m.x + side * 55 * k, m.y + 18 * k, { speed: 90, stride: 18, hopH: 3 * k });
          discover('ciwei', [h.x, h.y - 20]);
        });
      }
    },
    // 蜗牛：雨云 + 花丛 → 蜗牛从花丛底下钻出来，慢慢爬开
    () => {
      if (scene.season === 'winter') return;
      for (const c of all('raincloud')) for (const f of all('flowers')) {
        if (f.flags.snail || !idle(c) || !idle(f) || !above(c, f)) continue;
        f.flags.snail = 1;
        skit([f], async s => {
          await s.wait(1.2);
          const k = kOf(f);
          const sn = await s.enter('snail', f.x + 16 * k, f.y + 6 * k, 'trap', { dur: 1.0 });
          await s.walk(sn, f.x + 52 * k, f.y + 12 * k, { speed: 32, stride: 10, hopH: 1.2 * k });
          discover('woniu', [sn.x, sn.y - 16]);
        });
      }
    },
    // 猫捉老鼠：刚把其中一只贴到另一只旁边 → 追 7 段
    () => {
      const st = justPlaced(['cat', 'mouse']);
      if (!st) return;
      const other = all(st.id === 'cat' ? 'mouse' : 'cat').find(o => idle(o) && near(st, o, 175));
      if (!other) return;
      PB.lastPlaced = null;
      const [c, m] = st.id === 'cat' ? [st, other] : [other, st];
      skit([c, m], async s => {
        await s.wait(0.35);
        s.sfx('squeak'); s.sfx('meow', 0.3);
        discover('zhuizhu', top(m));
        for (let leg = 0; leg < 7; leg++) {
          const [tx, ty] = runTarget(m, PB.posOf(c));
          const run = s.move(m, tx, ty, { speed: 320, stride: 30, hopH: 5 * kOf(m), walk: true, face: true, fps: 12 });
          if (Math.random() < 0.5) s.sfx('squeak', 0.1);
          await s.wait(0.3);
          const cp = PB.posOf(c), dx = tx - cp.x, dy = ty - cp.y, d = Math.hypot(dx, dy) || 1;
          const gap = Math.min(d, 75 * kOf(c));
          const [cx, cy] = constrain('cat', tx - dx / d * gap, ty - dy / d * gap);
          const follow = s.move(c, cx, cy, { dur: run.dur, stride: 44, hopH: 6 * kOf(c), walk: true, face: true, fps: 12 });
          await s.all([run, follow]);
          await s.wait(0.2 + Math.random() * 0.45);
        }
        s.sfx('meow');
      });
    },
    // 日落 / 日出：白天刚把月亮贴上天 → 太阳沿弧线沉到山后，天黑；夜里贴太阳反过来
    () => {
      const st = justPlaced(['moon', 'sun']);
      if (!st) return;
      let body = null, to = null;
      if (st.id === 'moon' && scene.time !== 'night') { body = all('sun').find(idle); to = 'night'; }
      else if (st.id === 'sun' && scene.time !== 'day') { body = all('moon').find(m => idle(m) && m !== st); to = 'day'; }
      if (!body) return;
      PB.lastPlaced = null;
      skit([body], async s => {
        const B = PB.BACK, right = body.x >= (B.x0 + B.x1) / 2;
        const sink = s.move(body, right ? B.x1 - 60 : B.x0 + 60, B.y1 + 90, { dur: 4.2, arc: 55, fps: 8, ease: 'in-out', jitter: 0.8 });
        await s.wait(1.9);
        PB.setTime('dusk', true);
        await sink;
        s.release(body); removeNow(body);
        PB.setTime(to, true);
        discover(to === 'night' ? 'riluo' : 'richu');
      }, { spot: false });
    },
    // 午睡：猫 + 长椅 → 猫跳上长椅睡着
    () => {
      for (const c of all('cat')) for (const b of all('bench')) {
        if (b.state.cat || !idle(c) || !idle(b)) continue;
        const k = kOf(b);
        if (Math.abs(c.x - b.x) > 75 * k || Math.abs(c.y - b.y) > 45 * k) continue;
        skit([c, b], async s => {
          await s.wait(0.4);
          s.sfx('meow');
          await s.move(c, b.x, b.y - 22 * k, { dur: 0.5, arc: 40, lockK: true, face: true, sk: b.y + 0.5 });
          s.release(c); removeNow(c);
          b.state = Object.assign({}, b.state, { cat: true });
          b.pop = { type: 'stick', t0: now() };
          discover('wushui', [b.x, b.y - 50 * k]);
        });
      }
    },
    // 雨后蘑菇：秋天 雨云 + 大树 → 树根下冒出蘑菇
    () => {
      if (scene.season !== 'autumn') return;
      for (const c of all('raincloud')) for (const t of all('tree')) {
        if (t.flags.mush || !idle(c) || !idle(t) || !above(c, t)) continue;
        t.flags.mush = 1;
        skit([t], async s => {
          await s.wait(1.2);
          const k = kOf(t), side = Math.random() < 0.5 ? -1 : 1;
          const m = await s.enter('mushroom', t.x + side * 52 * k, t.y + 10 * k, 'trap', { dur: 0.9 });
          discover('mogu', [m.x, m.y - 20]);
        });
      }
    },
    // 堆雪人：冬天 雪云 + 石头 → 石头翻成雪人
    () => {
      if (scene.season !== 'winter') return;
      for (const c of all('raincloud')) for (const r of all('rock')) {
        if (!idle(r) || !idle(c) || !above(c, r)) continue;
        skit([r], async s => {
          await s.wait(1.5);
          if (r.id !== 'rock') return;
          await s.swap(r, 'snowman');
          discover('xueren', top(r));
        });
      }
    },
    // 一家子：春天 两只鸭子凑一起 → 一串小鸭从侧幕走进来
    () => {
      if (scene.season !== 'spring') return;
      const ds = all('duck');
      for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
        const a = ds[i], b = ds[j];
        if (a.flags.kids || b.flags.kids || !idle(a) || !idle(b) || !near(a, b, 130)) continue;
        a.flags.kids = b.flags.kids = 1;
        skit([a, b], async s => {
          await s.wait(1.0);
          const k = kOf(a), side = a.x < MID_X ? -1 : 1;
          const d = await s.enter('ducklings', a.x + side * 75 * k, a.y + 14 * k, 'wing', { side, speed: 150 });
          s.sfx('chirp');
          discover('xiaoya', [d.x, d.y - 20]);
        });
      }
    },
  ];

  // 小鸟被吓飞：变成飞鸟，一格一格往斜上方逃
  async function flyAway(s, b, dir, onFly) {
    const k = kOf(b), x0 = b.x, y0 = b.y - 16 * k;
    b.id = 'birdfly'; b.s = Math.max(0.7, k);
    b.x = x0; b.y = y0;
    const [x1, y1] = constrain('birdfly', x0 + dir * 170, Math.max(PB.OPEN.y0 + 70, y0 - 280));
    s.sfx('chirp');
    if (onFly) onFly();
    await s.move(b, x1, y1, { dur: 1.3, arc: 50, lockK: true, face: true, jitter: 1.3 });
  }

  // 猫捉老鼠：老鼠下一段往哪跑（尽量远离猫）
  function runTarget(m, c) {
    let best = null;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, d = 170 + Math.random() * 170;
      let [x, y] = constrain('mouse', m.x + Math.cos(a) * d, m.y + Math.sin(a) * d * 0.5);
      const [wa, wb] = PB.floorX(y);
      x = clamp(x, wa + 80, wb - 80);                     // 别跑进两边的幕布后面
      const score = Math.hypot(x - c.x, (y - c.y) * 1.6) - Math.abs(Math.hypot(x - m.x, y - m.y) - 240) * 0.3;
      if (!best || score > best[2]) best = [x, y, score];
    }
    return [best[0], best[1]];
  }

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

  Object.assign(PB, {
    DISC, DMAP, JOBS, JMAP, evaluate, runJobs, later, discover, jobState, move, skit,
    clearJobs: () => { jobs.length = 0; gen++; shows.clear(); },
  });
})();
