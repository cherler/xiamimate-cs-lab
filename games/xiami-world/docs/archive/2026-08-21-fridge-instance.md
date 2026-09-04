# 冷藏柜副本（Phaser 化第一步）实现计划

> **For Claude:** 用 executing-plans 技能逐个任务实现本计划。

**Goal:** 把《冷藏柜通着电却是热的》做成一个可玩的三层副本（电→热→控制），跑在 Phaser 里，坐实"进副本 → 工具扫 → 对照实验 → 修好 → 回镇解锁"这条闭环。

**Architecture:** 三层分明，且都不依赖渲染引擎：
`solvers/`（纯 TS 求解器，真理源）← `chapters/`（一个副本 = 数据 + 三层脚本）← `game/`（Phaser 场景把求解器画出来）。
AI 助手走一个 `PartnerBrain` 接口，第一版可用脚本实现，之后换真模型不动调用方。**求解器算、助手讲**是全局铁律：屏幕上每个数都来自 solver，助手只建议候选变量、翻译人话，不算数、不编。

**Tech Stack:** Phaser 4.0（2D 游戏框架，MIT）· TypeScript · Vite · Playwright（冒烟）· 纯 TS 求解器（电路已有，新增 thermal / control）。

**遗产处置：** `web/main.ts` + `web/hud.css`（另一个 session 的 DOM 小镇）和 `world/state.ts` / `agents/npc.ts`（灯泡原型的世界层）都是上一个形态的，**不改、不引用**，最后一个任务里整体归档到 `_legacy/`。`solvers/circuit.ts`（280 行、24 测试绿）**保留复用**作"电"层。像素图 `web/assets/xiami-town-dusk.png` 保留。

---

## 阶段 A — 求解器（纯 TS，不碰 Phaser，先把"真理源"钉死）

### Task A1: 热求解器 `thermal.ts` —— 稳态热流 / 散热受阻

**Files:**
- Create: `solvers/thermal.ts`
- Test: `tests/thermal.test.ts`
- Modify: `tests/run-all.ts`（注册 thermal 测试）

**模型（教学级，够近似）：** 压缩机以恒定功率 `pumpWatts` 往外搬热；散热片把热排到环境，排热能力 =
`(Tinside - Tambient) / Rcond`，`Rcond` 是散热热阻（积灰/顶墙 → Rcond 变大 → 排不动）。
稳态时"搬进来的热 = 排出去的热"，解出柜内温度。核心反直觉：**pumpWatts 再大，Rcond 太大也降不下来**。

**Step 1: 写失败测试**（`tests/thermal.test.ts`）
```ts
import { solveThermal } from '../solvers/thermal.ts'
import { ok, near } from './harness.ts'
export function run() {
  console.log('— 热求解器 —')
  // 通畅：低热阻，柜温压到接近环境
  const clear = solveThermal({ pumpWatts: 90, Rcond: 0.05, Tambient: 30, load: 0 })
  ok(clear.Tinside < 8, `散热通畅时柜内应压到 8℃ 以下（实测 ${clear.Tinside.toFixed(1)}）`)
  // 堵塞：热阻放大 10 倍，柜温压不下来——甚至高于环境（这就是"通着电却是热的"）
  const blocked = solveThermal({ pumpWatts: 90, Rcond: 0.5, Tambient: 30, load: 0 })
  ok(blocked.Tinside > clear.Tinside + 10, `堵塞后柜内明显更热（${clear.Tinside.toFixed(1)}→${blocked.Tinside.toFixed(1)}）`)
  // 题眼：同样通着电、同样泵功率，只因散热被堵，结果天差地别
  ok(blocked.pumpWatts === clear.pumpWatts, '两组泵功率一样——变的只有散热')
  // 控制变量：只调一个变量，别的锁死（给"对照实验"用）
  const a = solveThermal({ pumpWatts: 90, Rcond: 0.05, Tambient: 30, load: 0 })
  const b = solveThermal({ pumpWatts: 90, Rcond: 0.05, Tambient: 42, load: 0 })
  ok(b.Tinside > a.Tinside, '环境更热 → 柜内更热（单变量对照可复现）')
}
```

**Step 2: 跑，确认失败**
Run: `node --experimental-strip-types tests/thermal.test.ts` → Expected: FAIL（solveThermal 未定义）

**Step 3: 实现 `solvers/thermal.ts`**
```ts
/**
 * 稳态热流求解器 —— 副本"热"层的真理源。
 * 制冷=把热从柜内搬到柜外。搬得动搬不动，取决于散热热阻，不取决于电够不够。
 * 边界：稳态，不含开机瞬态；单腔体；不建模相变（相变的"哇"放化学层，见 chapters 注释）。
 */
export type ThermalInput = {
  pumpWatts: number     // 压缩机搬热功率（恒定）
  Rcond: number         // 散热热阻，℃/W。积灰/顶墙 → 变大
  Tambient: number      // 环境温度 ℃
  load: number          // 柜内漏热/开门带来的额外热负荷 W
}
export type ThermalSolved = {
  Tinside: number       // 稳态柜内温度 ℃
  pumpWatts: number     // 原样带出，供"两组泵功率一样"这类断言
  rejected: number      // 实际排出的热 W
  notes: string[]
}
export function solveThermal(i: ThermalInput): ThermalSolved {
  // 排热能力受热阻限制：Qout(T) = (T - Tambient) / Rcond
  // 稳态：Qout = pumpWatts + load 搬出的净热在柜内达到平衡
  // 简化：柜内温度 = Tambient - (pumpWatts - load) * Rcond
  //   （泵把热往外搬，等效于把柜内温度拉到环境以下 (pump-load)*Rcond；
  //    Rcond 越大，同样的泵功率能拉开的温差越小——堵了就拉不开）
  // 物理方向（务必对）：Rcond 越大→能拉开的温差越小；泵越猛/负荷越小→温差越大。
  //   drop = 净搬热 * K / (1 + alpha*Rcond)，K=0.3、alpha=4 已核过四条断言全绿。
  const net = i.pumpWatts - i.load
  const drop = net * 0.3 / (1 + 4 * i.Rcond)
  const Tinside = i.Tambient - drop
  const rejected = drop / i.Rcond
  const notes = [
    `压缩机搬热 ${i.pumpWatts} W，散热热阻 ${i.Rcond} ℃/W。`,
    `稳态柜内 ${Tinside.toFixed(1)} ℃（环境 ${i.Tambient} ℃）。`,
  ]
  if (Tinside > i.Tambient - 2) notes.push('热搬不出去，柜内压不下来——不是电的事，是散热堵了。')
  return { Tinside, pumpWatts: i.pumpWatts, rejected, notes }
}
```
> ⚠️ 上面那行 `Tinside` 公式先占位；A1 的任务就是把它调到让四条断言全绿、且"堵 vs 通""环境高 vs 低"两组对照单调可复现。别硬凑：先让物理直觉对（Rcond↑→温差↓；load↑→温度↑），再让数字过断言。

**Step 4: 跑，确认通过**
Run: `node --experimental-strip-types tests/thermal.test.ts` → Expected: PASS
Modify `tests/run-all.ts`：`import { run as thermal } from './thermal.test.ts'` 并调用；跑 `npm test` 确认总数增加、自检仍能红。

**Step 5: Commit**
```bash
git add solvers/thermal.ts tests/thermal.test.ts tests/run-all.ts
git commit -m "feat(solver): 热求解器——散热受阻导致通电却不制冷"
```

---

### Task A2: 控制求解器 `control.ts` —— 温控窗口 / 过冷

**Files:**
- Create: `solvers/control.ts`
- Test: `tests/control.test.ts`
- Modify: `tests/run-all.ts`

**模型：** 温控器带一个开关窗口 `[setLow, setHigh]` 和迟滞。给定制冷能力（来自 thermal 修好后的状态）和目标窗口，
判定柜内会稳定在哪个区间。核心反转：**窗口设太低 → 结冰（<0℃）→ 疫苗一样废**；正确解是把窗口卡在 2–8℃。

**Step 1: 写失败测试**
```ts
import { solveControl } from '../solvers/control.ts'
import { ok } from './harness.ts'
export function run() {
  console.log('— 控制求解器 —')
  // 窗口设太低：会把柜内拉到冰点以下 → 判定"冻坏"
  const tooCold = solveControl({ setLow: -4, setHigh: -1, coolingFloor: -6 })
  ok(tooCold.frozen, '窗口设在冰点以下 → 疫苗冻坏')
  ok(!tooCold.safe, '冻坏 = 不安全')
  // 正确窗口 2–8℃：稳定、不冻、不热
  const good = solveControl({ setLow: 3, setHigh: 6, coolingFloor: -6 })
  ok(good.safe && !good.frozen && !good.tooWarm, '2–8℃ 窗口安全')
  // 窗口太高：压不到疫苗要求 → 太热
  const tooWarm = solveControl({ setLow: 10, setHigh: 14, coolingFloor: -6 })
  ok(tooWarm.tooWarm && !tooWarm.safe, '窗口太高 → 太热，一样不安全')
}
```

**Step 2–5:** 同 A1 的节奏（写实现让断言全绿 → 注册进 run-all → commit）。
实现要点：疫苗安全区常量 `VACCINE_OK = { lo: 2, hi: 8 }`（注释注明 WHO 冷链，真事、不是拍的）；
`frozen = 窗口下界 <= 0`；`tooWarm = 窗口上界 > 8`；`safe = 窗口整体落在 [2,8] 内且制冷够得着`。
```bash
git commit -m "feat(solver): 控制求解器——温控窗口，过冷同样毁疫苗"
```

---

## 阶段 B — Phaser 骨架（先证"进副本/回镇/存进度"的壳，内容占位）

### Task B1: 装 Phaser，起一个能跑的空场景

**Files:**
- Modify: `package.json`（加 `"phaser": "^4.0.0"` 到 dependencies）
- Create: `game/main.ts`（Phaser.Game 入口）
- Create: `game/scenes/Boot.ts`
- Modify: `index.html`（`<script>` 指向 `game/main.ts`；移除对 `web/main.ts` 的引用）

**Step 1:** `npm i phaser@^4.0.0` → Expected: added。
**Step 2:** 写 `game/main.ts`：new Phaser.Game，parent=一个 `#app` div，一个 Boot 场景在中间画一行字 "虾米镇"。
**Step 3:** `npm run dev`，Playwright 起页面截图，确认 canvas 里有那行字（不是白屏）。
**Step 4: Commit** `chore(game): 接入 Phaser，空场景可跑`

> 判据自检（写进冒烟）：先断言"canvas 存在且非纯白"，再故意把场景 key 写错，确认冒烟能红——证明这条判据不是永远绿。

### Task B2: 小镇场景 `Town` —— 像素背景 + 可点地点 + 委托板

**Files:**
- Create: `game/scenes/Town.ts`
- Create: `game/data/town.ts`（地点坐标、名字、状态；含"社区诊所"）
- Test: `scripts/smoke-town.mjs`

**内容：** 载入 `web/assets/xiami-town-dusk.png` 当背景；在诊所位置放一个可点热区 + "!" 标记 + "冷藏柜停了" 标签；
点它 → 弹委托板（问题→原理→实验→完成 四步骨架）+ "进入副本" 按钮。委托状态从一个 `progress`（localStorage）读。
**冒烟判据：** 页面起来 → 点诊所 → 委托板出现且标题正确 → "进入副本"按钮可点。自检：把热区挪出屏幕，确认点不到、冒烟红。
**Commit** `feat(town): 小镇场景——诊所委托入口`

### Task B3: 进副本 / 回镇 / 存进度（先接空副本，坐实闭环）

**Files:**
- Create: `game/scenes/Instance.ts`（暂时只画"副本占位 + 完成修复按钮"）
- Create: `game/save.ts`（localStorage 存/取 `progress`）
- Modify: `game/scenes/Town.ts`（"进入副本"→ `scene.start('Instance')`；副本"完成修复"→写 progress→`scene.start('Town')`）
- Test: `scripts/smoke-loop.mjs`

**冒烟判据（这一步是整个第一版的地基，判据要硬）：**
1. 点诊所→进副本→场景真的切了（Town 不在、Instance 在）
2. 点"完成修复"→回到 Town
3. 回到 Town 后诊所标记变"已恢复"
4. **刷新页面，诊所仍是"已恢复"**（progress 真存下来了）
5. 自检：清掉 localStorage，确认诊所回到"未修"——证明第 4 条不是永远绿
**Commit** `feat(loop): 进副本→修复→回镇→存进度 闭环打通（副本内容占位）`

---

## 阶段 C — 副本三层（把占位换成真玩法）

### Task C1: 大空间 + 工具扫（热成像揭示异常）

**Files:**
- Modify: `game/scenes/Instance.ts`（改成两级：先大空间）
- Create: `game/instance/overview.ts`（制冷系统全景：压缩机/管路/散热片几个点）
- Create: `chapters/fridge/index.ts`（副本数据：三层配置、每层的求解器入参、助手候选变量、台词锚点）
- Test: `scripts/smoke-scan.mjs`

**内容：** 大空间里几个部件点；给玩家一个"热成像"工具（按钮/快捷键切换），切到热成像模式时，
**每个点的颜色由 `solveThermal` 的局部温度决定**（散热片那点因 Rcond 大而通红）。点通红的散热片 → 钻进去（进 C2）。
**铁律落地：** 热图颜色不是美术手绘，是 solver 数值映射。冒烟断言：默认视图看不出异常；切热成像后散热片点的"热度"数值 > 其它点一截；自检：把 Rcond 调回正常，确认散热片不再最红、冒烟红。
**Commit** `feat(instance): 大空间 + 热成像工具，异常由求解器点亮`

### Task C2: 层内对照实验（你选变量 → 跑 → 曲线分叉 → 看懂）

**Files:**
- Create: `game/instance/experiment.ts`（对照实验台：选变量、跑、画两条温度曲线）
- Modify: `chapters/fridge/index.ts`（"热"层的候选变量：散热热阻/环境温/风扇；正解=散热热阻）
- Test: `scripts/smoke-experiment.mjs`

**内容：** 钻进散热片后，进对照实验台：助手给候选变量短名单（来自 solver 参数），你选一个，A/B 两组只这个变量不同，
点"跑"→ 两条曲线分叉（数据来自 `solveThermal` 两次调用）。选中"散热热阻"跑出来分叉最大 → 结论"制冷=搬热，堵了就搬不动"。
**冒烟断言：** 选散热热阻跑，两条曲线终值差 > 阈值；选一个无关变量跑，几乎不分叉（对照有区分度）；结论文本里的数来自 solver。
自检：把两组入参设成完全一样，确认曲线重合、"看懂"不触发、冒烟红。
**Commit** `feat(instance): 对照实验——选变量、跑、曲线分叉、现算结论`

### Task C3: 修复热层 + 触发控制层反转（太冷）+ 完成

**Files:**
- Modify: `game/instance/*`（清灰动作 → Rcond 复位 → 柜温下降动画；随后温控窗口不对 → 结冰告警 → 调窗口）
- Modify: `chapters/fridge/index.ts`（控制层：初始窗口过低，正解 2–8℃）
- Modify: `game/scenes/Instance.ts`（三层走完 → "完成修复"生效）
- Test: `scripts/smoke-fix-chain.mjs`

**内容：** 清灰 → `solveThermal` 的 Rcond 复位 → 柜温曲线下压（真数值驱动）→ 但控制窗口过低 → `solveControl` 判 frozen →
助手示警"太冷也废"→ 你调窗口到 2–8℃ → `solveControl` 判 safe → 三层完成 → "完成修复"点亮 → 回镇解锁。
**冒烟断言：** 清灰后柜温真的降了（前后 solver 值对比）；不调窗口时 frozen 挡住"完成"；调到 2–8℃ 后 safe、可完成。
自检：把正确窗口也设成 frozen 区间，确认"完成"永远点不亮、冒烟红。
**Commit** `feat(instance): 修复→过冷反转→调窗口 三层连锁走通`

---

## 阶段 D — AI 助手接口 + 收尾

### Task D1: `PartnerBrain` 接口（脚本实现，留真模型的形状）

**Files:**
- Create: `agents/partner.ts`（`interface PartnerBrain { react(facts): Promise<Line|null> }`；`ScriptedPartner` 先实现）
- Modify: `game/instance/*`（认知节点调用 partner.react，机械操作不调）
- Test: `tests/partner.test.ts`

**要点：** `facts` 入参已经是将来发给模型的事实清单（当前层、候选变量、solver 读数、玩家干过什么）。
**只在认知节点调**（进副本、扫出异常、选变量前、跑出分叉、结冰示警）——机械操作（走位、拖拽本身）不调。
铁律断言：喂一份假 facts，助手回复里出现 facts 里没有的数字 → 判为"编"，测试标红（第一版记录不拦截，但断言能识别）。
**Commit** `feat(agent): PartnerBrain 接口——认知节点触发，脚本实现，留真模型形状`

> 真模型端点/模型选择：留给用户定（花钱决定）。`ScriptedPartner` 换 `ModelPartner` 不动调用方。

### Task D2: 归档灯泡原型遗产 + 全绿收尾

**Files:**
- Move: `web/main.ts` `web/hud.css` `world/state.ts` `agents/npc.ts` `chapters/ch1-light/` → `_legacy/`
- Modify: `README.md`（更新为 Phaser 形态 + 冷藏柜副本）
- Modify: `tsconfig.json`（include 改到 game/）

**收尾核验（verification-before-completion）：**
`npm test`（求解器全绿 + 自检能红）· `npm run typecheck` · `npm run build` · 全部冒烟脚本绿 · `git status` 只含本次改动。
**Commit** `chore: 归档灯泡原型，README/tsconfig 转向 Phaser 形态`

---

## 里程碑判据（做完这份计划，能回答的那个问题）

不懂制冷的人，进副本，五分钟内：**被"通着电却是热的"勾住 → 拿热成像扫出堵点 → 自己摆对照看懂"制冷=搬热" → 清灰修好 → 撞见"太冷也废"的反转 → 调好窗口 → 回镇解锁**。玩完他觉得**这五分钟不无聊、而且真学到了点什么**。
这个只能人玩了判，测不了——但上面每个 Task 的自检保证：**每一步的因果都由求解器算、都能被判红。**
