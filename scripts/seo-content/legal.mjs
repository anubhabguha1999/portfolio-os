/**
 * Site policy pages rendered by scripts/content-pages.mjs as static pages at /<slug>.
 * Plain text only: the generator escapes and wraps every string.
 * Keep these accurate to what the app actually does (storage, network calls, ads, analytics).
 */
export const CONTACT_EMAIL = 'anubhabguha1999@gmail.com';
export const EFFECTIVE = '2026-10-24';

export default [
  {
    slug: 'privacy',
    title: 'Privacy Policy — Portfolio OS',
    description: 'How Portfolio OS handles your data: what stays in your browser, what advertising and analytics partners collect, cookies, and your choices.',
    h1: 'Privacy policy',
    intro: 'Portfolio OS is built so that the portfolios, resumes and documents you create never leave your device. This policy explains exactly what is stored, which third parties are involved when you use the site, and the choices you have.',
    sections: [
      {
        heading: 'Who runs Portfolio OS',
        p: [
          `Portfolio OS (portfolioos.online) is an independent project built and maintained by Anubhab Guha. If you have any question about this policy or your data, email ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: 'Your content stays in your browser',
        p: [
          'Portfolio OS has no user accounts and no content servers. Everything you type, upload or generate, including your profile, resumes, cover letters, portfolio projects, images and job applications, is saved in your browser’s own storage (IndexedDB and localStorage) on the device you are using. We cannot see, read, recover or delete it.',
          'Because your data lives only in your browser, clearing your site data, using a private window or switching devices will remove access to it. Use the Backup page to download a copy you control.',
        ],
      },
      {
        heading: 'Features that contact other services',
        p: ['A few optional features send data directly from your browser to a third-party service, and only when you use them:'],
        list: [
          'AI assistant: if you add your own Anthropic API key, the text you send to the assistant is sent from your browser straight to Anthropic’s API under your key and Anthropic’s terms. Your key is stored only in your browser.',
          'One-click deploy: if you connect GitHub, Netlify or Vercel with a token, your exported site files are sent to that provider to publish them. Tokens are stored only in your browser.',
          'Exports: when you export a site that references images or fonts by URL, your browser downloads those files from where they are hosted.',
          'Text recognition (OCR) and PDF reading run entirely on your device; the files are not uploaded anywhere.',
        ],
      },
      {
        heading: 'Advertising and Google AdSense',
        p: [
          'Portfolio OS is free and is supported by ads served by Google AdSense. Google and its partners are third-party vendors that use cookies and similar technologies to serve ads based on your prior visits to this website and other websites.',
          'Google’s use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the internet. You can opt out of personalised advertising by visiting Google Ads Settings (adssettings.google.com), and you can opt out of some third-party vendors’ use of cookies for personalised advertising at aboutads.info.',
          'To learn how Google uses information from sites that use its services, see policies.google.com/technologies/partner-sites. Ads are not loaded until you interact with a page, and in regions where consent is required you will be asked for it before personalised ads are shown.',
        ],
      },
      {
        heading: 'Analytics',
        p: [
          'We use Vercel Web Analytics and Vercel Speed Insights to count page views and measure page performance. They do not use cookies, do not track you across other websites and report only aggregated data such as page, referrer, country and device type. They never receive the content you create in the app.',
        ],
      },
      {
        heading: 'Cookies and local storage',
        list: [
          'Local storage and IndexedDB: hold your work and your settings (theme, language, recent items). They stay on your device and are never sent to us.',
          'Advertising cookies: set by Google and its partners when ads load, as described above.',
          'A service worker caches the app’s files so it works offline. It stores code, not your data.',
        ],
      },
      {
        heading: 'Children',
        p: ['Portfolio OS is intended for people building job applications and is not directed at children under 13. We do not knowingly collect personal information from children.'],
      },
      {
        heading: 'Your rights and choices',
        p: [
          'Since we do not hold your content, you can view, export or delete it at any time yourself: use the Backup page to export, and clear this site’s data in your browser settings to delete it. For data held by Google for advertising, use Google Ads Settings or the controls in Google’s consent message. For anything else, contact us and we will respond within 30 days.',
        ],
      },
      {
        heading: 'Changes to this policy',
        p: [`If the way the site handles data changes, this page will be updated and the effective date below will change. Effective date: ${EFFECTIVE}.`],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Use — Portfolio OS',
    description: 'The terms for using Portfolio OS, the free browser-based portfolio website, resume and cover letter builder: your content, acceptable use and liability.',
    h1: 'Terms of use',
    intro: 'These terms apply to your use of portfolioos.online and the Portfolio OS app. By using the site you agree to them. They are written to be short and readable.',
    sections: [
      {
        heading: 'The service',
        p: [
          'Portfolio OS is a free tool for building portfolio websites, resumes, cover letters and related documents in your web browser, along with free guides and examples. It is provided as is, may change over time and may occasionally be unavailable.',
        ],
      },
      {
        heading: 'Your content belongs to you',
        p: [
          'You own everything you create with Portfolio OS. Because it is stored only in your browser, we have no access to it and claim no rights over it. You are responsible for keeping backups; we cannot restore lost data.',
          'Websites and documents you export, including the generated HTML, CSS and source code, are yours to use, modify, host and sell without attribution.',
        ],
      },
      {
        heading: 'Acceptable use',
        list: [
          'Do not use Portfolio OS to create content that is unlawful, fraudulent, defamatory or infringes someone else’s rights.',
          'Only include information, images and work samples you have the right to use.',
          'Represent your experience and qualifications honestly; you are responsible for the accuracy of documents you send to employers.',
          'Do not attempt to disrupt the site, interfere with ads or abuse third-party services connected through the app.',
        ],
      },
      {
        heading: 'Third-party services',
        p: [
          'Optional features such as the AI assistant and one-click deploy connect to services run by others (for example Anthropic, GitHub, Netlify and Vercel) using credentials you provide. Your use of those services is governed by their own terms and pricing.',
        ],
      },
      {
        heading: 'Guides and examples',
        p: [
          'Career guides, resume examples and portfolio examples are general information, not professional career, legal or financial advice. Sample names and companies in examples are fictional.',
        ],
      },
      {
        heading: 'No warranty and limitation of liability',
        p: [
          'Portfolio OS is provided without warranties of any kind. To the fullest extent permitted by law, we are not liable for any loss of data, lost opportunities or indirect damages arising from your use of the site. Nothing in these terms limits liability that cannot be limited by law.',
        ],
      },
      {
        heading: 'Changes and contact',
        p: [`We may update these terms; the effective date below shows when they last changed. Questions: ${CONTACT_EMAIL}. Effective date: ${EFFECTIVE}.`],
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact Portfolio OS — Feedback, Bugs and Questions',
    description: 'Get in touch with the maker of Portfolio OS to report a bug, suggest a template or feature, ask a privacy question or discuss a partnership.',
    h1: 'Contact',
    intro: 'Portfolio OS is built and maintained by one developer, Anubhab Guha, and every message is read personally. Here is how to reach me and what to include so I can help quickly.',
    sections: [
      {
        heading: 'Email',
        p: [`The best way to reach me is by email at ${CONTACT_EMAIL}. I usually reply within two working days.`],
      },
      {
        heading: 'Reporting a bug',
        p: ['Bugs get fixed fastest when I can reproduce them. Please include:'],
        list: [
          'The page you were on (copy the address bar, minus any share link payload).',
          'What you did, what you expected and what happened instead.',
          'Your browser and device, for example Chrome on Windows or Safari on iPhone.',
          'A screenshot if the problem is visual. Please do not send your personal data or a full backup file unless I ask for it.',
        ],
      },
      {
        heading: 'Feature and template requests',
        p: [
          'Tell me which role or profession you are building for and what is missing: a resume layout, a portfolio section, an export format or a guide you would like to read. Requests from real users decide what gets built next.',
        ],
      },
      {
        heading: 'Privacy questions',
        p: [
          'Your content is stored only in your browser, so I cannot look it up or delete it for you, but I am happy to explain how anything works. The privacy policy covers storage, ads and analytics in detail.',
        ],
      },
      {
        heading: 'About the maker',
        p: [
          'I am a software developer who built Portfolio OS to make a good portfolio and resume free and private for everyone. You can see more of my work on my personal site, anubhab-guha.vercel.app.',
        ],
      },
    ],
  },
];
