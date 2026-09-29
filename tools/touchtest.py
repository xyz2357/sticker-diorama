"""手机触屏测试：用 CDP 发真实的触摸事件（浏览器会照常处理滚动和 touch-action）。
python tools/touchtest.py
"""
import pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=d3d11"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto((root / 'index.html').as_uri())
    pg.wait_for_timeout(1000)
    cdp = ctx.new_cdp_session(pg)

    def touch(kind, x, y):
        pts = [] if kind == 'touchEnd' else [{"x": x, "y": y}]
        cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": pts})

    def gesture(x0, y0, x1, y1, hold_ms=0, steps=12, step_ms=16):
        touch('touchStart', x0, y0)
        if hold_ms:
            pg.wait_for_timeout(hold_ms)
        for k in range(1, steps + 1):
            touch('touchMove', x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps)
            pg.wait_for_timeout(step_ms)
        touch('touchEnd', x1, y1)
        pg.wait_for_timeout(400)

    items = lambda: len(pg.evaluate("__TEST__.state().items"))
    shelf = pg.locator('#shelf')
    shelf.scroll_into_view_if_needed()
    pg.wait_for_timeout(200)
    pg.screenshot(path=str(root / 'shots/touch_0.png'))
    n0 = items()
    sb = shelf.bounding_box()
    scroll0 = pg.evaluate("document.querySelector('#shelf').scrollTop"), pg.evaluate("window.scrollY")

    # 1. 在贴纸上快速往上滑：应该滚动，不应该拿起贴纸
    tile = pg.locator('.tile').nth(4).bounding_box()
    tx, ty = tile['x'] + tile['width'] / 2, tile['y'] + tile['height'] / 2
    gesture(tx, ty, tx, ty - 150)
    scroll1 = pg.evaluate("document.querySelector('#shelf').scrollTop"), pg.evaluate("window.scrollY")
    print('1 swipe: items', n0, '->', items(), '| scroll (shelf, page)', scroll0, '->', scroll1)

    # 2. 长按一张贴纸，再拖到舞台上
    pg.evaluate("window.scrollTo(0, 0)")
    pg.wait_for_timeout(200)
    cv = pg.locator('#stage').bounding_box()
    tile = pg.locator('.tile').first.bounding_box()
    tx, ty = tile['x'] + tile['width'] / 2, tile['y'] + tile['height'] / 2
    n1 = items()
    touch('touchStart', tx, ty)
    pg.wait_for_timeout(320)
    gx, gy = cv['x'] + cv['width'] * 0.5, cv['y'] + cv['height'] * 0.75
    for k in range(1, 16):
        touch('touchMove', tx + (gx - tx) * k / 15, ty + (gy - ty) * k / 15)
        pg.wait_for_timeout(20)
    pg.screenshot(path=str(root / 'shots/touch_dragging.png'))
    touch('touchEnd', gx, gy)
    pg.wait_for_timeout(500)
    print('2 long-press drag: items', n1, '->', items(), '| page scrolled to', pg.evaluate("window.scrollY"))

    # 3. 轻点一张贴纸：直接贴
    tile = pg.locator('.tile').nth(1).bounding_box()
    tx, ty = tile['x'] + tile['width'] / 2, tile['y'] + tile['height'] / 2
    n2 = items()
    touch('touchStart', tx, ty)
    pg.wait_for_timeout(80)
    touch('touchEnd', tx, ty)
    pg.wait_for_timeout(500)
    print('3 tap: items', n2, '->', items())

    pg.evaluate("window.scrollTo(0, 0)")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(root / 'shots/touch_end.png'))
    print(errs or 'no errors')
    b.close()
