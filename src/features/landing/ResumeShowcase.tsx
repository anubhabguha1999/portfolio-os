import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ResumeThumb } from '@/features/studio/resume/ResumeThumb';
import { applyTemplateStyle } from '@/features/studio/resume/TemplateBrowser';
import { createResumeFromStarter } from '@/studio/model/defaults';
import { getPersona } from '@/studio/model/sample';
import { getResumeTemplate } from '@/studio/templates/resume';
import { cn } from '@/utils/cn';

const SHOWCASE = ['navy-sidebar', 'slate-banner', 'executive'] as const;

/** Three real resumes, laid out by the same engine that writes the PDF, fanned like printed pages. */
export default function ResumeShowcase() {
  const pages = useMemo(
    () =>
      SHOWCASE.map((id) => {
        const t = getResumeTemplate(id);
        const persona = getPersona(t.starter?.persona ?? 'engineer-lead');
        const resume = createResumeFromStarter(t.name, t.id, t.starter?.sections, persona.entries);
        resume.style = { ...applyTemplateStyle(resume.style, t), ...(t.defaults.photo ? { photo: t.defaults.photo } : {}) };
        return { t, resume, profile: persona.profile(), library: persona.library() };
      }),
    [],
  );
  const pose = ['-rotate-[7deg] -translate-x-[58%] translate-y-6', 'z-10 -translate-y-2', 'rotate-[7deg] translate-x-[58%] translate-y-6'];
  return (
    <div className="relative mx-auto grid h-[min(118vw,470px)] w-full max-w-[560px] place-items-center" aria-label="Example resumes made with Resume Studio" role="img">
      <div className="absolute inset-x-6 bottom-4 top-10 rounded-[40px] bg-[radial-gradient(55%_55%_at_50%_50%,var(--app-accent-soft),transparent_72%)]" aria-hidden="true" />
      {pages.map((p, i) => (
        <Link
          key={p.t.id}
          to="/resumes"
          tabIndex={-1}
          aria-hidden="true"
          className={cn('group absolute transition-transform duration-700 ease-out hover:z-20 hover:-translate-y-4 hover:rotate-0 hover:scale-[1.04]', pose[i])}
        >
          <ResumeThumb resume={p.resume} profile={p.profile} library={p.library} width={232} pageBadge={false} className="shadow-[0_30px_60px_-20px_rgba(0,0,0,.55)]" />
          <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-panel px-2.5 py-0.5 text-[11px] font-medium text-fg-muted opacity-0 transition-opacity group-hover:opacity-100">{p.t.name}</span>
        </Link>
      ))}
    </div>
  );
}
