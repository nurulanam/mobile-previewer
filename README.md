# Mobile Previewer

A zero-dependency, vanilla JavaScript website for previewing any URL inside realistic device frames — iPhone, Samsung, Pixel and iPad. Paste a URL, pick a device, and see the site render at that device's **true viewport**.

No frameworks and no runtime dependencies — just HTML, CSS and JavaScript, built with Vite and styled with Tailwind CSS.

## Features

### Device presets
- 13 presets across iPhone, Samsung, Pixel and iPad
- Each renders at its **real CSS-pixel viewport** (e.g. 440 × 956), so the previewed site hits the same media queries as the real hardware. The whole mockup is then scaled to fit the canvas.
- Accurate hardware details: Dynamic Island, punch-holes, curved edges, the iPhone SE's chin and Touch ID button, side buttons
- 16 frame finishes grouped by brand
- Rotate between portrait and landscape
- Save and reload device configurations (stored in `localStorage`)

### Preview
- URL input with live rendering in an `<iframe>`
- Zoom controls (50–150%, where 100% means fit-to-canvas)
- Reload, fullscreen
- Demo browser chrome for Chrome, Safari, Firefox, Brave and Edge, positioned the way each platform really does it — address bar at the **bottom** on iPhone, at the **top** on Android and iPad

### Touch interaction
- Finger-style drag scrolling with iOS-like momentum, grab cursors and hidden scrollbars

### Capture
- Screenshot the device frame as PNG
- Record the preview as WebM video, with a live timer

### UI
- Dark and light mode (persisted)
- Keyboard shortcuts
- Toast notifications

## Tech stack

- **Vanilla JavaScript** — no UI framework
- **Vite** — build tool and dev server
- **Tailwind CSS v4** — utility-first styling
- Zero runtime dependencies

## Getting started

```bash
npm install     # dev dependencies only (Vite + Tailwind)
npm run dev     # start the dev server
npm run build   # production build to dist/
npm run preview # serve the production build locally
```

Open `http://localhost:5173`. A same-origin demo page is available at `/sample.html` — useful for trying drag scrolling (see the caveat below).

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Reload preview | `⌘/Ctrl` + `R` |
| Screenshot | `⌘/Ctrl` + `S` |
| Toggle dark mode | `⌘/Ctrl` + `D` |
| Toggle fullscreen | `F` |
| Rotate device | `O` |

## Deploying to Render

The repo contains a [`render.yaml`](render.yaml) blueprint, so you can deploy it as a **Static Site**:

1. Push this repo to GitHub/GitLab.
2. In Render, choose **New → Blueprint** and point it at the repo. Render reads `render.yaml` and configures everything.

To set it up manually instead, create a **Static Site** with:

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |

Notes:

- `vite.config.js` uses `base: './'` so assets resolve relative to the page. Do not change this to an absolute sub-path (like `/mobile-previewer/`) unless you are actually serving the app from that sub-path — on Render the site is served from the domain root and an absolute sub-path base produces a blank page.
- Render serves over HTTPS, which the screenshot and recording features require.
- `.node-version` pins Node 22 for the build.

## Known limitations

These are browser security boundaries, not bugs — the app surfaces each one in the UI rather than failing silently.

- **Sites that refuse to be embedded.** Many sites send `X-Frame-Options` or a `frame-ancestors` CSP, which prevents them loading in any iframe. The preview shows a notice with a link to open the page in a new tab.
- **Drag scrolling needs a same-origin page.** It works by attaching listeners to the previewed document, which browsers only permit for same-origin content. On cross-origin sites the app tells you to use the wheel or trackpad instead. Try it against `/sample.html`.
- **Screenshots and recording use the Screen Capture API.** Cross-origin iframe pixels cannot be read into a canvas, so capture goes through `getDisplayMedia` — choose **"This Tab"** when the browser asks. Where available, the Region Capture API crops the stream to the device frame automatically. Requires a Chromium-based browser and a secure context (HTTPS or localhost).
- **Recording exports WebM, not GIF.** GIF encoding would require a dependency, which this project deliberately avoids.
- **HTTP URLs won't load on the deployed site.** An HTTPS page cannot embed an `http://` frame. To preview a local dev server, run this previewer locally with `npm run dev`.

## License

TBD
