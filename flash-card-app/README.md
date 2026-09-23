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
