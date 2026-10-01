/** Starter content for each document kind, drawn from the shared profile/library where possible. */
import { createBlock, createDocument, DOCUMENT_KINDS } from '@/studio/model/defaults';
import type { DocBlockNode, DocumentKind, Library, Profile, StudioDocument } from '@/studio/model/types';
import { uid } from '@/utils/id';

type Patch<K extends DocBlockNode['kind']> = Partial<Omit<Extract<DocBlockNode, { kind: K }>, 'id' | 'kind'>>;

function b<K extends DocBlockNode['kind']>(kind: K, patch: Patch<K> = {}): DocBlockNode {
  return { ...(createBlock(kind) as Extract<DocBlockNode, { kind: K }>), ...patch } as DocBlockNode;
}

export function starterBlocks(kind: DocumentKind, profile: Profile, library: Library): DocBlockNode[] {
  const name = profile.name || 'Your Name';
  switch (kind) {
    case 'case-study':
      return [
        b('heading', { text: 'Case study: Project name', level: 1 }),
        b('paragraph', { text: 'A one-paragraph summary of the project, your role and the outcome.', style: { align: 'left', spaceBefore: 0, spaceAfter: 0, size: 'lg', tone: 'muted' } }),
        b('stats', { items: [{ id: uid('st'), value: '40%', label: 'Faster checkout' }, { id: uid('st'), value: '3 wks', label: 'Time to launch' }, { id: uid('st'), value: '+18%', label: 'Conversion' }] }),
        b('heading', { text: 'The problem', level: 2 }),
        b('paragraph', { text: 'What was broken, for whom, and why it mattered to the business.' }),
        b('heading', { text: 'Approach', level: 2 }),
        b('list', { items: ['Research: interviews and analytics', 'Prototype and test with real users', 'Ship incrementally behind flags'] }),
        b('quote', { text: 'The new flow finally feels effortless.', cite: 'Customer interview' }),
        b('heading', { text: 'Outcome', level: 2 }),
        b('paragraph', { text: 'Measured results and what you learned.' }),
      ];
    case 'proposal':
      return [
        b('heading', { text: 'Project proposal', level: 1 }),
        b('paragraph', { text: `Prepared by ${name}. This proposal outlines scope, timeline and investment.` }),
        b('heading', { text: 'Scope', level: 2 }),
        b('table', { header: ['Deliverable', 'Description', 'Estimate'], rows: [['Discovery', 'Workshops and requirements', '1 week'], ['Design', 'UX flows and UI', '2 weeks'], ['Build', 'Implementation and QA', '4 weeks']] }),
        b('heading', { text: 'Timeline', level: 2 }),
        b('timeline', { items: [{ id: uid('tl'), date: 'Week 1', title: 'Kick-off & discovery', text: '' }, { id: uid('tl'), date: 'Weeks 2–3', title: 'Design', text: '' }, { id: uid('tl'), date: 'Weeks 4–7', title: 'Build and launch', text: '' }] }),
        b('callout', { variant: 'note', title: 'Investment', text: 'Fixed fee of €00,000, invoiced in three milestones.' }),
        b('signature', { name, title: profile.headline }),
      ];
    case 'portfolio':
      return [
        b('profile', { showPhoto: true, showContact: true, showBio: true }),
        b('divider'),
        b('heading', { text: 'Selected projects', level: 1 }),
        ...(library.projects.length ? library.projects.slice(0, 6).map((p) => b('project', { libId: p.id, title: p.title })) : [b('project', { title: 'Project name', text: 'What it is and the outcome.' })]),
      ];
    case 'profile':
      return [
        b('profile', { showPhoto: true, showContact: true, showBio: false, style: { align: 'center', spaceBefore: 0, spaceAfter: 0, size: 'md', tone: 'default' } }),
        b('heading', { text: 'About', level: 2 }),
        b('paragraph', { text: profile.bio || 'A short introduction — who you are, what you do best and what you are looking for.' }),
        b('heading', { text: 'Experience', level: 2 }),
        ...(library.experience.length ? library.experience.slice(0, 3).map((e) => b('experience', { libId: e.id, role: e.role, company: e.company })) : [b('experience')]),
      ];
    case 'report':
      return [
        b('heading', { text: 'Project report', level: 1 }),
        b('paragraph', { text: 'Reporting period, audience and a one-line status.', style: { align: 'left', spaceBefore: 0, spaceAfter: 0, size: 'md', tone: 'muted' } }),
        b('callout', { variant: 'success', title: 'Status: on track', text: 'Key milestones delivered as planned.' }),
        b('heading', { text: 'Summary', level: 2 }),
        b('paragraph', { text: 'What happened this period.' }),
        b('heading', { text: 'Metrics', level: 2 }),
        b('table', { header: ['Metric', 'Target', 'Actual'], rows: [['Uptime', '99.9%', '99.97%'], ['P95 latency', '< 300 ms', '240 ms']] }),
        b('heading', { text: 'Next steps', level: 2 }),
        b('list', { ordered: true, items: ['First next step', 'Second next step'] }),
      ];
    case 'presentation':
      return [
        b('heading', { text: 'Presentation title', level: 1, style: { align: 'center', spaceBefore: 40, spaceAfter: 0, size: 'xl', tone: 'default' } }),
        b('paragraph', { text: `${name} · ${new Date().getFullYear()}`, style: { align: 'center', spaceBefore: 0, spaceAfter: 0, size: 'lg', tone: 'muted' } }),
        b('pageBreak'),
        b('heading', { text: 'Agenda', level: 1 }),
        b('list', { ordered: true, items: ['Context', 'What we did', 'Results', 'Next steps'] }),
        b('pageBreak'),
        b('heading', { text: 'Results', level: 1 }),
        b('stats'),
      ];
    case 'custom':
      return [b('heading', { text: 'Untitled document', level: 1 }), b('paragraph')];
    default:
      return [b('heading', { text: 'Untitled document', level: 1 }), b('paragraph')];
  }
}

export function newStudioDocument(kind: DocumentKind, profile: Profile, library: Library): StudioDocument {
  const doc = createDocument(kind);
  if (kind === 'cover-letter') {
    doc.letter = { ...doc.letter!, signature: profile.name, opening: 'I am writing to apply for the [Role] position at [Company].', body: 'Describe two or three achievements that show you can do this job, with numbers where possible.\n\nExplain why this company and this role — be specific.', closing: 'Thank you for your time. I would welcome the chance to discuss how I can help.' };
  } else doc.blocks = starterBlocks(kind, profile, library);
  doc.name = DOCUMENT_KINDS.find((k) => k.kind === kind)?.label ?? doc.name;
  return doc;
}
