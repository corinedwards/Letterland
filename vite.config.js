import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  build: {
    target: 'esnext'
  },
  plugins: [
    {
      name: 'watch-public-letters',
      configureServer(server) {
        // Vite doesn't watch public/ by default — add it so config/asset edits
        // trigger a full page reload without needing a manual refresh.
        server.watcher.add('public/letters/**')
        server.watcher.on('change', (file) => {
          if (file.includes('public/letters/')) {
            server.ws.send({ type: 'full-reload' })
          }
        })
      }
    }
  ],
  server: {
    host: true,
    open: true
  }
})
