# Portfolio OS

**Build once. Export everywhere.** A portfolio website, resume, cover-letter and document builder that runs entirely in the browser. There is no backend, no account and no server: everything is stored locally in IndexedDB, PDF parsing and OCR run on the device, and the app works offline once loaded (PWA).

- **Live:** https://www.portfolioos.online
- **GitHub Pages mirror:** https://anubhabguha1999.github.io/portfolio-os/
- **Made by** [Anubhab Guha](https://anubhab-guha.vercel.app/)

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest (jsdom + fake-indexeddb)
npm run typecheck    # tsc -b --noEmit
npm run build        # dist/ — app, prerendered SEO pages, guides, sitemap, robots, service worker
npm run preview      # serve dist/ locally
```

Requires **Node ≥ 20.19** (CI uses Node 22).

---

## Contents

1. [Features](#features)
2. [Routes](#routes)
3. [Architecture](#architecture)
4. [Project structure](#project-structure)
5. [Data & storage](#data--storage)
6. [Portfolio engine](#portfolio-engine)
7. [Document engine (resumes, letters, documents)](#document-engine)
8. [Extract Your Data (PDF intelligence)](#extract-your-data)
9. [Exports](#exports)
10. [SEO, content pages & prerendering](#seo-content-pages--prerendering)
11. [PWA & offline](#pwa--offline)
12. [Security & privacy](#security--privacy)
13. [Configuration](#configuration)
14. [Deployment](#deployment)
15. [Testing](#testing)
16. [Extending the system](#extending-the-system)

---

## Features

### Portfolio Studio — websites
- **14 templates** (Aurora Bento, Monograph, Signal, Atelier, Minimal, Editorial, Terminal, Creative, Executive, Cyber, Brutalist, Luxury, Glass, Cupertino) on **16 data-driven themes**.
- **17 section types:** hero, about, experience, education, projects, skills, services, achievements, certifications, testimonials, blog, contact, social, stats, timeline, gallery and custom (sanitised HTML/Markdown with scoped CSS).
- **Builder:**
  - drag-and-drop sections with a layers panel and a generic inspector;
  - per-section width, spacing, background and motion;
  - a design randomiser;
  - undo/redo, autosave and version snapshots;
  - a command palette (⌘/Ctrl + K) and keyboard shortcuts;
  - focus, presentation and print modes;
  - a dev view (HTML / CSS / JSON);
  - a bottom-sheet editor on mobile.
- **Preview:** a sandboxed iframe with desktop, laptop, tablet, mobile and custom viewports.
- **Insights:** accessibility, performance and content audits run locally against the generated output.
- **Share:** the whole portfolio is compressed into the URL fragment (`/view#p=…`), with a QR code when it fits. The payload never reaches a server.

### Profile Studio — one shared identity
- Name, headline, bio, contact and social links that resumes, letters and linked portfolios all reuse.
- **Photo editor:**
  - crop presets, pan and zoom, rotation and flips;
  - adjustments, filters and backgrounds;
  - frame shapes and rings;
  - several variants from one stored original;
  - per-placement smart-fit crops that keep your framing across aspect ratios.
- Linked portfolios sync both ways by id. Portfolio-only content (images, case studies, layout) is never touched, and deleting in a portfolio never deletes from the profile.

### Resume Studio
- **18 templates**, from ATS-minimal to sidebar, banner, timeline and photo designs, with vector contact icons (GitHub, LinkedIn, web and others).
- Multiple resume versions. Sections can be reordered, duplicated and hidden, and any field can be detached per resume (*Shared ⇄ This resume*).
- Real pagination, fit-to-N-pages, ATS and content checks.
- **Start from any existing resume:** upload a PDF, DOCX, TXT/MD or JSON (JSON Resume, our own exports or an *Extract Your Data* export) and keep editing.

### Document Studio
- Block-based documents with **10 templates** (case studies, one-pagers, reports and more).
- Cover letters with **4 templates** that match your resume.
- **Application pack:** the resume as PDF and DOCX, the cover letter as PDF and DOCX, and the portfolio as standalone HTML, zipped locally.

### Extract Your Data
- Drop in PDFs (including scanned ones). The app pulls out layout, sections, entries, skills and contact details, which you review (accept or ignore) and then insert into resumes, documents or portfolio sections.
- Details are in [Extract Your Data](#extract-your-data) below.

---

## Routes

| Route | Page |
|---|---|
| `/` | Landing page |
| `/templates` | Portfolio template gallery |
| `/new` | Create a portfolio from a template |
| `/projects` | My portfolios |
| `/builder/:projectId` | Portfolio builder |
| `/preview/:projectId` | Full-screen preview |
| `/export/:projectId` | Export Studio |
| `/studio` | Studio dashboard |
| `/profile` | Profile Studio |
| `/resumes`, `/resumes/new`, `/resume/:resumeId` | Resume list / new resume (template picker) / editor |
| `/documents`, `/document/:id` | Documents and cover letters |
| `/knowledge`, `/knowledge/:id` | Extract Your Data library / document review |
| `/view#p=…` | Shared portfolio (read-only) |
| `/settings`, `/about` | Settings, about |
| `/resume-examples/*`, `/portfolio-examples/*`, `/guides/*` | Static content pages generated at build time |
| `/runner` | Local build & test runner (`npm run dev` only; not in production builds) |

Old `/#/route` links are redirected on load (`src/app/legacy-hash.ts`).

---

## Architecture

```
                         ┌──────────────── Shared profile (Profile Studio) ────────────────┐
                         │                                                                 │
Portfolio (typed schema) ──► Section registry ──► HTML engine ──► Preview iframe · HTML · ZIP
        │                    (src/sections)       (src/lib/html)
        │                         └─ toDocument ──► DocModel ──► PDF (src/lib/pdf) · DOCX (src/lib/docx)
        └──────────────► Codegen (src/lib/codegen) ──► React + Vite / Next.js project ZIP

Resume / Letter / Blocks ──template.compose()──► FlowDoc ──layoutFlow()──► LaidDocument
                                                    │                         │
                                     DOCX · TXT ◄───┘          PageSvg preview · vector PDF

PDF / image ──PDF.js / Tesseract──► layout analysis ──► semantic model ──► review ──► resumes · documents · portfolios
```

**Principles**

- **One data model per product.** Every output (preview, HTML, PDF, DOCX, framework code) is generated from the same typed data; no format keeps its own copy.
- **Heavy work runs in Web Workers** (`src/workers`): studio rendering (PDF, DOCX, ZIP), web export and PDF/OCR extraction. Each has a main-thread fallback.
- **Lazy loading:** the layout engine, PDF.js, Tesseract and the export libraries load only when a page needs them, which keeps the landing page small.

**Stack:**
- React 19 and TypeScript 7, built with Vite 8 (Rolldown);
- Tailwind CSS 4, Framer Motion and Zustand;
- idb (IndexedDB) and Zod schemas with migrations;
- jsPDF and docx for output, fflate and JSZip for archives;
- PDF.js and Tesseract.js for reading documents;
- DOMPurify and marked for user content;
- dnd-kit for drag and drop, vite-plugin-pwa (Workbox) for offline support.

---

## Project structure

```
src/
  app/            App shell, routes, SEO head manager, legacy-hash redirect, Vercel insights
  components/     Shared UI (ui/), site header, logo, error boundary, profile widgets
  config/         brand.ts (product name), seo-routes.json (every route's SEO metadata)
  features/       Pages and feature UI
    builder/        Portfolio builder (canvas, inspector, layers, command palette, history)
    preview/        Preview iframe and page
    export/         Export Studio (HTML, ZIP, PDF, DOCX, JSON, framework code)
    analysis/       Insights panel
    importers/      Import dialog (JSON, HTML, resume text)
    share/          Share links (codec, dialog, /view)
    projects/       Portfolio list, new-project flow
    templates/      Template gallery and live thumbnails
    studio/         Dashboard, profile, resume, documents, application pack, profile sync
    knowledge/      Extract Your Data: library, review, compare, insert-from-library
    landing/        Landing, about, footer, showcases
    settings/       Settings and PWA update prompt
  hooks/          Autosave, hotkeys, project loading, app theme
  knowledge/      PDF intelligence: pdf/, ocr/, analysis/ (layout, semantic, skills, compare),
                  import/ (resume files, review, targets, to-portfolio), search/, storage/, export/
  lib/            Portfolio engines: html/, pdf/, docx/, document/, codegen/, analysis/,
                  import/, export/, theme/, storage/, compression/, sanitize.ts
  schemas/        Zod portfolio schema and migrations
  sections/       Section registry and definitions (defs/)
  stores/         Zustand stores (editor, assets, ui)
  studio/         Document engine: model/, engine/ (flow, layout, PDF, icons), templates/
                  (resume, letter, document, kit), export/, images/, import/, sync/, storage/
  templates/      Portfolio templates, the template builder (build.ts) and generated art (art.ts)
  utils/          Helpers (cn, ids, base path, …)
  workers/        studio, export and knowledge workers and their message protocols
scripts/
  prerender.mjs        Writes prerendered pages, app.html, sitemap, robots, llms.txt; base-path rewrite
  content-pages.mjs    Resume examples, portfolio examples and guides (content in seo-content/)
  vite-content-pages.ts Serves those pages in dev
  vite-local-assets.ts Copies PDF.js / Tesseract assets so nothing is fetched from a CDN
  generate-icons.mjs   PWA icons;  og-image.html  social image (npm run og-image)
tests/               Vitest suites (engine, exports, imports, schema, SEO, studio, knowledge, codegen)
public/              Icons, OG image, ads.txt, verification files
.github/workflows/   vercel.yml (CI + Vercel), github-pages.yml (GitHub Pages)
```

---

## Data & storage

- All data lives in the browser's **IndexedDB**. The stores hold portfolios, assets, version history, the studio profile, images, renders, resumes, documents and the extracted-data library.
- **Nothing is uploaded.** Exports are generated on the device and downloaded directly.
- **Backups:** export any portfolio or resume as JSON and import it back. The schema is versioned, and `src/schemas/migrations.ts` upgrades older files.
- Storage is per origin. Data saved on portfolioos.online is not visible on the GitHub Pages mirror, and the reverse.

---

## Portfolio engine

- **Sections:**
  - Each section type has a `SectionDefinition` in `src/sections/defs`, registered in `src/sections/registry.ts`.
  - A definition gives the defaults, the inspector fields, the HTML render and a `toDocument` mapping for PDF and DOCX.
  - The builder, exports and analysers all read the registry.
- **Themes:**
  - `src/lib/theme/themes.ts` defines colours (light and dark), fonts, radii, spacing and motion.
  - Themes compile to CSS variables (`--c-primary`, `--font-heading` and so on), which templates and custom sections use.
- **Templates:** each file in `src/templates` builds a complete sample portfolio with `buildPortfolio` and `section`. Placeholder imagery is generated SVG art from `art.ts`, so templates need no image files.

---

## Document engine

The engine lives in `src/studio`.

- **Pipeline:** `template.compose()` turns a resume, letter or block document into a serialisable **FlowDoc** (runs, icons, columns, decorations). `layoutFlow()` lays it out into a **LaidDocument**, a list of positioned primitives (text, rects, lines, icons, polygons, images).
- **Pagination:** keep-together groups, keep-with-next chains, orphan and widow control, repeated "(continued)" headings and multi-column flows.
- **Same output everywhere:** text is measured with the same font metrics jsPDF uses, so the on-screen pages (`PageSvg`) and the vector PDF break identically. DOCX and TXT are rendered from the FlowDoc.
- **ATS friendliness:** decorative bullets get invisible plain-text twins, and the reading order follows the document.
- **Exact re-import:** when *Document metadata* is on, the resume's content is embedded in the PDF as XMP (`src/studio/export/embedded.ts`). Uploading that PDF later restores it exactly, without guessing from the layout.
- **Fonts:** PDFs use the core fonts (Helvetica, Times, Courier). Characters these fonts can't encode, such as emoji and CJK, are removed from PDFs and reported by the document check. DOCX keeps full Unicode.

---

## Extract Your Data

The code lives in `src/knowledge`. The UI is at `/knowledge`.

1. **Read:** PDF.js extracts text with positions. Pages that have no text layer fall back to **Tesseract OCR**. Both run in a worker and use locally bundled language data.
2. **Layout analysis:**
   - lines, blocks and columns (with a gutter check so two-column resumes aren't interleaved);
   - tables, headings and reading order;
   - hard-wrapped lines are joined.
3. **Semantic model:**
   - sections, entries (role, company, location, dates), bullets and skills;
   - languages, links and contact details;
   - name promotion.
4. **Review:** accept or ignore each candidate. Each accepted item keeps a record of where it came from (provenance).
5. **Use it:**
   - insert from the library into resumes and documents, or drag it into the portfolio builder;
   - add it to an existing portfolio;
   - export the extracted data as JSON.

Nothing is auto-filled. Data is only added when you choose to insert it.

---

## Exports

| Output | Where | Notes |
|---|---|---|
| Standalone HTML | Export Studio | Self-contained, or with CDN fonts |
| Deploy-ready ZIP | Export Studio | Static site |
| React + Vite / Next.js project | Export Studio › Code | Generated, typed project with validation report (`src/lib/codegen`) |
| Portfolio PDF / DOCX | Export Studio | Page size, margins, header/footer, page numbers |
| Resume / letter / document | Studios | PDF (vector), DOCX, TXT, JSON |
| Application pack | Resume Studio | ZIP of resume, letter and portfolio |
| JSON backup | Everywhere | Re-importable, migrated on load |

A pre-export health check runs before every export.

---

## SEO, content pages & prerendering

- **`src/config/seo-routes.json`** is the only place each route's title, description, H1, sitemap priority and index/noindex flag are set. `src/app/seo.ts` applies it at runtime.
- **`scripts/prerender.mjs`** runs after `vite build` and writes:
  - `dist/<route>/index.html` for every public page, with its own head, JSON-LD and readable content, so crawlers don't need JavaScript;
  - `dist/app.html`, a noindex shell for private routes (editors, share links, settings);
  - `sitemap.xml`, `robots.txt` and `llms.txt`.
- **Content pages:** `scripts/content-pages.mjs` generates the resume examples, portfolio examples and guides from `scripts/seo-content/`. In dev, `vite-content-pages.ts` serves them.
- **Canonical URL:** set by `VITE_SITE_URL`, default `https://www.portfolioos.online`. It must be the host Vercel serves: the bare domain redirects to `www`, so canonicals and sitemap entries on the bare domain would point at a redirect and keep pages out of the index.
- **Counts in SEO copy:** `llms.txt` and the JSON-LD feature list read the resume template count from `src/studio/templates/count.ts`. `tests/seo-copy.test.ts` fails if the text in `seo-routes.json` or the guides goes stale.

---

## PWA & offline

- `vite-plugin-pwa` (Workbox) precaches the app shell and assets, so after the first load the app works offline. The large PDF.js and OCR files are left out of the precache and download the first time you extract data.
- **Updates use prompt mode:** when a new build is available, a *Reload* prompt appears at the bottom left (`src/features/settings/PwaPrompt.tsx`).
- **Base-path aware:** the manifest's `id`, `start_url` and `scope`, and the service worker's navigation denylist, follow the build's base path.

---

## Security & privacy

- **User content is never executed:**
  - markup is sanitised with DOMPurify (`src/lib/sanitize.ts`);
  - URLs in `href`, `src`, `xlink:href` and `poster` are protocol-checked;
  - custom CSS is scoped to its section.
- **Isolation:** the preview runs in an opaque-origin sandboxed iframe.
- **Response headers** (in `vercel.json`): HSTS and other security headers, plus `X-Robots-Tag: noindex` on private routes.
- **Privacy:** documents, photos and OCR never leave the device. Share links keep their data in the URL fragment, which browsers never send to a server.
- **Third-party scripts:** the hosted site serves ads, plus Vercel Analytics and Speed Insights when deployed on Vercel. Your content is never sent to them.

---

## Configuration

| Setting | Where | Default |
|---|---|---|
| Product name | `src/config/brand.ts` | Portfolio OS |
| Canonical domain | `VITE_SITE_URL` env | `https://www.portfolioos.online` |
| Base path (sub-path hosting) | `BASE_PATH` env at build time | `/` |
| Vercel Analytics / Speed Insights | `VITE_VERCEL_INSIGHTS=off` disables them | on |
| Route SEO | `src/config/seo-routes.json` | — |

Example sub-path build: `BASE_PATH=/portfolio-os/ VITE_VERCEL_INSIGHTS=off npm run build`. This one setting prefixes every link, asset, router path, PDF.js/OCR file and share link (`src/utils/base.ts`).

---

## Deployment

### Vercel (production — www.portfolioos.online)

- **Config:** `vercel.json` rewrites public routes to their prerendered pages and sends every other route to `app.html`. It also sets the security and cache headers.
- **Workflow:** `.github/workflows/vercel.yml` runs on every PR and on pushes to `main`:
  - **PR:** typecheck, tests and build, then a preview deploy whose URL is posted as a comment on the PR.
  - **Push to `main`:** the same checks, then a production deploy.
- **Secrets:** add these under *Settings › Secrets and variables › Actions*:
  - `VERCEL_TOKEN`, created at https://vercel.com/account/tokens;
  - `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`, from `.vercel/project.json` after running `npx vercel link`.
- **Avoid double deploys:** if Vercel's own GitHub integration is also connected, every push deploys twice. Either turn off its automatic deployments, or keep only the `check` job in this workflow.

### GitHub Pages (mirror)

- **Workflow:** `.github/workflows/github-pages.yml` runs on pushes to `main`, or manually. It:
  - builds with `BASE_PATH=/<repo>/` and Vercel insights off;
  - copies `app.html` to `404.html`, so deep links start the app;
  - adds `.nojekyll`;
  - deploys with `actions/deploy-pages`.
- **One-time setup:** *Settings › Pages › Source → GitHub Actions*.
- **URL:** `https://<owner>.github.io/<repo>/`. The canonical URL still points to the main domain.

### Other static hosts

- Serve `dist/`.
- Rewrite the public routes to `/<route>/index.html`, and everything else to `/app.html`.
- If the site lives under a sub-path, build with `BASE_PATH`.

---

## Testing

```bash
npm test            # all suites once
npm run test:watch  # watch mode
```

- **Runner:** Vitest, with jsdom for UI and DOM tests and node for engine tests. `fake-indexeddb` stands in for storage.
- **Coverage:**
  - the schema and its migrations;
  - the section engine and every template;
  - HTML, PDF and DOCX exports, and the framework code generators;
  - importers (JSON, HTML, resume text and files);
  - the share codec and the sanitiser;
  - SEO output;
  - the studio layout engine and its templates;
  - the knowledge pipeline (layout, semantic, OCR fallbacks).

CI runs `npm run typecheck`, `npm test` and `npm run build` before every deploy.

---

## Extending the system

- **New portfolio section:**
  1. Add its data type to `SectionDataMap` (`src/types`).
  2. Write a `SectionDefinition` in `src/sections/defs`.
  3. Register it in `src/sections/registry.ts`.

  The builder, exports and audits pick it up automatically.
- **New portfolio template:**
  1. Create `src/templates/<name>.ts` with `buildPortfolio` (add a theme in `src/lib/theme/themes.ts` if needed).
  2. Add it to `TEMPLATES` in `src/templates/index.ts`.
- **New resume template:**
  1. Add a template to `RESUME_TEMPLATES` in `src/studio/templates/resume/index.ts`, using the helpers in `kit.ts`.
  2. Bump `RESUME_TEMPLATE_COUNT` in `count.ts`. A test checks that the two match.
- **New public page:** add it to `src/config/seo-routes.json`. Prerendering, the sitemap and the head tags follow from that entry.
- **New guide or example page:** add its content to `scripts/seo-content/*.mjs`.

---

Made by [Anubhab Guha](https://anubhab-guha.vercel.app/).
