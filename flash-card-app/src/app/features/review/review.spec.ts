import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FlashcardStore } from '../../core/flashcard.store';
import { localDay } from '../../core/review-rules';
import { Flashcard } from '../../shared/models/flashcard.model';
import { Review } from './review';

describe('Review', () => {
  for (const training of [false, true]) {
    for (const revealed of [false, true]) {
      it(`preserves the card, face and progress when reporting (${training ? 'training' : 'review'}, ${revealed ? 'answer' : 'question'})`, async () => {
        const current: Flashcard = {
          id: 'one',
          question: 'Question',
          answer: 'Réponse',
          subject: null,
          column: 1,
          reported: false,
          reviewIntervalStartedOn: '2026-01-01',
        };
        const cards = signal([current]);
        const saving = signal(false);
        const error = signal<string | null>(null);
        let complete!: (success: boolean) => void;
        const store = {
          cards,
          dueCards: computed(() => cards()),
          saving,
          error,
          loaded: signal(true),
          loading: signal(false),
          setReported: vi.fn(async (id: string, reported: boolean) => {
            saving.set(true);
            const success = await new Promise<boolean>((resolve) => {
              complete = resolve;
            });
            if (success)
              cards.update((values) =>
                values.map((card) => (card.id === id ? { ...card, reported } : card)),
              );
            else error.set('Enregistrement impossible');
            saving.set(false);
            return success;
          }),
        };
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
        await TestBed.configureTestingModule({
          imports: [Review],
          providers: [
            provideRouter([]),
            { provide: FlashcardStore, useValue: store },
            {
              provide: ActivatedRoute,
              useValue: { snapshot: { queryParamMap: new Map(training ? [['etape', '1']] : []) } },
            },
          ],
        }).compileComponents();
        const fixture = TestBed.createComponent(Review);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        if (revealed) {
          root.querySelector<HTMLButtonElement>('.review-actions button')!.click();
          fixture.detectChanges();
        }
        const report = () => root.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
        const flipped = () =>
          root.querySelector('.card-flipper')!.classList.contains('is-revealed');
        for (const success of [false, true, true]) {
          report().click();
          fixture.detectChanges();
          expect(report().disabled).toBe(true);
          expect(root.querySelector<HTMLButtonElement>('.review-actions button')!.disabled).toBe(
            true,
          );
          expect(flipped()).toBe(revealed);
          complete(success);
          await fixture.whenStable();
          fixture.detectChanges();
          expect(flipped()).toBe(revealed);
          expect(cards()[0]).toEqual({
            ...current,
            reported: success && store.setReported.mock.calls.length === 2,
          });
          expect(root.querySelector('.session-meta')!.textContent).toContain('1');
          expect(report().getAttribute('aria-pressed')).toBe(String(cards()[0].reported));
          expect(root.querySelector('.study-card')!.classList.contains('reported')).toBe(
            cards()[0].reported,
          );
        }
        vi.unstubAllGlobals();
      });
    }
  }

  it('keeps the revealed card until the answer is saved', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const card: Flashcard = {
      id: 'one',
      question: 'Question',
      answer: 'Réponse',
      subject: null,
      column: 1,
      reported: false,
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
