import type { RawPage, RawTextItem } from '@/knowledge/types';

/** Build a raw page from simple line specs: [text, x, fontSize?, bold?]. Lines flow down the page. */
export function page(n: number, lines: Array<[string, number?, number?, boolean?] | null>, opts: { width?: number; height?: number; startY?: number } = {}): RawPage {
  const items: RawTextItem[] = [];
  let y = opts.startY ?? 50;
  for (const l of lines) {
    if (!l) {
      y += 14;
      continue;
    }
    const [text, x = 50, size = 10, bold = false] = l;
    // Multiple cells on one line: "a{TAB}b" places b at x + 200.
    text.split('\t').forEach((cell, i) => {
      items.push({ text: cell, x: x + i * 200, y, width: cell.length * size * 0.5, height: size, fontSize: size, fontName: 'F', bold });
    });
    y += size * 1.4;
  }
  return { page: n, width: opts.width ?? 612, height: opts.height ?? 792, items, links: [], images: [], ocr: false };
}

export const RESUME_PAGE = page(1, [
  ['Anubhab Guha', 50, 22, true],
  ['Senior Software Developer', 50, 12],
  ['anubhab@example.com | +91 75509 69932 | Kolkata, India | github.com/anubhabguha1999'],
  null,
  ['EXPERIENCE', 50, 12, true],
  ['Senior Software Developer, SoftSensor AI', 50, 10, true],
  ['Jan 2024 - Present'],
  ['• Built React and Node.js dashboards used by 40 analysts.'],
  ['• Cut API latency by 35% with Redis caching.'],
  null,
  ['PROJECTS', 50, 12, true],
  ['Vehicle Management System', 50, 10, true],
  ['Fleet tracking platform for logistics teams.'],
  ['Technologies: ReactJS, Node.js, MongoDB'],
  null,
  ['EDUCATION', 50, 12, true],
  ['B.Tech in Computer Science, Heritage Institute of Technology'],
  ['2016 - 2020'],
  null,
  ['SKILLS', 50, 12, true],
  ['React.js, TypeScript, Node.js, MongoDB, Docker, Leadership'],
]);
