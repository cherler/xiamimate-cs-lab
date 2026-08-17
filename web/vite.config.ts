import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  // 引擎在仓库根的 src/ 下 —— 视图直接 import 它，不复制不镜像
  resolve: {
    alias: { '@engine': resolve(here, '..', 'src') },
  },
  server: { port: 5178, strictPort: false },
  build: { outDir: 'dist', emptyOutDir: true },
})
