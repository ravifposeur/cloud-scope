import { useState } from 'react';
import { login, setToken, setUser } from '../api';

export default function LoginPage({ onAuth, onGoRegister }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login({ email: form.email, password: form.password });
      setToken(data.access_token);
      // Decode name from JWT payload (simple base64 decode – no library needed)
      const payload = JSON.parse(atob(data.access_token.split('.')[1]));
      setUser({ email: payload.sub });
      onAuth();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className="card auth-card fade-up">
        <div className="auth-header">
          <div className="auth-logo">🔬</div>
          <h1>CloudScope</h1>
          <p>Sign in to your research account</p>
        </div>

        <form className="form-stack" onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              name="email"
              placeholder="researcher@example.com"
              value={form.email}
              onChange={handle}
              required
              autoComplete="email"
            />
          </div>

          <div className="field-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="input"
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handle}
              required
              autoComplete="current-password"
            />
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        <p className="form-footer">
          Don't have an account?{' '}
          <button
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            onClick={onGoRegister}
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
}
