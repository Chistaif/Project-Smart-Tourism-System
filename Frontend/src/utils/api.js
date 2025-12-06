// src/utils/api.js

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// --- HÀM BUILD QUERY (ĐÃ CẬP NHẬT) ---
const buildSearchQuery = ({ searchTerm, typeList, userId, startDate, endDate } = {}) => {
  const params = new URLSearchParams();
  
  // 1. Từ khóa tìm kiếm
  if (searchTerm) {
    params.append('searchTerm', searchTerm.trim());
  }
  
  // 2. Loại hình (Xử lý cả mảng và chuỗi)
  if (Array.isArray(typeList)) {
    typeList.forEach((type) => {
      if (type) params.append('typeList', type);
    });
  } else if (typeList) {
    params.append('typeList', typeList);
  }
  
  // 3. User ID
  if (userId) {
    params.append('userId', userId);
  }

  // 4. Ngày tháng (MỚI THÊM)
  if (startDate) {
    params.append('startDate', startDate);
  }
  if (endDate) {
    params.append('endDate', endDate);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

/**
 * Generic API request function
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(`Expected JSON response, got ${contentType}`);
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('Lỗi kết nối - Máy chủ backend có đang chạy không?', error);
      throw new Error('Không thể kết nối đến máy chủ. Vui lòng đảm bảo backend đang chạy trên http://localhost:5000');
    }
    console.error('API request failed:', error);
    throw error;
  }
}

// API functions for destinations
export const destinationsAPI = {
  getAll: (params = {}) => apiRequest(`/search${buildSearchQuery(params)}`),
  getById: (id, userId) => apiRequest(`/attraction/${id}${userId ? `?userId=${userId}` : ''}`),
};

// API functions for attractions
export const attractionsAPI = {
  search: (params = {}) => apiRequest(`/search${buildSearchQuery(params)}`),
  getDetail: (id, userId) => apiRequest(`/attraction/${id}${userId ? `?userId=${userId}` : ''}`),
  createReview: (id, payload) => apiRequest(`/attraction/${id}`, { method: 'POST', body: JSON.stringify(payload) }),
  updateReview: (id, payload) => apiRequest(`/attraction/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteReview: (id, payload) => apiRequest(`/attraction/${id}`, { method: 'DELETE', body: JSON.stringify(payload) }),
  toggleFavorite: (id, payload) => apiRequest(`/attraction/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
};

// Health check
export const healthCheck = () => apiRequest('/health');

// API functions for authentication
export const authAPI = {
  signup: (userData) => apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify(userData) }),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  logout: () => {
    const accessToken = localStorage.getItem('access_token');
    return apiRequest('/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
  },
  verifyOTP: (payload) => apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify(payload) }),
  resendOTP: (payload) => apiRequest('/auth/resend-code', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (payload) => apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify(payload) }),
  verifyForgotOTP: (payload) => apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify(payload) }),
  resetPassword: (payload) => apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
  getUser: (userId) => apiRequest(`/auth/user/${userId}`),
};

// API functions for user profile
export const userAPI = {
  getFavorites: (userId) => apiRequest(`/user/${userId}/favorites`),
  getReviews: (userId) => apiRequest(`/user/${userId}/reviews`),
};

// API functions for blogs
export const blogsAPI = {
  getAll: () => apiRequest('/blogs'),
  getById: (blogId) => apiRequest(`/blogs/${blogId}`),
  create: (formData) => {
    const token = localStorage.getItem("accessToken");
    const url = `${API_BASE_URL}/blogs`;
    return fetch(url, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${token}` },
      body: formData,
    })
    .then(response => {
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Expected JSON response, got ${contentType}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data.success) {
        throw new Error(data.error || 'Failed to create blog');
      }
      return data;
    });
  },
};

const api = {
  destinationsAPI,
  attractionsAPI,
  authAPI,
  blogsAPI,
  userAPI,
  healthCheck,
};

export default api;