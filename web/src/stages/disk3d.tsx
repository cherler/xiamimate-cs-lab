/**
 * 磁盘的**实物视图**（React Three Fiber + drei）。
 *
 * ## 三条边界，是代码约束不是口头约定
 *
 * 1. **只做展示，不承载判定。** 本文件**不许 import `@engine/*`** ——
 *    它拿到的是一个算好的 `DiskView`（几个数、两串磁道号），自己一步仿真都不跑。
 *    屏幕上每个数仍然只有一个来源：那条验过的轨迹。有测试盯着。
 * 2. **按需加载。** 只有切到「实物」才 `lazy()` 进来，首屏包体积不受影响；
 *    起不来（没 WebGL、单文件产物里没这个块）就退回 CSS 版，**不留黑框**。
 * 3. **固定机位。** 不给轨道控制器 —— 这一档是给录屏用的，
 *    镜头能被观众乱转，就没有"同一段 URL 出同一个画面"这回事。
 *
 * ## 为什么用现成的而不是手搓
 *
 * 手搓版为三个 bug 各修了一轮：金属渲成黑的、相机取不下景、磁头臂几何算错。
 * 前两个是 `<Environment>` 和固定构图解决过的问题，第三个是我自己套层级套出来的。
 * 后面还有九个有实物的实验 —— 每个再踩一遍不划算。
 *
 * ⚠️ **`<Environment preset>` 会从 CDN 拉 HDRI**，离线就废、还多一次等待。
 * 这里用 `<Lightformer>` 手搭环境：纯几何、零资产、不联网。
 */
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import type * as TH from 'three'

/** 3D 层能看到的全部东西 —— 没有 SimDocument、没有 Trace、没有内核 */
export type DiskView = {
  maxTrack: number
  head: number
  from: number
  sweep: boolean
  served: number[]
  pending: number[]
  moved: number
}

const R = 4.2, R_HUB = 0.95, PIVOT_X = R + 1.6
/** 磁道 → 半径。跟工程图那一档同一条映射：**磁道 0 在最外圈** */
const rOf = (t: number, maxTrack: number) =>
  R - (R - R_HUB - 0.35) * (Math.max(0, Math.min(maxTrack, t)) / maxTrack)

/**
 * 盘面的两张程序贴图 —— **代码画的，不联网、不占资产**。
 *
 * ## 为什么是"各向异性"，不是"刮痕贴图"
 *
 * 真实盘片之所以一眼是金属，是因为它的高光**沿圆周被拉成一道弧**，
 * 而不是聚成一个圆点 —— 这叫各向异性反射，成因是盘面的同心加工纹路。
 * 只贴一张刮痕图不会改变高光的形状，看着还是塑料。
 *
 * ## 两张图各干什么
 *
 * - `aniso`：每个像素存**那一点的切线方向**（RG 通道，B 是强度）。
 *   圆盘的切线处处垂直于半径，所以高光被沿着圆周拉开。
 *   ⚠️ 它是**方向数据不是颜色**，必须 `NoColorSpace` —— 走 sRGB 会把方向掰弯。
 * - `scratch`：同心细划痕，喂给 roughnessMap。高光被打断成断续的弧，
 *   才不像一块抛光塑料。
 *
 * 两张都在 `useMemo` 里生成一次，切步、拖轴都不会重画。
 */
function usePlatterMaps() {
  return useMemo(() => {
    const S = 512
    //  ── 切向图 ──
    const ac = document.createElement('canvas')
    ac.width = ac.height = S
    const actx = ac.getContext('2d')!
    const img = actx.createImageData(S, S)
    const c = S / 2
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x - c, dy = y - c
        const len = Math.hypot(dx, dy) || 1
        //  切线 = 半径转 90°
        const tx = -dy / len, ty = dx / len
        const i = (y * S + x) * 4
        img.data[i] = Math.round((tx * 0.5 + 0.5) * 255)
        img.data[i + 1] = Math.round((ty * 0.5 + 0.5) * 255)
        //  越靠外纹路越明显（真盘外圈线速度高、加工痕更深）
        img.data[i + 2] = Math.round(Math.min(1, len / c) * 255)
        img.data[i + 3] = 255
      }
    }
    actx.putImageData(img, 0, 0)

    //  ── 同心划痕（粗糙度）──
    const sc = document.createElement('canvas')
    sc.width = sc.height = 1024
    const sctx = sc.getContext('2d')!
    const M = sc.width / 2
    //  基准粗糙度，配 roughness=1 相乘。太低（0.23）会镜面到把环境的硬边照出来，
    //  各向异性再一拉就是黑白断层；0.36 左右是"抛光但不是镜子"。
    sctx.fillStyle = '#5c5c5c'
    sctx.fillRect(0, 0, sc.width, sc.width)
    sctx.lineWidth = 1
    /*  固定的伪随机 —— 不用 Math.random()：同一份代码每次刷新都该画出同一张图，
        否则截图和录屏对不上，也没法说"这一帧是可复现的"。 */
    let seed = 20260819
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let k = 0; k < 1400; k++) {
      const r = (0.12 + rnd() * 0.86) * M
      const a0 = rnd() * Math.PI * 2
      const a1 = a0 + 0.08 + rnd() * 1.2
      const g = 40 + Math.round(rnd() * 70)
      sctx.strokeStyle = `rgba(${g},${g},${g},${0.25 + rnd() * 0.45})`
      sctx.beginPath()
      sctx.arc(M, M, r, a0, a1)
      sctx.stroke()
    }
    return { anisoCanvas: ac, scratchCanvas: sc }
  }, [])
}

function Platter() {
  const ref = useRef<TH.Mesh>(null)
  const geo = useRef<TH.CylinderGeometry>(null)
  const { anisoCanvas, scratchCanvas } = usePlatterMaps()
  //  盘片真的在转（7200 转是这个物件的事实）。磁道圈不跟着转 —— 磁道是位置，不是花纹。
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 2.4 })
  /*  各向异性走切线空间，得让几何体带上 tangent —— 不算的话 three 退回近似，
      高光拉伸的方向会跟盘面纹路对不上。 */
  useEffect(() => { geo.current?.computeTangents() }, [])
  return (
    <mesh ref={ref} castShadow receiveShadow>
      <cylinderGeometry ref={geo} args={[R, R, 0.12, 160]} />
      <meshPhysicalMaterial
        color="#c6d0d9" metalness={1} roughness={1}
        anisotropy={0.55}
        clearcoat={0.3} clearcoatRoughness={0.3}
      >
        <canvasTexture attach="anisotropyMap" args={[anisoCanvas]} colorSpace="" />
        <canvasTexture attach="roughnessMap" args={[scratchCanvas]} colorSpace="" />
      </meshPhysicalMaterial>
    </mesh>
  )
}

function Ring({ r, served }: { r: number; served: boolean }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.065, 0]}>
      <torusGeometry args={[r, 0.026, 8, 160]} />
      <meshBasicMaterial color={served ? '#2fbf8f' : '#6c7a86'}
                         transparent opacity={served ? 0.95 : 0.6} />
    </mesh>
  )
}

function Scene({ view }: { view: DiskView }) {
  const rHead = rOf(view.head, view.maxTrack)
  const rFrom = rOf(view.from, view.maxTrack)
  const armLen = Math.max(0.2, PIVOT_X - rHead)
  const rings = useMemo(() => {
    const served = new Set(view.served)
    return [...new Set([...view.pending, ...view.served])]
      .map(t => ({ t, r: rOf(t, view.maxTrack), served: served.has(t) }))
  }, [view.pending, view.served, view.maxTrack])

  return (
    <>
      {/*  环境全部由 Lightformer 搭出来：不联网、不下贴图，金属才有东西可反射。
           盘片 metalness 0.95 —— 有环境之后才敢开这么高，没环境时它只会一片死黑。 */}
      {/*
        ⚠️ 环境要**四面都有东西**，不能只挂三块灯板。
        金属把"没有灯的方向"原样反射成黑色 —— 第一版三块板，各向异性一拉开，
        盘面就成了黑白相间的油膜（像黑胶不像盘片）。
        现在补一圈围光 + 一块天顶 + 一块地面：反射里处处有东西，明暗才是渐变而不是断层。
      */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={4} position={[-4, 6, 4]} scale={[9, 9, 1]} />
        <Lightformer form="circle" intensity={2.6} position={[5, 4, 3]} scale={5} />
        {/*  一圈围光：八个方位各一块，把"黑掉的那半边"填起来 */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <Lightformer key={i} form="rect" intensity={0.9}
              position={[Math.cos(a) * 9, 1.6, Math.sin(a) * 9]}
              rotation={[0, -a + Math.PI / 2, 0]}
              scale={[7, 5, 1]} color={i % 2 ? '#dce7f4' : '#aebfd4'} />
          )
        })}
        <Lightformer form="rect" intensity={1.5} position={[0, 9, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[16, 16, 1]} color="#eef4fb" />
        <Lightformer form="rect" intensity={0.7} position={[0, -6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[16, 16, 1]} color="#5b6672" />
      </Environment>
      <ambientLight intensity={0.45} />
      <directionalLight position={[-5, 9, 5]} intensity={1.4} castShadow />

      <Platter />
      {rings.map(x => <Ring key={x.t} r={x.r} served={x.served} />)}

      {/* 主轴 */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[R_HUB, R_HUB, 0.44, 64]} />
        <meshStandardMaterial color="#e7edf3" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* 磁头臂：枢轴在盘外，磁头落在水平右半径上 —— 两点都在 x 轴上，不需要转角 */}
      <mesh position={[(PIVOT_X + rHead) / 2, 0.44, 0]} castShadow>
        <boxGeometry args={[armLen, 0.14, 0.44]} />
        <meshStandardMaterial color="#d5dee6" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[PIVOT_X, 0.44, 0]} castShadow>
        <cylinderGeometry args={[0.52, 0.52, 0.56, 40]} />
        <meshStandardMaterial color="#e2e9ef" metalness={0.8} roughness={0.28} />
      </mesh>
      <mesh position={[rHead, 0.28, 0]} castShadow>
        <boxGeometry args={[0.46, 0.17, 0.32]} />
        <meshStandardMaterial color={view.sweep ? '#d9503c' : '#f0b429'} metalness={0.35} roughness={0.4} />
      </mesh>

      {/*  ⚠️ 标注锚在 3D 点上（`<Html>`），不是画在平面图层里。
           手搓那版放弃了标注，就是因为透视里平面的标尺对不上 ——
           一组"看着像对、其实错位"的标注比没有更糟。现在它跟着物件走。 */}
      {/*  distanceFactor 定的是"标签在世界里多大"。第一版给 12/14，出来两块巨牌 ——
           它不是字号，是尺度：数字越大牌子越大。5 左右跟这个盘的比例才对得上。 */}
      <Html position={[rHead, 0.95, 0]} center distanceFactor={5} zIndexRange={[10, 0]}>
        <span className={`dk3dtag ${view.sweep ? 'sweep' : ''}`}>{view.head}</span>
      </Html>
      {view.moved > 0 && (
        <Html position={[(rFrom + rHead) / 2, 0.02, R + 1]} center distanceFactor={5} zIndexRange={[10, 0]}>
          <span className="dk3ddim">{view.from} → {view.head}　{view.sweep ? '空跑' : ''}{view.moved}</span>
        </Html>
      )}

      <ContactShadows position={[0, -0.08, 0]} opacity={0.5} scale={16} blur={2.4} far={4} />
    </>
  )
}

/** 固定机位：看向物件的横向中心，不是原点 */
function CameraAim() {
  useFrame(({ camera }) => camera.lookAt(1.0, 0, 0))
  return null
}

export default function Disk3D({ view }: { view: DiskView }) {
  return (
    <Canvas
      className="dk3dcanvas"
      shadows
      dpr={[1, 2]}
      /*  固定机位：略高、略偏，同时交代盘面的同心圈和磁头臂的悬臂关系。
          正上方看丢立体感，太低看不清圈。不给 OrbitControls —— 见文件头第 3 条。 */
      /*  物件横向跨 -4.2..6.2（盘 + 枢轴），中心在 1.0 —— 相机看那儿，不是看原点。
          第一版看 (0.7,0,0)、位置 (0.8,8.2,12.4)，盘被挤到画左边缘。 */
      camera={{ position: [1.0, 8.8, 14.2], fov: 30 }}
      gl={{ antialias: true, alpha: true }}
    >
      <CameraAim />
      <Scene view={view} />
    </Canvas>
  )
}
