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

npm run demo:cache   # 单看 Cache 参考实现的轨迹
npm run demo:sched
npm run demo:tcp
```

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
│   └── sweep.ts      参数扫描（高阶）  · parameter 轴
└── reference/        独立参考实现 —— 验证基准，不是内核
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
| 0d | 内容环实测：AI 填 DSL | ✅ 正常题 3/3、陷阱题 3/3 被拦（样本量小） |
| 1 | 宿主框架 + 视图层（补验收标准 3） | 未开始 |
| 2 | L2 组合级 | 未开始 |
| 3 | L3 新原语（风险最高，可能做不成） | 未开始 |

**AI 填 DSL 实测要点**（详见 `logs/2026-08-17-ai-fill.md`）：
MiniMax 的 Anthropic 兼容端点**不支持 `output_config.format`**，
**强制工具调用 `tool_choice` 才是可用路径**。脚本内置逐级降级探测，换模型时会自动重测。

## 铁律

1. **状态必须自足** —— 只能读 `prev`，不许读闭包里的可变状态。JSON 往返后还能续跑。
2. **参考实现独立** —— `src/reference/` 与 `src/kernels/` 不共享代码，否则是自己验自己。
3. **不会红的检查等于没有检查** —— 每条标准都要有一个故意做错的版本能把它弄红。
