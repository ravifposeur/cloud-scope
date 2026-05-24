/**
 * LoginPage — User authentication page.
 *
 * Styled with Tailwind CSS v4 utility classes.
 *
 * @module pages/LoginPage
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../components/AuthLayout';
import InputField from '../components/InputField';

/**
 * SVG icon: AlertTriangle
 * @returns {JSX.Element}
 */
function AlertTriangleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * @param {string} email
 * @returns {string}
 */
function validateEmail(email) {
  if (!email) return 'Email wajib diisi.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid.';
  return '';
}

/**
 * @param {string} password
 * @returns {string}
 */
function validatePassword(password) {
  if (!password) return 'Password wajib diisi.';
  if (password.length < 8) return 'Password minimal 8 karakter.';
  return '';
}

/**
 * LoginPage component.
 * @returns {JSX.Element}
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function handleBlur(field) {
    const newErrors = { ...errors };
    if (field === 'email') newErrors.email = validateEmail(email);
    if (field === 'password') newErrors.password = validatePassword(password);
    setErrors(newErrors);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');

    const newErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setIsLoading(true);
    try {
      const result = await login({ email, password });
      if (result.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setApiError(result.error || 'Login gagal. Periksa kredensial Anda.');
      }
    } catch (err) {
      console.error('[LoginPage] Unexpected error:', err);
      setApiError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      title="CloudScope"
      subtitle="Masuk ke platform analisis mikroskop Anda"
    >
      {/* API error alert */}
      {apiError && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-sm mb-5
            bg-danger-light border border-[rgba(239,68,68,0.25)] text-red-300
            animate-[slide-down_0.3s_ease-out]"
          role="alert"
          id="login-error-alert"
        >
          <AlertTriangleIcon />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <InputField
          id="login-email"
          label="Email"
          type="email"
          placeholder="researcher@lab.ac.id"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => handleBlur('email')}
          error={errors.email}
          required
          autoComplete="email"
        />

        <InputField
          id="login-password"
          label="Password"
          type="password"
          placeholder="Masukkan password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => handleBlur('password')}
          error={errors.password}
          required
          autoComplete="current-password"
        />

        {/* Submit button */}
        <button
          type="submit"
          className="btn-shimmer relative overflow-hidden
            inline-flex items-center justify-center gap-2 w-full
            py-2.5 px-6 font-semibold text-sm text-white
            bg-gradient-to-br from-primary to-indigo-400
            rounded-lg border-none cursor-pointer mt-1
            shadow-[0_2px_12px_var(--color-primary-glow)]
            transition-all duration-150
            hover:from-primary-hover hover:to-primary
            hover:shadow-[0_4px_20px_var(--color-primary-glow)]
            hover:-translate-y-0.5
            active:translate-y-0
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          disabled={isLoading}
          id="login-submit-btn"
        >
          {isLoading ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Memproses...
            </>
          ) : (
            'Masuk'
          )}
        </button>
      </form>

      {/* Footer link */}
      <div className="text-center mt-6 text-sm text-txt-secondary">
        <p>
          Belum punya akun?{' '}
          <Link
            to="/register"
            id="link-to-register"
            className="font-semibold text-primary hover:text-accent hover:underline transition-colors duration-150"
          >
            Daftar sekarang
          </Link>
        </p>
      </div>

    </AuthLayout>
  );
}
