import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5181,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 5200,
  },
})

