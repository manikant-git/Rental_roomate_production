import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
});

// Auto-attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }),
  me: () => api.get('/auth/me'),
};

// Listings
export const listingsAPI = {
  getAll: (params) => api.get('/listings', { params }),
  getOne: (id) => api.get(`/listings/${id}`),
  create: (data) => api.post('/listings', data),
  update: (id, data) => api.put(`/listings/${id}`, data),
  delete: (id) => api.delete(`/listings/${id}`),
  save: (id) => api.post(`/listings/${id}/save`),
  unsave: (id) => api.delete(`/listings/${id}/save`),
  book: (id, data) => api.post(`/listings/${id}/book`, data),
  review: (id, data) => api.post(`/listings/${id}/reviews`, data),
  myListings: () => api.get('/listings/my/listings'),
};

// Roommates
export const roommatesAPI = {
  getAll: (params) => api.get('/roommates', { params }),
  getProfile: (userId) => api.get(`/roommates/${userId}`),
  getMyProfile: () => api.get('/roommates/profile/me'),
  saveProfile: (data) => api.post('/roommates/profile', data),
  sendRequest: (data) => api.post('/roommates/requests', data),
  getMyRequests: () => api.get('/roommates/requests/me'),
  updateRequest: (id, status) => api.patch(`/roommates/requests/${id}`, { status }),
};

// Notifications
export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
};

export default api;
