"""这一轮修的几件事：旧存档补老鼠、太阳月亮跟着时段升落、小鸟飞出盒子、互动总开关、追逐被打断后不再自己重开。
python tools/skytest.py
"""
import pathlib, json
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
fails = []


def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name, extra)
    if not ok: fails.append(name)


with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=d3d11"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == 'error' else None)
    T = lambda js: pg.evaluate(js)
    W = pg.wait_for_timeout
    pg.goto((root / 'index.html').as_uri())

    # 1) 旧存档：解锁表里没有老鼠 -> 读档后补上并标"新"
    old = {"v": 1, "unlocked": {"tree": 1, "cat": 1, "sun": 1}, "fresh": {}, "disc": {}, "jobs": {}, "active": "duckhome",
           "scene": {"season": "summer", "time": "night", "items": [{"id": "sun", "x": 800, "y": 170, "s": 1, "flip": False, "state": {}, "flags": {}}]}, "muted": True}
    T(f"localStorage.setItem('paperbox.save.v1', {json.dumps(json.dumps(old))})")
    pg.reload(); W(600)
    st = T("({u: PB.save.unlocked.mouse, f: PB.save.fresh.mouse, sheep: PB.save.unlocked.sheep})")
    check('old save gets mouse', st['u'] == 1 and st['f'] == 1 and st['sheep'] == 1, st)
    # 旧存档里夜里挂着的太阳：读档后藏到山后
    check('night sun hidden on load', T("PB.all('sun').length") == 0 and T("PB.scene.items.filter(s => s.id === 'sun' && s.flags.down).length") == 1)
    T("__TEST__.setTime('day')"); W(2200)
    sun = T("PB.all('sun').map(s => [Math.round(s.x), Math.round(s.y)])")
    check('sun rises back to its spot on day', sun == [[800, 170]], sun)

    # 2) 白天按"夜晚"：太阳落下；月亮（之前藏着的）升起
    T("localStorage.clear()"); pg.reload(); W(2300)
    T("__TEST__.unlockAll(); __TEST__.clear(); __TEST__.setSeason('summer')"); W(200)
    T("__TEST__.place('sun', 900, 170); __TEST__.place('pond', 640, 600)"); W(300)
    T("__TEST__.setTime('night')"); W(700)
    mid = T("PB.scene.items.filter(s => s.id === 'sun').map(s => !!(s.tw && s.tw.sky))")
    check('sun is sinking after night button', mid == [True], mid)
    W(1500)
    check('sun down at night', T("PB.all('sun').length") == 0)
    T("__TEST__.place('moon', 400, 160)"); W(200)
    T("__TEST__.setTime('day')"); W(2200)
    check('day: sun up, moon down', T("[PB.all('sun').length, PB.all('moon').length]") == [1, 0])
    T("__TEST__.setTime('dusk')"); W(2200)
    check('dusk: both up', T("[PB.all('sun').length, PB.all('moon').length]") == [1, 1])
    # 撤销能退回去
    T("__TEST__.undo()"); W(300)
    check('undo back to day', T("[PB.scene.time, PB.all('sun').length, PB.all('moon').length]") == ['day', 1, 0])

    # 3) 白天新贴一个月亮 -> 日落，天黑，藏着的旧月亮被顶替
    T("__TEST__.placeLive('moon', 700, 150)"); W(5200)
    s3 = T("({t: PB.scene.time, sun: PB.all('sun').length, moons: PB.scene.items.filter(s => s.id === 'moon').length, disc: PB.save.disc.riluo ? 1 : 0})")
    check('placing moon in day -> night', s3 == {'t': 'night', 'sun': 0, 'moons': 1, 'disc': 1}, s3)
    # 夜里新贴太阳 -> 日出
    T("__TEST__.placeLive('sun', 500, 180)"); W(5200)
    s4 = T("({t: PB.scene.time, suns: PB.scene.items.filter(s => s.id === 'sun').length, moon: PB.all('moon').length, disc: PB.save.disc.richu ? 1 : 0})")
    check('placing sun at night -> day, old hidden sun replaced', s4 == {'t': 'day', 'suns': 1, 'moon': 0, 'disc': 1}, s4)
    # 拖动已经在天上的太阳（不是新贴的）不触发
    T("__TEST__.setTime('dusk')"); W(2000)
    T("__TEST__.placeLive('sun', 520, 180, {fresh: false})"); W(2500)
    check('moving an existing sun at dusk does nothing', T("PB.scene.time") == 'dusk')

    # 4) 猫吓小鸟：小鸟飞出盒子
    T("__TEST__.clear(); __TEST__.setTime('day')"); W(300)
    T("__TEST__.place('bird', 700, 560)"); W(200)
    T("__TEST__.place('cat', 640, 580)"); W(600)
    flying = T("PB.scene.items.filter(s => s.id === 'birdfly').length")
    W(3500)
    check('bird flies out and is gone', flying == 1 and T("PB.scene.items.filter(s => s.id === 'birdfly' || s.id === 'bird').length") == 0)

    # 5) 追逐被拎走打断后，放回猫旁边不会自己重开
    T("__TEST__.clear()"); W(200)
    T("__TEST__.place('mouse', 560, 640)"); T("__TEST__.placeLive('cat', 650, 650)"); W(1300)
    m = T("(() => { const s = PB.all('mouse')[0], b = PB.boxOf(s), p = PB.posOf(s); return [p.x - s.x + b.x + b.w/2, p.y - s.y + b.y + b.h*0.6, !!s.busy]; })()")
    c = T("(() => { const s = PB.all('cat')[0]; return [s.x, s.y]; })()")
    a, bb = T(f"__TEST__.toScreen({m[0]},{m[1]})"); d, e = T(f"__TEST__.toScreen({c[0] + 70},{c[1]})")
    pg.mouse.move(a, bb); pg.mouse.down()
    for i in range(1, 11): pg.mouse.move(a + (d - a) * i / 10, bb + (e - bb) * i / 10); W(16)
    pg.mouse.up(); W(1500)
    after = T("(() => { const s = PB.all('mouse')[0]; return [!!s.busy, !!s.tw]; })()")
    check('chase was running when grabbed', m[2] is True)
    check('dropping the grabbed mouse near the cat does not restart chase', after == [False, False], after)
    # 再拖一次（不是打断）就会重新开追
    m2 = T("(() => { const s = PB.all('mouse')[0], b = PB.boxOf(s); return [b.x + b.w/2, b.y + b.h*0.6]; })()")
    c2 = T("(() => { const s = PB.all('cat')[0]; return [s.x, s.y]; })()")
    a, bb = T(f"__TEST__.toScreen({m2[0]},{m2[1]})"); d, e = T(f"__TEST__.toScreen({c2[0] - 70},{c2[1] + 10})")
    pg.mouse.move(a, bb); pg.mouse.down()
    for i in range(1, 11): pg.mouse.move(a + (d - a) * i / 10, bb + (e - bb) * i / 10); W(16)
    pg.mouse.up(); W(900)
    check('a fresh drop near the cat starts the chase again', T("!!PB.all('mouse')[0].busy"))

    # 6) 互动总开关
    T("__TEST__.clear(); __TEST__.opt('react', false)"); W(200)
    T("__TEST__.place('pond', 640, 600); __TEST__.place('raincloud', 640, 330); __TEST__.place('sun', 900, 170)"); W(300)
    T("__TEST__.setTime('night')"); W(3000)
    s6 = T("({frog: PB.all('frog').length, rainbow: PB.all('rainbow').length, sun: PB.all('sun').length})")
    check('react off: no frog, no rainbow, sun stays at night', s6 == {'frog': 0, 'rainbow': 0, 'sun': 1}, s6)
    T("__TEST__.opt('react', true); PB.syncSky(true); PB.changed('opt')"); W(2600)
    s7 = T("({frog: PB.all('frog').length, sun: PB.all('sun').length})")
    check('react back on: frog appears, sun sets', s7 == {'frog': 1, 'sun': 0}, s7)

    # 7) 设置面板 + 齿轮图标截图
    T("__TEST__.setTime('day')"); W(1800)
    pg.click('#btnOpt'); W(500)
    pg.screenshot(path=str(root / 'shots' / 'opts2.png'))
    head = pg.locator('header').bounding_box() if pg.locator('header').count() else None
    btn = pg.locator('#btnOpt').bounding_box()
    pg.keyboard.press('Escape'); W(200)
    pg.screenshot(path=str(root / 'shots' / 'gear.png'), clip={'x': btn['x'] - 260, 'y': btn['y'] - 8, 'width': 340, 'height': btn['height'] + 16})
    print(errs or 'no errors')
    print('FAILED:', fails if fails else 'none')
    b.close()
