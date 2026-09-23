import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { FlashcardStore } from './core/flashcard.store';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.less',
  templateUrl: './app.html',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly profileName = computed(() => {
    const user = this.auth.user();
    if (!user) return '';
    const metadata = user.user_metadata ?? {};
    const name = metadata['full_name'] ?? metadata['name'];
    if (typeof name === 'string' && name.trim()) return name.trim();
    const firstName = metadata['given_name'];
    const lastName = metadata['family_name'];
    const combinedName = [firstName, lastName]
      .filter((part): part is string => typeof part === 'string' && !!part.trim())
      .join(' ');
    return combinedName || user.email || 'Utilisateur';
  });
  protected readonly profileImage = computed(() => {
    const metadata = this.auth.user()?.user_metadata;
    const image = metadata?.['avatar_url'] ?? metadata?.['picture'];
    return typeof image === 'string' && image.trim() ? image : null;
  });
  private readonly store = inject(FlashcardStore);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    if (!this.auth.user()) void this.router.navigateByUrl('/connexion');
  }
}
