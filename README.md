# Portfolio OS

**Build once. Export everywhere.** A portfolio builder, generator and export studio that runs entirely in the browser. There is no backend, no account, and no server. Everything is stored locally in IndexedDB and works offline once loaded (PWA).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest (jsdom + fake-indexeddb)
npm run build      # static build in dist/ — deploy anywhere
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
