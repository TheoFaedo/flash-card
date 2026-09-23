import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FlashcardStore } from '../../core/flashcard.store';
import { localDay } from '../../core/review-rules';
import { Flashcard } from '../../shared/flashcard.model';
import { Review } from './review';

describe('Review', () => {
  it('keeps the revealed card until the answer is saved', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const card: Flashcard = {
      id: 'one',
      question: 'Question',
      answer: 'Réponse',
      subject: null,
      column: 1,
      reviewIntervalStartedOn: localDay(yesterday),
    };
    let confirmSave!: (saved: boolean) => void;
    const save = new Promise<boolean>((resolve) => {
      confirmSave = resolve;
    });
    const store = {
      dueCards: signal([card]),
      cards: signal([card]),
      loading: signal(false),
      loaded: signal(true),
      saving: signal(false),
      error: signal(null),
      answer: vi.fn(() => save),
    };
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    await TestBed.configureTestingModule({
      imports: [Review],
      providers: [provideRouter([]), { provide: FlashcardStore, useValue: store }],
    }).compileComponents();
    const fixture = TestBed.createComponent(Review);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.review-actions button')!.click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.action-row .button-primary')!.click();
    fixture.detectChanges();
    expect(store.answer).toHaveBeenCalledWith('one', true);
    expect(root.querySelector('.card-flipper')?.classList.contains('is-revealed')).toBe(true);
    confirmSave(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('.card-flipper')?.classList.contains('is-revealed')).toBe(false);
    vi.unstubAllGlobals();
  });
});
