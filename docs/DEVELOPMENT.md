# 开发与部署

`website/` 是网站的静态资源目录。页面使用原生 JavaScript 和 CSS，浏览器按需加载 JSON 目录与预览图。

## 本地预览

在仓库根目录启动静态服务：

```sh
python3 -m http.server 8000 --directory website
```

浏览器访问 `http://localhost:8000/`。

本地查看在线高清原图时，将 `website/config.js` 中的 `mediaBaseUrl` 设为 `https://ancientstarch.cn`。网站与原图同域部署时使用 `/`。

## 文件组织

- `index.html`、`app.js` 与样式文件组成地图、图版和文献界面。
- `credits.html`、`credits.js` 与 `credits-literature.js` 组成滚动致谢。
- `data/catalog.json` 保存文献、图版及遗址关联。
- `data/research.json` 保存检索分类、分图释读与图像定位。
- `previews/` 保存以图像摘要命名的预览图。
- 仓库根目录的 `media-manifest.json` 记录高清原图的文件名、大小和摘要。

## 验证

使用 Node.js 执行：

```sh
node scripts/check-release.mjs
node --test r2-worker/test_worker.mjs
```

发布检查会核对 HTML 资源、图版目录、预览图、原图清单及公开文件范围。

## 部署

正式网站使用国内服务器与 CDN，静态站点根目录对应 `website/`。高清原图使用 `/media/<图版ID>.png`，`config.js` 中的 `catalogUrl` 为 `data/catalog.json`，`apiBaseUrl` 为空。

GitHub Pages 发布流程从 `website/` 上传资源，并使用正式网站的原图地址。

需要使用 Cloudflare Workers 时，仓库根目录的 `wrangler.jsonc` 将静态目录绑定为 `ASSETS`，将图片存储绑定为 `IMAGES`：

```sh
npx wrangler deploy
```

## 更新

编辑完成后同步 `website/`。修改 CSS 或 JavaScript 时，更新 HTML 中相应资源的版本参数。图片使用内容摘要作为版本参数；新增或替换原图时，同时更新图版目录、预览图和原图清单。

CDN 会按缓存规则更新资源。替换同一地址的文件后，按文件 URL 刷新；集中发布新图片时，可按访问需求预热。
