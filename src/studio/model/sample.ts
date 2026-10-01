import type { Library, LocalEntry, Profile } from './types';
import { createLibCertification, createLibEducation, createLibExperience, createLibProject, createLibSkill, createLibAchievement, emptyLibrary, emptyProfile } from './defaults';

/** Realistic example content so every template can be tried before typing anything. */
export function sampleProfile(): Profile {
  return {
    ...emptyProfile(),
    name: 'Alex Morgan',
    headline: 'Senior Full-Stack Engineer',
    bio: 'Full-stack engineer with 8 years of experience building reliable web platforms. I lead small teams, ship pragmatic architecture and care about performance, accessibility and developer experience.',
    email: 'alex.morgan@example.com',
    phone: '+1 555 010 2030',
    location: 'Berlin, Germany',
    website: 'https://alexmorgan.dev',
    socialLinks: [
      { id: 'sl_gh', platform: 'github', label: 'github.com/alexmorgan', url: 'https://github.com/alexmorgan' },
      { id: 'sl_li', platform: 'linkedin', label: 'linkedin.com/in/alexmorgan', url: 'https://linkedin.com/in/alexmorgan' },
    ],
  };
}

export function sampleLibrary(): Library {
  const lib = emptyLibrary();
  lib.experience = [
    createLibExperience({
      id: 'exp_sample_1',
      company: 'Northwind Health',
      role: 'Senior Full-Stack Engineer',
      location: 'Berlin',
      start: '2021-03',
      current: true,
      description: 'Lead engineer for the patient-scheduling platform used by 140 clinics.',
      achievements: [
        'Cut median page load from 3.8s to 1.1s by moving rendering to the edge and trimming 60% of client JavaScript.',
        'Designed an event-sourced booking service that handles 2M appointments per month with 99.98% uptime.',
        'Mentored 5 engineers; introduced RFCs and trunk-based development, halving lead time for changes.',
      ],
      technologies: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS'],
    }),
    createLibExperience({
      id: 'exp_sample_2',
      company: 'Brightline Studio',
      role: 'Frontend Engineer',
      location: 'Remote',
      start: '2018-01',
      end: '2021-02',
      achievements: [
        'Built a component library adopted by 9 product teams, reducing UI defects by 35%.',
        'Shipped an accessibility programme that brought 3 flagship apps to WCAG 2.1 AA.',
      ],
      technologies: ['React', 'GraphQL', 'Storybook'],
    }),
    createLibExperience({
      id: 'exp_sample_3',
      company: 'Pixel & Co',
      role: 'Web Developer',
      location: 'Manchester',
      start: '2016-06',
      end: '2017-12',
      achievements: ['Delivered 20+ client sites on time and on budget.', 'Automated deployments, saving roughly 6 hours per release.'],
      technologies: ['JavaScript', 'PHP', 'MySQL'],
    }),
  ];
  lib.projects = [
    createLibProject({
      id: 'prj_sample_1',
      title: 'DHMS — Distributed Health Monitoring',
      description: 'An open-source system that aggregates device telemetry from hospital wards into a real-time dashboard with alerting.',
      technologies: ['Go', 'Kafka', 'React', 'TimescaleDB'],
      role: 'Creator & maintainer',
      duration: '2023 – present',
      github: 'https://github.com/alexmorgan/dhms',
      resumeSummary: 'Real-time telemetry dashboard for hospital wards.',
      resumeBullets: ['Processes 50k events/s on a single node.', 'Adopted by 3 hospitals in pilot programmes.'],
    }),
    createLibProject({
      id: 'prj_sample_2',
      title: 'Typeset',
      description: 'A tiny Markdown-to-PDF typesetting engine with hyphenation and widow control.',
      technologies: ['TypeScript', 'WebAssembly'],
      role: 'Author',
      duration: '2022',
      live: 'https://typeset.example.com',
      resumeSummary: 'Markdown-to-PDF typesetting engine in the browser.',
    }),
  ];
  lib.education = [createLibEducation({ id: 'edu_sample_1', institution: 'University of Manchester', degree: 'BSc', field: 'Computer Science', start: '2012-09', end: '2016-06', grade: 'First-class honours' })];
  lib.skills = [
    ['TypeScript', 'Languages'],
    ['Go', 'Languages'],
    ['SQL', 'Languages'],
    ['React', 'Frontend'],
    ['Next.js', 'Frontend'],
    ['Accessibility', 'Frontend'],
    ['Node.js', 'Backend'],
    ['PostgreSQL', 'Backend'],
    ['Kafka', 'Backend'],
    ['AWS', 'Cloud'],
    ['Docker', 'Cloud'],
    ['Terraform', 'Cloud'],
  ].map(([name, category], i) => createLibSkill({ id: `skl_sample_${i}`, name: name!, category: category!, level: 5 - (i % 3) }));
  lib.certifications = [createLibCertification({ id: 'crt_sample_1', name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon Web Services', date: '2022-05' })];
  lib.achievements = [createLibAchievement({ id: 'ach_sample_1', title: 'Speaker, JSConf EU', description: 'Talk on edge rendering for healthcare apps.', date: '2023-06' })];
  return lib;
}

/* ------------------------------------------------------------------ */
/* Example personas                                                    */
/* Fully fictional people with rich, editable content. A new resume    */
/* can start from one so every field is pre-filled and only needs      */
/* rewriting rather than inventing.                                    */
/* ------------------------------------------------------------------ */

export interface SamplePersona {
  id: string;
  label: string;
  description: string;
  profile(): Profile;
  library(): Library;
  /** Resume-only entries, keyed by section kind or by custom section title. */
  entries: Record<string, Array<Partial<LocalEntry>>>;
}

function engineerLead(): { profile: Profile; library: Library } {
  const profile: Profile = {
    ...emptyProfile(),
    name: 'Kabir Malhotra',
    headline: 'Lead Software Engineer',
    bio: 'Product-minded engineer with 7+ years of experience designing and shipping large-scale web and mobile platforms. I lead cross-functional squads, turn ambiguous requirements into clear architecture and care deeply about performance, reliability and clean, well-tested code.',
    email: 'kabir.malhotra@example.com',
    phone: '+91 98765 43210',
    location: 'Pune, Maharashtra, India',
    website: 'https://kabirmalhotra.dev',
    socialLinks: [
      { id: 'sl_kb_li', platform: 'linkedin', label: 'in/kabir-malhotra', url: 'https://linkedin.com/in/kabir-malhotra' },
      { id: 'sl_kb_gh', platform: 'github', label: 'kabirmalhotra', url: 'https://github.com/kabirmalhotra' },
    ],
  };
  const lib = emptyLibrary();
  lib.experience = [
    createLibExperience({
      id: 'exp_kb_1',
      company: 'Meridian Logistics Tech',
      role: 'Lead Software Engineer',
      location: 'Pune, India',
      start: '2023-04',
      current: true,
      achievements: [
        'Led the rebuild of a nationwide fleet-tracking platform serving 18,000+ vehicles, cutting dashboard load time by 62%.',
        'Directed a squad of 10 engineers across web, mobile and backend; introduced code-review standards and sprint health metrics.',
        'Architected an event-driven pipeline on Kafka and PostgreSQL that processes 4M GPS events per day with 99.95% uptime.',
      ],
      technologies: ['React', 'Node.js', 'Kafka', 'PostgreSQL', 'AWS'],
    }),
    createLibExperience({
      id: 'exp_kb_2',
      company: 'Brightwave Digital',
      role: 'Software Engineer II',
      location: 'Bengaluru, India',
      start: '2020-07',
      end: '2023-03',
      achievements: [
        'Built responsive customer portals in React, TypeScript and Tailwind CSS used by 250k monthly active users.',
        'Shipped a React Native field-service app with offline sync, raising technician productivity by 30%.',
      ],
      technologies: ['TypeScript', 'React Native', 'GraphQL', 'Redis'],
    }),
    createLibExperience({
      id: 'exp_kb_3',
      company: 'Corelogic Systems',
      role: 'Software Engineering Intern',
      location: 'Remote',
      start: '2019-12',
      end: '2020-06',
      achievements: ['Developed internal reporting tools in Java and Spring Boot, automating 15 hours of manual work each week.'],
      technologies: ['Java', 'Spring Boot', 'MySQL'],
    }),
  ];
  lib.education = [
    createLibEducation({ id: 'edu_kb_1', degree: 'Bachelor of Technology', field: 'Computer Science and Engineering', institution: 'Western Institute of Technology', start: '2016-08', end: '2020-06', grade: '8.7 CGPA' }),
    createLibEducation({ id: 'edu_kb_2', degree: 'Higher Secondary Certificate (Science)', institution: 'Greenfield Senior Secondary School', start: '2014-06', end: '2016-05', grade: '91%' }),
  ];
  lib.skills = ['React.js', 'Next.js', 'TypeScript', 'JavaScript', 'Node.js', 'Express.js', 'React Native', 'Python', 'FastAPI', 'PostgreSQL', 'MongoDB', 'Redis', 'Kafka', 'AWS', 'Docker', 'Tailwind CSS', 'GraphQL', 'Grafana', 'GitHub Actions'].map((name, i) =>
    createLibSkill({ id: `skl_kb_${i}`, name, category: '', level: 0 }),
  );
  lib.projects = [
    createLibProject({
      id: 'prj_kb_1',
      title: 'Ledgerly — Expense Intelligence',
      description: 'A personal-finance web app that categorises spending automatically.',
      technologies: ['Next.js', 'FastAPI', 'PostgreSQL'],
      github: 'https://github.com/kabirmalhotra/ledgerly',
      resumeSummary: 'A personal-finance app that categorises transactions with a **fine-tuned ML classifier** and surfaces monthly insights through an accessible, mobile-first dashboard.',
    }),
    createLibProject({
      id: 'prj_kb_2',
      title: 'ShopStream — Real-time Commerce',
      description: 'Full-stack e-commerce platform.',
      technologies: ['React', 'Node.js', 'Socket.IO', 'BullMQ'],
      resumeSummary: 'A scalable full-stack store built with **React** and **Node.js + Express**, featuring live order tracking, background job queues, secure checkout and an admin console.',
    }),
    createLibProject({
      id: 'prj_kb_3',
      title: 'Pulse — Log Observatory',
      description: 'Developer tool for streaming logs.',
      technologies: ['Go', 'WebSockets', 'ClickHouse'],
      resumeSummary: 'A developer tool that streams application logs in real time, with saved queries, alert rules and a JSON diff viewer — all in one unified workspace.',
    }),
    createLibProject({
      id: 'prj_kb_4',
      title: 'VoiceMood — Emotion Detection',
      description: 'Speech emotion recognition research project.',
      technologies: ['Python', 'PyTorch', 'Librosa'],
      github: 'https://github.com/kabirmalhotra/voicemood',
      resumeSummary: 'A speech-emotion recognition model that classifies six emotions from short voice clips using **MFCC feature extraction** and a lightweight CNN, reaching 84% accuracy.',
    }),
  ];
  lib.certifications = [
    createLibCertification({ id: 'crt_kb_1', name: 'AWS Certified Developer – Associate', issuer: 'Amazon Web Services', date: '2024-02' }),
    createLibCertification({ id: 'crt_kb_2', name: 'Professional Scrum Master I', issuer: 'Scrum.org', date: '2023-09' }),
  ];
  return { profile, library: lib };
}

function contentStrategist(): { profile: Profile; library: Library } {
  const profile: Profile = {
    ...emptyProfile(),
    name: 'Meera Iyer',
    headline: 'Content & SEO Strategist',
    bio: [
      'Content and SEO strategist with 5+ years of experience creating search-optimised web, editorial and research content for global audiences in education, healthcare and SaaS.',
      'Skilled across the full content lifecycle: keyword research, search-intent mapping, on-page optimisation, competitor benchmarking and editorial planning.',
      'Proven record of producing accurate, well-researched long-form content, including whitepapers, case studies and industry reports, for international clients.',
      'Known for clear communication, sharp editing and the discipline to deliver high-volume work on tight deadlines without compromising quality.',
    ].join('\n'),
    email: 'meera.iyer@example.com',
    phone: '+91 91234 56780',
    location: 'Chennai, India',
    socialLinks: [{ id: 'sl_mi_li', platform: 'linkedin', label: 'linkedin.com/in/meera-iyer', url: 'https://linkedin.com/in/meera-iyer' }],
  };
  const lib = emptyLibrary();
  lib.experience = [
    createLibExperience({
      id: 'exp_mi_1',
      company: 'Northstar Learning',
      role: 'Senior Content Strategist',
      location: 'Bengaluru, India',
      start: '2023-08',
      current: true,
      achievements: [
        'Own the SEO content roadmap for 1,200+ course and admissions pages, growing organic sessions by 74% year over year.',
        'Partner with marketing and counselling teams to plan campaigns, landing pages and blogs that lifted lead conversion by 22%.',
        'Built an editorial style guide and fact-checking workflow adopted by a team of 9 writers and 3 freelance editors.',
        'Research international programmes, scholarships and visa requirements to keep high-traffic pages accurate and current.',
      ],
    }),
    createLibExperience({
      id: 'exp_mi_2',
      company: 'Quillcraft Research Services',
      role: 'Research Content Specialist',
      location: 'Chennai, India',
      start: '2020-06',
      end: '2023-07',
      achievements: [
        'Wrote and edited 400+ long-form research pieces, case studies and reports across business, healthcare and sustainability.',
        'Applied frameworks such as SWOT, PESTLE and Porter’s Five Forces to evaluate company performance and market position.',
        'Ran statistical analysis in SPSS and Excel and turned results into clear charts and summaries for client decision-making.',
        'Managed end-to-end client relationships: scoping briefs, planning timelines and delivering every project on schedule.',
      ],
    }),
  ];
  lib.achievements = [
    createLibAchievement({ id: 'ach_mi_1', title: 'Speaker, Content Marketing Summit', description: 'Talk on search-intent driven editorial planning', date: '2024-11' }),
    createLibAchievement({ id: 'ach_mi_2', title: 'Top Contributor Award', description: 'Northstar Learning, recognised for organic growth', date: '2024-03' }),
    createLibAchievement({ id: 'ach_mi_3', title: 'Google Analytics Certification', description: 'Google Skillshop', date: '2022-05' }),
    createLibAchievement({ id: 'ach_mi_4', title: 'Published research paper', description: 'Regional Journal of Environmental Studies', date: '2020-02' }),
  ];
  const skill = (cat: string, names: string[], k: string) => names.map((name, i) => createLibSkill({ id: `skl_mi_${k}${i}`, name, category: cat }));
  lib.skills = [
    ...skill('SEO & Content Strategy', ['Keyword Research', 'On-Page SEO', 'Search Intent Analysis', 'SERP & Competitor Analysis', 'Content Gap Analysis', 'Internal Linking', 'Content Strategy'], 'a'),
    ...skill('Writing & Editing', ['Web Content', 'Long-form Articles', 'Case Studies', 'Research Writing', 'Copyediting', 'Proofreading', 'Fact-Checking'], 'b'),
    ...skill('Tools', ['Ahrefs', 'Google Search Console', 'Google Analytics 4', 'SPSS', 'Canva', 'Jira', 'MS Office'], 'c'),
  ];
  lib.education = [
    createLibEducation({ id: 'edu_mi_1', degree: 'M.A. in English Literature', institution: 'Coastal University', location: 'Chennai', start: '2018-07', end: '2020-05' }),
    createLibEducation({ id: 'edu_mi_2', degree: 'B.A. in Mass Communication', institution: 'Lakeside College', location: 'Coimbatore', start: '2015-07', end: '2018-05' }),
    createLibEducation({ id: 'edu_mi_3', degree: 'Higher Secondary (12th)', institution: 'St. Anne’s Higher Secondary School', start: '2013-06', end: '2015-04' }),
  ];
  return { profile, library: lib };
}

const ENGINEER_LANGS = [
  { title: 'English', subtitle: 'Full Professional Proficiency' },
  { title: 'Hindi', subtitle: 'Native or Bilingual Proficiency' },
  { title: 'Marathi', subtitle: 'Professional Working Proficiency' },
];

export const SAMPLE_PERSONAS: SamplePersona[] = [
  {
    id: 'engineer-lead',
    label: 'Software engineer',
    description: 'Kabir Malhotra, a lead engineer with 3 roles, 4 projects and 19 skills',
    profile: () => engineerLead().profile,
    library: () => engineerLead().library,
    entries: { languages: ENGINEER_LANGS },
  },
  {
    id: 'content-strategist',
    label: 'Content & marketing',
    description: 'Meera Iyer, a content and SEO strategist with grouped skills and strengths',
    profile: () => contentStrategist().profile,
    library: () => contentStrategist().library,
    entries: {
      Strengths: ['Communication', 'Leadership', 'Team Collaboration', 'Stakeholder Management', 'Problem-Solving', 'Adaptability', 'Critical Thinking', 'Attention to Detail', 'Time Management', 'Research & Analytics'].map((title) => ({ title })),
      languages: [
        { title: 'English', subtitle: 'Fluent' },
        { title: 'Tamil', subtitle: 'Native' },
        { title: 'Hindi', subtitle: 'Conversational' },
      ],
    },
  },
  {
    id: 'classic',
    label: 'Full-stack engineer',
    description: 'Alex Morgan, a senior full-stack engineer',
    profile: sampleProfile,
    library: sampleLibrary,
    entries: { languages: [{ title: 'English', subtitle: 'Native' }, { title: 'German', subtitle: 'C1' }] },
  },
];

export function getPersona(id: string | undefined): SamplePersona {
  return SAMPLE_PERSONAS.find((p) => p.id === id) ?? SAMPLE_PERSONAS[SAMPLE_PERSONAS.length - 1]!;
}
