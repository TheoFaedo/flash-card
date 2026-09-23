import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardContent, Column, Flashcard, REVIEW_INTERVALS, SUBJECTS, Subject } from '../flashcards/flashcard.model';
import { FlashcardStore } from '../flashcards/flashcard.store';
import { dueOn } from '../flashcards/review-rules';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './cards.html',
  styleUrl: './cards.less',
})
export class Cards {
  protected readonly store = inject(FlashcardStore);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly subjects = SUBJECTS;
  protected readonly intervals = REVIEW_INTERVALS;
  protected readonly editingId = signal<string | null>(null);
  protected readonly columns = computed(() => REVIEW_INTERVALS.map((days, index) => ({
    number: (index + 1) as Column,
    days,
    cards: this.store.cards().filter((card) => card.column === index + 1),
  })));

  protected readonly form = this.formBuilder.nonNullable.group({
    question: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)]],
    answer: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)]],
    subject: [Subject.General, Validators.required],
  });

  protected formatDue(card: Flashcard): string {
    const [year, month, day] = dueOn(card).split('-').map(Number);
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(year, month - 1, day, 12));
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.store.storageError()) return;
    const value: CardContent = {
      question: this.form.controls.question.value.trim(),
      answer: this.form.controls.answer.value.trim(),
      subject: this.form.controls.subject.value,
    };
    if (!value.question || !value.answer) return;
    const id = this.editingId();
    const saved = id ? this.store.edit(id, value) : this.store.add(value);
    if (saved) this.cancelEdit();
  }

  protected startEdit(card: Flashcard): void {
    this.editingId.set(card.id);
    this.form.setValue({ question: card.question, answer: card.answer, subject: card.subject });
    document.getElementById('question')?.focus();
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ question: '', answer: '', subject: Subject.General });
  }

  protected remove(card: Flashcard): void {
    if (window.confirm(`Supprimer la carte « ${card.question} » ?`)) {
      if (this.store.remove(card.id) && this.editingId() === card.id) this.cancelEdit();
    }
  }
}
