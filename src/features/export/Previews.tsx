import { useMemo } from 'react';
import { File, FileCode2, FileImage, FileJson, FileText, Folder, Image as ImageIcon, Link2, Table2, Tags } from 'lucide-react';
import type { DocBlock, DocModel } from '@/types/document';
import type { ExportFileEntry } from '@/lib/export';
import { formatBytes } from '@/utils/format';
import { cn } from '@/utils/cn';

/* ------------------------------------------------------------------ */
/* Live HTML preview                                                   */
/* ------------------------------------------------------------------ */

export function HtmlFrame({ html, title }: { html: string; title: string }) {
  return <iframe title={title} sandbox="allow-scripts" srcDoc={html} className="size-full border-0 bg-white" referrerPolicy="no-referrer" />;
}

export function PdfFrame({ url, title }: { url: string; title: string }) {
  return <iframe title={title} src={url} className="size-full border-0 bg-[#525659]" />;
}

/* ------------------------------------------------------------------ */
/* ZIP file tree                                                       */
/* ------------------------------------------------------------------ */

interface TreeNode {
  name: string;
  path: string;
  size: number;
  children: TreeNode[] | null;
}

function buildTree(files: ExportFileEntry[]): TreeNode {
  const root: TreeNode = { name: '', path: '', size: 0, children: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      const leaf = i === parts.length - 1;
      node.size += f.size;
      const kids = node.children ?? (node.children = []);
      let next = kids.find((k) => k.name === part && (k.children === null) === leaf);
      if (!next) {
        next = { name: part, path: parts.slice(0, i + 1).join('/'), size: 0, children: leaf ? null : [] };
        kids.push(next);
      }
      if (leaf) next.size = f.size;
      node = next;
    });
  }
  const sort = (n: TreeNode) => {
    n.children?.sort((a, b) => Number(b.children !== null) - Number(a.children !== null) || a.name.localeCompare(b.name));
    n.children?.forEach(sort);
  };
  sort(root);
  return root;
}

function fileIcon(name: string) {
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(name)) return FileImage;
  if (/\.(html|css|js)$/i.test(name)) return FileCode2;
  if (/\.json$/i.test(name)) return FileJson;
  if (/\.(md|txt|xml)$/i.test(name)) return FileText;
  return File;
}

function TreeRows({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <>
      {node.children?.map((child) => {
        const Icon = child.children ? Folder : fileIcon(child.name);
        return (
          <li key={child.path}>
            <div className="flex items-center gap-2 rounded-md px-2 py-[3px] hover:bg-hover" style={{ paddingLeft: 8 + depth * 16 }}>
              <Icon className={cn('size-3.5 shrink-0', child.children ? 'text-accent' : 'text-fg-subtle')} aria-hidden="true" />
              <span className={cn('min-w-0 flex-1 truncate', child.children ? 'text-fg' : 'text-fg-muted')}>
                {child.name}
                {child.children ? '/' : ''}
              </span>
              <span className="shrink-0 tabular-nums text-fg-subtle">{child.children && !child.children.length ? '—' : formatBytes(child.size)}</span>
            </div>
            {child.children && child.children.length > 0 && (
              <ul>
                <TreeRows node={child} depth={depth + 1} />
              </ul>
            )}
          </li>
        );
      })}
    </>
  );
}

export function FileTree({ files, emptyDirs = [], zipSize }: { files: ExportFileEntry[]; emptyDirs?: string[]; zipSize: number | null }) {
  const tree = useMemo(() => {
    const t = buildTree(files);
    // Show documented folders that ended up empty (e.g. assets/fonts without custom fonts).
    for (const dir of emptyDirs) {
      const parts = dir.split('/');
      let node = t;
      for (const part of parts) {
        const kids = node.children ?? (node.children = []);
        let next = kids.find((k) => k.name === part && k.children !== null);
        if (!next) {
          next = { name: part, path: `${node.path}/${part}`, size: 0, children: [] };
          kids.push(next);
          kids.sort((a, b) => Number(b.children !== null) - Number(a.children !== null) || a.name.localeCompare(b.name));
        }
        node = next;
      }
    }
    return t;
  }, [files, emptyDirs]);
  const total = files.reduce((a, f) => a + f.size, 0);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-[11.5px] text-fg-subtle">
        <span>
          {files.length} files · {formatBytes(total)} uncompressed
        </span>
        {zipSize !== null && <span className="font-medium text-fg-muted">{formatBytes(zipSize)} zipped</span>}
      </div>
      <ul className="min-h-0 flex-1 overflow-auto p-1.5 font-mono text-[12px]" aria-label="Package contents">
        <TreeRows node={tree} depth={0} />
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Document outline (DOCX / pre-generation PDF)                        */
/* ------------------------------------------------------------------ */

const plainRuns = (runs: Array<{ text: string }>) => runs.map((r) => r.text).join('');

function clip(text: string, n = 180): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function BlockOutline({ b }: { b: DocBlock }) {
  switch (b.kind) {
    case 'heading':
      return <p className={cn('font-semibold text-[#111827]', b.level === 1 ? 'mt-2 text-[14px]' : 'mt-1.5 text-[13px]')}>{b.text}</p>;
    case 'paragraph': {
      const t = clip(plainRuns(b.runs));
      return t ? <p className={cn('text-[12.5px] leading-relaxed', b.tone === 'muted' || b.tone === 'small' ? 'text-[#6b7280]' : 'text-[#374151]', b.tone === 'lead' && 'text-[13.5px]')}>{t}</p> : null;
    }
    case 'list':
      return (
        <ul className="ml-4 list-disc space-y-0.5 text-[12.5px] text-[#374151] marker:text-[#9ca3af]">
          {b.items.slice(0, 4).map((it, i) => (
            <li key={i}>{clip(plainRuns(it), 120)}</li>
          ))}
          {b.items.length > 4 && <li className="list-none text-[#9ca3af]">+ {b.items.length - 4} more</li>}
        </ul>
      );
    case 'entry':
      return (
        <div className="mt-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold text-[#111827]">
              {b.title || 'Untitled'}
              {b.link && <Link2 className="ml-1 inline size-3 text-[#9ca3af]" aria-label="has link" />}
            </p>
            {b.meta && <span className="shrink-0 text-[11.5px] text-[#6b7280]">{b.meta}</span>}
          </div>
          {(b.subtitle || b.location) && (
            <p className="flex justify-between gap-3 text-[12px] italic text-[#4b5563]">
              <span>{b.subtitle}</span>
              <span className="not-italic text-[#9ca3af]">{b.location}</span>
            </p>
          )}
          <div className="mt-1 space-y-1">
            {b.body.map((c, i) => (
              <BlockOutline key={i} b={c} />
            ))}
          </div>
        </div>
      );
    case 'tags':
      return (
        <p className="flex items-start gap-1.5 text-[12px] text-[#374151]">
          <Tags className="mt-0.5 size-3 shrink-0 text-[#9ca3af]" aria-hidden="true" />
          <span>
            {b.label && <strong className="font-semibold">{b.label}: </strong>}
            {b.items.join(', ')}
          </span>
        </p>
      );
    case 'image':
      return (
        <p className="flex items-center gap-1.5 rounded border border-dashed border-[#d1d5db] px-2 py-1 text-[11.5px] text-[#6b7280]">
          <ImageIcon className="size-3.5" aria-hidden="true" /> Image{b.alt ? `: ${b.alt}` : ''}
        </p>
      );
    case 'table':
      return (
        <p className="flex items-center gap-1.5 text-[11.5px] text-[#6b7280]">
          <Table2 className="size-3.5" aria-hidden="true" /> Table · {b.rows.length} row{b.rows.length === 1 ? '' : 's'}
        </p>
      );
    case 'quote':
      return <blockquote className="border-l-2 border-[#d1d5db] pl-2 text-[12.5px] italic text-[#4b5563]">{clip(b.text, 140)}</blockquote>;
    case 'contact':
      return <p className="text-[12px] text-[#6b7280]">{clip(plainRuns(b.items))}</p>;
    case 'divider':
      return <hr className="border-[#e5e7eb]" />;
    case 'pageBreak':
      return <p className="text-center text-[10.5px] uppercase tracking-widest text-[#9ca3af]">Page break</p>;
    default:
      return null;
  }
}

export function DocOutline({ model, accent }: { model: DocModel; accent: string }) {
  return (
    <div className="mx-auto w-full max-w-[680px] rounded-sm bg-white px-8 py-9 text-left shadow-[0_20px_60px_-20px_rgba(0,0,0,.6)] sm:px-12">
      {model.header && (
        <header className="mb-4 border-b border-[#e5e7eb] pb-4">
          <p className="text-[22px] font-bold tracking-tight text-[#111827]">{model.header.name}</p>
          {model.header.headline && (
            <p className="text-[13.5px]" style={{ color: accent }}>
              {model.header.headline}
            </p>
          )}
          {model.header.contact.length > 0 && <p className="mt-1 text-[11.5px] text-[#6b7280]">{plainRuns(model.header.contact)}</p>}
        </header>
      )}
      <div className="space-y-4">
        {model.sections.map((s) => (
          <section key={s.id} className="space-y-1.5">
            {s.title && (
              <h3 className="border-b pb-0.5 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: accent, borderColor: `${accent}55` }}>
                {s.title}
              </h3>
            )}
            {s.blocks.map((b, i) => (
              <BlockOutline key={i} b={b} />
            ))}
          </section>
        ))}
        {!model.sections.length && <p className="text-[13px] text-[#6b7280]">This document has no content yet. Add sections in the builder.</p>}
      </div>
    </div>
  );
}
