# Deployment

The app is static files. Nothing has been deployed and no accounts or services have been created.

## Any static host

Upload the repository contents (everything except `tests/`, `docs/` and `node_modules/` is needed at runtime: `index.html`, `css/`, `js/`). Serve over HTTPS.

## GitHub Pages

1. Push to GitHub.
2. Repository Settings, Pages, deploy from the `main` branch, root folder.
3. The site is served at `https://<user>.github.io/mindtrance/`. All asset paths are relative so a sub-path works.

## Other hosts

Netlify, Vercel, Cloudflare Pages: publish the root directory with no build command.

## Notes

- The Content-Security-Policy in `index.html` allows scripts from the same origin only, styles and fonts from Google Fonts, and network calls only to `generativelanguage.googleapis.com` (the optional Gemini path). If you add other services, extend `connect-src`.
- Scripts are cached by browsers. After deploying a change, users may need a hard reload. Adding a version query string to the script tags is a simple fix.
- Because the Gemini key is entered by the user and used from the browser, do not present this build as production-ready for AI features. The roadmap moves that call behind a server.
