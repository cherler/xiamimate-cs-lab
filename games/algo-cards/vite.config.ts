import { defineConfig } from 'vite'

// 收进虾米看计算机 monorepo 后,算法卡牌挂在 /lab/cards/ 下(线上 Caddy handle_path 剥掉 /lab/cards、
// 文件按根目录摆;HTML 里的资源链接带 /lab/cards)。页面是自包含单文件,base 只影响构建出的资源链接。
export default defineConfig({
  base: '/lab/cards/',
  build: { target: 'es2022' },
})
