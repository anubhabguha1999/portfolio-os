import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Copy, File, FileCode2, FileImage, FileJson, FileText, Folder, FolderOpen } from 'lucide-react';
import type { GeneratedFile, GeneratedProject } from '@/lib/codegen/types';
import { highlightCss, highlightHtml, highlightJson, type Token, type TokenKind } from '@/lib/highlight';
import { Button } from '@/components/ui/Button';
import { copyText } from '@/utils/download';
import { formatBytes } from '@/utils/format';
import { cn } from '@/utils/cn';

const COLORS: Record<TokenKind, string> = {
  plain: 'text-fg-muted',
  tag: 'text-[#ff7ab2]',
  attr: 'text-[#d9c97c]',
  string: 'text-[#8fd694]',
  comment: 'text-fg-subtle italic',
  punct: 'text-fg-subtle',
  prop: 'text-[#7dd3fc]',
  value: 'text-fg',
  number: 'text-[#f5a97f]',
  keyword: 'text-[#c4a7ff]',
  selector: 'text-[#ff9e64]',
  key: 'text-[#7dd3fc]',
};

const KEYWORDS = new Set(
  'import export from default function return const let var if else for of in while switch case break continue new typeof instanceof as type interface extends implements async await true false null undefined this class satisfies readonly keyof void'.split(' '),
);

/** Small TS/TSX tokenizer (comments, strings, template literals, JSX tags, keywords, numbers). */
export function highlightTs(src: string): Token[] {
  const out: Token[] = [];
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(<\/?[A-Za-z][\w.]*|\/?>)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([{}()[\];,.:=?!&|+\-*%<>])/g;
  let last = 0;
  for (const m of src.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: 'plain', text: src.slice(last, i) });
    const t = m[0];
    if (m[1]) out.push({ kind: 'comment', text: t });
    else if (m[2]) out.push({ kind: 'string', text: t });
    else if (m[3]) out.push({ kind: 'tag', text: t });
    else if (m[4]) out.push({ kind: 'number', text: t });
    else if (m[5]) out.push({ kind: KEYWORDS.has(t) ? 'keyword' : /^[A-Z]/.test(t) ? 'selector' : src[i + t.length] === '=' && src[i + t.length + 1] !== '=' ? 'attr' : 'plain', text: t });
    else out.push({ kind: 'punct', text: t });
    last = i + t.length;
  }
  if (last < src.length) out.push({ kind: 'plain', text: src.slice(last) });
  return out;
}

function tokensFor(path: string, src: string): Token[] {
  if (src.length > 200_000) return [{ kind: 'plain', text: src }];
  if (/\.(tsx?|jsx?|mjs|cjs)$/.test(path)) return highlightTs(src);
  if (/\.css$/.test(path)) return highlightCss(src);
  if (/\.json$/.test(path)) return highlightJson(src);
  if (/\.(html|xml|svg)$/.test(path)) return highlightHtml(src);
  return [{ kind: 'plain', text: src }];
}

export function fileSize(f: GeneratedFile): number {
  return typeof f.content === 'string' ? new TextEncoder().encode(f.content).byteLength : f.content.byteLength;
}

const IMAGE_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon' };

function mimeOf(path: string): string | null {
  return IMAGE_MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? null;
}

/* ------------------------------------------------------------------ */
/* Tree                                                                */
/* ------------------------------------------------------------------ */

interface Node {
  name: string;
  path: string;
  size: number;
  children: Node[] | null;
}

export function buildFileTree(files: GeneratedFile[]): Node {
  const root: Node = { name: '', path: '', size: 0, children: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    const size = fileSize(f);
    let node = root;
    parts.forEach((part, i) => {
      const leaf = i === parts.length - 1;
      node.size += size;
      const kids = node.children!;
      let next = kids.find((k) => k.name === part && (k.children === null) === leaf);
      if (!next) {
        next = { name: part, path: parts.slice(0, i + 1).join('/'), size: 0, children: leaf ? null : [] };
        kids.push(next);
      }
      if (leaf) next.size = size;
      node = next;
    });
  }
  const sort = (n: Node) => {
    n.children?.sort((a, b) => Number(b.children !== null) - Number(a.children !== null) || a.name.localeCompare(b.name));
    n.children?.forEach(sort);
  };
  sort(root);
  return root;
}

function iconFor(name: string) {
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(name)) return FileImage;
  if (/\.(tsx?|jsx?|mjs|css|html)$/i.test(name)) return FileCode2;
  if (/\.json$/i.test(name)) return FileJson;
  if (/\.(md|txt|xml)$/i.test(name)) return FileText;
  return File;
}

function Rows({ node, depth, selected, onSelect, collapsed, toggle }: { node: Node; depth: number; selected: string; onSelect: (p: string) => void; collapsed: Set<string>; toggle: (p: string) => void }) {
  return (
    <>
      {node.children?.map((c) => {
        const dir = c.children !== null;
        const open = dir && !collapsed.has(c.path);
        const Icon = dir ? (open ? FolderOpen : Folder) : iconFor(c.name);
        return (
          <li key={c.path}>
            <button
              type="button"
              onClick={() => (dir ? toggle(c.path) : onSelect(c.path))}
              aria-expanded={dir ? open : undefined}
              aria-current={!dir && selected === c.path ? 'true' : undefined}
              className={cn('flex w-full items-center gap-1.5 rounded-md py-[3px] pr-2 text-left hover:bg-hover', !dir && selected === c.path && 'bg-accent-soft text-fg')}
              style={{ paddingLeft: 6 + depth * 14 }}
            >
              {dir ? <ChevronRight className={cn('size-3 shrink-0 text-fg-subtle transition-transform', open && 'rotate-90')} aria-hidden="true" /> : <span className="w-3 shrink-0" />}
              <Icon className={cn('size-3.5 shrink-0', dir ? 'text-accent' : 'text-fg-subtle')} aria-hidden="true" />
              <span className={cn('min-w-0 flex-1 truncate', dir ? 'text-fg' : 'text-fg-muted')}>{c.name}</span>
              <span className="shrink-0 tabular-nums text-[11px] text-fg-subtle">{formatBytes(c.size)}</span>
            </button>
            {open && (
              <ul>
                <Rows node={c} depth={depth + 1} selected={selected} onSelect={onSelect} collapsed={collapsed} toggle={toggle} />
              </ul>
            )}
          </li>
        );
      })}
    </>
  );
}

export function GeneratedFileTree({ files, selected, onSelect }: { files: GeneratedFile[]; selected: string; onSelect: (p: string) => void }) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(['public/images', 'node_modules']));
  const toggle = (p: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  return (
    <ul className="p-1.5 font-mono text-[12px]" aria-label="Generated project files">
      <Rows node={tree} depth={0} selected={selected} onSelect={onSelect} collapsed={collapsed} toggle={toggle} />
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Viewer                                                              */
/* ------------------------------------------------------------------ */

function FileViewer({ file }: { file: GeneratedFile }) {
  const [copied, setCopied] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const mime = mimeOf(file.path);
  useEffect(() => {
    setCopied(false);
    if (!mime) return setImgUrl(null);
    const bytes = typeof file.content === 'string' ? new TextEncoder().encode(file.content) : file.content;
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }));
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, mime]);
  const text = typeof file.content === 'string' ? file.content : null;
  const tokens = useMemo(() => (text !== null ? tokensFor(file.path, text) : []), [file.path, text]);
  const lines = text ? text.split('\n').length : 0;
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0e]">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <p className="truncate font-mono text-[11.5px] text-fg-muted" title={file.path}>
          {file.path} <span className="text-fg-subtle">· {formatBytes(fileSize(file))}</span>
        </p>
        {text !== null && (
          <Button
            size="xs"
            variant="ghost"
            icon={copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
            onClick={async () => {
              setCopied(await copyText(text));
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </div>
      {text === null || (mime && mime !== 'image/svg+xml') ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
          <div>
            {imgUrl && <img src={imgUrl} alt={`Preview of ${file.path}`} className="mx-auto max-h-64 max-w-full rounded-lg border border-line bg-[repeating-conic-gradient(#2a2a33_0_25%,#1b1b22_0_50%)] bg-[length:16px_16px] object-contain" />}
            <p className="mt-3 text-[12px] text-fg-subtle">Binary file · {formatBytes(fileSize(file))}</p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex min-w-fit font-mono text-[12px] leading-[1.65]">
            <pre aria-hidden="true" className="select-none border-r border-line px-3 py-3 text-right text-fg-subtle/70">
              {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
            </pre>
            <pre className="flex-1 px-4 py-3" tabIndex={0} aria-label={`Source of ${file.path}`}>
              {tokens.map((t, i) => (
                <span key={i} className={COLORS[t.kind]}>
                  {t.text}
                </span>
              ))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function SourcePreview({ project, keyFiles }: { project: GeneratedProject; keyFiles: string[] }) {
  const paths = useMemo(() => new Set(project.files.map((f) => f.path)), [project]);
  const pinned = keyFiles.filter((p) => paths.has(p));
  const [selected, setSelected] = useState(pinned[0] ?? project.files[0]?.path ?? '');
  useEffect(() => {
    if (!paths.has(selected)) setSelected(pinned[0] ?? project.files[0]?.path ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);
  const file = project.files.find((f) => f.path === selected);
  return (
    <div className="flex h-full min-h-0 flex-col">
      {pinned.length > 0 && (
        <div role="tablist" aria-label="Key files" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel/60 px-2 py-1.5">
          {pinned.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === selected}
              onClick={() => setSelected(p)}
              className={cn('shrink-0 rounded-md px-2 py-1 font-mono text-[11.5px]', p === selected ? 'bg-elevated text-fg shadow-[0_0_0_1px_var(--app-line-strong)]' : 'text-fg-subtle hover:bg-hover hover:text-fg')}
              title={p}
            >
              {p.split('/').pop()}
              {p.split('/').length > 1 && <span className="ml-1 text-fg-subtle/70">{p.split('/').slice(-2, -1)[0]}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="h-64 shrink-0 overflow-auto border-b border-line bg-panel md:h-auto md:w-72 md:border-b-0 md:border-r">
          <GeneratedFileTree files={project.files} selected={selected} onSelect={setSelected} />
        </div>
        <div className="relative min-h-[420px] min-w-0 flex-1">{file ? <FileViewer file={file} /> : null}</div>
      </div>
    </div>
  );
}
