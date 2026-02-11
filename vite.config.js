import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  build: {
    target: 'esnext'
  },
  server: {
    host: true,
    open: true
  }
})
