"""第二批贴纸（稻草人、南瓜、刺猬、蜗牛、风车、绵羊）的反应测试：python tools/content2test.py"""
import pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--use-gl=angle","--use-angle=d3d11"])
    pg = b.new_page(viewport={"width":1440,"height":900})
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto((root/'index.html').as_uri()); pg.wait_for_timeout(900)
    T = lambda js: pg.evaluate(js)
    T("__TEST__.unlockAll(); __TEST__.clear(); __TEST__.setSeason('autumn')"); pg.wait_for_timeout(900)
    for js in ["place('tree', 380, 520)", "place('raincloud', 380, 250)", "place('scarecrow', 760, 600)", "place('grass', 850, 640)",
               "place('bird', 700, 610)", "place('sheep', 1000, 520)", "place('fence', 1060, 540)", "place('windmill', 620, 470)",
               "place('cloud', 640, 200)", "place('flowers', 540, 690)", "place('raincloud', 545, 430)"]:
        T("__TEST__." + js)
    pg.wait_for_timeout(5200)
    pg.screenshot(path=str(root/'shots/new_autumn.png'))
    print('disc', T("__TEST__.state().disc"))
    print('items', [i['id'] for i in T("__TEST__.state().items")])
    T("__TEST__.setTime('night')"); pg.wait_for_timeout(1800)
    pg.screenshot(path=str(root/'shots/new_night.png'))
    T("__TEST__.setSeason('winter'); __TEST__.setTime('day')"); pg.wait_for_timeout(1600)
    pg.screenshot(path=str(root/'shots/new_winter.png'))
    print('disc', T("__TEST__.state().disc"), len(T("__TEST__.state().disc")))
    T("__TEST__.tab('animal')"); pg.wait_for_timeout(300)
    pg.screenshot(path=str(root/'shots/new_book.png'), clip={"x":1100,"y":60,"width":340,"height":560})
    print(errs or 'no errors')
    b.close()
