/**
 * Layout shapes from real resumes (incl. PDFs made with Portfolio OS before bullets were text):
 * bullet-less achievement lists, ALL-CAPS project titles, wrapped degree titles, language grids.
 */
import { describe, expect, it } from 'vitest';
import { parseResumeStructure } from '@/lib/import/resume-text';
import { extractResume } from '@/knowledge/analysis/semantic';
import { analyseLayout } from '@/knowledge/analysis/layout';
import { textToRawPages } from '@/knowledge/analysis/pipeline';
import type { RawPage } from '@/knowledge/types';

const TEXT = `Anubhab Guha
Senior Software Developer

EXPERIENCE

Senior Software Developer

SoftSensor.ai
Dec 2025 - Present | Jaipur, Rajasthan, India

Key achievements

Led development of the Damage of Highway and Maintenance
System (DHMS) for the National Highways Authority of India (NHAI).
Managed and optimized databases using MongoDB and MySQL.

Software Developer

SoftSensor.ai
Jul 2023 - Jan 2025 | Jaipur

Key achievements

Worked with MongoDB and MySQL for data storage and
management.

EDUCATION

Bachelor of Technology, Computer Science and

Engineering

Calcutta Institute of Engineering and Management
Jun 2018 - Jun 2022 | 8.6 GPA

PROJECTS

E-COMMERCE WEBSITE (FULL STACK)

Designed and developed a scalable full-stack e-commerce platform using React and Node.js + Express
(backend) with real-time capabilities and background job
processing.

PORTFOLIO OS

Built a free, local-first portfolio website builder.

LANGUAGES

English
Hindi
Native or Bilingual Proficiency
Full Professional Proficiency`;

describe('resume shapes', () => {
  const r = parseResumeStructure(TEXT);

  it('reads achievement lines without bullet characters and keeps the next job separate', () => {
    expect(r.experience.map((e) => e.role)).toEqual(['Senior Software Developer', 'Software Developer']);
    expect(r.experience[0]!.achievements).toEqual([
      'Led development of the Damage of Highway and Maintenance System (DHMS) for the National Highways Authority of India (NHAI).',
      'Managed and optimized databases using MongoDB and MySQL.',
    ]);
    expect(r.experience[1]!.achievements).toEqual(['Worked with MongoDB and MySQL for data storage and management.']);
  });

  it('joins a degree title wrapped over two blocks', () => {
    expect(r.education[0]).toMatchObject({ degree: 'Bachelor of Technology', field: 'Computer Science and Engineering', institution: 'Calcutta Institute of Engineering and Management', grade: '8.6 GPA' });
  });

  it('keeps ALL-CAPS project titles inside Projects and wrapped descriptions together', () => {
    expect(r.projects.map((p) => p.title)).toEqual(['E-COMMERCE WEBSITE (FULL STACK)', 'PORTFOLIO OS']);
    expect(r.projects[0]!.description).toContain('(backend) with real-time capabilities');
  });

  it('pairs a language grid (names row, levels row)', () => {
    const pages = analyseLayout(textToRawPages(TEXT, 'txt'), { tables: true, images: false, structure: true });
    const sem = extractResume(pages, [], 'd', 'cv.txt');
    expect(sem.languages).toEqual([
      { language: 'English', fluency: 'Native or Bilingual Proficiency' },
      { language: 'Hindi', fluency: 'Full Professional Proficiency' },
    ]);
  });

  it('separates skill chips by their wide gaps', () => {
    // Real positions from a Portfolio OS PDF: each chip is followed by a 2em-wide blank item.
    const items = (
      [
        ['Next.js', 330, 352.9],
        [' ', 352.9, 367.9],
        ['React Native', 367.9, 410.8],
        [' ', 410.8, 425.6],
        ['Python', 425.6, 449],
      ] as const
    ).map(([text, x, end]) => ({ text, x, y: 214, width: end - x, height: 7.5, fontSize: 7.5, fontName: 'F', bold: false }));
    const page: RawPage = { page: 1, width: 595, height: 842, items: [{ text: 'SKILLS', x: 330, y: 190, width: 40, height: 10, fontSize: 10, fontName: 'F', bold: true }, ...items], links: [], images: [], ocr: false };
    const [p] = analyseLayout([page], { tables: true, images: false, structure: true });
    expect(p!.blocks.map((b) => b.text)).toContain('Next.js · React Native · Python');
  });
});
