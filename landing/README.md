# Bongo Life — landing page

Static marketing site (Kiswahili + English), no build step. It deploys to Vercel from this folder.

- `index.html`: content. Every translatable element has `data-sw` / `data-en` attributes.
- `main.js`: language switch (`?lang=en|sw`, remembered), live stats from the game's `/api/public/stats`, and Play links that carry the chosen language and `utm_*` tags into the game.
- `GAME_URL` at the top of `main.js` points at the game.
- `assets/`: real screenshots from the game, plus `og.jpg` for link previews.

Preview locally: `node scripts/serve-landing.mjs`, then open http://localhost:4173

## Deploy on Vercel
1. New Project → import `0xMgwan/bongolife`.
2. **Root Directory: `landing`**. Framework preset: **Other**. No build command, no output directory.
3. Deploy. `/play` redirects to the game (see `vercel.json`).
4. Optional: add your domain in Vercel, then set `og:image` in `index.html` to the full URL, e.g. `https://bongolife.app/assets/og.jpg`.
