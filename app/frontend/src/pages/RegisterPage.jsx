/**
 * RegisterPage — User registration page.
 *
 * @module pages/RegisterPage
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
 * Get password strength assessment.
 * @param {string} password
 * @returns {{ level: string, label: string, score: number }}
 */
function getPasswordStrength(password) {
  if (!password) return { level: 'weak', label: '', score: 0 };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 'weak', label: 'Lemah', score };
  if (score === 2) return { level: 'fair', label: 'Cukup', score };
  if (score === 3) return { level: 'good', label: 'Baik', score };
  return { level: 'strong', label: 'Kuat', score };
}

/** Map strength level → text color class */
const strengthTextColor = {
  weak: 'text-danger',
  fair: 'text-warning',
  good: 'text-lime-400',
  strong: 'text-success',
};

function validateName(name) {
  if (!name.trim()) return 'Nama lengkap wajib diisi.';
  if (name.trim().length < 2) return 'Nama minimal 2 karakter.';
  return '';
}

function validateEmail(email) {
  if (!email) return 'Email wajib diisi.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid.';
  return '';
}

function validatePassword(password) {
  if (!password) return 'Password wajib diisi.';
  if (password.length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Z]/.test(password)) return 'Password harus mengandung huruf besar.';
  if (!/[a-z]/.test(password)) return 'Password harus mengandung huruf kecil.';
  if (!/\d/.test(password)) return 'Password harus mengandung angka.';
  return '';
}

function validateConfirmPassword(confirm, password) {
  if (!confirm) return 'Konfirmasi password wajib diisi.';
  if (confirm !== password) return 'Password tidak cocok.';
  return '';
}

/**
 * RegisterPage component.
 * @returns {JSX.Element}
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const strength = getPasswordStrength(password);

  function handleBlur(field) {
    const newErrors = { ...errors };
    switch (field) {
      case 'name': newErrors.name = validateName(name); break;
      case 'email': newErrors.email = validateEmail(email); break;
      case 'password':
        newErrors.password = validatePassword(password);
        if (confirmPassword) newErrors.confirmPassword = validateConfirmPassword(confirmPassword, password);
        break;
      case 'confirmPassword': newErrors.confirmPassword = validateConfirmPassword(confirmPassword, password); break;
      default: break;
    }
    setErrors(newErrors);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');

    const newErrors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(confirmPassword, password),
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setIsLoading(true);
    try {
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        affiliation: affiliation.trim() || undefined,
      });
      if (result.success) {
        navigate('/login?registered=true', { replace: true });
      } else {
        setApiError(result.error || 'Registrasi gagal. Silakan coba lagi.');
      }
    } catch (err) {
      console.error('[RegisterPage] Unexpected error:', err);
      setApiError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Bergabung dengan CloudScope"
      subtitle="Buat akun untuk memulai analisis mikroskop"
    >
      {/* API error alert */}
      {apiError && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-sm mb-5
            bg-danger-light border border-danger/25 text-danger"
          style={{ animation: 'slide-down 0.3s ease-out' }}
          role="alert"
          id="register-error-alert"
        >
          <AlertTriangleIcon />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <InputField
          id="register-name"
          label="Nama Lengkap"
          type="text"
          placeholder="Dr. Jane Researcher"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => handleBlur('name')}
          error={errors.name}
          required
          autoComplete="name"
        />

        <InputField
          id="register-email"
          label="Email"
          type="email"
          placeholder="jane@university.ac.id"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => handleBlur('email')}
          error={errors.email}
          required
          autoComplete="email"
        />

        <InputField
          id="register-affiliation"
          label="Afiliasi / Institusi"
          type="text"
          placeholder="Universitas Gadjah Mada (opsional)"
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value)}
          autoComplete="organization"
        />

        <InputField
          id="register-password"
          label="Password"
          type="password"
          placeholder="Minimal 8 karakter"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => handleBlur('password')}
          error={errors.password}
          required
          autoComplete="new-password"
        />

        {/* Password strength indicator */}
        {password && (
          <div className="-mt-3 mb-4">
            <div className="h-1 rounded-full bg-input-bg overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-250 strength-${strength.level}`} />
            </div>
            <div className={`text-xs mt-1 text-right ${strengthTextColor[strength.level] || ''}`}>
              {strength.label}
            </div>
          </div>
        )}

        <InputField
          id="register-confirm-password"
          label="Konfirmasi Password"
          type="password"
          placeholder="Ulangi password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => handleBlur('confirmPassword')}
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
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
          id="register-submit-btn"
        >
          {isLoading ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Membuat Akun...
            </>
          ) : (
            'Buat Akun'
          )}
        </button>
      </form>

      {/* Footer link */}
      <div className="text-center mt-6 text-sm text-txt-secondary">
        <p>
          Sudah punya akun?{' '}
          <Link
            to="/login"
            id="link-to-login"
            className="font-semibold text-primary hover:text-accent hover:underline transition-colors duration-150"
          >
            Masuk di sini
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
