import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly trainingMode = computed(() => {
    const params = this.queryParams();
    if (params.get('entrainement') === 'demain') return 'tomorrow';
    const column = Number(params.get('etape'));
    return Number.isInteger(column) && column >= 1 && column <= 7 ? column : null;
  });
  protected readonly trainingColumn = computed(() => {
    const mode = this.trainingMode();
    return typeof mode === 'number' ? mode : null;
  });
  protected readonly tomorrowTraining = computed(() => this.trainingMode() === 'tomorrow');
  protected readonly isTraining = computed(() => this.trainingMode() !== null);
  protected readonly title = computed(() => {
    if (this.tomorrowTraining()) return 'S’entraîner sur la session de demain';
    return this.isTraining() ? 'S’entraîner sur une étape' : 'Réviser aujourd’hui';
  });
  protected readonly stageName = (column: number) => REVIEW_STAGE_NAMES[column - 1];
  protected readonly stageAccent = (column: number) => REVIEW_STAGE_ACCENTS[column - 1];
  private readonly trainingCards = signal<string[]>([]);
  private readonly trainingIndex = signal(0);
  protected readonly card = computed(() => this.currentCard());
  protected readonly remaining = computed(() =>
    !this.isTraining()
      ? this.store.dueCards().length
      : Math.max(0, this.trainingCards().length - this.trainingIndex()),
  );
  protected readonly trainingFinished = computed(() => this.isTraining() && this.remaining() === 0);
  protected readonly flipState = signal<'question' | 'flipping' | 'answer'>('question');
  protected readonly correctButton = viewChild<ElementRef<HTMLButtonElement>>('correctButton');
  protected readonly revealButton = viewChild<ElementRef<HTMLButtonElement>>('revealButton');
  protected readonly emptyHeading = viewChild<ElementRef<HTMLElement>>('emptyHeading');
  protected readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');

  private currentCard(): Flashcard | null {
    if (!this.isTraining()) return this.store.dueCards()[0] ?? null;
    const currentId = this.trainingCards()[this.trainingIndex()];
    return this.store.cards().find((card) => card.id === currentId) ?? null;
  }

  protected remainingLabel(): string {
    const count = this.remaining();
    if (!this.isTraining()) {
      return count === 1 ? 'carte à réviser' : 'cartes à réviser';
    }
    return count === 1 ? 'carte restante' : 'cartes restantes';
  }

  protected sessionStageColumn(cardColumn: number): number {
    return this.trainingColumn() ?? cardColumn;
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
      const mode = this.trainingMode();
      const loaded = this.store.loaded();
      untracked(() => {
        this.trainingIndex.set(0);
        this.flipState.set('question');
        const cards =
          mode === 'tomorrow'
            ? this.store.tomorrowCards()
            : this.store.cards().filter((card) => card.column === mode);
        this.trainingCards.set(loaded && mode !== null ? cards.map((card) => card.id) : []);
      });
    });
  }

  protected startTomorrowTraining(): void {
    void this.router.navigate(['/'], { queryParams: { entrainement: 'demain' } });
  }

  protected readonly emptyTomorrowTraining = computed(
    () => this.tomorrowTraining() && this.trainingCards().length === 0,
  );

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
      (this.isTraining() ? this.nextButton() : this.correctButton())?.nativeElement.focus(),
    );
  }

  protected async answer(correct: boolean): Promise<void> {
    if (this.store.saving()) return;
    if (this.isTraining()) {
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
