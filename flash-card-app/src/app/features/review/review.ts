import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FlashcardStore } from '../../core/flashcard.store';
import {
  Flashcard,
  REVIEW_STAGE_NAMES,
  REVIEW_STAGE_ACCENTS,
} from '../../shared/models/flashcard.model';

@Component({
  imports: [RouterLink],
  templateUrl: './review.html',
  styleUrl: './review.less',
})
export class Review {
  protected readonly store = inject(FlashcardStore);
  private readonly route = inject(ActivatedRoute);
  protected readonly trainingColumn = this.readTrainingColumn();
  protected readonly stageName = (column: number) => REVIEW_STAGE_NAMES[column - 1];
  protected readonly stageAccent = (column: number) => REVIEW_STAGE_ACCENTS[column - 1];
  private readonly trainingCards = signal<string[]>([]);
  private readonly trainingIndex = signal(0);
  private readonly trainingInitialized = signal(false);
  protected readonly card = computed(() => this.currentCard());
  protected readonly remaining = computed(() =>
    this.trainingColumn === null
      ? this.store.dueCards().length
      : Math.max(0, this.trainingCards().length - this.trainingIndex()),
  );
  protected readonly trainingFinished = computed(
    () => this.trainingColumn !== null && this.remaining() === 0,
  );
  protected readonly flipState = signal<'question' | 'flipping' | 'answer'>('question');
  protected readonly correctButton = viewChild<ElementRef<HTMLButtonElement>>('correctButton');
  protected readonly revealButton = viewChild<ElementRef<HTMLButtonElement>>('revealButton');
  protected readonly emptyHeading = viewChild<ElementRef<HTMLElement>>('emptyHeading');
  protected readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');

  private currentCard(): Flashcard | null {
    if (this.trainingColumn === null) return this.store.dueCards()[0] ?? null;
    const currentId = this.trainingCards()[this.trainingIndex()];
    return this.store.cards().find((card) => card.id === currentId) ?? null;
  }

  protected remainingLabel(): string {
    const count = this.remaining();
    if (this.trainingColumn === null) {
      return count === 1 ? 'carte à réviser' : 'cartes à réviser';
    }
    return count === 1 ? 'carte restante' : 'cartes restantes';
  }

  protected sessionStageColumn(cardColumn: number): number {
    return this.trainingColumn ?? cardColumn;
  }

  protected isLegendSessionStage(cardColumn: number): boolean {
    return this.sessionStageColumn(cardColumn) === 7;
  }

  protected async updateReported(event: Event): Promise<void> {
    const checkbox = event.currentTarget as HTMLInputElement;
    const card = this.card();
    if (!card) {
      checkbox.checked = false;
      return;
    }
    if (this.store.saving()) {
      checkbox.checked = card.reported;
      return;
    }

    const saved = await this.store.setReported(card.id, checkbox.checked);
    if (!saved) checkbox.checked = this.card()?.reported ?? false;
  }

  constructor() {
    effect(() => {
      if (this.trainingColumn !== null && this.store.loaded() && !this.trainingInitialized()) {
        this.trainingCards.set(
          this.store
            .cards()
            .filter((card) => card.column === this.trainingColumn)
            .map((card) => card.id),
        );
        this.trainingInitialized.set(true);
      }
    });
  }

  private readTrainingColumn(): number | null {
    const value = Number(this.route.snapshot.queryParamMap.get('etape'));
    return Number.isInteger(value) && value >= 1 && value <= 7 ? value : null;
  }

  protected reveal(): void {
    if (this.store.saving() || !this.card() || this.flipState() !== 'question') return;
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
    setTimeout(() =>
      (this.trainingColumn !== null
        ? this.nextButton()
        : this.correctButton()
      )?.nativeElement.focus(),
    );
  }

  protected async answer(correct: boolean): Promise<void> {
    if (this.store.saving()) return;
    if (this.trainingColumn !== null) {
      if (this.flipState() !== 'answer' || !this.card()) return;
      this.trainingIndex.update((index) => index + 1);
      this.flipState.set('question');
      setTimeout(() =>
        (this.revealButton()?.nativeElement ?? this.emptyHeading()?.nativeElement)?.focus(),
      );
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
