/**
 * Curated skills/tools dictionary for job-description matching.
 *
 * - `hard`  — languages, methods and domain skills (Python, SQL, machine learning, SEO…)
 * - `tool`  — named products, frameworks, platforms (React, Docker, AWS, Jira, Figma…)
 * - `soft`  — interpersonal/working-style skills (communication, leadership…)
 *
 * Aliases are matched on *stemmed* token sequences, so plurals and -ing/-ed forms match too.
 * Technologies that are missing here fall back to the Extract-Your-Data dictionary
 * (`src/knowledge/analysis/skills.ts`).
 */
import { canonicalSkill } from '@/knowledge/analysis/skills';
import { tokenize } from './text';

export type KeywordKind = 'hard' | 'tool' | 'soft' | 'other';

type Entry = [canonical: string, kind: Exclude<KeywordKind, 'other'>, aliases?: string[]];

const ENTRIES: Entry[] = [
  /* ----------------------------- languages ----------------------------- */
  ['JavaScript', 'hard', ['js', 'java script', 'ecmascript', 'es6', 'es2015', 'vanilla js']],
  ['TypeScript', 'hard', ['ts', 'type script']],
  ['Python', 'hard', ['python3', 'python 3']],
  ['Java', 'hard', ['java 8', 'java 11', 'java 17', 'core java']],
  ['C', 'hard'],
  ['C++', 'hard', ['cpp', 'c plus plus']],
  ['C#', 'hard', ['c sharp', 'csharp']],
  ['Go', 'hard', ['golang']],
  ['Rust', 'hard'],
  ['Ruby', 'hard'],
  ['PHP', 'hard'],
  ['Swift', 'hard', ['swiftui']],
  ['Kotlin', 'hard'],
  ['Dart', 'hard'],
  ['Scala', 'hard'],
  ['R', 'hard'],
  ['MATLAB', 'hard'],
  ['SQL', 'hard', ['t-sql', 'pl/sql', 'plsql', 'tsql', 'sql queries']],
  ['Bash', 'hard', ['shell scripting', 'shell script', 'bash scripting', 'shell']],
  ['PowerShell', 'hard'],
  ['HTML', 'hard', ['html5']],
  ['CSS', 'hard', ['css3']],
  ['Sass', 'hard', ['scss']],
  ['GraphQL', 'hard', ['graph ql']],
  ['Solidity', 'hard'],
  ['Elixir', 'hard'],
  ['Haskell', 'hard'],
  ['Perl', 'hard'],
  ['Lua', 'hard'],
  ['Objective-C', 'hard', ['objective c', 'objc']],
  ['VBA', 'hard'],
  /* ----------------------------- concepts ------------------------------ */
  ['REST APIs', 'hard', ['rest', 'rest api', 'restful', 'restful api', 'restful service', 'rest service', 'api design', 'web api']],
  ['Microservices', 'hard', ['micro service', 'microservice architecture', 'service oriented architecture', 'soa']],
  ['System Design', 'hard', ['systems design', 'distributed system', 'scalable system', 'software architecture', 'system architecture']],
  ['Data Structures & Algorithms', 'hard', ['data structure', 'algorithm', 'dsa', 'data structures and algorithms']],
  ['Object-Oriented Programming', 'hard', ['oop', 'object oriented programming', 'object-oriented design', 'object oriented design', 'ood']],
  ['Functional Programming', 'hard'],
  ['Design Patterns', 'hard', ['design pattern']],
  ['CI/CD', 'hard', ['ci cd', 'cicd', 'continuous integration', 'continuous delivery', 'continuous deployment', 'ci/cd pipeline', 'deployment pipeline']],
  ['DevOps', 'hard', ['dev ops']],
  ['Infrastructure as Code', 'hard', ['iac', 'infrastructure-as-code']],
  ['Cloud Computing', 'hard', ['cloud infrastructure', 'cloud platform', 'cloud native', 'cloud-native', 'cloud service']],
  ['Unit Testing', 'hard', ['unit test', 'automated testing', 'test automation', 'automated test', 'integration testing', 'integration test', 'e2e testing', 'end-to-end testing']],
  ['TDD', 'hard', ['test driven development', 'test-driven development']],
  ['Agile', 'hard', ['scrum', 'agile/scrum', 'kanban', 'agile methodology', 'agile methodologies', 'sprint planning']],
  ['Accessibility', 'hard', ['a11y', 'wcag', 'web accessibility']],
  ['Responsive Design', 'hard', ['responsive web design', 'mobile-first', 'mobile first']],
  ['Web Performance', 'hard', ['performance optimization', 'performance optimisation', 'core web vitals', 'page speed']],
  ['Security', 'hard', ['application security', 'appsec', 'cybersecurity', 'cyber security', 'information security', 'infosec', 'owasp', 'secure coding']],
  ['Authentication', 'hard', ['oauth', 'oauth2', 'jwt', 'sso', 'single sign-on', 'auth', 'openid connect', 'oidc']],
  ['Networking', 'hard', ['tcp/ip', 'dns', 'http', 'computer networking']],
  ['Embedded Systems', 'hard', ['embedded', 'firmware', 'rtos']],
  ['Mobile Development', 'hard', ['mobile app development', 'mobile application', 'mobile app']],
  ['Frontend Development', 'hard', ['front-end development', 'front end development', 'frontend', 'front-end', 'front end', 'ui development', 'ui engineering']],
  ['Backend Development', 'hard', ['back-end development', 'back end development', 'backend', 'back-end', 'back end', 'server-side', 'server side']],
  ['Full-Stack Development', 'hard', ['full stack', 'full-stack', 'fullstack', 'full stack development']],
  ['Database Design', 'hard', ['data modeling', 'data modelling', 'schema design', 'database management', 'relational database', 'rdbms']],
  ['Caching', 'hard', ['cache', 'caching strategy']],
  ['Message Queues', 'hard', ['message queue', 'event-driven', 'event driven', 'pub/sub', 'pubsub', 'message broker', 'event streaming']],
  ['Observability', 'hard', ['monitoring', 'logging', 'alerting', 'tracing', 'apm']],
  ['Code Review', 'hard', ['code reviews', 'peer review', 'pull request review']],
  ['Version Control', 'hard', ['source control']],
  ['Linux', 'hard', ['unix', 'ubuntu', 'centos', 'rhel', 'red hat']],
  /* ------------------------- data / ML / analytics ---------------------- */
  ['Machine Learning', 'hard', ['ml', 'machine-learning', 'ml model', 'predictive modeling', 'predictive modelling']],
  ['Deep Learning', 'hard', ['neural network', 'dl']],
  ['NLP', 'hard', ['natural language processing', 'text mining']],
  ['Computer Vision', 'hard', ['image recognition', 'object detection', 'cv model']],
  ['LLMs', 'hard', ['llm', 'large language model', 'generative ai', 'genai', 'gen ai', 'prompt engineering', 'rag', 'retrieval augmented generation']],
  ['AI', 'hard', ['artificial intelligence']],
  ['MLOps', 'hard', ['ml ops', 'model deployment']],
  ['Statistics', 'hard', ['statistical analysis', 'statistical modeling', 'statistical modelling', 'hypothesis testing', 'regression', 'statistic']],
  ['Data Analysis', 'hard', ['data analytics', 'analytics', 'analyze data', 'analyse data', 'data analyst', 'quantitative analysis']],
  ['Data Visualization', 'hard', ['data visualisation', 'dashboard', 'dashboarding', 'reporting dashboard', 'data viz']],
  ['Data Engineering', 'hard', ['data pipeline', 'etl', 'elt', 'data warehousing', 'data warehouse', 'data lake', 'data infrastructure']],
  ['Big Data', 'hard'],
  ['A/B Testing', 'hard', ['ab testing', 'a/b test', 'split testing', 'experimentation', 'controlled experiment']],
  ['Excel', 'tool', ['ms excel', 'microsoft excel', 'spreadsheet', 'pivot table', 'vlookup', 'google sheets']],
  /* ------------------------- business / product ------------------------- */
  ['Product Management', 'hard', ['product strategy', 'product roadmap', 'roadmap', 'roadmapping', 'product discovery', 'prd']],
  ['Project Management', 'hard', ['program management', 'project planning', 'pmp', 'prince2']],
  ['Stakeholder Management', 'hard', ['stakeholder', 'stakeholder communication', 'stakeholder engagement']],
  ['Requirements Gathering', 'hard', ['requirements analysis', 'business requirements', 'user stories', 'user story', 'requirement gathering']],
  ['Business Analysis', 'hard', ['business analyst']],
  ['Financial Modeling', 'hard', ['financial modelling', 'financial model', 'valuation', 'dcf']],
  ['Financial Analysis', 'hard', ['financial reporting', 'financial statement', 'p&l', 'variance analysis']],
  ['Budgeting', 'hard', ['budget management', 'forecasting', 'budget', 'forecast']],
  ['Accounting', 'hard', ['bookkeeping', 'gaap', 'ifrs', 'accounts payable', 'accounts receivable', 'reconciliation']],
  ['Sales', 'hard', ['b2b sales', 'saas sales', 'account management', 'business development', 'pipeline management', 'closing deals', 'quota']],
  ['Lead Generation', 'hard', ['prospecting', 'outbound', 'cold calling', 'demand generation']],
  ['Customer Success', 'hard', ['customer support', 'customer service', 'client relations', 'client management', 'customer experience']],
  ['Operations', 'hard', ['operations management', 'process improvement', 'process optimization', 'supply chain', 'logistics', 'lean', 'six sigma']],
  ['Recruiting', 'hard', ['recruitment', 'talent acquisition', 'candidate sourcing', 'full-cycle recruiting']],
  ['Compliance', 'hard', ['regulatory compliance', 'gdpr', 'hipaa', 'sox', 'soc 2', 'soc2', 'iso 27001', 'risk management', 'audit']],
  /* ----------------------------- marketing ------------------------------ */
  ['SEO', 'hard', ['search engine optimization', 'search engine optimisation', 'technical seo']],
  ['SEM', 'hard', ['search engine marketing', 'ppc', 'paid search', 'google ads', 'adwords', 'paid media', 'paid social']],
  ['Content Marketing', 'hard', ['content strategy', 'content creation', 'copywriting', 'content writing', 'editorial']],
  ['Social Media Marketing', 'hard', ['social media', 'community management', 'smm']],
  ['Email Marketing', 'hard', ['email campaign', 'marketing automation', 'lifecycle marketing', 'crm marketing']],
  ['Digital Marketing', 'hard', ['performance marketing', 'growth marketing', 'online marketing']],
  ['Brand Strategy', 'hard', ['branding', 'brand management', 'brand marketing']],
  ['Market Research', 'hard', ['competitive analysis', 'market analysis', 'customer research']],
  ['Go-to-Market', 'hard', ['go to market', 'gtm', 'product marketing', 'product launch']],
  /* ------------------------------- design ------------------------------- */
  ['UX Design', 'hard', ['user experience', 'ux', 'ux/ui', 'ui/ux', 'interaction design', 'experience design']],
  ['UI Design', 'hard', ['user interface design', 'visual design', 'ui']],
  ['User Research', 'hard', ['usability testing', 'user interview', 'ux research', 'usability study']],
  ['Wireframing', 'hard', ['wireframe', 'prototyping', 'prototype', 'mockup', 'mock-up']],
  ['Design Systems', 'hard', ['design system', 'component library', 'ui library', 'ui kit', 'style guide']],
  ['Graphic Design', 'hard', ['typography', 'layout design', 'print design']],
  ['Motion Design', 'hard', ['animation', 'motion graphics']],
  /* ------------------------------- tools -------------------------------- */
  ['React', 'tool', ['reactjs', 'react.js', 'react js', 'react hooks']],
  ['React Native', 'tool', ['react-native', 'reactnative']],
  ['Next.js', 'tool', ['nextjs', 'next js']],
  ['Vue', 'tool', ['vuejs', 'vue.js', 'vue js', 'vue 3']],
  ['Nuxt', 'tool', ['nuxtjs', 'nuxt.js']],
  ['Angular', 'tool', ['angularjs', 'angular.js']],
  ['Svelte', 'tool', ['sveltekit']],
  ['Redux', 'tool', ['redux toolkit']],
  ['Tailwind CSS', 'tool', ['tailwind', 'tailwindcss']],
  ['Bootstrap', 'tool'],
  ['Material UI', 'tool', ['mui', 'material-ui']],
  ['jQuery', 'tool'],
  ['Vite', 'tool'],
  ['Webpack', 'tool'],
  ['Storybook', 'tool'],
  ['Three.js', 'tool', ['threejs', 'three js', 'webgl']],
  ['Node.js', 'tool', ['nodejs', 'node js', 'node']],
  ['Express', 'tool', ['expressjs', 'express.js']],
  ['NestJS', 'tool', ['nest.js', 'nest js']],
  ['Django', 'tool'],
  ['Flask', 'tool'],
  ['FastAPI', 'tool', ['fast api']],
  ['Spring Boot', 'tool', ['spring', 'springboot', 'spring framework']],
  ['Ruby on Rails', 'tool', ['rails', 'ror']],
  ['Laravel', 'tool'],
  ['.NET', 'tool', ['dotnet', 'asp.net', '.net core', 'asp.net core']],
  ['gRPC', 'tool', ['grpc', 'protobuf', 'protocol buffers']],
  ['WebSockets', 'tool', ['websocket', 'socket.io', 'socketio']],
  ['PostgreSQL', 'tool', ['postgres', 'postgre sql', 'psql', 'postgresql']],
  ['MySQL', 'tool', ['my sql', 'mariadb']],
  ['SQL Server', 'tool', ['mssql', 'ms sql', 'microsoft sql server']],
  ['Oracle', 'tool', ['oracle db', 'oracle database']],
  ['SQLite', 'tool'],
  ['MongoDB', 'tool', ['mongo', 'mongo db']],
  ['Redis', 'tool'],
  ['Cassandra', 'tool'],
  ['DynamoDB', 'tool', ['dynamo db']],
  ['Elasticsearch', 'tool', ['elastic search', 'opensearch', 'elk']],
  ['Firebase', 'tool', ['firestore']],
  ['Supabase', 'tool'],
  ['Prisma', 'tool'],
  ['Kafka', 'tool', ['apache kafka']],
  ['RabbitMQ', 'tool', ['rabbit mq']],
  ['Spark', 'tool', ['apache spark', 'pyspark']],
  ['Hadoop', 'tool'],
  ['Airflow', 'tool', ['apache airflow']],
  ['dbt', 'tool'],
  ['Snowflake', 'tool'],
  ['BigQuery', 'tool', ['big query']],
  ['Redshift', 'tool'],
  ['Databricks', 'tool'],
  ['AWS', 'tool', ['amazon web services', 'ec2', 's3', 'lambda', 'aws lambda', 'cloudformation', 'ecs', 'eks']],
  ['Google Cloud', 'tool', ['gcp', 'google cloud platform']],
  ['Azure', 'tool', ['microsoft azure']],
  ['Docker', 'tool', ['containerization', 'containerisation', 'docker compose']],
  ['Kubernetes', 'tool', ['k8s', 'helm', 'openshift']],
  ['Terraform', 'tool'],
  ['Ansible', 'tool'],
  ['GitHub Actions', 'tool', ['gh actions']],
  ['Jenkins', 'tool'],
  ['CircleCI', 'tool', ['circle ci']],
  ['Vercel', 'tool'],
  ['Netlify', 'tool'],
  ['Nginx', 'tool'],
  ['Prometheus', 'tool'],
  ['Grafana', 'tool'],
  ['Datadog', 'tool', ['data dog']],
  ['Sentry', 'tool'],
  ['Git', 'tool'],
  ['GitHub', 'tool'],
  ['GitLab', 'tool'],
  ['Bitbucket', 'tool'],
  ['Jira', 'tool'],
  ['Confluence', 'tool'],
  ['Notion', 'tool'],
  ['Asana', 'tool'],
  ['Trello', 'tool'],
  ['Slack', 'tool'],
  ['Postman', 'tool'],
  ['Swagger', 'tool', ['openapi', 'open api']],
  ['Jest', 'tool'],
  ['Vitest', 'tool'],
  ['Mocha', 'tool'],
  ['Cypress', 'tool'],
  ['Playwright', 'tool'],
  ['Selenium', 'tool'],
  ['JUnit', 'tool'],
  ['pytest', 'tool', ['py.test']],
  ['React Testing Library', 'tool', ['testing library']],
  ['TensorFlow', 'tool', ['tensor flow', 'keras']],
  ['PyTorch', 'tool', ['py torch']],
  ['scikit-learn', 'tool', ['sklearn', 'scikit learn']],
  ['Pandas', 'tool'],
  ['NumPy', 'tool'],
  ['Jupyter', 'tool', ['jupyter notebook', 'jupyter notebooks']],
  ['Hugging Face', 'tool', ['huggingface', 'transformers']],
  ['LangChain', 'tool'],
  ['OpenAI API', 'tool', ['openai', 'chatgpt', 'gpt-4', 'gpt']],
  ['Power BI', 'tool', ['powerbi']],
  ['Tableau', 'tool'],
  ['Looker', 'tool', ['looker studio', 'data studio']],
  ['Google Analytics', 'tool', ['ga4', 'universal analytics']],
  ['Mixpanel', 'tool'],
  ['Amplitude', 'tool'],
  ['Segment', 'tool'],
  ['Salesforce', 'tool', ['sfdc']],
  ['HubSpot', 'tool', ['hub spot']],
  ['Zendesk', 'tool'],
  ['Intercom', 'tool'],
  ['Marketo', 'tool'],
  ['Mailchimp', 'tool'],
  ['SAP', 'tool'],
  ['QuickBooks', 'tool', ['quick books']],
  ['Workday', 'tool'],
  ['Shopify', 'tool'],
  ['WordPress', 'tool', ['word press']],
  ['Webflow', 'tool'],
  ['Figma', 'tool', ['figjam']],
  ['Sketch', 'tool'],
  ['Adobe XD', 'tool'],
  ['Photoshop', 'tool', ['adobe photoshop']],
  ['Illustrator', 'tool', ['adobe illustrator']],
  ['InDesign', 'tool', ['adobe indesign']],
  ['After Effects', 'tool', ['adobe after effects']],
  ['Premiere Pro', 'tool', ['adobe premiere', 'premiere']],
  ['Adobe Creative Suite', 'tool', ['adobe creative cloud', 'creative cloud', 'adobe suite']],
  ['Framer', 'tool'],
  ['Miro', 'tool'],
  ['Android', 'tool', ['android sdk']],
  ['iOS', 'tool', ['ios sdk']],
  ['Flutter', 'tool'],
  ['Expo', 'tool'],
  ['Unity', 'tool'],
  ['Unreal Engine', 'tool', ['unreal']],
  ['Microsoft Office', 'tool', ['ms office', 'office 365', 'microsoft 365', 'powerpoint', 'word', 'outlook']],
  ['Google Workspace', 'tool', ['g suite', 'gsuite', 'google docs']],
  /* ----------------------------- soft skills ---------------------------- */
  ['Communication', 'soft', ['communication skill', 'communicate', 'communicator', 'written communication', 'verbal communication', 'written and verbal communication', 'verbal and written communication', 'communicating']],
  ['Leadership', 'soft', ['lead', 'led', 'leader', 'leading', 'team lead', 'people management', 'manage a team', 'managed a team', 'team leadership']],
  ['Collaboration', 'soft', ['collaborate', 'collaborative', 'collaborated', 'teamwork', 'team player', 'cross-functional', 'cross functional', 'work closely', 'worked closely', 'partner with', 'partnered with']],
  ['Mentoring', 'soft', ['mentor', 'mentorship', 'coaching', 'coach', 'mentored', 'onboarding']],
  ['Problem Solving', 'soft', ['problem-solving', 'problem solver', 'solve problem', 'solved problem', 'troubleshooting', 'troubleshoot', 'debugging', 'debug']],
  ['Critical Thinking', 'soft', ['analytical thinking', 'analytical skill', 'analytical']],
  ['Attention to Detail', 'soft', ['detail-oriented', 'detail oriented', 'attention to detail', 'meticulous']],
  ['Time Management', 'soft', ['prioritization', 'prioritisation', 'prioritize', 'prioritise', 'multitasking', 'multi-tasking', 'organized', 'organised', 'organizational skill', 'deadline']],
  ['Adaptability', 'soft', ['adaptable', 'flexible', 'flexibility', 'fast-paced', 'fast paced', 'ambiguity', 'comfortable with ambiguity']],
  ['Ownership', 'soft', ['take ownership', 'took ownership', 'accountability', 'accountable', 'self-starter', 'self starter', 'self-motivated', 'self motivated', 'proactive', 'initiative', 'autonomous', 'autonomy', 'independently']],
  ['Presentation Skills', 'soft', ['presentation', 'public speaking', 'present to', 'presented to', 'storytelling']],
  ['Negotiation', 'soft', ['negotiate', 'negotiated', 'negotiating']],
  ['Decision Making', 'soft', ['decision-making', 'judgment', 'judgement']],
  ['Creativity', 'soft', ['creative', 'innovative', 'innovation']],
  ['Customer Focus', 'soft', ['customer-centric', 'customer centric', 'customer-focused', 'customer focused', 'customer obsession', 'user-centric', 'user centric', 'user-focused']],
  ['Empathy', 'soft', ['empathetic', 'emotional intelligence']],
  ['Conflict Resolution', 'soft', ['resolve conflict', 'resolved conflict']],
  ['Curiosity', 'soft', ['curious', 'eager to learn', 'growth mindset', 'continuous learning', 'learn quickly', 'fast learner', 'quick learner']],
  ['Interpersonal Skills', 'soft', ['interpersonal', 'relationship building', 'build relationship', 'built relationship']],
];

export interface DictHit {
  canonical: string;
  kind: Exclude<KeywordKind, 'other'>;
}

/**
 * Aliases that are ordinary English words (or too short) unless written in a specific case.
 * The predicate receives the token(s) *as written*.
 */
const CASE_RULES: Record<string, (raw: string) => boolean> = {
  c: (r) => r === 'C',
  r: (r) => r === 'R',
  go: (r) => r === 'Go' || r === 'GO',
  rest: (r) => r === 'REST',
  ts: (r) => r === 'TS',
  js: (r) => r === 'JS',
  ml: (r) => r === 'ML',
  dl: (r) => r === 'DL',
  ai: (r) => r === 'AI',
  ui: (r) => r === 'UI',
  ux: (r) => r === 'UX',
  cv: (r) => r === 'CV',
  gtm: (r) => r === 'GTM',
  soa: (r) => r === 'SOA',
  iac: (r) => r === 'IaC' || r === 'IAC',
  rag: (r) => r === 'RAG',
  ood: (r) => r === 'OOD',
  sap: (r) => r === 'SAP',
  elk: (r) => r === 'ELK',
  lean: (r) => r === 'Lean',
  express: (r) => r === 'Express',
  spring: (r) => r === 'Spring',
  swift: (r) => r === 'Swift',
  rails: (r) => r === 'Rails',
  node: (r) => r === 'Node',
  dart: (r) => r === 'Dart',
  rust: (r) => r === 'Rust',
  ruby: (r) => r === 'Ruby',
  oracle: (r) => r === 'Oracle',
  expo: (r) => r === 'Expo',
  unity: (r) => r === 'Unity',
  segment: (r) => r === 'Segment',
  notion: (r) => r === 'Notion',
  slack: (r) => r === 'Slack',
  sketch: (r) => r === 'Sketch',
  framer: (r) => r === 'Framer',
  sentry: (r) => r === 'Sentry',
  spark: (r) => r === 'Spark',
  word: (r) => r === 'Word',
  outlook: (r) => r === 'Outlook',
  premiere: (r) => r === 'Premiere',
  amplitude: (r) => r === 'Amplitude',
  looker: (r) => r === 'Looker',
  workday: (r) => r === 'Workday',
  intercom: (r) => r === 'Intercom',
  lambda: (r) => r === 'Lambda',
};

/** Stem key of a phrase: stems of its tokens joined by spaces. */
export function stemKey(phrase: string): string {
  return tokenize(phrase)
    .map((t) => t.stem)
    .join(' ');
}

const INDEX = new Map<string, DictHit & { alias: string }>();
for (const [canonical, kind, aliases = []] of ENTRIES) {
  for (const a of [canonical, ...aliases]) {
    const key = stemKey(a);
    if (!key || INDEX.has(key)) continue;
    INDEX.set(key, { canonical, kind, alias: a.toLowerCase() });
  }
}

/** Longest alias length (in tokens) — bounds n-gram lookups. */
export const MAX_ALIAS_TOKENS = 4;

/** Ordinary words the knowledge dictionary maps to technologies ("next" → Next.js). */
const FALLBACK_BLOCK = new Set(['next', 'py', 'xd', 'rtl', 'shell', 'rest', 'node', 'express', 'spring', 'swift', 'rails', 'expo']);

/** Map knowledge-dictionary categories onto our three groups. */
function kindOfCategory(category: string): Exclude<KeywordKind, 'other'> {
  return category === 'Languages' || category === 'Practices' ? 'hard' : 'tool';
}

/**
 * Look up a token sequence. `raw` is the sequence as written (for case rules).
 * Returns null for unknown terms.
 */
export function lookupTerm(stemmedKey: string, raw: string, lowerText?: string, strict = true): DictHit | null {
  const hit = INDEX.get(stemmedKey);
  if (hit) {
    const rule = CASE_RULES[hit.alias];
    if (strict && rule && !rule(raw)) return null;
    return { canonical: hit.canonical, kind: hit.kind };
  }
  // Fallback: the Extract-Your-Data dictionary (no ambiguous one-word aliases).
  const text = lowerText ?? raw.toLowerCase();
  if (text.length < 2 || (strict && (text.length < 3 || CASE_RULES[text] || FALLBACK_BLOCK.has(text)))) return null;
  const k = canonicalSkill(text);
  if (!k) return null;
  const own = INDEX.get(stemKey(k.name));
  return own ? { canonical: own.canonical, kind: own.kind } : { canonical: k.name, kind: kindOfCategory(k.category) };
}

/**
 * Canonical form of a skill/tool name, e.g. "k8s" → "Kubernetes", "JS" → "JavaScript". Unknown → null.
 * Case rules are relaxed: a name typed into a skills list ("node", "go") is meant as the technology.
 */
export function canonicalTerm(term: string): DictHit | null {
  const toks = tokenize(term);
  if (!toks.length) return null;
  return lookupTerm(toks.map((t) => t.stem).join(' '), toks.map((t) => t.raw).join(' '), toks.map((t) => t.text).join(' '), false);
}

export function dictionarySize(): number {
  return ENTRIES.length;
}
