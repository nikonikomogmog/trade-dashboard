# trade_dashboard (static publish)

Static snapshot of the trade dashboard, served via GitHub Pages.

- `index.html` / `app.js` / `style.css` — the dashboard UI
- `data/*.json` — published snapshot data (no absolute paths / usernames; sanitized)
- `.nojekyll` — tells GitHub Pages to serve the `data/` folder as-is

This folder is generated from `static_publish/` and is publish-only (no source code, no DB, no credentials).
