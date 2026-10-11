# Reelog

> 记录在影院看过的电影。本地优先、离线可用，**数据只存在你自己的设备上。**

<!-- 想放截图：把图片存成 docs/screenshot.png，然后删掉下面这行的注释符
![Reelog](docs/screenshot.png)
-->

## 这是什么

一个用来记录**在电影院看过什么**的 PWA。不只是"看过哪些片"，还包括**在哪家影院、哪个影厅、什么版本（原版字幕 / 国语配音 / 修复重映）、什么时候看的、打几分**。

PC 和手机都能用。手机上可以「添加到主屏幕」，装成一个独立 App——全屏、有图标、能离线。

## 特点

- **数据完全在本地** —— 存在浏览器的 IndexedDB 里。没有账号、没有服务器、不上传任何东西。
- **离线可用** —— 断网也能记录、浏览、编辑。
- **跨设备靠导出 / 导入** —— 手动传一个 zip 文件，不做自动同步。
- **TMDB 集成** —— 搜片名、拉海报。但海报是在**添加影片时**下载并转存到本地的，之后看列表不再联网取图。
- **一套代码两种形态** —— 桌面端左侧栏 + 左列表右详情，移动端底部标签栏 + 单栏。

## 为什么没有云端同步

这是这个项目最核心的设计约束，值得单独说清楚。

**因为主流的云方案在目标网络环境下都走不通**（以下是实测结果，不是推测）：

| 方案 | 结果 |
|---|---|
| Supabase | `supabase.co` 的 TLS 握手被稳定阻断，而项目 API 全在这个域名下 |
| 坚果云 WebDAV | 服务器不返回 CORS 头，预检请求被 401 挡下，浏览器无法直连 |
| 阿里云 OSS | CORS 可配，但前端存长期 AccessKey 有泄露风险（官方文档明确警告） |
| GitHub 私有仓库 | 可行，但国内可靠性不稳，且图多了仓库会膨胀 |

**所以决定：不做同步。** 把"数据不丢"这件事，交给一个你完全掌控的动——**导出备份**。

为了让它足够可靠，配套做了这些：

- **合并算法只增不删** —— 导入是并集，导入包里没有的本地记录一条都不会被删
- **软删除** —— 删除只是打标记。否则导入旧备份时，已删除的记录会被"复活"
- **导入前自动存快照** —— 存进库里的 `backups` 表，可下载、可恢复、可回滚
- **导入前先预览** —— 在内存里算一遍合并结果给你看，确认后才真的写
- **备份提醒** —— 超过 14 天没导出会提示

合并算法、备份包格式、数据库 schema 都有单元测试（`npm test`）。

## 本地开发

```bash
npm install
npm run dev
```

其他命令：

```bash
npm run build     # 类型检查 + 构建
npm test          # 单元测试
npm run icons     # 重新生成 PWA 图标
npm run preview   # 本地预览构建产物
```

## 部署你自己的

这是个纯静态站点，任何静态托管都能放。以 Cloudflare Pages 为例：

1. Fork 或克隆本仓库到你自己的 GitHub
2. Cloudflare 后台 → Workers & Pages → 创建 → Pages → 连接 Git 仓库
3. 构建配置：

   | 字段 | 值 |
   |---|---|
   | Framework preset | Vite（或 None） |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

4. **环境变量加一条 `NODE_VERSION` = `24`**（Vite 8 需要较新的 Node，这步别漏）
5. 部署

> **不要部署到子路径**（比如 `用户名.github.io/reelog/`）。manifest 的 `start_url` 和 `scope` 都是 `/`，子路径下需要额外改 `base` 配置。

## 配置 TMDB

有三种用法，在「设置 → TMDB 影片数据」里选一种。

### ① 自己填 Key

去 [themoviedb.org](https://www.themoviedb.org/settings/api) 申请，类型选 **Personal**。Application URL 那一栏如果没有线上地址，可以填 `https://localhost`。

Key 只存在你浏览器的 localStorage 里，不进仓库。v3 的 API Key 和 v4 的 Read Access Token 都支持。

**缺点**：`api.themoviedb.org` 在国内被 DNS 污染，需要整台设备挂代理。

### ② 用别人搭好的中转站

展开「高级设置」，把 API 地址和图片地址换成对方给的两个地址，**Key 留空**。不用申请 Key，也不用挂代理。

### ③ 自己搭中转站

仓库里的 [`worker/tmdb-proxy.js`](worker/tmdb-proxy.js) 是一个 Cloudflare Worker：

- Key 存在服务端环境变量里，使用它的人不需要申请
- Cloudflare 的服务器能正常访问 TMDB，所以使用者不需要代理
- 免费额度 10 万次请求/天，几个人用掉不到 0.2%

部署方式和环境变量说明都在那个文件的注释里。

> ⚠️ **必须给它绑一个自定义域名。**
>
> Cloudflare 默认分配的 `*.workers.dev` 域名在国内**是不通的**——实测连接超时（`code=000`）。而把 Worker 绑到你自己托管在 Cloudflare 的域名下（例如 `tmdb.你的域名`）就正常了，实测 0.9 秒响应。
>
> 位置：Worker →「设置」→「域和路由」→ 添加 → 自定义域。Cloudflare 会自动建解析记录并签发证书。
>
> 顺带一提，`*.pages.dev`（Pages 的默认域名）实测是通的，所以主站不需要自定义域名也能访问——**但不通的是 `workers.dev`，两个域名的封锁状态不一样**，别把它们混为一谈。

## 已知限制

- **无自动同步** —— 靠手动导出 / 导入（原因见上）
- **数据按「设备 + 浏览器」隔离** —— 换个浏览器打开是空库；iOS 上 Safari 里和装成 App 之后也是两个容器
- **iOS 上必须先装到主屏幕再开始用** —— 顺序反了，在 Safari 里录的内容装完后看不见
- **清除浏览器数据 / 卸载 App 会丢数据** —— 所以记得定期导出
- **海报缓存** —— 本应用会把海报永久存在本地，这与 TMDB「不得缓存超过 6 个月」的条款在字面上有出入。个人自用没问题，但你应该知道

## 技术栈

Vite 8 · React 19 · TypeScript 6 · Tailwind CSS 4 · Dexie 4（IndexedDB）· fflate · vite-plugin-pwa

状态管理没有引入额外库，用 `dexie-react-hooks` 的 `useLiveQuery` 加一个 localStorage hook 就够了。

## 两个值得记的实现细节

**WebKit 没有 canvas WebP 编码器。** 在 iOS 上调 `canvas.toBlob(cb, 'image/webp')` 会**静默返回 PNG**，不报错也不 reject。所以海报转码必须先做特征检测，检出不是 WebP 就回退 JPEG——否则体积可能大 5～10 倍。

**`display: "standalone"` 是硬性要求，不是优化项。** iOS 只对**已安装的主屏幕 Web App** 豁免 ITP 的 7 天存储清理；跑在 Safari 里的 `minimal-ui` 网页，一周不打开数据就会被删。依据是 WebKit bug 232302 里 Apple 工程师的官方回复。

## 署名

影片元数据与海报由 [The Movie Database (TMDB)](https://www.themoviedb.org/) 提供。

> This product uses the TMDB API but is not endorsed or certified by TMDB.

本应用未经 TMDB 认可或认证。完整署名见应用内的「关于与署名」页面。

## 开源协议

[MIT](LICENSE)
