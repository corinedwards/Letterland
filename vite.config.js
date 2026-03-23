import { defineConfig } from 'vite'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  build: {
    target: 'esnext'
  },
  server: {
    watch: {
      ignored: ['**/public/letters/shapes-config.json']
    }
  },
  plugins: [
    {
      name: 'save-color-names',
      configureServer(server) {
        server.middlewares.use('/api/save-color-names', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { names, notes, wcag, apca, checked } = JSON.parse(body)
              const configPath = resolve('public/letters/shapes-config.json')
              const config = JSON.parse(readFileSync(configPath, 'utf-8'))
              config._scene.bgColorNames = names
              if (notes) config._scene.bgColorNotes = notes
              if (wcag)    config._scene.bgColorWCAG    = wcag
              if (apca)    config._scene.bgColorAPCA    = apca
              if (checked) config._scene.bgColorChecked = checked
              writeFileSync(configPath, JSON.stringify(config, null, 2))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          })
        })
      }
    },
    {
      name: 'save-shape-note',
      configureServer(server) {
        server.middlewares.use('/api/save-shape-note', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { shapeName, note } = JSON.parse(body)
              const configPath = resolve('public/letters/shapes-config.json')
              const config = JSON.parse(readFileSync(configPath, 'utf-8'))
              if (!config._shapeNotes) config._shapeNotes = {}
              if (note) config._shapeNotes[shapeName] = note
              else delete config._shapeNotes[shapeName]
              writeFileSync(configPath, JSON.stringify(config, null, 2))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          })
        })
      }
    },
    {
      name: 'delete-color',
      configureServer(server) {
        server.middlewares.use('/api/delete-color', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { index } = JSON.parse(body)
              const configPath = resolve('public/letters/shapes-config.json')
              const config = JSON.parse(readFileSync(configPath, 'utf-8'))
              const s = config._scene
              const splice = (arr) => Array.isArray(arr) && arr.splice(index, 1)
              splice(s.bgColors)
              splice(s.bgColorNames)
              splice(s.bgColorNotes)
              splice(s.bgColorWCAG)
              splice(s.bgColorAPCA)
              splice(s.bgColorChecked)
              writeFileSync(configPath, JSON.stringify(config, null, 2))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          })
        })
      }
    },
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
