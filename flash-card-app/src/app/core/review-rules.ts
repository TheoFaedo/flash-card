import { Column, Flashcard, REVIEW_INTERVALS } from '../shared/flashcard.model';

export function localDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dueOn(card: Flashcard): string {
  const [year, month, day] = card.reviewIntervalStartedOn.split('-').map(Number);
  // Noon avoids daylight-saving transitions around midnight.
  const due = new Date(year, month - 1, day, 12);
  due.setDate(due.getDate() + REVIEW_INTERVALS[card.column - 1]);
  return localDay(due);
}

export function isDue(card: Flashcard, today: string): boolean {
  return dueOn(card) <= today;
}

export function answerCard(card: Flashcard, correct: boolean, today: string): Flashcard {
  const nextColumn = Math.min(7, Math.max(1, card.column + (correct ? 1 : -1))) as Column;
  return { ...card, column: nextColumn, reviewIntervalStartedOn: today };
}
