import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { FlashcardStore } from '../../core/flashcard.store';
import { localDay } from '../../core/review-rules';
import { Flashcard } from '../../shared/models/flashcard.model';
import { Review } from './review';

describe('Review', () => {
  for (const training of ['review', 'stage', 'tomorrow']) {
    for (const revealed of [false, true]) {
      it(`preserves the card, face and progress when reporting (${training}, ${revealed ? 'answer' : 'question'})`, async () => {
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
          tomorrowCards: computed(() => cards()),
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
              useValue: {
                snapshot: {
                  queryParamMap: convertToParamMap(
                    training === 'tomorrow'
                      ? { entrainement: 'demain' }
                      : training === 'stage'
                        ? { etape: '1' }
                        : {},
                  ),
                },
                queryParamMap: of(
                  convertToParamMap(
                    training === 'tomorrow'
                      ? { entrainement: 'demain' }
                      : training === 'stage'
                        ? { etape: '1' }
                        : {},
                  ),
                ),
              },
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
        const report = () => root.querySelector<HTMLInputElement>('.report-checkbox input')!;
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
          await store.setReported.mock.results.at(-1)!.value;
          await fixture.whenStable();
          fixture.detectChanges();
          expect(flipped()).toBe(revealed);
          expect(cards()[0]).toEqual({
            ...current,
            reported: success && store.setReported.mock.calls.length === 2,
          });
          expect(root.querySelector('.session-meta')!.textContent).toContain('1');
          expect(report().checked).toBe(cards()[0].reported);
          expect(root.querySelector('.card-front')!.classList.contains('reported')).toBe(
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
      tomorrowCards: signal([]),
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

describe('Review training navigation', () => {
  const makeCard = (id: string, column: Flashcard['column'] = 1): Flashcard => ({
    id,
    column,
    question: `Question ${id}`,
    answer: `Réponse ${id}`,
    reported: false,
    subject: null,
    reviewIntervalStartedOn: '2026-10-27',
  });

  async function setup(url = '/', tomorrow = [makeCard('one'), makeCard('two', 3)]) {
    const store = {
      cards: signal([...tomorrow, makeCard('other', 7)]),
      dueCards: signal<Flashcard[]>([]),
      tomorrowCards: signal(tomorrow),
      loaded: signal(true),
      loading: signal(false),
      saving: signal(false),
      error: signal(null),
      answer: vi.fn(),
      setReported: vi.fn().mockResolvedValue(true),
    };
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: Review }]),
        { provide: FlashcardStore, useValue: store },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    const root = () => harness.routeNativeElement!;
    const button = (label: string) =>
      Array.from(root().querySelectorAll('button')).find(
        (element) => element.textContent?.trim() === label,
      )!;
    const click = async (label: string) => {
      button(label).click();
      await harness.fixture.whenStable();
    };
    return { store, harness, root, button, click };
  }

  afterEach(() => vi.unstubAllGlobals());

  it('starts from a completed daily session, freezes the selection, and finishes without recording answers', async () => {
    const { store, harness, root, click } = await setup();
    expect(root().textContent).toContain('Aucune carte à réviser aujourd’hui');
    const component = harness.routeDebugElement!.componentInstance;
    const original = structuredClone(store.cards());
    await click('S’entraîner sur la session de demain');
    expect(TestBed.inject(Router).url).toBe('/?entrainement=demain');
    expect(harness.routeDebugElement!.componentInstance).toBe(component);
    expect(root().querySelector('h1')!.textContent).toContain(
      'S’entraîner sur la session de demain',
    );
    expect(root().querySelector('.session-meta')!.textContent).toContain('2 cartes restantes');
    expect(root().querySelector('.card-front .card-text')!.textContent).toBe('Question one');
    store.tomorrowCards.set([makeCard('other', 7)]);
    await click('Voir la réponse');
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement?.textContent?.trim()).toBe('Carte suivante');
    await click('Carte suivante');
    expect(root().querySelector('.session-meta')!.textContent).toContain('1 carte restante');
    expect(root().querySelector('.stage-label')!.textContent).toContain('Étape 3');
    expect(root().querySelector('.card-front .card-text')!.textContent).toBe('Question two');
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement?.textContent?.trim()).toBe('Voir la réponse');
    await click('Voir la réponse');
    await click('Carte suivante');
    expect(root().textContent).toContain('Entraînement terminé');
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement).toBe(root().querySelector('h2'));
    expect(store.answer).not.toHaveBeenCalled();
    expect(store.cards()).toEqual(original);
    root().querySelector<HTMLAnchorElement>('a[href="/"]')!.click();
    await harness.fixture.whenStable();
    expect(root().querySelector('h1')!.textContent).toContain('Réviser aujourd’hui');
  });

  it('supports direct links, prioritizes tomorrow and resets the face on mode changes', async () => {
    const { harness, root, click } = await setup('/?entrainement=demain&etape=7');
    expect(root().querySelector('.card-front .card-text')!.textContent).toBe('Question one');
    await click('Voir la réponse');
    await harness.navigateByUrl('/?etape=7');
    expect(root().querySelector('h1')!.textContent).toContain('S’entraîner sur une étape');
    expect(root().querySelector('.card-front .card-text')!.textContent).toBe('Question other');
    expect(root().querySelector('.is-revealed')).toBeNull();
    await click('Voir la réponse');
    await click('Carte suivante');
    expect(root().textContent).toContain('Entraînement terminé');
    await harness.navigateByUrl('/?entrainement=demain');
    expect(root().querySelector('.card-front .card-text')!.textContent).toBe('Question one');
  });

  it('distinguishes an empty session and disables the daily button with an explanation', async () => {
    const { harness, root, button } = await setup('/?entrainement=demain', []);
    expect(root().querySelector('h2')!.textContent).toContain('Aucune carte prévue pour demain');
    expect(root().textContent).not.toContain('Entraînement terminé');
    await harness.navigateByUrl('/');
    expect(button('S’entraîner sur la session de demain').disabled).toBe(true);
    expect(root().querySelector('#tomorrow-empty')!.textContent).toContain(
      'Aucune carte prévue pour demain',
    );
  });

  it('waits for the initial load before capturing the direct-link session', async () => {
    const { harness, store, root } = await setup('/');
    store.loaded.set(false);
    store.loading.set(true);
    await harness.fixture.whenStable();
    expect(root().querySelector<HTMLButtonElement>('.session-navigation button')!.disabled).toBe(
      true,
    );
    await harness.navigateByUrl('/?entrainement=demain');
    expect(root().querySelector('.study-card')).toBeNull();
    store.tomorrowCards.set([makeCard('two', 3)]);
    store.loaded.set(true);
    store.loading.set(false);
    await harness.fixture.whenStable();
    expect(root().querySelector('.card-front .card-text')!.textContent).toBe('Question two');
    expect(root().querySelector('.session-meta')!.textContent).toContain('1 carte restante');
  });
});
