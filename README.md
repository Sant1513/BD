# Company Dashboard (Google Sheets powered)

Static web app that reads a public Google Sheet tab (Sheet1) and renders a live, filterable company dashboard with login gate, popup details, and smooth animated UI.

## Local Use
- Open `index.html` directly in your browser.
- Ensure the Google Sheet is shared as "Anyone with the link – Viewer".
- Default login: Username `Admin1234`, Password `1234@12` (wrong creds still allow viewing with a warning).

## Configure Sheet
- Edit the sheet id in `index.html` near the bottom:
```html
<script>
  window.__SHEET_ID__ = 'YOUR_SHEET_ID';
  window.__SHEET_TAB__ = 'Sheet1';
</script>
```

## Deploy Options

### Vercel
1. Install Vercel CLI: `npm i -g vercel` (or use the dashboard).
2. From project root, run: `vercel --prod`.
3. This repo has `vercel.json` to serve static files.

### Netlify
1. Install CLI: `npm i -g netlify-cli`.
2. From project root, run: `netlify deploy --prod --dir .`.
3. `netlify.toml` included; publish dir is `.`.

### GitHub Pages
1. Commit these files to a GitHub repository.
2. Enable Pages: Settings → Pages → Source: `Deploy from a branch`, Branch: `main` (or `gh-pages`), Folder: `/root`.
3. `.nojekyll` and `404.html` included for SPA-friendly fallback.

## Notes
- Company name from Column B is displayed as the title.
- Fields G–O populate tags/details and popup content.
- Popup shows recruiter POCs, contact info, copy buttons, outbound links.
- Favicon-based logo heuristic is used if no website is known.
