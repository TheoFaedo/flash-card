# Flashcard

[Français](README.fr.md) | English

A private flashcard review application built with Angular 22, Google sign-in, and Supabase storage.

## GitHub Pages deployment

The `.github/workflows/deploy-pages.yml` workflow builds `flash-card-app/` and automatically publishes the application on every push to `main`: <https://theofaedo.github.io/flash-card/>. In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the deployment source.

After deployment, configure the production URLs in the authentication services:

- In Google Auth Platform, add `https://theofaedo.github.io` as an authorized origin. Keep the redirect URI set to the Supabase callback: `https://<project-ref>.supabase.co/auth/v1/callback`.
- In Supabase **Authentication → URL Configuration**, set the Site URL to `https://theofaedo.github.io/flash-card/` and add `https://theofaedo.github.io/flash-card/connexion` and `https://theofaedo.github.io/flash-card/connexion/retour-cartes` to the Redirect URLs, alongside the local URLs.

Refreshes on Angular routes are redirected by GitHub Pages' `404.html` to the application, which then restores the requested path.

## Setup

1. Create a Supabase project. Run [the SQL migration](supabase/migrations/20260923000000_private_flashcards.sql) in the SQL Editor or with the Supabase CLI. It creates the tables, RLS policies, and five subjects for each new account.
2. In Google Auth Platform, create an OAuth client of type “Web application.” Add the local origin `http://localhost:4200` and the production origin `https://theofaedo.github.io`. Add the redirect URI shown on the Google page of your Supabase project, usually `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase, enable **Authentication → Providers → Google** and enter the Google client ID and secret. Keep the secret in Supabase.
4. In **Authentication → URL Configuration**, set the Site URL to `https://theofaedo.github.io/flash-card/`. Add `http://localhost:4200/connexion`, `http://localhost:4200/connexion/retour-cartes`, `https://theofaedo.github.io/flash-card/connexion`, and `https://theofaedo.github.io/flash-card/connexion/retour-cartes` to the Redirect URLs.
5. Copy [the environment example](src/environments/.environnement.ts.example) to `src/environments/environment.ts`, then set `supabaseUrl` and `supabasePublishableKey` to your project URL and its **publishable** key (or the legacy **anon** key). These values are public in the compiled application. Never put a `service_role` key or Google secret there.

See [Supabase's Google setup guide](https://supabase.com/docs/guides/auth/social-login/auth-google) and [redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls) for details about configuring the provider.

## Remote MCP server

The MCP server is an Edge Function at `https://<project-ref>.supabase.co/functions/v1/mcp`. It exposes `list_cards`, `get_card`, and `update_card`. Authentication and table access use Supabase Auth and the existing RLS policies; each assistant acts with the permissions of the account that granted consent.

To deploy it with the Supabase CLI (version 2.117 or later):

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy mcp
```

The `supabase/config.toml` file disables gateway JWT verification for this function only: the function's OAuth middleware publishes protected-resource metadata and then verifies the user's token itself.

In the Supabase Dashboard:

1. Under **Authentication → OAuth Server**, enable OAuth 2.1 and dynamic MCP client registration. Set `/oauth/consent` as the Authorization Path. Review and revoke registered clients as needed.
2. Under **Authentication → URL Configuration**, keep the application URL as the Site URL (`https://theofaedo.github.io/flash-card/` in production) and add `https://theofaedo.github.io/flash-card/oauth/consent` to the Redirect URLs. Add the local URL `http://localhost:4200/oauth/consent` for local testing.
3. MCP OAuth tokens must use an asymmetric JWT signing key (ES256 or RS256), as required by the Edge Function middleware.

The application's `/oauth/consent` screen displays the client name, account, and requested permissions. The user can accept or deny access; after consent, MCP calls are isolated by RLS policies. Sign-in uses the providers enabled in Supabase, including Google. To connect a compatible client, provide it with the MCP URL above and follow its OAuth sign-in flow. Supabase provides authorization server discovery at `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`.

Available tools: `list_cards` returns up to 100 cards per call with their subject and progress; `get_card` retrieves a card by ID; and `update_card` edits its question (1–500 characters) and answer (1–1,000 characters). Deleting cards and changing their subject or progress are not exposed.

## Start the app

```bash
bun install
bun start
```

Open `http://localhost:4200/`. Check the app with `bun run build` and `bun run test -- --watch=false`.

## How it works

- A newly added card enters column 1 and becomes available the next day, based on the local date.
- The seven columns have intervals of 1, 2, 3, 5, 8, 13, and 21 days.
- A correct answer moves a card forward one column; an incorrect answer moves it back one column.
- Deleting a subject keeps its cards and assigns them to “No subject.”
- The application waits for Supabase to confirm a change before displaying it. A network connection is required.

The legacy `localStorage` keys (`flashcard.cards.v1` and `flashcard.data.v2`) are neither read nor cleared. New accounts start with no cards.

## Verification in a Supabase project

After applying the migration, sign in with two distinct Google accounts. For each account, create a card and a subject, refresh the page, and verify that only that account's data is visible. Review, edit, and delete a card; remove an assigned subject and verify that its card becomes “No subject.” Verify that signing out immediately clears the display and that `/` and `/cartes` redirect to sign-in.

To verify RLS directly, use two API sessions with their respective access tokens: a `select`, `update`, or `delete` request targeting a card or subject ID belonging to the other account must return no rows; inserting a card with the other account's `subject_id` must fail on the composite foreign key. Repeat without a token: access to both tables must be denied.
