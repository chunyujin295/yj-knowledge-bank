# -*- coding: utf-8 -*-
"""生成 FFmpeg 教程用的「参数改变前后」真实效果对比图。

大部分对比由本机 ffmpeg 真实编码 / 滤镜处理得到；少数需要构造错误解释的
（色彩范围、矩阵错配、HDR 曲线）用与播放器一致的数学变换还原。
运行：python assets/make_images.py
"""
import os, json, subprocess, math
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
TMP = os.path.join(OUT, '_tmp')
os.makedirs(TMP, exist_ok=True)
W, H = 800, 450
rng = np.random.default_rng(20261111)


def ff(*args):
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + [str(a) for a in args]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError('FFmpeg failed:\n' + ' '.join(cmd) + '\n' + r.stderr[-1500:])


def ffimg(outname, *args):
    p = os.path.join(TMP, outname)
    ff(*args, p)
    return Image.open(p).convert('RGB')


def asarr(img):
    return np.asarray(img.convert('RGB')).astype(np.float32)


def asimg(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')


def font(sz):
    for p in ['C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/msyhbd.ttc',
              'C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/msyh.ttc']:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                pass
    return ImageFont.load_default()


def make_chart():
    """一张同时含渐变、高频纹理、饱和色、细字、锐利边缘、圆形的评测画面。"""
    t = (np.arange(285) / 285.0)[:, None, None]
    sky = np.array([26, 68, 148], float) * (1 - t) + np.array([248, 186, 116], float) * t
    arr = np.zeros((H, W, 3), float)
    arr[:285] = sky
    gt = (np.arange(H - 285) / (H - 285))[:, None, None]
    grass = np.ones((H - 285, W, 3)) * (0.72 + 0.42 * gt) * np.array([56, 112, 54], float)
    grass += rng.normal(0, 9, (H - 285, W, 1))
    arr[285:] = grass
    im = asimg(arr)
    d = ImageDraw.Draw(im)

    d.ellipse([612, 44, 706, 138], fill=(255, 240, 186))
    d.polygon([(0, 285), (110, 196), (225, 258), (355, 158), (492, 262), (638, 190), (800, 285)], fill=(48, 64, 96))
    d.polygon([(0, 285), (175, 228), (330, 285), (520, 216), (800, 285)], fill=(32, 50, 70))
    d.ellipse([46, 38, 122, 114], fill=(218, 44, 48), outline=(255, 255, 255), width=2)
    d.ellipse([140, 38, 216, 114], fill=(38, 92, 220), outline=(255, 255, 255), width=2)

    # 灰阶渐变条（色带观察区）
    a = asarr(im)
    a[306:334, 20:300, :] = np.linspace(0, 255, 280, dtype=np.float32)[None, :, None]
    # 彩条（色彩矩阵观察区）
    bars = [(255, 255, 255), (255, 220, 0), (0, 210, 240), (40, 210, 90),
            (225, 40, 190), (235, 45, 45), (30, 60, 220), (12, 12, 12)]
    for i, c in enumerate(bars):
        a[342:374, 20 + i * 35:20 + (i + 1) * 35, :] = np.array(c, float)
    # 高频棋盘（缩放/锐度观察区）
    yy, xx = np.mgrid[0:34, 0:180]
    checker = np.where(((xx // 4 + yy // 4) % 2) == 0, 245, 12).astype(np.float32)
    a[392:426, 20:200, :] = checker[..., None]
    im = asimg(a)
    d = ImageDraw.Draw(im)

    # 细网格
    for gx in range(330, 522, 5):
        d.line([(gx, 300), (gx, 386)], fill=(235, 235, 235), width=1)
    for gy in range(300, 387, 5):
        d.line([(330, gy), (520, gy)], fill=(35, 35, 35), width=1)
    # 放射线（混叠观察）
    for k in range(0, 28):
        ang = math.radians(k * 5 - 35)
        d.line([(690, 392), (690 + 150 * math.cos(ang), 392 + 150 * math.sin(ang))],
               fill=(255, 255, 255) if k % 2 else (20, 20, 20), width=1)
    # 肤色块
    d.rectangle([548, 330, 646, 402], fill=(226, 176, 142), outline=(255, 255, 255), width=2)
    d.rectangle([558, 340, 636, 392], fill=(214, 158, 124))

    f = font(19)
    d.text((330, 396), 'CHROMA 4:2:0 TEST', fill=(255, 255, 255), font=f)
    d.text((540, 302), 'SHARP 123456', fill=(255, 40, 40), font=font(17))
    d.text((330, 420), 'edge  0.5px  /  detail 8x8', fill=(120, 255, 220), font=font(13))
    d.text((24, 380), '0 ............... 255   GREY RAMP', fill=(255, 255, 255), font=font(12))
    d.text((548, 408), 'SKIN TONE', fill=(255, 255, 255), font=font(12))
    return im


chart = make_chart()
chart_path = os.path.join(TMP, 'chart.png')
chart.save(chart_path)
A = asarr(chart)

# 运动帧序列：用于真实 H.264 编码对比
base_bgr = cv2.imread(chart_path)
for i in range(30):
    M = np.float32([[1, 0, -i * 2.4], [0, 1, -i * 0.9]])
    fr = cv2.warpAffine(base_bgr, M, (W, H), borderMode=cv2.BORDER_REFLECT)
    cv2.imwrite(os.path.join(TMP, 'f_%03d.png' % i), fr)


def encode(extra, tag):
    mp4 = os.path.join(TMP, 'enc_%s.mp4' % tag)
    ff('-framerate', '25', '-i', os.path.join(TMP, 'f_%03d.png'),
       '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-g', '15',
       *extra, mp4)
    return ffimg('dec_%s.png' % tag, '-ss', '0.60', '-i', mp4, '-frames:v', '1')


print('encoding real H.264 samples ...')
crf18 = encode(['-crf', '18'], 'crf18')
crf40 = encode(['-crf', '40'], 'crf40')
lowbr = encode(['-b:v', '170k', '-maxrate', '170k', '-bufsize', '340k'], 'lowbr')

# ---- 逐组生成 -------------------------------------------------------------
pairs = {}


def pair(pid, before, after):
    assert before.size == (W, H) == after.size, (pid, before.size, after.size)
    pairs[pid] = (before.convert('RGB'), after.convert('RGB'))


# 1 分辨率
lowres = ffimg('lowres.png', '-i', chart_path, '-vf',
               'scale=200:112:flags=lanczos,scale=800:450:flags=lanczos', '-frames:v', '1')
pair('resolution', chart, lowres)

# 2 色度抽样
def _rgb2yuv(v):
    r, g, b = v[..., 0], v[..., 1], v[..., 2]
    return np.stack([0.299 * r + 0.587 * g + 0.114 * b,
                     -0.168736 * r - 0.331264 * g + 0.5 * b + 128,
                     0.5 * r - 0.418688 * g - 0.081312 * b + 128], -1)


def _yuv2rgb(v):
    yy, u, vv = v[..., 0], v[..., 1] - 128, v[..., 2] - 128
    return np.stack([yy + 1.402 * vv, yy - 0.344136 * u - 0.714136 * vv, yy + 1.772 * u], -1)


_cs = np.zeros((224, 400, 3), np.float32) + np.array([128, 128, 128], float)
for _x in range(10, 190, 8):
    _cs[20:100, _x:_x + 1] = [230, 30, 30] if (_x // 8) % 2 == 0 else [30, 60, 230]
_yy, _xx = np.mgrid[0:80, 0:180]
_mask = ((_xx // 2 + _yy // 2) % 2) == 0
_chk = np.zeros((80, 180, 3), np.float32)
_chk[_mask] = [220, 40, 40]
_chk[~_mask] = [40, 70, 220]
_cs[120:200, 200:380] = _chk
_cs[205:220, 10:390] = np.linspace(0, 255, 380, dtype=np.float32)[None, :, None]
_cs_img = asimg(_cs)
_dc = ImageDraw.Draw(_cs_img)
_dc.text((10, 4), '1px COLOR LINES  /  chroma detail test', fill=(255, 255, 255), font=font(13))
_dc.text((10, 104), 'COLOR TEXT', fill=(255, 60, 60), font=font(14))
_dc.text((10, 120), '4:2:0 TEST', fill=(60, 180, 255), font=font(14))
_dc.text((200, 104), '2px RED / BLUE CHECKER', fill=(255, 255, 255), font=font(11))
_yuv = _rgb2yuv(asarr(_cs_img))
_y2 = _yuv.copy()
for _c in (1, 2):
    _ch = _y2[..., _c]
    _blk = (_ch[0::2, 0::2] + _ch[0::2, 1::2] + _ch[1::2, 0::2] + _ch[1::2, 1::2]) / 4.0
    _ch[0::2, 0::2] = _blk
    _ch[0::2, 1::2] = _blk
    _ch[1::2, 0::2] = _blk
    _ch[1::2, 1::2] = _blk
    _y2[..., _c] = _ch
pair('chroma', _cs_img.resize((W, H), Image.NEAREST),
              asimg(_yuv2rgb(_y2)).resize((W, H), Image.NEAREST))

# 3 低位深量化色带
grad = np.zeros((H, W, 3), np.float32)
grad[:H // 2, :, :] = np.linspace(0, 255, W, dtype=np.float32)[None, :, None]
for c in range(3):
    grad[H // 2:, :, c] = np.linspace(0, 255, W, dtype=np.float32) * ([0.35, 0.75, 1.0][c])
grad += rng.normal(0, 0.8, (H, W, 1))
grad8 = asimg(grad)
g4 = np.round(asarr(grad8) / 17.0) * 17.0
pair('bitdepth', grad8, asimg(g4))

# 4 limited / full range 误标（对比度被压缩，画面发灰）
pair('range', chart, asimg(16 + A * (219.0 / 255.0)))

# 5 色彩矩阵错配：BT.601 编码 → BT.2020 解码
def rgb2yuv601(v):
    r, g, b = v[..., 0], v[..., 1], v[..., 2]
    yy = 0.299 * r + 0.587 * g + 0.114 * b
    return np.stack([yy, 128 + 0.5 * (b - yy) / (1 - 0.114), 128 + 0.5 * (r - yy) / (1 - 0.299)], -1)


def yuv2rgb2020(v):
    yy, cb, cr = v[..., 0], v[..., 1] - 128, v[..., 2] - 128
    return np.stack([yy + 1.4746 * cr, yy - 0.16455 * cb - 0.57135 * cr, yy + 1.8814 * cb], -1)


sw = np.zeros((H, W, 3), np.float32)
_blocks = [(220, 40, 40), (40, 180, 90), (40, 90, 220), (240, 200, 40),
           (226, 176, 142), (150, 60, 200), (30, 200, 210), (210, 90, 60)]
for _i, _c in enumerate(_blocks):
    sw[(_i // 4) * 225:(_i // 4 + 1) * 225, (_i % 4) * 200:(_i % 4 + 1) * 200] = np.array(_c, float)
sw[210:240, :, :] = np.linspace(0, 255, W, dtype=np.float32)[None, :, None]
sw_img = asimg(sw)
_d = ImageDraw.Draw(sw_img)
_d.text((16, 12), 'COLOR MATRIX CHECK  /  BT.601 vs BT.2020', fill=(255, 255, 255), font=font(17))
_d.text((16, 414), 'GREY RAMP SHOULD STAY NEUTRAL', fill=(255, 255, 255), font=font(15))
pair('matrix', sw_img, asimg(yuv2rgb2020(rgb2yuv601(asarr(sw_img)))))

# 6 HDR PQ 误按 gamma 解释 vs 正确色调映射
lin = (A / 255.0) ** 2.2 * 900.0
N = lin / 10000.0
m1, m2, c1, c2, c3 = 0.1593017578125, 78.84375, 0.8359375, 18.8515625, 18.6875
pq = ((c1 + c2 * N ** m1) / (1 + c3 * N ** m1)) ** m2
wrong = pq * 255.0
lout = lin / (1 + lin / 320.0)
correct = (lout / 320.0) ** (1 / 2.2) * 255.0
pair('hdr', asimg(wrong), asimg(correct))

# 7 隔行梳齿 vs 去隔行
Bshift = cv2.warpAffine(base_bgr, np.float32([[1, 0, -22], [0, 1, 0]]), (W, H), borderMode=cv2.BORDER_REFLECT)
Bshift = cv2.cvtColor(Bshift, cv2.COLOR_BGR2RGB)
Ai = asarr(chart).astype(np.uint8)
inter = Ai.copy()
inter[1::2] = Bshift[1::2]
inter_img = Image.fromarray(inter, 'RGB')
inter_path = os.path.join(TMP, 'inter.png')
inter_img.save(inter_path)
try:
    deint = ffimg('deint.png', '-loop', '1', '-i', inter_path, '-t', '0.24', '-r', '25',
                  '-vf', 'yadif=mode=send_frame:parity=tff:deint=all', '-frames:v', '1')
    if np.abs(asarr(deint) - inter.astype(np.float32)).mean() < 2.0:
        raise RuntimeError('yafif produced no visible change')
except Exception as e:
    print('  yadif fallback:', str(e)[:80])
    f = inter.astype(np.float32)
    even = f[0::2]
    below = np.vstack([even[1:], even[-1:]])
    f[1::2] = (even + below) / 2.0
    deint = asimg(f)
pair('interlace', inter_img, deint)

# 8 SAR 非方形像素被误解释（圆变椭圆）
wide = cv2.resize(cv2.cvtColor(asarr(chart).astype(np.uint8), cv2.COLOR_RGB2BGR),
                  (1066, H), interpolation=cv2.INTER_LINEAR)
stretched = wide[:, 133:933]
pair('sar', chart, Image.fromarray(cv2.cvtColor(stretched, cv2.COLOR_BGR2RGB), 'RGB'))

# 9 缩放算法
cpath = os.path.join(TMP, 'crop.png')
chart.crop((320, 290, 520, 402)).save(cpath)
near = ffimg('near.png', '-i', cpath, '-vf', 'scale=800:450:flags=neighbor', '-frames:v', '1')
lanc = ffimg('lanc.png', '-i', cpath, '-vf', 'scale=800:450:flags=lanczos', '-frames:v', '1')
pair('scale', near, lanc)

# 10 降噪
noisy = asimg(A + rng.normal(0, 20, (H, W, 1)))
noisy_path = os.path.join(TMP, 'noisy.png')
noisy.save(noisy_path)
den = ffimg('den.png', '-i', noisy_path, '-vf', 'hqdn3d=4:4:8:8', '-frames:v', '1')
pair('denoise', noisy, den)

# 11 eq 调色
eq = ffimg('eq.png', '-i', chart_path, '-vf',
           'eq=contrast=1.28:saturation=1.42:brightness=0.02', '-frames:v', '1')
pair('eq', chart, eq)

# 12 缩放后锐化
soft = ffimg('soft.png', '-i', chart_path, '-vf', 'scale=400:225,scale=800:450:flags=bicubic', '-frames:v', '1')
sharp = ffimg('sharp.png', '-i', chart_path, '-vf',
              'scale=400:225,scale=800:450:flags=bicubic,unsharp=5:5:2.2:5:5:0.0', '-frames:v', '1')
pair('sharpen', soft, sharp)

# 13 GIF / 256 色调色板量化
pal = os.path.join(TMP, 'palette.png')
ff('-i', chart_path, '-vf', 'palettegen=max_colors=32', '-frames:v', '1', pal)
giflike = ffimg('giflike.png', '-i', chart_path, '-i', pal, '-lavfi',
                '[0:v][1:v]paletteuse=dither=none', '-frames:v', '1')
pair('gif', chart, giflike)

# 14 旋转元数据（displaymatrix）
portrait = chart.crop((270, 0, 523, 450)).resize((450, 800), Image.LANCZOS)
lying = portrait.rotate(90, expand=True).resize((W, H), Image.LANCZOS)
upright = Image.new('RGB', (W, H), (18, 20, 24))
upright.paste(portrait.resize((253, 450), Image.LANCZOS), ((W - 253) // 2, 0))
pair('rotate', lying, upright)

# 15 / 16 压缩：CRF 与码率
pair('crf', crf18, crf40)
pair('bitrate', crf18, lowbr)

# ---- 输出 -----------------------------------------------------------------
GROUPS = [
    dict(id='resolution', ch='ch1', title='分辨率：1920×1080 → 降到 1/4 再放大',
         before='原图 800×450', after='降到 200×112 后放大回原尺寸',
         desc='分辨率决定画面能容纳多少空间细节。降低分辨率是不可逆的：放大回来只能靠插值猜，无法找回丢失的信息。',
         watch='看细网格、小字、棋盘格和山脊边缘——它们会糊成一团或出现锯齿；而大块天空、肤色几乎没变化。这解释了为什么「压缩率」高度依赖画面内容。',
         cmd='ffmpeg -i in.mp4 -vf scale=200:112 -c:v libx264 -crf 20 out.mp4',
         method='真实处理：ffmpeg scale=lanczos 降采样后再放大'),
    dict(id='interlace', ch='ch1', title='隔行扫描：梳齿 → 去隔行',
         before='隔行素材（奇偶场取自不同时刻）', after='yadif / bwdif 去隔行后',
         desc='隔行视频把一帧拆成奇数行场与偶数行场，且两场来自不同时刻。运动物体边缘会出现「拉丝」梳齿。',
         watch='看红蓝圆和斜线的边缘：改前是横向细密的锯齿条纹，改后边缘恢复连续。',
         cmd='ffmpeg -i in.ts -vf "bwdif=mode=send_frame:parity=auto:deint=all" out.mp4',
         method='真实处理：ffmpeg yadif（隔行帧由两个不同时刻的画面逐行合成）'),
    dict(id='sar', ch='ch1', title='像素宽高比 SAR：非方形像素被误解',
         before='正确比例', after='SAR 被按 1:1 解释（横向拉宽）',
         desc='播放器按 DAR = (宽/高) × SAR 决定显示比例。只改分辨率不重置 SAR，画面就会被拉伸变形。',
         watch='看太阳与红蓝圆：改后明显变成椭圆；文字也被拉宽。这类问题要查 ffprobe 的 sample_aspect_ratio，修复用 setsar=1。',
         cmd='ffmpeg -i in.mp4 -vf "scale=1920:1080,setsar=1" out.mp4',
         method='数学还原：模拟非方形像素被当作方形像素显示'),
    dict(id='chroma', ch='ch2', title='色度抽样：4:4:4 → 4:2:0（彩色细节特写，放大 2 倍）',
         before='4:4:4 每个像素都有完整颜色', after='4:2:0 每 2×2 像素共用一组色度',
         desc='人眼对亮度敏感、对颜色细节迟钝，所以 4:2:0 直接扔掉 3/4 的色度信息，体积省一半而亮度细节不变。它在风景、大色块上几乎无损，但在 1 像素彩色细线上会露馅——这里用专门测试图放大 2 倍。',
         watch='看 1px 红蓝细线、2px 红蓝棋盘和彩色小字：改后颜色被 2×2 平均成灰紫色、相邻颜色串在一起、笔画变脏；而底部灰阶条与黑白亮度细节完全不变——因为亮度 Y 被逐像素保留。这正是录屏、彩色字幕、UI 截图用 4:2:0 特别吃亏的原因。',
         cmd='ffmpeg -i in.mp4 -pix_fmt yuv420p out.mp4',
         method='按 4:2:0 定义做 2×2 色度块平均 + 最近邻还原，彩色细节特写放大 2 倍'),
    dict(id='bitdepth', ch='ch2', title='位深：8 bit 平滑渐变 → 低位深量化色带',
         before='8 bit（256 级，带轻微抖动）', after='量化到 16 级（无抖动）',
         desc='位深决定明暗过渡有多少级台阶。级数不够时，天空、暗部、渐变会出现一圈圈色带（banding）。',
         watch='看上下两条渐变：改后出现清晰的阶梯状色块。10 bit 有 1024 级，能大幅缓解；降位深时加 dither 也能打散色带。',
         cmd='ffmpeg -i hdr.mkv -vf "zscale=d=ordered,format=yuv420p" out.mp4',
         method='真实量化：把 8 bit 值量化到 4 bit 台阶（放大演示原理）'),
    dict(id='range', ch='ch2', title='色彩范围：正常 → limited/full 误标发灰',
         before='正确解释（黑 0、白 255）', after='被当作 limited range 解释（黑抬到 16、白压到 235）',
         desc='视频常用 limited range（16–235），电脑图片用 full range（0–255）。同一串像素值被标错范围，画面就会整体发灰、对比度下降或黑位死黑。',
         watch='看整体：改后黑色变灰、白色不够亮、画面像蒙了一层雾。这是「转码后颜色变淡」的第一嫌疑，且不会被锐化或调饱和度修好。',
         cmd='ffmpeg -i in.mp4 -vf "scale=in_range=pc:out_range=tv" -color_range tv out.mp4',
         method='数学还原：按 16–235 映射重新解释 full range 像素值'),
    dict(id='matrix', ch='ch2', title='色彩矩阵：正确 → BT.601/2020 错配偏色',
         before='正确矩阵', after='按另一套 YUV↔RGB 矩阵解释',
         desc='YUV 数值必须配一套矩阵系数才能还原成 RGB。SD 用 BT.601、HD 用 BT.709、UHD 用 BT.2020，标签写错就会整体偏色。',
         watch='对比八个大色块：改后饱和色整体偏移（红偏橙、蓝偏紫、肤色发青发绿），而中间的灰阶条保持中性、几乎不变——「彩色变、灰色不变」正是矩阵错配的典型特征。',
         cmd='ffmpeg -i in.mp4 -vf "zscale=p=bt709:t=bt709:m=bt709" -colorspace bt709 out.mp4',
         method='数学还原：BT.601 编码后用 BT.2020 逆矩阵解码'),
    dict(id='hdr', ch='ch2', title='HDR：PQ 被当 gamma 解释 → 正确色调映射',
         before='PQ 码值被直接当 SDR 显示（发灰发白）', after='zscale + tonemap 正确映射到 SDR',
         desc='HDR 用 PQ（SMPTE ST 2084）曲线编码绝对亮度，与 SDR 的 gamma 完全不同。把 HDR 片源直接套普通转码模板，画面会一片灰白、像蒙了雾。',
         watch='改前对比度极低、高光糊成一片、暗部抬亮；改后层次恢复。真实流程还需要 10 bit、BT.2020 与元数据配合。',
         cmd='ffmpeg -i hdr.mkv -vf "zscale=t=linear:npl=100,tonemap=tonemap=hable,zscale=t=bt709:m=bt709:r=tv,format=yuv420p" sdr.mp4',
         method='数学还原：真实 PQ 编码 + Reinhard 色调映射，对比两种解码曲线'),
    dict(id='crf', ch='ch3', title='CRF 18 → CRF 40：恒定质量参数',
         before='CRF 18（高质量，文件大）', after='CRF 40（低质量，文件小）',
         desc='CRF 控制量化步长：数值越大，丢掉的高频细节越多，文件越小。两边都是同一帧、同一编码器（libx264 medium）解码出来的真实画面。',
         watch='看草地纹理被抹平、细字边缘出现振铃、灰阶渐变出现色带、山脊变糊，以及大面积平坦区域的块状效应。注意损失分布不均：大面积平滑区几乎没变，纹理区惨不忍睹。',
         cmd='ffmpeg -i in.mp4 -c:v libx264 -crf 40 -preset medium -pix_fmt yuv420p out.mp4',
         method='真实编码：30 帧运动序列经 libx264 -crf 18 / -crf 40 编码后解码同一帧'),
    dict(id='bitrate', ch='ch3', title='码率：高质量 → 170 kbps 极低码率',
         before='CRF 18 的正常码率', after='强制 170 kbps（约 1/20 体积）',
         desc='码率是「每秒允许用多少比特」。预算不够时，编码器只能把量化步长调大，用块效应和糊化换取体积。',
         watch='改后出现明显的 8×8 / 16×16 方块、色块渗色、边缘蚊子噪声，运动区域最严重。这说明「码率 ≠ 画质」：同样的码率拍访谈够用，拍这种满屏纹理就崩。',
         cmd='ffmpeg -i in.mp4 -c:v libx264 -b:v 170k -maxrate 170k -bufsize 340k out.mp4',
         method='真实编码：libx264 -b:v 170k（VBV 约束）编码后解码同一帧'),
    dict(id='scale', ch='ch8', title='缩放算法：nearest → lanczos',
         before='flags=neighbor 最近邻放大', after='flags=lanczos 兰索斯放大',
         desc='同样的 4 倍放大，算法决定「新像素该填什么值」。最近邻直接复制，边缘呈锯齿；lanczos 做多抽头重建，更锐利但可能有轻微振铃。',
         watch='看斜线与细网格：改前是硬阶梯状马赛克，改后过渡平滑且细节保留更多。缩放文字、线条素材时算法差异最明显。',
         cmd='ffmpeg -i in.mp4 -vf "scale=1920:1080:flags=lanczos" out.mp4',
         method='真实处理：同一局部用 ffmpeg scale 的 neighbor / lanczos 各放大 4 倍'),
    dict(id='denoise', ch='ch8', title='降噪：高斯噪点 → hqdn3d',
         before='带噪点的画面', after='hqdn3d 时域+空域降噪后',
         desc='噪点是最「贵」的内容：它全是高频随机细节，编码器会浪费大量码率去保留它。先降噪再编码，常能在同画质下显著减小体积。',
         watch='改后草地与天空的颗粒被抹平；但细字和网格的边缘也会轻微变软。降噪永远是在「去掉噪声」和「保留细节」之间取舍。',
         cmd='ffmpeg -i in.mp4 -vf "hqdn3d=4:4:8:8" -c:v libx264 -crf 20 out.mp4',
         method='真实处理：ffmpeg hqdn3d 滤镜'),
    dict(id='eq', ch='ch8', title='调色：原图 → eq 对比度/饱和度',
         before='原始画面', after='eq contrast=1.28 saturation=1.42',
         desc='eq 滤镜直接改像素的亮度、对比度、饱和度、gamma。它作用在解码后的原始帧上，属于滤镜工位，所以必须重编码。',
         watch='改后天空更浓、草地更绿、山体对比更强；同时注意灰阶条两端被压到纯黑纯白——调色过头会丢掉暗部与高光细节（不可逆）。',
         cmd='ffmpeg -i in.mp4 -vf "eq=contrast=1.28:saturation=1.42:brightness=0.02" out.mp4',
         method='真实处理：ffmpeg eq 滤镜'),
    dict(id='sharpen', ch='ch8', title='锐化：缩放后发糊 → unsharp',
         before='缩小再放大后的软画面', after='叠加 unsharp 锐化',
         desc='unsharp 通过「原图 − 模糊图」把边缘差值加回去，让轮廓更清楚。它不能创造不存在的细节，过度锐化会产生白边光晕。',
         watch='看细字、网格与山脊：改后轮廓更清晰，但边缘会出现轻微亮边/暗边光晕。锐化建议放在缩放之后、编码之前。',
         cmd='ffmpeg -i in.mp4 -vf "scale=1280:-2:flags=lanczos,unsharp=5:5:1.0" out.mp4',
         method='真实处理：同一缩放链加 / 不加 ffmpeg unsharp'),
    dict(id='gif', ch='ch10', title='GIF 调色板：真彩 → 32 色量化（放大演示）',
         before='原图（约 1600 万色）', after='palettegen=max_colors=32 + paletteuse，无抖动',
         desc='GIF 每帧最多 256 色。直接转 GIF 会颜色失真，正确做法是先 palettegen 生成调色板，再用 paletteuse 映射。为让色带看得清楚，这里把调色板压到 32 色（色数越少，色带越明显）。',
         watch='看天空渐变和灰阶条出现明显的一圈圈色带、草地颜色分层。加抖动（dither=sierra2_4a4）能打散色带但会引入颗粒。做网页动效更推荐静音 MP4/WebM。',
         cmd='ffmpeg -i in.mp4 -vf "split[a][b];[a]palettegen[p];[b][p]paletteuse" -loop 0 out.gif',
         method='真实处理：ffmpeg palettegen=max_colors=32 + paletteuse=dither=none'),
    dict(id='rotate', ch='ch4', title='旋转元数据：未应用 → 应用 displaymatrix',
         before='手机竖拍画面被当横屏直接显示', after='按 displaymatrix 旋转 90° 后正确显示',
         desc='手机竖拍的视频文件里往往仍是横向像素，只附带一条「请旋转 90° 再显示」的元数据。FFmpeg 转码时默认 autorotate 会物理旋转像素并清掉标记；-c copy 则原样保留标记。',
         watch='改前内容躺倒且被拉伸填满；改后竖立并以黑边保持比例。传到不读旋转标记的平台就会变成改前的样子。',
         cmd='ffmpeg -noautorotate -i in.mp4 -metadata:s:v rotate=0 out.mp4',
         method='数学还原：同一竖屏内容在「读/不读旋转元数据」两种解释下的显示结果'),
]

# 保存 webp 与 manifest
manifest = []
total = 0
for g in GROUPS:
    pid = g['id']
    if pid not in pairs:
        raise RuntimeError('missing pair: ' + pid)
    for side, img in zip(('before', 'after'), pairs[pid]):
        name = '%s_%s.webp' % (pid, side)
        p = os.path.join(OUT, name)
        img.save(p, 'WEBP', quality=88, method=4)
        total += os.path.getsize(p)
        g[side + '_img'] = name
    manifest.append(g)
    print('  %-12s %6.1f KB' % (pid, (os.path.getsize(os.path.join(OUT, g['before_img'])) +
                                      os.path.getsize(os.path.join(OUT, g['after_img']))) / 1024))

with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print('\n%d groups, %d images, total %.2f MB' % (len(manifest), len(manifest) * 2, total / 1024 / 1024))
