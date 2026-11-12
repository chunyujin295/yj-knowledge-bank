# FFmpeg 命令速查卡

> 知识库位置：[YJ Knowledge Bank 首页](../../index.html) · [本主题索引](./README.md) · [主教程](./FFmpeg前置视频知识完全指南.html)
>
> 配套阅读：`FFmpeg前置视频知识完全指南.html`（讲原理）
> 本文件只放「查了就能用」的东西。命令在 FFmpeg 6.x / 7.x 通用；Windows 下把 `/dev/null` 换成 `NUL`。
> **想看参数改变前后的真实画面**：打开 HTML 教程第 13 章「视觉效果对比图鉴」，16 组可拖动的前后对比图（CRF、码率、色度抽样、色带、色彩范围、矩阵偏色、HDR、缩放算法、去隔行、降噪、调色、锐化、GIF 色带、旋转等）。

---

## 0. 三条心法

1. **流水线**：`输入 → 解封装 → 解码 → 滤镜 → 编码 → 封装 → 输出`。`-c copy` 跳过中间三格，所以不能改画面。
2. **选项作用域**：每个选项只作用于它后面紧跟的那个文件。写在 `-i` 前 = 怎么读；写在输出前 = 怎么生成。
3. **三个问题**：这个参数改的是「像素 / 时间 / 字节封装」？作用在哪一格？播放器需要什么才能解释它？

---

## 1. 概念与参数对照（一张表回忆全部）

| 层 | 关键词 | 典型参数 / 字段 |
|---|---|---|
| 时间 | 帧率、VFR、时间戳 | `-r`、`fps=30`、`-fps_mode cfr`、`PTS/DTS`、`time_base`、`setpts` |
| 空间 | 分辨率、DAR/SAR、偶数尺寸 | `scale=1280:-2`、`crop`、`pad`、`setsar=1`、`-aspect` |
| 色彩 | pix_fmt、位深、色域、范围 | `-pix_fmt yuv420p`、`format=`、`zscale`、`-color_*`、`-color_range` |
| 压缩 | 编码器、CRF、GOP、I/P/B | `-c:v libx264 -crf 21 -preset slow`、`-g`、`-bf`、`-tune` |
| 封装 | 容器、流、索引、元数据 | `-map`、`-f`、`-movflags +faststart`、`-metadata`、`-disposition` |
| 音频 | 采样率、声道、响度、同步 | `-ar 48000 -ac 2`、`volume`、`loudnorm`、`atempo`、`-shortest` |
| 画面 | 滤镜链 / 滤镜图 | `-vf`、`-af`、`-filter_complex`、`[0:v]`、`[v]` |

**换算**：文件 MB ≈ 码率 Mbps × 秒数 ÷ 8｜1 字节 = 8 比特｜`1/90000` 时间基下 PTS 4500 = 0.05 秒
**原始数据量**：1920×1080、YUV420、8 bit、30 fps ≈ 3.11 MB/帧 ≈ 747 Mbps

---

## 2. 参数速查

| 参数 | 作用 | 常见值 |
|---|---|---|
| `-i` | 输入文件 | 可多次使用 |
| `-map` | 选流 | `0:v:0`、`0:a:0?`（`?` 表示可选）、`-map 0`（全部） |
| `-c` / `-c:v` / `-c:a` | 编码器 | `copy`、`libx264`、`libx265`、`libsvtav1`、`aac`、`flac` |
| `-crf` | 恒定质量 | x264: 18≈近无损 / 21 均衡 / 23 默认 / 28 明显压缩；x265 默认 28；±6 ≈ 码率翻倍或减半 |
| `-preset` | 速度↔效率 | `ultrafast … medium(默认) … veryslow`；不改画质，改体积/耗时 |
| `-tune` | 内容/场景调优 | `film` `animation` `grain` `stillimage` `fastdecode` `zerolatency` |
| `-b:v` / `-maxrate` / `-bufsize` | 码率 / VBV 上限 / 缓冲 | 推流：`-b:v 4000k -maxrate 4000k -bufsize 8000k` |
| `-pix_fmt` | 像素格式 | **交付一律 `yuv420p`**；HDR/中间用 `yuv420p10le` |
| `-profile:v` / `-level:v` | 兼容性 | `baseline`/`main`/`high`，`4.1` |
| `-g` / `-keyint_min` / `-sc_threshold 0` | 固定 GOP | HLS 必配，如 `-g 60 -keyint_min 60 -sc_threshold 0` |
| `-r` / `fps=` | 输出帧率 / 帧率滤镜 | 精调用滤镜，`-r` 会丢/重复帧 |
| `-fps_mode` | 帧率模式 | `cfr` `vfr` `passthrough` `drop`（旧版 `-vsync`） |
| `-ss` / `-t` / `-to` / `-sseof` | 定位 / 时长 / 终点 / 倒数 | `-ss` 在 `-i` 前快，在后精确 |
| `-vf` / `-af` / `-filter_complex` | 滤镜 | 复杂图用 `[0:v]…[v]` + `-map "[v]"` |
| `-an` / `-vn` / `-sn` / `-dn` | 禁用某类流 | |
| `-shortest` | 以最短流收尾 | 配乐、拼接必加 |
| `-movflags +faststart` | MP4 索引前置 | 网页边下边播必加 |
| `-y` / `-n` / `-hide_banner` / `-loglevel` / `-nostdin` / `-stats` | 全局控制 | **脚本里 `-nostdin` 必加** |
| `-re` | 按真实速度读输入 | 推流必加 |
| `-hwaccel` / `-c:v h264_nvenc` | 硬解 / 硬编 | NVENC 用 `-cq 23 -b:v 0` 代替 CRF |

---

## 3. 命令模板

```bash
# 体检（动手前永远先跑这个）
ffprobe -v error -show_format -show_streams -of json in.mp4
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,level,width,height,pix_fmt,r_frame_rate,avg_frame_rate,bit_rate,color_range,color_space,color_transfer,color_primaries -of json in.mp4

# 万能交付：H.264 + AAC + MP4
ffmpeg -i in.ANY -map 0:v:0 -map 0:a:0? \
  -c:v libx264 -crf 21 -preset slow -pix_fmt yuv420p -profile:v high \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart out.mp4

# 无损换容器 / 网页秒开 / TS→MP4
ffmpeg -i in.mkv -map 0 -c copy out.mp4
ffmpeg -i in.mp4 -map 0 -c copy -movflags +faststart web.mp4
ffmpeg -i in.ts -map 0 -c copy -bsf:a aac_adtstoasc out.mp4

# 精确剪切（重编码） / 快速粗剪（对齐关键帧）
ffmpeg -ss 00:01:23.500 -i in.mp4 -t 30 -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -c:a aac clip.mp4
ffmpeg -ss 00:01:23 -i in.mp4 -t 30 -map 0 -c copy -avoid_negative_ts make_zero clip.mp4

# 拼接：同参数用 demuxer（无损极快）；不同参数用 concat 滤镜
printf "file 'a.mp4'\nfile 'b.mp4'\n" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -map 0 -c copy merged.mp4
ffmpeg -i a.mp4 -i b.mp4 -filter_complex \
  "[0:v]setpts=PTS-STARTPTS,fps=30,scale=1920:1080,setsar=1[v0];[0:a]asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a0];\
   [1:v]setpts=PTS-STARTPTS,fps=30,scale=1920:1080,setsar=1[v1];[1:a]asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a1];\
   [v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -crf 20 -c:a aac merged.mp4

# 抽取
ffmpeg -i in.mp4 -vn -c:a copy audio.m4a
ffmpeg -i in.mp4 -an -c:v copy silent.mp4
ffmpeg -ss 10 -i in.mp4 -frames:v 1 cover.jpg
ffmpeg -i in.mp4 -vf fps=1 -q:v 2 thumb_%04d.jpg
ffmpeg -i in.mp4 -vf "fps=1/10,scale=320:-2,tile=5x5" -frames:v 1 sheet.jpg
ffmpeg -i in.mkv -map 0:s:0 sub.ass

# 图片序列 → 视频 / 静帧 + 音频 → 视频
ffmpeg -framerate 25 -i img_%04d.png -c:v libx264 -crf 18 -pix_fmt yuv420p out.mp4
ffmpeg -loop 1 -i cover.jpg -i audio.m4a -c:v libx264 -tune stillimage -c:a aac -pix_fmt yuv420p -shortest out.mp4

# 缩放 / 保持比例补黑边 / 裁切 / 旋转 / 去隔行
ffmpeg -i in.mp4 -vf "scale=1280:-2:flags=lanczos,setsar=1" -c:v libx264 -crf 20 -c:a copy out.mp4
ffmpeg -i in.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" out.mp4
ffmpeg -i in.mp4 -vf "crop=1280:720:320:180" out.mp4
ffmpeg -i in.mp4 -vf "transpose=1" out.mp4
ffmpeg -i in.ts -vf "bwdif=mode=send_frame:parity=auto:deint=all" out.mp4

# 水印 / 画中画 / 文字 / 淡入淡出
ffmpeg -i in.mp4 -i logo.png -filter_complex "[1:v]format=rgba,scale=160:-2,colorchannelmixer=aa=0.7[wm];[0:v][wm]overlay=W-w-20:H-h-20[v]" -map "[v]" -map 0:a:0 -c:v libx264 -crf 21 -c:a copy out.mp4
ffmpeg -i main.mp4 -i pip.mp4 -filter_complex "[1:v]scale=320:-2[pip];[0:v][pip]overlay=W-w-20:H-h-20[out]" -map "[out]" -map 0:a:0 -c:v libx264 -crf 20 -c:a copy out.mp4
ffmpeg -i in.mp4 -vf "drawtext=text='demo':x=20:y=20:fontsize=32:fontcolor=white:box=1:boxcolor=black@0.5,fade=t=in:st=0:d=1" out.mp4

# 字幕：软字幕 / 硬字幕（MP4 不支持 ass 软字幕，用 MKV 或 mov_text）
ffmpeg -i in.mkv -i zh.ass -map 0 -map 1 -c copy -c:s ass -metadata:s:s:0 language=chi out.mkv
ffmpeg -i in.mp4 -i zh.srt -map 0 -map 1 -c copy -c:s mov_text out.mp4
ffmpeg -i in.mp4 -vf "subtitles=zh.srt:force_style='FontName=Microsoft YaHei,FontSize=22'" -c:v libx264 -crf 20 -c:a copy out.mp4
# 路径带盘符时用相对路径，或转义冒号：subtitles='C\:/sub/a.srt'

# 音频：音量 / 响度归一化 / 延迟 / 变速不变调 / 混音
ffmpeg -i in.mp4 -af "volume=6dB" -c:v copy out.mp4
ffmpeg -i in.mp4 -af loudnorm -c:v copy out.mp4
ffmpeg -i in.mp4 -af "adelay=300|300" -c:v copy out.mp4
ffmpeg -i in.mp4 -filter_complex "[0:v]setpts=PTS/0.8[v];[0:a]atempo=0.8[a]" -map "[v]" -map "[a]" slow.mp4
ffmpeg -i voice.m4a -i bgm.mp3 -filter_complex "[1:a]volume=0.2[bg];[0:a][bg]amix=inputs=2:duration=first:normalize=0[a]" -map "[a]" -c:a aac mix.m4a

# GIF（必须先生成调色板）
ffmpeg -i in.mp4 -vf "fps=12,scale=480:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer" -loop 0 out.gif

# 两遍编码（精确控制体积）
ffmpeg -y -i in.mp4 -c:v libx264 -b:v 4M -preset slow -pass 1 -an -f null /dev/null
ffmpeg    -i in.mp4 -c:v libx264 -b:v 4M -preset slow -pass 2 -c:a aac -b:a 160k out.mp4

# 推流 / HLS
ffmpeg -re -i in.mp4 -c:v libx264 -preset veryfast -tune zerolatency -b:v 4000k -maxrate 4000k -bufsize 8000k -g 60 -keyint_min 60 -sc_threshold 0 -pix_fmt yuv420p -c:a aac -b:a 128k -f flv rtmp://server/live/key
ffmpeg -i in.mp4 -c:v libx264 -crf 21 -g 60 -keyint_min 60 -sc_threshold 0 -c:a aac -b:a 128k -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_filename "seg_%03d.ts" playlist.m3u8

# 质量对比 / 检测
ffmpeg -i out.mp4 -i ref.mp4 -lavfi psnr -f null -
ffmpeg -i out.mp4 -i ref.mp4 -lavfi ssim -f null -
ffmpeg -i in.mp4 -vf cropdetect=24:16:0 -f null -
ffmpeg -i in.mp4 -af "silencedetect=noise=-40dB:d=1" -f null -

# 生成练手素材 / 看帮助
ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 -f lavfi -i sine=frequency=440:duration=10 -c:v libx264 -c:a aac demo.mp4
ffmpeg -h encoder=libx264 ; ffmpeg -h filter=scale ; ffmpeg -buildconf
```

---

## 4. ffprobe 诊断速查

```bash
ffprobe -v error -select_streams v:0 -show_entries packet=pts_time,dts_time,duration_time,size,flags -of csv=p=0 in.mp4
ffprobe -v error -select_streams v:0 -skip_frame nokey -show_entries frame=best_effort_timestamp_time -of csv=p=0 in.mp4
ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 in.mp4
ffprobe -v error -read_intervals 00:01:00%+5 -show_packets -of compact in.mp4
ffprobe -v error -show_chapters -of json in.mkv
```

**字段判读**：`r_frame_rate ≠ avg_frame_rate` → VFR｜`nb_frames=N/A` → 用 `-count_frames`｜`side_data_list.displaymatrix` → 旋转｜`color_transfer=smpte2084` 或 `color_primaries=bt2020` → HDR｜`pix_fmt` 不是 `yuv420p` → 兼容性风险｜`start_time < 0` → 同步风险。

---

## 5. 报错 → 一句话修复

| 报错 / 现象 | 修复 |
|---|---|
| `not divisible by 2` | `scale=1280:-2` 或 `crop=trunc(iw/2)*2:trunc(ih/2)*2` |
| `Non-monotonous DTS` | `setpts=PTS-STARTPTS`、统一 `-video_track_timescale`、`-fflags +genpts` |
| `moov atom not found` | 文件不完整，重新下载/重新录制（普通转码救不回） |
| `Could not find tag for codec ...` | 换 MKV 容器，或把该流重编码 |
| `Impossible to convert between the formats` | 插 `format=yuv420p`；硬件路径补 `hwdownload` |
| `Filter ... has an unconnected output` | 给输出贴标签并 `-map "[v]"` |
| `Invalid stream specifier` | `ffprobe -show_streams` 核对；可选流用 `-map 0:a:0?` |
| `Subtitle codec 'ass' ... not supported` | 输出 MKV / 转 `mov_text` / 烧录 |
| `Too many packets buffered` | `-max_muxing_queue_size 1024` + 修时间戳 |
| 颜色发灰 | `scale=in_range=pc:out_range=tv` 或 `zscale=r=limited`，再打 `-color_range tv` |
| HDR 转完灰白 | 用 `zscale + tonemap` 做色调映射，别套 SDR 模板 |
| 别人播放黑屏 | `-c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.1` |
| 剪切开头黑屏 | 去掉 `-c copy` 重编码，或对齐关键帧 |
| 音画不同步 | `-fps_mode cfr -vf fps=30`、`aresample=async=1:first_pts=0`、`-itsoffset` |
| 网页要下载完才播 | `-c copy -movflags +faststart` |
| 输出比输入大 | 提高 CRF、换更慢 preset、或直接 copy |
| 批处理只跑第一个 | 加 `-nostdin` |
| 滤镜没生效 | 同时写了 `-c copy`，或选项位置错了 |
| 推流瞬间结束 | 加 `-re` |
| `Conversion failed!` | 真因在上面 20–50 行；`-loglevel verbose` 或 `-report` |

---

## 6. 决策树

```
要改画面/声音内容（缩放、滤镜、字幕烧录、音量、帧率、编码器）？
  ├─ 是 → 必须重编码：-c:v libx264 ... -c:a aac ...
  └─ 否 → -c copy（换容器、抽流、改元数据、faststart、粗剪）
            └─ 目标容器支持源编码吗？不支持 → 换 MKV 或转该流

选编码器：
  交付给所有人 → H.264 (libx264) + yuv420p + MP4
  4K/HDR 且能接受兼容性 → H.265 (libx265) + MKV/MP4
  网页、免版税 → AV1 (libsvtav1) / VP9 + WebM
  多次剪辑的中间文件 → ProRes / DNxHR / FFV1（帧内、无损或近无损）

选质量参数：
  没有体积限制 → -crf 18~21 -preset slow
  要控制最终大小 → 两遍 -b:v
  实时/直播 → -preset veryfast -tune zerolatency -maxrate/-bufsize + 固定 GOP
  GPU 批量 → h264_nvenc / h264_qsv + -cq 23 -b:v 0（同码率画质略逊于 x264）

遇到怪问题：
  ffprobe 看字段 → ffplay 确认源文件 → 命令砍到最小逐段加 → -loglevel verbose → -report
```

---

## 7. 缩写速记

`fps` 帧率｜`VFR/CFR` 可变/恒定帧率｜`SAR/DAR` 像素/显示宽高比｜`YUV` 亮度+色度｜`pix_fmt` 像素格式｜`GOP` 图像组｜`IDR` 可独立解码的关键帧｜`PTS/DTS` 显示/解码时间戳｜`CRF` 恒定质量因子｜`VBV` 码率缓冲控制｜`QP` 量化参数｜`mux/demux` 封装/解封装｜`remux` 转封装｜`LUFS` 响度单位｜`dBTP` 真峰值｜`bsf` 码流过滤器｜`VMAF/PSNR/SSIM` 画质评价指标
