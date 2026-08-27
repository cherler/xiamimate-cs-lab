/** 舞台：弹性碰撞沙盘 —— 实时跑开源物理引擎 Matter.js，小球弹性碰撞，可拖拽/加球/开关重力，实时显示守恒律 */
import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import type { CollisionState } from '@engine/kernels/collision.ts'
import type { StageProps } from '../types.ts'

const W = 560, H = 360
const COLORS = ['#3b82f6', '#0E7561', '#8A5A00', '#B33B25', '#7c3aed', '#0891b2', '#be123c', '#15803d']
const rand = (() => { let s = 20260826; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff })()

export function CollisionStage(_props: StageProps<CollisionState>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const [playing, setPlaying] = useState(true)
  const [gravity, setGravity] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [readout, setReadout] = useState({ ke: 0, p: 0, n: 0 })

  useEffect(() => {
    const M = Matter
    const engine = M.Engine.create()
    engineRef.current = engine
    engine.gravity.y = 0
    const render = M.Render.create({
      canvas: canvasRef.current!, engine,
      options: { width: W, height: H, wireframes: false, background: 'transparent', pixelRatio: Math.min(2, window.devicePixelRatio || 1) },
    })
    const t = 60
    const wallOpt = { isStatic: true, restitution: 1, friction: 0, render: { fillStyle: 'rgba(120,120,140,0.12)' } }
    const walls = [
      M.Bodies.rectangle(W / 2, -t / 2 + 1, W + 2 * t, t, wallOpt),
      M.Bodies.rectangle(W / 2, H + t / 2 - 1, W + 2 * t, t, wallOpt),
      M.Bodies.rectangle(-t / 2 + 1, H / 2, t, H, wallOpt),
      M.Bodies.rectangle(W + t / 2 - 1, H / 2, t, H, wallOpt),
    ]
    const mkBall = (x: number, y: number, vx: number, vy: number, r: number, c: string) => {
      const b = M.Bodies.circle(x, y, r, {
        restitution: 1, friction: 0, frictionAir: 0, frictionStatic: 0, slop: 0.02,
        render: { fillStyle: c },
      })
      M.Body.setVelocity(b, { x: vx, y: vy })
      return b
    }
    const balls = Array.from({ length: 6 }, (_, k) => {
      const ang = rand() * Math.PI * 2, sp = 5 + rand() * 3
      return mkBall(60 + rand() * (W - 120), 60 + rand() * (H - 120), Math.cos(ang) * sp, Math.sin(ang) * sp, 16 + k * 3, COLORS[k % COLORS.length])
    })
    M.Composite.add(engine.world, [...walls, ...balls])

    const mouse = M.Mouse.create(render.canvas)
    const mc = M.MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.15, render: { visible: false } } })
    M.Composite.add(engine.world, mc)
    render.mouse = mouse
    // 让页面滚动不被 canvas 吞掉
    mouse.element.removeEventListener('wheel', (mouse as unknown as { mousewheel: EventListener }).mousewheel)

    M.Render.run(render)
    const runner = M.Runner.create()
    M.Runner.run(runner, engine)

    let frame = 0
    const onTick = () => {
      if (frame++ % 6 !== 0) return
      const bodies = M.Composite.allBodies(engine.world).filter(b => !b.isStatic)
      let ke = 0, px = 0, py = 0
      for (const b of bodies) {
        const v2 = b.velocity.x ** 2 + b.velocity.y ** 2
        ke += 0.5 * b.mass * v2
        px += b.mass * b.velocity.x; py += b.mass * b.velocity.y
      }
      setReadout({ ke: Math.round(ke / 10), p: Math.round(Math.hypot(px, py) / 2), n: bodies.length })
    }
    M.Events.on(engine, 'afterUpdate', onTick)

    return () => {
      M.Events.off(engine, 'afterUpdate', onTick)
      M.Render.stop(render); M.Runner.stop(runner)
      M.World.clear(engine.world, false); M.Engine.clear(engine)
      render.canvas.getContext('2d')?.clearRect(0, 0, render.canvas.width, render.canvas.height)
      engineRef.current = null
    }
  }, [resetKey])

  useEffect(() => { if (engineRef.current) engineRef.current.timing.timeScale = playing ? 1 : 0 }, [playing])
  useEffect(() => { if (engineRef.current) engineRef.current.gravity.y = gravity ? 1 : 0 }, [gravity])

  const addBall = () => {
    const e = engineRef.current; if (!e) return
    const M = Matter
    const ang = rand() * Math.PI * 2, sp = 5 + rand() * 3
    const b = M.Bodies.circle(W / 2, H / 2, 14 + rand() * 12, {
      restitution: 1, friction: 0, frictionAir: 0, frictionStatic: 0, slop: 0.02,
      render: { fillStyle: COLORS[Math.floor(rand() * COLORS.length)] },
    })
    M.Body.setVelocity(b, { x: Math.cos(ang) * sp, y: Math.sin(ang) * sp })
    M.Composite.add(e.world, b)
  }

  return (
    <div className="card">
      <h3>弹性碰撞沙盘 <span className="hint">实时物理引擎 · 碰撞里动能/动量转移，但总量守恒</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{readout.ke}</span><span className="scdl">总动能(守恒)</span></div>
          <div className="scdk"><span className="scdn">{readout.p}</span><span className="scdl">总动量大小</span></div>
          <div className="scdk"><span className="scdn">{readout.n}</span><span className="scdl">小球数</span></div>
        </div>

        <div className="colwrap">
          <canvas ref={canvasRef} className="colcanvas" style={{ width: W, height: H, maxWidth: '100%' }} />
          <div className="colctrl">
            <button className="colbtn" onClick={() => setPlaying(p => !p)}>{playing ? '❚❚ 暂停' : '▶ 播放'}</button>
            <button className="colbtn" onClick={addBall}>＋ 加一个球</button>
            <button className={`colbtn ${gravity ? 'on' : ''}`} onClick={() => setGravity(g => !g)}>{gravity ? '重力 开' : '重力 关'}</button>
            <button className="colbtn" onClick={() => setResetKey(k => k + 1)}>↻ 重置</button>
            <span className="colhint">拖动小球可以甩它</span>
          </div>
        </div>

        <p className="scnote">这不是预先算好的逐帧动画,而是**实时跑开源物理引擎 Matter.js**:小球之间、和四壁做**弹性碰撞**(无摩擦)。每次碰撞把**动能、动量**在物体间<b>转移</b>——有的加速、有的减速;但把所有球加起来,<b>总动能守恒、总动量守恒</b>(看上面读数,碰撞再乱总量基本不变;引擎数值积分有极小漂移)。<b>拖</b>球可以甩它、<b>加球</b>看多体、开<b>重力</b>看它们落到底部堆叠。这就是把"看不见的守恒律"变成看得见、摸得着的仿真——物理学科要走的可视化路子。</p>
      </div>
    </div>
  )
}
