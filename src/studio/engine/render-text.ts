/**
 * FlowDoc → plain text in reading order (masthead, then columns by `order`/x).
 * Useful for checking what an applicant-tracking system is likely to extract.
 */
import type { FlowDoc, FlowNode, Run } from './flow';

const text = (runs: Run[]) =>
  runs
    .map((r) => r.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

function lines(nodes: FlowNode[], out: string[]): void {
  for (const n of nodes) {
    if ('decorative' in n && n.decorative) continue;
    switch (n.t) {
      case 'text': {
        const t = text(n.runs);
        if (!t) break;
        const value = n.style.uppercase ? t.toUpperCase() : t;
        if (n.role === 'title') out.push(value.toUpperCase());
        else if (n.role === 'h1') out.push('', value.toUpperCase(), '-'.repeat(Math.min(60, value.length)));
        else if (n.role === 'h2' || n.role === 'h3') out.push('', value);
        else if (n.marker) out.push(`${n.marker.kind === 'number' ? `${n.marker.n ?? 1}.` : '•'} ${value}`);
        else out.push(value);
        break;
      }
      case 'row': {
        const parts = n.cols.map((c) => {
          const sub: string[] = [];
          lines(c.nodes, sub);
          return sub.filter(Boolean).join(' ');
        });
        const joined = parts.filter(Boolean).join('  |  ');
        if (joined) out.push(joined);
        break;
      }
      case 'box':
      case 'group':
        lines(n.nodes, out);
        break;
      case 'section': {
        const body: string[] = [];
        lines(n.nodes, body);
        if (!body.some((l) => l.trim())) break;
        lines(n.title, out);
        out.push(...body);
        break;
      }
      case 'table': {
        if (n.header) out.push(n.header.map(text).join(' | '));
        for (const r of n.rows) out.push(r.map(text).join(' | '));
        break;
      }
      case 'rule':
      case 'space':
        out.push('');
        break;
      case 'break':
        out.push('', '');
        break;
      default:
        break;
    }
  }
}

export function renderFlowText(flow: FlowDoc): string {
  const out: string[] = [];
  if (flow.masthead) lines(flow.masthead, out);
  const cols = [...flow.columns].sort((a, b) => (a.order ?? a.x) - (b.order ?? b.x));
  for (const c of cols) {
    out.push('');
    lines(c.nodes, out);
  }
  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}
