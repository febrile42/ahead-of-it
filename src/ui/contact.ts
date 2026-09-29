// PH1-04: the single contact line every panel and the checklist end with
// (R-12). The email is assembled here, at runtime, from content.json's
// split { user, domain } fields — the joined address is never written as
// a literal anywhere in source, so it never appears as a plain string in
// dist/ either (checked by tests/scene.spec.ts).
import { track } from '../analytics';
import { getContact } from '../content';

export function assembleEmail(): string {
  const { email } = getContact();
  return `${email.user}@${email.domain}`;
}

export function createContactLine(): HTMLElement {
  const contact = getContact();
  const p = document.createElement('p');
  p.className = 'contact-line';

  const linkedin = document.createElement('a');
  linkedin.href = contact.linkedin;
  linkedin.textContent = 'LinkedIn';
  linkedin.rel = 'noopener noreferrer';
  linkedin.target = '_blank';
  linkedin.addEventListener('click', () => track('contact_click')); // D-016

  const email = document.createElement('a');
  // href is set from the two separate content fields at render time —
  // R-12/D-019: never a plain mailto: string in the source.
  email.href = `mailto:${assembleEmail()}`;
  email.textContent = 'Talk to Josh';
  email.addEventListener('click', () => track('contact_click')); // D-016

  p.append(linkedin, document.createTextNode(' · '), email);
  return p;
}
