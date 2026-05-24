/**
 * CloudScope — Authentication Context Provider
 *
 * Manages global auth state (user, token, loading) using React Context.
 * Handles token persistence via localStorage.
 *
 * @module contexts/AuthContext
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, getCurrentUser } from '../api/client';

/** @type {React.Context} Auth context instance */
const AuthContext = createContext(null);

/** localStorage key for persisting JWT token */
const TOKEN_KEY = 'cloudscope_token';

/**
 * AuthProvider — wraps application with auth state.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  /**
   * On mount: if token exists in localStorage, validate and load user.
   */
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const result = await getCurrentUser(token);
        if (result.success) {
          setUser(result.data);
        } else {
          // Token invalid/expired — clear it
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      } catch (err) {
        console.error('[AuthContext] Failed to load user:', err);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  /**
   * Login — authenticates user and stores token.
   *
   * @param {object} credentials - { email, password }
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const login = useCallback(async (credentials) => {
    try {
      const result = await loginUser(credentials);
      if (result.success) {
        const { access_token, user: userData } = result.data;
        localStorage.setItem(TOKEN_KEY, access_token);
        setToken(access_token);
        setUser(userData);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (err) {
      console.error('[AuthContext] Login error:', err);
      return { success: false, error: 'Terjadi kesalahan jaringan. Coba lagi.' };
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
      const result = await registerUser(userData);
      if (result.success) {
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error };
    } catch (err) {
      console.error('[AuthContext] Register error:', err);
      return { success: false, error: 'Terjadi kesalahan jaringan. Coba lagi.' };
    }
  }, []);

  /**
   * Logout — clears token and user state.
   */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
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
