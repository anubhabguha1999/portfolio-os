import { describe, it, expect } from 'vitest';
import { parseResumeText, parseResumeStructure } from '@/lib/import/resume-text';
import { findDateRange, splitRoleCompany, normalizeDate } from '@/lib/import/common';
import { runHealthCheck } from '@/lib/analysis';
import type { Portfolio, SectionType, SectionOf } from '@/types/portfolio';

const get = <K extends SectionType>(p: Portfolio, type: K): SectionOf<K> => {
  const s = p.sections.find((x) => x.type === type);
  if (!s) throw new Error(`missing ${type}`);
  return s as SectionOf<K>;
};

const RESUME_ENGINEER = `JANE DOE
Senior Frontend Engineer
jane.doe@gmail.com | +1 (415) 555-0142 | San Francisco, CA
linkedin.com/in/janedoe · github.com/janedoe · https://janedoe.dev

SUMMARY
Frontend engineer with 8 years of experience building accessible, high-performance web applications for millions of users. I lead design-system work and mentor engineers.

EXPERIENCE
Senior Frontend Engineer at Stripe
Jan 2021 – Present
• Led the migration of the dashboard to React 18, cutting load time by 40%
• Built the internal design system used by 30 teams
- Mentored 6 engineers

Frontend Engineer, Airbnb
Mar 2017 - Dec 2020
Seattle, WA
• Shipped the new search experience
• Improved Lighthouse accessibility score from 72 to 98

EDUCATION
B.Sc. in Computer Science
University of California, Berkeley
2013 - 2017

SKILLS
Languages: TypeScript, JavaScript, Python
Frameworks: React, Next.js, Node.js
Tools: Figma, Webpack, Vite

PROJECTS
Pixel Grid — A tiny canvas editor for pixel art
• 12k stars on GitHub
• https://github.com/janedoe/pixel-grid

CERTIFICATIONS
AWS Certified Developer – Amazon Web Services (2022)
`;

const RESUME_DESIGNER = `Marco Rossi
Product Designer
Milan, Italy
marco.rossi@studio.it
dribbble.com/marcorossi

Profile:
Designer focused on fintech and healthcare products.

Work Experience:
Figma | Senior Product Designer | 06/2020–Present
- Designed the prototyping onboarding flow
- Ran 40+ user interviews
Revolut — Product Designer
03/2018–05/2020
- Redesigned the savings experience

Education:
Master of Design in Interaction Design, Politecnico di Milano, 2016 - 2018
Bachelor of Arts, Università di Bologna, 2012 - 2015

Technical Skills:
Figma • Sketch • Framer • Prototyping • User research

Awards:
- Red Dot Design Award 2021 — Savings app
- CSS Design Awards Website of the Day (2019)
`;

const RESUME_DATA = `Priya Sharma
Data Scientist
priya.sharma@outlook.com  |  +91 98765 43210  |  Bengaluru, India

PROFESSIONAL SUMMARY
Data scientist specialising in NLP and recommendation systems.

EMPLOYMENT HISTORY
Flipkart — Senior Data Scientist
2019 - Present
* Built a recommendation model serving 200M users
* Reduced churn by 12%

Data Analyst at Infosys
2016 - 2019
* Automated weekly reporting with Python

EDUCATION
M.Tech in Artificial Intelligence
Indian Institute of Science, 2014 - 2016
B.Tech, Computer Engineering
IIT Bombay, 2010 - 2014

TECHNICAL SKILLS
Python, SQL, PyTorch, scikit-learn, Spark | Tableau | Airflow

PUBLICATIONS
- Neural ranking for e-commerce search, KDD 2021
`;

describe('date and role helpers', () => {
  it('parses date ranges into YYYY-MM', () => {
    expect(findDateRange('Jan 2020 – Present')).toMatchObject({ start: '2020-01', end: '', current: true });
    expect(findDateRange('2018 - 2021')).toMatchObject({ start: '2018', end: '2021', current: false });
    expect(findDateRange('03/2019–06/2022')).toMatchObject({ start: '2019-03', end: '2022-06' });
    expect(findDateRange('September 2015 to August 2017')).toMatchObject({ start: '2015-09', end: '2017-08' });
    expect(normalizeDate('Sept. 2019')).toBe('2019-09');
    expect(findDateRange('Worked with ES2020 features')).toBeNull();
  });

  it('splits role and company in common forms', () => {
    expect(splitRoleCompany('Senior Engineer at Acme')).toEqual({ role: 'Senior Engineer', company: 'Acme' });
    expect(splitRoleCompany('Frontend Engineer, Airbnb')).toEqual({ role: 'Frontend Engineer', company: 'Airbnb' });
    expect(splitRoleCompany('Flipkart — Senior Data Scientist')).toEqual({ role: 'Senior Data Scientist', company: 'Flipkart' });
    expect(splitRoleCompany('Figma | Product Designer')).toEqual({ role: 'Product Designer', company: 'Figma' });
    expect(splitRoleCompany('Staff Engineer — Stripe')).toEqual({ role: 'Staff Engineer', company: 'Stripe' });
  });
});

describe('resume text parser', () => {
  it('parses an engineering resume', () => {
    const { portfolio: p, summary } = parseResumeText(RESUME_ENGINEER);
    const hero = get(p, 'hero').data;
    expect(hero.name).toBe('Jane Doe');
    expect(hero.title).toBe('Senior Frontend Engineer');
    const contact = get(p, 'contact').data;
    expect(contact.email).toBe('jane.doe@gmail.com');
    expect(contact.phone).toBe('+1 (415) 555-0142');
    expect(contact.location).toBe('San Francisco, CA');
    const social = get(p, 'social').data.items;
    expect(social.map((s) => s.platform)).toEqual(['LinkedIn', 'GitHub', 'Website']);
    expect(social[0]!.url).toBe('https://linkedin.com/in/janedoe');

    const xp = get(p, 'experience').data.items;
    expect(xp).toHaveLength(2);
    expect(xp[0]).toMatchObject({ role: 'Senior Frontend Engineer', company: 'Stripe', start: '2021-01', current: true });
    expect(xp[0]!.achievements).toHaveLength(3);
    expect(xp[1]).toMatchObject({ role: 'Frontend Engineer', company: 'Airbnb', start: '2017-03', end: '2020-12', location: 'Seattle, WA' });

    const edu = get(p, 'education').data.items;
    expect(edu).toHaveLength(1);
    expect(edu[0]).toMatchObject({ degree: 'B.Sc.', field: 'Computer Science', institution: 'University of California, Berkeley', start: '2013', end: '2017' });

    const skills = get(p, 'skills').data;
    expect(skills.items.map((s) => s.name)).toContain('Next.js');
    expect(new Set(skills.items.map((s) => s.category))).toEqual(new Set(['Languages', 'Frameworks', 'Tools']));
    expect(skills.items).toHaveLength(9);

    const projects = get(p, 'projects').data.items;
    expect(projects[0]).toMatchObject({ title: 'Pixel Grid', description: 'A tiny canvas editor for pixel art', github: 'https://github.com/janedoe/pixel-grid' });

    const certs = get(p, 'certifications').data.items;
    expect(certs[0]).toMatchObject({ name: 'AWS Certified Developer', issuer: 'Amazon Web Services', date: '2022' });

    expect(summary).toContain('2 positions');
    expect(summary).toContain('9 skills in 3 categories');
    expect(summary).toContain('1 degree');
    expect(p.metadata.title).toBe('Jane Doe — Senior Frontend Engineer');
    // Hero buttons only point at sections that exist.
    expect(runHealthCheck(p, {}).checks.find((c) => c.id === 'health-links')?.status).toBe('pass');
  });

  it('parses a designer resume with "Heading:" style headings and pipe-separated entries', () => {
    const r = parseResumeStructure(RESUME_DESIGNER);
    expect(r.name).toBe('Marco Rossi');
    expect(r.headline).toBe('Product Designer');
    expect(r.location).toBe('Milan, Italy');
    expect(r.email).toBe('marco.rossi@studio.it');
    expect(r.links[0]).toEqual({ platform: 'Dribbble', url: 'https://dribbble.com/marcorossi' });
    expect(r.summary).toContain('fintech');
    expect(r.experience).toHaveLength(2);
    expect(r.experience[0]).toMatchObject({ company: 'Figma', role: 'Senior Product Designer', start: '2020-06', current: true });
    expect(r.experience[1]).toMatchObject({ company: 'Revolut', role: 'Product Designer', start: '2018-03', end: '2020-05' });
    expect(r.education).toHaveLength(2);
    expect(r.education[0]).toMatchObject({ degree: 'Master of Design', field: 'Interaction Design', institution: 'Politecnico di Milano' });
    expect(r.skills.map((s) => s.name)).toEqual(['Figma', 'Sketch', 'Framer', 'Prototyping', 'User research']);
    expect(r.achievements).toHaveLength(2);
    expect(r.achievements[0]).toMatchObject({ title: 'Red Dot Design Award', description: 'Savings app', date: '2021' });
  });

  it('parses a data-science resume and keeps unknown sections', () => {
    const { portfolio: p, summary } = parseResumeText(RESUME_DATA);
    const xp = get(p, 'experience').data.items;
    expect(xp.map((x) => [x.role, x.company])).toEqual([
      ['Senior Data Scientist', 'Flipkart'],
      ['Data Analyst', 'Infosys'],
    ]);
    expect(xp[0]!.achievements).toHaveLength(2);
    expect(get(p, 'contact').data.phone).toBe('+91 98765 43210');
    expect(get(p, 'contact').data.location).toBe('Bengaluru, India');
    const edu = get(p, 'education').data.items;
    expect(edu).toHaveLength(2);
    expect(edu[0]).toMatchObject({ degree: 'M.Tech', field: 'Artificial Intelligence', institution: 'Indian Institute of Science' });
    expect(edu[1]).toMatchObject({ institution: 'IIT Bombay' });
    expect(get(p, 'skills').data.items.map((s) => s.name)).toEqual(['Python', 'SQL', 'PyTorch', 'scikit-learn', 'Spark', 'Tableau', 'Airflow']);
    const custom = get(p, 'custom').data;
    expect(custom.heading).toBe('Publications');
    expect(custom.content).toContain('- Neural ranking');
    expect(summary.join(' ')).toContain('2 degrees');
  });
});
