# flashcard

Application Angular 22 de révision par cartes privées, avec connexion Google et stockage Supabase.

## Mise en place

1. Créer un projet Supabase. Exécuter [la migration SQL](supabase/migrations/20260923000000_private_flashcards.sql) dans le SQL Editor ou avec Supabase CLI. Elle crée les tables, les règles RLS et les cinq sujets à la création de chaque nouveau compte.
2. Dans Google Auth Platform, créer un client OAuth de type « Web application ». Ajouter l'origine locale `http://localhost:4200` et l'origine de production. Ajouter comme URI de redirection l'URL de callback affichée sur la page Google du projet Supabase, généralement `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Dans Supabase, activer **Authentication → Providers → Google** et saisir l'identifiant et le secret du client Google. Le secret reste dans Supabase.
4. Dans **Authentication → URL Configuration**, définir la Site URL de production. Ajouter `http://localhost:4200/connexion` et `http://localhost:4200/connexion/retour-cartes` aux Redirect URLs, ainsi que ces deux chemins sur le domaine de production.
5. Copier [l'exemple d'environnement](src/environments/.environnement.ts.example) vers `src/environments/environment.ts`, puis renseigner `supabaseUrl` et `supabasePublishableKey` avec l'URL du projet et sa clé **publishable** (ou l'ancienne clé **anon**). Ces valeurs sont publiques dans l'application compilée. Ne jamais y mettre une clé `service_role` ni le secret Google.

Les [instructions Supabase pour Google](https://supabase.com/docs/guides/auth/social-login/auth-google) et les [URL de retour](https://supabase.com/docs/guides/auth/redirect-urls) détaillent les réglages du fournisseur.

## Démarrer

```bash
bun install
bun start
```

Ouvrir `http://localhost:4200/`. Vérifier avec `bun run build` et `bun run test -- --watch=false`.

## Fonctionnement

- Une carte ajoutée entre en colonne 1 et devient disponible le lendemain, selon la date locale.
- Les sept colonnes ont des intervalles de 1, 2, 3, 5, 8, 13 et 21 jours.
- Une réponse juste fait avancer d'une colonne ; une réponse fausse fait reculer d'une colonne.
- Supprimer un sujet conserve ses cartes et leur attribue « Sans sujet ».
- L'application attend la confirmation de Supabase avant d'afficher une modification. Une connexion réseau est nécessaire.

Les anciennes clés `localStorage` (`flashcard.cards.v1` et `flashcard.data.v2`) ne sont ni lues ni effacées. Les nouveaux comptes commencent sans cartes.

## Vérification dans un projet Supabase

Après avoir appliqué la migration, se connecter avec deux comptes Google distincts. Pour chaque compte, créer une carte et un sujet, actualiser la page, puis vérifier que seules ses propres données sont visibles. Réviser, modifier et supprimer une carte ; retirer un sujet assigné et vérifier que sa carte passe à « Sans sujet ». Vérifier que la déconnexion vide immédiatement l'affichage et que `/` et `/cartes` redirigent vers la connexion.

Pour vérifier RLS directement, utiliser deux sessions API avec les jetons d'accès respectifs : une requête `select`, `update` ou `delete` ciblant l'identifiant d'une carte ou d'un sujet de l'autre compte ne doit retourner aucune ligne ; une insertion de carte utilisant le `subject_id` de l'autre compte doit échouer sur la clé étrangère composée. Répéter sans jeton : l'accès aux deux tables doit être refusé.
