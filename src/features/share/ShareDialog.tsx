// CONTRACT (owned by the share workstream).
import type { Portfolio } from '@/types/portfolio';

export interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  portfolio: Portfolio;
}
export function ShareDialog(_props: ShareDialogProps) {
  return null;
}
