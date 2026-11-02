// GET /api/search?q=perfect+days → películas que coinciden (TMDB).
import { handle } from './_tmdb'

export function GET(request: Request) {
  return handle(new URL(request.url), process.env)
}
