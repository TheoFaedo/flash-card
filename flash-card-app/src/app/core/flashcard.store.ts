import { computed, OnDestroy, Service, signal } from '@angular/core';
import { CardContent, DEFAULT_SUBJECTS, Flashcard } from '../shared/flashcard.model';
import { answerCard, dueOn, isDue, localDay } from './review-rules';

const LEGACY_STORAGE_KEY = 'flashcard.cards.v1';
const STORAGE_KEY = 'flashcard.data.v2';

interface StoredData {
  subjects: string[];
  cards: Flashcard[];
}

export function normalizeSubject(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isSubject(value: unknown): value is string {
  return typeof value === 'string' && value === normalizeSubject(value) && value.length > 0 && value.length <= 50;
}

function hasUniqueSubjects(subjects: string[]): boolean {
  return new Set(subjects.map((subject) => subject.toLocaleLowerCase('fr'))).size === subjects.length;
}

function isFlashcard(value: unknown, subjects: string[]): value is Flashcard {
  if (typeof value !== 'object' || value === null) return false;
  const card = value as Partial<Flashcard>;
  return typeof card.id === 'string'
    && typeof card.question === 'string'
    && typeof card.answer === 'string'
    && (card.subject === null || (typeof card.subject === 'string' && subjects.includes(card.subject)))
    && Number.isInteger(card.column)
    && Number(card.column) >= 1
    && Number(card.column) <= 7
    && typeof card.reviewIntervalStartedOn === 'string'
    && isValidLocalDay(card.reviewIntervalStartedOn);
}

function isStoredData(value: unknown): value is StoredData {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Partial<StoredData>;
  const subjects = data.subjects;
  return Array.isArray(subjects)
    && subjects.every(isSubject)
    && hasUniqueSubjects(subjects)
    && Array.isArray(data.cards)
    && data.cards.every((card: unknown) => isFlashcard(card, subjects));
}

function isValidLocalDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return localDay(new Date(year, month - 1, day, 12)) === value;
}

@Service()
export class FlashcardStore implements OnDestroy {
  readonly storageError = signal(false);
  private readonly dataState = signal<StoredData>(this.read());
  private readonly dayState = signal(localDay(new Date()));
  private readonly clock = setInterval(() => this.dayState.set(localDay(new Date())), 60_000);

  readonly cards = computed(() => this.dataState().cards);
  readonly subjects = computed(() => this.dataState().subjects);
  readonly today = this.dayState.asReadonly();
  readonly dueCards = computed(() => this.cards()
    .filter((card) => isDue(card, this.dayState()))
    .sort((a, b) => dueOn(a).localeCompare(dueOn(b))));

  ngOnDestroy(): void {
    clearInterval(this.clock);
  }

  add(content: CardContent): boolean {
    if (!this.hasSubject(content.subject)) return false;
    return this.save({ subjects: this.subjects(), cards: [
      ...this.cards(),
      {
        id: crypto.randomUUID(),
        question: content.question.trim(),
        answer: content.answer.trim(),
        subject: content.subject,
        column: 1,
        reviewIntervalStartedOn: localDay(new Date()),
      },
    ] });
  }

  edit(id: string, content: CardContent): boolean {
    if (!this.hasSubject(content.subject)) return false;
    return this.save({ subjects: this.subjects(), cards: this.cards().map((card) => card.id === id
      ? { ...card, question: content.question.trim(), answer: content.answer.trim(), subject: content.subject }
      : card) });
  }

  remove(id: string): boolean {
    return this.save({ subjects: this.subjects(), cards: this.cards().filter((card) => card.id !== id) });
  }

  answer(id: string, correct: boolean): boolean {
    return this.save({ subjects: this.subjects(), cards: this.cards().map((card) => card.id === id
      ? answerCard(card, correct, localDay(new Date()))
      : card) });
  }

  addSubject(value: string): boolean {
    const subject = normalizeSubject(value);
    if (!isSubject(subject) || this.subjects().some((item) => item.toLocaleLowerCase('fr') === subject.toLocaleLowerCase('fr'))) return false;
    return this.save({ subjects: [...this.subjects(), subject], cards: this.cards() });
  }

  removeSubject(subject: string): boolean {
    if (!this.subjects().includes(subject)) return false;
    return this.save({
      subjects: this.subjects().filter((item) => item !== subject),
      cards: this.cards().map((card) => card.subject === subject ? { ...card, subject: null } : card),
    });
  }

  private hasSubject(subject: string | null): boolean {
    return subject === null || this.subjects().includes(subject);
  }

  private read(): StoredData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (isStoredData(parsed)) return parsed;
      } else {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy === null) return { subjects: [...DEFAULT_SUBJECTS], cards: [] };
        const parsed: unknown = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.every((card) => isFlashcard(card, DEFAULT_SUBJECTS))) {
          return { subjects: [...DEFAULT_SUBJECTS], cards: parsed };
        }
      }
    } catch {
      // Keep stored data untouched if it cannot be read.
    }
    this.storageError.set(true);
    return { subjects: [...DEFAULT_SUBJECTS], cards: [] };
  }

  private save(data: StoredData): boolean {
    if (this.storageError()) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.dataState.set(data);
      return true;
    } catch {
      this.storageError.set(true);
      return false;
    }
  }
}
