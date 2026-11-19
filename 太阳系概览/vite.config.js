import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  server: { port: 5179 },
  plugins: [tailwindcss()],
})
