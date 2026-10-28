import dns from 'node:dns'
try {
  dns.setDefaultResultOrder('ipv4first')
} catch (_) {}

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function apiPlugin() {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [pathname, queryString] = req.url.split('?')
        if (pathname.startsWith('/api/')) {
          const endpoint = pathname.replace(/^\/api\//, '').replace(/\/$/, '')
          let filePath = null
          if (endpoint === 'chat') filePath = './api/chat.js'
          else if (endpoint === 'slots') filePath = './api/slots.js'
          else if (endpoint === 'bookings') filePath = './api/bookings.js'
          else if (endpoint === 'manage') filePath = './api/manage.js'

          if (filePath) {
            const executeHandler = async (rawBody) => {
              try {
                req.body = rawBody ? JSON.parse(rawBody) : {}
                req.query = Object.fromEntries(new URLSearchParams(queryString || '').entries())
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
                const mod = await server.ssrLoadModule(filePath)
                const handler = mod.default || mod
                await handler(req, res)
              } catch (err) {
                console.error('API Error:', err)
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
    define: {
      'process.env.CLINIC_WHATSAPP': JSON.stringify(env.CLINIC_WHATSAPP || env.VITE_CLINIC_WHATSAPP || '')
    },
    plugins: [react(), apiPlugin()],
    resolve: {
      alias: {
        '@theskintree/shared': path.resolve(__dirname, '../shared/index.js')
      }
    },
    server: { port: 5173 }
  }
})
