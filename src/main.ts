import { HEADING } from './constants';

// PH1-01 scaffold: placeholder page only, no product UI (title and the
// noindex meta tag live in index.html so they are present even without JS).
const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const heading = document.createElement('h1');
  heading.textContent = HEADING;
  app.append(heading);
}
