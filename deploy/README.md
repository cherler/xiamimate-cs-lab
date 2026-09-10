# 上线

> **还没真上过线。** 这篇是**上线时照着做**的清单，不是「已经这么做了」的记录。
> 真跑过一遍之后，把踩到的坑补进最后一节，并把这句话删掉。
>
> 2026-08-18 拍板「先不急着上线」；2026-09-10 用户说准备上线，同日把路径从
> `/lab` 改名成 `/cslab`（**后端 `/v1/lab/progress` 与 `app.lab_progress` 表没跟着改**）。

挂在 `xiamimate.com/cslab`。形态与 `/atlas`、`/stocks` 一致：**纯静态 + Caddy `handle_path`**。

## 跟另外两个模块的区别：本仓没有自己的后端进程

虾米看股要 `/stocks-api/*` 反代前缀，因为它有一个自己的 FastAPI。本仓一个都没有 ——
账号与学习进度直接打主站的 `/v1/lab/progress`（同源 Cookie 自动带上）。
⚠️ 2026-09-10 前端路径从 `/lab` 改名成 `/cslab`，**后端这条接口和 `app.lab_progress` 表故意没跟着改** ——
改表名要迁移、改路由要两仓同时上，收益是零。**URL 是 cslab，API 仍是 lab，别以为哪边写错了。**

账号接口这一层确实没有第二个反代前缀，代价是那组接口在 `xiamimate-tools-backend` 里，
**上线要连着改两个仓**。

⚠️ 但 Caddy 片段里**不止一条** `handle_path`（这句原来写着「只有一条」，早就不对了）。
除了静态兜底 `/cslab/*`，还有**四组必须排在它前面**的规则：

| 前缀 | 是什么 | 产物从哪来 |
| --- | --- | --- |
| `/cslab/ai/*` | AI 学伴（出题/答疑/复习） | Node 进程 `server/index.ts`，:8300 |
| `/cslab/cards/*` | 算法卡牌 | `games/algo-cards/dist`（要构建） |
| `/cslab/explainer{,-live}/*` | Transformer 图解两个入口 | `experiments/`（**不需要构建**，直接摆源码目录） |

**排在兜底后面 = 一律 404**，而那个 404 长得跟"路由没配"一模一样。

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
cd /srv/xiamimate/xiamimate-lab
sudo git fetch --all && sudo git reset --hard origin/main
sudo npm ci --no-audit --no-fund
sudo npm run web:build:lab            # = VITE_BASE=/cslab/ vite build

# 发布：按 /atlas、/stocks 的既有形态摆
sudo rsync -a --delete web/dist/ /srv/xiamimate/cslab/current/

# 算法卡牌：构建 + 摆产物（base 已写死在它的 vite.config 里）
#   探索游戏(games/xiami-world) 2026-09-10 已从课堂去掉,不再构建、不再发布。
(cd games/algo-cards && sudo npm ci --no-audit --no-fund && sudo npx vite build)
sudo rsync -a --delete games/algo-cards/dist/ /srv/xiamimate/cslab-cards/current/

# Transformer 图解两个入口：**不需要构建**，直接摆源码目录
#   dev 下它们由 web/vite.config.ts 的 subappsPlugin 伺候，那是 configureServer 钩子、
#   **只在 dev server 里跑**；构建产物里没有这两个目录 —— 漏了这两条就是"本地能开、线上 404"。
sudo rsync -a --delete experiments/explainer-hub/ /srv/xiamimate/cslab-explainer/current/
sudo rsync -a --delete experiments/qwen-browser/  /srv/xiamimate/cslab-explainer-live/current/
```

发布前自查一眼（**这一条抓的是最阴的一种坏**）：

```bash
grep -o 'src="[^"]*"' /srv/xiamimate/cslab/current/index.html
# 必须是 /cslab/assets/…；出现 /assets/… 就是 VITE_BASE 没生效，别发
```

### 2b · AI 学伴进程：起起来，并且**把积分闸口接上**

```bash
cd /srv/xiamimate/xiamimate-lab
sudo npm run ai:serve          # 或按服务器上的 systemd unit 起（:8300）
```

启动日志最后一行必须是 **`计费：已接入主站计费`**。写着「未配 XM_API_BASE（本地透明模式，不计费）」
就说明闸口没接，**AI 学伴会照常工作、一分不扣、页面上看不出任何异样**。

`.env` 里要有：

```
XM_API_BASE=https://xiamimate.com     # 与页面同源，xm_session Cookie 才带得过去
MINIMAX_API_KEY=…  MINIMAX_BASE_URL=…  MINIMAX_MODEL=…
```

⚠️ **计费要三处一起到位，缺一处都是「静默免费」**（`npm test` 里的
「AI 学伴的计费真接上了」那套判据就是钉这个的）：

| # | 在哪 | 缺了会怎样 |
| --- | --- | --- |
| ① | `xiamimate-tools-backend` 的 `credits_gateway.KNOWN_MODULES` 含 `lab_ai` | reserve 回 400 bad_module → 不计费 |
| ② | 同仓 `pricing.MODULE_MULTIPLIERS` 有 `lab_ai` 的倍率（现为 1.0） | 落到默认值，等于没定过价 |
| ③ | 本仓 `.env` 的 `XM_API_BASE` | Meter 直接短路，**连闸口都不打** |

#### 游客试用与日限

未登录也能用 AI 学伴（用户 2026-09-10 拍板「不堵，留作免费试用」），但走的是
**按 (visitor_id, IP) 的每日额度**，跟跨境 `/v1/ai/*` **共用同一个桶、同一份实现**
（`usage.guest_reserve`）：

* 额度值 = 主站 `.env` 的 `GUEST_AI_DAILY`（默认 5 积分/天）。**全平台一份**，
  不是每个模块各 5 分 —— 要挡的是「同一个人白嫖模型」。
* 额度用完 → 闸口回 `402 guest_limit` → **AI 学伴不会调模型**，直接把提示回给页面。
  这一条是限流有没有用的分界线：之前那版拿到错误只记一句日志、照样调模型。
* 前提是 Caddy 把真实客户端 IP 传下来。`common.client_ip` 从右往左跳过内网段取第一个
  公网地址；**若哪天换了网关/加了 CDN，这里不会报错，只会悄悄把所有人归进同一个桶**。
  上线后拿两台不同网络的设备各点一次，看 `app.usage_event` 的 `ip_hash` 是不是两个值。

上线后自查一次（不需要真调模型）：

```bash
curl -s 'https://xiamimate.com/v1/credits/quote?module=lab_ai&tokens=2000'
# 期望 {"module":"lab_ai",...,"credits":1,"multiplier":1.0,...}
# 回 {"code":"bad_module"} 就是 ① 没到位

# 游客通道通没通（不带 Cookie；这一条也不调模型）
curl -s -X POST https://xiamimate.com/v1/credits/reserve -H 'content-type: application/json' \
  -H 'x-visitor-id: v_deploy_check' -d '{"module":"lab_ai","task":"ask","estimated_tokens":2000}'
# 期望 {"hold_id":"guest:ue_…","held":1,"guest":true,"used":1,"limit":5}
# 回 401 unauthorized 就是 lab_ai 没进 credits_gateway.GUEST_TRIAL_MODULES
```

### 3 · Caddy：贴片段

把 `deploy/caddy-snippet.conf` 的内容加进 `/etc/caddy/Caddyfile` 的 `:8080 { }` 块。

⚠️ **必须排在主站那个 `handle { … }` 兜底之前**，否则 `/cslab` 的请求全落到主站静态页。

```bash
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

### 4 · 线上自查

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://xiamimate.com/cslab           # 308 → /cslab/
curl -s -o /dev/null -w '%{http_code}\n' https://xiamimate.com/cslab/          # 200
curl -s -o /dev/null -w '%{http_code}\n' https://xiamimate.com/cslab/assets/根本不存在.js
#   必须是 404。回 200 说明 Caddy 里多写了 index.html 兜底 —— 那会让
#   任何错链都返回 200 + 首页 HTML：图挂了看不出来、爬虫把错链当真页面收录。
```

四个子路径也各要一眼（**只验主页会漏掉三个**）：

```bash
for p in /cslab/ /cslab/cards /cslab/explainer /cslab/explainer-live; do
  echo "$(curl -s -L -o /dev/null -w '%{http_code}' https://xiamimate.com$p)  $p"
done
curl -s -o /dev/null -w '%{http_code}\n' https://xiamimate.com/cslab/ai/health   # 期望 200
```

浏览器再看三件：平台页眉出现且写着「虾米伙伴 › 虾米CS课堂」、登录后进度面板显示
「已同步」、切换账户中心的外观（随系统/白天/黑夜）后 `/cslab` 跟着变。

### 5 · 入口仍然是关着的

`lib/modules.ts` 里 `key: "cslab"` 的 `status` 是 **`planned`**，首页与页眉切换器都不显示它。
上面四步做完，`/cslab/` 能访问，但**没有入口能走到**。

要对外开放：运营台的「模块显隐」把「虾米CS课堂」勾成显示。**这是唯一的一道门** ——
本仓页面是公开的、没有服务端鉴权（不像虾米看股有 `STOCK_ACCESS`），
所以别把 `status` 翻成 `live` 当开关用，那个字段只是运营台没保存过时的兜底默认值。

---

## 回滚

```bash
sudo rsync -a --delete /srv/xiamimate/cslab/<上一版>/ /srv/xiamimate/cslab/current/
```

后端那张表**不用回滚**：`app.lab_progress` 是新表，旧代码不碰它。
真要退代码，`sql/047` 留着不删 —— 迁移账本只能追加，删了下次 `--check` 会报「账本有记录但文件不存在」。

## 跟部署无关但会一起动的

`xiamimate-tools-frontend` 的这一版还带着**全站配色重排**（文字五级 + 金色档提到 AA）。
主站前端一部署，那批颜色就落到**每一页**上 —— 跟 `/cslab` 无关，但会同时可见。
实测只变好、无新增不达标（见 `logs/2026-08-18-light-theme.md`），心里有数即可。

## 踩过的坑

（还没上过线。真跑一遍之后写在这里。）
