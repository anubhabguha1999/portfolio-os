import { useWorkspace } from '@/studio/store/workspace';

/** True while the shared profile has no content, so example content may fill it. Kept apart from the create code so list pages stay light. */
export function useProfileIsEmpty(): boolean {
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  return !profile.name.trim() && !library.experience.length && !library.projects.length;
}
