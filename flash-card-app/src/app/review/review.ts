import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlashcardStore } from '../flashcards/flashcard.store';

@Component({
  imports: [RouterLink],
  templateUrl: './review.html',
  styleUrl: './review.less',
})
export class Review {
  protected readonly store = inject(FlashcardStore);
  protected readonly card = computed(() => this.store.dueCards()[0] ?? null);
  protected readonly flipState = signal<'question' | 'flipping' | 'answer'>('question');
  protected readonly correctButton = viewChild<ElementRef<HTMLButtonElement>>('correctButton');
  protected readonly revealButton = viewChild<ElementRef<HTMLButtonElement>>('revealButton');
  protected readonly emptyHeading = viewChild<ElementRef<HTMLElement>>('emptyHeading');

  protected reveal(): void {
    if (!this.card() || this.flipState() !== 'question') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.showAnswer();
      return;
    }
    this.flipState.set('flipping');
  }

  protected finishFlip(event: TransitionEvent): void {
    if (event.target === event.currentTarget && event.propertyName === 'transform' && this.flipState() === 'flipping') {
      this.showAnswer();
    }
  }

  private showAnswer(): void {
    this.flipState.set('answer');
    setTimeout(() => this.correctButton()?.nativeElement.focus());
  }

  protected answer(correct: boolean): void {
    const card = this.card();
    if (!card || this.flipState() !== 'answer') return;
    if (this.store.answer(card.id, correct)) {
      this.flipState.set('question');
      setTimeout(() => (this.revealButton()?.nativeElement ?? this.emptyHeading()?.nativeElement)?.focus());
    }
  }
}
