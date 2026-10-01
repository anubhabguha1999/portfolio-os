/**
 * Long-form guides rendered by scripts/prerender.mjs as static pages under /guides/<slug>.
 * Plain text only: the generator escapes and wraps every string.
 */
export default [
  {
    slug: "how-to-make-a-portfolio-website",
    title: "How to Make a Portfolio Website (Step-by-Step Guide)",
    description: "A practical guide to building a portfolio website that gets you hired: choosing projects, writing case studies, structure, design, domains and hosting.",
    h1: "How to make a portfolio website that gets you hired",
    intro: "A portfolio website is the one place where you control how your work is presented. The best ones are not the flashiest: they are focused, fast, easy to scan and built around a few projects explained well. This guide walks through the whole process, from choosing what to show to putting the site live on your own domain.",
    steps: [
      { name: "Define who the portfolio is for", text: "Write down the role, seniority and type of company you want next. Every decision about projects, wording and design should serve that reader, not everyone." },
      { name: "Pick three to six of your strongest projects", text: "Choose work that matches the job you want, shows a range of skills and has an outcome you can describe. Cut anything you would not want to talk about in an interview." },
      { name: "Write a short case study for each project", text: "Cover the problem, your role, the constraints, what you did, and the result. Lead with one strong image or demo and keep each case study readable in two minutes." },
      { name: "Plan the page structure", text: "A clear home page with a one-line positioning statement, a work section, an about section and an obvious way to contact you is enough for most people." },
      { name: "Choose a template or design system and keep it simple", text: "Pick a layout that puts the work first, use one or two typefaces, a restrained colour palette and generous spacing. Check it on a phone before anything else." },
      { name: "Write your about section and contact details", text: "Explain what you do, who you do it for and what you are looking for now, in plain language. Add an email address, LinkedIn or GitHub, and a downloadable resume." },
      { name: "Publish, test and share it", text: "Export the site, host it on a static host, connect a custom domain, test speed and links, then put the URL on your resume, email signature and profiles." }
    ],
    sections: [
      {
        heading: "Start with the reader, not the design",
        p: [
          "Recruiters and hiring managers often spend less than a minute on a portfolio before deciding whether to look deeper. In that time they want to answer three questions: what do you do, are you good at it, and are you relevant to the role they are hiring for. A portfolio that answers those questions quickly will beat a beautiful one that hides the answers behind animation or a vague tagline.",
          "Before you open any builder, write a single sentence that describes you to your target reader, for example 'Product designer focused on B2B onboarding and design systems' or 'Backend engineer who builds reliable payment and data pipelines'. That sentence becomes your headline and the filter for every project you include."
        ]
      },
      {
        heading: "Choosing projects: quality over quantity",
        p: [
          "Three excellent, well-explained projects are more persuasive than twelve thumbnails. Hiring teams read portfolios to understand how you think, and they can only do that when there is enough detail to follow your decisions.",
          "If you are early in your career and lack client work, self-initiated projects are fine as long as you treat them seriously: define a real problem, set constraints, and show what you learned. Redesigning a well-known app with no constraints or research tends to read as an exercise; solving a specific problem for a local business, open-source project or community group reads as real work."
        ],
        list: [
          "Relevance: does this project resemble the work you want to be hired for?",
          "Ownership: can you clearly explain which parts you personally did?",
          "Outcome: is there a result, metric, shipped product or lesson you can point to?",
          "Range: together, do the projects show different skills rather than the same one repeated?",
          "Permission: are you allowed to show it? Use anonymised or redacted versions of work under NDA."
        ]
      },
      {
        heading: "How to write a case study people actually read",
        p: [
          "A good case study is a short story with evidence. Open with a one-paragraph summary: the client or context, the problem, your role and the outcome. Many readers stop there, so make it complete on its own.",
          "Then expand in the order a curious reader would ask questions: what made the problem hard, what options you considered, why you chose the approach you did, and what happened after launch. Use headings so people can skim, keep paragraphs short, and put an image, diagram, code snippet or metric next to each claim. Quantify results where you honestly can, such as conversion up 12 percent, build time halved, or support tickets reduced, and say how you measured them.",
          "For developers, a live demo link and a link to the repository are worth more than screenshots. Make sure the README explains how to run the project and what you would improve with more time."
        ]
      },
      {
        heading: "Structure and design that put the work first",
        p: [
          "Most strong portfolios share the same simple structure: a home page with your headline and selected work, one page per case study, an about section, and contact details that are visible without hunting. Navigation should have no more than four or five items.",
          "Design choices should support reading. Use a comfortable body text size of at least 16 pixels, high contrast between text and background, and consistent spacing. Limit yourself to one or two typefaces. Images should be compressed and sized correctly so pages load quickly on mobile data, because a slow portfolio is often closed before it renders. If you are a designer, the portfolio itself is a work sample, so attention to detail matters, but clarity still wins over novelty.",
          "Templates are a sensible starting point for most people. Portfolio OS, for example, includes portfolio templates for developers, designers, writers and consultants with light and dark themes, so you can focus on content and adjust colours, fonts and spacing later."
        ]
      },
      {
        heading: "Your about section and contact details",
        p: [
          "The about section is where a hiring manager decides whether they would enjoy working with you. Write it in the first person, in plain language, and cover what you do, the kinds of problems you like, relevant experience or industries, and what you are looking for now. A friendly, professional photo helps people remember you but is optional.",
          "Make contacting you effortless. Show an email address as text, not only a contact form, and link to LinkedIn, GitHub, Dribbble or other profiles that support your work. Offer your resume as a PDF download and keep it consistent with the portfolio: the same job titles, dates and project names."
        ]
      },
      {
        heading: "Domains, hosting and publishing",
        p: [
          "A custom domain such as yourname.com looks professional and stays with you if you change tools. Domains typically cost around 10 to 20 US dollars a year. A portfolio is usually a static site, so it can be hosted for free or very cheaply on static hosts such as GitHub Pages, Netlify, Vercel or Cloudflare Pages.",
          "If your builder can export a plain HTML site or a ZIP of static files, you are never locked in: you can upload the files to any host, keep a backup, and move later. Portfolio OS exports standalone HTML, a ZIP website, or Next.js and Vite source code, and it runs in the browser with no sign-up.",
          "Before sharing the link, test every page on a phone and a laptop, click every link, check that images load, and run a speed test such as Google PageSpeed Insights. Add a page title and meta description so the site looks good when shared and appears properly in search results."
        ]
      },
      {
        heading: "Keep it current",
        p: [
          "Set a reminder to review your portfolio every few months. Swap in stronger projects as you finish them, remove ones that no longer represent your level, and update your headline when your goals change. A portfolio with a recent project and a current job title signals that you are active and serious."
        ]
      }
    ],
    faqs: [
      { q: "How many projects should a portfolio website have?", a: "Three to six well-explained projects is the right range for most people. Fewer, deeper case studies are more convincing than a long grid of thumbnails, because reviewers want to understand your process and results." },
      { q: "Do I need to know how to code to make a portfolio website?", a: "No. Template-based builders let you create and export a complete site without writing code. Developers may still prefer to customise the exported source code, which is easier when the builder exports clean HTML or a framework project." },
      { q: "Should my portfolio include my resume?", a: "Yes. Link a downloadable PDF resume from the header or about page and keep its job titles, dates and project names consistent with the portfolio." },
      { q: "How much does it cost to host a portfolio website?", a: "Hosting a static portfolio can be free on services such as GitHub Pages, Netlify, Vercel or Cloudflare Pages. A custom domain usually costs about 10 to 20 US dollars per year." },
      { q: "Can I show work that is under an NDA?", a: "Only with permission. Common approaches are to anonymise the client, blur or redact sensitive details, recreate representative screens, or describe the process and results in words while offering to walk through more in an interview." }
    ]
  },
  {
    slug: "ats-friendly-resume",
    title: "How to Write an ATS-Friendly Resume (2026 Guide)",
    description: "How applicant tracking systems read resumes and how to format yours so it parses correctly: layout, headings, keywords, file types and common mistakes.",
    h1: "How to write an ATS-friendly resume",
    intro: "Most medium and large employers collect applications through an applicant tracking system (ATS) such as Workday, Greenhouse, Lever, iCIMS or Taleo. The ATS turns your resume into structured fields and lets recruiters search and filter candidates, so a resume that parses badly can hide your experience even when you are qualified. This guide explains what actually happens to your resume and how to format it so both software and people can read it.",
    sections: [
      {
        heading: "What an ATS actually does with your resume",
        p: [
          "When you upload a resume, the ATS extracts the text and tries to identify sections and fields: your name and contact details, job titles, employers, dates, education and skills. That parsed data populates your candidate profile, which recruiters search with keywords and filters such as job title, location or years of experience.",
          "A common myth is that a robot automatically rejects most resumes. In practice, many systems do not auto-reject on formatting alone; rejections usually come from knockout questions in the application form (such as work authorisation or required certifications) or from a recruiter who never finds your profile because the important information was not parsed or did not match their search. The goal of ATS-friendly formatting is simply to make sure your real experience lands in the right fields and contains the words a recruiter will search for."
        ]
      },
      {
        heading: "Layout rules that help parsing",
        p: [
          "Parsers read text in order, and they are much more reliable with a simple, single-column layout. Complex layouts can scramble the reading order so that dates attach to the wrong job or skills merge into your job descriptions."
        ],
        list: [
          "Use a single-column layout for the main content. Two-column designs often parse correctly in modern systems but are a common source of jumbled text in older ones.",
          "Avoid tables and text boxes for core content. Many parsers skip text inside text boxes and read table cells in an unexpected order.",
          "Keep your name and contact details in the body of the document, not in the header or footer, because some parsers ignore header and footer regions.",
          "Do not put important text inside images, icons, charts or skill bars. Text in graphics cannot be extracted at all.",
          "Use standard bullet points rather than unusual symbols, and avoid placing information only in colour or font styling.",
          "Stick to common fonts such as Arial, Calibri, Georgia, Garamond or Helvetica at 10 to 12 points for body text."
        ]
      },
      {
        heading: "Use standard section headings",
        p: [
          "Parsers look for familiar headings to decide where each section starts. Creative labels like 'Where I have been' or 'My toolbox' can cause a section to be missed or misfiled. Use plain headings such as Summary, Experience or Work Experience, Education, Skills, Projects, Certifications and Volunteer Experience.",
          "Within the Experience section, keep a consistent pattern for every role: job title, employer, location (optional), and dates. Put dates in a consistent format such as 'Mar 2022 – Present' or '03/2022 – Present' so the system can calculate tenure. Avoid writing only the year for some roles and the full month for others."
        ]
      },
      {
        heading: "Keywords: match the job without stuffing",
        p: [
          "Recruiters search the ATS for skills, tools, certifications and job titles taken from the job description. If the posting asks for 'project management' and 'Jira' and your resume says 'led delivery' and 'ticketing tools', a keyword search may not surface you.",
          "Read the job description and list the hard skills, tools, qualifications and responsibilities it repeats. Then make sure the ones you genuinely have appear in your resume in the same wording, ideally in context within your experience bullets as well as in the skills section. Include both an acronym and its full form the first time, such as 'Search Engine Optimization (SEO)', because recruiters may search either.",
          "Do not paste the job description in white text or repeat keywords unnaturally. Recruiters read the parsed text, hidden text is easy to spot, and keyword stuffing makes an otherwise strong resume look untrustworthy."
        ]
      },
      {
        heading: "PDF or Word: which file type to upload",
        p: [
          "Follow the employer's instructions first. If they ask for a .docx file, send one. Otherwise, a text-based PDF exported from a word processor or resume builder parses well in nearly all modern ATS platforms and preserves your layout exactly. A .docx file is the safest choice for older systems and recruitment agencies that edit resumes.",
          "Never upload a scanned image or a PDF made by printing a picture of your resume: if you cannot select and copy the text in the PDF, the ATS cannot read it either. A quick test is to open the PDF, select all, copy and paste into a plain text editor. If the text comes out in the right order with your sections intact, it will usually parse well.",
          "Portfolio OS exports resumes as text-based PDF, editable Word (DOCX) and plain text, and its 12 templates include an ATS Minimal design plus ATS and content checks for headings, dates, length and keywords."
        ]
      },
      {
        heading: "Common ATS mistakes to avoid",
        p: [
          "Most parsing problems come from a handful of habits. Fixing them takes minutes and makes your resume easier for people to read too."
        ],
        list: [
          "Contact details placed only in the document header or footer",
          "Skills shown as star ratings, progress bars or logos instead of words",
          "Job titles and dates in a separate column from the descriptions they belong to",
          "Unusual section names or no section headings at all",
          "Inconsistent or missing dates, or dates written only as seasons",
          "File names like resume_final_v7.pdf instead of Firstname-Lastname-Resume.pdf",
          "Submitting the same untailored resume to every job"
        ]
      },
      {
        heading: "Write for the human who reads it next",
        p: [
          "An ATS only gets you into the shortlist; a person makes the decision. Once the format is clean, focus on content: start each bullet with a strong verb, describe the result rather than the duty, and add numbers where you can. 'Reduced monthly cloud costs by 18 percent by right-sizing database instances' is both keyword-rich and persuasive.",
          "Keep the resume to one page for early-career roles and up to two pages for experienced candidates, and put the most relevant experience near the top where both parsers and people pay the most attention."
        ]
      }
    ],
    faqs: [
      { q: "Can an ATS read a PDF resume?", a: "Yes. Modern applicant tracking systems read text-based PDFs reliably. Avoid scanned or image-only PDFs, and send a Word document if the employer specifically requests one." },
      { q: "Are two-column resumes bad for ATS?", a: "Not always, but they are riskier. Some parsers read across both columns line by line and mix up the content. A single-column layout is the safest choice when applying through an online portal." },
      { q: "Does an ATS automatically reject resumes?", a: "Usually not because of formatting alone. Automatic rejections typically come from knockout questions in the application form. Poor formatting mainly hurts by making your experience harder for recruiters to find and read." },
      { q: "How do I check if my resume is ATS-friendly?", a: "Copy all the text from your PDF and paste it into a plain text editor. If your name, contact details, job titles, dates and sections appear in the right order, the resume will parse well in most systems. Resume checkers can also flag missing headings and keywords." },
      { q: "Should I use the exact keywords from the job description?", a: "Yes, for skills and qualifications you genuinely have. Use the same wording the posting uses, include acronyms alongside their full forms, and work keywords into your experience bullets rather than only listing them." }
    ]
  },
  {
    slug: "how-to-write-a-cover-letter",
    title: "How to Write a Cover Letter That Gets Interviews",
    description: "A step-by-step guide to writing a cover letter: structure, opening lines, what to include, length, tone and examples of strong paragraphs.",
    h1: "How to write a cover letter that gets read",
    intro: "A cover letter is your chance to connect your experience to a specific job and to show why you want it. Not every hiring manager reads them, but the ones who do often use them to decide between similar candidates, and some employers require one. This guide covers a simple structure you can reuse, with advice on what to include and what to leave out.",
    steps: [
      { name: "Research the company and the role", text: "Read the job description, the company's website, recent news and the team's work. Note two or three specific things that genuinely interest you and the main problems the role is meant to solve." },
      { name: "Address the letter to a person", text: "Find the hiring manager's name on the job post, LinkedIn or the company site. If you cannot find one, use 'Dear Hiring Manager' or 'Dear [Team name] team' rather than 'To whom it may concern'." },
      { name: "Open with the role and a strong reason", text: "In two or three sentences, name the position, say why you want it, and give the single most relevant reason you are a strong fit." },
      { name: "Prove your fit with one or two examples", text: "Pick the requirements that matter most and show, with a concrete example and a result, that you have done this kind of work before." },
      { name: "Explain why this company", text: "Show you understand what the company does and connect it to your experience or motivation in a specific, sincere way." },
      { name: "Close with a clear next step", text: "Thank the reader, restate your interest briefly and say you would welcome the chance to discuss the role. Sign off with your name and contact details." },
      { name: "Edit, proofread and export", text: "Cut it to under a page, read it aloud, check the company and person's names, and save it as a PDF unless the employer asks for another format." }
    ],
    sections: [
      {
        heading: "What a cover letter is for",
        p: [
          "Your resume lists what you have done; the cover letter explains why it matters for this particular job. It is the right place to connect experience from different roles, explain a career change or a gap, mention a referral, and show enthusiasm that a list of bullet points cannot.",
          "Think of it as a short, focused argument: you understand what this team needs, you have done similar work, and you want to do it here. Everything in the letter should support one of those three points."
        ]
      },
      {
        heading: "A simple cover letter structure",
        p: [
          "Most effective cover letters follow the same four-part pattern and fit comfortably on one page, typically 250 to 400 words."
        ],
        list: [
          "Header: your name, email, phone, city and portfolio or LinkedIn link, followed by the date and the employer's details if you are sending a formal letter.",
          "Opening paragraph: the role, why you want it, and your strongest qualification in one sentence.",
          "Body, one or two paragraphs: specific examples that prove you can meet the key requirements, with results.",
          "Company paragraph: why this organisation, in a way that could not be copied into another letter.",
          "Closing: a thank you, a confident line about next steps, and a professional sign-off such as 'Kind regards' or 'Sincerely'."
        ]
      },
      {
        heading: "Writing an opening that earns the next paragraph",
        p: [
          "Skip 'I am writing to apply for' and generic statements about being hard-working. Lead with something specific: a result that matches the role, a connection to the company, or the problem you are excited to solve.",
          "For example: 'I'm applying for the Senior Data Analyst role because your team's work on demand forecasting is exactly the problem I have spent three years solving at a regional grocery chain, where my models cut overstock by 14 percent.' It names the role, shows research and gives evidence in one sentence. If someone referred you, mention their name in the first line."
        ]
      },
      {
        heading: "Showing fit with evidence, not adjectives",
        p: [
          "Pick the two or three requirements from the job description that matter most, and give an example for each. A useful pattern is situation, action and result: what the situation was, what you did, and what changed as a result. Use numbers where you honestly can.",
          "Avoid repeating your resume line by line. Instead, add context the resume cannot hold: why a project was difficult, how you worked with others, or what you learned. Mirror key terms from the job description naturally, because some employers parse cover letters into their applicant tracking system alongside the resume."
        ]
      },
      {
        heading: "Tone, length and formatting",
        p: [
          "Write the way you would speak in a good interview: confident, specific and polite. Match the company's tone to a degree, so a start-up may suit a warmer style while a law firm or bank expects a more formal one. Keep paragraphs to three to five sentences and the full letter under one page.",
          "Use the same font and header as your resume so the documents look like a set. Save as PDF unless asked otherwise, and name the file clearly, for example 'Firstname-Lastname-Cover-Letter.pdf'. If the application has a text box instead of an upload, paste plain text and remove the formal address block.",
          "In Portfolio OS, cover letter templates reuse the same profile, experience and projects as your resume, so names, titles and dates stay consistent, and you can export to PDF or Word."
        ]
      },
      {
        heading: "Mistakes that make a cover letter forgettable",
        p: [
          "Recruiters read many letters for each role, and the same issues appear again and again. Avoiding them puts you ahead of a large share of applicants."
        ],
        list: [
          "Sending the same letter to every company with only the name changed",
          "Getting the company name, role or hiring manager's name wrong",
          "Focusing on what the job will do for you rather than what you will do for the team",
          "Summarising your whole career instead of picking the most relevant examples",
          "Apologising for missing requirements or drawing attention to weaknesses",
          "Running over one page or using dense blocks of text"
        ]
      }
    ],
    faqs: [
      { q: "How long should a cover letter be?", a: "Aim for 250 to 400 words and no more than one page. Three to four short paragraphs are enough to make your case." },
      { q: "Is a cover letter still necessary?", a: "Send one when the employer requests it or makes it optional, and for roles you really want. Many hiring managers use cover letters to choose between similar candidates, and a tailored letter rarely hurts." },
      { q: "Who should I address my cover letter to?", a: "Address it to the hiring manager by name when you can find it on the job posting, LinkedIn or the company website. Otherwise use 'Dear Hiring Manager' or address the relevant team." },
      { q: "Should my cover letter repeat my resume?", a: "No. Pick a few relevant achievements and add context the resume cannot show, such as why the work mattered, how you approached it and why you want this particular job." },
      { q: "What file format should I use for a cover letter?", a: "Use PDF unless the employer asks for Word. Match the design of your resume and use a clear file name with your name and 'Cover Letter'." }
    ]
  },
  {
    slug: "resume-vs-cv",
    title: "Resume vs CV: What's the Difference?",
    description: "The difference between a resume and a CV: length, content, purpose and which one to use in the US, UK, Europe, Australia, India and academia.",
    h1: "Resume vs CV: what's the difference and which do you need?",
    intro: "The words resume and CV are often used interchangeably, but their meaning depends on where you are applying and what kind of job it is. In the United States and Canada a resume is a short, tailored summary while a CV is a long academic record; in the UK, Ireland and much of Europe, CV simply means the document most people call a resume. This guide explains the differences and how to choose.",
    sections: [
      {
        heading: "The short answer",
        p: [
          "A resume is a concise, targeted document, usually one to two pages, that highlights the experience and skills most relevant to a specific job. A curriculum vitae (CV), in its traditional academic sense, is a comprehensive record of your entire academic and professional history, including publications, research, teaching and grants, and it grows longer over your career.",
          "Outside North America, however, 'CV' is the everyday name for a resume-style document. A UK employer asking for your CV expects something very close to a two-page US resume, not a ten-page academic record."
        ]
      },
      {
        heading: "Key differences at a glance",
        p: [
          "When the two terms do refer to different documents, these are the main points that separate them."
        ],
        list: [
          "Length: a resume is usually one to two pages; an academic CV has no fixed limit and can run to many pages.",
          "Purpose: a resume is tailored to each job; a CV is a complete, mostly unchanging record that you add to over time.",
          "Content: resumes focus on relevant experience, achievements and skills; academic CVs also list publications, presentations, research, teaching, grants, awards and professional memberships.",
          "Order: resumes usually lead with experience (or education for students); academic CVs typically lead with education and research.",
          "Use: resumes are standard for most private-sector and non-academic jobs; academic CVs are used for academic, research, scientific and some medical roles and fellowship or grant applications."
        ]
      },
      {
        heading: "Which one to use by country",
        p: [
          "Regional conventions matter, and the job posting is always the best guide. If it asks for a specific document, use that name and format."
        ],
        list: [
          "United States and Canada: use a resume for most jobs and a CV for academic, research, scientific and some medical positions.",
          "United Kingdom and Ireland: 'CV' means a resume-style document of about two pages. Academic posts use a longer academic CV.",
          "Europe: 'CV' is the standard term. Some employers and public institutions accept or request the Europass CV format.",
          "Australia and New Zealand: 'resume' and 'CV' are used almost interchangeably for a document of about two to three pages.",
          "India, the Middle East and South Africa: the terms are used interchangeably; a 'biodata' is a related, more personal format that is now less common in professional hiring.",
          "Germany and some other countries: photos and personal details are still common in some sectors, while in the US, UK and Canada you should leave out photos, date of birth and marital status to avoid bias."
        ]
      },
      {
        heading: "What goes in a resume",
        p: [
          "A strong resume contains your name and contact details, an optional two to three line summary, work experience with achievement-focused bullet points, education, skills and, where relevant, projects, certifications or volunteer work. Everything is chosen for relevance to the job you are applying for, so older or unrelated experience is shortened or removed.",
          "Because resumes are usually submitted through applicant tracking systems, a clean single-column format, standard headings and job-specific keywords help them parse correctly and appear in recruiter searches."
        ]
      },
      {
        heading: "What goes in an academic CV",
        p: [
          "An academic CV begins with contact details and education, including your dissertation title and advisor. It then lists academic appointments, research experience, publications in a consistent citation style, conference presentations, grants and funding, teaching experience, awards, service, professional memberships, languages and references.",
          "You do not tailor an academic CV as aggressively as a resume, but you can reorder sections to emphasise research for a research-focused post or teaching for a teaching-focused one. Keep publications and presentations up to date as you go; reconstructing them later is painful."
        ]
      },
      {
        heading: "Converting between the two",
        p: [
          "To turn an academic CV into an industry resume, cut it to one or two pages, translate research into outcomes an employer understands (methods used, problems solved, tools and data handled, results), move publications to a short selected list or remove them, and lead with skills and experience relevant to the role.",
          "To go the other way, expand each section with complete lists, add publications, presentations and teaching, and switch the order so education and research come first. Keeping one master document with everything, and producing shorter tailored versions from it, saves a great deal of time. Portfolio OS lets you keep one profile and create multiple tailored resume versions from it, with templates that include an Academic layout."
        ]
      }
    ],
    faqs: [
      { q: "Is a CV the same as a resume?", a: "In the UK, Europe and many other regions, yes: CV is the common name for a resume-style document. In the US and Canada, a CV usually means a longer academic record, while a resume is a short, tailored summary." },
      { q: "How long should a CV be?", a: "A UK or European CV is usually about two pages. An academic CV has no fixed length and grows with your publications, teaching and research." },
      { q: "Should I send a resume or a CV?", a: "Follow the job posting. In North America, send a resume unless the role is academic, research or medical. Elsewhere, send a resume-style CV unless an academic CV is requested." },
      { q: "Do I need a photo on my CV?", a: "Not in the US, UK, Canada, Ireland or Australia, where photos are generally discouraged to reduce bias. Some employers in parts of Europe, the Middle East and Asia still expect one, so check local norms." }
    ]
  },
  {
    slug: "how-to-tailor-your-resume",
    title: "How to Tailor Your Resume to a Job Description",
    description: "A step-by-step method to tailor your resume for each job: analyse the posting, match keywords, rewrite bullets and keep versions organised.",
    h1: "How to tailor your resume to every job description",
    intro: "Tailoring your resume means adjusting it for each application so the most relevant experience, skills and keywords are easy for both applicant tracking systems and recruiters to find. It does not mean rewriting everything from scratch or inventing experience. With a master resume and a repeatable process, tailoring takes 15 to 30 minutes per application and noticeably improves response rates.",
    steps: [
      { name: "Build a master resume", text: "Keep one long document with every role, project, achievement, skill and certification you might ever use, with metrics. Tailored versions are created by selecting from it." },
      { name: "Analyse the job description", text: "Highlight the job title, required and preferred skills, tools, responsibilities and any phrases repeated more than once. Rank them by how often and how prominently they appear." },
      { name: "Match your title and summary", text: "Adjust your headline and summary to use the role's title where it honestly fits and to lead with the two or three qualifications the posting values most." },
      { name: "Reorder and rewrite your bullet points", text: "Move the most relevant achievements to the top of each role, rewrite them using the posting's terminology, and cut bullets that do not support this application." },
      { name: "Update your skills section", text: "List the required skills and tools you genuinely have first, using the exact wording from the posting, and remove skills that are irrelevant to this role." },
      { name: "Check length, format and keywords", text: "Keep the resume to one or two pages, confirm it parses cleanly, and check that the top requirements appear in context, not only in a list." },
      { name: "Save and track the version", text: "Name the file clearly, save the tailored version alongside the job posting, and record where and when you applied." }
    ],
    sections: [
      {
        heading: "Why tailoring works",
        p: [
          "Recruiters typically search their applicant tracking system with terms taken straight from the job description, then skim the matching resumes for a few seconds each. A tailored resume wins on both counts: it contains the terms they search for, and the first things they read are the things they care about.",
          "Tailoring also helps you stand out among applicants with similar backgrounds. Two candidates with the same experience can look very different when one has rewritten their bullets to address the company's problems directly."
        ]
      },
      {
        heading: "Start with a master resume",
        p: [
          "The fastest way to tailor is to never start from a blank page. Keep a master resume, sometimes called a career document, that includes every role and every achievement you can describe, with numbers, tools and context. It can be five pages long; nobody else will see it.",
          "For each achievement, write two or three variations that emphasise different skills. A project might be framed around leadership for a management role, around technical depth for an engineering role, or around stakeholder communication for a consulting role. When you tailor, you choose the right variation instead of writing new text under pressure."
        ]
      },
      {
        heading: "How to read a job description",
        p: [
          "Job descriptions mix essential requirements with wish lists. Look for signals of priority: items listed first, items in the 'requirements' rather than 'nice to have' section, and words repeated across the title, summary and responsibilities.",
          "Group what you find into categories so you can map each one to your resume."
        ],
        list: [
          "Job title and level, such as 'Senior Product Manager' or 'Data Analyst II'",
          "Hard skills and tools, such as SQL, Figma, Salesforce or Kubernetes",
          "Domain knowledge, such as fintech, healthcare compliance or B2B SaaS",
          "Responsibilities, such as 'own the roadmap' or 'mentor junior engineers'",
          "Qualifications and certifications, such as a degree, licence, PMP or AWS certification",
          "Soft skills the company emphasises, such as cross-functional collaboration"
        ]
      },
      {
        heading: "Rewriting bullets without exaggerating",
        p: [
          "Good tailoring changes emphasis and vocabulary, never facts. If the posting says 'customer retention' and you wrote 'reduced churn', it is fair to write 'improved customer retention by reducing churn 9 percent'. If the posting asks for experience you do not have, do not claim it; show the closest transferable experience instead, and address the gap in your cover letter if needed.",
          "Use a consistent bullet pattern: strong verb, what you did, how, and the result. For example, 'Launched a self-serve onboarding flow in React that cut time to first value from 3 days to 4 hours'. Place the bullets that best match the posting at the top of each role, because recruiters often read only the first two or three."
        ]
      },
      {
        heading: "What to change, and what to leave alone",
        p: [
          "Change the parts that carry the most weight for relevance: your headline, summary, skills section, the order and wording of bullet points, and which projects you include. Consider adding a short 'Selected projects' section when a project matches the role better than your job history does.",
          "Leave alone the facts and the overall format: employers, job titles you actually held, dates, degrees and the template. Constantly redesigning the layout wastes time and increases the chance of errors. A clean, ATS-friendly single-column design works across nearly every application."
        ]
      },
      {
        heading: "Keep versions organised",
        p: [
          "After a few weeks of job searching you may have dozens of variations. Name files consistently, for example 'Firstname-Lastname-Resume-CompanyName.pdf', and keep the job description with each version, since postings are often removed once a role closes and you will want it before an interview.",
          "Tools that support multiple resume versions from one profile make this much easier. In Portfolio OS you can duplicate a resume per application, use the ATS checks to review keywords and length, and export a resume, cover letter and portfolio together as one application pack."
        ]
      }
    ],
    faqs: [
      { q: "Should I tailor my resume for every job?", a: "Yes, for every role you genuinely want. You do not need to rewrite it each time; adjusting the summary, skills and the order and wording of bullets usually takes 15 to 30 minutes." },
      { q: "Is it okay to copy wording from the job description?", a: "Using the same terms for skills and responsibilities you really have is recommended, because recruiters search for those words. Do not paste whole sentences or claim experience you do not have." },
      { q: "How many keywords should my resume include?", a: "There is no magic number. Make sure the most important required skills, tools and qualifications appear, ideally in your experience bullets as well as your skills section, and keep the text natural." },
      { q: "What if I don't meet every requirement?", a: "Apply anyway if you meet most of the core requirements. Emphasise transferable experience on your resume and briefly address the gap in your cover letter." },
      { q: "Should I change my job titles to match the posting?", a: "Do not change the title you held. You can add a clarifying description in your headline or summary, such as 'Software Engineer focused on data infrastructure', when it accurately reflects your work." }
    ]
  },
  {
    slug: "json-resume",
    title: "JSON Resume: What It Is and How to Use It",
    description: "What the JSON Resume standard is, how its schema works, how to create a resume.json file, and how to import or export it to PDF, Word and HTML.",
    h1: "JSON Resume: the open standard for resume data",
    intro: "JSON Resume is a free, community-driven open standard for storing a resume as structured data in a single JSON file. Because the content is separated from the design, you can write your resume once and render it with any compatible theme or tool. This guide explains the format, shows how the file is organised and covers how to import, export and keep it up to date.",
    sections: [
      {
        heading: "What JSON Resume is",
        p: [
          "JSON Resume defines a schema, an agreed list of fields and their structure, for the information a resume contains: your basic details, work history, education, skills, projects and more. The data lives in a file usually called resume.json. Themes and tools read that file and produce HTML, PDF or other formats.",
          "The idea is the same one that made web development easier: separate content from presentation. Instead of copying text between word processor templates, you keep one canonical source and generate as many designs as you need. The project and its schema are open source and hosted at jsonresume.org."
        ]
      },
      {
        heading: "How the schema is organised",
        p: [
          "A resume.json file is a single JSON object. Each top-level key is a section, and most sections are arrays of entries. All sections are optional, so you only include what applies to you."
        ],
        list: [
          "basics: name, label (your headline), image, email, phone, url, summary, location and an array of social profiles",
          "work: one entry per job with name (employer), position, url, startDate, endDate, summary and highlights",
          "education: institution, area, studyType, startDate, endDate, score and courses",
          "skills: name, level and a list of keywords for each skill group",
          "projects: name, description, highlights, keywords, startDate, endDate, url and roles",
          "volunteer, awards, certificates, publications, languages, interests and references",
          "meta: optional information about the file itself, such as version and last modified date"
        ]
      },
      {
        heading: "Dates and other details that trip people up",
        p: [
          "Dates use the ISO 8601 format: a full date like 2023-04-01, a year and month like 2023-04, or just a year like 2023. Leave endDate out of a current role rather than writing 'Present'; themes render a missing end date as present. Highlights are arrays of strings, one per bullet point, which keeps them easy to reorder.",
          "Because the file is strict JSON, every key and string must use double quotes, and trailing commas are not allowed. If a tool refuses to import your file, paste it into a JSON validator first: a missing comma or quote is the most common cause. Validators that check against the official schema will also flag misspelled keys."
        ]
      },
      {
        heading: "Why use JSON Resume",
        p: [
          "The main benefit is portability. Your resume becomes data you own, in a plain text format that any tool or script can read, rather than content locked inside a particular word processor or website.",
          "Plain text also works well with version control. Developers often keep resume.json in a Git repository, which gives a full history of changes and makes it easy to create branches for different kinds of roles. Some people host the file publicly so websites and tools can render an always-current resume from it."
        ],
        list: [
          "Write once, then switch designs without retyping anything",
          "Move between resume tools without losing structure",
          "Track changes and keep tailored versions with Git",
          "Generate a resume, portfolio and other documents from the same source"
        ]
      },
      {
        heading: "Creating and editing a resume.json file",
        p: [
          "You can write the file by hand in any code editor, starting from the sample resume in the official schema repository. Editors such as VS Code can validate the file against the published JSON schema as you type, which catches mistakes immediately.",
          "If you would rather not edit JSON directly, use a builder that imports and exports the format. You edit in a normal form, and the tool keeps the structure valid. The official command-line tool, resume-cli, can also validate a file and export it to HTML or PDF with a chosen theme, although community themes vary in quality and maintenance."
        ]
      },
      {
        heading: "Importing and exporting with Portfolio OS",
        p: [
          "Portfolio OS imports JSON Resume files directly into Resume Studio, mapping basics, work, education, skills, projects and other sections onto its own fields. From there you can apply any of its 12 resume templates, run ATS checks, and export to PDF, Word (DOCX), plain text or back to JSON. It runs free in the browser with no sign-up, and the file is processed on your device rather than uploaded.",
          "Whatever tool you use, keep resume.json as your master copy. When you finish a tailored version for an application, export it back to JSON as well so the structured data stays in sync with the PDF you sent."
        ]
      },
      {
        heading: "Limitations to know about",
        p: [
          "JSON Resume describes content, not layout, so very specific design choices like custom section names or unusual ordering depend on the theme or tool that renders it. Tools also support the schema to different degrees, so lesser-used sections such as references or interests may not appear in every template. Check the output before sending it, and keep custom fields to a minimum if you want maximum compatibility."
        ]
      }
    ],
    faqs: [
      { q: "What is JSON Resume?", a: "JSON Resume is an open standard for storing resume content as structured JSON data in a file called resume.json, so the same content can be rendered with different themes and tools." },
      { q: "Is JSON Resume free?", a: "Yes. The schema, the command-line tool and community themes are free and open source." },
      { q: "How do I convert a JSON Resume to PDF?", a: "Import the file into a resume builder that supports the format and export to PDF, or use the resume-cli command-line tool with a theme. Portfolio OS imports resume.json and exports PDF, Word, plain text and JSON in the browser." },
      { q: "Can I convert an existing Word resume into JSON Resume?", a: "Yes. Recreate the content in a builder that exports JSON Resume, or copy the sample resume.json and fill in each section by hand. Automatic converters exist but usually need manual cleanup." },
      { q: "What date format does JSON Resume use?", a: "ISO 8601 dates such as 2024-03-15, 2024-03 or 2024. Leave out the end date for a current position." }
    ]
  }
];
