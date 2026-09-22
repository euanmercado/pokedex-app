# PokéDex Unit

A full-stack Pokédex web app built for the **Third Party API Top 3 Challenge** (Team Pokémon), powered by [PokéAPI](https://pokeapi.co).

Live demo: https://pokedex-app-mercado.netlify.app
Repo: _add your GitHub URL here_

## What it does

- Fetches real Pokémon data (sprites, types, stats, abilities, moves, flavor text) live from PokéAPI's REST endpoints.
- **Browse**: loads Pokémon in batches of 24 with a "Scan next batch" button (pagination) so it doesn't try to pull all ~1300 at once.
- **Search** (interactive feature #1): look up any Pokémon by exact name or Pokédex number using the search box.
- **Filter by type** (interactive feature #2): a dropdown, populated from PokéAPI's `/type` endpoint, filters the grid down to Pokémon of that type (fire, water, psychic, etc.).
- **Detail view**: clicking any card opens a modal with the Pokémon's official artwork, base stats (rendered as bars), height/weight, abilities, a flavor-text description, and a sample of its moves.

## Tech stack

Plain HTML, CSS, and vanilla JavaScript (`fetch`, no framework, no build step). This keeps the app runnable by just opening `index.html`, and trivial to deploy to any static host.

## API key handling

**No API key is required.** PokéAPI is a free, public, read-only REST API with no authentication and CORS enabled for browser requests, so the frontend calls it directly:

```js
const API_ROOT = "https://pokeapi.co/api/v2";
fetch(`${API_ROOT}/pokemon/${name}`)
```

Because there's no secret to protect, this app needs **no backend proxy, no serverless function, and no environment variables** — everything runs client-side. (If your team's API were TMDB or RAWG, you'd instead put the key in an environment variable and relay requests through a small Netlify Function so the key never ships to the browser — not needed here.)

## Project structure

```
pokedex-app/
├── index.html      # page structure / markup
├── style.css        # "physical Pokédex device" themed styling
├── script.js        # all API calls, rendering, search/filter/modal logic
└── README.md
```

## Running it locally

No install step needed since there's no build tooling. Any of these work:

1. **Just open the file**: double-click `index.html`, or drag it into a browser tab.
2. **VS Code Live Server extension**: right-click `index.html` → "Open with Live Server".
3. **Python's built-in server** (from inside the project folder):
   ```bash
   python3 -m http.server 8000
   ```
   then visit `http://localhost:8000`.
4. **Node's `serve`**:
   ```bash
   npx serve .
   ```

## Deploying to Netlify

1. Push this folder to a public GitHub repository.
2. In Netlify: **Add new site → Import an existing project → GitHub**, select the repo.
3. Build settings: leave **Build command** blank and set **Publish directory** to the repo root (`.`), since this is a static site with no build step.
4. Deploy. Netlify gives you a live `*.netlify.app` URL — that's the link for your submission.

(Any other static host — Vercel, GitHub Pages, Surge — works the same way, since there's no key to hide and no server-side code.)

## Notes / known limitations

- The initial index fetch (`/pokemon?limit=100000`) only pulls name + URL pairs, which is cheap; full details are fetched per-Pokémon only for whatever's currently on screen, in the modal, or matched by type filter.
- Some very high Pokédex-number entries (megas, regional forms, etc.) have missing official-artwork sprites; the app falls back gracefully with a placeholder rather than breaking.
- Type filtering re-paginates within the matched list, so switching types resets scroll position back to the top of the results.
