import { FlashcardStore } from './flashcard.store';
import { Subject } from '../shared/flashcard.model';
import { isDue, localDay } from './review-rules';
import { TestBed } from '@angular/core/testing';

describe('FlashcardStore', () => {
  const legacyKey = 'flashcard.cards.v1';
  const key = 'flashcard.data.v2';

  beforeEach(() => {
    localStorage.removeItem(key);
    localStorage.removeItem(legacyKey);
  });
  afterEach(() => {
    localStorage.removeItem(key);
    localStorage.removeItem(legacyKey);
  });

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

  it('loads legacy cards and retains them when subjects are changed', () => {
    localStorage.setItem(legacyKey, JSON.stringify([{
      id: 'old', question: 'Question', answer: 'Réponse', subject: Subject.History,
      column: 2, reviewIntervalStartedOn: localDay(new Date()),
    }]));
    const store = new FlashcardStore();

    expect(store.cards()[0].subject).toBe(Subject.History);
    expect(store.subjects()).toContain(Subject.History);
    expect(store.addSubject('  Géographie   humaine  ')).toBe(true);
    expect(store.subjects()).toContain('Géographie humaine');
    expect(store.removeSubject(Subject.History)).toBe(true);
    expect(store.cards()[0]).toMatchObject({ id: 'old', subject: null, column: 2 });

    const restored = new FlashcardStore();
    expect(restored.cards()).toEqual(store.cards());
    expect(restored.subjects()).toEqual(store.subjects());
    expect(localStorage.getItem(legacyKey)).not.toBeNull();
    store.ngOnDestroy();
    restored.ngOnDestroy();
  });

  it('rejects invalid or duplicate subjects and permits removing the last one', () => {
    const store = new FlashcardStore();
    expect(store.addSubject('   ')).toBe(false);
    expect(store.addSubject('x'.repeat(51))).toBe(false);
    expect(store.addSubject('  GÉNÉRAL  ')).toBe(false);
    expect(store.subjects()).toHaveLength(5);

    for (const subject of [...store.subjects()]) expect(store.removeSubject(subject)).toBe(true);
    expect(store.subjects()).toEqual([]);
    expect(store.add({ question: 'Q', answer: 'R', subject: null })).toBe(true);
    expect(store.add({ question: 'Q2', answer: 'R2', subject: Subject.General })).toBe(false);

    const restored = new FlashcardStore();
    expect(restored.subjects()).toEqual([]);
    expect(restored.cards()[0].subject).toBeNull();
    store.ngOnDestroy();
    restored.ngOnDestroy();
  });

  it('does not load malformed current data or overwrite it', async () => {
    const invalid = JSON.stringify({ subjects: [], cards: [{ subject: Subject.General }] });
    localStorage.setItem(key, invalid);
    const store = new FlashcardStore();
    await Promise.resolve();

    expect(store.storageError()).toBe(true);
    expect(store.addSubject('Autre')).toBe(false);
    expect(localStorage.getItem(key)).toBe(invalid);
    store.ngOnDestroy();
  });
});
