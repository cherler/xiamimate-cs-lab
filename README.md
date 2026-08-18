# xiamimate-cs-lab

计算机专业课交互仿真实验室 —— 引擎与内核。

对标粒子先生的物理实验室，做**计算机专业课**（数据结构 / 组成原理 / 操作系统 / 计算机网络）的交互仿真。
不叫"考研 408"：考研三年跌 130 万，但那四门课全国计算机在校生都要上。

**核心判断**：护城河不是仿真（谁都能写），是**验证器**。
只有计算机领域的正确性能被程序自动判（跑参考实现比对轨迹），所以只有这个领域敢让 AI 生成新实验。
物理不行 —— 这是相对粒子先生的结构性优势。

## 快速开始

```bash
npm install
npm test          # 跑全部测试
npm run typecheck # tsc --noEmit

npm run web          # 起视图层（30 个实验都能跑）·「独立形态」
npm run web:single   # 打成一个自包含 HTML

npm run demo:cache   # 单看 Cache 参考实现的轨迹
npm run demo:sched
npm run demo:tcp
```

## 两种形态

本仓同一份代码有两种跑法，**区别只由挂载路径决定**（见 `web/src/platform.ts`）：

| | 独立形态 | 并入形态 |
|---|---|---|
| 起法 | `npm run web` | `npm run web:lab` + `npm run gateway` |
| base | `/` | `/lab/` |
| 平台页眉页脚 | 无 | 有（加载主站 `/chrome` 制品） |
| 学习进度 | 只存本机 | 登录后与账号双向合并 |
| 冒烟 | `node scripts/web-smoke.mjs http://127.0.0.1:5178/` | `node scripts/platform-smoke.mjs` |

**并入形态的本机入口是 `http://127.0.0.1:3000/lab`**，与虾米看股、虾米看AI 一致 ——
主站的 `next.config.ts` 把 `/lab/*` 转给本仓的 dev server。
**不要直接开 `:5178`**：那儿拿不到 `/chrome` 也拿不到 `/v1`，
两个「看起来都对」的地址只有一个是并入后的样子。

```bash
# 终端 1（本仓）        VITE_BASE=/lab/ 的 dev server（:5178）
npm run web:lab
# 终端 2（tools-frontend）主站 :3000，rewrites 负责分流
npm run dev
# 终端 3（tools-backend）账号与进度接口 :8200
bash scripts/dev.sh
# 然后开 http://127.0.0.1:3000/lab
```

⚠️ **必须用 `npm run web:lab`，不能用 `npm run web`。** 后者挂在根上，
HTML 里写的是 `src="/src/main.tsx"`，经 :3000 转过去落到主站身上 ——
**页面回 200，内容却是空的**。冒烟脚本的前置检查专门查这一条。

### 另一条入口：本地网关（验静态形态）

`:3000` 走的是 Next dev 的 rewrites，方便，但**不是线上的形状**。
网关把线上那套单域名分流搬到本机，规则与 `deploy/caddy-snippet.conf` 一一对应
（**改一边要改另一边**），能验到「不存在的资源回不回 404」这类只有静态托管才成立的事：

```bash
npm run web:build:lab
node scripts/local-gateway.mjs --lab=static --main=static
node scripts/platform-smoke.mjs http://127.0.0.1:8090
```
并入的整体做法见 [虾米看股并入虾米伙伴](../wiki/27-stock-lab-platform-integration.md)，
本仓的差异见 [logs/2026-08-18-platform-integration.md](logs/2026-08-18-platform-integration.md)。

## 目录

```
src/
├── core/
│   ├── document.ts   文档层：SimDocument / Entity / Stream / AxisSpec
│   ├── kernel.ts     内核契约 + 执行器 run() / resume()
│   └── verify.ts     验证器：四种比较器
├── kernels/          领域内核（实现 Kernel<S>）
│   ├── cache.ts      Cache 命中率      · step 轴
│   ├── scheduler.ts  进程调度甘特图    · time 轴
│   ├── tcp.ts        TCP 拥塞窗口      · time 轴
│   ├── page.ts       页面置换          · step 轴（FIFO/LRU/OPT/CLOCK）
│   ├── disk.ts       磁盘调度          · step 轴（FCFS/SSTF/SCAN/C-SCAN/LOOK）
│   ├── sweep.ts      参数扫描（高阶）  · parameter 轴 → 曲线
│   └── compare.ts    并排对比（高阶）  · 沿用内层轴 → N 条轨迹对齐
└── reference/        独立参考实现 —— 验证基准，不是内核
web/                  视图层（Vite + React）
├── src/shell/        共享框架：轴 · 日志 · 参数 · 读数 · 边界
├── src/stages/       每个内核一个舞台
└── src/registry.ts   实验注册表 —— 加实验只改这里
tests/                每个测试都自带"必须能红"的自检
docs/
├── blueprint.md      总蓝图（产品闭环 + 架构 + 标准）
├── standards.md      验收标准 / 内容标准 / 依赖准入
├── decisions/        ADR 决策记录
└── research/         调研原始材料
logs/                 每次验证的结果与发现
```

## 架构一句话

```
文档 Document ──compile()──▶ 仿真模型 SimModel ──run()──▶ 轨迹 Trace ──▶ 渲染 / 验证
     ▲                            ▲
造物型从这里进                408 从这里进
```

六条路共用这一条流水线。详见 [docs/blueprint.md](docs/blueprint.md)。

## 状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | DSL 收敛验证（三个实验挤一个 schema） | ✅ 通过 |
| 0b | parameter 轴 · 高阶内核 | ✅ 通过 |
| 0c | 验收标准 5 / 6 | ✅ 通过 |
| 0d | 内容环实测：AI 填 DSL | ✅ 精确题 60/60（20题×3次）、陷阱题 6/6 |
| 1 | 宿主框架 + 视图层 | ✅ 标准 3 已验 |
| 1b | 扩实验：页面置换 · 磁盘调度 | ✅ 5 个实验 |
| 1c | 接真题：判题 + 跳到那一步看为什么 | ✅ 答案从轨迹派生 |
| 1d | 扩实验：排序 · Dijkstra · 银行家 · 滑动窗口 ARQ | ✅ 9 个实验 |
| 1e | 输入全开放：驱动序列 + 实体表可编辑 | ✅ 参数换不了题面数据，这两个才行 |
| 1f | **408 全景表实现完毕** | ✅ **30 个实验 · 30 道题 139 问 · 四科全覆盖** |
| 0e | **L2 组合级**：AI 自选原语 | ✅ 36/36（12题×3次），选原语与填参数均 100% |
| 3 | L3 新原语（风险最高，可能做不成） | 未开始 |

**AI 填 DSL 实测要点**（详见 `logs/2026-08-17-ai-bench.md`）：

- MiniMax 的 Anthropic 兼容端点**不支持 `output_config.format`**，**强制工具调用 `tool_choice` 才是可用路径**（脚本内置逐级降级探测，换模型自动重测）
- 强制 `tool_choice` 仍有 **~3% 偶发不出 `tool_use` 块** → `fillWithRetry()` 重试
- 端点**不强制 schema 的 `required`** → 落地校验必须自己做（`validateDocument` 关卡 0）
- 但**缺"有语义的值"和缺"空集合"要分开处理** → `normalizeDocument()` 把省略的数组补成 `[]`
- 端点**同样不强制 `enum`** → 凡是能从别处拿到权威值的字段就别让模型填（`kind` 直接用工具名覆盖）

```bash
npm run ai:bench        # L1：填参数，跑一遍
npm run ai:bench -- 3   # 每题 3 次
npm run ai:l2           # L2：6 个工具混着给，模型自选原语
npm run ai:l2 -- 3
```

## 铁律

1. **状态必须自足** —— 只能读 `prev`，不许读闭包里的可变状态。JSON 往返后还能续跑。
2. **参考实现独立** —— `src/reference/` 与 `src/kernels/` 不共享代码，否则是自己验自己。
3. **不会红的检查等于没有检查** —— 每条标准都要有一个故意做错的版本能把它弄红。
4. **答案从轨迹派生** —— 题库里绝不手写答案；人会写错，而且配置一改答案就得跟着改。
5. **出处不编** —— 记不准的年份题号一律不写，按题型标注，等有可核对的来源再补。
