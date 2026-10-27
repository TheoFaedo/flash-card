import { Flashcard } from '../models/flashcard.model';

export interface CardFilters {
  reported: boolean | null;
}

export function initialCardFilters(): CardFilters {
  return { reported: null };
}

export function matchesReported(card: Flashcard, reported: CardFilters['reported']): boolean {
  return reported === null || card.reported === reported;
}

export function matchesCardFilters(card: Flashcard, filters: CardFilters): boolean {
  return [matchesReported(card, filters.reported)].every(Boolean);
}
