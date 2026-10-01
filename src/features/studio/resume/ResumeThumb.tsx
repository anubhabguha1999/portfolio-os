import { memo, useMemo } from 'react';
import { PageSvg } from '@/studio/engine/PageSvg';
import { useImageUrls } from '@/studio/images/service';
import type { Library, Profile, ResumeDoc } from '@/studio/model/types';
import { layoutResume } from './useResumeLayout';
import { cn } from '@/utils/cn';

/** First page of a resume rendered with the real engine — used for template and version previews. */
export const ResumeThumb = memo(function ResumeThumb({ resume, library, profile, templateId, width, className, pageBadge = true }: { resume: ResumeDoc; library: Library; profile: Profile; templateId?: string; width: number; className?: string; pageBadge?: boolean }) {
  const layout = useMemo(() => {
    try {
      return layoutResume(resume, library, profile, templateId);
    } catch {
      return null;
    }
  }, [resume, library, profile, templateId]);
  const imageUrl = useImageUrls(layout?.imageKeys ?? []);
  const first = layout?.laid.pages[0];
  if (!layout || !first) return <div className={cn('aspect-[210/297] rounded bg-white', className)} style={{ width }} />;
  const laid = layout.laid;
  return (
    <div className={cn('relative overflow-hidden rounded-[3px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.14),0_10px_30px_-14px_rgba(0,0,0,.5)]', className)} style={{ width, height: (width * laid.height) / laid.width }}>
      <PageSvg page={first} width={laid.width} height={laid.height} imageUrl={imageUrl} pixelWidth={width} links={false} />
      {pageBadge && laid.pages.length > 1 && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-white">{laid.pages.length} pages</span>}
    </div>
  );
});
