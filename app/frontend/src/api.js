// ─────────────────────────────────────────────────────────────
//  CloudScope API Client
//  Matches FastAPI routes exactly:
//    POST /api/auth/register
//    POST /api/auth/login
//    GET  /api/auth/me
//    POST /api/upload/
//    GET  /api/status/{task_id}
// ─────────────────────────────────────────────────────────────

const BASE_URL = '/api';

// ── Token helpers ─────────────────────────────────────────────
export const getToken = () => localStorage.getItem('cs_token');
export const setToken = (t) => localStorage.setItem('cs_token', t);
export const removeToken = () => localStorage.removeItem('cs_token');
export const getUser = () => {
  try { return JSON.parse(localStorage.getItem('cs_user') || 'null'); }
  catch { return null; }
};
export const setUser = (u) => localStorage.setItem('cs_user', JSON.stringify(u));
export const removeUser = () => localStorage.removeItem('cs_user');

// ── Base fetch wrapper ────────────────────────────────────────
async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      detail = json.detail || JSON.stringify(json);
    // eslint-disable-next-line no-empty
    } catch {}
    throw new Error(detail);
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────

/** POST /auth/register */
export async function register({ email, name, password, affiliation }) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, name, password, affiliation }),
  });
}

/** POST /auth/login — returns { access_token, token_type } */
export async function login({ email, password }) {
  // FastAPI OAuth2PasswordRequestForm expects form-encoded body
  const form = new URLSearchParams();
  form.append('username', email);   // field name must be "username" for OAuth2
  form.append('password', password);

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    // eslint-disable-next-line no-empty
    try { const j = await res.json(); detail = j.detail || detail; } catch {}
    throw new Error(detail);
  }

  return res.json();
}

/**
 * GET /auth/me — Fetch current user profile using JWT token.
 *
 * @param {string} token - JWT access token
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function getCurrentUser(token) {
  if (!token) {
    return { success: false, error: 'Token tidak ditemukan.' };
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error('[API] getCurrentUser error:', err);
    return { success: false, error: 'Tidak dapat terhubung ke server.' };
  }
}

// ── Analysis ──────────────────────────────────────────────────

/**
 * POST /upload/
 * Sends the file as multipart/form-data. Returns { task_id, message, operator }.
 */
export async function uploadImage(file, projectId = 'DEFAULT', macroType = 'DEFAULT') {
  const form = new FormData();
  form.append('file', file);
  form.append('project_id', projectId);
  form.append('macro_type', macroType);

  return request('/upload/', {
    method: 'POST',
    body: form,
    headers: {}, // let browser set Content-Type w/ boundary
  });
}

/**
 * GET /status/{task_id}
 * Returns { task_id, status, result, error }.
 */
export async function getTaskStatus(taskId) {
  return request(`/status/${taskId}`);
}
