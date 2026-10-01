import type { Profile } from '@/studio/model/types';

/** True once the person has filled in anything about themselves. */
export function hasProfileDetails(p: Profile): boolean {
  return !!(p.name.trim() || p.headline.trim() || p.email.trim() || p.phone?.trim() || p.bio.trim() || p.location?.trim() || p.profileImage);
}

export function profileInitials(p: Profile): string {
  const source = p.name.trim() || p.email.trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (p.name.trim() && parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '')).toUpperCase() || '?';
}
