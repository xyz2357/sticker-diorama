"""把站酷快乐体裁成只含页面用到的字，输出 fonts/zcool-kuaile.woff2。

python tools/subset_font.py

改了界面文字、贴纸名、图鉴或委托文案以后要重跑一次，否则新字会退回系统字体。
"""
import pathlib, re
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'fonts/src/ZCOOLKuaiLe-Regular.ttf'
OUT = ROOT / 'fonts/zcool-kuaile.woff2'

text = ''
for p in [ROOT / 'index.html', *sorted((ROOT / 'js').glob('*.js'))]:
    text += p.read_text(encoding='utf-8')
chars = set(ch for ch in text if ord(ch) > 0x7f)
chars |= set(chr(c) for c in range(0x20, 0x7f))          # ASCII 全留
chars |= set('０１２３４５６７８９，。！？：；、「」『』（）…—·★☆✓')
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
opts.name_IDs = ['*']
opts.notdef_outline = True
f = subset.load_font(str(SRC), opts)
s = subset.Subsetter(opts)
s.populate(text=''.join(sorted(chars)))
s.subset(f)
subset.save_font(f, str(OUT), opts)
print(f'{len(chars)} chars -> {OUT.name} {OUT.stat().st_size // 1024} KB')
