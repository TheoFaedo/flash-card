import { computed, effect, inject, OnDestroy, Service, signal } from '@angular/core';
import { CardContent, Column, Flashcard } from '../shared/flashcard.model';
import { AuthService } from './auth.service';
import { answerCard, dueOn, isDue, localDay } from './review-rules';

interface SubjectRow {
  id: string;
  name: string;
}
interface CardRow {
  id: string;
  question: string;
  answer: string;
  subject_id: string | null;
  column: Column;
  review_interval_started_on: string;
}

export function normalizeSubject(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export interface ImportedCard {
  question: string;
  answer: string;
  subject: string | null;
}

@Service()
export class FlashcardStore implements OnDestroy {
  private readonly auth = inject(AuthService);

  private readonly subjectRows = signal<SubjectRow[]>([]);
  private readonly cardRows = signal<CardRow[]>([]);
  private readonly dayState = signal(localDay(new Date()));
  private readonly clock = setInterval(() => this.dayState.set(localDay(new Date())), 60_000);
  private generation = 0;

  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly subjects = computed(() => this.subjectRows().map((subject) => subject.name));
  readonly cards = computed<Flashcard[]>(() =>
    this.cardRows().map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      subject: this.subjectRows().find((subject) => subject.id === row.subject_id)?.name ?? null,
      column: row.column,
      reviewIntervalStartedOn: row.review_interval_started_on,
    })),
  );
  readonly today = this.dayState.asReadonly();
  readonly dueCards = computed(() =>
    this.cards()
      .filter((card) => isDue(card, this.dayState()))
      .sort((a, b) => dueOn(a).localeCompare(dueOn(b))),
  );

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id;
      const generation = ++this.generation;
      this.subjectRows.set([]);
      this.cardRows.set([]);
      this.error.set(null);
      this.loaded.set(false);
      this.loading.set(!!userId);
      if (userId) void this.load(userId, generation);
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.clock);
  }

  async reload(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this.loading.set(true);
    await this.load(userId, this.generation);
  }

  private async load(userId: string, generation: number): Promise<void> {
    const client = this.auth.client;
    if (!client) {
      this.loading.set(false);
      return;
    }
    try {
      const [subjects, cards] = await Promise.all([
        client.from('subjects').select('id,name').eq('user_id', userId).order('name'),
        client
          .from('cards')
          .select('id,question,answer,subject_id,column,review_interval_started_on')
          .eq('user_id', userId)
          .order('created_at'),
      ]);

      if (subjects.error) throw subjects.error;
      if (cards.error) throw cards.error;

      if (generation !== this.generation) return;

      this.subjectRows.set(subjects.data as SubjectRow[]);
      this.cardRows.set(cards.data as CardRow[]);

      this.loaded.set(true);
      this.error.set(null);
    } catch {
      if (generation === this.generation)
        this.error.set('Impossible de charger vos données. Vérifiez la connexion puis réessayez.');
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  private async mutate(action: (userId: string) => Promise<void>): Promise<boolean> {
    const userId = this.auth.user()?.id;

    if (!userId || !this.auth.client || !this.loaded() || this.loading() || this.saving()) {
      return false;
    }
    this.error.set(null);
    this.saving.set(true);
    const generation = this.generation;
    try {
      await action(userId);
      return generation === this.generation;
    } catch {
      if (generation === this.generation)
        this.error.set('Enregistrement impossible. Vérifiez la connexion puis réessayez.');
      return false;
    } finally {
      if (generation === this.generation) this.saving.set(false);
    }
  }

  private subjectId(name: string | null): string | null | undefined {
    return name === null ? null : this.subjectRows().find((subject) => subject.name === name)?.id;
  }

  async add(content: CardContent): Promise<boolean> {
    const subjectId = this.subjectId(content.subject);
    if (subjectId === undefined) return false;
    return this.mutate(async (userId) => {
      const { data, error } = await this.auth
        .client!.from('cards')
        .insert({
          user_id: userId,
          question: content.question.trim(),
          answer: content.answer.trim(),
          subject_id: subjectId,
          column: 1,
          review_interval_started_on: localDay(new Date()),
        })
        .select('id,question,answer,subject_id,column,review_interval_started_on')
        .single();
      if (error) throw error;
      if (this.auth.user()?.id === userId)
        this.cardRows.update((rows) => [...rows, data as CardRow]);
    });
  }

  async importCards(contents: ImportedCard[]): Promise<boolean> {
    if (contents.length === 0) return false;
    return this.mutate(async (userId) => {
      const client = this.auth.client!;
      const names = [...new Set(contents.map((card) => card.subject).filter((name): name is string => !!name))];
      for (const name of names) {
        if (this.subjectId(name) !== undefined) continue;
        const { data, error } = await client.from('subjects').insert({ user_id: userId, name }).select('id,name').single();
        if (error) throw error;
        if (this.auth.user()?.id === userId) this.subjectRows.update((rows) => [...rows, data as SubjectRow]);
      }
      const today = localDay(new Date());
      const rows = contents.map((card) => ({
        user_id: userId,
        question: card.question.trim(),
        answer: card.answer.trim(),
        subject_id: this.subjectId(card.subject) ?? null,
        column: 1 as Column,
        review_interval_started_on: today,
      }));
      const { data, error } = await client.from('cards').insert(rows).select('id,question,answer,subject_id,column,review_interval_started_on');
      if (error) throw error;
      if (this.auth.user()?.id === userId) this.cardRows.update((current) => [...current, ...(data as CardRow[])]);
    });
  }

  async edit(id: string, content: CardContent): Promise<boolean> {
    const subjectId = this.subjectId(content.subject);
    if (subjectId === undefined || !this.cardRows().some((card) => card.id === id)) return false;
    return this.mutate(async (userId) => {
      const { data, error } = await this.auth
        .client!.from('cards')
        .update({
          question: content.question.trim(),
          answer: content.answer.trim(),
          subject_id: subjectId,
        })
        .eq('user_id', userId)
        .eq('id', id)
        .select('id,question,answer,subject_id,column,review_interval_started_on')
        .single();
      if (error) throw error;
      if (this.auth.user()?.id === userId)
        this.cardRows.update((rows) =>
          rows.map((row) => (row.id === id ? (data as CardRow) : row)),
        );
    });
  }

  async remove(id: string): Promise<boolean> {
    if (!this.cardRows().some((card) => card.id === id)) return false;
    return this.mutate(async (userId) => {
      const { data, error } = await this.auth
        .client!.from('cards')
        .delete()
        .eq('user_id', userId)
        .eq('id', id)
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('Carte absente');
      if (this.auth.user()?.id === userId)
        this.cardRows.update((rows) => rows.filter((row) => row.id !== id));
    });
  }

  async answer(id: string, correct: boolean): Promise<boolean> {
    const card = this.cards().find((item) => item.id === id);
    if (!card) return false;
    const next = answerCard(card, correct, localDay(new Date()));
    return this.mutate(async (userId) => {
      const { data, error } = await this.auth
        .client!.from('cards')
        .update({
          column: next.column,
          review_interval_started_on: next.reviewIntervalStartedOn,
        })
        .eq('user_id', userId)
        .eq('id', id)
        .select('id,question,answer,subject_id,column,review_interval_started_on')
        .single();
      if (error) throw error;
      if (this.auth.user()?.id === userId)
        this.cardRows.update((rows) =>
          rows.map((row) => (row.id === id ? (data as CardRow) : row)),
        );
    });
  }

  async addSubject(value: string): Promise<boolean> {
    const name = normalizeSubject(value);
    if (
      !name ||
      name.length > 50 ||
      this.subjects().some((item) => item.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))
    )
      return false;
    return this.mutate(async (userId) => {
      const { data, error } = await this.auth
        .client!.from('subjects')
        .insert({ user_id: userId, name })
        .select('id,name')
        .single();
      if (error) throw error;
      if (this.auth.user()?.id === userId)
        this.subjectRows.update((rows) => [...rows, data as SubjectRow]);
    });
  }

  async removeSubject(name: string): Promise<boolean> {
    const id = this.subjectId(name);
    if (!id) return false;
    return this.mutate(async (userId) => {
      const { data, error } = await this.auth
        .client!.from('subjects')
        .delete()
        .eq('user_id', userId)
        .eq('id', id)
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('Sujet absent');
      if (this.auth.user()?.id === userId) {
        this.subjectRows.update((rows) => rows.filter((row) => row.id !== id));
        this.cardRows.update((rows) =>
          rows.map((row) => (row.subject_id === id ? { ...row, subject_id: null } : row)),
        );
      }
    });
  }
}
