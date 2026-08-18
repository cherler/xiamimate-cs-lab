# 上线

> **现在不上。** 2026-08-18 用户拍板：`/lab` 先不急着上线。
> 这篇是**上线时照着做**的清单，不是「已经这么做了」的记录。
> 真跑过一遍之后，把踩到的坑补进最后一节，并把这句话删掉。

挂在 `xiamimate.com/lab`。形态与 `/atlas`、`/stocks` 一致：**纯静态 + Caddy `handle_path`**。

## 跟另外两个模块的区别：本仓没有自己的后端进程

虾米看股要 `/stocks-api/*` 反代前缀，因为它有一个自己的 FastAPI。本仓一个都没有 ——
账号与学习进度直接打主站的 `/v1/lab/progress`（同源 Cookie 自动带上）。

所以 Caddy 片段里**只有一条** `handle_path /lab/*`，不需要第二条。
代价是那组接口在 `xiamimate-tools-backend` 里，**上线要连着改两个仓**。

---

## 上线清单

### 1 · 后端：建表 + 重启

```bash
cd /srv/xiamimate/xiamimate-tools-backend
sudo git fetch --all && sudo git reset --hard origin/main
PYTHONPATH=. .venv/bin/python scripts/migrate.py --check     # 先看差多少
PYTHONPATH=. .venv/bin/python scripts/migrate.py --apply     # 执行 sql/047_lab_progress.sql
sudo systemctl restart xiamimate-api                          # ← 名字以服务器上实际的为准
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8200/v1/lab/progress   # 期望 401
```

⚠️ **`--apply` 之后必须重启**。`/v1/lab/*` 是新增路由，进程不重启就一直 404 ——
而 404 看起来像"路由没配好"，会往 Caddy 那边查半天。
本机联调时我自己栽过一次，wiki/27 §6.9 记的「写了配置没重启等于没配」是同一族。

**判据是 401 不是 200**：401 说明路由在、只是没登录；404 说明没重启成功。

### 2 · 前端：构建 + 发布

```bash
# 构建必须带 VITE_BASE，否则产物里的资源链接指向域名根 —— 页面 200、控制台一屏 404
cd /srv/xiamimate/xiamimate-cs-lab
sudo git fetch --all && sudo git reset --hard origin/main
sudo npm ci --no-audit --no-fund
sudo npm run web:build:lab            # = VITE_BASE=/lab/ vite build

# 发布：按 /atlas、/stocks 的既有形态摆
sudo rsync -a --delete web/dist/ /srv/xiamimate/lab/current/
```

发布前自查一眼（**这一条抓的是最阴的一种坏**）：

```bash
grep -o 'src="[^"]*"' /srv/xiamimate/lab/current/index.html
# 必须是 /lab/assets/…；出现 /assets/… 就是 VITE_BASE 没生效，别发
```

### 3 · Caddy：贴片段

把 `deploy/caddy-snippet.conf` 的内容加进 `/etc/caddy/Caddyfile` 的 `:8080 { }` 块。

⚠️ **必须排在主站那个 `handle { … }` 兜底之前**，否则 `/lab` 的请求全落到主站静态页。

```bash
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

### 4 · 线上自查

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://xiamimate.com/lab           # 308 → /lab/
curl -s -o /dev/null -w '%{http_code}\n' https://xiamimate.com/lab/          # 200
curl -s -o /dev/null -w '%{http_code}\n' https://xiamimate.com/lab/assets/根本不存在.js
#   必须是 404。回 200 说明 Caddy 里多写了 index.html 兜底 —— 那会让
#   任何错链都返回 200 + 首页 HTML：图挂了看不出来、爬虫把错链当真页面收录。
```

浏览器再看三件：平台页眉出现且写着「虾米伙伴 › 虾米做实验」、登录后进度面板显示
「已同步」、切换账户中心的外观（随系统/白天/黑夜）后 `/lab` 跟着变。

### 5 · 入口仍然是关着的

`lib/modules.ts` 里 `key: "lab"` 的 `status` 是 **`planned`**，首页与页眉切换器都不显示它。
上面四步做完，`/lab/` 能访问，但**没有入口能走到**。

要对外开放：运营台的「模块显隐」把「虾米做实验」勾成显示。**这是唯一的一道门** ——
本仓页面是公开的、没有服务端鉴权（不像虾米看股有 `STOCK_ACCESS`），
所以别把 `status` 翻成 `live` 当开关用，那个字段只是运营台没保存过时的兜底默认值。

---

## 回滚

```bash
sudo rsync -a --delete /srv/xiamimate/lab/<上一版>/ /srv/xiamimate/lab/current/
```

后端那张表**不用回滚**：`app.lab_progress` 是新表，旧代码不碰它。
真要退代码，`sql/047` 留着不删 —— 迁移账本只能追加，删了下次 `--check` 会报「账本有记录但文件不存在」。

## 跟部署无关但会一起动的

`xiamimate-tools-frontend` 的这一版还带着**全站配色重排**（文字五级 + 金色档提到 AA）。
主站前端一部署，那批颜色就落到**每一页**上 —— 跟 `/lab` 无关，但会同时可见。
实测只变好、无新增不达标（见 `logs/2026-08-18-light-theme.md`），心里有数即可。

## 踩过的坑

（还没上过线。真跑一遍之后写在这里。）
