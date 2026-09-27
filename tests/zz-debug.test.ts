import { it } from 'vitest';
import { parseResumeStructure } from '@/lib/import/resume-text';
import { writeFileSync } from 'node:fs';
it('dbg', () => {
  const r = parseResumeStructure(`Marco Rossi

Education:
Master of Design in Interaction Design, Politecnico di Milano, 2016 - 2018
Bachelor of Arts, Università di Bologna, 2012 - 2015
`);
  writeFileSync('/private/tmp/claude-502/-Users-mac-Desktop-This-PC-Git-dev-shortcuts-pro/e8d4a4fe-9897-49d9-8fc3-bfed0c977c82/scratchpad/dbg.txt', JSON.stringify(r.education, null, 1));
});
