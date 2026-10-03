/**
 * Portfolio Studio ⇄ shared profile bridge.
 * - usePortfolioProfileSync: pulls shared data when a linked portfolio opens and pushes
 *   builder edits back to the library (diff-based, debounced).
 * - ProfileLinkButton: link status + controls in the builder top bar.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Link2Off, UserRound } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { useAssets } from '@/stores/assets';
import { putAssetRecord } from '@/lib/storage/assets';
import { assetRef } from '@/lib/engine/assets';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { toast } from '@/stores/ui';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { linkPortfolio, projectPortfolio, pullIntoPortfolio, pushChanges, sharedCounts, type Projection } from '@/studio/sync/portfolio';
import { blobForKey } from '@/studio/images/service';
import { readImageInfo } from '@/lib/image';
import type { Portfolio } from '@/types/portfolio';
import { cn } from '@/utils/cn';

const PHOTO_ASSET_ID = 'profile-photo';

/** Replace the editor's portfolio without an undo step (sync is not a user edit). */
function setPortfolioSilently(next: Portfolio): void {
  useEditor.setState((s) => ({ portfolio: next, revision: s.revision + 1, saveState: 'dirty' }));
}

async function syncPhoto(projectId: string): Promise<void> {
  const { profile } = useWorkspace.getState();
  const img = profile.profileImage;
  const portfolio = useEditor.getState().portfolio;
  if (!img || !portfolio) return;
  const hero = portfolio.sections.find((s) => s.type === 'hero');
  if (!hero || hero.type !== 'hero') return;
  const src = hero.data.image.src;
  // Never replace an image the user chose for the hero.
  if (src && src !== assetRef(PHOTO_ASSET_ID)) return;
  const blob = await blobForKey(`profile:${img.usage.portfolio}:variant`).catch(() => null);
  if (!blob) return;
  const info = await readImageInfo(blob).catch(() => ({ width: 0, height: 0 }));
  await putAssetRecord({ id: PHOTO_ASSET_ID, projectId, name: 'Profile photo', mime: blob.type, size: blob.size, width: info.width, height: info.height, blob, createdAt: new Date().toISOString() });
  await useAssets.getState().loadProject(projectId);
  if (src !== assetRef(PHOTO_ASSET_ID)) {
    const p = useEditor.getState().portfolio;
    if (!p) return;
    setPortfolioSilently({ ...p, sections: p.sections.map((s) => (s.id === hero.id && s.type === 'hero' ? { ...s, data: { ...s.data, image: { src: assetRef(PHOTO_ASSET_ID), alt: profile.name || 'Profile photo' } } } : s)) });
  }
}

export function usePortfolioProfileSync(projectId: string): void {
  const linked = useWorkspace((s) => !!s.links[projectId]?.enabled);
  const loaded = useWorkspace((s) => s.loaded);
  const last = useRef<Projection | null>(null);

  useEffect(() => {
    void ensureWorkspace();
  }, []);

  // Pull when a linked portfolio opens (or becomes linked).
  useEffect(() => {
    if (!loaded || !linked) {
      last.current = null;
      return;
    }
    const p = useEditor.getState().portfolio;
    if (!p) return;
    const { library, profile } = useWorkspace.getState();
    const pulled = pullIntoPortfolio(p, library, profile);
    if (pulled !== p) setPortfolioSilently(pulled);
    last.current = projectPortfolio(pulled);
    void syncPhoto(projectId).catch(() => undefined);
  }, [loaded, linked, projectId]);

  // Push builder edits back to the shared library.
  useEffect(() => {
    if (!linked) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.portfolio === prev.portfolio || !s.portfolio) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const p = useEditor.getState().portfolio;
        if (!p) return;
        const next = projectPortfolio(p);
        const ws = useWorkspace.getState();
        const res = pushChanges(last.current, next, ws.library, ws.profile);
        last.current = next;
        if (!res.changed) return;
        if (res.library !== ws.library) ws.setLibrary(res.library);
        if (res.profile !== ws.profile) ws.setProfile(res.profile);
        ws.setLinks({ ...ws.links, [projectId]: { ...ws.links[projectId]!, lastSyncedAt: new Date().toISOString() } });
      }, 700);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [linked, projectId]);
}

export function ProfileLinkButton({ projectId }: { projectId: string }) {
  const link = useWorkspace((s) => s.links[projectId]);
  const library = useWorkspace((s) => s.library);
  const portfolio = useEditor((s) => s.portfolio);
  const [open, setOpen] = useState(false);
  const linked = !!link?.enabled;
  const counts = portfolio ? sharedCounts(portfolio, library) : null;

  const enable = async () => {
    await ensureWorkspace();
    const p = useEditor.getState().portfolio;
    if (!p) return;
    const ws = useWorkspace.getState();
    const res = linkPortfolio(p, ws.library, ws.profile);
    ws.setLibrary(res.library);
    ws.setProfile(res.profile);
    if (res.portfolio !== p) setPortfolioSilently(res.portfolio);
    ws.setLinks({ ...ws.links, [projectId]: { projectId, enabled: true, lastSyncedAt: new Date().toISOString() } });
    toast({ tone: 'success', title: 'Linked to your shared profile', description: 'Projects, experience and contact details now stay in sync with Resume Studio.' });
    setOpen(false);
  };
  const disable = () => {
    const ws = useWorkspace.getState();
    ws.setLinks({ ...ws.links, [projectId]: { projectId, enabled: false, lastSyncedAt: link?.lastSyncedAt ?? null } });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={linked ? 'Linked to your shared profile' : 'Not linked to your shared profile'}
        className={cn('hidden h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-medium md:inline-flex', linked ? 'border-ok/30 bg-ok/10 text-ok' : 'border-line text-fg-subtle hover:text-fg')}
      >
        {linked ? <Link2 className="size-3.5" /> : <Link2Off className="size-3.5" />}
        {linked ? 'Profile linked' : 'Link profile'}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={linked ? 'Linked to your shared profile' : 'Link this portfolio to your shared profile'}
        description="One profile powers your portfolio, every resume and your documents."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            {linked ? (
              <Button variant="danger" onClick={disable}>
                Unlink
              </Button>
            ) : (
              <Button variant="primary" icon={<Link2 className="size-4" />} onClick={() => void enable()}>
                Link portfolio
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3 text-[13px] leading-relaxed text-fg-muted">
          <p>When linked:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your name, headline, bio, contact details and social links come from the shared profile.</li>
            <li>Experience, projects, education, skills, certifications and achievements with the same identity stay in sync in both directions.</li>
            <li>Portfolio-only content — images, galleries, case studies, layout and theme — is never changed.</li>
            <li>Resume-specific copy (1-line summaries, bullets, detached fields) stays in Resume Studio.</li>
            <li>Deleting an item here never deletes it from your library.</li>
          </ul>
          {counts && (
            <p className="rounded-lg border border-line bg-bg px-3 py-2 text-[12px]">
              {counts.shared} shared item{counts.shared === 1 ? '' : 's'} · {counts.portfolioOnly} only in this portfolio · {counts.libraryOnly} only in the library
            </p>
          )}
          <Link to="/profile" className="inline-flex items-center gap-1.5 text-accent hover:underline">
            <UserRound className="size-3.5" /> Open Profile Studio
          </Link>
        </div>
      </Dialog>
    </>
  );
}
