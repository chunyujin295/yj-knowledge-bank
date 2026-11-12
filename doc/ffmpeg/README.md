# FFmpeg 前置视频知识 · 主题索引

这份资料回答的是「学 FFmpeg 之前，先要懂哪些视频参数」。它属于**多媒体方向的前置知识**，与仓库里 FPlayer 系列的工程实践文档形成「基础 → 应用」的关系。

## 入口

| 文件 | 用途 |
|---|---|
| [FFmpeg前置视频知识完全指南.html](./FFmpeg前置视频知识完全指南.html) | 主教程，14 章。从帧、分辨率、色彩、压缩、容器、时间戳讲到滤镜图、ffprobe 与实战配方；含 16 组可拖动的参数前后效果对比图鉴 |
| [ffmpeg-命令速查卡.md](./ffmpeg-命令速查卡.md) | 命令行速查：参数含义、命令模板、报错对照、决策树 |
| [FFmpeg效果对比示例-CRF18-vs-40.png](./FFmpeg效果对比示例-CRF18-vs-40.png) | 单张示例图，不打开教程也能看到「改前 / 改后」 |

主教程是**自包含单文件**：32 张对比图以 base64 内嵌，拷走任意一个 HTML 都能离线打开。它没有接入 `assets/css/kb-design-system.css` 与 `kb-design-system.js`，因为页面自带侧栏目录与对比滑块组件，接入共享外壳会产生双导航并覆盖对比图相关样式；与全站的连接通过页面顶部的「返回首页 / 相关阅读」链接和首页入口卡片完成。

## 关联

- **上游（本主题）**：视频参数体系 → 编码/容器/时间戳 → FFmpeg 命令与滤镜图。
- **下游（应用）**：
  - [FPlayer Desktop · 技术全景教程](../FPlayer-Desktop-技术全景教程.html) — 音视频编解码与硬解码渲染管线
  - [fplayer-ff-mobile 技术全解](../FPlayer-FF-Mobile-技术全景教程.html) — HLS / HTTP-FLV / RTMP 的移动端拉流
  - [FPlayer FF Service · 技术全景教程](../FPlayer-FF-Service-技术全景教程.html) — 服务端 RTMP 到多协议的转封装
- **首页入口**：`index.html` 的「多媒体」分类下，编号 DOC.016。

建议顺序：先读本教程第 1–4 章建立参数体系，再进入 FPlayer 系列看这些参数在真实播放器/服务端里如何落地。

## 目录

```
doc/ffmpeg/
├── README.md                              本索引
├── FFmpeg前置视频知识完全指南.html         主教程（自包含，约 2.3 MB）
├── ffmpeg-命令速查卡.md                   速查卡
├── FFmpeg效果对比示例-CRF18-vs-40.png     示例图
└── assets/
    ├── manifest.json                      16 组对比的标题、观察要点、命令与生成方式
    ├── make_images.py                     生成 32 张对比图（需要 ffmpeg / Pillow / NumPy / OpenCV）
    ├── embed_assets.py                    把图片内嵌进主教程 HTML（幂等，可重复运行）
    └── *_before.webp / *_after.webp       32 张对比图
```

## 重新生成对比图

在本目录依次运行：

```bash
python assets/make_images.py     # 真实 ffmpeg 编码 / 滤镜处理，生成图片与 manifest
python assets/embed_assets.py    # 把图片内嵌进 HTML，保持单文件
```

改 `make_images.py` 里的参数（例如把 CRF 40 换成 32、调整调色板色数），重跑这两条命令就能得到新的对比图鉴。生成脚本按自身位置推算根目录，因此必须保留上述目录结构。
