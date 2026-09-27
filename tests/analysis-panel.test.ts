import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createPortfolio } from '@/lib/portfolio-factory';
import { InsightsPanel } from '@/features/analysis/InsightsPanel';

afterEach(cleanup);

describe('InsightsPanel', () => {
  it('shows scores, analytics and navigates to a section from an issue', () => {
    const p = createPortfolio();
    const selected: string[] = [];
    render(createElement(InsightsPanel, { portfolio: p, onSelectSection: (id: string) => selected.push(id) }));
    expect(screen.getByRole('button', { name: /Accessibility: \d+ out of 100/ })).toBeTruthy();
    expect(screen.getByText('Sections').nextElementSibling?.textContent).toBe(String(p.sections.length));
    fireEvent.click(screen.getByRole('tab', { name: /Content/ }));
    const row = screen.getByRole('button', { name: /Placeholder text/ });
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getAllByRole('button', { name: /Go to Hero/ })[0]!);
    expect(selected[0]).toBe(p.sections.find((s) => s.type === 'hero')!.id);
  });
});
