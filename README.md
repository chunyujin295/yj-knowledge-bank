<p align="center">
  <img src="./img/icons/icon1.png" alt="icon" width="200">
</p>

# yj-knowledge-bank

个人计算机知识查缺补漏的 AI 知识库。

借助 Claude Code 梳理和沉淀计算机基础知识的深度指南，每份文档针对一个技术主题做系统性的底层原理讲解，弥补知识盲区。

## 使用方式

```
拉取 → 用 Claude Code 打开 → /init → 随时查阅和扩充
```

## 部署指南

### 架构总览

```
用户浏览器 (公网)
    │
    │  https://codis.fun/yj-knowledge-bank
    ▼
┌──────────────────────────────────┐
│        云服务器 (有公网IP)         │
│  ┌────────────────────────────┐  │
│  │  Nginx                      │  │
│  │  - SSL/TLS 终止              │  │
│  │  - /yj-knowledge-bank       │  │
│  │    反向代理到 frps 本地端口    │  │
│  └───────────┬────────────────┘  │
│              │                   │
│  ┌───────────▼────────────────┐  │
│  │  frps (frp server)          │  │
│  │  - 监听 frp 端口 (7000)      │  │
│  │  - 接收来自 frpc 的隧道       │  │
│  └───────────┬────────────────┘  │
└──────────────┼───────────────────┘
               │  frp 隧道
               │  穿透 NAT
┌──────────────┼───────────────────┐
│      物理机 (内网 Linux)          │
│  ┌───────────▼────────────────┐  │
│  │  frpc (frp client)          │  │
│  │  - 连接到 frps               │  │
│  │  - 映射本地 5004 端口         │  │
│  └───────────┬────────────────┘  │
│              │                   │
│  ┌───────────▼────────────────┐  │
│  │  npx serve                  │  │
│  │  - serve 静态文件服务          │  │
│  │  - 监听 0.0.0.0:5004        │  │
│  │  - systemctl 管理，开机自启   │  │
│  └───────────┬────────────────┘  │
│              │                   │
│  ┌───────────▼────────────────┐  │
│  │  yj-knowledge-bank/         │  │
│  │  ├── index.html             │  │
│  │  └── doc/                   │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

### 1. 物理机：克隆项目 & 安装依赖

```bash
# 克隆项目
cd /home/yj/code
git clone https://github.com/chunyujin295/yj-knowledge-bank.git
cd yj-knowledge-bank

# 安装依赖（serve 静态文件服务器）
npm install
```

### 2. 物理机：配置 systemctl 开机自启

创建 systemd 服务文件：

```bash
sudo vim /etc/systemd/system/yj-knowledge-bank.service
```

写入以下内容：

```ini
[Unit]
Description=YJ Knowledge Bank - Static Site Server
After=network.target

[Service]
Type=simple
User=yj
WorkingDirectory=/home/yj/code/yj-knowledge-bank
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动并启用开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl start yj-knowledge-bank
sudo systemctl enable yj-knowledge-bank

# 检查状态
sudo systemctl status yj-knowledge-bank

# 验证端口在监听
ss -tlnp | grep 5004
```

### 3. 物理机：测试本地访问

```bash
curl http://127.0.0.1:5004
# 应该返回 index.html 的内容
```

### 4. 物理机：添加 frpc 代理条目

在已有的 `frpc.toml` 末尾新增一个 `[[proxies]]` 块：

```toml
[[proxies]]
name = "yj-knowledge-bank"
type = "tcp"
localIP = "127.0.0.1"
localPort = 5004
remotePort = 5004
```

> **为什么用 `type = "tcp"` 而不是 `type = "http"`？**
>
> 这里 frp 只做纯传输通道，HTTP 层的工作全部由 Nginx 承担。对比：
>
> |          | `type = "tcp"`        | `type = "http"`              |
> | -------- | --------------------- | ---------------------------- |
> | 工作层   | L4，字节流转发        | L7，frps 解析 HTTP 头        |
> | 路由方式 | `remotePort` 一一对应 | 按 `customDomains` 域名路由  |
> | 适用场景 | Nginx 在前面兜底时    | frp 直接暴露 HTTP 服务到公网 |
>
> yj-knowledge-bank 走的是路径路由（`/yj-knowledge-bank`），不是独立域名。frp 的 HTTP 代理只能按域名分流，做不到路径级别。所以链路是：
>
> ```
> Nginx (SSL终止 + path路由) → frps:5004 (tcp隧道) → frpc → serve:5004
>        ↑ L7                       ↑ L4                      ↑
>     HTTP 层处理               纯端口转发               静态文件服务
> ```
>
> 用 `tcp` 少了一层不必要的 HTTP 解析，更轻量。

重启 frpc：

```bash
sudo systemctl restart frpClient.service # 这里是我的服务名，你的就按照你自己的来
sudo systemctl status frpClient.service
```

### 5. 云服务器：frps 无需额外配置

frps 只需 `bindPort` 监听，每条 proxy 的 `remotePort` 会自动生效，不需要逐个声明。

确认 frps 正常运行即可：

```bash
sudo systemctl status frpSevice.service # 这里是我的服务名，你的就按照你自己的来
```

### 6. 云服务器：在已有 Nginx 中添加 location

目标：`https://codis.fun/yj-knowledge-bank` → `http://127.0.0.1:5004`（frps 隧道的远程端口）

编辑 Nginx 站点配置：

```bash
sudo vim /etc/nginx/sites-available/codis.fun
```

在已有的 `server` 块中添加两个 location：

```nginx
# yj-knowledge-bank 知识库（添加到 codis.fun 的 server 块中）
location = /yj-knowledge-bank {
    return 301 /yj-knowledge-bank/;
}

location /yj-knowledge-bank/ {
    proxy_pass http://127.0.0.1:5004/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 7. 验证部署

```bash
# 1. 检查物理机 serve 服务
curl http://127.0.0.1:5004

# 2. 检查云服务器 frp 隧道
curl http://127.0.0.1:5004

# 3. 检查 Nginx 反向代理
curl https://codis.fun/yj-knowledge-bank/

# 4. 浏览器访问
# https://codis.fun/yj-knowledge-bank/
```

### 8. 更新部署

后续有内容更新时：

```bash
cd /home/yj/code/yj-knowledge-bank
git pull
sudo systemctl restart yj-knowledge-bank
```

---

### 常用命令速查

| 操作 | 命令 |
|------|------|
| 查看 serve 服务状态 | `sudo systemctl status yj-knowledge-bank` |
| 重启 serve 服务 | `sudo systemctl restart yj-knowledge-bank` |
| 查看服务日志 | `sudo journalctl -u yj-knowledge-bank -f` |
| 查看 frpc 状态 | `sudo systemctl status frpc` |
| 查看 frps 状态 | `sudo systemctl status frps` |
| 重载 Nginx | `sudo systemctl reload nginx` |
| 查看端口占用 | `ss -tlnp \| grep 5004` |
