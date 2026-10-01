import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BLOCK_KINDS, createBlock, createDocument } from '@/studio/model/defaults';
import type { DocBlockNode, StudioDocument } from '@/studio/model/types';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { composeStudioDocument } from '@/studio/model/compose-document';
import { DOC_TEMPLATES } from '@/studio/templates/document';
import { starterBlocks, newStudioDocument } from '@/studio/templates/document/starters';
import { layoutFlow } from '@/studio/engine/layout';
import { laidPdfBytes } from '@/studio/engine/render-pdf';
import { renderFlowDocx } from '@/studio/engine/render-docx';
import { renderFlowText } from '@/studio/engine/render-text';

function allBlocks(): DocBlockNode[] {
  const blocks = BLOCK_KINDS.map((k) => createBlock(k.kind)).filter((b) => b.kind !== 'pageBreak');
  const para = blocks.find((b) => b.kind === 'paragraph');
  if (para && para.kind === 'paragraph') para.text = 'Distinctive paragraph content.';
  const project = blocks.find((b) => b.kind === 'project');
  if (project && project.kind === 'project') project.libId = 'prj_sample_1';
  const exp = blocks.find((b) => b.kind === 'experience');
  if (exp && exp.kind === 'experience') exp.libId = 'exp_sample_1';
  const footer = blocks.find((b) => b.kind === 'footer');
  if (footer && footer.kind === 'footer') footer.text = 'Confidential';
  return blocks;
}

function docWith(templateId: string, blocks = allBlocks()): StudioDocument {
  return { ...createDocument('custom', 'Test document'), templateId, blocks };
}

describe('document templates', () => {
  for (const t of DOC_TEMPLATES) {
    it(`${t.id} renders every block kind to PDF, DOCX and text`, async () => {
      const flow = composeStudioDocument(docWith(t.id), sampleProfile(), sampleLibrary());
      const laid = layoutFlow(flow);
      expect(laid.pages.length).toBeGreaterThan(0);
      expect(laid.issues.filter((i) => i.kind === 'overflow')).toHaveLength(0);
      expect(laidPdfBytes(laid, {}, { compress: false }).byteLength).toBeGreaterThan(2000);
      expect((await renderFlowDocx(flow, { images: {} })).byteLength).toBeGreaterThan(2000);
      const txt = renderFlowText(flow);
      expect(txt).toContain('Distinctive paragraph content.');
      expect(txt).toContain('Confidential');
    });
  }

  it('dark template sets a page background', () => {
    const flow = composeStudioDocument(docWith('doc-dark'), sampleProfile(), sampleLibrary());
    expect(flow.page.background).toBe('#0f1115');
    expect(layoutFlow(flow).background).toBe('#0f1115');
  });

  it('page breaks start new pages', () => {
    const blocks = [createBlock('heading'), createBlock('pageBreak'), createBlock('paragraph'), createBlock('pageBreak'), createBlock('paragraph')];
    const laid = layoutFlow(composeStudioDocument(docWith('doc-minimal', blocks), sampleProfile(), sampleLibrary()));
    expect(laid.pages.length).toBe(3);
  });

  it('library-linked cards pull shared data', () => {
    const lib = sampleLibrary();
    const card = { ...createBlock('project'), libId: 'prj_sample_1', title: 'stale title' } as DocBlockNode;
    const txt = renderFlowText(composeStudioDocument(docWith('doc-professional', [card]), sampleProfile(), lib));
    expect(txt).toContain('DHMS');
    expect(txt).not.toContain('stale title');
    lib.projects[0]!.title = 'Renamed Project';
    expect(renderFlowText(composeStudioDocument(docWith('doc-professional', [card]), sampleProfile(), lib))).toContain('Renamed Project');
  });

  it('blocks carry refs for click-to-select', () => {
    const blocks = allBlocks();
    const laid = layoutFlow(composeStudioDocument(docWith('doc-modern', blocks), sampleProfile(), sampleLibrary()));
    const refs = new Set(laid.pages.flatMap((p) => p.refs.map((r) => r.ref)));
    for (const b of blocks.filter((x) => x.kind !== 'spacer' && x.kind !== 'image')) expect([b.kind, refs.has(b.id)]).toEqual([b.kind, true]);
  });

  it('starter content exists for every kind', () => {
    for (const kind of ['case-study', 'proposal', 'portfolio', 'profile', 'report', 'presentation', 'custom'] as const) {
      expect(starterBlocks(kind, sampleProfile(), sampleLibrary()).length).toBeGreaterThan(1);
      const d = newStudioDocument(kind, sampleProfile(), sampleLibrary());
      expect(layoutFlow(composeStudioDocument(d, sampleProfile(), sampleLibrary())).pages.length).toBeGreaterThan(0);
    }
    expect(newStudioDocument('presentation', sampleProfile(), sampleLibrary()).page.orientation).toBe('landscape');
  });

  it('empty blocks show hints only in the editor', () => {
    const blocks = [createBlock('image')];
    const edit = renderFlowText(composeStudioDocument(docWith('doc-professional', blocks), sampleProfile(), sampleLibrary(), { placeholders: true }));
    const exp = renderFlowText(composeStudioDocument(docWith('doc-professional', blocks), sampleProfile(), sampleLibrary()));
    expect(edit).toContain('upload');
    expect(exp).not.toContain('upload');
  });
});

const OUT = process.env.STUDIO_DOCS_OUT;
it.skipIf(!OUT)('writes document PDFs for visual review', () => {
  mkdirSync(OUT!, { recursive: true });
  for (const t of DOC_TEMPLATES) {
    const d = newStudioDocument('case-study', sampleProfile(), sampleLibrary());
    d.templateId = t.id;
    d.blocks.push(createBlock('code'), createBlock('callout'), createBlock('columns'));
    writeFileSync(`${OUT}/${t.id}.pdf`, new Uint8Array(laidPdfBytes(layoutFlow(composeStudioDocument(d, sampleProfile(), sampleLibrary())), {})));
  }
  for (const id of ['letter-minimal', 'letter-professional', 'letter-executive', 'letter-creative']) {
    const d = newStudioDocument('cover-letter', sampleProfile(), sampleLibrary());
    d.templateId = id;
    d.letter = { ...d.letter!, recipient: 'Jordan Lee', company: 'Acme Corp', address: '1 Main Street\nBerlin', role: 'Staff Engineer' };
    writeFileSync(`${OUT}/${id}.pdf`, new Uint8Array(laidPdfBytes(layoutFlow(composeStudioDocument(d, sampleProfile(), sampleLibrary())), {})));
  }
});
