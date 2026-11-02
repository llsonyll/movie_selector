// GET /api/movie?id=976893 → ficha completa: director, duración, géneros y dónde verla.
import { handle } from './_tmdb.js'

export function GET(request: Request) {
  return handle(new URL(request.url), process.env)
}
