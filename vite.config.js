import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 应用源码仍在 科隆大教堂建筑/ 子目录，这里把 vite 的根指过去
  root: '科隆大教堂建筑',
  plugins: [tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
