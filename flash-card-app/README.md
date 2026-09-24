# flashcard

Application Angular 22 de révision par cartes privées, avec connexion Google et stockage Supabase.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` construit `flash-card-app/` et publie automatiquement l'application à chaque push sur `main` : <https://theofaedo.github.io/flash-card/>. Dans le dépôt GitHub, ouvrir **Settings → Pages** et choisir **GitHub Actions** comme source de déploiement.

Après la publication, configurer les URL de production dans les services d'authentification :

- Dans Google Auth Platform, ajouter `https://theofaedo.github.io` comme origine autorisée. L'URI de redirection reste celle de Supabase, `https://<project-ref>.supabase.co/auth/v1/callback`.
- Dans Supabase **Authentication → URL Configuration**, définir la Site URL à `https://theofaedo.github.io/flash-card/` et ajouter `https://theofaedo.github.io/flash-card/connexion` et `https://theofaedo.github.io/flash-card/connexion/retour-cartes` aux Redirect URLs (en plus des URL locales).

Les rafraîchissements sur les routes Angular sont redirigés par le `404.html` GitHub Pages vers l'application, qui restaure ensuite le chemin demandé.

## Mise en place

1. Créer un projet Supabase. Exécuter [la migration SQL](supabase/migrations/20260923000000_private_flashcards.sql) dans le SQL Editor ou avec Supabase CLI. Elle crée les tables, les règles RLS et les cinq sujets à la création de chaque nouveau compte.
2. Dans Google Auth Platform, créer un client OAuth de type « Web application ». Ajouter l'origine locale `http://localhost:4200` et l'origine de production `https://theofaedo.github.io`. Ajouter comme URI de redirection l'URL de callback affichée sur la page Google du projet Supabase, généralement `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Dans Supabase, activer **Authentication → Providers → Google** et saisir l'identifiant et le secret du client Google. Le secret reste dans Supabase.
4. Dans **Authentication → URL Configuration**, définir la Site URL à `https://theofaedo.github.io/flash-card/`. Ajouter `http://localhost:4200/connexion`, `http://localhost:4200/connexion/retour-cartes`, `https://theofaedo.github.io/flash-card/connexion` et `https://theofaedo.github.io/flash-card/connexion/retour-cartes` aux Redirect URLs.
5. Copier [l'exemple d'environnement](src/environments/.environnement.ts.example) vers `src/environments/environment.ts`, puis renseigner `supabaseUrl` et `supabasePublishableKey` avec l'URL du projet et sa clé **publishable** (ou l'ancienne clé **anon**). Ces valeurs sont publiques dans l'application compilée. Ne jamais y mettre une clé `service_role` ni le secret Google.

Les [instructions Supabase pour Google](https://supabase.com/docs/guides/auth/social-login/auth-google) et les [URL de retour](https://supabase.com/docs/guides/auth/redirect-urls) détaillent les réglages du fournisseur.

## Serveur MCP distant

Le serveur MCP est une Edge Function à l'adresse `https://<project-ref>.supabase.co/functions/v1/mcp`. Il expose `list_cards`, `get_card` et `update_card`. L'authentification et les appels aux tables passent par Supabase Auth et les règles RLS existantes ; chaque assistant agit avec les droits du compte qui a donné son consentement.

Pour le déployer avec Supabase CLI (version 2.117 ou ultérieure) :

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy mcp
```

Le fichier `supabase/config.toml` désactive la vérification JWT du gateway pour cette seule fonction : le middleware OAuth de la fonction publie les métadonnées de ressource protégée puis vérifie lui-même le jeton utilisateur.

Dans Supabase Dashboard :

1. Dans **Authentication → OAuth Server**, activer OAuth 2.1 et l'enregistrement dynamique des clients MCP. Choisir `/oauth/consent` comme Authorization Path. Examiner et révoquer les clients enregistrés au besoin.
2. Dans **Authentication → URL Configuration**, conserver le site de l'application comme Site URL (`https://theofaedo.github.io/flash-card/` en production) et ajouter `https://theofaedo.github.io/flash-card/oauth/consent` aux Redirect URLs. Ajouter l'URL locale `http://localhost:4200/oauth/consent` pour les essais locaux.
3. Les jetons OAuth MCP doivent utiliser une clé de signature JWT asymétrique (ES256 ou RS256), requise par le middleware d'Edge Function.

L'écran `/oauth/consent` de l'application affiche le nom du client, le compte et les autorisations demandées. L'utilisateur peut accepter ou refuser; après acceptation, les appels MCP sont isolés par les politiques RLS. La connexion utilise les fournisseurs déjà activés dans Supabase, notamment Google. Pour connecter un client compatible, lui fournir l'URL MCP ci-dessus et suivre son flux de connexion OAuth. La découverte du serveur d'autorisation est fournie par Supabase à `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`.

Outils disponibles : `list_cards` renvoie au plus 100 cartes par appel avec sujet et progression, `get_card` consulte une carte par identifiant, et `update_card` modifie sa question (1 à 500 caractères) et sa réponse (1 à 1 000 caractères). Les suppressions et changements de sujet ou de progression ne sont pas exposés.

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
