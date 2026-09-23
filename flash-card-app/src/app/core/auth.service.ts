import { Service, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Service()
export class AuthService {
  readonly client: SupabaseClient | null =
    environment.supabaseUrl && environment.supabasePublishableKey
      ? createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
          auth: { flowType: 'pkce' },
        })
      : null;
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);
  readonly configured = !!this.client;
  private readonly initialization: Promise<void>;

  constructor() {
    if (!this.client) {
      this.error.set('Supabase doit être configuré avant de pouvoir se connecter.');
      this.ready.set(true);
      this.initialization = Promise.resolve();
      return;
    }
    this.client.auth.onAuthStateChange((_event, session) => {
      if (this.user()?.id !== (session?.user.id ?? null)) this.user.set(session?.user ?? null);
    });
    this.initialization = this.client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) this.error.set('Impossible de restaurer la session. Réessayez.');
        if (this.user()?.id !== (data.session?.user.id ?? null))
          this.user.set(data.session?.user ?? null);
      })
      .catch(() => {
        this.error.set('Impossible de restaurer la session. Réessayez.');
      })
      .finally(() => this.ready.set(true));
  }

  whenReady(): Promise<void> {
    return this.initialization;
  }

  async refreshSession(): Promise<void> {
    await this.whenReady();
    if (!this.client) return;
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      this.error.set('Impossible de restaurer la session. Réessayez.');
      return;
    }
    if (this.user()?.id !== (data.session?.user.id ?? null))
      this.user.set(data.session?.user ?? null);
  }

  async signIn(returnTo = '/'): Promise<void> {
    if (!this.client) return;
    this.error.set(null);
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: new URL(
          returnTo === '/cartes' ? 'connexion/retour-cartes' : 'connexion',
          document.baseURI,
        ).toString(),
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) this.error.set('Connexion Google impossible. Réessayez.');
  }

  async signOut(): Promise<void> {
    if (!this.client) return;
    this.error.set(null);
    const { error } = await this.client.auth.signOut();
    if (error) this.error.set('Déconnexion impossible. Réessayez.');
    else this.user.set(null);
  }
}
