import { AlertTriangle } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { LANGUAGE_OPTIONS, normalizeLanguage, pdfFontNote, type DocLanguage } from '@/i18n';

/**
 * Output language of a resume / letter / document. Translates the fixed strings the
 * template prints (default headings, "Present", dates, page numbers); typed text and
 * custom headings are never changed. Warns honestly when the PDF fonts can't draw the script.
 */
export function LanguageField({ value, onChange }: { value: string | undefined; onChange: (v: DocLanguage) => void }) {
  const lang = normalizeLanguage(value);
  const note = pdfFontNote(lang);
  return (
    <div className="space-y-2">
      <Select
        label="Language"
        value={lang}
        onChange={(e) => onChange(normalizeLanguage(e.target.value))}
        options={LANGUAGE_OPTIONS}
        help="Default headings, dates, “Present” and page labels. Your own text and custom headings stay as typed."
      />
      {note && (
        <p role="note" className="flex gap-1.5 rounded-lg border border-line bg-bg p-2.5 text-[11.5px] leading-snug text-warn">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}
