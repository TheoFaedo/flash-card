# flashcard

Application de révision par flashcards, réalisée avec Angular 22. Les données restent dans le `localStorage` du navigateur utilisé. Aucun compte ni serveur n'est nécessaire.

## Démarrer

```bash
bun install
bun start
```

Ouvrir ensuite `http://localhost:4200/`. Les commandes `bun run build` et `bun run test -- --watch=false` vérifient la compilation et les tests.

## Fonctionnement

- Une carte ajoutée entre en colonne 1 et devient disponible le lendemain, selon la date locale.
- Les sept colonnes ont des intervalles de 1, 2, 3, 5, 8, 13 et 21 jours.
- Après avoir vu la réponse, l'utilisateur indique lui-même s'il a répondu juste ou faux.
- Une réponse juste fait avancer d'une colonne ; une réponse fausse fait reculer d'une colonne. Les colonnes 1 et 7 sont les limites.
- `reviewIntervalStartedOn` indique la date de début de l'intervalle actuel. Elle prend la date du jour à l'ajout et après chaque réponse. L'échéance est cette date plus l'intervalle de la colonne actuelle.

Les sujets se gèrent depuis « Mes cartes » et restent enregistrés dans le navigateur. Une carte peut aussi être sans sujet. Retirer un sujet conserve ses cartes et les passe à « Sans sujet ».

## Organisation du code

```text
src/
├── main.ts                 # Démarrage de l'application
├── styles.less             # Styles globaux des deux écrans
└── app/
    ├── app.ts               # Composant racine
    ├── app.html             # Template du composant racine
    ├── app.less             # Styles du composant racine
    ├── app.spec.ts          # Tests du composant racine
    ├── app.config.ts        # Configuration de l'application
    ├── app.routes.ts        # Routes de l'application
    ├── core/                # Magasin et règles de révision utilisés par les deux écrans
    ├── shared/              # Modèle commun
    └── features/
        ├── cards/           # Écran « Mes cartes » et ses styles
        └── review/          # Écran « Réviser » et ses styles
```

Les routes `/` et `/cartes` chargent leurs écrans à la demande. Les imports TypeScript restent relatifs. Les cartes enregistrées conservent leur format et leurs clés `localStorage` (`flashcard.cards.v1` et `flashcard.data.v2`).
