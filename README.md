# 我的音乐2 · Web 版

把原 Android App（MyMusic2 2.6）复刻成可在浏览器访问、部署在 Cloudflare Pages 的 Web 应用。**原项目 `MyMusic2-master` 未做任何改动**，这是一套独立代码。

## 功能（对齐原生 App）

- **三音源**：网易云 / QQ音乐 / 酷狗。官方源负责榜单、推荐、歌单详情、新歌、热搜；聚合源负责搜索、播放取链、封面、歌词。
- **页面**：首页（为你推荐 / 榜单分段切换 / 新歌速递）、搜索（热词 / 历史 / 联想 / 分页）、音乐库（收藏 / 下载 / 最近播放 / 自建歌单）、播放页（封面·歌词左右翻页、LRC 逐行高亮并可点击跳转、进度拖动、播放模式、睡眠定时、音量、播放队列）、歌单详情、榜单、推荐、歌曲列表（过滤/排序）、自建歌单、设置（主题/昵称/头像/歌词偏移/导入导出）、歌单导入导出。
- **本地持久化**：收藏、最近播放、自建歌单、搜索历史、队列、设置均存浏览器 localStorage；下载缓存存 IndexedDB。
- **UI**：Material 3 风格，朱红主题 `#D43C33`，跟随系统 / 浅色 / 深色三档，移动端优先、桌面居中。
- **动画**：均衡器跳条、进度条、翻页、歌词滚动、Toast、底栏折叠等。

## 架构

```
浏览器  →  /api/*  →  Cloudflare Pages Functions  →  第三方音源
  |                          (解决 CORS / Referer / 302 / 混合内容)
  └── 静态前端 (React + Vite 构建的 dist/)
```

关键点：音源接口都有跨域限制，且播放需要伪造 Referer、解析 302 取真实音频直链，所以必须通过 Worker 代理。浏览器只与同源的 `/api` 通信。

## 本地运行

```bash
npm install
npm run dev            # 一条命令同时启动：API 代理(8788) + Vite 前端(5173)
```

浏览器打开 **http://localhost:5173** 即可，接口全部可用。

> 原理：`npm run dev` 会用 concurrently 同时跑两个进程——
> - `wrangler pages dev`（本地模拟 Cloudflare Pages Functions，提供 `/api/*` 代理，端口 8788）
> - `vite`（前端热更新开发服务，端口 5173，已配置把 `/api` 转发到 8788）
>
> ⚠️ 单独运行 `npx vite`（或只开 5173）而没起 wrangler 时，所有 `/api` 接口都会失败——这是最常见的"接口无效"原因。

也可以模拟生产环境（静态构建 + Functions 一体）：

```bash
npm run build
npx wrangler pages dev dist --port 8788
# 浏览器打开 http://127.0.0.1:8788
```

## 部署到 Cloudflare Pages（推荐）

### 方式一：命令行（wrangler）

```bash
npm install
npx wrangler login          # 首次登录 Cloudflare 账号
npm run deploy              # = build + wrangler pages deploy dist --project-name=mymusic2-web
```

部署完成后 wrangler 会给出一个 `https://mymusic2-web.pages.dev` 的公网地址，即可在线访问。

### 方式二：连接 Git 仓库（自动部署）

1. Cloudflare 控制台 → Workers & Pages → Create → Pages → Connect to Git，选择本仓库。
2. 构建配置：
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `MyMusic2-Web`（若仓库根目录就是本项目则留空）
3. 保存并部署。`functions/` 目录会被自动识别为 Pages Functions，无需额外配置。

## 重要说明

- **音源可用性**：聚合源（jbsou）为单点依赖，与原生 App 一样存在失效风险；平台官方接口也可能随时调整。若某天搜索/播放失败，多为上游接口变更，需更新 `functions/api/_lib/` 下的解析逻辑。
- **音乐版权**：仅供个人学习研究，请勿用于商业用途。
- **本地开发代理**：本机若设置了 HTTP 代理环境变量，wrangler 的 fetch 会走代理；部署到 Cloudflare 后无此问题。

## 与原 App 的差异（Web 平台限制）

- 锁屏歌词 / 系统媒体通知栏 / 二维码扫码：Web 无对应系统能力，未实现。
- "下载"：Web 端实现为缓存到浏览器 IndexedDB（离线保留在"已下载"）或保存为音频文件。
- 歌词偏移为全局设置（原 App 按音源分别设置）。
- 头像支持图片链接 / 随机头像，不支持相册裁剪（Web 端可用链接替代）。
