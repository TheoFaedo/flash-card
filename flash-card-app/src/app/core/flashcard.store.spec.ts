import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { afterEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { FlashcardStore } from './flashcard.store';
import { addCalendarDays, localDay } from './review-rules';

describe('FlashcardStore', () => {
  afterEach(() => vi.useRealTimers());
  function setup() {
    const subjects = [{ id: 's1', name: 'Général' }];
    const cards: Array<Record<string, unknown>> = [];
    let fail = false;
    let nextId = 1;
    const user = signal({ id: 'user-one' } as User | null);
    const from = vi.fn((table: string) => {
      let operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
      let values: Record<string, unknown> = {};
      let id: string | undefined;
      const source = () => (table === 'subjects' ? subjects : cards);
      const result = () => {
        if (fail) return { data: null, error: new Error('network') };
        const rows = source();
        if (operation === 'insert') {
          const row = { id: `new-${nextId++}`, ...values };
          if (table === 'subjects') subjects.push(row as (typeof subjects)[number]);
          else cards.push(row);
          return { data: row, error: null };
        }
        if (operation === 'update') {
          const row = rows.find((item) => item['id'] === id);
          if (row) Object.assign(row, values);
          return { data: row ?? null, error: row ? null : new Error('missing') };
        }
        if (operation === 'delete') {
          const index = rows.findIndex((item) => item['id'] === id);
          if (index < 0) return { data: null, error: new Error('missing') };
          const [row] = rows.splice(index, 1);
          if (table === 'subjects')
            for (const card of cards) if (card['subject_id'] === id) card['subject_id'] = null;
          return { data: row, error: null };
        }
        return { data: [...rows], error: null };
      };
      const query = {
        select: () => query,
        insert: (input: Record<string, unknown>) => {
          operation = 'insert' as const;
          values = input;
          return query;
        },
        update: (input: Record<string, unknown>) => {
          operation = 'update' as const;
          values = input;
          return query;
        },
        delete: () => {
          operation = 'delete' as const;
          return query;
        },
        eq: (field: string, value: string) => {
          if (field === 'id') id = value;
          return query;
        },
        order: async () => result(),
        single: async () => result(),
      };
      return query;
    });
    const auth = { user, client: { from } as unknown as SupabaseClient };
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
    const store = TestBed.inject(FlashcardStore);
    TestBed.tick();
    return {
      store,
      user,
      subjects,
      cards,
      setFail: (value: boolean) => {
        fail = value;
      },
    };
  }

  it.each([
    [2026, 0, 31, '2026-02-01'],
    [2026, 11, 31, '2027-01-01'],
    [2026, 2, 28, '2026-03-29'],
    [2026, 2, 29, '2026-03-30'],
    [2026, 9, 24, '2026-10-25'],
    [2026, 9, 25, '2026-10-26'],
  ])(
    'selects exactly tomorrow across calendar transitions (%s-%s-%s)',
    async (year, month, day, tomorrow) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(year, month, day, 23, 30));
      const { store, cards } = setup();
      const today = localDay(new Date());
      for (const [id, started, column] of [
        ['overdue', '2025-01-01', 1],
        ['due-today', addCalendarDays(today, -1), 1],
        ['today', today, 1],
        ['later', tomorrow, 1],
        ['today-too', today, 2],
      ] as const) {
        cards.push({
          id,
          question: id,
          answer: 'R',
          reported: false,
          subject_id: null,
          column,
          review_interval_started_on: started,
        });
      }
      await store.reload();
      expect(store.tomorrowCards().map((card) => card.id)).toEqual(['today']);
      // A newly added card joins the reactive list in the store's current order.
      await store.add({ question: 'New', answer: 'R', subject: null });
      expect(store.tomorrowCards().map((card) => card.question)).toEqual(['today', 'New']);
      // The store advances by local calendar day at midnight.
      vi.advanceTimersByTime(31 * 60_000);
      expect(store.tomorrowCards().map((card) => card.id)).toEqual(['later', 'today-too']);
    },
  );

  it('loads account data and confirms card and subject changes after database success', async () => {
    const { store } = setup();
    await store.reload();
    expect(store.subjects()).toEqual(['Général']);
    expect(await store.add({ question: 'Q', answer: 'R', subject: 'Général' })).toBe(true);
    expect(store.cards()[0]).toMatchObject({
      question: 'Q',
      column: 1,
      reported: false,
      reviewIntervalStartedOn: localDay(new Date()),
    });
    const id = store.cards()[0].id;
    expect(await store.edit(id, { question: 'Q2', answer: 'R2', subject: null })).toBe(true);
    expect(store.cards()[0].subject).toBeNull();
    expect(await store.answer(id, true)).toBe(true);
    expect(store.cards()[0].column).toBe(2);
    expect(await store.addSubject('Histoire')).toBe(true);
    expect(await store.removeSubject('Histoire')).toBe(true);
    expect(await store.remove(id)).toBe(true);
    expect(store.cards()).toEqual([]);
  });

  it('persists reports without changing content or progression and clears them only after a successful correction', async () => {
    const { store, setFail } = setup();
    await store.reload();
    await store.add({ question: 'Q', answer: 'R', subject: null });
    const original = store.cards()[0];
    expect(original.reported).toBe(false);
    const pending = store.setReported(original.id, true);
    expect(store.saving()).toBe(true);
    expect(store.cards()[0].reported).toBe(false);
    expect(await store.setReported(original.id, false)).toBe(false);
    expect(await pending).toBe(true);
    expect(store.cards()[0]).toEqual({ ...original, reported: true });
    await store.reload();
    expect(store.cards()[0].reported).toBe(true);
    setFail(true);
    expect(await store.setReported(original.id, false)).toBe(false);
    expect(await store.edit(original.id, { question: 'Fixed', answer: 'R', subject: null })).toBe(
      false,
    );
    expect(store.cards()[0]).toEqual({ ...original, reported: true });
    setFail(false);
    expect(await store.setReported(original.id, false)).toBe(true);
    expect(store.cards()[0]).toEqual(original);
    await store.setReported(original.id, true);
    expect(await store.edit(original.id, { question: 'Fixed', answer: 'R', subject: null })).toBe(
      true,
    );
    expect(store.cards()[0]).toEqual({ ...original, question: 'Fixed', reported: false });
  });

  it('keeps visible data unchanged when saving fails and clears it on sign-out', async () => {
    const { store, user, setFail } = setup();
    await store.reload();
    expect(await store.add({ question: 'Q', answer: 'R', subject: null })).toBe(true);
    setFail(true);
    expect(await store.answer(store.cards()[0].id, true)).toBe(false);
    expect(store.cards()[0].column).toBe(1);
    expect(store.error()).toContain('Enregistrement impossible');
    user.set(null);
    TestBed.tick();
    expect(store.cards()).toEqual([]);
    expect(store.subjects()).toEqual([]);
  });
});
