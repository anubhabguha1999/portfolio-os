import { describe, expect, it } from 'vitest';
import { analyseLayout, collectLinks, findGutter, pageText, safeLinkUrl } from '@/knowledge/analysis/layout';
import { analyse, textToRawPages } from '@/knowledge/analysis/pipeline';
import { classifyDocument } from '@/knowledge/analysis/semantic';
import { canonicalSkill, sameSkill } from '@/knowledge/analysis/skills';
import { DEFAULT_EXTRACTION_OPTIONS } from '@/knowledge/types';
import { page, RESUME_PAGE } from './fixtures';

describe('layout analysis', () => {
  it('detects title, headings, lists and paragraphs', () => {
    const [p] = analyseLayout([RESUME_PAGE]);
    const types = p!.blocks.map((b) => b.type);
    expect(p!.blocks[0]).toMatchObject({ type: 'title', text: 'Anubhab Guha' });
    expect(p!.blocks.find((b) => b.text === 'EXPERIENCE')?.type).toBe('heading');
    const list = p!.blocks.find((b) => b.type === 'list');
    expect(list?.items).toEqual(['Built React and Node.js dashboards used by 40 analysts.', 'Cut API latency by 35% with Redis caching.']);
    expect(types).toContain('paragraph');
    for (const b of p!.blocks) expect(b.width).toBeGreaterThan(0);
  });

  it('joins wrapped bullets and paragraph lines that run to the margin', () => {
    const long = 'Led development of the highway damage and maintenance system for the national';
    const [p] = analyseLayout([
      page(1, [
        ['• ' + long, 58],
        ['Authority of India (NHAI).', 58],
        ['• Managed databases.', 58],
        null,
        ['Designed and developed a scalable full-stack e-commerce platform using React and Node', 50],
        ['Express with real-time capabilities and background jobs.', 50],
      ]),
    ]);
    expect(p!.blocks.find((b) => b.type === 'list')?.items).toEqual([`${long} Authority of India (NHAI).`, 'Managed databases.']);
    expect(pageText(p!)).toContain('using React and Node Express with real-time');
  });

  it('keeps short contact and link rows on their own lines', () => {
    const [p] = analyseLayout([
      page(1, [
        ['jane@example.com | +1 415 555 0134 | Austin, TX'],
        ['GitHub'],
        null,
        ['Long body text that runs all the way across the text area so it defines the right margin of the page'],
      ]),
    ]);
    expect(pageText(p!).split('\n')).toEqual(expect.arrayContaining(['jane@example.com | +1 415 555 0134 | Austin, TX', 'GitHub']));
  });

  it('extracts tables with aligned columns', () => {
    const [p] = analyseLayout([page(1, [['Company\tRole\tDuration'], ['ABC\tDeveloper\t2023-2025'], ['XYZ\tIntern\t2022-2023']])]);
    const t = p!.blocks.find((b) => b.type === 'table');
    expect(t?.rows).toEqual([
      ['Company', 'Role', 'Duration'],
      ['ABC', 'Developer', '2023-2025'],
      ['XYZ', 'Intern', '2022-2023'],
    ]);
  });

  it('keeps a table whole on a page that has other text', () => {
    const [p] = analyseLayout([
      page(1, [
        ['Quarterly Engineering Report', 50, 20, true],
        ['This report summarises delivery, reliability and hiring across the platform teams this quarter.'],
        ['Team Allocation', 50, 13, true],
        ['Company\tRole\tDuration'],
        ['ABC Corp\tDeveloper\t2023-2025'],
        ['XYZ Ltd\tIntern\t2022-2023'],
        ['Northwind\tLead\t2021-2022'],
        ['Conclusion', 50, 13, true],
        ['Findings and recommendations follow in the appendix.'],
      ]),
    ]);
    const t = p!.blocks.find((b) => b.type === 'table');
    expect(t?.rows?.[0]).toEqual(['Company', 'Role', 'Duration']);
    expect(t?.rows).toHaveLength(4);
    expect(p!.blocks.map((b) => b.type)).toEqual(['title', 'paragraph', 'heading', 'table', 'heading', 'paragraph']);
  });

  it('reads two-column pages column by column', () => {
    const left = Array.from({ length: 8 }, (_, i) => [`Left line ${i + 1}`, 40] as [string, number]);
    const raw = page(1, left);
    // Right column at the same heights.
    raw.items.push(...raw.items.map((it, i) => ({ ...it, x: 340, y: it.y + 6, text: `Right line ${i + 1}` })));
    expect(findGutter(raw.items, raw.width)).not.toBeNull();
    const text = pageText(analyseLayout([raw])[0]!);
    expect(text.indexOf('Left line 8')).toBeLessThan(text.indexOf('Right line 1'));
  });

  it('drops running headers, footers and page numbers into their own blocks', () => {
    const mk = (n: number) => {
      const p = page(n, [['ACME Report 2026'], null, null, null, null, null, null, null, null, ['Body text on page ' + n]], { startY: 20 });
      p.items.push({ text: String(n), x: 300, y: 770, width: 6, height: 10, fontSize: 10, fontName: 'F', bold: false });
      return p;
    };
    const pages = analyseLayout([mk(1), mk(2), mk(3)]);
    for (const p of pages) {
      expect(p.blocks.find((b) => b.type === 'header')?.text).toBe('ACME Report 2026');
      expect(p.blocks.find((b) => b.type === 'footer')).toBeTruthy();
      expect(pageText(p)).not.toContain('ACME');
    }
  });

  it('only keeps safe link protocols', () => {
    expect(safeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(safeLinkUrl('data:text/html,hi')).toBeNull();
    expect(safeLinkUrl('file:///etc/passwd')).toBeNull();
    expect(safeLinkUrl('https://github.com/x')).toBe('https://github.com/x');
    expect(safeLinkUrl('mailto:a@b.co')).toBe('mailto:a@b.co');
    const raw = { ...RESUME_PAGE, links: [{ url: 'javascript:void(0)', x: 0, y: 0, width: 10, height: 10 }, { url: 'https://github.com/anubhabguha1999', x: 300, y: 80, width: 100, height: 12 }] };
    const links = collectLinks([raw], analyseLayout([raw]));
    expect(links.some((l) => l.url.startsWith('javascript'))).toBe(false);
    expect(links.find((l) => l.origin === 'annotation')?.url).toBe('https://github.com/anubhabguha1999');
    expect(links.some((l) => l.url === 'mailto:anubhab@example.com')).toBe(true);
  });
});

describe('semantic extraction', () => {
  const out = analyse({ docId: 'd1', docName: 'Resume.pdf', raw: [RESUME_PAGE], metadata: null, options: DEFAULT_EXTRACTION_OPTIONS });
  const r = out.semantic.resume!;

  it('classifies a resume', () => {
    expect(out.semantic.docType).toBe('resume');
    expect(classifyDocument(analyseLayout([page(1, [['This is to certify that Jane Doe has successfully completed the course'], ['Certificate of Completion']])]), 'cert.pdf').type).toBe('certificate');
  });

  it('extracts the profile with confidence and provenance', () => {
    expect(r.profile.name.value).toBe('Anubhab Guha');
    expect(r.profile.name.confidence).toBeGreaterThan(0.9);
    expect(r.profile.name.source).toMatchObject({ docId: 'd1', page: 1 });
    expect(r.profile.email).toMatchObject({ value: 'anubhab@example.com', confidence: 0.98 });
    expect(r.profile.headline.value).toBe('Senior Software Developer');
    expect(r.profile.github.value).toContain('github.com/anubhabguha1999');
  });

  it('normalises experience dates without inventing an end date', () => {
    const e = r.experience[0]!;
    expect(e.role.value).toBe('Senior Software Developer');
    expect(e.company.value).toBe('SoftSensor AI');
    expect(e.startDate.value).toBe('2024-01');
    expect(e.endDate.value).toBeNull();
    expect(e.current).toBe(true);
    expect(e.achievements).toHaveLength(2);
  });

  it('extracts projects with normalised technologies', () => {
    const p = r.projects.find((x) => x.title.value === 'Vehicle Management System');
    expect(p?.technologies).toEqual(['React', 'Node.js', 'MongoDB']);
  });

  it('normalises skill aliases and keeps the original text', () => {
    const react = r.skills.find((s) => s.name === 'React');
    expect(react?.original).toBe('React.js');
    expect(r.skills.find((s) => s.name === 'Leadership')?.confidence).toBeLessThan(0.8);
    expect(canonicalSkill('ReactJS')?.name).toBe('React');
    expect(canonicalSkill('React JS')?.name).toBe('React');
    expect(sameSkill('Node.js', 'nodejs')).toBe(true);
    expect(sameSkill('React', 'React Native')).toBe(false);
  });

  it('keeps generic documents out of the resume schema', () => {
    const g = analyse({ docId: 'd2', docName: 'notes.pdf', raw: [RESUME_PAGE], metadata: null, options: { ...DEFAULT_EXTRACTION_OPTIONS, semantic: 'generic' } });
    expect(g.semantic.resume).toBeNull();
  });

  it('turns markdown into structured pages', () => {
    const md = analyse({ docId: 'd3', docName: 'cv.md', raw: textToRawPages('# Jane Doe\n\nFrontend engineer\n\n## Skills\n\n- React\n- TypeScript', 'md'), metadata: null, options: DEFAULT_EXTRACTION_OPTIONS });
    expect(md.pages[0]!.blocks[0]!.type).toBe('title');
    expect(md.pages[0]!.blocks.find((b) => b.type === 'list')?.items).toEqual(['React', 'TypeScript']);
  });
});

describe('import review', async () => {
  const { buildReview, applyReview } = await import('@/knowledge/import/review');
  const { emptyLibrary, emptyProfile, createLibExperience, createLibSkill } = await import('@/studio/model/defaults');
  const out = analyse({ docId: 'd1', docName: 'Resume.pdf', raw: [RESUME_PAGE], metadata: null, options: DEFAULT_EXTRACTION_OPTIONS });
  const r = out.semantic.resume!;

  it('never overwrites existing profile values by default', () => {
    const profile = { ...emptyProfile(), name: 'Alex Morgan', email: '' };
    const review = buildReview(r, 'd1', 'Resume.pdf', profile, emptyLibrary());
    expect(review.profile.find((f) => f.key === 'name')).toMatchObject({ decision: 'ignore', existing: 'Alex Morgan' });
    expect(review.profile.find((f) => f.key === 'email')).toMatchObject({ decision: 'accept' });
    const res = applyReview(review, profile, emptyLibrary());
    expect(res.profile.name).toBe('Alex Morgan');
    expect(res.profile.email).toBe('anubhab@example.com');
    expect(res.provenance.find((p) => p.field === 'email')?.source).toMatchObject({ docId: 'd1', page: 1 });
  });

  it('flags duplicates and merges instead of duplicating', () => {
    const lib = emptyLibrary();
    lib.skills = [createLibSkill({ name: 'React' })];
    lib.experience = [createLibExperience({ company: 'SoftSensor AI', role: 'Software Developer', start: '2022-01' })];
    const review = buildReview(r, 'd1', 'Resume.pdf', emptyProfile(), lib);
    const react = review.items.find((i) => i.kind === 'skills' && (i.value as { name: string }).name === 'React')!;
    expect(react.duplicateOf).toBe(lib.skills[0]!.id);
    // A senior role at the same company is a different item.
    expect(review.items.find((i) => i.kind === 'experience')!.duplicateOf).toBeNull();
    const res = applyReview(review, emptyProfile(), lib);
    expect(res.library.skills.filter((s) => s.name === 'React')).toHaveLength(1);
    expect(res.library.experience).toHaveLength(2);
  });
});
