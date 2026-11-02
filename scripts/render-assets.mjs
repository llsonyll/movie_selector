// Genera public/og.png (vista previa del link en WhatsApp) y public/apple-touch-icon.png.
// Uso: node scripts/render-assets.mjs   (requiere Playwright con Chromium)
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import { readFileSync } from 'node:fs'

const logo = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const fonts = '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@500&display=swap" rel="stylesheet">'

const og = `<!doctype html><html><head>${fonts}<style>
  body{margin:0;width:1200px;height:630px;background:radial-gradient(circle at 80% 20%,#3b2a10 0,#0c0a09 55%);color:#fafaf9;
    font-family:Inter,sans-serif;display:flex;align-items:center;padding:0 96px;box-sizing:border-box;overflow:hidden}
  .logo{width:150px;height:150px;flex:none;margin-right:56px}
  h1{font-family:Fraunces,serif;font-weight:600;font-size:104px;margin:0;letter-spacing:-2px}
  p{font-size:38px;color:#d6d3d1;margin:18px 0 0}
  .strip{position:absolute;bottom:0;left:0;right:0;height:22px;background:repeating-linear-gradient(90deg,#fbbf24 0 40px,#0c0a09 40px 60px)}
</style></head><body><div class="logo">${logo}</div><div><h1>Cineclub</h1><p>¿Qué vemos esta semana?<br>Propón hasta 2 películas y vota.</p></div><div class="strip"></div></body></html>`

const icon = `<!doctype html><html><body style="margin:0;width:180px;height:180px;background:#0c0a09;display:grid;place-items:center">
  <div style="width:130px;height:130px">${logo}</div></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 1200, height: 630 })
await page.setContent(og, { waitUntil: 'networkidle' }).catch(() => page.setContent(og))
await page.screenshot({ path: 'public/og.png' })
await page.setViewportSize({ width: 180, height: 180 })
await page.setContent(icon)
await page.screenshot({ path: 'public/apple-touch-icon.png' })
await browser.close()
console.log('ok')
