/** Job application tracker — data model. Stored in the `applications` IndexedDB store. */

export const APPLICATION_STATUSES = ['wishlist', 'applied', 'screening', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn'] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

/** Statuses that end the pipeline. */
export const CLOSED_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['accepted', 'rejected', 'withdrawn']);

/** Statuses that mean the employer replied (positively or not). */
export const RESPONSE_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['screening', 'interview', 'offer', 'accepted', 'rejected']);

export type WorkMode = '' | 'onsite' | 'hybrid' | 'remote';

export const WORK_MODE_LABELS: Record<WorkMode, string> = { '': 'Not set', onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' };

export interface ApplicationContact {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface StatusChange {
  status: ApplicationStatus;
  at: string;
}

export interface Application {
  id: string;
  company: string;
  role: string;
  jobUrl: string;
  location: string;
  workMode: WorkMode;
  /** Free text, e.g. "€70–85k + equity". */
  salary: string;
  /** Where the job was found (LinkedIn, referral, company site…). */
  source: string;
  status: ApplicationStatus;
  /** Position inside its kanban column (ascending). */
  order: number;
  /** Calendar dates as YYYY-MM-DD ('' = not set). */
  savedAt: string;
  appliedAt: string;
  nextStep: string;
  nextStepDate: string;
  contacts: ApplicationContact[];
  notes: string;
  jobDescription: string;
  /** Resume version and cover letter / document sent. */
  resumeId: string | null;
  documentId: string | null;
  history: StatusChange[];
  createdAt: string;
  updatedAt: string;
}
