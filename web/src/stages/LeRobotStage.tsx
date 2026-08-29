/** 舞台：LeRobot × SO-101 —— 工作流进度 + 真算FK的SO-101手臂抓取仿真 + 真实CLI命令 */
import type { LeRobotState } from '@engine/kernels/lerobot.ts'
import type { StageProps } from '../types.ts'

const SZ = 300, PAD = 20
const XMIN = -2, XMAX = 5, YMIN = -3, YMAX = 4.5
const SC = Math.min((SZ - 2 * PAD) / (XMAX - XMIN), (SZ - 2 * PAD) / (YMAX - YMIN))
const sx = (x: number) => PAD + (x - XMIN) * SC
const sy = (y: number) => SZ - PAD - (y - YMIN) * SC

const STAGES = ['① 硬件', '② 装配标定', '③ 采集示范', '④ 训练', '⑤ 部署'] as const
const stageIdx = (phase: string) => ({ intro: -1, hardware: 0, setup: 1, record: 2, train: 3, deploy: 4, done: 4 } as Record<string, number>)[phase] ?? -1

export function LeRobotStage({ state }: StageProps<LeRobotState>) {
  const { phase, cmd, armPts, gripper, objPos, holding, poseName, focus } = state
  const done = phase === 'done'
  const cur = stageIdx(phase)
  const end = armPts[armPts.length - 1]!
  const tipAng = Math.atan2(end[1] - armPts[armPts.length - 2]![1], end[0] - armPts[armPts.length - 2]![0])
  const gw = gripper === 'closed' ? 0.18 : 0.42   // 夹爪开合半角
  const finger = (s: number): [number, number] => [end[0] + 0.5 * Math.cos(tipAng + s * gw), end[1] + 0.5 * Math.sin(tipAng + s * gw)]
  const f1 = finger(1), f2 = finger(-1)

  return (
    <div className="card">
      <h3>LeRobot × SO-101 开源实战 <span className="hint">低成本机械臂：装配→采集→训练(ACT)→自主抓取；手臂动作真算 FK</span></h3>
      <div className="body">
        {/* 工作流进度 */}
        <div className="lr-flow">
          {STAGES.map((s, i) => (
            <span key={s} className={`lr-stage ${cur === i ? 'on' : cur > i ? 'done' : ''}`}>{s}</span>
          ))}
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${SZ} ${SZ}`} width={SZ} height={SZ}>
            {[-1, 0, 1, 2, 3, 4].map(x => <line key={'gx' + x} x1={sx(x)} y1={sy(YMIN)} x2={sx(x)} y2={sy(YMAX)} className="fk-grid" />)}
            {[-2, 0, 2, 4].map(y => <line key={'gy' + y} x1={sx(XMIN)} y1={sy(y)} x2={sx(XMAX)} y2={sy(y)} className="fk-grid" />)}
            {/* 桌面 */}
            <line x1={sx(XMIN)} y1={sy(-2.2)} x2={sx(XMAX)} y2={sy(-2.2)} className="lr-table" />
            {/* 手臂连杆 */}
            {armPts.slice(0, -1).map((p, i) => <line key={'seg' + i} x1={sx(p[0])} y1={sy(p[1])} x2={sx(armPts[i + 1]![0])} y2={sy(armPts[i + 1]![1])} className="lr-link" />)}
            {armPts.map((p, i) => <circle key={'j' + i} cx={sx(p[0])} cy={sy(p[1])} r={i === 0 ? 5 : 3.5} className={`lr-joint ${i === 0 ? 'base' : ''}`} />)}
            {/* 夹爪两指 */}
            <line x1={sx(end[0])} y1={sy(end[1])} x2={sx(f1[0])} y2={sy(f1[1])} className="lr-finger" />
            <line x1={sx(end[0])} y1={sy(end[1])} x2={sx(f2[0])} y2={sy(f2[1])} className="lr-finger" />
            {/* 方块 */}
            <rect x={sx(objPos[0]) - 6} y={sy(objPos[1]) - 6} width={12} height={12} className={`lr-cube ${holding ? 'held' : ''}`} />
            {/* 底座 */}
            <polygon points={`${sx(0) - 10},${sy(0) + 16} ${sx(0) + 10},${sy(0) + 16} ${sx(0)},${sy(0)}`} className="fk-mount" />
          </svg>

          <div className="fk-side">
            <div className="km-legend">
              <span><i className="km-dot" style={{ background: 'var(--now)' }} />SO-101 手臂</span>
              <span><i className="km-dot" style={{ background: 'var(--ink)' }} />方块</span>
            </div>
            {poseName && <div className={`lr-pose ${holding ? 'hold' : ''}`}>部署执行：<b>{poseName}</b>（夹爪{gripper === 'closed' ? '合' : '开'}{holding ? '、抓住方块' : ''}）</div>}
            {cmd && (
              <div className="lr-cmd">
                <div className="lr-cmdh">真实命令（LeRobot 官方）</div>
                <pre>{cmd}</pre>
              </div>
            )}
          </div>
        </div>

        {done
          ? <p className="scnote">SO-101(6 舵机 5 自由度+夹爪、leader/follower)+ LeRobot：<b>装配标定→leader 遥操 follower 采集≥50 段示范→lerobot-train 训 ACT→lerobot-rollout 自主抓取</b>。上面这段抓取是<b>真算的</b>——手臂每帧位姿由四连杆正运动学从关节角现算、方块抓住后跟夹爪走(真机上 LeRobot 用 MuJoCo/硬件，机制一样)。这把整条具身链路(运动学/感知/控制/模仿学习/VLA)落到<b>你能自己搭</b>的硬件上。命令照抄自官方文档。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{phase === 'record' ? 'leader 臂当遥操手柄、follower 实时跟随，把相机+关节+动作录成 LeRobot 数据集(模仿学习的示范)。' : phase === 'train' ? 'ACT=动作分块 Transformer，一次预测一整段动作缓解复合误差；也可 Diffusion Policy / π0(VLA)。' : phase === 'deploy' ? '训练好的策略自主驱动手臂——这段位姿是四连杆正运动学真算出来的(真实模拟引擎)。' : '一步步跟着真实命令走：装配→标定→采集→训练→部署。'}</p>}
      </div>
    </div>
  )
}
