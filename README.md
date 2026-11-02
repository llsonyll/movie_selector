# Cineclub 🎬

Página para que el cineclub elija la película de la semana sin perder el hilo en WhatsApp:
cada uno **busca y propone** hasta 2 películas, todos **votan por aprobación** (marcan todas las que verían
con gusto) y el organizador **cierra la votación y anuncia la ganadora** con un mensaje listo para el grupo.

## Cómo funciona una ronda

| Fase | Quién | Qué pasa |
|---|---|---|
| **1. Propuestas** | El organizador abre la ronda (fecha de la reunión) y avisa al grupo | Cada miembro busca en TMDB y propone hasta **2** películas con una línea de "por qué". Puede retirarlas o editar el comentario |
| **2. Votación** | El organizador abre la votación | Cada miembro marca **todas** las que vería con gusto. Los votos son secretos hasta el cierre; se ve quién ya votó y a quién falta recordarle |
| **3. Resultado** | El organizador cierra | Gana la más votada. Si hay empate en el primer lugar se **sortea** entre las empatadas (queda indicado). Se revelan los votos y el organizador anuncia la ganadora |

- **Avisar al grupo**: después de abrir la ronda, abrir la votación o cerrarla, al organizador le aparece una tarjeta
  "Avísale al grupo". En el celular abre el menú de compartir del teléfono (el grupo de WhatsApp sale entre los
  recientes); en la computadora copia un mensaje corto y ofrece abrir WhatsApp Web. Cualquiera puede volver a
  compartir con el botón "Compartir".
- Solo hay **una ronda abierta a la vez**. Cuando no hay ronda abierta, la página de inicio muestra la última ganadora.
- **Historial** con todas las películas elegidas; si alguien propone una que ya vieron, la página avisa (pero lo deja).
- **Miembros**: entra cualquiera con el link y su cuenta de Google. El **primero en entrar queda como organizador**;
  desde *Miembros* puede nombrar a otros organizadores o sacar a alguien del club.
- Cada ficha muestra director, duración, géneros y **dónde verla** (streaming en Perú, configurable).

## Arquitectura

```
Navegador (React + Vite + Tailwind)  ──►  Supabase: Auth con Google, Postgres con reglas RLS, Realtime
            │
            └──►  /api/search, /api/movie  (funciones de Vercel)  ──►  API de TMDB
```

- `supabase/migrations/` — modelo de datos y **todas las reglas** (límite de 2 propuestas, fases, quién puede qué,
  votos secretos, cierre con sorteo). La seguridad está en la base, no en la página.
- `api/` — puente con TMDB: la clave queda en el servidor. En desarrollo lo sirve el propio `vite` (ver `vite.config.ts`).
- `src/` — la aplicación. `lib/queries.ts` concentra el acceso a datos; `lib/whatsapp.ts` arma los mensajes.
- `supabase/tests/` — pruebas de las reglas contra un Postgres local (`npm run test:db`).

## Puesta en marcha (una sola vez, ~20 minutos)

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com) (el plan gratis alcanza de sobra).
2. En **SQL Editor**, pega y ejecuta `supabase/migrations/20261102000000_cineclub.sql`
   (o con la CLI: `supabase link` y `supabase db push`).
3. Anota de **Project Settings → API**: la URL del proyecto y la *publishable key*.

### 2. Entrar con Google
1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un **ID de cliente de OAuth**
   (tipo *Aplicación web*). Configura la pantalla de consentimiento en modo *Externo* y publícala.
2. En *URIs de redireccionamiento autorizados* agrega `https://<tu-proyecto>.supabase.co/auth/v1/callback`.
3. En Supabase → **Authentication → Sign In / Providers → Google**: actívalo y pega el Client ID y el Client Secret.
4. En Supabase → **Authentication → URL Configuration**: pon como *Site URL* el dominio de Vercel
   (p. ej. `https://cineclub.vercel.app`) y agrega en *Redirect URLs* `https://cineclub.vercel.app/**`
   (y `http://localhost:5173/**` para desarrollo).

### 3. TMDB
Crea una cuenta en [themoviedb.org](https://www.themoviedb.org), pide una API key en *Ajustes → API* y copia el
**API Read Access Token** (empieza con `eyJ…`).

### 4. Vercel
1. Importa este repositorio en [vercel.com](https://vercel.com/new) (detecta Vite solo).
2. Variables de entorno:

   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | URL del proyecto Supabase |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key de Supabase |
   | `TMDB_TOKEN` | API Read Access Token de TMDB |
   | `TMDB_REGION` *(opcional)* | país para "dónde verla", por defecto `PE` |
   | `TMDB_LANGUAGE` *(opcional)* | idioma de títulos y sinopsis, por defecto `es-MX` |
   | `SITE_URL` *(opcional)* | solo si usas un dominio propio (para la vista previa en WhatsApp) |

3. Despliega, **entra tú primero** (quedas como organizador) y comparte el link en el grupo.

## Desarrollo

```bash
cp .env.example .env.local   # y completa los valores
npm install
npm run dev                  # http://localhost:5173 (sirve también /api con la clave de TMDB)
npm run typecheck
npm run test:db              # reglas de la base contra un Postgres local desechable
```

`npm run test:db` necesita PostgreSQL instalado (`initdb`/`pg_ctl`); no toca Supabase.
`scripts/render-assets.mjs` regenera `public/og.png` (la imagen de la vista previa en WhatsApp).

---
Datos e imágenes de [TMDB](https://www.themoviedb.org). Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
