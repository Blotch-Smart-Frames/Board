import { render, screen } from '@testing-library/angular';
import { AuthStore } from '../../core/auth/auth.store';
import { SignInPage } from './sign-in-page';

describe('SignInPage', () => {
  it('shows the sign-in call to action and legal links', async () => {
    await render(SignInPage, { providers: [{ provide: AuthStore, useValue: { login: vi.fn() } }] });

    expect(screen.getByRole('heading', { name: /board/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute(
      'href',
      '/terms.html',
    );
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy.html',
    );
  });
});
