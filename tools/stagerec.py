"""录几段小戏的连续画面，拼成条带图：python tools/stagerec.py [场景名...]"""
import pathlib, io, time, sys
from playwright.sync_api import sync_playwright
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent

SCENES = {
    # 名字: (准备, 触发, 录几秒, 取哪几个时刻)
    'frog': ("__TEST__.setSeason('summer'); __TEST__.place('pond', 640, 600); __TEST__.place('tree', 380, 520)",
             "__TEST__.place('raincloud', 640, 330)", 3.6, [0.9, 1.3, 1.7, 2.1, 2.6, 3.4]),
    'ducks': ("__TEST__.setSeason('spring'); __TEST__.place('pond', 900, 480); __TEST__.place('duck', 420, 640)",
              "__TEST__.place('duck', 500, 650)", 4.6, [1.0, 1.6, 2.2, 2.8, 3.4, 4.4]),
    'sapling': ("__TEST__.setSeason('summer'); __TEST__.place('sapling', 640, 620); __TEST__.place('house', 900, 470)",
                "__TEST__.place('raincloud', 640, 330)", 2.6, [1.0, 1.2, 1.35, 1.5, 1.65, 2.4]),
    'chase': ("__TEST__.setSeason('summer'); __TEST__.place('mouse', 560, 640); __TEST__.place('tree', 380, 500); __TEST__.place('bird', 860, 600)",
              "__TEST__.placeLive('cat', 650, 640)", 3.6, [0.6, 1.1, 1.6, 2.1, 2.6, 3.4]),
    'rainbow': ("__TEST__.setSeason('summer'); __TEST__.place('sun', 820, 170); __TEST__.place('pond', 640, 600)",
                "__TEST__.place('raincloud', 600, 200)", 3.2, [1.0, 1.4, 1.8, 2.2, 2.6, 3.1]),
    'hog': ("__TEST__.setSeason('autumn'); __TEST__.place('tree', 520, 520); __TEST__.place('mushroom', 600, 560)",
            "0", 3.6, [1.6, 1.9, 2.2, 2.6, 3.0, 3.5]),
    'birdout': ("__TEST__.setSeason('spring'); __TEST__.place('bird', 820, 560); __TEST__.place('tree', 380, 500)",
                "__TEST__.place('cat', 740, 590)", 3.4, [0.3, 0.7, 1.1, 1.6, 2.2, 3.2]),
    'nightbtn': ("__TEST__.setSeason('summer'); __TEST__.place('sun', 900, 170); __TEST__.place('moon', 380, 150); __TEST__.setTime('day'); PB.syncSky(false); __TEST__.place('house', 800, 470)",
                 "__TEST__.setTime('night')", 2.4, [0.1, 0.5, 0.8, 1.1, 1.5, 2.3]),
}
names = sys.argv[1:] or list(SCENES)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=d3d11"])
    for name in names:
        prep, trig, dur, picks = SCENES[name]
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto((root / 'index.html').as_uri())
        pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2300)   # 等开场幕布拉开
        pg.evaluate("__TEST__.unlockAll(); __TEST__.clear()")
        pg.evaluate(prep); pg.wait_for_timeout(300)
        box = pg.locator('#stage').bounding_box()
        clip = {k: box[k] for k in ('x', 'y', 'width', 'height')}
        t0 = time.time(); pg.evaluate(trig)
        frames = []
        while time.time() - t0 < dur:
            frames.append((time.time() - t0, Image.open(io.BytesIO(pg.screenshot(clip=clip))).convert('RGB')))
        disc = pg.evaluate("__TEST__.state().disc")
        pg.close()
        sm = lambda im: im.resize((576, int(576 * im.height / im.width)), Image.LANCZOS)
        chosen = [min(frames, key=lambda f: abs(f[0] - s))[1] for s in picks]
        w, h = sm(chosen[0]).size
        strip = Image.new('RGB', (w * 3 + 8, h * 2 + 4), (255, 255, 255))
        for i, im in enumerate(chosen):
            strip.paste(sm(im), ((i % 3) * (w + 4), (i // 3) * (h + 4)))
        strip.save(root / 'shots' / f'stage_{name}.png')
        print(name, len(frames), 'frames', 'disc', disc, errs or 'no errors')
    b.close()
