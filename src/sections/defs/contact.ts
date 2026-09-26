import type { SectionDefinition } from '../types';
import { esc, hasText, headingField, link } from '../helpers';
import type { DocRun } from '@/types/document';
import { socialIconFor } from '../icons';
import { safeHref } from '@/utils/url';

export const contactSection: SectionDefinition<'contact'> = {
  type: 'contact',
  label: 'Contact',
  description: 'Email, phone, location and an email-composing form.',
  icon: 'Mail',
  category: 'essentials',
  singleton: true,
  createData: () => ({
    heading: "Let's work together",
    body: 'Have a project in mind or just want to say hello? My inbox is open.',
    email: 'hello@example.com',
    phone: '',
    location: '',
    availability: '',
    showForm: true,
  }),
  fields: [
    headingField,
    { kind: 'markdown', key: 'body', label: 'Message' },
    { kind: 'email', key: 'email', label: 'Email' },
    { kind: 'tel', key: 'phone', label: 'Phone' },
    { kind: 'text', key: 'location', label: 'Location' },
    { kind: 'text', key: 'availability', label: 'Availability', placeholder: 'e.g. Booking projects from March' },
    { kind: 'toggle', key: 'showForm', label: 'Show contact form', help: "Opens the visitor's email app with the message pre-filled (mailto:). No server involved." },
  ],
  heading: (d) => d.heading,
  isEmpty: (d) => !hasText(d.email) && !hasText(d.phone),
  images: () => [],
  links: (d) => (hasText(d.email) ? [{ url: `mailto:${d.email}`, label: 'Contact email' }] : []),
  render(d, ctx) {
    const email = d.email.trim();
    const items = [
      hasText(email) ? `<li>${ctx.icon('mail')}${link(`mailto:${email}`, esc(email))}</li>` : '',
      hasText(d.phone) ? `<li>${ctx.icon('phone')}${link(`tel:${d.phone.replace(/[^\d+]/g, '')}`, esc(d.phone))}</li>` : '',
      hasText(d.location) ? `<li>${ctx.icon('map-pin')}<span>${esc(d.location)}</span></li>` : '',
    ].join('');
    const socials = ctx
      .socialLinks()
      .filter((s) => safeHref(s.url))
      .map((s) => link(s.url, ctx.icon(socialIconFor(s.platform, s.url)), 'social-icon', `aria-label="${esc(s.label || s.platform)}"`))
      .join('');
    const form =
      d.showForm && hasText(email)
        ? `<form class="contact-form card" data-mailto="${esc(email)}" novalidate data-anim-child>
  <div class="field"><label for="cf-name">Name</label><input id="cf-name" name="name" autocomplete="name" required></div>
  <div class="field"><label for="cf-email">Your email</label><input id="cf-email" name="email" type="email" autocomplete="email" required></div>
  <div class="field"><label for="cf-message">Message</label><textarea id="cf-message" name="message" rows="5" required></textarea></div>
  <button class="btn btn--primary" type="submit"><span>Compose email</span>${ctx.icon('arrow-right')}</button>
  <p class="form-note">Opens your email app — nothing is sent from this page.</p>
</form>`
        : '';
    return `<div class="contact${form ? ' has-form' : ''}">
  <div class="contact-copy">
    ${hasText(d.heading) ? `<h2 class="section-title contact-title" data-anim-child>${esc(d.heading)}</h2>` : ''}
    ${hasText(d.body) ? `<div class="prose" data-anim-child>${ctx.markdown(d.body)}</div>` : ''}
    ${hasText(d.availability) ? `<p class="hero-badge" data-anim-child><span class="pulse" aria-hidden="true"></span>${esc(d.availability)}</p>` : ''}
    ${items ? `<ul class="contact-list" role="list" data-anim-child>${items}</ul>` : ''}
    ${socials ? `<div class="hero-social" data-anim-child>${socials}</div>` : ''}
  </div>
  ${form}
</div>`;
  },
  toDocument(d, ctx) {
    const runs: DocRun[] = [];
    const push = (r: DocRun) => {
      if (runs.length) runs.push({ text: '  ·  ' });
      runs.push(r);
    };
    if (hasText(d.email)) push({ text: d.email, link: `mailto:${d.email}` });
    if (hasText(d.phone)) push({ text: d.phone });
    if (hasText(d.location)) push({ text: d.location });
    return [...ctx.markdownBlocks(d.body), ...(runs.length ? [{ kind: 'contact' as const, items: runs }] : [])];
  },
};
