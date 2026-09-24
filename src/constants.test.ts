import { describe, expect, it } from 'vitest';
import { HEADING, PAGE_TITLE } from './constants';

describe('placeholder page copy', () => {
  it('keeps the title and heading Josh signed off on (D-010)', () => {
    expect(PAGE_TITLE).toBe("Ahead of It — Josh Gister's résumé");
    expect(HEADING).toBe('Ahead of It');
  });
});
