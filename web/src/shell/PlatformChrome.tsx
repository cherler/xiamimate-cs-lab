/**
 * 挂载主站导出的平台页眉与页脚（虾米伙伴 › 虾米做实验）。
 *
 * 做法与虾米看股、虾米看AI 一致（wiki/27 第 3 节）：**不抄一份、也不共享源码**，
 * 而是运行时加载主站构建产出的 `/chrome/chrome.js` —— 那里面跑的是真正的组件，
 * 自带模块切换器、账号菜单、积分胶囊和登录弹窗。主站改了页眉，这里下次刷新就跟上，
 * 本仓不用重新构建。
 *
 * ## 三件本仓特有的事
 *
 * 1. **路径必须写死 `/chrome/…`，不能带 base。** 本仓构建时 `VITE_BASE=/lab/`，
 *    但制品在站点根上（`xiamimate.com/chrome/chrome.js`），走 Vite 的资源前缀会 404。
 *
 * 2. **取不到就整个不渲染。** 本机 dev（:5178）、`web:single` 打出来的单文件、
 *    一份干净 clone 都没有主站，一律降级成「没有平台页眉」——
 *    本仓自己的顶栏是完整的，少一条平台横条不影响用。**半塌的页眉比没有更糟。**
 *
 *    ⚠️ 这带来一个坑：**直接开 :5178 永远看不到平台页眉**。要看真形态跑
 *    `npm run gateway`（:8090），规则与线上 Caddy 一一对应。
 *
 * 3. **独立形态下压根不试**（`platform.ts` 的 onPlatform）。一个必然 404 的请求
 *    会在控制台留下红字，而本仓的冒烟有一条判据是「控制台无错误」——
 *    噪声会把真判据废掉。判断走**挂载路径**，不靠探测，理由见 platform.ts。
 */
import { useEffect, useRef, useState } from 'react'
import { onPlatform } from '../platform.ts'

const CHROME_JS = '/chrome/chrome.js'
const CHROME_CSS = '/chrome/chrome.css'
const CHROME_MANIFEST = '/chrome/manifest.json'
/** 与主站 lib/modules.ts 里的 key 一致；漏了或写错的表现是页眉显示「模块广场」 */
const MODULE_KEY = 'lab'

interface ChromeApi {
  header(selector: string, options?: { module?: string; headerPadding?: string }): void
  footer(selector: string, options?: { footerPadding?: string }): void
}
declare global {
  interface Window { XiamiChrome?: ChromeApi }
}

let loading: Promise<ChromeApi | null> | null = null

/**
 * **先探 manifest，确认真有制品再注入 `<script>`。**
 *
 * 不能只靠 `script.onerror` —— 那只在网络层失败时触发。很多静态服务器
 * （Vite 的 dev server 就是其中之一）对未命中的路径**回退 index.html**：
 * `/chrome/chrome.js` 于是回 200 + 一坨 HTML，浏览器把它当 JS 解析，
 * 结果是控制台一句 `SyntaxError: Unexpected token '<'`，而**页面看上去完全正常**。
 * 又一个「200 不代表拿到的是那个东西」。
 *
 * 所以判据挂在**内容**上：解得出 JSON、且里面真有 `files.script` 才算有制品。
 */
async function probe(): Promise<boolean> {
  try {
    const res = await fetch(CHROME_MANIFEST, { cache: 'no-cache' })
    if (!res.ok) return false
    const m = await res.json()          // 回退成 HTML 时这里就抛了
    return typeof m?.files?.script === 'string'
  } catch {
    return false
  }
}

function loadChrome(): Promise<ChromeApi | null> {
  loading ??= new Promise<ChromeApi | null>(resolve => {
    if (!onPlatform()) return resolve(null)
    if (window.XiamiChrome) return resolve(window.XiamiChrome)
    void probe().then(ok => (ok ? inject(resolve) : resolve(null)))
  })
  return loading
}

function inject(resolve: (api: ChromeApi | null) => void) {
  // 去重判断要在同一个同步块里做完：放在 await 之后的话，
  // 页眉与页脚两个插槽会同时通过检查，样式被注入两遍。
  if (!document.querySelector('link[data-xm-chrome]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = CHROME_CSS
    link.dataset.xmChrome = '1'
    document.head.appendChild(link)
  }
  const script = document.createElement('script')
  script.src = CHROME_JS
  script.onload = () => resolve(window.XiamiChrome ?? null)
  script.onerror = () => resolve(null)
  document.head.appendChild(script)
}

function Slot({ part }: { part: 'header' | 'footer' }) {
  const ref = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (done.current) return
    let live = true
    void loadChrome().then(api => {
      if (!live || !api || !ref.current) return
      done.current = true
      ref.current.id = `xm-chrome-${part}`
      /**
       * **不传 padding，用主站的默认值（4vw / 5vw）。**
       *
       * 虾米看股确实传了自己的 padding，但那是**它有理由**：左边 248px 侧边栏，
       * 套 4vw 会把页脚内容挤到右半边。本仓是居中排版，与主站、虾米看AI 同构，
       * **没有那个理由就不该覆盖** —— 平台页眉的意义正是「看着像同一个产品」。
       */
      if (part === 'header') api.header(`#xm-chrome-${part}`, { module: MODULE_KEY })
      else api.footer(`#xm-chrome-${part}`)
      setOn(true)
      document.documentElement.dataset.chrome = 'on'
    })
    return () => { live = false }
  }, [part])

  // 没挂上时不占位 —— 留一个空 div 会在顶栏上方压出一条无来由的空白
  return <div ref={ref} style={on ? undefined : { display: 'none' }} />
}

export const ChromeHeader = () => <Slot part="header" />
export const ChromeFooter = () => <Slot part="footer" />
