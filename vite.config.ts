import { defineConfig, loadEnv, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handle } from './api/_tmdb'

// En Vercel, /api/* son funciones del servidor. En `npm run dev` las sirve este plugin con la misma lógica.
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        const response = await handle(new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost'), env)
        res.statusCode = response.status
        res.setHeader('content-type', 'application/json')
        res.end(await response.text())
      })
    },
  }
}

// WhatsApp solo muestra la imagen de vista previa si su URL es absoluta. Vercel da el dominio al compilar.
function siteUrl(env: Record<string, string>): Plugin {
  const host = env.SITE_URL || process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || ''
  const base = host && !host.startsWith('http') ? `https://${host}` : host
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', base.replace(/\/$/, '')),
  }
}

export default defineConfig(({ mode }) => ({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), tailwindcss(), devApi(loadEnv(mode, process.cwd(), 'TMDB_')), siteUrl(loadEnv(mode, process.cwd(), 'SITE_'))],
}))
