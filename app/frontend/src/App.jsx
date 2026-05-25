/**
 * App — Root application component with routing.
 *
 * Routes:
 * - /login       → LoginPage
 * - /register    → RegisterPage
 * - /dashboard   → DashboardPage (protected)
 * - /            → Redirect based on auth state
 *
 * @module App
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
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

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <span
          className="inline-block w-8 h-8 border-[3px] border-bg-border border-t-accent rounded-full animate-spin"
        />
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
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Guest page component
 * @returns {JSX.Element}
 */
function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <span
          className="inline-block w-8 h-8 border-[3px] border-bg-border border-t-accent rounded-full animate-spin"
        />
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
 * App — Root component. Wraps everything in ThemeProvider, AuthProvider, and BrowserRouter.
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
