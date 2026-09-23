import { FlashcardStore } from './flashcard.store';
import { Subject } from './flashcard.model';
import { isDue, localDay } from './review-rules';
import { TestBed } from '@angular/core/testing';

describe('FlashcardStore', () => {
  const key = 'flashcard.cards.v1';

  beforeEach(() => localStorage.removeItem(key));
  afterEach(() => localStorage.removeItem(key));

  it('is available to routed components through Angular injection', () => {
    const store = TestBed.inject(FlashcardStore);
    expect(store.cards()).toEqual([]);
  });

  it('persists a new card with an interval beginning today', () => {
    const store = new FlashcardStore();
    const content = { question: 'Pourquoi ?', answer: 'Parce que.', subject: Subject.General };

    expect(store.add(content)).toBe(true);
    expect(store.cards()).toHaveLength(1);
    expect(store.cards()[0].reviewIntervalStartedOn).toBe(localDay(new Date()));
    expect(isDue(store.cards()[0], localDay(new Date()))).toBe(false);

    const restored = new FlashcardStore();
    expect(restored.cards()).toEqual(store.cards());
    store.ngOnDestroy();
    restored.ngOnDestroy();
  });

  it('saves the new column and interval start after an answer', () => {
    const store = new FlashcardStore();
    store.add({ question: 'Q', answer: 'R', subject: Subject.General });
    const id = store.cards()[0].id;

    expect(store.answer(id, true)).toBe(true);
    expect(store.cards()[0].column).toBe(2);
    expect(store.cards()[0].reviewIntervalStartedOn).toBe(localDay(new Date()));

    const restored = new FlashcardStore();
    expect(restored.cards()[0].column).toBe(2);
    store.ngOnDestroy();
    restored.ngOnDestroy();
  });
});
