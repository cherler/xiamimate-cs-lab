/** 舞台：沙箱/权限 —— 4 段决议(定性→规则→沙箱→结局)逐操作点亮 + 决议历史累积 */
import type { PermState, Resolved } from '@engine/kernels/permguard.ts'
import type { StageProps } from '../types.ts'

type Box = 'pass' | 'warn' | 'fail' | 'skip' | 'info'
function boxes(res: Resolved, effLabel: string): { k: string; v: string; s: Box }[] {
  const rule: Box = res.rule === 'allow' ? 'pass' : res.rule === 'ask' ? 'warn' : 'fail'
  const sand: Box = res.sandbox === 'ok' ? 'pass' : res.sandbox === 'escalate' ? 'warn' : res.sandbox === 'block' ? 'fail' : 'skip'
  const out: Box = res.final === 'blocked' ? 'fail' : res.final === 'escalate-run' || res.final === 'ask-run' ? 'warn' : 'pass'
  return [
    { k: '定性', v: effLabel, s: 'info' },
    { k: '规则', v: res.rule === 'allow' ? 'allow' : res.rule === 'ask' ? 'ask' : 'deny', s: rule },
    { k: '沙箱', v: res.sandbox === 'skip' ? '—' : res.sandbox === 'ok' ? 'ok' : res.sandbox === 'escalate' ? '升级' : 'block', s: sand },
    { k: '结局', v: res.final === 'blocked' ? '拒绝' : '运行', s: out },
  ]
}
const ICON: Record<Box, string> = { pass: '✓', warn: '!', fail: '✗', skip: '·', info: '›' }

export function PermGuardStage({ state }: StageProps<PermState>) {
  const { stage, mode, cur, op, res, history, total } = state
  const intro = cur < 0

  return (
    <div className="card">
      <h3>沙箱 / 权限 <span className="hint">模型想跑命令，放不放行：规则(deny→ask→allow) + 沙箱(fail-closed)</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{mode}</span><span className="scdl">权限模式</span></div>
          <div className="scdk"><span className={`scdn ${res?.final === 'blocked' ? 'hot' : ''}`}>{intro ? '—' : res?.fLabel.replace(/^[✅⛔]\s*/, '')}</span><span className="scdl">本操作结局</span></div>
          <div className="scdk"><span className="scdn">{history.filter(h => h.final !== 'blocked').length}跑 / {history.filter(h => h.final === 'blocked').length}拦</span><span className="scdl">已判</span></div>
        </div>

        {!intro && res && (
          <div className="pg-pipe">
            {boxes(res, op!.eLabel).map((b, idx) => (
              <div key={b.k} className={`pg-st ${b.s}`}>
                <span className="pg-sic">{ICON[b.s]}</span>
                <span className="pg-slb">{b.k}</span>
                <span className="pg-sv">{b.v}</span>
                {idx < 3 && <span className="pg-arrow">→</span>}
              </div>
            ))}
          </div>
        )}

        {intro
          ? (
            <div className="pg-intro">
              <div className="pg-intro-h">模型这一轮想跑 {total} 个操作（模式：<b>{mode}</b>）：</div>
              <div className="pg-raw">read · edit · rm -rf · curl · write /etc/hosts</div>
              <div className="pg-walls">两道<b>相互独立</b>的墙：① <b>规则/审批</b>（deny→ask→allow，首次匹配）② <b>沙箱</b>（物理隔离，网络默认关、写只在工作区内，<b>fail-closed</b>）。两墙都过才真跑。切上面的模式看结局怎么变。</div>
            </div>
          ) : op && res && (
            <div className={`pg-cur ${res.final === 'blocked' ? 'blocked' : res.final === 'run' || res.final === 'ask-run' ? 'ok' : 'warn'}`}>
              <div className="pg-cur-cmd"><code>{op.cmd}</code><span className="pg-eff">{op.eLabel}</span></div>
              <div className="pg-why"><b>规则</b>：{res.ruleWhy}</div>
              {res.sandbox !== 'skip' && <div className="pg-why"><b>沙箱</b>：{res.sandboxWhy}</div>}
              <div className={`pg-final ${res.final === 'blocked' ? 'bad' : 'good'}`}>{res.fLabel}</div>
            </div>
          )}

        <div className="pg-hist">
          <div className="pg-hist-h">决议历史：</div>
          {history.length === 0
            ? <div className="pg-empty">还没有——逐个判后出现</div>
            : history.map((h, i) => (
              <div key={i} className={`pg-hi ${h.final === 'blocked' ? 'bad' : h.final === 'run' || h.final === 'ask-run' ? 'ok' : 'warn'}`}>
                <span className="pg-hi-c">{h.cmd}</span>
                <span className="pg-hi-l">{h.label}</span>
              </div>
            ))}
        </div>

        {stage === 'done'
          ? <p className="scnote"><b>{history.filter(h => h.final !== 'blocked').length} 跑 / {history.filter(h => h.final === 'blocked').length} 拦</b>。要点：<b>两道墙相互独立</b>（网络那条连"放行"模式都被沙箱拦住）；<b>deny 优先、首次匹配</b>；<b>fail-closed</b>（宁可拦错不放过）；越权是<b>一次性升级</b>（带理由+一次批准，不给 allow-always，防权限蔓延）；模式是"安全↔顺手"的滑杆。这套决议是确定性的——不是模型说了算。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
