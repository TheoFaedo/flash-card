import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CardContent,
  Column,
  Flashcard,
  REVIEW_INTERVALS,
  REVIEW_STAGE_NAMES,
  REVIEW_STAGE_ACCENTS,
  Subject,
} from '../../shared/models/flashcard.model';
import { FlashcardStore } from '../../core/flashcard.store';
import {
  ImportedCard,
  normalizeSubject,
  validateImportedCard,
} from '../../shared/helpers/card-import';
import { dueOn } from '../../core/review-rules';

import { initialCardFilters, matchesCardFilters } from '../../shared/helpers/card-filters';
import { CardFilterControls } from './card-filter-controls/card-filter-controls';

@Component({
  imports: [ReactiveFormsModule, RouterLink, CardFilterControls],
  templateUrl: './cards.html',
  styleUrl: './cards.less',
})
export class Cards {
  protected readonly store = inject(FlashcardStore);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly intervals = REVIEW_INTERVALS;
  protected readonly editingId = signal<string | null>(null);
  protected readonly subjectNameError = signal<string | null>(null);
  protected readonly importCards = signal<ImportedCard[]>([]);
  protected readonly importError = signal<string | null>(null);
  protected readonly importMessage = signal<string | null>(null);
  protected readonly importFilename = signal('');
  protected readonly promptCopyMessage = signal('');
  private readonly subjectNameInput = viewChild<ElementRef<HTMLInputElement>>('subjectNameInput');
  private readonly firstRowCards = viewChild<ElementRef<HTMLElement>>('firstRowCards');
  protected readonly cardsPerRow = signal(1);
  protected readonly expandedColumns = signal<ReadonlySet<Column>>(new Set());
  protected readonly filters = signal(initialCardFilters());
  protected readonly reportedCount = computed(
    () => this.store.cards().filter((card) => card.reported).length,
  );
  protected readonly filteredCards = computed(() =>
    this.store.cards().filter((card) => matchesCardFilters(card, this.filters())),
  );
  protected resetFilters(): void {
    this.filters.set(initialCardFilters());
  }
  protected readonly columns = computed(() =>
    REVIEW_INTERVALS.map((days, index) => ({
      number: (index + 1) as Column,
      name: REVIEW_STAGE_NAMES[index],
      accent: REVIEW_STAGE_ACCENTS[index],
      days,
      cards: this.filteredCards().filter((card) => card.column === index + 1),
      total: this.store.cards().filter((card) => card.column === index + 1).length,
    })),
  );

  protected readonly form = this.formBuilder.nonNullable.group({
    question: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)]],
    answer: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)]],
    subject: [this.defaultSubject()],
  });
  protected readonly subjectName = this.formBuilder.nonNullable.control('', [
    Validators.required,
    Validators.maxLength(50),
  ]);

  constructor() {
    afterRenderEffect((onCleanup) => {
      const grid = this.firstRowCards()?.nativeElement;
      if (!grid) return;

      const updateCardsPerRow = () => {
        const styles = getComputedStyle(grid);
        const minWidth = parseFloat(styles.getPropertyValue('--card-min-width'));
        const gap = parseFloat(styles.columnGap) || 0;
        if (!minWidth || !grid.clientWidth) return;
        this.cardsPerRow.set(Math.max(1, Math.floor((grid.clientWidth + gap) / (minWidth + gap))));
      };

      updateCardsPerRow();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(updateCardsPerRow);
        observer.observe(grid);
        onCleanup(() => observer.disconnect());
      }
    });
  }

  protected toggleColumn(column: Column): void {
    this.expandedColumns.update((expanded) => {
      const next = new Set(expanded);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }

  protected isColumnExpanded(column: Column): boolean {
    return this.expandedColumns().has(column);
  }

  protected remainingCards(column: { cards: Flashcard[] }): number {
    return column.cards.length - this.cardsPerRow();
  }

  protected hasOverflowCards(column: { cards: Flashcard[] }): boolean {
    return this.remainingCards(column) > 0;
  }

  protected visibleCards(column: { number: Column; cards: Flashcard[] }): Flashcard[] {
    return this.isColumnExpanded(column.number)
      ? column.cards
      : column.cards.slice(0, this.cardsPerRow());
  }

  protected previewCards(column: { cards: Flashcard[] }): Flashcard[] {
    const firstRowEnd = this.cardsPerRow();
    return column.cards.slice(firstRowEnd, firstRowEnd * 2);
  }

  protected rowToggleLabel(column: { number: Column; cards: Flashcard[] }): string {
    if (this.isColumnExpanded(column.number)) return 'Voir moins';
    const remaining = this.remainingCards(column);
    return remaining === 1 ? 'Voir l’autre carte' : `Voir les ${remaining} autres cartes`;
  }

  protected rowToggleAccessibleLabel(column: { number: Column; cards: Flashcard[] }): string {
    return `${this.rowToggleLabel(column)} de l’étape ${column.number}`;
  }

  protected rowToggleIcon(column: Column): string {
    return this.isColumnExpanded(column) ? '↑' : '↓';
  }

  private defaultSubject(): string {
    return this.store.subjects().includes(Subject.General) ? Subject.General : '';
  }

  protected formatDue(card: Flashcard): string {
    const [year, month, day] = dueOn(card).split('-').map(Number);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(year, month - 1, day, 12));
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.store.loading() || this.store.saving()) return;
    const value: CardContent = {
      question: this.form.controls.question.value.trim(),
      answer: this.form.controls.answer.value.trim(),
      subject: this.form.controls.subject.value || null,
    };
    if (!value.question || !value.answer) return;
    const id = this.editingId();
    const saved = await (id ? this.store.edit(id, value) : this.store.add(value));
    if (saved) this.cancelEdit();
  }

  protected startEdit(card: Flashcard): void {
    this.editingId.set(card.id);
    this.form.setValue({
      question: card.question,
      answer: card.answer,
      subject: card.subject ?? '',
    });
    document.getElementById('question')?.focus();
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ question: '', answer: '', subject: this.defaultSubject() });
  }

  protected async addSubject(): Promise<void> {
    this.subjectName.markAsTouched();
    const name = normalizeSubject(this.subjectName.value);
    if (!name) {
      this.subjectNameError.set('Saisissez un sujet.');
      return;
    }
    if (name.length > 50) {
      this.subjectNameError.set('Le sujet ne peut pas dépasser 50 caractères.');
      return;
    }
    if (
      this.store
        .subjects()
        .some((subject) => subject.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))
    ) {
      this.subjectNameError.set('Ce sujet existe déjà.');
      return;
    }
    if (await this.store.addSubject(name)) {
      this.subjectName.reset();
      this.subjectNameError.set(null);
      this.subjectNameInput()?.nativeElement.focus();
    }
  }

  protected async removeSubject(subject: string): Promise<void> {
    const count = this.store.cards().filter((card) => card.subject === subject).length;
    const message =
      count === 0
        ? `Retirer le sujet « ${subject} » ?`
        : `Retirer le sujet « ${subject} » ? ${count} ${count === 1 ? 'carte passera' : 'cartes passeront'} à « Sans sujet ».`;
    if (!window.confirm(message) || !(await this.store.removeSubject(subject))) return;
    if (this.form.controls.subject.value === subject) this.form.controls.subject.setValue('');
    this.subjectNameInput()?.nativeElement.focus();
  }

  protected async remove(card: Flashcard): Promise<void> {
    if (window.confirm(`Supprimer la carte « ${card.question} » ?`)) {
      if ((await this.store.remove(card.id)) && this.editingId() === card.id) this.cancelEdit();
    }
  }

  protected async readImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.importError.set(null);
    this.importMessage.set(null);
    this.importCards.set([]);
    if (!file) return;
    this.importFilename.set(file.name);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const value = Array.isArray(parsed)
        ? parsed
        : typeof parsed === 'object' && parsed !== null && 'cards' in parsed
          ? (parsed as { cards: unknown }).cards
          : null;
      if (!Array.isArray(value) || value.length === 0)
        throw new Error('Le fichier doit contenir une liste non vide de cartes.');
      const cards = value.map((item, index) => this.parseImportedCard(item, index));
      this.importCards.set(cards);
    } catch (error) {
      this.importError.set(this.describeImportReadError(error));
    }
  }

  private describeImportReadError(error: unknown): string {
    if (error instanceof SyntaxError) return 'Le fichier ne contient pas de JSON valide.';
    if (error instanceof Error) return error.message;
    return 'Fichier impossible à lire.';
  }

  private parseImportedCard(item: unknown, index: number): ImportedCard {
    const result = validateImportedCard(item, index);
    if (!result.valid) throw new Error(result.error);
    return result.card;
  }

  protected async confirmImport(): Promise<void> {
    const cards = this.importCards();
    if (!cards.length || this.store.saving()) return;
    if (await this.store.importCards(cards)) {
      this.importMessage.set(
        `${cards.length} ${cards.length === 1 ? 'carte importée' : 'cartes importées'}.`,
      );
      this.importCards.set([]);
      this.importFilename.set('');
    }
  }

  protected exportCards(): void {
    const cards = this.store.cards().map(({ question, answer, subject }) => ({
      question,
      answer,
      subject,
    }));
    if (!this.store.loaded() || this.store.loading() || cards.length === 0) return;

    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const blob = new Blob([`${JSON.stringify(cards, null, 2)}\n`], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cartes-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected async copyImportPrompt(): Promise<void> {
    try {
      const response = await fetch(new URL('card-import-prompt.md', document.baseURI));
      if (!response.ok) throw new Error('Ressource de prompt indisponible');
      await navigator.clipboard.writeText(await response.text());
      this.promptCopyMessage.set('Le modèle de prompt a été copié dans le presse-papiers.');
    } catch {
      this.promptCopyMessage.set(
        'Impossible de charger ou de copier le modèle. Vérifiez la connexion et les autorisations du navigateur.',
      );
    }
  }
}
