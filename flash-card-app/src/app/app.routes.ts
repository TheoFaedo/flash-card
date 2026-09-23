import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Réviser · flashcard',
    loadComponent: () => import('./review/review').then((m) => m.Review),
  },
  {
    path: 'cartes',
    title: 'Mes cartes · flashcard',
    loadComponent: () => import('./cards/cards').then((m) => m.Cards),
  },
  { path: '**', redirectTo: '' },
];
