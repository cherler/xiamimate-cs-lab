/** 舞台：反向传播 —— 计算图前向算值、反向逐站回传梯度(链式法则) */
import type { BackpropState } from '@engine/kernels/backprop.ts'
import type { StageProps } from '../types.ts'

export function BackpropStage({ state }: StageProps<BackpropState>) {
  const { phase, x, w, b, t, z, a, loss, gLda, gLdz, gLdw, gLdb, stage } = state
  const back = phase === 'back' || phase === 'done'
  // 节点：id, x, y, 前向标签+值, 反向梯度
  const Node = ({ nx, ny, label, val, grad }: { nx: number; ny: number; label: string; val: number; grad: number | null }) => (
    <g>
      <rect x={nx - 11} y={ny - 8} width="22" height="16" rx="3" className="bpnode" />
      <text x={nx} y={ny - 1.5} textAnchor="middle" className="bplabel">{label}</text>
      <text x={nx} y={ny + 5} textAnchor="middle" className="bpval">{val}</text>
      {grad !== null && grad !== undefined && (
        <text x={nx} y={ny + 15} textAnchor="middle" className="bpgrad">∂L={grad}</text>
      )}
    </g>
  )
  return (
    <div className="card">
      <h3>反向传播 <span className="hint">链式法则把"误差"逐层回传成每个权重的梯度</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{phase === 'forward' ? '前向' : phase === 'done' ? '完成' : '反向'}</span><span className="scdl">当前趟</span></div>
          <div className="scdk"><span className="scdn hot">{loss}</span><span className="scdl">损失 L</span></div>
          <div className="scdk"><span className="scdn">{stage || '—'}</span><span className="scdl">回传到</span></div>
        </div>

        <div className="bpwrap">
          <svg className="bpplot" viewBox="0 0 100 56" preserveAspectRatio="xMidYMid meet">
            {/* 边 */}
            <g className="bpedge">
              <line x1="19" y1="14" x2="31" y2="28" /><line x1="19" y1="28" x2="31" y2="28" /><line x1="19" y1="42" x2="31" y2="28" />
              <line x1="49" y1="28" x2="61" y2="28" /><line x1="73" y1="28" x2="85" y2="28" />
            </g>
            {/* 反向大箭头 */}
            {back && <path d="M92 48 L10 48" className="bpback" markerEnd="url(#bp-a)" />}
            <defs><marker id="bp-a" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="var(--miss)" /></marker></defs>
            {back && <text x="50" y="46" textAnchor="middle" className="bpbacklab">梯度回传方向</text>}
            {/* 节点 */}
            <Node nx={12} ny={14} label="w" val={w} grad={back ? gLdw : null} />
            <Node nx={12} ny={28} label="x" val={x} grad={null} />
            <Node nx={12} ny={42} label="b" val={b} grad={back ? gLdb : null} />
            <Node nx={40} ny={28} label="z=wx+b" val={z} grad={gLdz} />
            <Node nx={66} ny={28} label="a=σ(z)" val={a} grad={gLda} />
            <Node nx={90} ny={28} label={`L(t=${t})`} val={loss} grad={back ? 1 : null} />
          </svg>
          <div className="orcap">
            {phase === 'forward' ? '前向:数据 w,x,b → z → a → L,一路算到损失'
              : phase === 'done' ? '反向完成:每个权重的梯度都算出来了(∂L 标在节点下)'
              : `反向:${stage}——下游梯度 × 本站局部导数 = 上游梯度`}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">一次反向传播,把 L 对每个权重的梯度全算出来:dL/dw=<b>{gLdw}</b>、dL/db=<b>{gLdb}</b>(都是负的→梯度下降会增大 w、b,把 a 往 t=1 推、损失降)。核心就一句:<b>下游梯度 × 本站局部导数 = 上游梯度</b>,链一串把误差从损失回传到最前面的权重。一趟就出全部梯度、和参数量成正比——这就是深度学习能训上亿参数的<b>发动机</b>。它和「梯度下降」「残差=梯度高速路」是一条线。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{phase === 'forward' ? '先前向:把输入一路算到损失 L。下一步开始反向,从 L 出发往回传梯度。' : `sigmoid 这站局部导数是 a(1−a)、乘法这站是"另一个数"。每站只管自己那点局部导数,链式法则一乘就把梯度接着往上游传。`}</p>}
      </div>
    </div>
  )
}
