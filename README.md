# 虾米镇（xiamimate-xiami-world）

一个经营模拟游戏：你是小镇的 AI 修理工，带着 AI 搭档「虾米君」。
生活里每个坏掉、失灵、异常的东西，背后都藏着一个**真实可运行的仿真实验**。

> 每个委托一条链：**镇上的异常 → 观察与假设 → 进副本做对照实验验证原理 → 修好现实中的东西 → 小镇发生变化**。
> 不是在游戏里教知识，而是让知识成为世界运行的规则。

## 当前可玩：第一个副本《冷藏柜通着电却是热的》

诊所的疫苗冷藏柜不制冷。进副本后：

1. **热成像扫**大空间——散热片通红（75℃，由求解器点亮，不是手绘）。
2. 钻进去做**对照实验**：只改一个变量、跑 A/B、看两条温度曲线分叉（堵着 21℃ / 通着 7.5℃）→ 看懂「制冷=把热搬出去」。
3. **修复 + 反转**：清灰恢复散热 → 柜子往冰点冲 → 给温控定窗口。设「冷冻」会冻坏疫苗（完不成），只有「冷藏 2–8℃」才安全。
4. 修好 → 回镇诊所变「已恢复」，刷新还记得。

## 两条铁律

1. **求解器算，虾米君只翻译。** 屏幕上每个数都来自 `solvers/`；AI 搭档把现象说成人话、提猜想、指下一步，**绝不自己算、不编造数字**。
2. **AI 只在认知节点出现，不进 60fps 机械回路。** 进副本、扫出异常、破案、结冰示警才唤醒模型；走位、拖拽不调。

## 技术

- 表现：**Phaser 4**（2D 游戏框架）。世界层与副本都是 Phaser 场景，`scene.start` 硬切「进副本」。
- 求解器：纯 TS，与渲染无关、可单测（`solvers/thermal.ts` 散热、`control.ts` 温控、`circuit.ts` 电路备用）。
- AI 搭档：`agents/partner.ts` 的 `PartnerBrain` 接口。默认脚本兜底；配好端点即用真模型。

## 跑

```bash
npm install
npm run dev      # http://localhost:5180
npm test         # 求解器 + 助手单测（含测试台自检）
npm run build    # 生产构建
```

浏览器冒烟（先起 dev）：`node scripts/smoke-play.mjs`（整条通关）、`smoke-scan` / `smoke-experiment` / `smoke-partner`。

## 接真模型（可选）

设三个 Vite 环境变量即可让虾米君走真模型（OpenAI 兼容 `/v1/chat/completions`），否则脚本兜底：

```
VITE_PARTNER_BASEURL=<你的端点>
VITE_PARTNER_KEY=<key>
VITE_PARTNER_MODEL=<模型名>
```

## 目录

- `solvers/` 学科求解器（真理源，可单测）
- `chapters/` 副本配置（`fridge/` 冷藏柜）
- `game/` Phaser 运行时（`scenes/` 场景、`save.ts` 存档、`partner.ts` 助手接线）
- `agents/` AI 搭档大脑
- `tests/` 单测 · `scripts/` 浏览器冒烟
- `docs/content-map.md` 内容底本（日常物件→底层理论，第一季八副本）
- `docs/plans/` 实现计划 · `_legacy/` 已归档的旧原型

## 内容路线

见 `docs/content-map.md`。第一季八个副本（冰箱→电风扇→抽水马桶→油烟机→游戏厅Cache→语音助手推理引擎→红绿灯→腌菜），学科在副本间押韵（反馈控制、热泵、排队、读曲线）。
