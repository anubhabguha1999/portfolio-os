import { useId, useRef, useState } from 'react';
import { Bold, Eye, Italic, Link2, List, Pencil } from 'lucide-react';
import { FieldShell } from '@/components/ui/Field';
import { renderMarkdown } from '@/lib/sanitize';
import { cn } from '@/utils/cn';

function wrapSelection(el: HTMLTextAreaElement, before: string, after = before, placeholder = 'text'): string {
  const { selectionStart: s, selectionEnd: e, value } = el;
  const sel = value.slice(s, e) || placeholder;
  const next = value.slice(0, s) + before + sel + after + value.slice(e);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(s + before.length, s + before.length + sel.length);
  });
  return next;
}

export function MarkdownField({ label, help, value, onChange, disabled }: { label: string; help?: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const tool = (fn: (el: HTMLTextAreaElement) => string) => () => ref.current && onChange(fn(ref.current));
  return (
    <FieldShell
      label={label}
      help={help}
      htmlFor={id}
      trailing={
        <div className="-mt-1.5 mb-1 flex items-center gap-0.5 text-fg-subtle">
          {!preview && (
            <>
              <ToolBtn label="Bold" onClick={tool((el) => wrapSelection(el, '**'))}><Bold className="size-3" /></ToolBtn>
              <ToolBtn label="Italic" onClick={tool((el) => wrapSelection(el, '_'))}><Italic className="size-3" /></ToolBtn>
              <ToolBtn label="Link" onClick={tool((el) => wrapSelection(el, '[', '](https://)', 'link text'))}><Link2 className="size-3" /></ToolBtn>
              <ToolBtn label="Bullet list" onClick={tool((el) => wrapSelection(el, '\n- ', '', 'item'))}><List className="size-3" /></ToolBtn>
            </>
          )}
          <ToolBtn label={preview ? 'Edit' : 'Preview'} onClick={() => setPreview(!preview)}>{preview ? <Pencil className="size-3" /> : <Eye className="size-3" />}</ToolBtn>
        </div>
      }
    >
      {preview ? (
        <div className="app-input prose-sm max-h-72 min-h-24 overflow-auto text-[13px] leading-relaxed [&_a]:text-accent [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) || '<p style="opacity:.5">Nothing to preview</p>' }} />
      ) : (
        <textarea ref={ref} id={id} rows={5} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="app-input min-h-24 resize-y leading-relaxed [field-sizing:content] max-h-96" />
      )}
    </FieldShell>
  );
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-6 place-items-center rounded-md hover:bg-hover hover:text-fg">
      {children}
    </button>
  );
}

export function CodeField({ label, help, value, onChange, disabled, language }: { label: string; help?: string; value: string; onChange: (v: string) => void; disabled?: boolean; language: 'html' | 'css' | 'markdown' }) {
  const id = useId();
  return (
    <FieldShell label={<span>{label} <span className="ml-1 rounded bg-hover px-1 py-px font-mono text-[10px] uppercase text-fg-subtle">{language}</span></span>} help={help} htmlFor={id}>
      <textarea
        id={id}
        rows={8}
        value={value}
        disabled={disabled}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
            // Insert two spaces; Shift+Tab / Escape-then-Tab still moves focus.
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: s, selectionEnd: en } = el;
            onChange(el.value.slice(0, s) + '  ' + el.value.slice(en));
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
          } else if (e.key === 'Escape') {
            e.currentTarget.blur();
          }
        }}
        className={cn('app-input min-h-40 resize-y font-mono !text-[12px] leading-relaxed')}
      />
    </FieldShell>
  );
}
