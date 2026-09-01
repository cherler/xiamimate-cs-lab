/** 舞台：主从遥操作 —— 6 关节表逐列现算(leader码→标定角→跳变Δ→安全钳后目标)，抖动关节高亮 */
import type { TeleState, Joint } from '@engine/kernels/teleop.ts'
import type { StageProps } from '../types.ts'

export function TeleopStage({ state }: StageProps<TeleState>) {
  const { stage, safety, maxRel, joints, showTick, showAngle, showGoal, clampedN } = state

  return (
    <div className="card">
      <h3>主从遥操作 <span className="hint">SO-101 一对同构臂：人拧 leader、follower 跟随；采集示教数据的入口</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{safety === 'on' ? '开' : '关'}</span><span className="scdl">安全钳</span></div>
          <div className="scdk"><span className="scdn">±{maxRel}<em className="cc-u">°</em></span><span className="scdl">max_relative_target</span></div>
          <div className="scdk"><span className={`scdn${showGoal && clampedN ? ' tp-bad' : ''}`}>{showGoal ? clampedN : '—'}</span><span className="scdl">被钳关节</span></div>
          <div className="scdk"><span className="scdn">{joints.length}</span><span className="scdl">关节</span></div>
        </div>

        <div className="tp-wrap">
          <table className="tp-table">
            <thead>
              <tr>
                <th className="l">关节</th>
                <th className={showTick ? '' : 'off'}>leader 码</th>
                <th className={showAngle ? '' : 'off'}>标定角°</th>
                <th className={showGoal ? '' : 'off'}>follower 当前°</th>
                <th className={showGoal ? '' : 'off'}>跳变 Δ°</th>
                <th className={showGoal ? 'hot' : 'off'}>目标角°(钳后)</th>
              </tr>
            </thead>
            <tbody>
              {joints.map((j: Joint, r: number) => (
                <tr key={r} className={showGoal && j.clamped ? 'tp-clamped' : ''}>
                  <td className="l">{j.name}</td>
                  <td>{showTick ? j.leaderTick : '—'}</td>
                  <td>{showAngle ? j.leaderDeg : '—'}</td>
                  <td>{showGoal ? j.present : '—'}</td>
                  <td className={showGoal && Math.abs(j.delta) > maxRel ? 'tp-big' : ''}>{showGoal ? j.delta : '—'}</td>
                  <td className={showGoal ? 'hot' : ''}>{showGoal ? (j.clamped ? <><b>{j.goal}</b><em className="tp-clamptag"> 钳</em></> : j.goal) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showGoal && (
          <div className={`tp-note${safety === 'off' ? ' tp-danger' : ''}`}>
            {safety === 'on'
              ? <>安全钳<b>开</b>：<b>腕转 wrist_roll</b> 一步要跳 Δ={joints[4]!.delta}°（通信抖动），被钳到 ±{maxRel}° → 目标只挪到 {joints[4]!.goal}°，follower 平稳。写下目标后<b>舵机内部 PID</b> 把当前角驱动过去。</>
              : <>安全钳<b>关（直通）</b>：<b>腕转 wrist_roll</b> 目标直接 = {joints[4]!.leaderDeg}°，follower 跟着<b>急跳 {joints[4]!.delta}°</b>——真机上就是一次危险甩臂、可能撞坏。这就是为什么要开 max_relative_target。</>}
          </div>
        )}

        {stage === 'done'
          ? <p className="scnote"><b>遥操作 = 采集示教数据的入口</b>：① <b>同构臂直接抄关节角、不用 IK</b>（结构不同才要重定向）；② 原始码 0~4095 要<b>标定</b>(角=(码−homing_offset)×360/4096)；③ <b>max_relative_target</b> 每步限幅 ±{maxRel}°、防抖动急跳；④ 写目标后<b>舵机 PID 内环</b>执行。<b>闭环</b>：遥操作同步录下 (observation.state, action) —— 正是 <b>ACT/Diffusion/BC 的示教数据集</b>；FK 可把关节角画成末端轨迹。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
