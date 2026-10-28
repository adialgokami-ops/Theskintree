import dns from 'node:dns'
try {
  dns.setDefaultResultOrder('ipv4first')
} catch (_) {}

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function adminApiPlugin() {
  return {
    name: 'admin-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url, 'http://localhost')
        if (urlObj.pathname.startsWith('/api')) {
          const executeHandler = async (rawBody) => {
            try {
              req.body = rawBody ? JSON.parse(rawBody) : {}
              // Polyfill express-like helpers for serverless handler
              if (!res.status) {
                res.status = (code) => {
                  res.statusCode = code
                  return res
                }
              }
              if (!res.json) {
                res.json = (data) => {
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify(data))
                  return res
                }
              }
              // Pass query path
              const cleanPath = urlObj.pathname.replace(/^\/api\/?/, '')
              req.query = { path: cleanPath ? cleanPath.split('/') : [] }

              let filePath = './api/[...path].js'
              if (urlObj.pathname === '/api/cron/keepalive') {
                filePath = './api/cron/keepalive.js'
              } else if (urlObj.pathname === '/api/cron/reminders') {
                filePath = './api/cron/reminders.js'
              }

              const mod = await server.ssrLoadModule(filePath)
              const handler = mod.default || mod
              await handler(req, res)
            } catch (err) {
              console.error('[Admin Dev API Error]:', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message || 'Server error' }))
            }
          }

          if (req.method === 'GET' || req.method === 'HEAD') {
            await executeHandler('')
            return
          }

          let rawBody = ''
          req.on('data', chunk => {
            rawBody += chunk
          })
          req.on('end', () => {
            executeHandler(rawBody)
          })
          return
        }
        next()
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [react(), adminApiPlugin()],
    resolve: {
      alias: {
        '@theskintree/shared': path.resolve(__dirname, '../shared/index.js')
      }
    },
    server: {
      port: 5174
    }
  }
})
