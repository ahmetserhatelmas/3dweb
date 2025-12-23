import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: '../public',
  optimizeDeps: {
    include: ['occt-import-js']
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  }
})

