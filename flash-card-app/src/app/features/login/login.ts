import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  template: `
    <section class="login-page" aria-labelledby="login-title">
      <p class="section-kicker">Votre espace privé</p>
      <h1 id="login-title">Connectez-vous pour réviser</h1>
      <p>Vos cartes sont enregistrées dans votre compte et accessibles sur vos appareils.</p>
      @if (auth.error(); as error) {
        <div class="notice error" role="alert">{{ error }}</div>
      }
      <button
        class="button button-primary"
        type="button"
        [disabled]="!auth.configured"
        (click)="signIn()"
      >
        Continuer avec Google
      </button>
    </section>
  `,
  styles: [
    `
      .login-page {
        max-width: 36rem;
        margin: 2rem auto;
        padding: 2rem;
        background: white;
        border-radius: 1rem;
        box-shadow: 0 10px 32px #18334412;
      }
      .login-page h1 {
        margin-top: 0.5rem;
      }
      .login-page .button {
        margin-top: 1rem;
      }
    `,
  ],
})
export class Login {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected signIn(): void {
    void this.auth.signIn(this.returnTo());
  }

  private returnTo(): string {
    return this.route.snapshot.routeConfig?.path === 'connexion/retour-cartes' ? '/cartes' : '/';
  }

  constructor() {
    if (new URLSearchParams(window.location.hash.slice(1)).has('error')) {
      this.auth.error.set('Connexion Google annulée ou refusée. Réessayez.');
    }
    effect(() => {
      if (this.auth.ready() && this.auth.user()) {
        void this.router.navigateByUrl(this.returnTo());
      }
    });
    void this.auth.refreshSession();
  }
}
