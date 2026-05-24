/**
 * DashboardPage — Placeholder page for authenticated users.
 *
 * Styled with Tailwind CSS v4 utility classes.
 *
 * @module pages/DashboardPage
 */

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * DashboardPage component.
 * @returns {JSX.Element}
 */
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center px-4 py-8 font-sans">
      <div className="bg-[rgba(17,24,39,0.7)] backdrop-blur-[24px]
        border border-subtle rounded-3xl
        px-6 py-8 sm:px-10 sm:py-10
        max-w-[500px] w-full text-center">

        {/* Success icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
          bg-gradient-to-br from-success to-green-600 mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
            fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        {/* Welcome text */}
        <h1 className="text-xl sm:text-2xl font-bold text-txt mb-2">
          Selamat datang, {user?.name || 'Researcher'}!
        </h1>

        <p className="text-sm text-txt-secondary mb-6 leading-relaxed">
          Login berhasil. Dashboard CloudScope akan segera tersedia.
          <br />
          Halaman ini adalah placeholder untuk memverifikasi alur autentikasi.
        </p>

        {/* User info card */}
        <div className="bg-input-bg rounded-lg p-4 mb-6 text-left text-sm text-txt-secondary">
          <div className="mb-2">
            <strong className="text-txt">Email:</strong>{' '}
            {user?.email || '-'}
          </div>
          <div>
            <strong className="text-txt">Afiliasi:</strong>{' '}
            {user?.affiliation || 'Tidak disebutkan'}
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="btn-shimmer relative overflow-hidden
            inline-flex items-center justify-center gap-2 w-full
            py-2.5 px-6 font-semibold text-sm text-white
            bg-gradient-to-br from-red-500 to-red-600
            rounded-lg border-none cursor-pointer
            shadow-[0_2px_12px_rgba(239,68,68,0.3)]
            transition-all duration-150
            hover:from-red-600 hover:to-red-700
            hover:shadow-[0_4px_20px_rgba(239,68,68,0.4)]
            hover:-translate-y-0.5
            active:translate-y-0"
          id="logout-btn"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
