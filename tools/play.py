"""脚本化试玩：真鼠标拖贴纸（无头浏览器里的鼠标，不动用户的真鼠标），逐步截图。
python tools/play.py [场景名]
"""
import sys, pathlib, json
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
url = (root / 'index.html').as_uri()
scenario = sys.argv[1] if len(sys.argv) > 1 else 'basic'
W, H = 1440, 900


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": W, "height": H})
        logs = []
        pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type in ('error', 'warning') else None)
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        pg.goto(url)
        pg.wait_for_timeout(900)
        n = [0]

        def shot(name):
            n[0] += 1
            path = f"shots/p_{scenario}_{n[0]:02d}_{name}.png"
            pg.screenshot(path=str(root / path))
            print("shot", path)

        def scr(wx, wy):
            return pg.evaluate(f"__TEST__.toScreen({wx},{wy})")

        def tab(t):
            pg.click(f'#tabs button[data-tab="{t}"]')
            pg.wait_for_timeout(150)

        def drag_tile(sid, wx, wy, steps=14):
            box = pg.locator(f'.tile[data-id="{sid}"]').bounding_box()
            sx, sy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2 - 8
            tx, ty = scr(wx, wy)
            pg.mouse.move(sx, sy)
            pg.mouse.down()
            for i in range(1, steps + 1):
                pg.mouse.move(sx + (tx - sx) * i / steps, sy + (ty - sy) * i / steps)
                pg.wait_for_timeout(16)
            pg.mouse.up()
            pg.wait_for_timeout(120)

        def drag_world(x0, y0, x1, y1, steps=12):
            a, b_ = scr(x0, y0)
            c, d = scr(x1, y1)
            pg.mouse.move(a, b_); pg.mouse.down()
            for i in range(1, steps + 1):
                pg.mouse.move(a + (c - a) * i / steps, b_ + (d - b_) * i / steps)
                pg.wait_for_timeout(16)
            pg.mouse.up(); pg.wait_for_timeout(120)

        def state():
            return pg.evaluate("__TEST__.state()")

        if scenario == 'basic':
            shot('start')
            tab('sky')
            drag_tile('raincloud', 700, 300)
            pg.wait_for_timeout(500)
            shot('raining')
            pg.wait_for_timeout(1500)
            shot('grown')
            tab('nature')
            drag_tile('pond', 560, 640)
            tab('animal')
            drag_tile('duck', 560, 645)
            pg.wait_for_timeout(900)
            shot('duck_pond')
            # 把雨云挪到池塘上
            drag_world(700, 300, 560, 380)
            pg.wait_for_timeout(2200)
            shot('frog')
            s = state()
            print('disc', s['disc'])
            print('items', [(i['id'], i['x'], i['y']) for i in s['items']])
            print('job', pg.evaluate("JSON.stringify(__TEST__.job())"))
            pg.click('#segTime button[data-t="night"]')
            pg.wait_for_timeout(1200)
            shot('night')
            pg.click('#segSeason button[data-s="winter"]')
            pg.wait_for_timeout(400)
            shot('winter_wipe')
            pg.wait_for_timeout(1200)
            shot('winter_night')
            pg.click('#segTime button[data-t="dusk"]')
            pg.click('#segSeason button[data-s="autumn"]')
            pg.wait_for_timeout(1600)
            shot('autumn_dusk')
            pg.click('#btnBook')
            pg.wait_for_timeout(500)
            shot('book')
            pg.keyboard.press('Escape')
            print('disc', state()['disc'])
        elif scenario == 'combos':
            pg.evaluate("__TEST__.unlockAll(); __TEST__.clear(); __TEST__.setSeason('spring')")
            pg.wait_for_timeout(900)
            T = lambda js: pg.evaluate(js)
            T("__TEST__.place('tree', 330, 520)")
            T("__TEST__.place('flowers', 500, 640)")
            T("__TEST__.place('duck', 800, 600)")
            T("__TEST__.place('duck', 860, 620)")
            T("__TEST__.place('pond', 900, 520)")
            T("__TEST__.place('bridge', 900, 522)")
            T("__TEST__.place('bird', 340, 525)")
            T("__TEST__.place('bench', 640, 700)")
            T("__TEST__.place('cat', 650, 702)")
            T("__TEST__.place('sun', 400, 170)")
            T("__TEST__.place('raincloud', 560, 190)")
            T("__TEST__.place('rabbit', 1080, 690)")
            pg.wait_for_timeout(2600)
            shot('spring_combos')
            print('disc', state()['disc'])
            T("__TEST__.place('moon', 900, 150)")
            T("__TEST__.setTime('night')")
            pg.wait_for_timeout(3500)
            shot('spring_night')
            T("__TEST__.setSeason('summer')")
            T("__TEST__.place('grass', 300, 640)")
            T("__TEST__.place('lantern', 560, 560)")
            pg.wait_for_timeout(2500)
            shot('summer_night')
            print('disc', state()['disc'])
        elif scenario == 'flow':
            tab('animal')
            box = pg.locator('.tile[data-id="duck"]').bounding_box()
            sx, sy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            pg.mouse.move(sx, sy); pg.mouse.down()
            for i in range(1, 9):
                pg.mouse.move(sx - i * 20, sy + i * 12); pg.wait_for_timeout(16)
            shot('ghost_outside')
            tx, ty = scr(620, 600)
            for i in range(1, 13):
                pg.mouse.move(sx - 160 + (tx - sx + 160) * i / 12, sy + 96 + (ty - sy - 96) * i / 12); pg.wait_for_timeout(16)
            shot('dragging_inside')
            pg.mouse.up(); pg.wait_for_timeout(100)
            shot('just_dropped')
            pg.wait_for_timeout(500)
            n0 = len(state()['items'])
            # 选中房子，翻转、放大
            a, b_ = scr(900, 420)
            pg.mouse.click(a, b_); pg.wait_for_timeout(200)
            pg.keyboard.press('f'); pg.mouse.wheel(0, -300); pg.wait_for_timeout(300)
            shot('house_selected')
            # 把房子拖出盒子 -> 撕掉
            pg.mouse.move(a, b_); pg.mouse.down()
            for i in range(1, 15):
                pg.mouse.move(a + i * 30, b_ - i * 2); pg.wait_for_timeout(16)
            pg.mouse.up(); pg.wait_for_timeout(600)
            n1 = len(state()['items'])
            print('items before/after tear', n0, n1)
            pg.keyboard.press('Control+z'); pg.wait_for_timeout(300)
            print('after undo', len(state()['items']))
            # 完成第一个委托：池塘 + 鸭子下水
            tab('nature')
            drag_tile('pond', 300, 640)
            pg.wait_for_timeout(300)
            drag_world(620, 575, 300, 610)
            pg.wait_for_timeout(700)
            print('job', pg.evaluate("JSON.stringify(__TEST__.job())"))
            shot('job_ready')
            pg.click('#btnDeliver'); pg.wait_for_timeout(1200)
            shot('done')
            pg.click('[data-a="next"]'); pg.wait_for_timeout(300)
            pg.click('#btnAlbum'); pg.wait_for_timeout(400)
            shot('album')
            pg.keyboard.press('Escape')
            print('state', json.dumps({k: v for k, v in state().items() if k != 'items'}, ensure_ascii=False))
        print('\n'.join(logs) or 'no errors')
        b.close()


main()
