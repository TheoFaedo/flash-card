export enum Subject {
  General = 'Général',
  Sciences = 'Sciences',
  History = 'Histoire',
  Languages = 'Langues',
  Computing = 'Informatique',
}

export const SUBJECTS = Object.values(Subject);
export const REVIEW_INTERVALS = [1, 2, 3, 5, 8, 13, 21] as const;
export type Column = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  subject: Subject;
  column: Column;
  /** Local calendar date (YYYY-MM-DD) when the current interval began. */
  reviewIntervalStartedOn: string;
}

export type CardContent = Pick<Flashcard, 'question' | 'answer' | 'subject'>;
