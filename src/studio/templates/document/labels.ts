/** Human names for document kinds. Kept apart from the templates so list pages don't load the layout engine. */
export function kindLabel(kind: string): string {
  return (
    {
      resume: 'Resume',
      cv: 'Curriculum Vitae',
      'cover-letter': 'Cover Letter',
      portfolio: 'Portfolio',
      'case-study': 'Case Study',
      proposal: 'Proposal',
      profile: 'Personal Profile',
      report: 'Project Report',
      presentation: 'Presentation',
      custom: 'Document',
    } as Record<string, string>
  )[kind] ?? 'Document';
}
