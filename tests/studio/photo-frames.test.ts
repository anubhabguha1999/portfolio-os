import { describe, expect, it } from 'vitest';
import { reframe } from '@/studio/images/service';
import { ringedPortrait } from '@/studio/templates/kit';
import type { BoxNode, ImageNode, RowNode } from '@/studio/engine/flow';

const ringOf = (row: RowNode) => row.cols.flatMap((c) => c.nodes).find((n) => n.t === 'box') as BoxNode;

describe('photo frames', () => {
  it('keeps the user framing when the shape does not change', () => {
    const p = reframe(1200, 1600, 1, { zoom: 1.6, panX: 0.05, panY: -0.08 }, 1);
    expect(p.zoom).toBeCloseTo(1.6, 5);
    expect(p.panX).toBeCloseTo(0.05, 5);
    expect(p.panY).toBeCloseTo(-0.08, 5);
  });

  it('carries the same centre and subject size into a portrait frame', () => {
    const iw = 1200, ih = 1600;
    const from = { zoom: 2, panX: 0.1, panY: 0.05 };
    const to = reframe(iw, ih, 1, from, 22 / 28);
    // Same image point at the centre…
    const centre = (a: number, p: { zoom: number; panX: number; panY: number }) => {
      const s = Math.max(a / iw, 1 / ih) * p.zoom;
      return [0.5 - (p.panX * a) / (iw * s), 0.5 - p.panY / (ih * s), 1 / (ih * s)];
    };
    const [u0, v0, h0] = centre(1, from);
    const [u1, v1, h1] = centre(22 / 28, to);
    expect(u1).toBeCloseTo(u0!, 4);
    expect(v1).toBeCloseTo(v0!, 4);
    // …and the same visible height (subject size), since the zoom stays above cover.
    expect(h1).toBeCloseTo(h0!, 4);
  });

  it('shapes the frame like the photo style', () => {
    const circle = ringOf(ringedPortrait('k', 'A B', 30, 40, { ring: '#000', disc: '#111', discText: '#fff', mode: 'circle' }));
    const square = ringOf(ringedPortrait('k', 'A B', 30, 40, { ring: '#000', disc: '#111', discText: '#fff', mode: 'square' }));
    const rounded = ringOf(ringedPortrait('k', 'A B', 30, 40, { ring: '#000', disc: '#111', discText: '#fff', mode: 'rounded' }));
    const portrait = ringOf(ringedPortrait('k', 'A B', 30, 40, { ring: '#000', disc: '#111', discText: '#fff', mode: 'large-portrait' }));
    expect(circle.radius).toBeCloseTo(15.9, 1);
    expect(square.radius).toBe(0);
    expect(rounded.radius).toBeGreaterThan(0);
    expect(rounded.radius!).toBeLessThan(10);
    const img = portrait.nodes[0] as ImageNode;
    expect(img.width / img.height).toBeCloseTo(32 / 42, 5);
    expect(portrait.radius).toBe(0);
  });
});
