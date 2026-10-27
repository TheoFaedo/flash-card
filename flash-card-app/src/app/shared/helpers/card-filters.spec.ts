import { initialCardFilters, matchesCardFilters, matchesReported } from './card-filters';
import { Flashcard } from '../models/flashcard.model';

const card: Flashcard = {
  id: '1',
  question: 'Q',
  answer: 'R',
  subject: null,
  column: 1,
  reported: true,
  reviewIntervalStartedOn: '2026-10-01',
};

describe('card filters', () => {
  it('creates independent initial and reset values', () => {
    const filters = initialCardFilters();
    filters.reported = true;
    expect(initialCardFilters()).toEqual({ reported: null });
  });
  it('matches all cards or either reported state without mutating them', () => {
    for (const reported of [true, false]) {
      const value = { ...card, reported };
      expect(matchesReported(value, null)).toBe(true);
      expect(matchesReported(value, reported)).toBe(true);
      expect(matchesReported(value, !reported)).toBe(false);
      expect(matchesCardFilters(value, { reported: true })).toBe(reported);
      expect(value).toEqual({ ...card, reported });
    }
  });
});
