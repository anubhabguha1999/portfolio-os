import { lazy, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronDown, FileStack, FileText, LayoutDashboard, UserRound } from 'lucide-react';
import { Truncate } from 'dead-lock-react-lib';
import { Menu } from '@/components/ui/Menu';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import type { Profile } from '@/studio/model/types';
import { cn } from '@/utils/cn';
import { hasProfileDetails, profileInitials } from './hasProfile';

const ProfilePhoto = lazy(() => import('./ProfilePhoto'));

export function ProfileAvatar({ profile, size = 28, className }: { profile: Profile; size?: number; className?: string }) {
  const initials = <span className="text-[0.42em] font-semibold tracking-wide">{profileInitials(profile)}</span>;
  return (
    <span className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft text-accent ring-1 ring-line', className)} style={{ width: size, height: size, fontSize: size }} aria-hidden="true">
      {initials}
      {profile.profileImage && (
        <Suspense fallback={null}>
          <ProfilePhoto image={profile.profileImage} className="absolute inset-0 size-full object-cover" />
        </Suspense>
      )}
    </span>
  );
}

/** Loads the shared profile once and reports whether there is anything to show. */
export function useProfileSummary(): { profile: Profile; ready: boolean; show: boolean } {
  const profile = useWorkspace((s) => s.profile);
  const ready = useWorkspace((s) => s.loaded);
  useEffect(() => {
    void ensureWorkspace();
  }, []);
  return { profile, ready, show: ready && hasProfileDetails(profile) };
}

/** Avatar + name in the site header, with shortcuts to everything that uses the profile. */
export function ProfileMenu() {
  const navigate = useNavigate();
  const { profile, show } = useProfileSummary();
  if (!show) return null;
  const name = profile.name.trim() || 'Your profile';
  return (
    <Menu
      label="Profile menu"
      trigger={(p) => (
        <button {...p} type="button" aria-label={`Profile: ${name}`} className="inline-flex h-9 max-w-[200px] shrink-0 items-center gap-2 rounded-full border border-line bg-panel/60 py-1 pl-1 pr-2.5 text-[13px] transition-colors hover:border-line-strong hover:bg-hover">
          <ProfileAvatar profile={profile} size={28} />
          <span className="hidden min-w-0 2xl:block">
            <Truncate disableClickExpand style={{ display: 'block', maxWidth: 120 }} className="font-medium">
              {name}
            </Truncate>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />
        </button>
      )}
      header={
        <div className="flex items-center gap-2.5">
          <ProfileAvatar profile={profile} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{name}</p>
            <p className="truncate text-[11.5px] text-fg-subtle">{profile.headline.trim() || profile.email.trim() || 'Shared across every studio'}</p>
          </div>
        </div>
      }
      items={[
        { label: 'Edit profile', icon: <UserRound />, onSelect: () => navigate('/profile') },
        { label: profile.profileImage ? 'Change photo' : 'Add a photo', icon: <Camera />, onSelect: () => navigate('/profile') },
        'separator',
        { label: 'My resumes', icon: <FileText />, onSelect: () => navigate('/resumes') },
        { label: 'Documents', icon: <FileStack />, onSelect: () => navigate('/documents') },
        { label: 'Dashboard', icon: <LayoutDashboard />, onSelect: () => navigate('/studio') },
      ]}
    />
  );
}
