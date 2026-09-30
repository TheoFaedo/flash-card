import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FlashcardStore } from '../../core/flashcard.store';
import { Flashcard } from '../../shared/flashcard.model';
import { Cards } from './cards';

describe('Cards', () => {
  let resize: ResizeObserverCallback;

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  function card(id: string, column: Flashcard['column']): Flashcard {
    return {
      id,
      column,
      question: `Question ${id}`,
      answer: `Réponse ${id}`,
      subject: null,
      reviewIntervalStartedOn: '2026-09-01',
    };
  }

  async function createPage(cards: Flashcard[], add = vi.fn()): Promise<{
    fixture: ComponentFixture<Cards>;
    root: HTMLElement;
  }> {
    const store = {
      cards: signal(cards),
      subjects: signal(['Général']),
      loading: signal(false),
      loaded: signal(true),
      saving: signal(false),
      error: signal(null),
      add,
    };
    await TestBed.configureTestingModule({
      imports: [Cards],
      providers: [provideRouter([]), { provide: FlashcardStore, useValue: store }],
    }).compileComponents();
    const fixture = TestBed.createComponent(Cards);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  function setGridWidth(root: HTMLElement, fixture: ComponentFixture<Cards>, width: number): void {
    const grid = root.querySelector<HTMLElement>('#cards-step-1')!;
    grid.style.setProperty('--card-min-width', '220px');
    grid.style.columnGap = '8px';
    Object.defineProperty(grid, 'clientWidth', { configurable: true, value: width });
    resize([], {} as ResizeObserver);
    fixture.detectChanges();
  }

  it('keeps the draft until Supabase confirms a new card', async () => {
    let confirmSave!: (saved: boolean) => void;
    const save = new Promise<boolean>((resolve) => {
      confirmSave = resolve;
    });
    const add = vi.fn(() => save);
    const { fixture, root } = await createPage([], add);
    for (const [selector, value] of [
      ['#question', 'Question'],
      ['#answer', 'Réponse'],
    ]) {
      const field = root.querySelector<HTMLTextAreaElement>(selector)!;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    root
      .querySelector<HTMLFormElement>('.card-editor form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(add).toHaveBeenCalledOnce();
    expect((root.querySelector('#question') as HTMLTextAreaElement).value).toBe('Question');
    confirmSave(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect((root.querySelector('#question') as HTMLTextAreaElement).value).toBe('');
  });

  it('shows a toggle only for stages that overflow the first row', async () => {
    const { fixture, root } = await createPage([
      card('1', 1), card('2', 1), card('3', 1),
      card('4', 2), card('5', 2),
    ]);
    setGridWidth(root, fixture, 500); // Two cards fit per row.

    const rows = root.querySelectorAll<HTMLElement>('.review-row');
    expect(rows[0].querySelectorAll('#cards-step-1 .mini-card')).toHaveLength(2);
    expect(rows[0].querySelectorAll('.row-preview .mini-card')).toHaveLength(1);
    expect(rows[0].querySelector('.row-preview')?.getAttribute('aria-hidden')).toBe('true');
    expect(rows[0].querySelector('.row-preview button')).toBeNull();
    expect(rows[0].querySelector('.row-toggle')?.textContent).toContain('Voir l’autre carte');
    expect(rows[0].querySelector('.row-toggle')?.textContent).toContain('↓');
    expect(rows[1].querySelectorAll('#cards-step-2 .mini-card')).toHaveLength(2);
    expect(rows[1].querySelector('.row-toggle')).toBeNull();
    expect(rows[1].querySelector('.row-preview')).toBeNull();
    expect(rows[2].querySelector('.row-empty')?.textContent).toContain('Aucune carte');
    expect(rows[2].querySelector('.row-toggle')).toBeNull();
    expect(rows[2].querySelector('.row-preview')).toBeNull();
  });

  it('opens and closes stages independently while keeping card actions', async () => {
    const { fixture, root } = await createPage([
      card('1', 1), card('2', 1), card('3', 1),
      card('4', 2), card('5', 2), card('6', 2),
    ]);
    setGridWidth(root, fixture, 500);
    const rows = root.querySelectorAll<HTMLElement>('.review-row');
    const firstToggle = rows[0].querySelector<HTMLButtonElement>('.row-toggle')!;
    firstToggle.click();
    fixture.detectChanges();

    expect(firstToggle.getAttribute('aria-expanded')).toBe('true');
    expect(firstToggle.textContent).toContain('Voir moins');
    expect(firstToggle.textContent).toContain('↑');
    expect(rows[0].querySelector('.row-preview')).toBeNull();
    expect(rows[0].querySelectorAll('#cards-step-1 .mini-card')).toHaveLength(3);
    expect(rows[0].querySelectorAll('.mini-actions button')).toHaveLength(6);
    expect(rows[1].querySelectorAll('#cards-step-2 .mini-card')).toHaveLength(2);
    expect(rows[1].querySelector('.row-toggle')?.getAttribute('aria-expanded')).toBe('false');

    firstToggle.click();
    fixture.detectChanges();
    expect(firstToggle.getAttribute('aria-expanded')).toBe('false');
    expect(rows[0].querySelectorAll('#cards-step-1 .mini-card')).toHaveLength(2);
    expect(rows[0].querySelectorAll('.row-preview .mini-card')).toHaveLength(1);
  });

  it('previews only the cards on the next line', async () => {
    const { fixture, root } = await createPage([
      card('1', 1), card('2', 1), card('3', 1), card('4', 1), card('5', 1),
    ]);
    setGridWidth(root, fixture, 500);
    const row = root.querySelector<HTMLElement>('.review-row')!;
    const previewQuestions = Array.from(row.querySelectorAll('.row-preview h4'), (heading) => heading.textContent);
    expect(previewQuestions).toEqual(['Question 3', 'Question 4']);
    expect(row.querySelector('.row-toggle')?.textContent).toContain('Voir les 3 autres cartes');
  });

  it('recalculates the first row when the grid changes width', async () => {
    const { fixture, root } = await createPage([
      card('1', 1), card('2', 1), card('3', 1), card('4', 1),
    ]);
    const row = root.querySelector<HTMLElement>('.review-row')!;
    setGridWidth(root, fixture, 700);
    expect(row.querySelectorAll('#cards-step-1 .mini-card')).toHaveLength(3);
    expect(row.querySelectorAll('.row-preview .mini-card')).toHaveLength(1);
    expect(row.querySelector<HTMLElement>('.preview-cards')?.style.getPropertyValue('--preview-columns')).toBe('3');
    expect(row.querySelector('.row-toggle')?.textContent).toContain('Voir l’autre carte');
    setGridWidth(root, fixture, 300);
    expect(row.querySelectorAll('#cards-step-1 .mini-card')).toHaveLength(1);
    expect(row.querySelectorAll('.row-preview .mini-card')).toHaveLength(1);
    expect(row.querySelector<HTMLElement>('.preview-cards')?.style.getPropertyValue('--preview-columns')).toBe('1');
    expect(row.querySelector('.row-toggle')?.textContent).toContain('Voir les 3 autres cartes');
    setGridWidth(root, fixture, 950);
    expect(row.querySelectorAll('#cards-step-1 .mini-card')).toHaveLength(4);
    expect(row.querySelector('.row-toggle')).toBeNull();
    expect(row.querySelector('.row-preview')).toBeNull();
  });
});
