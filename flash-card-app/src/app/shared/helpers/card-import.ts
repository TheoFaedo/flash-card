export interface ImportedCard {
  question: string;
  answer: string;
  subject: string | null;
}

export function normalizeSubject(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

type ImportedCardValidation = { valid: true; card: ImportedCard } | { valid: false; error: string };

function isCardObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidQuestion(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.trim().length <= 500;
}

function isValidAnswer(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.trim().length <= 1000;
}

function hasValidSubjectType(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

export function validateImportedCard(item: unknown, index: number): ImportedCardValidation {
  const card = isCardObject(item) ? item : null;
  const question = card?.['question'];
  const answer = card?.['answer'];
  const rawSubject = card?.['subject'];
  const subject = typeof rawSubject === 'string' ? normalizeSubject(rawSubject) : '';
  const checks = [
    { valid: card !== null, error: `Carte ${index + 1} : objet attendu.` },
    {
      valid: isValidQuestion(question),
      error: `Carte ${index + 1} : question manquante ou trop longue (500 caractères maximum).`,
    },
    {
      valid: isValidAnswer(answer),
      error: `Carte ${index + 1} : réponse manquante ou trop longue (1 000 caractères maximum).`,
    },
    {
      valid: hasValidSubjectType(rawSubject),
      error: `Carte ${index + 1} : le sujet doit être du texte.`,
    },
    {
      valid: subject.length <= 50,
      error: `Carte ${index + 1} : le sujet dépasse 50 caractères.`,
    },
  ];
  const firstError = checks.find((check) => !check.valid)?.error;

  if (firstError) return { valid: false, error: firstError };
  return {
    valid: true,
    card: {
      question: (question as string).trim(),
      answer: (answer as string).trim(),
      subject: subject || null,
    },
  };
}
