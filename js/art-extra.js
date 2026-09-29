// art-extra.js — 第二批贴纸：绵羊、风车（塔身 + 单独的叶片）、稻草人、南瓜、刺猬、蜗牛
// 约定同 art-core.js：ground 原点 = 底部中心（接地点）；动物默认朝右。
(function () {
  'use strict';
  const P = ART.PAL, TAU = ART.TAU;

  // 蓬松的一团：一圈小圆
  function puff(g, cx, cy, rx, ry, n, r, c) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      g.circle(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, r, c);
    }
    g.ellipse(cx, cy, rx, ry, c);
  }

  // ---------- 绵羊 ----------
  ART.add('sheep', (g, v) => {
    const W = '#fbf8f1', Wd = '#e6dfd2', F = '#5b4a42', Fl = '#7a665c';
    // 后腿
    g.rect(-16, -12, 6, 12, 3, F); g.rect(6, -12, 6, 12, 3, F);
    // 羊毛身体：暗层 + 亮层
    puff(g, -1, -24, 20, 12, 10, 8.5, Wd);
    puff(g, -3, -26, 18, 10.5, 10, 7.5, W);
    // 前腿
    g.rect(-10, -11, 6, 11, 3, Fl); g.rect(12, -11, 6, 11, 3, Fl);
    // 头
    g.ellipse(21, -31, 8.5, 10.5, F, 0.25);
    g.ellipse(14, -38, 5, 3, F, -0.5);        // 耳朵
    puff(g, 17, -41, 6, 3, 6, 3.6, W);        // 头顶的一撮毛
    g.eye(23, -33, 2.2);
    g.circle(22.3, -33.8, 0.7, '#fff');
    g.blush(25.5, -27.5, 2.6);
    if (v.season === 'winter') {
      // 红围巾
      g.path('M11 -26 Q19 -20 27 -25 L28 -21 Q19 -15 10 -22 Z', '#e25b4a');
      g.path('M13 -23 L10 -12 L15 -12 L17 -22 Z', '#c84638');
    }
  }, [{ season: 'summer' }, { season: 'winter' }]);

  // ---------- 风车：塔身 ----------
  ART.add('windmill', (g, v) => {
    const Wl = '#f6e3c4', Wd = '#e5c9a0', R = '#d9624e', Rd = '#b44b3a';
    // 塔身：下宽上窄
    g.path('M-26 0 L-17 -86 L17 -86 L26 0 Z', Wd);
    g.path('M-26 0 L-17 -86 L6 -86 L10 0 Z', Wl);
    // 门、窗
    g.path('M-8 0 L-8 -16 Q0 -24 8 -16 L8 0 Z', '#8a5a3b');
    g.circle(0, -50, 6, '#8cc4e0');
    g.stroke('M-6 -50 L6 -50 M0 -56 L0 -44', '#6f5140', 1.6);
    // 屋顶
    g.path('M-23 -84 Q0 -116 23 -84 Z', Rd);
    g.path('M-23 -84 Q-4 -112 8 -106 Q2 -96 -1 -84 Z', R);
    if (v.season === 'winter') g.path('M-20 -88 Q0 -116 20 -88 Q10 -93 0 -92 Q-10 -93 -20 -88 Z', P.snow);
    // 叶片轮轴（叶片是另一张贴纸，由引擎绕这个点转）
    g.circle(0, -80, 5, '#7b5236');
    g.emit(0, -80, 'hub');
    g.light(0, -50, 12, '#ffd36b');
  }, [{ season: 'summer' }, { season: 'winter' }]);

  // 风车叶片：原点 = 轮轴；四片布帆
  ART.add('windmill_blades', (g) => {
    for (let i = 0; i < 4; i++) {
      g.at(0, 0, (i / 4) * TAU, 1, 1, () => {
        g.rect(-2, -58, 4, 58, 2, '#8a5a3b');            // 叶片杆
        g.path('M2 -56 L16 -52 L14 -14 L2 -12 Z', '#fbf4e4');  // 布帆
        g.stroke('M2 -44 L15 -41 M2 -30 L14.5 -28', '#d8c8aa', 1.4);
      });
    }
    g.circle(0, 0, 6, '#7b5236');
    g.circle(-1.5, -1.5, 2, '#9a6a45');
  });

  // 贴纸册 / 图鉴里的图标：塔身 + 叶片拼在一起
  ART.add('windmill_full', (g, v) => {
    ART.fns.windmill(g, v);
    g.at(0, -80, 0.35, 1, 1, () => ART.fns.windmill_blades(g, v));
  }, [{ season: 'summer' }]);

  // ---------- 稻草人 ----------
  ART.add('scarecrow', (g) => {
    const Wood = '#9a6a45', Straw = '#f2cf6a', Strawd = '#d8ab45', Shirt = '#6fa8d6', Shirtd = '#5a8fbd';
    g.rect(-3, -62, 6, 62, 3, Wood);                      // 立柱
    // 手臂横杆 + 稻草手
    g.rect(-32, -52, 64, 5, 2.5, Wood);
    for (const s of [-1, 1]) {
      g.path(`M${s * 30} -54 L${s * 40} -58 L${s * 38} -50 L${s * 42} -47 L${s * 30} -46 Z`, Straw);
    }
    // 衣服（带补丁）
    g.path('M-17 -55 L17 -55 L14 -22 L-14 -22 Z', Shirtd);
    g.path('M-17 -55 L10 -55 L6 -22 L-14 -22 Z', Shirt);
    g.rect(-9, -40, 8, 8, 1.5, '#e98a6c');
    g.stroke('M-8 -39 L-2 -33 M-2 -39 L-8 -33', '#b9644a', 1.2);
    // 衣摆下的稻草
    g.path('M-13 -23 L-10 -12 L-6 -22 L-2 -11 L2 -22 L6 -12 L9 -22 L12 -13 L13 -23 Z', Strawd);
    // 头（麻布袋）
    g.circle(0, -66, 11, '#e9cf9c');
    g.circle(-1.5, -67.5, 9.5, '#f3dcae');
    g.eye(-4, -67, 2);
    g.eye(4.5, -67, 2);
    g.stroke('M-4 -61 Q0.5 -58 5 -61', P.ink, 1.5);
    g.blush(-7, -63, 2.4); g.blush(8, -63, 2.4);
    // 草帽
    g.ellipse(0, -75, 18, 4.5, Strawd);
    g.path('M-10 -76 Q-9 -89 0 -89 Q9 -89 10 -76 Z', Straw);
    g.rect(-10, -79, 20, 3.5, 1, '#e25b4a');
  });

  // ---------- 南瓜（南瓜灯） ----------
  function pumpkin(g, x, y, s) {
    const O = '#f39a3d', Od = '#dd7a2a', Ol = '#f8b862';
    g.at(x, y, 0, s, s, () => {
      g.ellipse(-8, -13, 9, 12.5, Od);
      g.ellipse(8, -13, 9, 12.5, Od);
      g.ellipse(0, -13, 10, 13, O);
      g.ellipse(-4, -17, 3, 6, Ol, 0.1);
      g.stroke('M0 -26 Q-2 -13 0 -1 M-8 -24 Q-12 -13 -8 -2 M8 -24 Q12 -13 8 -2', Od, 1.4);
      g.rect(-2, -31, 4.5, 7, 1.5, '#6f8a3a');                     // 瓜蒂
      g.path('M2 -28 Q10 -34 14 -27 Q8 -26 2 -28 Z', '#8cc672');    // 叶子
      // 刻出来的笑脸（夜里会亮）
      g.poly([-7, -17, -3, -17, -5, -21], '#7a3a12');
      g.poly([3, -17, 7, -17, 5, -21], '#7a3a12');
      g.path('M-7 -11 Q0 -4 7 -11 L4 -10 L2 -8 L0 -10 L-2 -8 L-4 -10 Z', '#7a3a12');
    });
    g.light(x, y - 13 * s, 16 * s, '#ffb24a');
  }
  ART.add('pumpkin', (g) => {
    pumpkin(g, -9, 0, 1.0);
    pumpkin(g, 13, 0, 0.72);
  }, [{ season: 'autumn' }]);

  // ---------- 刺猬 ----------
  ART.add('hedgehog', (g) => {
    const Sp = '#8b6a52', Spd = '#6f5240', Face = '#e9cfa8', Faced = '#d4b48a';
    // 刺：一圈三角
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.05 + (i / (n - 1)) * 0.95);
      const cx = -4 + Math.cos(a) * 17, cy = -12 + Math.sin(a) * 13;
      const tx = -4 + Math.cos(a) * 27, ty = -12 + Math.sin(a) * 21;
      const px = Math.cos(a + Math.PI / 2) * 5, py = Math.sin(a + Math.PI / 2) * 5;
      g.poly([cx + px, cy + py, tx, ty, cx - px, cy - py], i % 2 ? Spd : Sp);
    }
    g.ellipse(-4, -12, 18, 12.5, Sp);
    g.stroke('M-14 -16 L-10 -20 M-6 -19 L-2 -23 M-16 -9 L-12 -12', Spd, 1.6);
    // 脸
    g.path('M4 -20 Q20 -18 25 -8 Q20 -2 6 -2 Z', Faced);
    g.path('M5 -19 Q18 -17 22 -9 Q17 -4 6 -4 Z', Face);
    g.circle(25, -8, 2.4, P.ink);
    g.eye(13, -12, 2);
    g.blush(16, -6.5, 2.4);
    // 小脚
    g.ellipse(-12, -1.5, 4, 2.2, Faced); g.ellipse(4, -1.5, 4, 2.2, Faced);
    // 背上一片落叶
    g.path('M-12 -22 Q-6 -30 1 -24 Q-5 -18 -12 -22 Z', '#f29a3f');
    g.stroke('M-11 -22 L0 -24.5', '#c8702a', 1);
  });

  // ---------- 蜗牛 ----------
  ART.add('snail', (g) => {
    const Bd = '#b9c98a', B = '#cfdc9e', Sh = '#e8a45c', Shd = '#c9803a', Shl = '#f6c98a';
    // 身体
    g.path('M-20 0 Q-22 -6 -12 -6 L12 -6 Q20 -8 22 -18 Q25 -24 28 -18 Q29 -8 22 -2 Q16 0 8 0 Z', Bd);
    g.path('M-18 -1 Q-19 -5 -11 -5 L12 -5 Q19 -8 21 -17 Q24 -22 26 -17 Q26 -9 20 -3 Q14 -1 8 -1 Z', B);
    // 触角
    g.line(22, -19, 19, -30, Bd, 2.2); g.line(25, -19, 27, -30, Bd, 2.2);
    g.circle(19, -30, 2.4, Bd); g.circle(27, -30, 2.4, Bd);
    g.eye(22.5, -14, 1.8);
    g.blush(25, -10, 2);
    // 壳：螺旋
    g.circle(-2, -17, 15, Shd);
    g.circle(-3, -18, 13.5, Sh);
    g.ellipse(-8, -24, 4, 2.5, Shl, -0.6);
    let d = '';
    for (let i = 0; i <= 60; i++) {
      const a = i / 60 * TAU * 2.1, r = 11 - i / 60 * 10;
      d += (i ? 'L' : 'M') + (-3 + Math.cos(a) * r).toFixed(2) + ' ' + (-18 + Math.sin(a) * r).toFixed(2) + ' ';
    }
    g.stroke(d, Shd, 2);
  });
})();
