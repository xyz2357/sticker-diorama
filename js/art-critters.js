// art-critters.js — 动物与天空贴纸：鸭子、小鸟、兔子、猫、长椅、青蛙、小鸭、蝴蝶、萤火虫、云、雨云、太阳、月亮、彩虹、星星
// 约定见 art-core.js：ground 原点 = 底部中心（接地点），sky 原点 = 视觉中心；动物默认朝右。
(function () {
  'use strict';
  const P = ART.PAL, TAU = ART.TAU, PI = Math.PI;

  // ---------- 小工具 ----------
  // 圆角多边形：填充后再用同色粗线描一遍，把尖角磨圆
  function rpoly(g, pts, c, r = 3) {
    g.poly(pts, c);
    let d = `M${pts[0]} ${pts[1]}`;
    for (let i = 2; i < pts.length; i += 2) d += ` L${pts[i]} ${pts[i + 1]}`;
    g.stroke(d + ' Z', c, r);
  }
  // 水线：顶边是波浪，底边平直，原点 y 就是水面
  function waveBand(g, x0, x1, y, amp = 1.6, wl = 8, th = 5) {
    let d = `M${x0} ${y}`, up = true;
    for (let x = x0; x < x1 - 0.01; x += wl) {
      const e = Math.min(x + wl, x1);
      d += ` Q${(x + e) / 2} ${y + (up ? -amp : amp) * 2} ${e} ${y}`;
      up = !up;
    }
    g.path(`${d} L${x1} ${y + th} Q${(x0 + x1) / 2} ${y + th + 2} ${x0} ${y + th} Z`, P.waterL);
    g.stroke(d, P.water, 2);
  }
  // 只保留 y < yCut 的部分（游水时身体下半截被水面切掉）
  function clipAbove(g, yCut, fn) {
    const k = g.ctx; k.save();
    k.beginPath(); k.rect(-300, -300, 600, 300 + yCut); k.clip();
    fn(); k.restore();
  }
  function starPath(R, r, n = 5, cx = 0, cy = 0) {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = -PI / 2 + i * PI / n, rr = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2) + ' ';
    }
    return d + 'Z';
  }
  // ∩ 形闭眼（笑眯眯）
  const happyEye = (g, x, y, r = 4, w = 2.2) => g.arc(x, y, r, PI * 1.15, PI * 1.85, P.ink, w);
  // ∪ 形闭眼（睡着）
  const sleepEye = (g, x, y, r = 3, w = 1.8) => g.arc(x, y - r * 0.6, r, PI * 0.15, PI * 0.85, P.ink, w);

  // ---------- 鸭子 ----------
  const DUCK = { W: '#fdfcf8', Wd: '#dfe3e8', Wm: '#eceff2', O: P.orange, Od: '#e07f2a' };
  function duckBody(g) {
    const { W, Wd, Wm, O, Od } = DUCK;
    // 尾巴
    g.path('M-14 -30 Q-27 -33 -31 -43 Q-21 -42 -10 -36 Z', Wd);
    g.circle(-29.4, -41.2, 2.6, Wd); // 磨圆尾尖，免得模切边拉出细丝
    g.path('M-14 -31 Q-25 -34 -28.5 -41 Q-20 -40 -11 -36 Z', W);
    // 身体
    g.ellipse(-2, -22, 22, 14, Wd);
    g.ellipse(-4, -24, 20, 12.5, W);
    // 脖子 + 头
    g.ellipse(13, -32, 8, 11, Wd);
    g.ellipse(12, -33, 7.5, 10.5, W);
    g.circle(15, -42, 11, Wd);
    g.circle(14, -43, 10.5, W);
    // 翅膀
    g.path('M-19 -27 Q-6 -35 7 -27 Q-3 -15 -19 -22 Z', Wm);
    g.stroke('M-14 -23 Q-6 -20.5 1 -24', Wd, 1.8);
    // 喙
    g.path('M22 -47 Q34 -47 35.5 -42 Q34 -38.5 22 -38.5 Z', O);
    g.path('M22 -42 L35.5 -42 Q34 -38.5 22 -38.5 Z', Od);
    g.eye(17.5, -46, 2.5);
    g.blush(19, -39.5, 3.4);
  }
  function duckLegs(g) {
    const { O, Od } = DUCK;
    g.rect(-8, -14, 5, 12, 2.5, Od);
    g.rect(3, -14, 5, 12, 2.5, O);
    g.ellipse(-2.5, -2.6, 8, 2.6, Od);
    g.ellipse(8.5, -2.6, 8, 2.6, O);
  }
  ART.add('duck', (g, v) => {
    if (v.variant === 'swim') {
      clipAbove(g, 0.5, () => g.at(0, 14, 0, 1, 1, () => duckBody(g)));
      waveBand(g, -37, 39, 0);
      return;
    }
    if (v.variant === 'skate') {
      // 冰刀
      g.rect(-12, -3, 17, 3, 1.5, '#a7b0ba');
      g.rect(0, -3, 17, 3, 1.5, '#bcc4cc');
      g.at(0, -3, 0, 1, 1, () => {
        duckLegs(g); duckBody(g);
        // 红围巾
        g.path('M8 -32 Q2 -28 -3 -20 L2 -18.5 Q5 -25 11 -29 Z', '#c9483a');
        g.path('M4.5 -37 Q13 -33 21.5 -37.5 L21.5 -31 Q13 -27 4.5 -31 Z', P.red);
        g.line(9, -35.5, 9, -30, '#f6c9bf', 1.8);
        g.line(15, -35.5, 15, -30, '#f6c9bf', 1.8);
      });
      return;
    }
    duckLegs(g); duckBody(g);
  }, [{ season: 'summer' }, { season: 'summer', variant: 'swim' }, { season: 'winter', variant: 'skate' }]);

  // ---------- 小鸟 ----------
  const BIRD = { B: '#6fb5e0', Bd: '#4f97c8', Bl: '#a4d4f0', Be: '#fdf3dc', O: '#f39a3d', L: '#e0893a' };
  ART.add('bird', (g) => g.at(0, 0, 0, 1.15, 1.15, () => {
    const { B, Bd, Bl, Be, O, L } = BIRD;
    // 腿和脚
    g.line(-3.5, -8, -4, -2, L, 2.8); g.line(3.5, -8, 4, -2, L, 2.8);
    g.line(-7.5, -1.6, -1, -1.6, L, 2.6); g.line(1, -1.6, 8, -1.6, L, 2.6);
    // 尾巴
    g.path('M-8 -18 Q-17 -20 -21 -25.5 Q-24.5 -17 -18 -11.5 Q-12 -8 -7 -9.5 Z', Bd);
    // 身体
    g.circle(1.2, -17, 13, Bd);
    g.circle(0, -18, 12, B);
    g.ellipse(4.5, -12, 7.5, 6, Be);
    g.ellipse(-4, -16, 7.5, 5, Bd, 0.35);
    g.ellipse(-5, -25, 3.5, 2, Bl, -0.5);
    // 头顶呆毛
    g.stroke('M-0.5 -28 Q-0.5 -34.5 4.5 -34.5', B, 3.4);
    // 喙
    rpoly(g, [11, -23.5, 19, -20, 11, -16.5], O, 2);
    g.eye(6, -21.5, 2.4);
    g.blush(8, -16, 2.8);
  }), [{ season: 'summer' }]);

  ART.add('birdfly', (g) => g.at(0, 0, 0, 1.12, 1.12, () => {
    const { B, Bd, Bl, Be, O } = BIRD;
    // 后面那只翅膀
    g.path('M-2 -4 Q-14 -22 -29 -24 Q-20 -8 -9 1 Z', Bd);
    // 尾巴
    g.path('M-9 1 Q-22 -1 -27 6 Q-18 9 -7 6 Z', Bd);
    // 身体
    g.ellipse(1.5, 1.5, 13.5, 9.5, Bd);
    g.ellipse(0, 0, 12.5, 9, B);
    g.ellipse(3.5, 4, 8, 4.2, Be);
    // 前面那只翅膀
    g.path('M-6 -1 Q-2 -25 17 -27 Q13 -11 5 1 Z', Bd);
    g.path('M-4 -2 Q-1 -23 15 -25 Q11 -11 4 -1 Z', B);
    g.path('M0 -8 Q3 -19 12 -22 Q9 -14 4 -8 Z', Bl);
    // 喙和脸
    rpoly(g, [11, -5, 19, -2, 11, 1], O, 2);
    g.eye(6.5, -3, 2.3);
    g.blush(8, 1.5, 2.6);
  }), [{ season: 'summer' }]);

  // ---------- 兔子 ----------
  ART.add('rabbit', (g, v) => {
    const w = v.season === 'winter';
    const F = w ? '#f8f6f1' : '#d9b894', Fd = w ? '#d9d6cf' : '#bf9a73';
    const Bl = w ? '#ffffff' : '#f6ead8', In = '#f5b3b8';
    // 后耳
    g.ellipse(-2, -51, 5, 12.5, Fd, -0.32);
    // 尾巴
    g.circle(-18.5, -11, 6.5, Bl);
    // 身体
    g.ellipse(-1, -19, 18, 17, Fd);
    g.ellipse(-3, -21, 16.5, 15.5, F);
    g.ellipse(7, -17, 7.5, 10, Bl);
    // 后腿、前爪
    g.ellipse(-7, -4.2, 11, 4.2, Fd);
    g.ellipse(10, -3.4, 6.5, 3.4, F);
    // 头
    g.circle(9, -37, 13, Fd);
    g.circle(8, -38, 12.5, F);
    // 前耳
    g.ellipse(5, -54, 5.5, 13, F, -0.12);
    g.ellipse(5.3, -53, 2.6, 9, In, -0.12);
    // 脸
    g.eye(13, -40, 2.5);
    g.blush(14.5, -33.5, 3.3);
    g.ellipse(20, -36.5, 1.9, 1.5, '#e98a96');
    g.stroke('M20 -35 Q19 -32.5 17 -33', P.ink, 1.4);
    g.ellipse(2, -44, 3, 1.8, w ? '#ffffff' : '#e9cfb0', -0.5);
  }, [{ season: 'summer' }, { season: 'winter' }]);

  // ---------- 猫 ----------
  const CAT = { C: '#f0a35a', Cd: '#d98840', St: '#c46f2e', Be: '#fbe3c4', In: '#f5b3b8' };
  ART.add('cat', (g) => {
    const { C, Cd, St, Be, In } = CAT;
    // 尾巴：从身后沿地面卷到身前
    g.stroke('M-8 -4 Q-24 -3 -25 -15 Q-25 -24 -17 -25', Cd, 7);
    g.line(-18, -7.4, -18, -1, St, 2); g.line(-28.4, -14, -21.6, -14, St, 2);
    // 身体
    g.path('M-15 0 C-19 -16 -13 -33 0 -33 C12 -33 17 -20 16 0 Z', Cd);
    g.path('M-15 -1 C-18 -16 -13 -31 -1 -31.5 C9 -31.5 13 -20 12 -1 Z', C);
    g.stroke('M-13 -19 Q-9 -21 -7 -17', St, 2.2);
    g.stroke('M-14 -12 Q-10 -14 -8 -10', St, 2.2);
    g.ellipse(7.5, -17, 6, 10, Be);
    // 前腿
    g.rect(9, -16, 7, 16, 3.5, Cd);
    g.rect(2, -17, 7, 17, 3.5, C);
    g.line(4.5, -1.5, 4.5, -4, St, 1.4); g.line(6.5, -1.5, 6.5, -4, St, 1.4);
    // 耳朵
    rpoly(g, [-7, -48, -7, -61, 4, -53], Cd, 3);
    rpoly(g, [9, -53, 18, -61, 18.5, -47], C, 3);
    rpoly(g, [12, -52, 16.5, -57, 16.5, -50], In, 1.5);
    // 头
    g.circle(6, -41, 13.5, Cd);
    g.circle(5, -42, 13, C);
    g.ellipse(11, -36.5, 6.5, 4.5, Be);
    g.line(0, -54, 0, -50, St, 2); g.line(4, -55, 4, -51, St, 2); g.line(8, -54.5, 8, -50.5, St, 2);
    // 脸
    g.eye(4, -43, 2.4); g.eye(14, -43, 2.4);
    rpoly(g, [9.2, -39.5, 12, -39.5, 10.6, -37.8], '#e98a96', 1.2);
    g.stroke('M10.6 -37.5 Q9.5 -35 7.6 -35.8', P.ink, 1.3);
    g.stroke('M10.6 -37.5 Q11.8 -35 13.6 -35.8', P.ink, 1.3);
    g.blush(0.5, -37.5, 3); g.blush(17.5, -37.5, 2.6);
  }, [{ season: 'summer' }]);

  // ---------- 长椅 ----------
  ART.add('bench', (g, v) => {
    const Wd = P.wood, WdD = P.woodD, WdL = P.woodL, Fe = '#6b6460', FeD = '#534d4a';
    // 后腿
    g.rect(-41, -26, 4.5, 24, 2, FeD); g.rect(36.5, -26, 4.5, 24, 2, FeD);
    // 靠背立柱
    g.rect(-45, -58, 5, 34, 2.5, Fe); g.rect(40, -58, 5, 34, 2.5, Fe);
    // 靠背木条
    g.rect(-51, -57, 102, 8, 3.5, WdD);
    g.rect(-51, -58, 102, 6, 3, Wd);
    g.rect(-51, -45, 102, 8, 3.5, WdD);
    g.rect(-51, -46, 102, 6, 3, Wd);
    g.line(-44, -56, 20, -56, WdL, 1.6);
    // 座面
    g.rect(-54, -29, 108, 8, 3.5, WdD);
    g.rect(-53, -32, 106, 5.5, 2.8, WdL);
    g.line(-40, -24.5, 40, -24.5, Wd, 1.6);
    // 前腿 + 扶手卷
    g.rect(-48, -22, 5, 22, 2, Fe); g.rect(43, -22, 5, 22, 2, Fe);
    g.rect(-51, -2.8, 11, 2.8, 1.4, FeD); g.rect(40, -2.8, 11, 2.8, 1.4, FeD);
    g.stroke('M-46 -30 Q-58 -33 -55 -41 Q-52 -45 -48 -41', Fe, 3.4);
    g.stroke('M46 -30 Q58 -33 55 -41 Q52 -45 48 -41', Fe, 3.4);
    if (v.season === 'winter') {
      g.path('M-53 -57 Q-45 -64 -30 -61 Q-15 -65 0 -61 Q18 -65 32 -61 Q46 -64 53 -57 Q52 -54 -52 -54.5 Z', P.snow);
      g.path('M-52 -33 Q-40 -38 -22 -35 Q-6 -37 8 -34.5 Q30 -38 52 -33 L52 -31 L-52 -31 Z', P.snow);
      g.ellipse(-20, -60, 8, 1.4, P.snowD);
    }
    if (v.state && v.state.cat) {
      const { C, Cd, St } = CAT;
      // 尾巴绕到身前
      g.stroke('M-17 -38 Q-21 -31 -8 -31.5 Q4 -32 9 -34', Cd, 5.5);
      // 蜷成一团的身体
      g.ellipse(-2, -40, 17, 10, Cd);
      g.ellipse(-3, -41, 16, 9, C);
      g.stroke('M-12 -48 Q-10 -44 -12 -40', St, 2.2);
      g.stroke('M-5 -49.5 Q-3 -45 -5 -41', St, 2.2);
      g.stroke('M2 -49 Q4 -45 2 -41', St, 2.2);
      // 头
      rpoly(g, [7, -44, 7.5, -53, 13.5, -47], Cd, 2.5);
      rpoly(g, [15, -47.5, 21, -53, 21.5, -43.5], C, 2.5);
      g.circle(14, -39, 8.8, Cd);
      g.circle(13.4, -39.6, 8.3, C);
      sleepEye(g, 11, -40, 2.4, 1.6);
      sleepEye(g, 17.4, -40, 2.4, 1.6);
      g.blush(18.5, -36, 2.4);
      g.emit(22, -60, 'zzz');
    }
  }, [{ season: 'summer' }, { season: 'winter' }, { season: 'summer', state: { cat: true } }]);

  // ---------- 青蛙 ----------
  ART.add('frog', (g) => {
    const G = '#7cc26a', Gd = '#5ea552', Bl = '#d8efb0';
    g.ellipse(-15, -7, 9, 7, Gd);
    g.ellipse(16, -7, 9, 7, Gd);
    g.ellipse(1, -14, 20, 14, Gd);
    g.ellipse(0, -15, 19, 13, G);
    g.ellipse(2.5, -9, 11, 7, Bl);
    g.ellipse(-6, -2.2, 6, 2.6, G);
    g.ellipse(10, -2.2, 6, 2.6, G);
    // 头顶的眼睛包
    g.circle(-6.5, -27, 7.5, Gd); g.circle(-7, -27.5, 7, G);
    g.circle(9.5, -27, 7.5, Gd); g.circle(9, -27.5, 7, G);
    g.circle(-6.5, -28, 4.8, '#fff'); g.circle(9.5, -28, 4.8, '#fff');
    g.eye(-5, -27.5, 2.8); g.eye(11, -27.5, 2.8);
    g.arc(2, -21, 8, PI * 0.15, PI * 0.85, P.ink, 1.8);
    g.blush(-10.5, -16.5, 3.4); g.blush(14, -16.5, 3.4);
    g.circle(-12, -13, 2, Gd); g.circle(-8, -8.5, 1.5, Gd);
  }, [{ season: 'summer' }]);

  // ---------- 小鸭 ----------
  function chick(g, swim) {
    const Y = '#ffd84d', Yd = '#efbb2c', O = P.orange;
    if (!swim) {
      g.rect(-4.5, -7, 3.4, 6, 1.6, O); g.rect(1, -7, 3.4, 6, 1.6, O);
      g.ellipse(-1, -1.6, 4.6, 1.8, '#e07f2a'); g.ellipse(4.2, -1.6, 4.6, 1.8, O);
    }
    g.path('M-8 -12 Q-15 -13.5 -15.5 -19.5 Q-10 -17.5 -6 -15 Z', Yd);
    g.ellipse(0, -11, 11, 8, Yd);
    g.ellipse(-1, -12, 10, 7, Y);
    g.circle(7.2, -19, 7.5, Yd);
    g.circle(6.6, -19.5, 7, Y);
    g.ellipse(-2.5, -11, 5.5, 3.5, Yd, 0.2);
    g.path('M5 -26 Q6 -30.5 9.5 -28.5 Q7 -27.5 7.4 -25.5 Z', Y);
    g.path('M12.5 -21.5 Q19 -21 19 -19 Q18 -17 12.5 -17 Z', O);
    g.eye(9.3, -21, 1.9);
    g.blush(10.3, -16.8, 2.2);
  }
  ART.add('ducklings', (g, v) => {
    const swim = v.variant === 'swim';
    const draw = () => {
      g.at(-31, 0, 0, 0.74, 0.74, () => chick(g, swim));
      g.at(-5, 0, 0, 0.86, 0.86, () => chick(g, swim));
      g.at(25, 0, 0, 1, 1, () => chick(g, swim));
    };
    if (swim) {
      clipAbove(g, 0.5, () => g.at(0, 6, 0, 1, 1, draw));
      waveBand(g, -46, 46, 0, 1.4, 7, 4.5);
    } else draw();
  }, [{ season: 'summer' }, { season: 'summer', variant: 'swim' }]);

  // ---------- 蝴蝶 ----------
  ART.add('butterfly', (g) => g.at(0, 0, 0, 1.15, 1.15, () => {
    const Wo = '#f7a53c', Wod = '#e0842a', Wy = '#ffd84d', dot = '#fff6e0', body = '#5a4636';
    for (const s of [-1, 1]) {
      g.ellipse(8.5 * s, 7.5, 8.5, 7, Wod, 0.5 * s);
      g.ellipse(8 * s, 7, 7.3, 5.8, Wo, 0.5 * s);
      g.circle(8.5 * s, 8.5, 2.4, Wy);
    }
    for (const s of [-1, 1]) {
      g.ellipse(11.5 * s, -5, 12.5, 10, Wod, -0.45 * s);
      g.ellipse(11 * s, -5.6, 11.5, 9, Wo, -0.45 * s);
      g.ellipse(11 * s, -4.5, 6, 4.5, Wy, -0.45 * s);
      g.circle(17.5 * s, -10, 2.3, dot);
      g.circle(19.5 * s, -4, 1.6, dot);
    }
    g.ellipse(0, 1.5, 3, 11, body);
    g.circle(0, -10, 3.6, body);
    g.stroke('M-1.2 -12.5 Q-3.5 -18 -7 -19.5', body, 1.8);
    g.stroke('M1.2 -12.5 Q3.5 -18 7 -19.5', body, 1.8);
    g.circle(-7.5, -19.8, 2.1, body);
    g.circle(7.5, -19.8, 2.1, body);
  }), [{ season: 'spring' }]);

  // ---------- 萤火虫 ----------
  ART.add('firefly', (g) => g.at(0, 0, 0, 1.35, 1.35, () => {
    const body = '#5d6d92', bodyD = '#48567a', glow = '#fff07a', glowL = '#fffbd6';
    // 发光的屁股
    g.circle(-7, 2, 7.5, '#f5d94a');
    g.circle(-7.6, 1.4, 6.6, glow);
    g.circle(-9, 0, 2.8, glowL);
    g.light(-7 * 1.35, 2 * 1.35, 26, '#fff2a0'); // light 不吃 g.at 的缩放，手动换算
    // 身体和头
    g.ellipse(2, 0, 7.5, 6, bodyD);
    g.ellipse(1.5, -0.5, 7, 5.5, body);
    g.circle(9.5, -2, 5.5, bodyD);
    g.circle(9.2, -2.4, 5.2, body);
    // 半透明翅膀
    g.alpha(0.85, () => {
      g.ellipse(-1, -7.5, 7, 4, '#dff0fa', -0.55);
      g.ellipse(3, -8, 6, 3.6, '#eef8fd', -0.25);
    });
    g.stroke('M11 -7 Q12.5 -11 15.5 -11.5', bodyD, 1.7);
    g.circle(15.8, -11.6, 1.7, bodyD);
    g.circle(11, -3, 2.9, '#fff');
    g.eye(11.6, -3, 1.9);
    g.blush(12.3, 0.3, 1.8, 1.2);
  }), [{ season: 'summer' }]);

  // ---------- 云 ----------
  // puffs: [x, y, r]，base: [x, y, rx, ry]
  function puffCloud(g, puffs, base, main, shade, seam) {
    // 阴影层整体下移，露出底部一圈
    for (const [x, y, r] of puffs) g.circle(x + 1.5, y + 5, r, shade);
    g.ellipse(base[0] + 1.5, base[1] + 4, base[2], base[3], shade);
    for (const [x, y, r] of puffs) g.circle(x, y, r, main);
    g.ellipse(base[0], base[1], base[2], base[3], main);
    // 云团之间的接缝
    if (seam) {
      for (let i = 1; i < puffs.length - 1; i++) {
        const [x, y, r] = puffs[i];
        g.arc(x, y, r * 0.78, PI * 0.62, PI * 0.95, seam, 2.2);
      }
    }
  }
  const CLOUD_PUFFS = [[-58, 18, 21], [-30, 2, 27], [6, -5, 32], [40, 6, 26], [62, 19, 18]];
  ART.add('cloud', (g) => {
    puffCloud(g, CLOUD_PUFFS, [0, 20, 72, 15], '#ffffff', '#d3e1ec', '#e3ecf3');
    g.ellipse(-8, -22, 10, 5, '#ffffff');
  }, [{ season: 'summer' }]);

  ART.add('raincloud', (g, v) => {
    const w = v.season === 'winter';
    const main = w ? '#dde2e9' : '#a3afc0', shade = w ? '#b3bdca' : '#7c899e';
    const seam = w ? '#c9d0da' : '#8f9bb0', hi = w ? '#eef1f5' : '#bcc6d3';
    const puffs = [[-60, 6, 20], [-32, -8, 26], [2, -16, 30], [36, -8, 26], [62, 6, 19]];
    puffCloud(g, puffs, [0, 10, 74, 15], main, shade, seam);
    g.ellipse(-8, -31, 9, 4.5, hi, -0.1);
    g.ellipse(-36, -21, 6, 3, hi, -0.3);
    // 底下挂几滴雨 / 几片雪花，让贴纸册里一眼认得出
    if (w) {
      for (const [x, y] of [[-32, 38], [0, 42], [32, 38]]) {
        for (let i = 0; i < 3; i++) {
          const a = i * PI / 3;
          g.line(x - Math.cos(a) * 5, y - Math.sin(a) * 5, x + Math.cos(a) * 5, y + Math.sin(a) * 5, '#9fbad4', 2.2);
        }
      }
    } else {
      for (const [x, y] of [[-32, 37], [0, 41], [32, 37]]) {
        g.path(`M${x} ${y - 7} C${x + 2} ${y - 3} ${x + 4.6} ${y} ${x + 4.6} ${y + 2} A4.6 4.6 0 0 1 ${x - 4.6} ${y + 2} C${x - 4.6} ${y} ${x - 2} ${y - 3} ${x} ${y - 7} Z`, '#6fb3e6');
        g.ellipse(x - 1.6, y + 1.2, 1.2, 1.8, '#bfe3f7');
      }
    }
    g.emit(0, 25, 'rain');
  }, [{ season: 'summer' }, { season: 'winter' }]);

  // ---------- 太阳 ----------
  ART.add('sun', (g) => {
    const Y = '#ffcf4a', Yd = '#f5b53a', R1 = '#ffb24a', R2 = '#ffc55e', Hi = '#ffe38a';
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU - PI / 2;
      g.at(0, 0, a, 1, 1, () => g.ellipse(47, 0, 11, 6.8, i % 2 ? R1 : R2));
    }
    g.circle(0, 0, 37, Yd);
    g.circle(-1.5, -2, 35, Y);
    g.ellipse(-17, -19, 9, 5, Hi, -0.7);
    happyEye(g, -12, -1, 5.5, 2.5);
    happyEye(g, 12, -1, 5.5, 2.5);
    g.arc(0, 4, 8, PI * 0.18, PI * 0.82, P.ink, 2.5);
    g.blush(-21, 8, 5.5, 3.4);
    g.blush(21, 8, 5.5, 3.4);
    g.light(0, 0, 70, '#fff0b0');
  }, [{ season: 'summer' }]);

  // ---------- 月亮 ----------
  ART.add('moon', (g) => {
    const M = '#fbe6a0', Md = '#f0cf72', cap = '#8fb3e3', capD = '#7197cc', fur = '#fffdf5';
    g.at(0, 8, 0, 0.86, 0.86, () => {
      const k = g.ctx;
      // 弯月：先画整圆，再挖掉一个偏右上的圆
      g.circle(0, 0, 38, Md);
      g.circle(-2, -1, 36, M);
      k.save(); k.globalCompositeOperation = 'destination-out';
      g.circle(16, -4, 31, '#000');
      k.restore();
      // 磨圆两个月牙尖
      g.circle(12.8, -35.2, 2.3, M);
      g.circle(27.6, 25.2, 2.3, M);
      g.ellipse(-28, -12, 4, 7, '#fff3c8', 0.3);
      // 睡脸
      sleepEye(g, -23, -3, 3.4, 2.2);
      g.arc(-19, 9, 3.4, PI * 0.1, PI * 0.9, P.ink, 2);
      g.blush(-28, 7, 4, 2.6);
      // 睡帽
      g.path('M-17 -35 Q-10 -60 12 -58 Q26 -56 32 -44 Q20 -49 10 -38 Z', capD);
      g.path('M-15 -36 Q-9 -57 11 -56 Q23 -54 29 -45 Q19 -48 9 -39 Z', cap);
      g.stroke('M-7 -45 Q2 -52 13 -51', '#a9c6ec', 2.4);
      g.at(-4, -37, 0.12, 1, 1, () => g.rect(-15, -4.5, 30, 9, 4.5, fur));
      g.circle(32, -43, 5.5, fur);
    });
    g.light(0, 0, 50, '#fff6d0');
  }, [{ season: 'summer' }]);

  // ---------- 彩虹 ----------
  function smallCloud(g, x, y) {
    const puffs = [[x - 17, y + 4, 12], [x - 3, y - 6, 16], [x + 13, y - 1, 13], [x + 23, y + 6, 9]];
    for (const [px, py, r] of puffs) g.circle(px + 1, py + 3.5, r, '#d3e1ec');
    g.ellipse(x + 2, y + 9, 26, 8, '#d3e1ec');
    for (const [px, py, r] of puffs) g.circle(px, py, r, '#ffffff');
    g.ellipse(x + 1, y + 6, 26, 8, '#ffffff');
  }
  ART.add('rainbow', (g) => {
    const cols = ['#f28b82', '#f9b872', '#fce38a', '#a8dba8', '#8ac6e8', '#b9a3e3'];
    const cy = 60, R0 = 138, bw = 10;
    cols.forEach((c, i) => g.arc(0, cy, R0 - i * bw, PI, TAU, c, bw + 0.8));
    g.arc(0, cy, R0 - 0.5, PI * 1.12, PI * 1.35, 'rgba(255,255,255,0.55)', 2.6);
    smallCloud(g, -(R0 - 2.5 * bw) - 2, cy - 2);
    smallCloud(g, (R0 - 2.5 * bw) - 2, cy - 2);
  }, [{ season: 'summer' }]);

  // ---------- 星星 ----------
  ART.add('star', (g) => {
    const Y = '#ffd84d', Yd = '#f2b62c';
    const d0 = starPath(24, 12.5, 5, 1.5, 4);
    const d1 = starPath(24, 12.5, 5, 0, 2);
    g.path(d0, Yd); g.stroke(d0, Yd, 6);
    g.path(d1, Y); g.stroke(d1, Y, 6);
    g.ellipse(-6, -8, 3.5, 2, '#fff1b0', -0.6);
    g.eye(-5, 2, 2.4); g.eye(5, 2, 2.4);
    g.smile(0, 8, 3);
    g.blush(-9.5, 7, 3, 2); g.blush(9.5, 7, 3, 2);
    g.light(0, 0, 34, '#fff3a8');
  }, [{ season: 'summer' }]);
})();
