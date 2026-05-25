import { useState } from 'react';
import { register } from '../api';

export default function RegisterPage({ onGoLogin }) {
  const [form, setForm] = useState({ email: '', name: '', affiliation: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register({
        email: form.email,
        name: form.name,
        password: form.password,
        affiliation: form.affiliation || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page-center">
        <div className="card auth-card fade-up" style={{ textAlign: 'center' }}>
          <div className="auth-logo" style={{ margin: '0 auto 1.25rem', fontSize: '2rem' }}>✅</div>
          <h2>Account Created</h2>
          <p style={{ marginTop: '0.5rem' }}>Your account is ready. Sign in to start analyzing images.</p>
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: '1.5rem' }}
            onClick={onGoLogin}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-center">
      <div className="card auth-card fade-up">
        <div className="auth-header">
          <div className="auth-logo">🔬</div>
          <h1>Create Account</h1>
          <p>Join CloudScope to analyze microscopy images</p>
        </div>

        <form className="form-stack" onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field-group">
            <label htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              className="input"
              type="text"
              name="name"
              placeholder="Dr. Jane Smith"
              value={form.name}
              onChange={handle}
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              className="input"
              type="email"
              name="email"
              placeholder="researcher@institution.edu"
              value={form.email}
              onChange={handle}
              required
              autoComplete="email"
            />
          </div>

          <div className="field-group">
            <label htmlFor="reg-affiliation">Institution / Affiliation <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input
              id="reg-affiliation"
              className="input"
              type="text"
              name="affiliation"
              placeholder="MIT, Harvard, etc."
              value={form.affiliation}
              onChange={handle}
            />
          </div>

          <div className="field-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              className="input"
              type="password"
              name="password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={handle}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="field-group">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <input
              id="reg-confirm"
              className="input"
              type="password"
              name="confirm"
              placeholder="••••••••"
              value={form.confirm}
              onChange={handle}
              required
              autoComplete="new-password"
            />
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" /> Creating account…</> : 'Create Account'}
          </button>
        </form>

        <p className="form-footer">
          Already have an account?{' '}
          <button
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            onClick={onGoLogin}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
