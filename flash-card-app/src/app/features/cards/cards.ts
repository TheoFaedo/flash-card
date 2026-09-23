import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CardContent,
  Column,
  Flashcard,
  REVIEW_INTERVALS,
  Subject,
} from '../../shared/flashcard.model';
import { FlashcardStore, normalizeSubject } from '../../core/flashcard.store';
import { dueOn } from '../../core/review-rules';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './cards.html',
  styleUrl: './cards.less',
})
export class Cards {
  protected readonly store = inject(FlashcardStore);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly intervals = REVIEW_INTERVALS;
  protected readonly editingId = signal<string | null>(null);
  protected readonly subjectNameError = signal<string | null>(null);
  private readonly subjectNameInput = viewChild<ElementRef<HTMLInputElement>>('subjectNameInput');
  protected readonly columns = computed(() =>
    REVIEW_INTERVALS.map((days, index) => ({
      number: (index + 1) as Column,
      days,
      cards: this.store.cards().filter((card) => card.column === index + 1),
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
}
