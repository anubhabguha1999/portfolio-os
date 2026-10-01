/**
 * Portfolio example landing pages (one per profession), rendered by scripts/prerender.mjs.
 * Plain-text strings only: the prerender step escapes and wraps them in HTML.
 */
export default [
  {
    slug: "developer",
    title: "Developer Portfolio Website Examples & Free Template",
    description: "How to build a free developer portfolio website that gets interviews: what projects to show, how to write them up, example headlines and mistakes to avoid.",
    h1: "Developer portfolio website examples",
    intro: "A developer portfolio is the place where a hiring manager checks whether the skills on your resume hold up in real work. The best ones are short, fast and built around three to five projects explained like engineering decisions, not screenshots. This guide shows what to include, how to structure each project and how to make the site easy to find.",
    template: "Developer Terminal",
    sections: [
      {
        heading: "What to include",
        p: [
          "Reviewers usually spend under two minutes on a portfolio before deciding whether to read your code. Put the things they look for first, and leave out anything that does not help them decide.",
        ],
        list: [
          "A one-line summary of what you build and for whom, for example backend services, mobile apps or developer tooling",
          "Three to five projects, each with a live demo or recording, a link to the source and a short write-up",
          "A skills section grouped by how you use them (languages, frameworks, infrastructure, testing) rather than a wall of logos",
          "Work history in brief, with a link to a downloadable resume in PDF",
          "Contact details: email, GitHub and one professional network profile",
          "Optional but valuable: open-source contributions, technical writing or talks",
        ],
      },
      {
        heading: "How to write up each project",
        p: [
          "Treat every project like a short design document. A reviewer wants to know what problem you solved, which constraints you faced and what you chose not to do. That tells them more than the feature list.",
          "Keep each write-up to 150 to 300 words with a clear structure, and put the most impressive number or outcome near the top. If a project was built in a team, say exactly which parts were yours.",
        ],
        list: [
          "Problem: one or two sentences on who had the problem and why it mattered",
          "Approach: the architecture, main technologies and one trade-off you made deliberately",
          "Result: a measurable outcome such as response time cut from 900 ms to 120 ms, 2,000 weekly users or a passing load test",
          "What you would change next time, which signals maturity",
          "Links: live demo, repository and, if relevant, a short screen recording",
        ],
      },
      {
        heading: "Homepage copy and example headlines",
        p: [
          "Your hero section should say what kind of engineer you are in plain words. Avoid vague claims like passionate coder or tech enthusiast; specificity is what makes someone keep reading. A good headline names your focus area and, where possible, the kind of team or product you want to work on.",
        ],
        list: [
          "Backend engineer building reliable payment and billing APIs",
          "Frontend developer who turns complex dashboards into fast, accessible interfaces",
          "Full-stack developer shipping small web products end to end, from database to deploy",
        ],
      },
      {
        heading: "Design and technical tips",
        p: [
          "Your portfolio is itself a code sample, so performance and accessibility count. A page that takes five seconds to load on a phone says more than any skills list. Keep the design simple, readable and consistent, and let the projects carry the visual interest.",
        ],
        list: [
          "Aim for a fast first load: compress images, avoid heavy animation libraries and keep fonts to one or two families",
          "Use semantic headings and real links so the site works with screen readers and keyboard navigation",
          "Show code with syntax highlighting and short excerpts, not full files",
          "Make sure it reads well on a phone, since many recruiters open links from email on mobile",
          "Use a custom domain if you can; it looks more established than a default subdomain",
        ],
      },
      {
        heading: "Common mistakes to avoid",
        list: [
          "Listing tutorial clones such as to-do apps or weather widgets without any original twist",
          "Broken demo links or apps that fail because a free hosting tier went to sleep or an API key expired",
          "Repositories with no README, no setup instructions and a single commit",
          "Skill bars or percentages, which say nothing measurable and invite awkward interview questions",
          "Hiding contact details or forcing people through a form with no email address",
        ],
      },
      {
        heading: "Getting found and sharing it",
        p: [
          "Put the portfolio link in your resume header, your GitHub profile README and your professional network profile. Give each project its own page with a descriptive title, such as Real-time chat service in Go, so it can appear in search results on its own.",
          "When you apply for a role, link directly to the most relevant project rather than the homepage. Recruiters rarely click around, so make the first page they see the strongest one.",
        ],
      },
    ],
    faqs: [
      {
        q: "How many projects should a developer portfolio have?",
        a: "Three to five strong projects is enough. Reviewers rarely look past the first three, so lead with the most relevant and complex work and cut anything you would not want to talk about in an interview.",
      },
      {
        q: "Do I need a portfolio if I have a GitHub profile?",
        a: "Yes, ideally both. GitHub shows your code, but a portfolio explains why the code matters: the problem, your decisions and the outcome. Most hiring managers will read a short write-up before they open a repository.",
      },
      {
        q: "Should I build my portfolio from scratch to show my skills?",
        a: "Only if building it is itself a project worth showing. A template lets you spend your time on the project write-ups, which are what reviewers actually read. You can always replace it with a custom build later.",
      },
      {
        q: "What if my best work is under a non-disclosure agreement?",
        a: "Describe the problem, your role and the outcome in general terms without naming the client or revealing code. You can also rebuild a simplified version of the idea as a personal project to demonstrate the same skills.",
      },
    ],
  },
  {
    slug: "ux-designer",
    title: "UX Designer Portfolio Examples & Free Website Template",
    description: "Build a free UX or product designer portfolio with case studies that show your process, decisions and impact. Structure, headlines and mistakes to avoid.",
    h1: "UX and product designer portfolio examples",
    intro: "A UX portfolio is judged less on how polished the screens look and more on how clearly you explain your thinking. Hiring teams want to see how you frame problems, work with research and make trade-offs under real constraints. Here is how to structure case studies that show that.",
    template: "Cupertino",
    sections: [
      {
        heading: "What to include",
        list: [
          "Two to four in-depth case studies rather than many shallow ones",
          "A clear statement of the kind of design you do: research-heavy, interaction design, design systems or end-to-end product work",
          "Your role on every project, especially when you worked with other designers, researchers or engineers",
          "A short about page covering your background, the domains you know and how you like to work",
          "A downloadable resume and an easy way to contact you",
        ],
      },
      {
        heading: "How to structure a UX case study",
        p: [
          "Most hiring managers skim a case study first, then read the parts that interest them. Write a summary block at the top with the problem, your role, the timeline and the outcome, so a skim still tells the whole story.",
          "Below the summary, walk through the work in the order decisions were made. Show early sketches and discarded options next to the final design, and explain why you moved on from them. The reasoning between the screens is the part that gets you hired.",
        ],
        list: [
          "Context: the product, the users and the business goal",
          "Problem: what was not working, backed by data or research findings",
          "Process: research methods, key insights, explorations and the trade-offs you weighed",
          "Solution: the final design with annotated screens or a short prototype recording",
          "Impact: metrics such as task completion, conversion or support tickets, or qualitative findings if numbers are not available",
          "Reflection: what you learned and what you would test next",
        ],
      },
      {
        heading: "Homepage copy and example headlines",
        p: [
          "Your opening line should tell a recruiter, in one glance, what problems you are good at. Mention the domain if you have depth in one, because specialised experience is often what gets a portfolio shortlisted.",
        ],
        list: [
          "Product designer simplifying complex workflows for finance and operations teams",
          "UX designer focused on accessible, research-led mobile experiences",
          "Design systems designer helping product teams ship consistent interfaces faster",
        ],
      },
      {
        heading: "Design tips for the portfolio itself",
        p: [
          "Recruiters will notice whether your own site follows the principles you talk about. Clear hierarchy, readable type and obvious navigation matter more than unusual layouts.",
        ],
        list: [
          "Use large, legible body text and keep line lengths comfortable for long case studies",
          "Annotate screenshots so the reader knows what to look at, rather than placing full screens without explanation",
          "Check colour contrast and alt text; accessibility gaps in a UX portfolio are noticed",
          "Add a table of contents or section links to long case studies",
          "Use consistent device frames and image sizes so the work feels considered",
        ],
      },
      {
        heading: "Common mistakes to avoid",
        list: [
          "Following a rigid double-diamond template for every project even when the real process was different",
          "Showing only final, polished screens with no explanation of how you got there",
          "Claiming sole credit for team work, which often comes out in interviews",
          "Using generic personas and journey maps that clearly did not influence any decision",
          "Case studies so long that the outcome is buried at the bottom",
        ],
      },
      {
        heading: "Getting found and sharing it",
        p: [
          "Give each case study a descriptive title and its own page, for example Redesigning onboarding for a B2B analytics tool. That makes the work easier to share in applications and helps it appear in search.",
          "If a portfolio is password protected because of client work, make sure at least one case study is public so a recruiter can judge your work without having to email you first.",
        ],
      },
    ],
    faqs: [
      {
        q: "How many case studies should a UX portfolio have?",
        a: "Two to four detailed case studies is the usual sweet spot. Choose projects that show different skills, for example one research-heavy project and one focused on interaction or visual design.",
      },
      {
        q: "Can I include concept or personal projects?",
        a: "Yes, especially early in your career. Be clear that the project is self-initiated and hold it to the same standard: real user input, explicit constraints and honest reflection on what you would change.",
      },
      {
        q: "Should a UX portfolio include visual design work?",
        a: "Include it if the roles you want involve visual or interface design. For research-focused roles, a strong process and clear outcomes matter more than high-fidelity screens.",
      },
      {
        q: "How do I show impact without access to metrics?",
        a: "Use qualitative evidence such as usability test findings, stakeholder decisions your work influenced or reduced effort for a task. Say plainly that you did not have access to post-launch data rather than inventing numbers.",
      },
    ],
  },
  {
    slug: "graphic-designer",
    title: "Graphic Designer Portfolio Examples & Free Template",
    description: "Make a free graphic designer portfolio website that shows range and craft: project selection, layout, presentation, example headlines and mistakes.",
    h1: "Graphic designer portfolio website examples",
    intro: "A graphic design portfolio has to work as both a gallery and a pitch. Clients and art directors want to see strong visual work quickly, then understand the brief behind it. This guide covers how to curate, present and describe your work so the craft and the thinking both come through.",
    template: "Creative",
    sections: [
      {
        heading: "What to include",
        list: [
          "Eight to twelve of your strongest projects, grouped by discipline such as branding, editorial, packaging or motion",
          "A mix of client work and self-initiated projects, clearly labelled",
          "Process material for a few key projects: sketches, rejected directions and moodboards",
          "A short bio that states your specialism and the kind of clients or studios you work with",
          "Services and contact details if you freelance, including how to start a project",
        ],
      },
      {
        heading: "How to present each project",
        p: [
          "Lead every project with its strongest image, then show the system around it. For a brand identity that means the logo, type, colour and a set of real applications such as signage, packaging and digital assets. Mockups help, but use them sparingly and make sure they look realistic.",
          "Add a short description of the brief, the audience and the idea behind the solution. Two or three sentences is often enough. If the project had a measurable result, such as a rebrand that supported a product launch, mention it.",
        ],
        list: [
          "Brief: client type, goal and audience",
          "Idea: the concept that ties the work together",
          "Execution: key deliverables and formats",
          "Your role and collaborators, including photographers or illustrators",
        ],
      },
      {
        heading: "Homepage copy and example headlines",
        p: [
          "The headline should make your specialism clear. Many studios hire for a particular kind of work, so a focused headline is more effective than describing yourself as a designer who does everything.",
        ],
        list: [
          "Brand identity designer for independent food and drink businesses",
          "Editorial and book designer with a love of typography",
          "Packaging and print designer creating shelf-ready brands",
        ],
      },
      {
        heading: "Layout and design tips",
        p: [
          "Your portfolio layout should frame the work rather than compete with it. A neutral background, generous spacing and a consistent grid let each project stand out.",
        ],
        list: [
          "Export images at high quality but compress them for the web so pages load quickly",
          "Use a consistent aspect ratio for project thumbnails on the index page",
          "Order projects by strength and relevance, not by date",
          "Let visitors filter or jump between disciplines if you show a wide range",
          "Keep a downloadable PDF version for studios that ask for one in applications",
        ],
      },
      {
        heading: "Common mistakes to avoid",
        list: [
          "Including every project you have ever done, which dilutes the strongest pieces",
          "Relying entirely on mockups so the work never appears in a real context",
          "Showing only logos without the wider identity system around them",
          "Leaving out any explanation, which makes it hard to judge the thinking behind the visuals",
          "Unlabelled student or speculative work presented as if it were for a paying client",
        ],
      },
      {
        heading: "Getting found and sharing it",
        p: [
          "Use descriptive project titles and image alt text, such as Packaging design for an organic tea brand, so search engines and visually impaired visitors understand the work. Post selected projects on design communities and link back to the full case on your own site, where you control the presentation and contact details.",
        ],
      },
    ],
    faqs: [
      {
        q: "How many projects should a graphic design portfolio have?",
        a: "Around eight to twelve strong projects is typical. If you are targeting a specific role, a tighter selection of five or six highly relevant projects can be more effective than a broad one.",
      },
      {
        q: "Should I include student work?",
        a: "Yes, if it is among your best work. Label it as student or self-initiated and replace it with professional work as your career grows.",
      },
      {
        q: "Do I need a website or is a PDF portfolio enough?",
        a: "A website is easier to share and update, and it can be found through search. Many studios still ask for a PDF in applications, so it helps to keep both, with the PDF as a curated subset.",
      },
      {
        q: "How do I show work I am not allowed to publish?",
        a: "Ask the client whether you can show it privately or after launch. If not, describe the project in words and show process material that does not reveal confidential details, or leave it out entirely.",
      },
    ],
  },
  {
    slug: "photographer",
    title: "Photographer Portfolio Website Examples & Free Template",
    description: "Create a free photographer portfolio website that books clients: how to edit your selection, organise galleries, write about the work and get found.",
    h1: "Photographer portfolio website examples",
    intro: "For a photographer, the portfolio is the product demo. People decide in seconds whether your style fits what they need, so the edit matters more than the quantity. This guide covers how to curate galleries, present your services and make the site easy for clients to find and act on.",
    template: "Luxury",
    sections: [
      {
        heading: "What to include",
        list: [
          "A tight selection of your best images, usually 20 to 40 across the whole site",
          "Galleries organised by the kind of work you want to be hired for, such as weddings, portraits, products or architecture",
          "An about page with a photo of you, your approach and where you are based",
          "Services and pricing guidance, or at least a starting price, so enquiries are qualified",
          "A clear booking or enquiry route with your email and response time",
          "Client testimonials, ideally attached to the gallery they relate to",
        ],
      },
      {
        heading: "How to edit and structure galleries",
        p: [
          "Edit hard. A gallery of 15 consistently excellent images is more convincing than 60 images of mixed quality. Ask a peer to remove the five weakest frames; they will usually be right.",
          "Sequence each gallery like a story. For event and wedding work, show a full day in order so couples can picture their own. For commercial work, group images by client or campaign and add a line on the brief and usage.",
        ],
        list: [
          "Open each gallery with the image that best represents your style",
          "Mix wide, medium and detail shots to give rhythm",
          "Keep colour grading consistent within a gallery",
          "Add one or two sentences of context for commercial projects",
        ],
      },
      {
        heading: "Homepage copy and example headlines",
        p: [
          "Pair your strongest image with a headline that names what you shoot and where. Location matters for photographers because many clients search locally.",
        ],
        list: [
          "Natural, documentary wedding photography across the coast and countryside",
          "Product and food photography for independent brands and restaurants",
          "Portrait photographer for actors, founders and creative professionals",
        ],
      },
      {
        heading: "Design and performance tips",
        p: [
          "Large images make photography sites slow, and slow sites lose visitors and rank lower in search. Resize images to the largest size they are displayed at and use modern compressed formats where possible.",
        ],
        list: [
          "Keep the interface minimal and neutral so it does not compete with the images",
          "Avoid right-click blocking and heavy watermarks, which frustrate visitors without stopping copying",
          "Make galleries easy to swipe on phones, where many clients first see your work",
          "Use lazy loading so only the visible images load first",
          "Put the enquiry button in the navigation so it is always one tap away",
        ],
      },
      {
        heading: "Common mistakes to avoid",
        list: [
          "Showing every genre you have tried, which makes it unclear what you specialise in",
          "Including near-duplicate frames from the same moment",
          "Hiding prices completely, which leads to many enquiries that do not fit your budget",
          "Auto-playing music or slideshows",
          "Leaving galleries without any text, so search engines have nothing to index",
        ],
      },
      {
        heading: "Getting found and sharing it",
        p: [
          "Write a short paragraph for each gallery with the location, type of shoot and style, and give images descriptive file names and alt text. Create a free business listing in local map and search directories with a link to your site, and ask happy clients to leave reviews there.",
          "Share selected images on social platforms but always link back to the full gallery and enquiry page on your own site.",
        ],
      },
    ],
    faqs: [
      {
        q: "How many photos should be in a photography portfolio?",
        a: "Around 20 to 40 images across the site, with 10 to 20 per gallery, is a good guide. The aim is a consistent, high-quality edit rather than a full archive.",
      },
      {
        q: "Should I show prices on my photography website?",
        a: "Showing at least a starting price helps clients decide whether to contact you and reduces enquiries that are not a fit. Full packages can be shared on request.",
      },
      {
        q: "Should I watermark my portfolio images?",
        a: "A small, subtle mark is fine, but large watermarks distract from the work. Resizing images for the web and keeping originals private is a more effective way to limit misuse.",
      },
      {
        q: "Do I need separate portfolios for different types of photography?",
        a: "Usually one site with separate galleries is enough. If two specialisms attract very different clients, such as weddings and industrial work, consider giving each its own clearly separated section.",
      },
    ],
  },
  {
    slug: "writer",
    title: "Writer & Copywriter Portfolio Examples & Free Template",
    description: "Build a free writer or copywriter portfolio website that wins clients: choosing samples, presenting results, example headlines and mistakes to avoid.",
    h1: "Writer and copywriter portfolio examples",
    intro: "Editors and clients hire writers by reading their work, so a writing portfolio has to make the right samples easy to find and quick to judge. The strongest ones are organised by the kind of writing a client needs and show the results the words achieved. Here is how to build one.",
    template: "Editorial",
    sections: [
      {
        heading: "What to include",
        list: [
          "Eight to fifteen of your best samples, grouped by type such as web copy, email, long-form articles, scripts or UX writing",
          "A short summary for each sample: the client type, goal and your contribution",
          "Results where you have them, such as higher sign-ups, search rankings or open rates",
          "A clear statement of your niche and the industries you know",
          "Services, typical turnaround and how to commission you",
          "Testimonials from editors or clients",
        ],
      },
      {
        heading: "How to present writing samples",
        p: [
          "Do not make clients download PDFs to read every piece. Show an excerpt or the opening paragraph on the page with a link to the full published version, and keep a copy in case the original link breaks.",
          "For copywriting, context is everything. A headline means little without the brief. Add a few lines explaining the audience, the objective and any constraints, such as word limits or brand voice rules, then show the work.",
        ],
        list: [
          "Brief: who it was for and what it had to achieve",
          "Approach: the angle, tone or structure you chose and why",
          "Result: a measurable outcome or the client's response",
          "Format: link, excerpt, before-and-after or a screenshot of the copy in place",
        ],
      },
      {
        heading: "Homepage copy and example headlines",
        p: [
          "As a writer, your headline is itself a sample. Make it specific, clear and in the voice you would use for clients.",
        ],
        list: [
          "Conversion copywriter for software companies that need clearer landing pages",
          "Health and science writer who makes complex research readable",
          "Email and lifecycle copywriter for subscription brands",
        ],
      },
      {
        heading: "Design tips",
        p: [
          "A writing portfolio should be easy to read above all. Choose a comfortable body font size, keep line lengths moderate and use plenty of white space between samples.",
        ],
        list: [
          "Group samples by type or industry so clients can go straight to what they need",
          "Use cover images or simple cards for each sample so the index page is scannable",
          "Keep your about page short and in a natural voice",
          "Proofread every page; a typo on a writer's site is costly",
        ],
      },
      {
        heading: "Common mistakes to avoid",
        list: [
          "Linking to published pieces that have since been edited by others or taken down",
          "Showing only blog posts when you want copywriting work, or the reverse",
          "Overlong introductions before the reader reaches any samples",
          "Generic claims such as wordsmith or storyteller without specifics",
          "No guidance on rates or process, which slows down enquiries",
        ],
      },
      {
        heading: "Getting found and sharing it",
        p: [
          "Publish a few articles on your own site about the topics you write for clients. They act as samples and help you rank for searches in your niche. Link your portfolio from your bylines, your email signature and your professional profiles, and link to the most relevant sample, not just the homepage, when you pitch.",
        ],
      },
    ],
    faqs: [
      {
        q: "What if I do not have published writing samples yet?",
        a: "Write spec pieces for the kind of work you want, such as a rewritten landing page or a sample article, and label them as samples. Publishing on your own site also counts as a real, linkable sample.",
      },
      {
        q: "Can I include ghostwritten work?",
        a: "Only with the client's permission. If you cannot name the client, describe the industry and type of piece, and share the sample privately when you pitch.",
      },
      {
        q: "Should I list my rates on my writer portfolio?",
        a: "Listing starting rates or typical project ranges helps clients self-select and saves time on both sides. You can still quote individually for larger projects.",
      },
      {
        q: "How many writing samples should I show?",
        a: "Eight to fifteen well-chosen samples is plenty. Three strong pieces in each category you sell is better than dozens in one long list.",
      },
    ],
  },
  {
    slug: "architect",
    title: "Architecture Portfolio Website Examples & Free Template",
    description: "Make a free architect or architecture student portfolio website: project selection, drawings and images, layout tips, example headlines and mistakes.",
    h1: "Architecture portfolio website examples",
    intro: "An architecture portfolio has to communicate spatial ideas through drawings, models and photographs, while also showing that you understand construction and teamwork. Practices typically review portfolios quickly, so clarity and editing matter. This guide covers how to present projects for both job applications and client work.",
    template: "Minimal",
    sections: [
      {
        heading: "What to include",
        list: [
          "Four to eight projects, with your strongest and most relevant work first",
          "A clear mix of concept, design development and technical work such as details and construction drawings",
          "For students, academic projects plus any internship or practice work",
          "For practising architects, built work with photographs, project stage and your role",
          "Software and fabrication skills, kept short and specific",
          "A downloadable PDF portfolio and CV for applications",
        ],
      },
      {
        heading: "How to present each project",
        p: [
          "Open each project with one strong image that sums up the idea, then a short statement covering the site, brief, programme and concept. A reader should understand the project in under a minute before diving into the drawings.",
          "Use a consistent drawing language across projects: similar line weights, scale bars, north points and labelling. Mix diagrams, plans, sections, physical models and renders so the reader sees how the idea developed, not just the final images.",
        ],
        list: [
          "Project facts: location, type, size, stage and year",
          "Your role: what you personally designed or produced, especially on team projects",
          "Concept diagram that explains the main idea in one image",
          "Key plans and sections at a readable scale",
          "One or two technical details that show construction knowledge",
        ],
      },
      {
        heading: "Homepage copy and example headlines",
        p: [
          "Use the headline to state your focus, whether that is a building type, a sustainability approach or a stage of work such as technical delivery.",
        ],
        list: [
          "Architectural designer focused on low-carbon housing and timber construction",
          "Part II architecture graduate with experience in competition and concept design",
          "Architect delivering education and community buildings from brief to completion",
        ],
      },
      {
        heading: "Layout and design tips",
        p: [
          "Let the drawings breathe. White space and a restrained layout make complex drawings easier to read on screen. Avoid tiny text inside drawings, since it becomes illegible on a laptop or phone.",
        ],
        list: [
          "Export drawings at sizes that remain legible on a laptop screen",
          "Keep a consistent grid and type style across all project pages",
          "Compress large renders and photographs so pages load quickly",
          "Offer the full PDF for practices that want to review offline",
          "Credit photographers and collaborators on built work",
        ],
      },
      {
        heading: "Common mistakes to avoid",
        list: [
          "Relying only on renders with no drawings to show how the building works",
          "Including every project from school, which hides the strongest work",
          "Unclear authorship on group projects",
          "Huge PDF files that are slow to open or exceed email attachment limits",
          "Inconsistent drawing styles that make the portfolio feel unedited",
        ],
      },
      {
        heading: "Getting found and sharing it",
        p: [
          "Name each project page clearly, for example Timber community library competition entry, and include a short written description so the work can appear in search. When applying to a practice, tailor the order of projects to their typical work and send a shorter PDF with a link to the full site.",
        ],
      },
    ],
    faqs: [
      {
        q: "How many projects should an architecture portfolio have?",
        a: "Four to eight projects is typical. For applications, practices often prefer a shorter selection that matches the kind of work they do, with a link to more.",
      },
      {
        q: "Should I include hand drawings and physical models?",
        a: "Yes. Sketches and models show how you think and develop ideas, which many practices value as much as polished renders.",
      },
      {
        q: "What should an architecture student portfolio include?",
        a: "Your strongest academic projects, any work placement experience, and evidence of technical understanding such as details or construction studies. Show process, not only final boards.",
      },
      {
        q: "How long should an architecture PDF portfolio be?",
        a: "For applications, a sample portfolio of around 10 to 20 pages is common, kept under a manageable file size for email. Bring or link a longer version for interviews.",
      },
    ],
  },
];
