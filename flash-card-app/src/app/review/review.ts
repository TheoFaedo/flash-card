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
  protected readonly revealed = signal(false);
  protected readonly correctButton = viewChild<ElementRef<HTMLButtonElement>>('correctButton');
  protected readonly revealButton = viewChild<ElementRef<HTMLButtonElement>>('revealButton');
  protected readonly emptyHeading = viewChild<ElementRef<HTMLElement>>('emptyHeading');

  protected reveal(): void {
    this.revealed.set(true);
    setTimeout(() => this.correctButton()?.nativeElement.focus());
  }

  protected answer(correct: boolean): void {
    const card = this.card();
    if (!card || !this.revealed()) return;
    if (this.store.answer(card.id, correct)) {
      this.revealed.set(false);
      setTimeout(() => (this.revealButton()?.nativeElement ?? this.emptyHeading()?.nativeElement)?.focus());
    }
  }
}
