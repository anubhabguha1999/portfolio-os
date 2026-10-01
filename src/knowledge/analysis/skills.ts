/**
 * Known-technology dictionary for skill detection and normalisation.
 * "ReactJS", "React.js" and "React JS" all normalise to "React"; the original text is kept by callers.
 */

type Entry = [canonical: string, category: string, aliases?: string[]];

const ENTRIES: Entry[] = [
  // Languages
  ['JavaScript', 'Languages', ['js', 'java script', 'ecmascript', 'es6']],
  ['TypeScript', 'Languages', ['ts', 'type script']],
  ['Python', 'Languages', ['python3', 'py']],
  ['Java', 'Languages'],
  ['C', 'Languages'],
  ['C++', 'Languages', ['cpp', 'c plus plus']],
  ['C#', 'Languages', ['c sharp', 'csharp']],
  ['Go', 'Languages', ['golang']],
  ['Rust', 'Languages'],
  ['Ruby', 'Languages'],
  ['PHP', 'Languages'],
  ['Swift', 'Languages'],
  ['Kotlin', 'Languages'],
  ['Dart', 'Languages'],
  ['Scala', 'Languages'],
  ['R', 'Languages'],
  ['MATLAB', 'Languages'],
  ['SQL', 'Languages'],
  ['Bash', 'Languages', ['shell', 'shell scripting']],
  ['HTML', 'Languages', ['html5']],
  ['CSS', 'Languages', ['css3']],
  ['Sass', 'Languages', ['scss']],
  ['GraphQL', 'Languages', ['graph ql']],
  // Frontend
  ['React', 'Frontend', ['reactjs', 'react.js', 'react js']],
  ['React Native', 'Mobile', ['react-native', 'reactnative']],
  ['Next.js', 'Frontend', ['nextjs', 'next js', 'next']],
  ['Vue', 'Frontend', ['vuejs', 'vue.js', 'vue js']],
  ['Nuxt', 'Frontend', ['nuxtjs', 'nuxt.js']],
  ['Angular', 'Frontend', ['angularjs', 'angular.js']],
  ['Svelte', 'Frontend', ['sveltekit']],
  ['Redux', 'Frontend', ['redux toolkit', 'rtk']],
  ['Zustand', 'Frontend'],
  ['Tailwind CSS', 'Frontend', ['tailwind', 'tailwindcss']],
  ['Bootstrap', 'Frontend'],
  ['Material UI', 'Frontend', ['mui', 'material-ui']],
  ['jQuery', 'Frontend', ['jquery']],
  ['Vite', 'Frontend'],
  ['Webpack', 'Frontend'],
  ['Three.js', 'Frontend', ['threejs', 'three js']],
  ['Framer Motion', 'Frontend'],
  // Backend
  ['Node.js', 'Backend', ['nodejs', 'node js', 'node']],
  ['Express', 'Backend', ['expressjs', 'express.js', 'express js']],
  ['NestJS', 'Backend', ['nest.js', 'nest js']],
  ['Django', 'Backend'],
  ['Flask', 'Backend'],
  ['FastAPI', 'Backend', ['fast api']],
  ['Spring Boot', 'Backend', ['spring', 'springboot']],
  ['Ruby on Rails', 'Backend', ['rails', 'ror']],
  ['Laravel', 'Backend'],
  ['.NET', 'Backend', ['dotnet', 'asp.net', '.net core']],
  ['REST APIs', 'Backend', ['rest', 'rest api', 'restful', 'restful apis']],
  ['WebSockets', 'Backend', ['websocket', 'socket.io', 'socketio']],
  ['Microservices', 'Backend', ['micro services']],
  // Data
  ['MongoDB', 'Databases', ['mongo', 'mongo db']],
  ['PostgreSQL', 'Databases', ['postgres', 'postgre sql', 'psql']],
  ['MySQL', 'Databases', ['my sql']],
  ['SQLite', 'Databases'],
  ['Redis', 'Databases'],
  ['Firebase', 'Databases', ['firestore']],
  ['Supabase', 'Databases'],
  ['DynamoDB', 'Databases', ['dynamo db']],
  ['Elasticsearch', 'Databases', ['elastic search']],
  ['Prisma', 'Databases'],
  ['Mongoose', 'Databases'],
  // Cloud & DevOps
  ['AWS', 'Cloud & DevOps', ['amazon web services']],
  ['Google Cloud', 'Cloud & DevOps', ['gcp', 'google cloud platform']],
  ['Azure', 'Cloud & DevOps', ['microsoft azure']],
  ['Docker', 'Cloud & DevOps'],
  ['Kubernetes', 'Cloud & DevOps', ['k8s']],
  ['Terraform', 'Cloud & DevOps'],
  ['CI/CD', 'Cloud & DevOps', ['ci cd', 'cicd', 'continuous integration']],
  ['GitHub Actions', 'Cloud & DevOps'],
  ['Jenkins', 'Cloud & DevOps'],
  ['Vercel', 'Cloud & DevOps'],
  ['Netlify', 'Cloud & DevOps'],
  ['Nginx', 'Cloud & DevOps'],
  ['Linux', 'Cloud & DevOps'],
  ['Git', 'Tools', ['version control']],
  ['GitHub', 'Tools'],
  ['GitLab', 'Tools'],
  ['Jira', 'Tools'],
  ['Figma', 'Design'],
  ['Adobe XD', 'Design', ['xd']],
  ['Photoshop', 'Design', ['adobe photoshop']],
  ['Illustrator', 'Design', ['adobe illustrator']],
  ['Postman', 'Tools'],
  // Testing
  ['Jest', 'Testing'],
  ['Vitest', 'Testing'],
  ['Cypress', 'Testing'],
  ['Playwright', 'Testing'],
  ['Selenium', 'Testing'],
  ['React Testing Library', 'Testing', ['rtl', 'testing library']],
  // ML / data
  ['Machine Learning', 'Data & AI', ['ml']],
  ['Deep Learning', 'Data & AI', ['dl']],
  ['NLP', 'Data & AI', ['natural language processing']],
  ['TensorFlow', 'Data & AI', ['tensor flow']],
  ['PyTorch', 'Data & AI', ['py torch']],
  ['scikit-learn', 'Data & AI', ['sklearn', 'scikit learn']],
  ['Pandas', 'Data & AI'],
  ['NumPy', 'Data & AI', ['numpy']],
  ['LLMs', 'Data & AI', ['llm', 'large language models']],
  ['OpenAI API', 'Data & AI', ['openai']],
  ['LangChain', 'Data & AI'],
  ['Power BI', 'Data & AI', ['powerbi']],
  ['Tableau', 'Data & AI'],
  ['Excel', 'Tools', ['ms excel', 'microsoft excel']],
  // Mobile
  ['Android', 'Mobile'],
  ['iOS', 'Mobile', ['ios']],
  ['Flutter', 'Mobile'],
  ['Expo', 'Mobile'],
  // Practices
  ['Agile', 'Practices', ['scrum', 'agile/scrum']],
  ['TDD', 'Practices', ['test driven development']],
  ['System Design', 'Practices'],
  ['Data Structures', 'Practices', ['dsa', 'data structures and algorithms']],
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const INDEX = new Map<string, { name: string; category: string }>();
for (const [name, category, aliases = []] of ENTRIES) {
  for (const a of [name, ...aliases]) INDEX.set(norm(a), { name, category });
  // "Node.js" also matches "nodejs" and "node js" without explicit aliases.
  INDEX.set(norm(name).replace(/\./g, ''), { name, category });
}

/** Canonical name for a known technology, else null. */
export function canonicalSkill(raw: string): { name: string; category: string } | null {
  const k = norm(raw).replace(/[()]/g, '').trim();
  return INDEX.get(k) ?? INDEX.get(k.replace(/\./g, '')) ?? INDEX.get(k.replace(/[\s.-]/g, '')) ?? null;
}

/** Same skill under different spellings? ("React" vs "React.js") */
export function sameSkill(a: string, b: string): boolean {
  const ca = canonicalSkill(a)?.name ?? norm(a);
  const cb = canonicalSkill(b)?.name ?? norm(b);
  return ca.toLowerCase() === cb.toLowerCase();
}

/** Short tokens that are real words too often to match outside a skills list. */
const AMBIGUOUS = new Set(['c', 'r', 'go', 'next', 'node', 'express', 'spring', 'rest', 'git', 'ml', 'dl', 'js', 'ts', 'py', 'xd', 'rtl', 'excel', 'swift', 'rails', 'scrum', 'agile', 'expo', 'android', 'linux']);

/** Known technologies mentioned anywhere in free text (whole-word, case-insensitive). */
export function findSkillsInText(text: string): Array<{ name: string; category: string; original: string }> {
  const out = new Map<string, { name: string; category: string; original: string }>();
  for (const [name, category, aliases = []] of ENTRIES) {
    for (const a of [name, ...aliases]) {
      if (AMBIGUOUS.has(norm(a))) continue;
      const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = new RegExp(`(?<![\\w.#+])${esc}(?![\\w#+]|\\.\\w)`, 'i').exec(text);
      if (m && !out.has(name)) out.set(name, { name, category, original: m[0] });
    }
  }
  return [...out.values()];
}
