# -*- coding: utf-8 -*-
"""把对比图与图鉴数据内嵌进单文件 HTML 教程（可重复运行，幂等）。

运行：python assets/embed_assets.py
"""
import os, json, base64, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
HTML = os.path.join(ROOT, 'FFmpeg前置视频知识完全指南.html')

with open(os.path.join(ASSETS, 'manifest.json'), encoding='utf-8') as f:
    manifest = json.load(f)

imgs = {}
for g in manifest:
    for key in ('before_img', 'after_img'):
        name = g[key]
        with open(os.path.join(ASSETS, name), 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('ascii')
        imgs[name] = 'data:image/webp;base64,' + b64

with open(HTML, encoding='utf-8') as f:
    html = f.read()


def put(script_id, payload):
    global html
    block = '<script id="%s" type="application/json">%s</script>' % (script_id, payload)
    pat = r'<script id="%s" type="application/json">.*?</script>' % script_id
    if re.search(pat, html, flags=re.S):
        html = re.sub(pat, lambda m: block, html, count=1, flags=re.S)
    else:
        marker = '<script>\n'
        idx = html.find(marker)
        if idx < 0:
            raise RuntimeError('main <script> not found')
        html = html[:idx] + block + '\n' + html[idx:]


put('imgdata', json.dumps(imgs, ensure_ascii=False, separators=(',', ':')))
put('cmpdata', json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))

with open(HTML, 'w', encoding='utf-8') as f:
    f.write(html)

print('embedded %d images, %d groups' % (len(imgs), len(manifest)))
print('html size: %.2f MB' % (os.path.getsize(HTML) / 1024 / 1024))
