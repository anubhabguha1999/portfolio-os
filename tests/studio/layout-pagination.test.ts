import { describe, it, expect } from 'vitest';
import type { FlowDoc, FlowNode, TextNode, LaidDocument } from '@/studio/engine/flow';
import { layoutFlow } from '@/studio/engine/layout';

const st = { font: 'helvetica' as const, size: 10, color: '#111111', lineHeight: 1.3 };
const line = (text: string, over: Partial<TextNode> = {}): TextNode => ({ t: 'text', runs: [{ text }], style: st, ...over });
const fillers = (n: number, prefix = 'F') => Array.from({ length: n }, (_, i) => line(`${prefix}${i}`));

function doc(nodes: FlowNode[], over: Partial<FlowDoc> = {}): FlowDoc {
  return {
    page: { width: 100, height: 100, margin: { top: 10, right: 10, bottom: 10, left: 10 } },
    columns: [{ id: 'main', x: 10, width: 80, nodes }],
    meta: { title: 't', author: 'a', subject: '', keywords: [], creator: 'c' },
    ...over,
  };
}

function pageOf(laid: LaidDocument, text: string): number {
  for (const p of laid.pages) if (p.prims.some((x) => x.k === 'text' && x.text === text)) return p.index;
  return -1;
}

describe('layout pagination', () => {
  it('never leaves a keep-with-next heading alone at the bottom of a page', () => {
    const laid = layoutFlow(doc([...fillers(16), line('HEADING', { keepWithNext: true, role: 'h1' }), line('Body one'), line('Body two')]));
    expect(pageOf(laid, 'F15')).toBe(0);
    expect(pageOf(laid, 'HEADING')).toBe(1);
    expect(pageOf(laid, 'Body one')).toBe(1);
  });

  it('keeps a short "together" group on one page', () => {
    const group: FlowNode = { t: 'group', keep: 'together', nodes: [line('G0'), line('G1'), line('G2'), line('G3')] };
    const laid = layoutFlow(doc([...fillers(14), group]));
    const pages = ['G0', 'G1', 'G2', 'G3'].map((t) => pageOf(laid, t));
    expect(new Set(pages).size).toBe(1);
    expect(pages[0]).toBe(1);
  });

  it('splits a long entry but keeps its header with at least two body lines', () => {
    const entry = (): FlowNode => ({ t: 'group', keep: 'head', head: 1, minBody: 2, nodes: [line('HEAD'), ...fillers(30, 'L')] });
    const moved = layoutFlow(doc([...fillers(15), entry()]));
    expect(pageOf(moved, 'HEAD')).toBe(1);
    const stays = layoutFlow(doc([...fillers(14), entry()]));
    expect(pageOf(stays, 'HEAD')).toBe(0);
    expect(pageOf(stays, 'L0')).toBe(0);
    expect(pageOf(stays, 'L1')).toBe(0);
    expect(stays.pages.length).toBeGreaterThan(1);
  });

  it('repeats section headings when a section continues on a new page', () => {
    const section = (): FlowNode => ({ t: 'section', id: 's1', title: [line('SEC', { role: 'h1' })], continued: [line('SEC (cont)')], nodes: fillers(30, 'S') });
    const on = layoutFlow(doc([section()], { repeatHeadings: true }));
    expect(on.pages.length).toBeGreaterThan(1);
    expect(pageOf(on, 'SEC (cont)')).toBe(1);
    const off = layoutFlow(doc([section()], { repeatHeadings: false }));
    expect(pageOf(off, 'SEC (cont)')).toBe(-1);
  });

  it('paginates two columns independently', () => {
    const laid = layoutFlow(
      doc([], {
        columns: [
          { id: 'a', x: 10, width: 35, nodes: fillers(30, 'A') },
          { id: 'b', x: 55, width: 35, nodes: fillers(3, 'B') },
        ],
      }),
    );
    expect(laid.pages.length).toBe(2);
    expect(pageOf(laid, 'B0')).toBe(0);
    expect(pageOf(laid, 'B2')).toBe(0);
    expect(pageOf(laid, 'A29')).toBe(1);
    const b = laid.pages[0]!.prims.find((p) => p.k === 'text' && p.text === 'B0');
    expect(b && b.k === 'text' && b.x).toBeGreaterThanOrEqual(55);
  });

  it('honours explicit page breaks', () => {
    const laid = layoutFlow(doc([line('one'), { t: 'break' }, line('two')]));
    expect(laid.pages.length).toBe(2);
    expect(pageOf(laid, 'two')).toBe(1);
  });

  it('reports elements taller than a page', () => {
    const laid = layoutFlow(doc([{ t: 'image', src: 'x', width: 50, height: 200 }]));
    expect(laid.issues.some((i) => i.kind === 'overflow')).toBe(true);
  });

  it('justified lines stay inside the column', () => {
    const text = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud.';
    const laid = layoutFlow(doc([{ t: 'text', runs: [{ text }], style: st, align: 'justify' }], { columns: [{ id: 'm', x: 10, width: 50, nodes: [{ t: 'text', runs: [{ text }], style: st, align: 'justify' }] }] }));
    const texts = laid.pages[0]!.prims.filter((p) => p.k === 'text');
    expect(texts.length).toBeGreaterThan(5);
    for (const p of texts) if (p.k === 'text') expect(p.x + p.w).toBeLessThanOrEqual(60.01);
  });

  it('turns linked runs into link annotations', () => {
    const laid = layoutFlow(doc([{ t: 'text', runs: [{ text: 'site', link: 'https://example.com' }], style: st }]));
    const link = laid.pages[0]!.prims.find((p) => p.k === 'link');
    expect(link && link.k === 'link' && link.url).toBe('https://example.com');
    expect(laid.stats.links).toBe(1);
  });

  it('reports characters the PDF fonts cannot show', () => {
    const laid = layoutFlow(doc([line('Hello 😀 world')]));
    expect(laid.stats.unsupportedChars).toContain('😀');
    expect(laid.issues.some((i) => i.kind === 'unsupported-chars')).toBe(true);
  });
});
