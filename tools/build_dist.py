"""把上线需要的文件复制到 dist/（Netlify 直接部署这个目录）。

python tools/build_dist.py

只拷游戏运行时用到的：index.html、index.html 引用的脚本、字体子集和字体许可。
预览表、测试脚本、截图、原始字体不放进去。改完代码重跑一次即可。
"""
import pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'

html = (ROOT / 'index.html').read_text(encoding='utf-8')
files = ['index.html', 'fonts/zcool-kuaile.woff2']
files += re.findall(r'<script src="([^"]+)"', html)
files += re.findall(r'url\("([^"]+)"\)', html)

if DIST.exists():
    shutil.rmtree(DIST)
for rel in sorted(set(files)):
    src = ROOT / rel
    if not src.exists():
        raise SystemExit(f'缺文件：{rel}')
    dst = DIST / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
shutil.copy2(ROOT / 'fonts/src/OFL.txt', DIST / 'fonts/OFL.txt')

total = sum(p.stat().st_size for p in DIST.rglob('*') if p.is_file())
for p in sorted(DIST.rglob('*')):
    if p.is_file():
        print(f'{p.relative_to(DIST).as_posix():32s} {p.stat().st_size / 1024:7.1f} KB')
print(f'共 {total / 1024:.0f} KB -> {DIST}')
