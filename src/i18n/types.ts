/**
 * Output languages for the documents people send out (resumes, letters, documents and
 * portfolio websites). The app UI stays English; only the *fixed* strings the engines
 * print (default headings, "Present", page numbers, contact labels…) are translated.
 *
 * Every dictionary is typed as `Dict`, so a missing key fails the typecheck.
 */

export const DOC_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'hi', 'ar', 'he', 'zh', 'ja'] as const;

export type DocLanguage = (typeof DOC_LANGUAGES)[number];

export interface Dict {
  /* ---------------- Section headings (resume + website defaults) --------------- */
  profile: string;
  summary: string;
  professionalSummary: string;
  about: string;
  aboutMe: string;
  careerObjective: string;
  summaryOfQualifications: string;
  experience: string;
  workExperience: string;
  workHistory: string;
  employmentHistory: string;
  projects: string;
  selectedWork: string;
  skills: string;
  technicalSkills: string;
  professionalSkills: string;
  skillsSummary: string;
  strengths: string;
  education: string;
  certifications: string;
  courses: string;
  conferencesCourses: string;
  achievements: string;
  keyAchievements: string;
  highlights: string;
  awards: string;
  languages: string;
  language: string;
  interests: string;
  publications: string;
  openSource: string;
  volunteer: string;
  references: string;
  contact: string;
  contactDetails: string;
  personalInfo: string;
  services: string;
  kindWords: string;
  writing: string;
  elsewhere: string;
  journey: string;
  gallery: string;
  customSection: string;
  letsWorkTogether: string;

  /* ------------------------------- Fixed phrases ------------------------------ */
  present: string;
  /** `{title}` is replaced with the section heading. */
  continued: string;
  /** `{page}` and `{pages}` are substituted by the layout engine. */
  pageOfPages: string;
  other: string;
  credentialId: string;
  availableOnRequest: string;
  levelBeginner: string;
  levelIntermediate: string;
  levelProficient: string;
  levelAdvanced: string;
  levelExpert: string;

  /* ------------------------------ Contact labels ------------------------------ */
  email: string;
  phone: string;
  location: string;
  address: string;
  web: string;
  website: string;
  link: string;

  /* ---------------------------------- Letters --------------------------------- */
  dearHiringManager: string;
  hiringManager: string;
  sincerely: string;
  /** `{role}` is replaced with the role applied for. */
  reApplicationFor: string;

  /* ------------------------------ Document kinds ------------------------------ */
  kindResume: string;
  kindCv: string;
  kindCoverLetter: string;
  kindPortfolio: string;
  kindCaseStudy: string;
  kindProposal: string;
  kindProfile: string;
  kindReport: string;
  kindPresentation: string;
  kindDocument: string;

  /* --------------------------- Portfolio website UI --------------------------- */
  skipToContent: string;
  primaryNav: string;
  toggleScheme: string;
  menu: string;
  backToTop: string;
  scrollToContent: string;
  /** `{brand}` is replaced with the product name. */
  builtWith: string;
  readCaseStudy: string;
  live: string;
  source: string;
  notFoundTitle: string;
  notFoundText: string;
  /** `{title}` is replaced with the site title. */
  backTo: string;
}

export type DictKey = keyof Dict;
