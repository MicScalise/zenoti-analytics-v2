// =============================================================================
// Login.tsx — Login page with email/password form
// Implements: REQ-SEC-02 (authentication UI), DD-32 §4 (auth endpoints)
// =============================================================================

import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';

/**
 * Login page component.
 * Renders email + password form, calls auth login on submit,
 * redirects to dashboard on success.
 */
export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  /** Handle form submission — calls login API and redirects. */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Zenoti Analytics</h1>
        <h2>Sign In</h2>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
