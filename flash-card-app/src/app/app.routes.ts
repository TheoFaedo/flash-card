import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    title: 'Réviser · flashcard',
    loadComponent: () => import('./features/review/review').then((m) => m.Review),
  },
  {
    path: 'cartes',
    canActivate: [authGuard],
    title: 'Mes cartes · flashcard',
    loadComponent: () => import('./features/cards/cards').then((m) => m.Cards),
  },
  {
    path: 'connexion',
    title: 'Connexion · flashcard',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'connexion/retour-cartes',
    title: 'Connexion · flashcard',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'oauth/consent',
    title: 'Autorisation · flashcard',
    loadComponent: () => import('./features/oauth-consent/oauth-consent').then((m) => m.OAuthConsent),
  },
  { path: '**', redirectTo: '' },
];
