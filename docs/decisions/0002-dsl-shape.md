# ADR 0002 · DSL 的形状

**日期**：2026-08-17
**状态**：已验证（阶段 0）

## 决定

```ts
type SimDocument = {
  kind: string
  params: Attrs                                  // 扁平标量
  entities: { id, type, at?, attrs }[]           // 带时间锚点的记录
  streams: { name, values: (number|string)[] }[] // 密集位置数据
}
```

## 为什么是这个形状

### 约束来自结构化输出

Claude 的结构化输出用 JSON Schema，而它的 schema 支持是**受限的**：

| 能力 | 支持？ | 后果 |
|---|---|---|
| 基本类型 / `enum` / `const` / `anyOf` / `$ref` | ✅ | 可用 |
| `additionalProperties: false` | ✅ | 必须显式声明 |
| **递归 schema** | ❌ | DSL 不能是任意深度的树，必须扁平、深度有限 |
| **数值约束**（`minimum`/`maximum`/`multipleOf`） | ❌ | "块大小必须是 2 的幂"schema 管不了 |
| **字符串约束**（`minLength`/`maxLength`） | ❌ | 同上 |

**两条直接推论**：

1. **不能递归 → 做成"填表"而不是"写程序"。** 这反而是好事，它逼出了 L1/L2/L3 的分层。
2. **不能有数值约束 → 验证器从可选变必需。** 范围规则只能在验证器里管。

另：新 schema 首次请求有编译开销，之后缓存 24 小时 → **schema 要稳定，别频繁改结构**。

### `entities` 和 `streams` 为什么是两个，不是一个

阶段 0 的实测结论（`logs/2026-08-17-phase0.md`）：

- 调度的 `processes` 和 TCP 的 `lossEvents` **确实是同一个形状** —— 都是"在时刻 T 有个东西"，
  用 `at` 当锚点 → 合并成 `entities` ✅
- Cache 的 `accessSequence` **确实不是** —— 1000 条地址写成 1000 个 `Entity` 会把 JSON 撑爆，
  而且每项没有独立元数据 → 必须留 `streams` ✅

原本担心这是"为了统一而拼接"（union by concatenation 的坏味道），
实测下来是真的两种东西。**这个二分是被数据逼出来的，不是预设的。**

## 后果

- 领域内核通过 `doc.entities.filter(e => e.type === '...')` 和
  `doc.streams.find(s => s.name === '...')` 取自己要的东西 —— 这一段就是接缝 1 的实际内容
- 范围校验（2 的幂、正数、枚举合法性）必须写在验证器里，schema 层管不了
- `entities` 未来要支持嵌套（`contains` / `containedBy`），
  给逆向拆解的层级结构和手搓 CPU 的"黑盒器件"用 —— 但**不能靠 schema 递归实现**，
  得用扁平的父子 id 引用

## 被否决的方案

**"一切都是 entities"** —— 把 accessSequence 也写成 entity 列表。
形式上更统一，但 1000 个地址 = 1000 个对象，JSON 体积和 AI 生成成本都不可接受。
