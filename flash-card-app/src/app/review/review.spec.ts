import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Flashcard, Subject } from '../flashcards/flashcard.model';
import { FlashcardStore } from '../flashcards/flashcard.store';
import { localDay } from '../flashcards/review-rules';
import { Review } from './review';

describe('Review', () => {
  const key = 'flashcard.cards.v1';

  beforeEach(() => localStorage.removeItem(key));
  afterEach(() => localStorage.removeItem(key));

  it('reveals the answer and records a self-assessed correct response', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const card: Flashcard = {
      id: 'test-card',
      question: 'Quelle est la question ?',
      answer: 'Voici la réponse.',
      subject: Subject.General,
      column: 1,
      reviewIntervalStartedOn: localDay(yesterday),
    };
    localStorage.setItem(key, JSON.stringify([card]));

    await TestBed.configureTestingModule({
      imports: [Review],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Review);
    const store = TestBed.inject(FlashcardStore);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(card.question);
    expect(fixture.nativeElement.textContent).not.toContain(card.answer);

    (fixture.nativeElement.querySelector('.review-actions button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(card.answer);

    (fixture.nativeElement.querySelector('.button-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(store.cards()[0].column).toBe(2);
    expect(store.cards()[0].reviewIntervalStartedOn).toBe(localDay(new Date()));
    expect(fixture.nativeElement.textContent).toContain('Aucune carte à réviser aujourd’hui');
  });
});
