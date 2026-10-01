/**
 * Resume example landing pages (one per job role), rendered as static HTML by scripts/prerender.mjs.
 * Sample people and companies are fictional.
 */
export default [
  /* ------------------------------------------------------------------ */
  {
    slug: "software-engineer",
    title: "Software Engineer Resume Example & Template (2026)",
    description: "Free software engineer resume example with a full sample, ATS keywords and bullet formulas that show impact. Edit and export PDF or Word.",
    h1: "Software engineer resume example",
    intro: "Hiring managers for engineering roles skim for three things: what you built, how big it was, and what changed because of it. This example shows a mid-level backend engineer's resume, followed by section-by-section advice you can apply whether you are a new graduate or a staff engineer.",
    template: "Developer",
    sample: {
      name: "Priya Raman",
      headline: "Backend Software Engineer, Distributed Systems",
      summary: "Backend engineer with 5 years building high-throughput services in Go and Python. Led the migration of a payments pipeline to an event-driven architecture handling 40M events a day, and cut p99 latency by 62%. Comfortable owning a service from design doc to on-call.",
      experience: [
        {
          role: "Software Engineer II",
          company: "Northwind Labs",
          dates: "Mar 2023 - Present",
          bullets: [
            "Designed and shipped an event-driven payments ledger in Go and Kafka processing 40M events a day with zero data-loss incidents in 18 months.",
            "Reduced p99 API latency from 820 ms to 310 ms by introducing read replicas and a Redis cache layer, lifting checkout conversion by 3.1%.",
            "Wrote the design doc and led a team of 4 to break a monolith billing module into 3 services, cutting deploy time from 45 to 8 minutes.",
            "Mentored 2 junior engineers through their first on-call rotations; both now own production services."
          ]
        },
        {
          role: "Software Engineer",
          company: "Bluefin Analytics",
          dates: "Jul 2020 - Feb 2023",
          bullets: [
            "Built a Python ETL framework adopted by 6 teams, replacing 30+ ad hoc cron jobs and reducing failed nightly runs by 85%.",
            "Added contract tests and a staged rollout process that dropped production rollbacks from 9 per quarter to 2.",
            "Cut AWS compute spend by $14K a month by right-sizing ECS tasks and moving batch jobs to spot instances."
          ]
        }
      ],
      education: "B.Tech in Computer Science, Riverside Institute of Technology, 2020",
      skills: ["Go", "Python", "TypeScript", "PostgreSQL", "Kafka", "Redis", "AWS (ECS, Lambda, RDS)", "Docker", "Kubernetes", "Terraform", "gRPC", "Observability (Prometheus, Grafana)"]
    },
    sections: [
      {
        heading: "What to include on a software engineer resume",
        p: [
          "Keep the structure predictable: contact details with GitHub and portfolio links, a two to three line summary, experience, a skills block, then education. Projects belong above education if you have under three years of experience or if they are more impressive than your day job.",
          "One page is right for most engineers with under eight to ten years of experience. Senior and staff engineers can use two pages when the second page carries real weight, such as architecture ownership or cross-team leadership."
        ],
        list: [
          "Links: GitHub, a portfolio or personal site, and LinkedIn. Make sure pinned repositories are ones you are proud of.",
          "Experience: 3 to 5 bullets per role, most recent role first, each starting with a strong verb.",
          "Skills: grouped by languages, frameworks, data, and infrastructure so a reviewer can scan in seconds.",
          "Projects: name, one line on what it does, the stack, and a measurable outcome or user count."
        ]
      },
      {
        heading: "Write bullets that show impact, not duties",
        p: [
          "A useful formula is action, scope, result: what you did, how big it was, and what it changed. \"Worked on the API\" tells a reviewer nothing. \"Reduced p99 latency on the orders API from 820 ms to 310 ms by adding a Redis cache\" shows judgment, scale, and outcome in one line.",
          "If you do not have exact numbers, use honest approximations you can defend in an interview: requests per second, number of users or teams affected, percentage time saved, incidents avoided, or money saved. Interviewers will ask about any number you list, so only include figures you understand."
        ]
      },
      {
        heading: "Software engineer keywords for ATS",
        p: [
          "Applicant tracking systems and recruiters match the job description's exact terms. Mirror the posting's spelling, so write \"Kubernetes\" rather than only \"K8s\" and \"CI/CD\" if that is how the listing says it. Mention each important skill inside an experience bullet as well as in the skills block, because context proves you used it."
        ],
        list: [
          "Languages and frameworks named in the posting (for example Java, Spring Boot, React, Node.js)",
          "System design terms: microservices, distributed systems, event-driven, caching, scalability",
          "Delivery practices: CI/CD, code review, testing, observability, incident response",
          "Cloud and infrastructure: AWS, GCP or Azure services, Docker, Kubernetes, Terraform"
        ]
      },
      {
        heading: "Common mistakes engineers make",
        p: [
          "The most common problem is a skills list of 40 technologies with no evidence of depth. Recruiters trust a short list backed by bullets far more than a wall of logos. Skill rating bars and percentages are another red flag: they cannot be verified and many ATS parsers drop them."
        ],
        list: [
          "Listing every technology you have touched instead of the ones you would happily be interviewed on",
          "Describing team accomplishments without saying what you personally did",
          "Two-column layouts with text in images, which some ATS parsers read out of order",
          "Dead GitHub links or empty repositories"
        ]
      },
      {
        heading: "Tailoring for each application",
        p: [
          "Keep one master resume with every bullet you have ever written, then build a one-page version per application. For a frontend role, lead with UI performance and accessibility work; for a platform role, lead with reliability, tooling and infrastructure. Reorder bullets so the most relevant one in each role comes first, since many reviewers only read the first line."
        ]
      }
    ],
    faqs: [
      { q: "Should a software engineer resume be one page?", a: "Usually yes. With under about eight years of experience, one page forces you to keep only your strongest work. Senior engineers can use two pages if the extra content is substantial, such as system ownership or leadership of multi-team projects." },
      { q: "Do I need a projects section if I already have work experience?", a: "Not necessarily. Include projects if they show skills your job does not, such as a stack you want to move into, or if they have real users. Otherwise, the space is better spent on stronger work bullets." },
      { q: "Should I include my GPA?", a: "Include it if you graduated in the last two years and it is 3.5 or higher (or a first or distinction in other grading systems). After your first job, remove it; experience matters more." },
      { q: "Is a creative or two-column design bad for engineering roles?", a: "Not inherently, but a clean single-column layout is the safest choice for ATS parsing and fast skimming. If you use two columns, keep all text selectable and put experience in the main column." }
    ]
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "data-analyst",
    title: "Data Analyst Resume Example & Template (2026)",
    description: "Free data analyst resume example with SQL, Python and BI keywords, a full sample and tips for turning analysis into business results. Edit and export.",
    h1: "Data analyst resume example",
    intro: "A strong data analyst resume proves you can turn messy data into a decision someone acted on. This example shows an analyst with three years of experience in e-commerce and operations, with guidance on the tools, metrics and project framing that hiring managers look for.",
    template: "Modern Professional",
    sample: {
      name: "Daniel Okafor",
      headline: "Data Analyst, Product and Marketing Analytics",
      summary: "Data analyst with 3 years of experience in SQL, Python and Tableau, supporting product and marketing teams at a mid-size retailer. Built the company's first self-serve KPI dashboard, now used by 120 staff weekly, and identified a churn driver that saved an estimated $380K a year.",
      experience: [
        {
          role: "Data Analyst",
          company: "Harbor & Pine Retail",
          dates: "Jan 2023 - Present",
          bullets: [
            "Built a Tableau KPI dashboard on top of 14 dbt models that replaced 9 weekly spreadsheet reports and is used by 120 staff each week.",
            "Ran a cohort analysis on 2.1M orders that linked late deliveries to a 22% higher churn rate, leading to a carrier change that saved an estimated $380K a year.",
            "Designed and analysed 11 A/B tests for checkout and email campaigns; the winning variants lifted revenue per visitor by 6.4%.",
            "Automated a monthly finance reconciliation in Python, cutting it from 2 days to 40 minutes."
          ]
        },
        {
          role: "Junior Analyst",
          company: "Cedar Logistics",
          dates: "Jun 2021 - Dec 2022",
          bullets: [
            "Wrote SQL queries across a 300-table warehouse to answer 25+ ad hoc requests a month from operations leads.",
            "Cleaned and standardised 4 years of shipment data, reducing reporting discrepancies between regions by 90%.",
            "Created a demand forecast in Excel that cut stockouts at 3 distribution centres by 18% over one quarter."
          ]
        }
      ],
      education: "B.Sc. in Statistics, Lakeview University, 2021",
      skills: ["SQL (PostgreSQL, BigQuery)", "Python (pandas, NumPy)", "Tableau", "Power BI", "dbt", "Excel (Power Query, pivot tables)", "A/B testing", "Cohort and funnel analysis", "Statistics and regression", "Data visualisation", "Stakeholder communication"]
    },
    sections: [
      {
        heading: "What hiring managers want to see",
        p: [
          "Data analyst roles vary from reporting-heavy to near data science, so read the posting carefully. Almost all of them test three things: SQL fluency, the ability to communicate findings to non-technical people, and evidence that your work changed a decision.",
          "Your resume should show the full loop for at least two projects: the business question, the data and method you used, and what happened afterwards. \"Built dashboards\" is a task; \"built a dashboard that replaced 9 manual reports\" is an outcome."
        ],
        list: [
          "Tools with context: name the database, BI tool and language, and show them in bullets",
          "Scale: rows, tables, users of your dashboards, or number of stakeholders served",
          "Business outcomes: revenue, cost, time saved, churn, conversion or forecast accuracy",
          "Communication: presentations to leadership, documentation, or training you delivered"
        ]
      },
      {
        heading: "Writing your summary",
        p: [
          "Lead with your years of experience and core stack, then the domain you have worked in, then your single best result. Domain matters more than many candidates realise: an analyst who knows subscription metrics or supply chain data ramps up faster, so name it if it matches the role."
        ]
      },
      {
        heading: "Data analyst keywords for ATS",
        p: [
          "Match the tool names in the posting exactly. If the listing says Power BI and you have used Tableau, list Tableau honestly and mention transferable BI experience in the summary rather than claiming a tool you have not used."
        ],
        list: [
          "SQL, Python or R, Excel, and the specific warehouse (BigQuery, Snowflake, Redshift)",
          "BI tools: Tableau, Power BI, Looker, Looker Studio",
          "Methods: A/B testing, regression, forecasting, segmentation, cohort analysis",
          "Data work: ETL, data cleaning, data modelling, dbt, data quality"
        ]
      },
      {
        heading: "Mistakes to avoid",
        list: [
          "Listing tools without showing what you did with them",
          "Describing analyses without a result, recommendation or decision",
          "Including certificate courses above real project work",
          "Using charts or graphics on the resume itself; they rarely parse and take space from evidence"
        ]
      },
      {
        heading: "If you are changing careers into data",
        p: [
          "Use a projects section with two or three end-to-end analyses on public datasets, each with a link to a notebook or dashboard. Pick datasets close to the industry you are applying to, and write the project bullet like a work bullet: question, method, finding. Analytical work from a previous job, such as building reports in finance or operations, counts too and should be described in analyst terms."
        ]
      }
    ],
    faqs: [
      { q: "Do I need Python for a data analyst job?", a: "Not always. SQL and a BI tool are required for almost every role; Python or R is common in larger or more technical teams. If the posting lists it as preferred rather than required, strong SQL and communication can still get you the interview." },
      { q: "Should I link to a portfolio?", a: "Yes, especially early in your career. A link to two or three well-documented projects on GitHub or a portfolio site lets a reviewer see your SQL, your charts and how you explain findings." },
      { q: "How do I show impact if I do not know the business result?", a: "Use the closest measurable effect: time saved, number of people using your report, reduction in errors, or the decision your analysis informed. Ask former managers if you are unsure; they often remember." },
      { q: "Are certifications worth listing?", a: "List relevant ones, such as a cloud data or BI vendor certification, in a short section near the bottom. They support but do not replace project evidence." }
    ]
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "product-manager",
    title: "Product Manager Resume Example & Template (2026)",
    description: "Free product manager resume example showing outcomes, metrics and cross-functional leadership, plus PM keywords and tailoring tips. Edit and export PDF.",
    h1: "Product manager resume example",
    intro: "Product manager resumes are judged on outcomes: which metric moved, by how much, and what you did to make it happen. This example shows a PM with six years of experience in B2B SaaS, followed by advice on framing product work so it reads as ownership rather than coordination.",
    template: "Slate Banner",
    sample: {
      name: "Elena Marsh",
      headline: "Senior Product Manager, B2B SaaS Growth",
      summary: "Product manager with 6 years in B2B SaaS, leading onboarding and monetisation for a 40K-account collaboration platform. Grew trial-to-paid conversion from 11% to 17% and launched a usage-based pricing tier that added $2.3M in annual recurring revenue.",
      experience: [
        {
          role: "Senior Product Manager",
          company: "Lumen Workspace",
          dates: "Apr 2022 - Present",
          bullets: [
            "Owned onboarding for 40K accounts; redesigned the first-week experience with design and 6 engineers, raising trial-to-paid conversion from 11% to 17%.",
            "Led discovery with 35 customer interviews and pricing research, then launched a usage-based tier that added $2.3M ARR in its first year.",
            "Set quarterly OKRs with engineering and sales leads and cut the roadmap from 22 initiatives to 7, improving on-time delivery from 40% to 85%.",
            "Introduced an experimentation framework that let the team run 3x more A/B tests per quarter."
          ]
        },
        {
          role: "Product Manager",
          company: "Tidewater Software",
          dates: "Aug 2019 - Mar 2022",
          bullets: [
            "Shipped a reporting module used by 60% of enterprise customers within six months, reducing churn in that segment by 4 points.",
            "Wrote PRDs and ran sprint planning for a team of 5 engineers and 1 designer across 14 releases.",
            "Partnered with support to triage 1,200 tickets, turning the top 10 themes into fixes that cut ticket volume by 28%."
          ]
        }
      ],
      education: "MBA, Westbrook School of Management, 2019; B.Eng. Mechanical Engineering, 2015",
      skills: ["Product strategy", "Roadmapping", "OKRs", "Customer discovery", "A/B testing", "Pricing and packaging", "SQL", "Amplitude", "Jira", "Figma", "PRDs and user stories", "Go-to-market planning"]
    },
    sections: [
      {
        heading: "What a product manager resume must prove",
        p: [
          "PM hiring managers look for evidence of judgment: you chose the right problem, aligned people around it, and shipped something that moved a metric. Because PMs work through others, your bullets must make your own contribution clear without pretending you built everything alone.",
          "Phrases like \"led\", \"decided\", \"prioritised\" and \"defined\" signal ownership. Pair them with the team you worked with and the result: \"Led a team of 6 engineers to redesign onboarding, raising activation by 9 points\"."
        ],
        list: [
          "Product area and scale: users, accounts, revenue or team size",
          "Outcomes: activation, retention, conversion, revenue, NPS, cost or time to ship",
          "Process: discovery, prioritisation, experimentation, launch",
          "Cross-functional work: engineering, design, data, sales, marketing, support"
        ]
      },
      {
        heading: "Summary and headline",
        p: [
          "Name the type of product you manage (B2B SaaS, consumer mobile, marketplace, platform or API) and your focus area such as growth, core experience or infrastructure. Hiring managers often want domain fit, so a headline like \"Senior PM, B2B SaaS Growth\" helps the right reader keep reading."
        ]
      },
      {
        heading: "Product manager keywords for ATS",
        list: [
          "Product strategy, roadmap, prioritisation, product discovery, product lifecycle",
          "Agile, Scrum, sprint planning, backlog, user stories, PRD",
          "Metrics: KPIs, OKRs, retention, activation, conversion, ARR",
          "Tools: Jira, Amplitude, Mixpanel, SQL, Figma, Productboard"
        ]
      },
      {
        heading: "Common product manager resume mistakes",
        list: [
          "Writing like a project manager: meetings run and tickets written instead of outcomes",
          "Taking full credit for team results without describing your role",
          "Vague metrics such as \"improved engagement\" with no baseline or change",
          "Listing every framework you know instead of showing how you used one to make a decision"
        ]
      },
      {
        heading: "Moving into product management",
        p: [
          "If you are an engineer, designer, analyst or consultant moving into product, highlight the product-shaped parts of your current role: talking to customers, writing specs, deciding scope, or measuring a launch. A short side project with real users and a metric you tracked can show product thinking more clearly than a certificate."
        ]
      }
    ],
    faqs: [
      { q: "How many metrics should a PM resume include?", a: "Aim for at least one number in most bullets, but do not force it. A mix of business metrics (revenue, retention) and delivery metrics (time to ship, adoption) shows both strategic and execution skills." },
      { q: "Should I include an MBA?", a: "Yes if you have one, in the education section. It is rarely required; shipped products and outcomes matter more to most hiring managers." },
      { q: "Can I share confidential metrics?", a: "Avoid exact confidential figures. Use relative changes such as percentages or multiples, which show impact without disclosing sensitive numbers." },
      { q: "Is a technical background necessary?", a: "Not for most PM roles, but technical or platform PM jobs value it. If you have it, mention it briefly; if not, show that you work comfortably with engineers on trade-offs." }
    ]
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "ux-designer",
    title: "UX Designer Resume Example & Template (2026)",
    description: "Free UX designer resume example that pairs with your portfolio: research, design outcomes and keywords recruiters search for. Customise and export free.",
    h1: "UX designer resume example",
    intro: "For UX designers, the resume is the doorway to your portfolio. Its job is to show the kinds of problems you solve, the methods you use and the results you achieved, quickly enough that a recruiter clicks your portfolio link. This example shows a product designer with four years of experience.",
    template: "Creative",
    sample: {
      name: "Mateo Alvarez",
      headline: "Product Designer, UX Research and Interaction Design",
      summary: "Product designer with 4 years of experience in fintech and health apps, working from research through to shipped UI. Redesigned a loan application flow that increased completion by 27%, and built a design system now used across 3 products.",
      experience: [
        {
          role: "Product Designer",
          company: "Brightleaf Finance",
          dates: "Feb 2023 - Present",
          bullets: [
            "Led research and redesign of a 9-step loan application, cutting it to 5 steps and raising completion from 48% to 61%.",
            "Ran 24 moderated usability sessions and synthesised findings that shaped the product roadmap for two quarters.",
            "Built a Figma design system of 80+ components with tokens shared with engineering, reducing UI build time by about 30%.",
            "Improved accessibility to WCAG 2.1 AA across the customer portal, fixing 140 contrast and focus issues."
          ]
        },
        {
          role: "UX Designer",
          company: "Kindred Health",
          dates: "May 2021 - Jan 2023",
          bullets: [
            "Designed an appointment booking flow for a patient app with 200K monthly users, reducing booking-related support calls by 35%.",
            "Created journey maps and personas from 18 patient interviews, used by product and clinical teams for planning.",
            "Prototyped and tested 3 navigation concepts; the chosen design lifted task success from 72% to 91% in testing."
          ]
        }
      ],
      education: "B.Des. in Interaction Design, Meridian College of Art and Design, 2021",
      skills: ["User research", "Usability testing", "Interaction design", "Wireframing and prototyping", "Design systems", "Figma", "Accessibility (WCAG)", "Information architecture", "Journey mapping", "UX writing", "HTML and CSS basics"]
    },
    sections: [
      {
        heading: "Resume and portfolio work together",
        p: [
          "Recruiters typically read your resume first and decide in under a minute whether to open your portfolio. Put the portfolio link at the top next to your email, and make sure every major project on your resume has a matching case study.",
          "The resume itself should be clean and readable. Visual flair belongs in your portfolio; a resume that is hard to parse or skim hurts more than it helps, even for design roles."
        ]
      },
      {
        heading: "What to include",
        list: [
          "The product type and users: \"patient booking app, 200K monthly users\"",
          "Your methods: interviews, usability testing, prototyping, design systems",
          "Measurable outcomes: completion, task success, support tickets, conversion, build time",
          "Collaboration with product managers, engineers, researchers and stakeholders",
          "Accessibility work, which is increasingly expected"
        ]
      },
      {
        heading: "UX designer keywords for ATS",
        p: [
          "Titles vary widely: UX designer, product designer, UI/UX designer, interaction designer. Use the title from the posting in your headline if it honestly describes your work."
        ],
        list: [
          "User research, usability testing, personas, journey maps, information architecture",
          "Wireframes, prototypes, interaction design, visual design, design systems",
          "Figma, FigJam, Sketch, Adobe XD, Maze, Dovetail",
          "Accessibility, WCAG, responsive design, design thinking"
        ]
      },
      {
        heading: "Mistakes UX designers often make",
        list: [
          "Heavily designed resumes with icons, skill bars and text in images that ATS cannot read",
          "Listing deliverables (wireframes, mockups) without the problem or the result",
          "No portfolio link, or a link that requires a password without saying so",
          "Generic summaries like \"passionate designer who loves users\""
        ]
      },
      {
        heading: "Showing results when you lack hard numbers",
        p: [
          "Design outcomes are not always measured. Use test results (task success, time on task, error rate), qualitative signals (fewer support tickets, stakeholder adoption) or delivery wins (design system adoption, faster handoff). Be honest about which numbers came from testing versus production."
        ]
      }
    ],
    faqs: [
      { q: "Should a UX designer resume be creative?", a: "Keep it clean and well typeset rather than highly decorative. Good hierarchy and spacing show design skill; heavy graphics can break ATS parsing. Save visual storytelling for your portfolio." },
      { q: "How many projects should I mention?", a: "Two to four strong projects across your experience is enough. Each should map to a portfolio case study you can talk about in depth." },
      { q: "Do I need coding skills?", a: "Not usually, but basic HTML and CSS knowledge helps you collaborate with engineers. List it only if you are comfortable discussing it." },
      { q: "What if my projects are under NDA?", a: "Describe the problem and outcome in general terms on the resume, and use anonymised or redacted case studies in your portfolio. Mention that full details can be shared in an interview." }
    ]
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "marketing-manager",
    title: "Marketing Manager Resume Example & Template (2026)",
    description: "Free marketing manager resume example with campaign results, budget ownership and channel keywords recruiters want. Edit and export PDF or Word.",
    h1: "Marketing manager resume example",
    intro: "Marketing managers are hired to grow pipeline and revenue, so your resume should read like a results report. This example shows a B2C and B2B marketing manager with seven years of experience, with advice on presenting budgets, channels and team leadership.",
    template: "Modern Professional",
    sample: {
      name: "Hannah Lewis",
      headline: "Marketing Manager, Demand Generation and Brand",
      summary: "Marketing manager with 7 years leading integrated campaigns across paid, email, content and events. Owns a $1.8M annual budget and a team of 4. Grew marketing-sourced pipeline by 64% year over year while lowering cost per lead by 31%.",
      experience: [
        {
          role: "Marketing Manager",
          company: "Oakridge Home Goods",
          dates: "Jan 2022 - Present",
          bullets: [
            "Own a $1.8M annual budget across paid search, paid social, email and events, growing marketing-sourced pipeline by 64% year over year.",
            "Rebuilt the paid search account structure and landing pages, cutting cost per lead from $58 to $40.",
            "Launched a lifecycle email programme with 12 automated journeys that drives 18% of online revenue.",
            "Hired and manage a team of 4 specialists and 2 agencies, with clear OKRs and monthly reporting to the leadership team."
          ]
        },
        {
          role: "Senior Marketing Specialist",
          company: "Silverline Software",
          dates: "Mar 2018 - Dec 2021",
          bullets: [
            "Ran 3 product launches with sales and product teams, generating 4,200 qualified leads and $1.1M in closed revenue.",
            "Built a content programme of 60 articles and 6 guides that grew organic traffic from 15K to 70K monthly visits.",
            "Set up attribution reporting in the CRM, giving sales and marketing a shared view of pipeline for the first time."
          ]
        }
      ],
      education: "B.A. in Marketing and Communications, Eastgate University, 2017",
      skills: ["Demand generation", "Campaign strategy", "Paid search and paid social", "Email and lifecycle marketing", "SEO and content marketing", "Marketing analytics", "Budget management", "HubSpot", "Salesforce", "Google Analytics 4", "Team leadership", "Brand positioning"]
    },
    sections: [
      {
        heading: "Lead with business results",
        p: [
          "Most marketing resumes list channels and campaigns. Strong ones connect them to pipeline, revenue, customer acquisition cost, or retention. If you can show the budget you managed and what it returned, you are ahead of most applicants.",
          "Be clear about attribution. \"Marketing-sourced pipeline\" and \"influenced revenue\" mean different things, and experienced interviewers will ask how you measured them."
        ]
      },
      {
        heading: "What to include",
        list: [
          "Budget size and channels you owned",
          "Team size, agencies and partners you managed",
          "Key metrics: pipeline, revenue, CAC, cost per lead, conversion, ROAS, retention",
          "Launches, rebrands or programmes you built from scratch",
          "Tools: CRM, marketing automation, analytics and ad platforms"
        ]
      },
      {
        heading: "Marketing manager keywords for ATS",
        list: [
          "Integrated marketing, demand generation, lead generation, go-to-market",
          "Paid media, SEO, content marketing, email marketing, social media, events",
          "Marketing analytics, attribution, A/B testing, conversion rate optimisation",
          "HubSpot, Marketo, Salesforce, Google Ads, Meta Ads, Google Analytics 4"
        ]
      },
      {
        heading: "Mistakes to avoid",
        list: [
          "Vanity metrics like impressions and followers with no link to business results",
          "Listing every channel instead of the ones you drove results in",
          "No mention of budget or team, which hides the scope of your role",
          "A summary that could describe any marketer"
        ]
      },
      {
        heading: "Tailoring for B2B versus B2C",
        p: [
          "B2B roles care about pipeline, sales alignment, account-based marketing and long sales cycles. B2C roles care about customer acquisition cost, lifetime value, retention and brand. Reorder bullets and adjust your summary to emphasise the side the role needs, and use the metrics that company would report to its board."
        ]
      }
    ],
    faqs: [
      { q: "Should I include campaign examples or links?", a: "Add a portfolio link if you have public work such as ads, landing pages or content. Keep the resume itself focused on outcomes, and use the portfolio to show creative quality." },
      { q: "How do I show results if attribution was unclear?", a: "Use the metrics you can defend, such as leads generated, conversion rate changes or cost reductions, and describe them honestly. Saying \"influenced\" rather than \"generated\" is fine when that is accurate." },
      { q: "Is a two-page resume acceptable for a marketing manager?", a: "With 8 or more years of experience, two pages can work. Keep the most impressive results on the first page." },
      { q: "Which certifications are worth listing?", a: "Platform certifications such as Google Ads, HubSpot or analytics tools can help early in your career. For managers, results and team leadership matter more." }
    ]
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "nurse",
    title: "Nurse Resume Example & Template (2026)",
    description: "Free registered nurse resume example with licensure, clinical skills and patient care achievements formatted for hospital ATS. Edit and export PDF or Word.",
    h1: "Registered nurse resume example",
    intro: "Nurse recruiters check licensure and certifications first, then unit experience, then evidence of quality patient care. This example shows a registered nurse with five years of medical-surgical and telemetry experience, followed by advice on presenting clinical skills clearly.",
    template: "ATS Minimal",
    sample: {
      name: "Grace Thompson, RN, BSN",
      headline: "Registered Nurse, Medical-Surgical and Telemetry",
      summary: "Registered nurse with 5 years of experience on 32-bed medical-surgical and telemetry units. Skilled in cardiac monitoring, patient education and EHR documentation. Charge nurse for 2 years and a unit preceptor for 9 new graduates.",
      experience: [
        {
          role: "Registered Nurse, Telemetry",
          company: "St. Clare Regional Medical Center",
          dates: "Jun 2022 - Present",
          bullets: [
            "Provide care for 4-5 telemetry patients per shift, including cardiac rhythm monitoring and titration of medications per protocol.",
            "Serve as charge nurse 2 shifts a week, coordinating 8 nurses and managing admissions, discharges and bed flow.",
            "Precepted 9 new graduate nurses; all completed orientation and 8 remain on the unit after one year.",
            "Led a unit falls-prevention project that reduced patient falls by 40% over 12 months."
          ]
        },
        {
          role: "Registered Nurse, Medical-Surgical",
          company: "Valley Community Hospital",
          dates: "Aug 2020 - May 2022",
          bullets: [
            "Cared for 5-6 post-surgical and medical patients per shift, including wound care, IV therapy and pain management.",
            "Educated patients and families on discharge plans, contributing to a 15% drop in 30-day readmissions for the unit.",
            "Maintained accurate documentation in the EHR, with 100% compliance in quarterly chart audits."
          ]
        }
      ],
      education: "Bachelor of Science in Nursing (BSN), Greenfield University, 2020",
      skills: ["Telemetry and cardiac monitoring", "Medication administration", "IV therapy", "Wound care", "Patient and family education", "Care planning", "EHR documentation (Epic)", "Charge nurse", "Precepting", "BLS and ACLS certified"]
    },
    sections: [
      {
        heading: "Put licences and certifications where they are seen",
        p: [
          "Add your credentials after your name (for example RN, BSN) and include a short licences and certifications section near the top. List your licence type and state or region, and active certifications such as BLS, ACLS, PALS or specialty certifications with their expiry dates if the employer asks for them.",
          "Many hospital applicant systems filter on these terms, so spell them out once in full and once as the abbreviation, such as \"Advanced Cardiovascular Life Support (ACLS)\"."
        ]
      },
      {
        heading: "Describe your units and patient load",
        p: [
          "Nurse managers want to know where you have worked and at what intensity. State the unit type, bed count, typical patient ratio and patient population. These details help a manager picture you on their unit immediately."
        ],
        list: [
          "Unit type: ICU, ED, med-surg, telemetry, labour and delivery, paediatrics, OR",
          "Patient ratio and acuity",
          "Specialist procedures and equipment you are competent with",
          "EHR systems used"
        ]
      },
      {
        heading: "Show quality and leadership",
        p: [
          "Beyond tasks, show outcomes: lower falls or infection rates, better patient satisfaction scores, quality improvement projects, charge nurse duties, precepting and committee work. These separate a strong candidate from someone who lists job duties."
        ]
      },
      {
        heading: "Nursing keywords for ATS",
        list: [
          "Patient assessment, care planning, medication administration, patient education",
          "Specialty terms from the posting, such as telemetry, critical care or triage",
          "BLS, ACLS, PALS, NIHSS, TNCC and other required certifications",
          "EHR names such as Epic or Cerner, and quality terms such as infection control"
        ]
      },
      {
        heading: "Common mistakes",
        list: [
          "Missing or hard-to-find licence information",
          "Copying a job description of duties without any outcomes",
          "Using patient identifiers or confidential details, even in passing",
          "Leaving out clinical rotations if you are a new graduate"
        ]
      }
    ],
    faqs: [
      { q: "How should new graduate nurses format their resume?", a: "Put education and licensure first, then clinical rotations with unit type and hours, then any healthcare jobs such as CNA or patient care technician work. Include your capstone or preceptorship unit in detail." },
      { q: "Should I list my licence number?", a: "Many nurses list the licence type, state or region and expiry rather than the full number. Employers verify it during hiring, so follow the application's instructions." },
      { q: "Is a one-page nursing resume enough?", a: "For most nurses with under 10 years of experience, yes. Experienced nurses with leadership, education or multiple specialties may use two pages." },
      { q: "Should I include soft skills?", a: "Show them through examples, such as patient education or precepting, rather than listing words like compassionate. Bullets with context are more convincing." }
    ]
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "teacher",
    title: "Teacher Resume Example & Template (2026)",
    description: "Free teacher resume example with certification, classroom results and curriculum keywords that school recruiters look for. Edit the template and export.",
    h1: "Teacher resume example",
    intro: "School leaders reading teacher resumes look for certification, subject and grade fit, and evidence that students learned more in your classroom. This example shows a middle school maths teacher with six years of experience, followed by advice for every stage of a teaching career.",
    template: "Timeline",
    sample: {
      name: "Marcus Bennett",
      headline: "Middle School Mathematics Teacher, Grades 6-8",
      summary: "Certified mathematics teacher with 6 years of experience teaching grades 6-8 in diverse, inclusive classrooms. Raised the share of students meeting grade-level standards from 54% to 71% in two years and leads the school's maths department of 5 teachers.",
      experience: [
        {
          role: "Mathematics Teacher and Department Lead",
          company: "Maple Grove Middle School",
          dates: "Aug 2021 - Present",
          bullets: [
            "Teach 5 classes of grades 7-8 maths (140 students), including an advanced pre-algebra section.",
            "Raised the share of students meeting grade-level standards on state assessments from 54% to 71% in two years using small-group intervention and weekly formative checks.",
            "Lead a department of 5 teachers, coordinating curriculum mapping and common assessments.",
            "Started an after-school maths club that grew from 8 to 45 students and placed second in the regional competition."
          ]
        },
        {
          role: "Mathematics Teacher",
          company: "Brookside Academy",
          dates: "Aug 2019 - Jun 2021",
          bullets: [
            "Taught grade 6 maths to 4 classes, adapting lessons for 18 students with IEPs and 12 multilingual learners.",
            "Moved instruction fully online within one week in 2020, maintaining 92% weekly attendance.",
            "Built a shared bank of 120 differentiated tasks used by all grade 6 teachers."
          ]
        }
      ],
      education: "M.Ed. in Curriculum and Instruction, Northbridge University, 2021; B.Sc. Mathematics, 2019",
      skills: ["Lesson planning", "Differentiated instruction", "Formative assessment", "Classroom management", "IEP and 504 accommodations", "Data-driven instruction", "Google Classroom", "Parent communication", "Curriculum design", "Teaching certificate: Mathematics 5-9"]
    },
    sections: [
      {
        heading: "Start with certification and teaching focus",
        p: [
          "Put your teaching certification, subject and grade range near the top, in the headline or a short credentials section. Many districts screen for certification area first, so make it impossible to miss.",
          "If you are certified in multiple subjects or regions, list each one, along with endorsements such as special education or English as an additional language."
        ]
      },
      {
        heading: "Show student outcomes",
        p: [
          "The strongest teacher resumes show measurable student growth: assessment results, reading levels, attendance, pass rates or participation. Where numbers are not available, describe concrete changes, such as new programmes, curriculum you wrote, or improved behaviour systems."
        ],
        list: [
          "Class sizes, grade levels and number of students",
          "Assessment improvements and how you achieved them",
          "Support for students with IEPs, 504 plans or language needs",
          "Leadership: department head, mentor, committee, coaching or clubs"
        ]
      },
      {
        heading: "Teacher keywords for ATS",
        list: [
          "Lesson planning, curriculum development, differentiated instruction",
          "Classroom management, formative and summative assessment",
          "Inclusive education, IEP, special educational needs, multilingual learners",
          "Educational technology: Google Classroom, learning management systems, interactive whiteboards"
        ]
      },
      {
        heading: "Mistakes to avoid",
        list: [
          "A list of generic duties such as \"planned lessons and graded work\"",
          "Burying certification at the bottom of page two",
          "Using student names or identifying details",
          "Long objectives instead of a short, specific summary"
        ]
      },
      {
        heading: "New teachers and career changers",
        p: [
          "If you are a new teacher, describe student teaching placements like jobs: school, grade, subject, number of students, and what you taught and achieved. Career changers should connect previous work, such as training colleagues, tutoring or technical expertise, to classroom skills, and highlight the subject knowledge they bring."
        ]
      }
    ],
    faqs: [
      { q: "Should a teacher resume include a teaching philosophy?", a: "Not on the resume itself. Keep a one or two line summary instead, and save your philosophy for the cover letter or interview, unless the application asks for it." },
      { q: "How long should a teacher resume be?", a: "One to two pages. New teachers should aim for one; experienced teachers with leadership roles can use two." },
      { q: "Do I need to include test scores?", a: "Include them if they show growth and you can share them. Otherwise, use other outcomes such as reading level gains, attendance or programmes you built." },
      { q: "Should I list extracurricular activities?", a: "Yes. Coaching, clubs and committees show commitment to the school community, which hiring panels value." }
    ]
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "accountant",
    title: "Accountant Resume Example & Template (2026)",
    description: "Free accountant resume example with month-end close, audit and ERP keywords, plus tips for showing accuracy and savings. Edit and export as PDF or Word.",
    h1: "Accountant resume example",
    intro: "Accounting managers want to see accuracy, reliability and process improvement. This example shows a staff accountant moving into a senior role, with advice on presenting month-end close, reconciliations, audits and systems work.",
    template: "Executive",
    sample: {
      name: "Aisha Khan, CPA",
      headline: "Senior Accountant, Financial Reporting and Close",
      summary: "CPA with 5 years of experience in general ledger, month-end close and financial reporting for a $90M manufacturing business. Shortened the close from 10 to 6 business days and led two clean external audits with no material adjustments.",
      experience: [
        {
          role: "Senior Accountant",
          company: "Ironbridge Manufacturing",
          dates: "Feb 2023 - Present",
          bullets: [
            "Lead month-end close for 3 entities, shortening the close from 10 to 6 business days through standardised checklists and automated accruals.",
            "Prepare monthly financial statements and variance analysis for the CFO and board, explaining changes over 5% to budget.",
            "Coordinated two external audits with no material adjustments and reduced audit requests by 30% with a shared document library.",
            "Implemented automated bank reconciliations in the ERP, saving about 25 hours a month."
          ]
        },
        {
          role: "Staff Accountant",
          company: "Coastal Services Group",
          dates: "Jul 2020 - Jan 2023",
          bullets: [
            "Managed accounts payable and receivable for 400+ vendors and customers, reducing days sales outstanding from 52 to 41.",
            "Reconciled 35 balance sheet accounts monthly and resolved $210K of aged discrepancies.",
            "Supported the migration from spreadsheets to a cloud ERP, mapping the chart of accounts and testing reports."
          ]
        }
      ],
      education: "B.Com. in Accounting, Harrowgate University, 2020; Certified Public Accountant (CPA), 2022",
      skills: ["Month-end close", "General ledger", "Financial reporting (GAAP)", "Account reconciliations", "Accruals and prepayments", "Variance analysis", "External audit support", "Accounts payable and receivable", "NetSuite", "Excel (advanced)", "Internal controls"]
    },
    sections: [
      {
        heading: "What accounting hiring managers look for",
        p: [
          "Accounting roles reward reliability. Hiring managers look for clean audits, a fast and accurate close, strong controls, and a track record of improving processes. Your resume should make these visible with numbers: days to close, accounts reconciled, audit findings, hours saved or errors reduced.",
          "Say which standards and systems you work with, such as GAAP or IFRS and the ERP name, because switching costs are real and employers prefer people who already know their stack."
        ]
      },
      {
        heading: "What to include",
        list: [
          "Credentials after your name and in the education section (CPA, CA, ACCA, CMA)",
          "Size of the business: revenue, entities, transactions or accounts",
          "Close, reporting, reconciliation, tax or audit responsibilities",
          "Systems: ERP, consolidation tools and Excel skills",
          "Process improvements with time or cost saved"
        ]
      },
      {
        heading: "Accountant keywords for ATS",
        list: [
          "General ledger, journal entries, month-end and year-end close",
          "Account reconciliation, accruals, fixed assets, revenue recognition",
          "GAAP, IFRS, SOX compliance, internal controls, audit",
          "NetSuite, SAP, Oracle, QuickBooks, Xero, Excel (pivot tables, XLOOKUP, Power Query)"
        ]
      },
      {
        heading: "Mistakes to avoid",
        list: [
          "Typos or inconsistent number formats, which undermine the accuracy you claim",
          "Listing duties without the scale of the business or the results",
          "Omitting the ERP or accounting software you used",
          "Hiding a professional qualification in progress; list it with the expected date"
        ]
      },
      {
        heading: "Tailoring by accounting path",
        p: [
          "For public accounting roles, emphasise client industries, audit or tax engagements and team leadership. For corporate roles, emphasise close, reporting, forecasting and systems. If you are moving toward financial analysis, add bullets on budgeting, forecasting and business partnering."
        ]
      }
    ],
    faqs: [
      { q: "Should I list a CPA exam in progress?", a: "Yes. Write \"CPA candidate\" and the sections passed, or the expected completion date. It shows commitment and is often a screening factor." },
      { q: "How important is Excel on an accountant resume?", a: "Very. Name specific skills such as pivot tables, XLOOKUP, Power Query or macros instead of just Excel, and show them in a bullet if possible." },
      { q: "Should I include my GPA?", a: "Include it for entry-level roles if it is strong, especially for public accounting recruiting. Remove it after a few years of experience." },
      { q: "Is a one-page resume enough for an accountant?", a: "For most accountants with under 10 years of experience, yes. Controllers and finance managers may use two pages." }
    ]
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "fresher",
    title: "Fresher Resume Example: No Experience Template (2026)",
    description: "Free fresher resume example for students and graduates with no experience: projects, internships and skills that get interviews. Edit and export PDF.",
    h1: "Fresher resume example (no experience)",
    intro: "A fresher resume has to prove potential without a long work history. The trick is to treat projects, internships, coursework and activities as real experience, written with the same action and result structure. This example shows a recent computer science graduate applying for entry-level roles.",
    template: "Compact",
    sample: {
      name: "Arjun Mehta",
      headline: "Computer Science Graduate, Entry-Level Software Developer",
      summary: "Recent computer science graduate with internship experience in web development and two shipped projects with real users. Comfortable with JavaScript, React and SQL, and quick to learn new tools. Looking for an entry-level developer role in a product team.",
      experience: [
        {
          role: "Software Development Intern",
          company: "Greenlight Digital",
          dates: "Jan 2026 - Jun 2026",
          bullets: [
            "Built 6 reusable React components for a client dashboard, reviewed and merged into production by the senior team.",
            "Fixed 25 reported bugs in a customer portal, reducing open issues in the team backlog by 30%.",
            "Wrote unit tests that raised test coverage of the billing module from 40% to 72%."
          ]
        },
        {
          role: "Final Year Project: Campus Events App",
          company: "Riverside Institute of Technology",
          dates: "Aug 2025 - May 2026",
          bullets: [
            "Led a team of 3 to build a web app for campus event listings using React, Node.js and PostgreSQL.",
            "Launched to students and reached 1,100 registered users and 60 student clubs within one semester.",
            "Added search and calendar sync after surveying 80 users, increasing weekly active users by 35%.",
            "Graded A and selected for the department's annual project showcase."
          ]
        }
      ],
      education: "B.Tech in Computer Science, Riverside Institute of Technology, 2026, CGPA 8.4/10",
      skills: ["JavaScript", "React", "Node.js", "SQL (PostgreSQL)", "Python", "Git and GitHub", "HTML and CSS", "REST APIs", "Unit testing", "Teamwork and communication"]
    },
    sections: [
      {
        heading: "What to include when you have no experience",
        p: [
          "Order your sections by strength. For most freshers this means education first, then internships, then projects, then skills, then activities and achievements. If your projects are stronger than your internship, put projects first.",
          "Keep it to one page. Recruiters screening entry-level candidates spend very little time on each resume, so every line should earn its place."
        ],
        list: [
          "Education: degree, institution, graduation year and grade if it is strong",
          "Internships, part-time jobs and freelance work, even if short",
          "Academic and personal projects with links",
          "Skills that match the job description",
          "Leadership: clubs, events, volunteering, competitions and hackathons"
        ]
      },
      {
        heading: "Turn projects into experience",
        p: [
          "Write project bullets exactly like work bullets: what you built, the tools you used, and what happened. Numbers still matter. Users, downloads, team size, performance improvements or grades all show results. A project with 50 real users is more convincing than a tutorial clone with a long feature list."
        ]
      },
      {
        heading: "Write a short, specific summary",
        p: [
          "Skip the generic objective (\"seeking a challenging role to grow my skills\"). In two to three lines, state your degree, your strongest skills and the type of role you want. Recruiters read many identical objectives, so specificity stands out."
        ]
      },
      {
        heading: "Fresher resume mistakes",
        list: [
          "Personal details that are not needed, such as date of birth, marital status or full address, unless required locally",
          "Listing school-level marks once you have a degree, unless the employer asks for them",
          "Long lists of soft skills with no evidence",
          "A photo, unless it is standard in your country or the posting asks for one",
          "Using the same resume for every application"
        ]
      },
      {
        heading: "Keywords and tailoring",
        p: [
          "Read the job description and mirror its exact skill names in your skills section and bullets, as long as they are true. Applicant tracking systems match terms literally, so \"React.js\" in the posting and \"React\" on your resume may both be worth including. Create a short version for each role type you apply for, such as developer, analyst or support."
        ]
      }
    ],
    faqs: [
      { q: "Can I make a resume with no experience at all?", a: "Yes. Use education, projects, coursework, volunteering, part-time jobs, competitions and certifications. Write each one with what you did and what it achieved, the same as work experience." },
      { q: "Should a fresher resume include hobbies?", a: "Only if they are relevant or show something useful, such as running a club, competing in hackathons or writing a blog. A line of generic hobbies rarely helps." },
      { q: "Should I include my CGPA or percentage?", a: "Include it if it is strong or if the employer has a cut-off. If it is low, leave it out and let projects and skills speak." },
      { q: "How long should a fresher resume be?", a: "One page. Freshers rarely have enough relevant content to justify more, and a tight page reads as confident and focused." }
    ]
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "sales-representative",
    title: "Sales Representative Resume Example & Template (2026)",
    description: "Free sales representative resume example with quota attainment, pipeline numbers and CRM keywords that sales managers screen for. Edit and export free.",
    h1: "Sales representative resume example",
    intro: "Sales is the most numbers-driven resume there is. Sales managers want to see quota attainment, deal sizes, pipeline built and rankings, and they want them in the first few seconds. This example shows an account executive with four years of B2B sales experience.",
    template: "Navy Sidebar",
    sample: {
      name: "Jordan Reyes",
      headline: "Account Executive, B2B SaaS Sales",
      summary: "Account executive with 4 years of B2B sales experience and a record of exceeding quota. Closed $1.4M in new business in 2025 at 128% of quota, ranked #2 of 18 reps. Skilled in full-cycle sales from prospecting to negotiation, with a consultative approach.",
      experience: [
        {
          role: "Account Executive",
          company: "Clearpath Systems",
          dates: "Mar 2023 - Present",
          bullets: [
            "Closed $1.4M in new annual contract value in 2025, 128% of quota, ranking #2 of 18 account executives.",
            "Built 60% of own pipeline through outbound prospecting, averaging 22 qualified meetings a month.",
            "Shortened the average sales cycle from 74 to 55 days by introducing mutual action plans with buyers.",
            "Won the company's largest mid-market deal of the year at $180K ACV."
          ]
        },
        {
          role: "Sales Development Representative",
          company: "Brightway Software",
          dates: "Jun 2021 - Feb 2023",
          bullets: [
            "Booked 340 qualified meetings over 18 months, averaging 115% of monthly target.",
            "Generated $2.1M in pipeline, with $640K closed by account executives.",
            "Promoted to account executive after 18 months, ahead of the typical 24-month path."
          ]
        }
      ],
      education: "B.B.A. in Business Administration, Southport University, 2021",
      skills: ["Full-cycle B2B sales", "Prospecting and cold outreach", "Discovery and qualification (MEDDIC)", "Negotiation and closing", "Pipeline management", "Salesforce", "HubSpot", "Sales Navigator", "Forecasting", "Product demos"]
    },
    sections: [
      {
        heading: "Lead with your numbers",
        p: [
          "Sales managers are looking for proof you can hit a target. Put quota attainment, revenue closed and rankings in your summary and at the top of each role. Include the period and the comparison, such as \"128% of quota in 2025, #2 of 18 reps\", so the number is meaningful.",
          "If you missed quota in a year, focus on other honest strengths for that period, such as pipeline built, deal sizes, win rate or the reason (for example a territory change) if relevant. Never inflate figures; references and payslips can be checked."
        ]
      },
      {
        heading: "What to include",
        list: [
          "Quota attainment and revenue closed by year",
          "Rankings and awards such as President's Club",
          "Deal size, sales cycle length and win rate",
          "Customer segment and territory: SMB, mid-market, enterprise, region",
          "Product type and sales motion: inbound, outbound, field or inside sales"
        ]
      },
      {
        heading: "Sales keywords for ATS",
        list: [
          "Quota attainment, pipeline generation, prospecting, cold calling, lead qualification",
          "Account management, upselling, cross-selling, customer retention, renewals",
          "Negotiation, closing, consultative selling, solution selling, MEDDIC, SPIN",
          "Salesforce, HubSpot, Outreach, Salesloft, LinkedIn Sales Navigator"
        ]
      },
      {
        heading: "Common sales resume mistakes",
        list: [
          "No numbers, or numbers without context like the quota or the team size",
          "Describing activities (calls made) without outcomes (meetings, revenue)",
          "Leaving out the type of customer and deal size",
          "Long paragraphs that hide the key figures"
        ]
      },
      {
        heading: "Moving into sales from another field",
        p: [
          "Customer service, retail, hospitality and recruitment all build relevant skills. Highlight targets you hit, customers you retained, upsells, and any experience persuading or negotiating. Entry-level sales development roles care most about drive, coachability and communication, so show evidence of each."
        ]
      }
    ],
    faqs: [
      { q: "Should I include quota numbers if I missed target?", a: "Be honest. If you missed quota, lead with other strong metrics such as pipeline generated, win rate or deal size, and be ready to explain the context in the interview." },
      { q: "Is it okay to list President's Club or awards?", a: "Yes. Awards and rankings are strong signals in sales; list them under the relevant role or in a short achievements section." },
      { q: "How do I show sales skills without a sales job?", a: "Use targets met, revenue or upsells from retail or service roles, fundraising, or customer retention. Describe them with numbers, just like a sales bullet." },
      { q: "Should a sales resume be one page?", a: "Usually yes. Sales managers value clarity and speed; a concise page with clear numbers makes the strongest impression." }
    ]
  }
];
