import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const message = typeof data === 'object' && data !== null ? data.message : '';
      
      // If unauthorized (401) or has invalid token/session (403 and NOT a specific role block),
      // clear credentials and redirect to login to ensure they don't get stuck in a stale state.
      if (status === 401 || (status === 403 && message !== 'Admin access required' && message !== 'Teacher access required')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
