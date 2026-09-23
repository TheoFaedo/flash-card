import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { AuthService } from './core/auth.service';
import { FlashcardStore } from './core/flashcard.store';
import { App } from './app';
import { routes } from './app.routes';

describe('protected routes', () => {
  it('sends signed-out visitors to Google login and lets signed-in users open cards', async () => {
    const user = signal<User | null>(null);
    const auth = {
      user,
      whenReady: async () => {},
      ready: signal(true),
      error: signal(null),
      configured: true,
    };
    const store = {
      cards: signal([]),
      subjects: signal([]),
      loading: signal(false),
      loaded: signal(true),
      error: signal(null),
      saving: signal(false),
    };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: auth },
        { provide: FlashcardStore, useValue: store },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await router.navigateByUrl('/cartes');
    await fixture.whenStable();
    expect(router.url).toBe('/connexion/retour-cartes');
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'Connectez-vous',
    );
    user.set({ id: 'one' } as User);
    await router.navigateByUrl('/cartes');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toBe(
      'Mes cartes',
    );
  });
});
