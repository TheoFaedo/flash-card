import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FlashcardStore } from '../../core/flashcard.store';
import { Cards } from './cards';

describe('Cards', () => {
  it('keeps the draft until Supabase confirms a new card', async () => {
    let confirmSave!: (saved: boolean) => void;
    const save = new Promise<boolean>((resolve) => {
      confirmSave = resolve;
    });
    const store = {
      cards: signal([]),
      subjects: signal(['Général']),
      loading: signal(false),
      loaded: signal(true),
      saving: signal(false),
      error: signal(null),
      add: vi.fn(() => save),
    };
    await TestBed.configureTestingModule({
      imports: [Cards],
      providers: [{ provide: FlashcardStore, useValue: store }],
    }).compileComponents();
    const fixture = TestBed.createComponent(Cards);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    for (const [selector, value] of [
      ['#question', 'Question'],
      ['#answer', 'Réponse'],
    ]) {
      const field = root.querySelector<HTMLTextAreaElement>(selector)!;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    root
      .querySelector<HTMLFormElement>('.editor-panel > form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(store.add).toHaveBeenCalledOnce();
    expect((root.querySelector('#question') as HTMLTextAreaElement).value).toBe('Question');
    confirmSave(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect((root.querySelector('#question') as HTMLTextAreaElement).value).toBe('');
  });
});
