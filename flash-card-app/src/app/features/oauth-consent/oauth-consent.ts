import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

interface ConsentDetails {
  authorization_id: string;
  redirect_uri: string;
  scope: string;
  client: { name: string; uri: string; logo_uri: string };
}

@Component({
  template: `
    <section class="consent-page" aria-labelledby="consent-title">
      <p class="section-kicker">Accès à vos cartes</p>
      <h1 id="consent-title">Autoriser un assistant</h1>
      @if (error(); as message) {
        <div class="notice error" role="alert">{{ message }}</div>
      } @else if (details(); as request) {
        <p><strong>{{ request.client.name }}</strong> souhaite accéder à votre compte flashcard.</p>
        <p>Il pourra consulter vos cartes et modifier leurs questions et réponses. Il ne pourra pas les supprimer.</p>
        <p>Compte : {{ auth.user()?.email }}</p>
        <h2>Permissions demandées</h2>
        <ul>
          @for (scope of scopes(); track scope) { <li>{{ scope }}</li> }
        </ul>
        <div class="consent-actions">
          <button class="button button-primary" type="button" [disabled]="busy()" (click)="decide(true)">Autoriser</button>
          <button class="button" type="button" [disabled]="busy()" (click)="decide(false)">Refuser</button>
        </div>
      } @else {
        <p>Chargement de la demande d’autorisation…</p>
      }
    </section>
  `,
  styles: [`
    .consent-page { max-width: 36rem; margin: 2rem auto; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 10px 32px #18334412; }
    .consent-page h1 { margin-top: .5rem; }
    .consent-actions { display: flex; gap: .75rem; margin-top: 1.5rem; }
  `],
})
export class OAuthConsent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly error = signal<string | null>(null);
  readonly details = signal<ConsentDetails | null>(null);
  readonly scopes = signal<string[]>([]);
  readonly busy = signal(false);
  private readonly authorizationId = new URLSearchParams(window.location.search).get('authorization_id');

  constructor() {
    effect(() => {
      if (!this.auth.ready()) return;
      if (!this.authorizationId) {
        this.error.set('La demande d’autorisation est absente ou invalide.');
      } else if (!this.auth.user()) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        void this.router.navigate(['/connexion'], { queryParams: { returnTo } });
      } else {
        void this.loadDetails();
      }
    });
  }

  protected async decide(approve: boolean): Promise<void> {
    if (!this.authorizationId || !this.auth.client || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const result = approve
      ? await this.auth.client.auth.oauth.approveAuthorization(this.authorizationId, { skipBrowserRedirect: true })
      : await this.auth.client.auth.oauth.denyAuthorization(this.authorizationId, { skipBrowserRedirect: true });
    if (result.error || !result.data?.redirect_url) {
      this.error.set('Impossible de traiter cette demande. Réessayez.');
      this.busy.set(false);
      return;
    }
    window.location.assign(result.data.redirect_url);
  }

  private async loadDetails(): Promise<void> {
    if (!this.authorizationId || !this.auth.client || this.details()) return;
    const { data, error } = await this.auth.client.auth.oauth.getAuthorizationDetails(this.authorizationId);
    if (error || !data) {
      this.error.set('Impossible de charger les détails de cette demande.');
      return;
    }
    if (!('authorization_id' in data)) {
      window.location.assign(data.redirect_url);
      return;
    }
    this.details.set(data);
    this.scopes.set(data.scope.split(' ').filter(Boolean));
  }
}
