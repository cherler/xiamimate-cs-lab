import { defineConfig } from 'vite'

// 收进虾米课堂 monorepo 后,算法卡牌挂在 /cslab/cards/ 下(线上 Caddy handle_path 剥掉 /cslab/cards、
// 文件按根目录摆;HTML 里的资源链接带 /cslab/cards)。页面是自包含单文件,base 只影响构建出的资源链接。
export default defineConfig({
  base: '/cslab/cards/',
  build: { target: 'es2022' },
})
