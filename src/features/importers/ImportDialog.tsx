// CONTRACT (owned by the import workstream).
export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'json' | 'html' | 'resume';
}
/** Imports always create a NEW project, then navigate to /builder/:id. */
export function ImportDialog(_props: ImportDialogProps) {
  return null;
}
