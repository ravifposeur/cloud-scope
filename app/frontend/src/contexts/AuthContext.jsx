/**
 * CloudScope — Authentication Context Provider
 *
 * Manages global auth state (user, token, loading) using React Context.
 * Handles token persistence via localStorage.
 * Uses api.js for all backend communication.
 *
 * Note: Backend does NOT have a /auth/me endpoint.
 * User info is decoded from the JWT payload (sub = email).
 *
 * @module contexts/AuthContext
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  getToken,
  setToken,
  removeToken,
  getUser as getSavedUser,
  setUser as saveUser,
  removeUser,
} from '../api';

/** @type {React.Context} Auth context instance */
const AuthContext = createContext(null);

/**
 * Decode JWT payload without verification (client-side only).
 * Used to extract user email from token.
 *
 * @param {string} token - JWT access token
 * @returns {object|null} Decoded payload or null
 */
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('[AuthContext] Failed to decode JWT:', err);
    return null;
  }
}

/**
 * Check if a JWT token is expired.
 *
 * @param {string} token - JWT access token
 * @returns {boolean} True if expired or invalid
 */
function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return true;
  // exp is in seconds, Date.now() in milliseconds
  return Date.now() >= payload.exp * 1000;
}

/**
 * Extract user info from JWT token.
 *
 * @param {string} token - JWT access token
 * @returns {object|null} User object with email, or null
 */
function getUserFromToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    email: payload.sub || 'unknown',
  };
}

/**
 * AuthProvider — wraps application with auth state.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getToken());
  const [loading, setLoading] = useState(true);

  /**
   * On mount: if token exists and is not expired, restore user from it.
   * No /auth/me call needed — we decode user info from the JWT itself.
   */
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // Check token expiration
    if (isTokenExpired(token)) {
      console.warn('[AuthContext] Token expired, clearing session.');
      removeToken();
      removeUser();
      setTokenState(null);
      setLoading(false);
      return;
    }

    // Try to restore saved user, or decode from token
    const savedUser = getSavedUser();
    if (savedUser) {
      setUser(savedUser);
    } else {
      const decoded = getUserFromToken(token);
      if (decoded) {
        setUser(decoded);
        saveUser(decoded);
      }
    }

    setLoading(false);
  }, [token]);

  /**
   * Login — authenticates user and stores token.
   *
   * @param {object} credentials - { email, password }
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const login = useCallback(async (credentials) => {
    try {
      const data = await apiLogin(credentials);
      const { access_token } = data;

      // Persist token
      setToken(access_token);
      setTokenState(access_token);

      // Decode user info from JWT
      const decoded = getUserFromToken(access_token);
      const userData = decoded || { email: credentials.email };
      setUser(userData);
      saveUser(userData);

      return { success: true };
    } catch (err) {
      console.error('[AuthContext] Login error:', err);
      return { success: false, error: err.message || 'Login gagal.' };
    }
  }, []);

  /**
   * Register — creates new user account.
   *
   * @param {object} userData - { name, email, password, affiliation? }
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const register = useCallback(async (userData) => {
    try {
      const data = await apiRegister(userData);
      return { success: true, data };
    } catch (err) {
      console.error('[AuthContext] Register error:', err);
      return { success: false, error: err.message || 'Registrasi gagal.' };
    }
  }, []);

  /**
   * Logout — clears token and user state.
   */
  const logout = useCallback(() => {
    removeToken();
    removeUser();
    setTokenState(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !isTokenExpired(token),
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to access auth context.
 *
 * @returns {{
 *   user: object|null,
 *   token: string|null,
 *   loading: boolean,
 *   isAuthenticated: boolean,
 *   login: function,
 *   register: function,
 *   logout: function
 * }}
 * @throws {Error} If used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
