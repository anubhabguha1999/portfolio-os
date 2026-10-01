/**
 * Studio export worker: layout + PDF, DOCX and ZIP generation off the main thread.
 * Images arrive pre-rendered (bytes + size) because decoding needs canvas APIs.
 */
import { zipSync } from 'fflate';
import { layoutFlow } from '@/studio/engine/layout';
import { laidPdfBytes } from '@/studio/engine/render-pdf';
import { renderFlowDocx } from '@/studio/engine/render-docx';
import type { StudioJob, StudioWorkerMessage } from './studio.protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: StudioWorkerMessage, transfer: Transferable[] = []): void {
  scope.postMessage(msg, transfer);
}

scope.onmessage = async (event: MessageEvent<StudioJob>) => {
  const job = event.data;
  try {
    if (job.kind === 'pdf') {
      post({ id: job.id, type: 'progress', stage: 'Laying out pages…', progress: 0.5 });
      const laid = layoutFlow(job.flow);
      post({ id: job.id, type: 'progress', stage: `Writing ${laid.pages.length} page${laid.pages.length === 1 ? '' : 's'}…`, progress: 0.75 });
      const buffer = laidPdfBytes(laid, job.images, job.options);
      post({ id: job.id, type: 'pdf', buffer, pages: laid.pages.length }, [buffer]);
    } else if (job.kind === 'docx') {
      post({ id: job.id, type: 'progress', stage: 'Building Word document…', progress: 0.6 });
      const buffer = await renderFlowDocx(job.flow, { images: job.images, includeImages: job.includeImages });
      post({ id: job.id, type: 'docx', buffer }, [buffer]);
    } else {
      post({ id: job.id, type: 'progress', stage: 'Compressing…', progress: 0.6 });
      const entries: Record<string, Uint8Array> = {};
      for (const f of job.files) entries[f.path] = f.bytes;
      const out = zipSync(entries, { level: 6 });
      const buffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
      post({ id: job.id, type: 'zip', buffer }, [buffer]);
    }
  } catch (err) {
    post({ id: job.id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
