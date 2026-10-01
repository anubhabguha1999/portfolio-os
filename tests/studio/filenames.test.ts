import { describe, it, expect } from 'vitest';
import { documentFileName, sanitizeFileName } from '@/studio/export/pipeline';

describe('file names', () => {
  it('builds clean default names', () => {
    expect(documentFileName('Anubhab', 'Resume', 'pdf')).toBe('Anubhab_Resume.pdf');
    expect(documentFileName('Anubhab', 'Cover_Letter', 'docx')).toBe('Anubhab_Cover_Letter.docx');
    expect(documentFileName('Alex Morgan', 'Portfolio', 'html')).toBe('Alex_Morgan_Portfolio.html');
    expect(documentFileName('', 'Resume', 'pdf')).toBe('My_Resume.pdf');
  });

  it('honours custom names and strips extensions', () => {
    expect(documentFileName('A', 'Resume', 'pdf', 'Backend CV 2026.pdf')).toBe('Backend_CV_2026.pdf');
  });

  it('removes unsafe characters and reserved names', () => {
    expect(sanitizeFileName('a/b:c*?"<>|d')).toBe('a_b_c_d');
    expect(sanitizeFileName('  ..hidden..  ')).toBe('hidden');
    expect(sanitizeFileName('Zoë Müller')).toBe('Zoe_Muller');
    expect(sanitizeFileName('CON')).toBe('document');
    expect(sanitizeFileName('', 'fallback')).toBe('fallback');
    expect(sanitizeFileName('x'.repeat(300)).length).toBe(120);
  });
});
