import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL || 'spark-backend-production-69db.up.railway.app';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 45000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE}/api/auth/refresh?refresh_token=${refreshToken}`);
          const { access_token } = response.data;

          useAuthStore.getState().setAuth(
            useAuthStore.getState().user,
            access_token,
            refreshToken
          );

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        useAuthStore.getState().logout();
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    const message = error.response?.data?.detail || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;
