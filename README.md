# Portfolio OS

**Build once. Export everywhere.** A portfolio builder, generator and export studio that runs entirely in the browser. There is no backend, no account, and no server. Everything is stored locally in IndexedDB and works offline once loaded (PWA).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest (jsdom + fake-indexeddb)
npm run build      # static build in dist/ (+ prerendered SEO pages, sitemap, robots)
```

## What it does

- **Builder:** drag-and-drop sections (17 types), a generic inspector, 12 data-driven themes, a design randomizer, undo/redo with history, autosave, version snapshots, a command palette (⌘/Ctrl+K), a keyboard-first workflow, focus, presentation and print modes, and a dev view (HTML/CSS/JSON). On mobile it uses a bottom-sheet editor.
- **Preview:** a sandboxed iframe fed by the same engine, with desktop, laptop, tablet, mobile and custom viewports.
- **Export Studio:**
  - Standalone HTML, either self-contained or using CDN fonts
  - A deploy-ready ZIP
  - Vector PDF with page sizes, margins, headers, footers and page numbers
  - Editable DOCX (resume or full portfolio)
  - JSON backup
  - A resume generator (one-page, two-page, ATS)
  - A pre-export health check runs before every export
- **Insights:** accessibility, performance and content audits run locally against the generated output.
- **Import and share:**
  - JSON backups, with schema migrations
  - HTML files: exact restore from our own exports, heuristic mapping for others
  - Pasted resume text
  - Share links compressed into the URL fragment, with a QR code when the link fits

## SEO & crawling

- **Clean URLs** (`/resumes`, `/templates`…). Old `/#/route` links are redirected on load; share links use `/view#p=…` so the payload never reaches a server.
- **`src/config/seo-routes.json`** is the single source for every route's title, description, H1, sitemap priority and index/noindex. `src/app/seo.ts` applies it at runtime, and `scripts/prerender.mjs` (run by `npm run build`) uses it to write:
  - `dist/<route>/index.html` for each public page, with its own head, JSON-LD (Organization, WebSite, WebApplication, WebPage, BreadcrumbList) and readable content, so crawlers don't need JavaScript;
  - `dist/app.html`, a noindex shell for private routes (editors, share links, settings);
  - `sitemap.xml`, `robots.txt` and `llms.txt`.
- **Hosting:** `vercel.json` rewrites the public routes to their prerendered pages and everything else to `app.html`, and sends `X-Robots-Tag: noindex` for private routes. Other hosts need the same rewrites.
- Set `VITE_SITE_URL` to change the canonical domain (default `https://portfolioos.online`). Regenerate the social image with `npm run og-image`.

## Studios

The app now has four studios that share one identity (`/studio` is the dashboard):

- **Portfolio Studio** (`/projects`): the website builder described above. A portfolio can be *linked* to the shared profile (builder top bar → "Link profile"). Linked items sync both ways by id; portfolio-only content (images, case studies, layout) is never touched, and deleting in the portfolio never deletes from the library.
- **Profile Studio** (`/profile`): name, headline, bio, contact and social links, plus a local image editor. It supports crop and aspect presets, pan and zoom, rotation and flips, six adjustments, filters, backgrounds, seven shapes and a ring. You can make multiple variants from one stored original and override the smart-fit crop per placement.
- **Resume Studio** (`/resumes`, `/resume/:id`): multiple resume and CV versions and 10 templates.
  - Sections can be dragged, duplicated, hidden and edited.
  - Per-field *Shared ⇄ This resume* detaching.
  - Real pagination and fit-to-N-pages.
  - ATS and content checks.
  - Export to PDF, DOCX, TXT and JSON.
- **Document Studio** (`/documents`, `/document/:id`): block-based documents with 10 templates and cover letters with 4 templates.
- **Application pack**: resume PDF+DOCX, cover letter PDF+DOCX and the portfolio as standalone HTML, zipped locally.

### Document engine (`src/studio`)

```
Resume / Letter / Blocks ──template.compose()──► FlowDoc (serialisable)
                                                  │            │
                                     layoutFlow() │            │ renderFlowDocx() / renderFlowText()
                                                  ▼            ▼
                            LaidDocument (positioned prims)   DOCX · TXT
                                   │               │
                           PageSvg (preview)   renderLaidPdf (vector PDF)
```

- **Measurement:** text is measured with the same font metrics jsPDF uses, so the on-screen pages and the PDF break identically.
- **Pagination:** it honours keep-together groups, keep-with-next chains, orphan and widow control, repeated "(continued)" headings and multi-column flows.
- **Where it runs:** PDF, DOCX and ZIP generation runs in `src/workers/studio.worker.ts`, with a main-thread fallback.
- **Storage:** studio data lives in IndexedDB v2 stores `studio`, `images`, `renders`, `resumes` and `documents`.
- **Fonts:** PDFs use the standard core fonts (Helvetica, Times and Courier). Characters those fonts cannot encode, such as emoji and CJK, are removed from PDFs and reported by the document check. DOCX keeps full Unicode.

## Architecture

```
Portfolio (typed schema, src/types) ──► Section registry (src/sections)
                                            │ render → HTML   toDocument → DocModel
            ┌───────────────────────────────┼──────────────────────────┐
     Preview iframe               HTML / ZIP (src/lib/html)    PDF (src/lib/pdf) · DOCX (src/lib/docx)
```

One data model powers every output. No format has its own hard-coded copy of the portfolio.

- **New section type:** add its data type to `SectionDataMap` and write a `SectionDefinition` in `src/sections/defs`. Register it in `src/sections/registry.ts`. The builder, exports and analyzers then pick it up automatically.
- **Product name:** change it in `src/config/brand.ts`.
- **Security:**
  - User markup is sanitized with DOMPurify and custom CSS is scoped.
  - URLs are protocol-checked.
  - The preview runs in an opaque-origin sandbox.
  - Nothing a user enters is ever executed.
