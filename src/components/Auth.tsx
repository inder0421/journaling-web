import { useState, type FormEvent } from 'react';
import { useAppData } from '../context/AppData';

export function Auth() {
  const { signIn, signUp } = useAppData();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = isSignUp ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
    if (res.error) setError(res.error);
    if (res.info) setInfo(res.info);
    setBusy(false);
  }

  return (
    <div className="center-screen">
      <div className="card auth-card">
        <h2>{isSignUp ? 'Create account' : 'Sign in'}</h2>
        <p className="lead">
          Your journal syncs across every device with these credentials. Use the same login on your
          phone and desktop.
        </p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="form-error">{error}</div>}
          {info && <div className="note ok" style={{ marginBottom: 12 }}>{info}</div>}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Working…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="auth-toggle">
          {isSignUp ? 'Already have an account?' : 'Need an account?'}{' '}
          <button
            className="link-btn"
            onClick={() => {
              setIsSignUp((v) => !v);
              setError(null);
              setInfo(null);
            }}
          >
            {isSignUp ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </div>
    </div>
  );
}
