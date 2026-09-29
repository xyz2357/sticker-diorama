"""演戏时乱拖：记下所有音效，看有没有"没人碰却一直响"的声音、拖不动的贴纸、报错。
python tools/stress.py
"""
import pathlib, json, random
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
random.seed(3)

HOOK = """
window.__sfx = []; window.__act = 0;
const o = PB.sfx; PB.sfx = (n, d) => { __sfx.push([Math.round(performance.now()), n, __act]); return o(n, d); };
"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=d3d11"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto((root / 'index.html').as_uri())
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2300)
    pg.evaluate("__TEST__.unlockAll(); __TEST__.clear(); __TEST__.setSeason('summer')")
    pg.evaluate(HOOK)
    T = lambda js: pg.evaluate(js)
    scr = lambda x, y: T(f"__TEST__.toScreen({x},{y})")
    items = lambda: T("__TEST__.state().items")

    def pos(uid):
        return T(f"(() => {{ const s = PB.scene.items.find(s => s.uid === {uid}); if (!s) return null; const b = PB.boxOf(s), p = PB.posOf(s); return [p.x - s.x + b.x + b.w/2, p.y - s.y + b.y + b.h*0.6]; }})()")

    def drag(x0, y0, x1, y1, steps=10, hold=0):
        T("__act = 1")
        a, c = scr(x0, y0); d, e = scr(x1, y1)
        pg.mouse.move(a, c); pg.mouse.down()
        for i in range(1, steps + 1):
            pg.mouse.move(a + (d - a) * i / steps, c + (e - c) * i / steps); pg.wait_for_timeout(16)
        pg.wait_for_timeout(hold)
        pg.mouse.up(); T("__act = 0")

    T("__TEST__.place('pond', 640, 620); __TEST__.place('tree', 360, 520); __TEST__.place('bird', 820, 560)")
    T("__TEST__.place('mouse', 560, 660); __TEST__.place('sun', 900, 170); __TEST__.place('sapling', 1000, 640)")
    pg.wait_for_timeout(400)
    # 1) 猫贴到老鼠旁边 -> 追；追到一半抓老鼠、再放回猫旁边，来回几次
    T("__TEST__.placeLive('cat', 640, 670)")
    for r in range(6):
        pg.wait_for_timeout(random.randint(300, 900))
        ms = [i for i in items() if i['id'] == 'mouse']
        cs = [i for i in items() if i['id'] == 'cat']
        if not ms or not cs: break
        pm = pos(ms[0]['uid']); pc = pos(cs[0]['uid'])
        if not pm: continue
        drag(pm[0], pm[1], pc[0] + 60, pc[1], hold=random.randint(0, 400))
    # 2) 月亮贴上去 -> 日落；落到一半抓太阳
    drag_moon = T("__TEST__.placeLive('moon', 400, 160)")
    pg.wait_for_timeout(1500)
    su = [i for i in items() if i['id'] == 'sun']
    if su:
        ps = pos(su[0]['uid']); drag(ps[0], ps[1], 700, 200)
    # 3) 雨云到池塘上 -> 青蛙；青蛙冒出来时抓它
    T("__TEST__.place('raincloud', 640, 330)")
    pg.wait_for_timeout(1500)
    fr = [i for i in items() if i['id'] == 'frog']
    if fr:
        pf = pos(fr[0]['uid']); drag(pf[0], pf[1], 900, 700)
    pg.wait_for_timeout(2500)
    mark = T("performance.now()")
    pg.wait_for_timeout(6000)          # 静置：这段时间不该有交互音效
    log = T("__sfx")
    quiet = [s for s in log if s[0] > mark]
    print('sounds while idle:', [s[1] for s in quiet])
    busy = T("PB.scene.items.filter(s => s.busy || s.tw || s.card).map(s => [s.id, !!s.busy, !!s.tw])")
    print('busy/tw after idle:', busy, 'dragItem', T("!!PB.dragItem"))
    # 每张贴纸都试着拖一下
    stuck = []
    for it in items():
        pp = pos(it['uid'])
        if not pp: continue
        T("__act = 1")
        a, c = scr(pp[0], pp[1]); pg.mouse.move(a, c); pg.mouse.down()
        pg.mouse.move(a + 10, c + 3); pg.mouse.move(a + 20, c + 6)
        got = T("PB.dragItem ? PB.dragItem.id : null")
        pg.mouse.move(a, c); pg.mouse.up(); T("__act = 0")
        pg.wait_for_timeout(350)
        if got != it['id']: stuck.append((it['id'], got))
    print('could not grab:', stuck)
    print('all sounds:', [(s[1], s[2]) for s in log][-60:])
    print(errs or 'no errors')
    b.close()
