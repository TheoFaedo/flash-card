import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CardContent,
  Column,
  Flashcard,
  REVIEW_INTERVALS,
  Subject,
} from '../../shared/flashcard.model';
import { FlashcardStore, ImportedCard, normalizeSubject } from '../../core/flashcard.store';
import { dueOn } from '../../core/review-rules';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
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
      if (!Array.isArray(value) || value.length === 0) throw new Error('Le fichier doit contenir une liste non vide de cartes.');
      const cards = value.map((item, index) => {
        if (typeof item !== 'object' || item === null) throw new Error(`Carte ${index + 1} : objet attendu.`);
        const card = item as Record<string, unknown>;
        if (typeof card['question'] !== 'string' || !card['question'].trim() || card['question'].trim().length > 500)
          throw new Error(`Carte ${index + 1} : question manquante ou trop longue (500 caractères maximum).`);
        if (typeof card['answer'] !== 'string' || !card['answer'].trim() || card['answer'].trim().length > 1000)
          throw new Error(`Carte ${index + 1} : réponse manquante ou trop longue (1 000 caractères maximum).`);
        if (card['subject'] !== undefined && card['subject'] !== null && typeof card['subject'] !== 'string')
          throw new Error(`Carte ${index + 1} : le sujet doit être du texte.`);
        const subject = typeof card['subject'] === 'string' ? normalizeSubject(card['subject']) : '';
        if (subject.length > 50) throw new Error(`Carte ${index + 1} : le sujet dépasse 50 caractères.`);
        return { question: card['question'].trim(), answer: card['answer'].trim(), subject: subject || null };
      });
      this.importCards.set(cards);
    } catch (error) {
      this.importError.set(error instanceof SyntaxError ? 'Le fichier ne contient pas de JSON valide.' : error instanceof Error ? error.message : 'Fichier impossible à lire.');
    }
  }

  protected async confirmImport(): Promise<void> {
    const cards = this.importCards();
    if (!cards.length || this.store.saving()) return;
    if (await this.store.importCards(cards)) {
      this.importMessage.set(`${cards.length} ${cards.length === 1 ? 'carte importée' : 'cartes importées'}.`);
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
    const prompt = `À partir des sources fournies à la fin, crée des cartes de révision autonomes et utiles.

Consignes :
- Repère les notions importantes dans les sources et transforme-les en questions précises, avec une réponse claire.
- Une carte doit tester une seule notion. Évite les questions vagues, les doublons et les informations qui ne figurent pas dans les sources.
- Reformule avec tes propres mots. Garde les réponses concises, mais ajoute le contexte nécessaire pour qu'elles soient compréhensibles seules.
- Utilise le sujet indiqué pour toutes les cartes. Si aucun sujet n'est indiqué, omets la propriété « subject ».
- Génère le nombre de cartes demandé. Si ce nombre est impossible à atteindre sans inventer ou répéter des informations, produis-en moins.
- Réponds uniquement avec du JSON valide, sans introduction, sans balises Markdown ni commentaire. Utilise exactement cette structure :

{
  "cards": [
    { "question": "Question ici", "answer": "Réponse ici", "subject": "Sujet ici" }
  ]
}

Exemples de cartes attendues (le contenu ci-dessous illustre le format et ne doit pas être repris, sauf s'il est présent dans les sources) :
{
  "cards": [
    {
      "question": "Quel est le rôle principal des racines chez une plante ?",
      "answer": "Elles ancrent la plante dans le sol et absorbent l'eau ainsi que les sels minéraux.",
      "subject": "Biologie"
    },
    {
      "question": "Pourquoi la température d'ébullition de l'eau diminue-t-elle en altitude ?",
      "answer": "La pression atmosphérique étant plus faible, l'eau atteint sa pression de vapeur d'équilibre à une température plus basse.",
      "subject": "Physique"
    }
  ]
}

Paramètres :
- Nombre de cartes souhaité : [NOMBRE]
- Sujet à utiliser (facultatif) : [SUJET ou « aucun »]

Sources :
[COLLER LES SOURCES ICI]`;

    try {
      await navigator.clipboard.writeText(prompt);
      this.promptCopyMessage.set('Le modèle de prompt a été copié dans le presse-papiers.');
    } catch {
      this.promptCopyMessage.set('Impossible de copier automatiquement. Vérifiez les autorisations du navigateur.');
    }
  }
}
