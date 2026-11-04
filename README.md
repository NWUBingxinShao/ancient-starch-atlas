# 淀粉粒考古图版库 · Starch Atlas

面向学术研究与教学的图版、文献及遗址信息展示网站。当前公开目录收录 628 幅图版；网页支持中英切换、遗址地图、图版与文献检索、分图释读和滚动致谢。

此仓库保存可部署的展示版本。日常编辑、审核和发布仍在维护者的本机后台完成。

## 目录

- `website/`：静态网页、公开元数据和预览图。
- `r2-worker/`：网页静态资源与高清原图只读服务代码。
- `wrangler.jsonc`：从仓库根目录部署完整网站的配置。
- `待上传原图清单.json`：628 幅原图的对象键、大小与 SHA-256。
- `scripts/check-release.mjs`：静态资源、公开文件及图片地址检查。

高清原图约 2.77 GB，使用独立对象存储。本仓库不保存原始 PDF、高清原图、编辑数据库、模型或本机维护历史。

首版按维护者要求不公开 CSV 下载表。内部审核清单与作者候选核对资料保留在本地，未列入此仓库。

## Cloudflare Workers 部署（当前使用）

网页和原图由同一个 Worker `ancient-starch-atlas` 提供。仓库根目录配置会同时上传 `website/` 静态资源、部署原图读取代码，并绑定 R2 桶 `starch-atlas-plates`；R2 桶可保持私有。

Cloudflare 的 Settings → Build 使用：

| 设置 | 值 |
| --- | --- |
| 生产分支 | `main` |
| Root directory | `/`（仓库根目录） |
| Build command | 留空，或 `node scripts/check-release.mjs` |
| Deploy command | `npx wrangler deploy` |

不要使用仅上传静态资源的命令覆盖这个服务。部署日志应同时列出 `env.ASSETS` 和 `env.IMAGES (starch-atlas-plates)`；仅有静态资源时，网页会正常显示，但原图路径会返回 404。

Git 集成后，推送 `main` 会触发更新；若自动构建未触发，在 Cloudflare 中重新部署最新提交。部署后检查首页、`/credits`、`/config.js` 和清单中的实际原图路径。

## 高清图片配置

`website/config.js` 的 `mediaBaseUrl` 为 `/`，原图使用当前网站域名下的 `/media/<图版ID>.png`。这样给整个 Worker 绑定自定义域名后，网页和原图都会使用新域名。

如根目录使用 `r2-worker`，该目录配置也会部署同一套网页和原图服务。推荐保持上表的仓库根目录设置。

R2 初次上传后曾验证 628 个图片地址的状态与大小、4 幅原图下载后的 SHA-256，以及分段读取。后续每次部署仍应检查原图，避免静态上传覆盖原图服务。

1. 图片按清单中的 `media/<图版ID>.png` 对象键存储在 R2 Standard 桶。
2. 从仓库根目录执行 `npx wrangler deploy`，一次部署网页与只读图片服务。
3. 同站点部署时保持 `mediaBaseUrl: "/"`；若另行部署网页，则将其设为图片 Worker 的实际 HTTPS 根地址，末尾不带 `/media`。
4. `apiBaseUrl` 保持为空；`catalogUrl` 保持 `data/catalog.json`。
5. 检查若干原图的读取、下载和 SHA-256，再向读者开放正式地址。

正式检查执行 `node scripts/check-release.mjs`；图片路由、静态资源和存储绑定测试执行 `node --test r2-worker/test_worker.mjs`。

## 自定义域名与大陆访问

在 `ancient-starch-atlas` 的 Settings → Domains & Routes → Add → Custom domain 中绑定自有域名。网页与图片共用该域名，不必再配置独立图片域名。

默认 `workers.dev` 地址与自定义域名的访问情况需要分别测试。绑定域名不等于接入中国大陆节点；如要求大陆长期稳定访问，可采用国内托管并完成服务商要求的备案。仓库代码与 R2 图片无需为绑定域名重新上传。

## Cloudflare Pages（可选）

若今后单独使用 Pages 托管网页：连接本仓库，分支 `main`、框架 `None`、根目录留空、构建命令 `node scripts/check-release.mjs`、输出目录 `website`。此时必须把 `website/config.js` 的 `mediaBaseUrl` 改为仍提供 R2 原图的 Worker 实际地址。

## 更新维护

在本机后台完成修改、核对和发布后，重新导出当前展示文件，将新的 `website/` 同步至仓库。更换了原图时，同时更新对应的 R2 对象；仅修改文字或界面时，更新网页即可。不要将整个工作目录提交到本仓库。

网站正式发布、手机与电脑验收通过后，再为长期稳定网址制作书稿二维码。

## 使用说明

本数据库仅供学术研究、教学及非营利性学术交流使用，禁止任何形式的商业用途。所收录文献、图像及相关资料的版权归原作者或相应权利人所有，使用时请注明原始出处。

数据勘误：2021119053@stumail.nwu.edu.cn。

版本 v1.0；页面标注的发布日期为 2026 年 11 月 5 日。
