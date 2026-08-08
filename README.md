<div align="center">

<img src="https://readme-typing-svg.demolab.com/?font=JetBrains+Mono&size=26&duration=3000&pause=1000&color=D4AF37&center=true&vCenter=true&width=600&lines=Akshith+Surya;Astrophysics+%2B+Aerospace+%2B+AI;Building+from+Palakkad%2C+Kerala" alt="typing banner" />

<br />

[![GitHub](https://img.shields.io/badge/GITHUB-000000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Akshithsurya)
[![Arivu](https://img.shields.io/badge/ARIVU-8B0000?style=for-the-badge&logo=readthedocs&logoColor=D4AF37)](https://arivu-pallakad.netlify.app)

</div>

---

## What this is

Personal portfolio, built as a two-layer experience rather than a static page:

1. **A 3D room intro** (`src/app/page.tsx` + `src/lib/room-scene.ts`) — a procedurally built, PBR-lit evening room rendered in Three.js. The camera runs a cinematic entry timeline, the user raycasts to a laptop on the desk, and clicking it triggers a sit-down camera move.
2. **The actual portfolio** (`public/portfolio.html`) — a self-contained, 7,500+ line single HTML file (steampunk-meets-Kerala-Chronicle aesthetic, 3D coverflow project carousel, canvas-rendered black hole accretion disk) — which gets mounted into the 3D scene as a CSS3D "laptop screen" portal once you sit down.

So the Next.js app isn't the portfolio itself — it's a frame around it. The content lives in one static file; the app is the room you walk through to reach it.

This dual structure is worth stating plainly because the repo also contains scaffold and tooling debris from how it was built — see [Known cruft](#known-cruft--cleanup-candidates) below before assuming everything here is load-bearing.

---

## Architecture

```
Browser
  └─ Next.js App Router (src/app/page.tsx)
       └─ initRoomScene()  [src/lib/room-scene.ts, 3.6k lines, @ts-nocheck]
            ├─ Loads Three.js r128 + addons from unpkg CDN at runtime
            │  (bloom/FXAA postprocessing, CSS3DRenderer, Reflector, BokehShader)
            ├─ Builds the room geometry + lighting procedurally (no 3D asset files)
            ├─ Cinematic camera timeline → raycast-to-laptop → sit-down
            └─ On interaction: CSS3D-embeds public/portfolio.html as the laptop's screen
```

- **Three.js is loaded from a CDN at runtime**, not bundled via npm — `room-scene.ts` dynamically injects `<script>` tags for `three@0.128.0` and each addon (CopyShader, FXAAShader, EffectComposer, CSS3DRenderer, etc.) and waits on `window.THREE`. This is why there's no `three` entry in `package.json`.
- `usePrefersReducedMotion` gates the whole scene — reduced-motion users presumably get a fallback path (`a11yMode`) rather than the WebGL room.
- `index.html` at the repo root is **not** the deployed entry point — it's a local-dev-only redirect page that polls `localhost:3000` and tells you to run `start.bat` if nothing's there. Netlify serves the Next.js app directly; this file is a leftover convenience for local double-click testing on Windows.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui (Radix primitives) |
| 3D | Three.js r128 (CDN-loaded, not bundled) |
| State/forms | Zustand, React Hook Form, Zod, TanStack Query/Table |
| DB layer | Prisma + SQLite — scaffolded, not used by the portfolio itself (see below) |
| Deploy | Netlify, via `@netlify/plugin-nextjs` |
| Package manager | npm (`package-lock.json`) and Bun (`bun.lock`) both present |

---

## Repo layout

```
├── src/app/
│   ├── page.tsx          → room scene entry point
│   ├── layout.tsx        → root layout, metadata, fonts
│   ├── globals.css
│   └── api/route.ts      → single stub GET endpoint ("Hello, world!")
├── src/lib/
│   ├── room-scene.ts     → the 3D room + laptop portal (the real engineering here)
│   └── utils.ts
├── src/components/ui/    → full shadcn/ui component set (~40 components)
├── public/
│   └── portfolio.html    → the actual portfolio — single file, this is the content
├── index.html            → local-dev redirect stub, not the deployed site
├── 1.html                → older/duplicate portfolio HTML (159 KB) — superseded by public/portfolio.html
├── count-divs.js         → dev script: counts open/close <div> tags in 1.html
├── pos-to-line.js        → dev script: maps character offsets to line numbers in 1.html
├── rewrite.js            → dev script: templated find/replace pass over index.html → dist/
├── prisma/schema.prisma  → User/Post models — unused scaffold, not wired to the portfolio
├── examples/websocket/   → Socket.io chat example — boilerplate, unrelated to the portfolio
├── mini-services/        → empty (.gitkeep only)
├── upload/, download/    → session artifacts from the AI app-builder this was scaffolded in
│                            (pasted-content text dumps, a workspace .tar, a "here are your
│                            generated files" README) — not part of the app
├── Caddyfile              → reverse proxy config (ports 81→3000) — sandbox/dev-environment
│                            artifact, not used by the Netlify deploy path
├── netlify.toml           → actual deploy config: npm run build + Next.js plugin
├── start.bat               → Windows: launches the local dev server for index.html's redirect
└── AGENTS.md / CLAUDE.md   → Next.js agent-rules file, auto-regenerated by `next dev`
```

---

## Local development

```bash
npm install
npm run dev      # or: bun run dev
```

Then visit `localhost:3000` directly — don't rely on the root `index.html` unless you're testing the Windows `start.bat` flow.

Other scripts in `package.json`: `build`, `start`, `lint`, plus Prisma helpers (`db:push`, `db:generate`, `db:migrate`, `db:reset`) for the unused scaffold database.

---

## Deployment

Netlify, per `netlify.toml`:

```toml
[build]
  command = "npm run build"
[build.environment]
  NODE_VERSION = "20"
[[plugins]]
  package = "@netlify/plugin-nextjs"
```

Two candidate live URLs currently point at this project in different places (the profile README badge vs. metadata inside the repo) — worth confirming which one is the actual current deploy and removing the other before this README goes live:
- `og:url` / `twitter` metadata in both `index.html` and `src/app/layout.tsx` still points to `https://project-rkh1w.vercel.app` — reads like a placeholder from an earlier Vercel-based scaffold, not the current Netlify domain.

---

## Known cruft / cleanup candidates

This repo carries visible residue from the tool it was scaffolded in (file names, `AGENTS.md`, `.z-ai-config` in `.gitignore`, `/home/z/my-project` as the literal path baked into `.env`). None of this breaks the deployed site, but it's worth a pass before pointing evaluators or recruiters at the raw repo:

- **`.env` is committed.** Low-stakes here — it's just a local SQLite file path, no real credentials — but `.gitignore` already lists `.env*`, meaning it was force-added at some point. Worth removing from history if this repo is meant to look clean.
- **Unused Prisma/SQLite scaffold** (`prisma/`, `db/custom.db`, the `User`/`Post` models, the `db:*` npm scripts) — default template models, nothing in the portfolio touches them.
- **`upload/` and `download/`** — raw AI-builder session output (pasted-content dumps, a workspace tarball, a `README.md` that just says "Here are all the generated files"). Not source, not deployed.
- **`1.html`, `count-divs.js`, `pos-to-line.js`, `rewrite.js`** — a debugging pass from when `public/portfolio.html` (or its predecessor) had a div-balance bug. `count-divs.js` and `pos-to-line.js` operate on `1.html`, which looks superseded by `public/portfolio.html`.
- **`examples/websocket/`** — a Socket.io chat boilerplate example, unrelated to a portfolio site.
- **`mini-services/`** — empty directory, just a `.gitkeep`.
- **`Caddyfile`** — reverse-proxy config for a sandbox/dev environment, irrelevant to the Netlify deploy path.
- **`lol.jpeg`** (root and `public/`) — untitled test image, unclear if referenced anywhere live.
- **Two lockfiles** (`package-lock.json` and `bun.lock`) — pick one package manager and drop the other to avoid drift.

None of this needs to block a deploy. It matters if this repo is ever going to be evaluator-facing (UWC application, recruiter, etc.) rather than just a working directory — in that case it's worth a cleanup commit that strips `upload/`, `download/`, the Prisma scaffold, and the dev-utility scripts, and confirms `public/portfolio.html` is the single source of truth over `1.html`.

---

## Recognition

- NASA Space Apps Challenge 2025 — Global Nominee, team lead RC_Real Coding (*EXOVision*)
- ISRO Space Week — 1st Prize (Project), 2nd Prize (Quiz)
- ISRO EsroMagica Workshop — November 2025

## Related projects

| Project | What it is |
|---|---|
| [Arivu](https://arivu-pallakad.netlify.app) | Bilingual Malayalam/English science career-literacy platform, co-founded with Aadi Mahesh |
| EXOVision | Exoplanet detection via transit photometry + ML classification pipeline |
| Vulcan | Bash-based security research framework |
| ESP_Penetrator | ESP32 hardware pentesting toolkit — RF/signal-layer analysis |
| IoT Firmware Collection | Firmware archive across ESP8266, ESP32, Raspberry Pi targets |

---

<div align="center">
<sub>Palakkad, Kerala</sub>
</div>
