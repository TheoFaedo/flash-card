import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FlashcardStore } from '../../core/flashcard.store';

@Component({
  imports: [RouterLink],
  templateUrl: './review.html',
  styleUrl: './review.less',
})
export class Review {
  protected readonly store = inject(FlashcardStore);
  private readonly route = inject(ActivatedRoute);
  protected readonly trainingColumn = this.readTrainingColumn();
  private readonly trainingCards = signal<ReturnType<FlashcardStore['cards']>>([]);
  private readonly trainingIndex = signal(0);
  private readonly trainingInitialized = signal(false);
  protected readonly card = computed(() => this.trainingColumn === null
    ? this.store.dueCards()[0] ?? null
    : this.trainingCards()[this.trainingIndex()] ?? null);
  protected readonly remaining = computed(() => this.trainingColumn === null
    ? this.store.dueCards().length
    : Math.max(0, this.trainingCards().length - this.trainingIndex()));
  protected readonly trainingFinished = computed(() => this.trainingColumn !== null && this.remaining() === 0);
  protected readonly flipState = signal<'question' | 'flipping' | 'answer'>('question');
  protected readonly correctButton = viewChild<ElementRef<HTMLButtonElement>>('correctButton');
  protected readonly revealButton = viewChild<ElementRef<HTMLButtonElement>>('revealButton');
  protected readonly emptyHeading = viewChild<ElementRef<HTMLElement>>('emptyHeading');
  protected readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');

  constructor() {
    effect(() => {
      if (this.trainingColumn !== null && this.store.loaded() && !this.trainingInitialized()) {
        this.trainingCards.set(this.store.cards().filter((card) => card.column === this.trainingColumn));
        this.trainingInitialized.set(true);
      }
    });
  }

  private readTrainingColumn(): number | null {
    const value = Number(this.route.snapshot.queryParamMap.get('etape'));
    return Number.isInteger(value) && value >= 1 && value <= 7 ? value : null;
  }

  protected reveal(): void {
    if (!this.card() || this.flipState() !== 'question') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.showAnswer();
      return;
    }
    this.flipState.set('flipping');
  }

  protected finishFlip(event: TransitionEvent): void {
    if (
      event.target === event.currentTarget &&
      event.propertyName === 'transform' &&
      this.flipState() === 'flipping'
    ) {
      this.showAnswer();
    }
  }

  private showAnswer(): void {
    this.flipState.set('answer');
    setTimeout(() => (this.trainingColumn !== null ? this.nextButton() : this.correctButton())?.nativeElement.focus());
  }

  protected async answer(correct: boolean): Promise<void> {
    if (this.trainingColumn !== null) {
      if (this.flipState() !== 'answer' || !this.card()) return;
      this.trainingIndex.update((index) => index + 1);
      this.flipState.set('question');
      setTimeout(() => (this.revealButton()?.nativeElement ?? this.emptyHeading()?.nativeElement)?.focus());
      return;
    }
    const card = this.card();
    if (!card || this.flipState() !== 'answer') return;
    if (await this.store.answer(card.id, correct)) {
      this.flipState.set('question');
      setTimeout(() =>
        (this.revealButton()?.nativeElement ?? this.emptyHeading()?.nativeElement)?.focus(),
      );
    }
  }
}
