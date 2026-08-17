# 许可证台账

**核对日期**：2026-08-17
**纪律**：看仓库里的 LICENSE 文件，不信 GitHub 侧栏的 SPDX 标签。

## 可用（进闭源产品）

| 项目 | 许可证 | 用途 | 说明 |
|---|---|---|---|
| **MuJoCo** + 官方 WASM 绑定 | `Apache 2.0` | 机器人学物理内核 | Google DeepMind 维护，npm 上是 `mujoco-js`。**物理内核不用自己写** |
| **urdf-loader** | `Apache 2.0` | URDF 解析 + Three.js 渲染 | 含 NASA JPL 开源的 ATHLETE URDF |
| **three.js** | `MIT` | 3D 渲染 | — |
| **SceneryStack** | `MIT` | 可参考的场景图库 | 官方写明 "freely available for use by anyone" |
| PhET 可复用库依赖 | `MIT` | — | — |

## 不可用（进不了闭源产品）

| 项目 | 许可证 | 替代做法 |
|---|---|---|
| PhET 仿真源码 | `GPLv3` | **只学设计模式，不抄代码**。模式不受版权保护 |
| Logisim-evolution | `GPL-3.0`（浏览器版 GPL-2.0 + WASM） | 可当**验证器的外部参考基准** —— 跑它、比对输出，不链接代码 |
| KiCad | `GPL v3` | 同上。注意："允许用它做商业产品"≠"把代码链进闭源软件分发" |
| 嘉立创 EDA / EasyEDA | 闭源专有 | 只能当用户。2010 年起，独立自主知识产权，个人免费但不开源 |

## 开放格式（不受许可证约束）

| 格式 | 用途 |
|---|---|
| **Gerber (RS-274X)** / Excellon / IPC-2581 / ODB++ | PCB 制造 → 嘉立创打板 |
| **URDF** | 机器人描述 → ROS / Gazebo / Isaac / MuJoCo 都吃 |

> **这一行是"设计→实体"那条路的钥匙。**
> 不做 PCB 编辑器（跟 KiCad 正面竞争赢不了），做**能导出 Gerber 的窄场景领域编辑器** ——
> 手搓光刻机的图案设计器、自制键盘的布局器。工程量小两个数量级，用户拿到的实物一样。
> 机器人学的对应物是 URDF 导出。

## 一条反直觉的结论

**机器人学是六条路里现成积木最多、许可证最干净的一条。**
EDA 那边全是 GPL 或闭源；机器人这边 MuJoCo / urdf-loader / three.js 全是 Apache 2.0 或 MIT。
最初把机器人学估成"最贵"，那个判断错了 —— 物理内核根本不用写。

## 当前实际依赖

| 包 | 许可证 | 用途 |
|---|---|---|
| `tsx` | MIT | TS 直跑 |
| `typescript` | Apache 2.0 | 类型检查 |
| `@types/node` | MIT | Node 类型 |

零运行时依赖。
