import { computed, OnDestroy, Service, signal } from '@angular/core';
import { CardContent, Flashcard, SUBJECTS } from './flashcard.model';
import { answerCard, dueOn, isDue, localDay } from './review-rules';

const STORAGE_KEY = 'flashcard.cards.v1';

function isFlashcard(value: unknown): value is Flashcard {
  if (typeof value !== 'object' || value === null) return false;
  const card = value as Partial<Flashcard>;
  return typeof card.id === 'string'
    && typeof card.question === 'string'
    && typeof card.answer === 'string'
    && SUBJECTS.includes(card.subject as (typeof SUBJECTS)[number])
    && Number.isInteger(card.column)
    && Number(card.column) >= 1
    && Number(card.column) <= 7
    && typeof card.reviewIntervalStartedOn === 'string'
    && isValidLocalDay(card.reviewIntervalStartedOn);
}

function isValidLocalDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return localDay(new Date(year, month - 1, day, 12)) === value;
}

@Service()
export class FlashcardStore implements OnDestroy {
  private readonly cardsState = signal<Flashcard[]>(this.read());
  private readonly dayState = signal(localDay(new Date()));
  private readonly clock = setInterval(() => this.dayState.set(localDay(new Date())), 60_000);

  readonly cards = this.cardsState.asReadonly();
  readonly today = this.dayState.asReadonly();
  readonly storageError = signal(false);
  readonly dueCards = computed(() => this.cardsState()
    .filter((card) => isDue(card, this.dayState()))
    .sort((a, b) => dueOn(a).localeCompare(dueOn(b))));

  ngOnDestroy(): void {
    clearInterval(this.clock);
  }

  add(content: CardContent): boolean {
    return this.save([
      ...this.cardsState(),
      {
        id: crypto.randomUUID(),
        question: content.question.trim(),
        answer: content.answer.trim(),
        subject: content.subject,
        column: 1,
        reviewIntervalStartedOn: localDay(new Date()),
      },
    ]);
  }

  edit(id: string, content: CardContent): boolean {
    return this.save(this.cardsState().map((card) => card.id === id
      ? { ...card, question: content.question.trim(), answer: content.answer.trim(), subject: content.subject }
      : card));
  }

  remove(id: string): boolean {
    return this.save(this.cardsState().filter((card) => card.id !== id));
  }

  answer(id: string, correct: boolean): boolean {
    return this.save(this.cardsState().map((card) => card.id === id
      ? answerCard(card, correct, localDay(new Date()))
      : card));
  }

  private read(): Flashcard[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return [];
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(isFlashcard)) return parsed;
    } catch {
      // Keep stored data untouched if it cannot be read.
    }
    queueMicrotask(() => this.storageError.set(true));
    return [];
  }

  private save(cards: Flashcard[]): boolean {
    if (this.storageError()) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
      this.cardsState.set(cards);
      return true;
    } catch {
      this.storageError.set(true);
      return false;
    }
  }
}
