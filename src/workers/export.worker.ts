/**
 * Export worker: PDF and DOCX generation off the main thread. Images arrive already
 * decoded (PNG/JPEG bytes + intrinsic size) because decoding needs DOM/canvas APIs.
 */
import { renderPdf } from '@/lib/pdf';
import { renderDocx } from '@/lib/docx/render';
import type { ExportJob, ExportWorkerMessage } from './export.protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: ExportWorkerMessage, transfer: Transferable[] = []): void {
  scope.postMessage(msg, transfer);
}

scope.onmessage = async (event: MessageEvent<ExportJob>) => {
  const job = event.data;
  try {
    if (job.kind === 'pdf') {
      const res = renderPdf(job.model, job.images, job.options, (stage, progress) => post({ id: job.id, type: 'progress', stage, progress }));
      post({ id: job.id, type: 'pdf', buffer: res.buffer, pageCount: res.pageCount, scale: res.scale, overflow: res.overflow }, [res.buffer]);
    } else {
      post({ id: job.id, type: 'progress', stage: 'Building document…', progress: 0.55 });
      const buffer = await renderDocx(job.model, job.images, job.options);
      post({ id: job.id, type: 'docx', buffer }, [buffer]);
    }
  } catch (err) {
    post({ id: job.id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
