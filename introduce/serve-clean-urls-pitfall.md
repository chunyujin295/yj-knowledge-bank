# serve v14 Clean URLs 部署踩坑记录

## 现象

站点部署到服务器后，首页 `index.html` 可以正常打开，但点击任何内部链接跳转到 `doc/` 下的子页面时报 404。

具体表现：

```
首页:     https://codis.fun/yj-knowledge-bank/          → 正常
点击链接: https://codis.fun/yj-knowledge-bank/doc/network-tutorial.html
          → 浏览器地址栏变为 https://codis.fun/doc/network-tutorial
          → 404
```

**关键特征**：浏览器地址栏中的 URL 丢失了 `/yj-knowledge-bank/` 前缀。

## 部署架构

```
用户浏览器 (公网)
    │  https://codis.fun/yj-knowledge-bank
    ▼
┌──────────────────────────────┐
│  云服务器 (有公网IP)           │
│  ┌────────────────────────┐  │
│  │  Nginx                  │  │
│  │  location /yj-knowledge-bank/ {
│  │    proxy_pass http://127.0.0.1:5004/;
│  │  }                      │  │
│  └───────────┬────────────┘  │
│              │               │
│  ┌───────────▼────────────┐  │
│  │  frps (frp server)      │  │
│  │  remotePort: 5004       │  │
│  └───────────┬────────────┘  │
└──────────────┼───────────────┘
               │  frp 隧道
┌──────────────┼───────────────┐
│  物理机 (内网 Linux)          │
│  ┌───────────▼────────────┐  │
│  │  frpc (frp client)      │  │
│  │  localPort: 5004        │  │
│  └───────────┬────────────┘  │
│              │               │
│  ┌───────────▼────────────┐  │
│  │  npx serve . -p 5004    │  │
│  │  (静态文件服务器)         │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

## 排查过程

### 第一步：验证 serve 本地响应

```bash
curl -I http://127.0.0.1:5004/doc/network-tutorial.html
```

输出：

```
HTTP/1.1 301 Moved Permanently
Location: /doc/network-tutorial
```

**关键发现**：serve 返回的是 `301` 重定向，而不是 `200 OK`。

### 第二步：分析重定向路径

serve 的 301 响应中 `Location` 头是 `/doc/network-tutorial`（根路径），但站点实际部署在 `/yj-knowledge-bank/` 子路径下。

浏览器收到 `301 Location: /doc/network-tutorial` 后的行为：

```
当前页面: https://codis.fun/yj-knowledge-bank/
点击链接: doc/network-tutorial.html
    → 浏览器请求 GET /yj-knowledge-bank/doc/network-tutorial.html
    → Nginx 代理到 serve: GET /doc/network-tutorial.html
    → serve 返回 301 Location: /doc/network-tutorial    ← 根路径！
    → 浏览器解析为 https://codis.fun/doc/network-tutorial ← 丢失前缀
    → Nginx 无匹配 location
    → 404
```

### 第三步：定位根因 — serve v14 Clean URLs

serve v14 默认开启了 **Clean URLs** 功能：

> 当请求 `/foo.html` 时，serve 自动 301 重定向到 `/foo`（去掉 `.html` 后缀）。

问题在于这个重定向的 `Location` 头是**根绝对路径**（以 `/` 开头），不感知 Nginx 反向代理时的路径前缀。当前端有 Nginx 做路径改写时，浏览器收到的重定向目标就是错误的。

## 解决方案

在项目根目录创建 `serve.json`，禁用 Clean URLs：

```json
{
  "cleanUrls": false
}
```

效果：

```
禁用前: GET /doc/network-tutorial.html → 301 → /doc/network-tutorial → 404
禁用后: GET /doc/network-tutorial.html → 200 → 直接返回文件内容
```

## 为什么不用 CLI 参数？

serve 的 `--no-clean-urls` 参数在某些版本中不可用（报错 `ARG_UNKNOWN_OPTION`）。`serve.json` 配置文件是 serve v14 官方支持的稳定配置方式。

## 关键配置清单

| 文件 | 作用 |
|------|------|
| [package.json](../package.json) | `"start": "serve -s . -p 5004"`，`-s` 为 SPA fallback |
| [serve.json](../serve.json) | `{ "cleanUrls": false }`，禁用 .html 后缀重定向 |
| Nginx `proxy_pass` | 末尾必须有 `/`，即 `proxy_pass http://127.0.0.1:5004/;` |

### Nginx proxy_pass 尾部斜杠的坑（补充）

```
proxy_pass http://127.0.0.1:5004/;    ← 有 / : 正确，去掉 location 前缀
proxy_pass http://127.0.0.1:5004;     ← 无 / : 错误，保留完整 URI 路径
```

| 请求 | 有 `/` (正确) | 无 `/` (错误) |
|------|--------------|--------------|
| `/yj-knowledge-bank/doc/x.html` | 代理到 `/doc/x.html` ✅ | 代理到 `/yj-knowledge-bank/doc/x.html` ❌ |

## 验证

部署更新后，确认 serve 直接返回 200 而非 301：

```bash
curl -I http://127.0.0.1:5004/doc/network-tutorial.html
# HTTP/1.1 200 OK
```

## 总结

> 当静态站点部署在 Nginx 反向代理的子路径下时，serve v14 的 Clean URLs 功能会造成重定向路径丢失前缀的问题。通过 `serve.json` 设置 `"cleanUrls": false` 禁用该特性即可解决。
