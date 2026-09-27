import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createPortfolio } from '@/lib/portfolio-factory';
import { renderPortfolio } from '@/lib/engine/render';
import { importHtmlDocument, createProjectFromHtml } from '@/lib/import';
import { getProject } from '@/lib/storage/projects';
import { listAssets } from '@/lib/storage/assets';
import { ImportDialog } from '@/features/importers/ImportDialog';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

afterEach(cleanup);

describe('importing into storage', () => {
  it('creates a new project and keeps asset ids so asset: refs resolve', async () => {
    const p = createPortfolio();
    const hero = p.sections.find((s) => s.type === 'hero')!;
    if (hero.type === 'hero') hero.data.image = { src: 'asset:img_keep', alt: 'Me' };
    const { html } = renderPortfolio(p, { mode: 'export', embedData: true, assetUrl: () => PNG });
    const { project } = await createProjectFromHtml(await importHtmlDocument(html));
    expect(project.id).not.toBe(p.id);
    const stored = await getProject(project.id);
    expect(stored?.portfolio.sections).toEqual(p.sections);
    const assets = await listAssets(project.id);
    expect(assets.map((a) => a.id)).toEqual(['img_keep']);
    expect(assets[0]!.mime).toBe('image/png');
    expect(assets[0]!.size).toBeGreaterThan(0);
  });
});

describe('ImportDialog', () => {
  it('shows a live resume summary before creating', async () => {
    render(createElement(MemoryRouter, null, createElement(ImportDialog, { open: true, onClose: () => undefined, initialTab: 'resume' })));
    const area = screen.getByRole('textbox', { name: 'Resume text' });
    fireEvent.change(area, { target: { value: 'Ada Lovelace\nEngineer\nada@lovelace.dev\n\nEXPERIENCE\nEngineer at Babbage & Co\n1842 - 1843\n- Wrote the first program\n\nSKILLS\nMath, Notation, Poetry' } });
    await waitFor(() => expect(screen.getByText(/Found:/).parentElement?.textContent).toContain('1 position, 3 skills'));
    expect((screen.getByRole('button', { name: /Create project/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows validation issues for corrupted project files', async () => {
    render(createElement(MemoryRouter, null, createElement(ImportDialog, { open: true, onClose: () => undefined, initialTab: 'json' })));
    const input = screen.getByLabelText('Choose a project JSON file') as HTMLInputElement;
    const file = new File([JSON.stringify({ id: 'x', version: '2.0.0', sections: 'nope' })], 'broken.portfolio.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('not a valid portfolio'));
    expect(screen.getByRole('alert').textContent).toMatch(/sections|metadata/);
  });
});
