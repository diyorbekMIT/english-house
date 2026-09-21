import axios from 'axios';

export const api = axios.create({
  baseURL: (import.meta as unknown as { env?: Record<string, string> })?.env?.['VITE_API_URL'] ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    if (status === 401 && localStorage.getItem('token')) {
      // The session is gone (expired, or the account was deactivated). A wrong password
      // on the login form has no stored token, so it never lands here.
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      try { sessionStorage.setItem('session_expired', '1'); } catch { /* best effort */ }
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (status === 403) {
      // Stay logged in — the user just isn't allowed to do that. FeedbackProvider shows a toast.
      window.dispatchEvent(new CustomEvent('api:forbidden'));
    }
    return Promise.reject(err);
  },
);
