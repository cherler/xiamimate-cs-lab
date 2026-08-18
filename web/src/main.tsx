import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// 平台设计令牌要排在 styles.css **前面**：后者把自己的 --sans 绑到 --xm-font-sans 上，
// 变量得先有定义。（CSS 变量是运行时求值的，顺序其实无所谓 —— 但读代码的人会按顺序读，
// 而 Vite 打包后的顺序就是这里的顺序，别让人去猜。）
import './brand-tokens.css'
import './styles.css'
import './stage.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
