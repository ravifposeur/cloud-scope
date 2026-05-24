/**
 * App — Root application component with routing.
 *
 * Routes:
 * - /login       → LoginPage
 * - /register    → RegisterPage
 * - /dashboard   → DashboardPage (protected)
 * - /            → Redirect to /login or /dashboard based on auth state
 *
 * @module App
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

/**
 * ProtectedRoute — redirects to login if user is not authenticated.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Protected page component
 * @returns {JSX.Element}
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Show nothing while checking auth state (avoids flash)
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-dark)',
      }}>
        <span className="spinner" style={{
          width: '32px',
          height: '32px',
          borderWidth: '3px',
        }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/**
 * GuestRoute — redirects to dashboard if user is already authenticated.
 * Prevents logged-in users from seeing login/register pages.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Guest page component
 * @returns {JSX.Element}
 */
function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-dark)',
      }}>
        <span className="spinner" style={{
          width: '32px',
          height: '32px',
          borderWidth: '3px',
        }} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * AppRoutes — defines all application routes.
 * Separated to allow useAuth hook access (requires AuthProvider ancestor).
 *
 * @returns {JSX.Element}
 */
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Guest-only routes */}
      <Route path="/login" element={
        <GuestRoute><LoginPage /></GuestRoute>
      } />
      <Route path="/register" element={
        <GuestRoute><RegisterPage /></GuestRoute>
      } />

      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="*" element={
        <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
      } />
    </Routes>
  );
}

/**
 * App — Root component. Wraps everything in AuthProvider and BrowserRouter.
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
