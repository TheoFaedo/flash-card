import { Flashcard, REVIEW_INTERVALS, Subject } from '../shared/flashcard.model';
import { answerCard, dueOn, isDue } from './review-rules';

const card: Flashcard = {
  id: 'one',
  question: 'Question',
  answer: 'Réponse',
  subject: Subject.General,
  column: 1,
  reviewIntervalStartedOn: '2026-09-23',
};

describe('review rules', () => {
  it('makes a newly added card due on the next local calendar day', () => {
    expect(isDue(card, '2026-09-23')).toBe(false);
    expect(isDue(card, '2026-09-24')).toBe(true);
  });

  it('uses all seven Fibonacci intervals', () => {
    expect(REVIEW_INTERVALS).toEqual([1, 2, 3, 5, 8, 13, 21]);
    expect(dueOn({ ...card, column: 4 })).toBe('2026-09-28');
    expect(dueOn({ ...card, column: 7 })).toBe('2026-10-14');
  });

  it('moves one column in the answer direction and restarts the interval', () => {
    expect(answerCard({ ...card, column: 4 }, true, '2026-09-30')).toMatchObject({
      column: 5,
      reviewIntervalStartedOn: '2026-09-30',
    });
    expect(answerCard({ ...card, column: 4 }, false, '2026-09-30')).toMatchObject({
      column: 3,
      reviewIntervalStartedOn: '2026-09-30',
    });
  });

  it('stays within the first and last columns', () => {
    expect(answerCard(card, false, '2026-09-24').column).toBe(1);
    expect(answerCard({ ...card, column: 7 }, true, '2026-09-24').column).toBe(7);
  });
});
