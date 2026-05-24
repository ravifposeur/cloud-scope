/**
 * CloudScope — API Client
 *
 * HTTP client untuk komunikasi dengan backend FastAPI.
 * Menangani register, login, dan token-based auth.
 *
 * Base URL dikonfigurasi via environment variable VITE_API_BASE_URL.
 * Default: '/api' (proxied ke backend via Vite dev server / Nginx).
 *
 * Security:
 * - Token dikirim via Authorization header (Bearer scheme)
 * - Tidak menyimpan credential di client — hanya JWT token
 * - Error handling konsisten untuk semua endpoint
 *
 * @module api/client
 */

/** Base URL — proxied ke backend via Vite dev proxy atau Nginx */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Helper: Parse response dari backend API.
 *
 * Menangani berbagai format error response (FastAPI validation, HTTP errors, dll)
 * dan mengembalikan format konsisten { success, data, error }.
 *
 * @param {Response} response - Fetch Response object
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function parseResponse(response) {
  try {
    const data = await response.json();

    if (response.ok) {
      return { success: true, data };
    }

    // FastAPI validation error (422) — ambil pesan pertama
    if (response.status === 422 && data.detail) {
      const details = Array.isArray(data.detail)
        ? data.detail.map((d) => d.msg).join('. ')
        : String(data.detail);
      return { success: false, error: details };
    }

    // Standard HTTP error dengan detail string
    if (data.detail) {
      return { success: false, error: String(data.detail) };
    }

    // Fallback
    return { success: false, error: `Error ${response.status}: Terjadi kesalahan.` };
  } catch {
    return { success: false, error: 'Gagal memproses response dari server.' };
  }
}

/**
 * POST /auth/register — Registrasi user baru.
 *
 * @param {object} params
 * @param {string} params.name - Nama lengkap
 * @param {string} params.email - Email address
 * @param {string} params.password - Password (min 8 chars, uppercase + lowercase + digit)
 * @param {string} [params.affiliation] - Institusi/organisasi (opsional)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function registerUser({ name, email, password, affiliation }) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        affiliation: affiliation || null,
      }),
    });

    return await parseResponse(response);
  } catch (err) {
    console.error('[API] Register network error:', err);
    return {
      success: false,
      error: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.',
    };
  }
}

/**
 * POST /auth/login — Autentikasi user dan dapatkan JWT token.
 *
 * @param {object} params
 * @param {string} params.email - Email address
 * @param {string} params.password - Password
 * @returns {Promise<{success: boolean, data?: {access_token: string, token_type: string, user: object}, error?: string}>}
 */
export async function loginUser({ email, password }) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    return await parseResponse(response);
  } catch (err) {
    console.error('[API] Login network error:', err);
    return {
      success: false,
      error: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.',
    };
  }
}

/**
 * GET /auth/me — Ambil data user saat ini dari JWT token.
 *
 * @param {string} token - JWT access token
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function getCurrentUser(token) {
  if (!token) {
    return { success: false, error: 'Token tidak ditemukan.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return await parseResponse(response);
  } catch (err) {
    console.error('[API] GetCurrentUser network error:', err);
    return {
      success: false,
      error: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.',
    };
  }
}
