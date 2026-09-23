import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Flashcard, Subject } from '../../shared/flashcard.model';
import { FlashcardStore } from '../../core/flashcard.store';
import { localDay } from '../../core/review-rules';
import { Review } from './review';

describe('Review', () => {
  const key = 'flashcard.cards.v1';
  const currentKey = 'flashcard.data.v2';

  beforeEach(() => {
    localStorage.removeItem(key);
    localStorage.removeItem(currentKey);
  });
  afterEach(() => {
    localStorage.removeItem(key);
    localStorage.removeItem(currentKey);
    vi.unstubAllGlobals();
  });

  function dueCard(id: string): Flashcard {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      id,
      question: `Question ${id} ?`,
      answer: `Réponse ${id}.`,
      subject: Subject.General,
      column: 1,
      reviewIntervalStartedOn: localDay(yesterday),
    };
  }

  async function setup(cards: Flashcard[]) {
    localStorage.setItem(key, JSON.stringify(cards));
    await TestBed.configureTestingModule({
      imports: [Review],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Review);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, store: TestBed.inject(FlashcardStore) };
  }

  function finishFlip(root: HTMLElement): void {
    const flipper = root.querySelector('.card-flipper')!;
    const event = new Event('transitionend', { bubbles: true });
    Object.defineProperty(event, 'propertyName', { value: 'transform' });
    flipper.dispatchEvent(event);
  }

  it('shows evaluation after the flip and presents the next question without a reverse flip', async () => {
    const { fixture, root, store } = await setup([dueCard('one'), dueCard('two')]);
    const revealButton = root.querySelector('.review-actions button') as HTMLButtonElement;

    expect(root.querySelector('.card-front')?.getAttribute('aria-hidden')).toBe('false');
    expect(root.querySelector('.card-back')?.getAttribute('aria-hidden')).toBe('true');
    revealButton.click();
    revealButton.click();
    fixture.detectChanges();

    expect(root.querySelector('.card-flipper')?.classList.contains('is-flipping')).toBe(true);
    expect(revealButton.getAttribute('aria-disabled')).toBe('true');
    expect(root.querySelector('.action-row')).toBeNull();
    expect(root.querySelector('.card-back')?.getAttribute('aria-hidden')).toBe('true');

    finishFlip(root);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root.querySelector('.card-flipper')?.classList.contains('is-revealed')).toBe(true);
    expect(root.querySelector('.card-back')?.getAttribute('aria-hidden')).toBe('false');
    expect(root.querySelector('.card-front')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(root.querySelector('.action-row .button-primary'));

    (root.querySelector('.action-row .button-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(store.cards().find((card) => card.id === 'one')?.column).toBe(2);
    expect(root.querySelector('.card-front')?.textContent).toContain('Question two ?');
    expect(root.querySelector('.card-flipper')?.classList.contains('is-flipping')).toBe(false);
    expect(root.querySelector('.card-flipper')?.classList.contains('is-revealed')).toBe(false);
    expect(root.querySelector('.card-front')?.getAttribute('aria-hidden')).toBe('false');
    expect(root.querySelector('.action-row')).toBeNull();
  });

  it('shows the answer immediately when reduced motion is preferred', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const { fixture, root } = await setup([dueCard('one')]);

    (root.querySelector('.review-actions button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(root.querySelector('.card-flipper')?.classList.contains('is-revealed')).toBe(true);
    expect(root.querySelector('.card-flipper')?.classList.contains('is-flipping')).toBe(false);
    expect(root.querySelector('.action-row')).not.toBeNull();
    expect(root.querySelector('.card-back')?.getAttribute('aria-hidden')).toBe('false');
  });

  it('shows Sans sujet on both sides of an unassigned card', async () => {
    localStorage.setItem(currentKey, JSON.stringify({ subjects: [], cards: [{ ...dueCard('one'), subject: null }] }));
    const { fixture, root } = await setup([]);

    expect(root.querySelector('.card-front .card-topline')?.textContent).toContain('Sans sujet');
    (root.querySelector('.review-actions button') as HTMLButtonElement).click();
    finishFlip(root);
    fixture.detectChanges();
    expect(root.querySelector('.card-back .card-topline')?.textContent).toContain('Sans sujet');
  });
});
