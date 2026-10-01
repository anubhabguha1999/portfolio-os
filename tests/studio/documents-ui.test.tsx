import { describe, expect, it, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DocumentStudioPage from '@/features/studio/documents/DocumentStudioPage';
import DocumentsPage from '@/features/studio/documents/DocumentsPage';
import { saveDocument, getDocument } from '@/studio/storage/repo';
import { newStudioDocument } from '@/studio/templates/document/starters';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { useDocumentEditor } from '@/studio/store/document-editor';
import { useWorkspace } from '@/studio/store/workspace';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  useWorkspace.getState().reset(sampleProfile(), sampleLibrary());
});

describe('Document Studio UI', () => {
  it('opens a document, adds a block, undoes, and autosaves', async () => {
    const doc = await saveDocument(newStudioDocument('case-study', sampleProfile(), sampleLibrary()));
    const count = doc.blocks.length;
    render(
      <MemoryRouter initialEntries={[`/document/${doc.id}`]}>
        <Routes>
          <Route path="/document/:id" element={<DocumentStudioPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText(/Case Study/).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByTitle('Add Quote'));
    expect(useDocumentEditor.getState().doc!.blocks.length).toBe(count + 1);
    await waitFor(() => expect(screen.getByLabelText('Quote')).toBeTruthy());
    useDocumentEditor.getState().undo();
    expect(useDocumentEditor.getState().doc!.blocks.length).toBe(count);
    await useDocumentEditor.getState().flush();
    expect((await getDocument(doc.id))!.blocks.length).toBe(count);
    cleanup();
  });

  it('renders the cover-letter form', async () => {
    const doc = await saveDocument(newStudioDocument('cover-letter', sampleProfile(), sampleLibrary()));
    render(
      <MemoryRouter initialEntries={[`/document/${doc.id}`]}>
        <Routes>
          <Route path="/document/:id" element={<DocumentStudioPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText('Body')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Hello Acme' } });
    expect(useDocumentEditor.getState().doc!.letter!.body).toBe('Hello Acme');
    cleanup();
  });

  it('lists documents', async () => {
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText(/Cover Letter/).length).toBeGreaterThan(0));
    cleanup();
  });
});
