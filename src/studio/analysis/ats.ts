/**
 * Objective, client-side ATS compatibility checks. These describe properties of the
 * generated document; they are not a prediction of how any particular system scores it.
 */
import type { LaidDocument } from '@/studio/engine/flow';
import type { ResolvedResume } from '@/studio/model/resolve';
import { SECTION_KINDS } from '@/studio/model/defaults';
import { templateTraits } from '@/studio/templates/resume';

export interface AtsCheck {
  id: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  label: string;
  detail: string;
}

export const ATS_DISCLAIMER =
  'These checks are objective observations about the exported file, not a guarantee. Applicant-tracking systems differ widely in how they parse documents, and no tool can promise how a specific system will read or rank a resume. When in doubt, also submit the plain-text or DOCX version.';

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s().-]{6,}\d)/;

const STANDARD = new Set(SECTION_KINDS.flatMap((k) => k.standard.map((s) => s.toLowerCase())));

export function atsCheck(input: { resolved: ResolvedResume; templateId: string; laid: LaidDocument; text: string }): AtsCheck[] {
  const { resolved: r, templateId, laid, text } = input;
  const out: AtsCheck[] = [];
  const style = r.style;

  out.push(
    laid.stats.textRuns > 0
      ? { id: 'selectable', status: 'pass', label: 'Text is selectable', detail: 'All text is exported as real vector text, not pictures.' }
      : { id: 'selectable', status: 'fail', label: 'No selectable text found', detail: 'The layout produced no text runs.' },
  );

  const nonStandard = r.sections.filter((s) => !STANDARD.has(s.title.trim().toLowerCase())).map((s) => s.title);
  out.push(
    nonStandard.length
      ? { id: 'headings', status: 'warn', label: 'Non-standard section headings', detail: `Parsers look for common headings. Consider renaming: ${nonStandard.join(', ')}.` }
      : { id: 'headings', status: 'pass', label: 'Standard section headings', detail: 'Every heading uses a conventional name (Experience, Education, Skills…).' },
  );

  const hasEmail = EMAIL.test(text) || r.contact.some((c) => c.kind === 'email');
  const hasPhone = PHONE.test(text) || r.contact.some((c) => c.kind === 'phone');
  out.push(
    hasEmail && hasPhone
      ? { id: 'contact', status: 'pass', label: 'Contact information detected', detail: 'Email and phone number found in the text.' }
      : { id: 'contact', status: hasEmail || hasPhone ? 'warn' : 'fail', label: 'Contact information incomplete', detail: `Missing: ${[!hasEmail && 'email', !hasPhone && 'phone'].filter(Boolean).join(' and ')}.` },
  );

  const shapes = laid.stats.decorativeShapes;
  out.push(
    shapes <= 25
      ? { id: 'graphics', status: 'pass', label: 'No excessive graphics', detail: `${shapes} decorative shape${shapes === 1 ? '' : 's'} (rules, fills).` }
      : { id: 'graphics', status: 'warn', label: 'Many decorative graphics', detail: `${shapes} shapes such as chips, bars and fills. Text still parses, but simpler layouts are safer.` },
  );

  const min = laid.stats.minFontSize;
  out.push(
    min >= 9
      ? { id: 'font-size', status: 'pass', label: 'Reasonable font size', detail: `Smallest text is ${min.toFixed(1)}pt.` }
      : min >= 8
        ? { id: 'font-size', status: 'warn', label: 'Some small text', detail: `Smallest text is ${min.toFixed(1)}pt; 9pt or more is easier to read and parse.` }
        : { id: 'font-size', status: 'fail', label: 'Text too small', detail: `Smallest text is ${min.toFixed(1)}pt.` },
  );

  out.push({ id: 'text-images', status: 'pass', label: 'No critical text inside images', detail: 'Names, headings and content are never rasterised.' });

  const traits = templateTraits(templateId);
  if (traits.columns === 2 && !style.atsSafe) out.push({ id: 'columns', status: 'warn', label: 'Two-column layout', detail: 'Some parsers read columns in the wrong order. ATS-safe mode renders a single column.' });
  else out.push({ id: 'columns', status: 'pass', label: 'Single-column reading order', detail: 'Content reads top to bottom.' });

  if (style.iconStyle === 'glyph' && !style.atsSafe) out.push({ id: 'icons', status: 'warn', label: 'Decorative icons', detail: 'Glyph markers are decorative; labels (Email:, Phone:) are clearer to parsers.' });

  if (r.photo) out.push({ id: 'photo', status: 'warn', label: 'Photo included', detail: 'Photos are ignored by parsers and discouraged in some countries (US, UK). Keep them where they are customary.' });
  else out.push({ id: 'photo', status: 'info', label: 'No photo', detail: 'Recommended for most ATS submissions.' });

  out.push(
    laid.stats.links > 0
      ? { id: 'links', status: 'pass', label: 'Links are clickable', detail: `${laid.stats.links} link annotation${laid.stats.links === 1 ? '' : 's'}.` }
      : { id: 'links', status: 'info', label: 'No links', detail: 'Consider adding LinkedIn, GitHub or a portfolio URL.' },
  );

  const chars = laid.stats.unsupportedChars;
  if (chars.length) out.push({ id: 'chars', status: 'warn', label: 'Unsupported characters removed', detail: `${chars.slice(0, 8).join(' ')} cannot be encoded by the PDF fonts.` });

  const head = text.split('\n').filter((l) => l.trim()).slice(0, 4).join(' ').toLowerCase();
  out.push(
    head.includes(r.name.toLowerCase())
      ? { id: 'order', status: 'pass', label: 'Name appears first', detail: 'The plain-text reading order starts with your name.' }
      : { id: 'order', status: 'warn', label: 'Name is not at the top of the text', detail: 'In reading order your name is not among the first lines.' },
  );

  const exp = r.sections.filter((s) => s.kind === 'experience').flatMap((s) => s.items);
  if (exp.length) {
    const undated = exp.filter((i) => !i.date.trim()).length;
    out.push(undated ? { id: 'dates', status: 'warn', label: 'Experience dates missing', detail: `${undated} of ${exp.length} position${exp.length === 1 ? '' : 's'} have no dates.` } : { id: 'dates', status: 'pass', label: 'Experience dates found', detail: 'Every position has a date range.' });
  }
  return out;
}
