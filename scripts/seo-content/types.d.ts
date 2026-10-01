/** Shape of a static content page (see scripts/content-pages.mjs). */
export interface ContentPage {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  template?: string;
  sample?: {
    name: string;
    headline: string;
    summary: string;
    experience: { role: string; company: string; dates: string; bullets: string[] }[];
    education: string;
    skills: string[];
  };
  steps?: { name: string; text: string }[];
  sections: { heading: string; p?: string[]; list?: string[] }[];
  faqs?: { q: string; a: string }[];
}
