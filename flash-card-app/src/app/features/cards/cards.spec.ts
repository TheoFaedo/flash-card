import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FlashcardStore } from '../../core/flashcard.store';
import { Subject } from '../../shared/flashcard.model';
import { Cards } from './cards';

describe('Cards', () => {
  beforeEach(() => {
    localStorage.removeItem('flashcard.cards.v1');
    localStorage.removeItem('flashcard.data.v2');
  });

  afterEach(() => {
    localStorage.removeItem('flashcard.cards.v1');
    localStorage.removeItem('flashcard.data.v2');
    vi.restoreAllMocks();
  });

  async function setup() {
    await TestBed.configureTestingModule({ imports: [Cards] }).compileComponents();
    const store = TestBed.inject(FlashcardStore);
    const fixture = TestBed.createComponent(Cards);
    fixture.detectChanges();
    return { fixture, store, root: fixture.nativeElement as HTMLElement };
  }

  function enter(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('adds a subject and creates a card without one', async () => {
    const { fixture, store, root } = await setup();
    enter(root.querySelector('#subject-name')!, '  Géographie  ');
    root.querySelector('.subjects-panel form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(store.subjects()).toContain('Géographie');
    expect(root.querySelector('#subject')?.textContent).toContain('Géographie');

    enter(root.querySelector('#question')!, 'Où ?');
    enter(root.querySelector('#answer')!, 'Ici.');
    const select = root.querySelector('#subject') as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    root.querySelector('.editor-panel > form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(store.cards()[0].subject).toBeNull();
    expect(root.querySelector('.mini-subject')?.textContent).toBe('Sans sujet');
  });

  it('removes an assigned subject while keeping its cards', async () => {
    const { fixture, store, root } = await setup();
    store.add({ question: 'Pourquoi ?', answer: 'Parce que.', subject: Subject.History });
    fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const button = [...root.querySelectorAll<HTMLButtonElement>('.subject-list button')]
      .find((item) => item.getAttribute('aria-label') === `Retirer le sujet ${Subject.History}`)!;
    button.click();
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 carte passera'));
    expect(store.cards()[0].subject).toBeNull();
    expect(store.subjects()).not.toContain(Subject.History);
    expect(root.querySelector('.mini-subject')?.textContent).toBe('Sans sujet');
  });
});
