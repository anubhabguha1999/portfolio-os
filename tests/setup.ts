import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';

// jsdom's Blob does not survive fake-indexeddb's structured clone; Node's native Blob does.
// (Real browsers store Blobs in IndexedDB natively.)
globalThis.Blob = NodeBlob as unknown as typeof Blob;
