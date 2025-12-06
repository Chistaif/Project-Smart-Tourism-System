// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const buildSearchQuery = ({ searchTerm, typeList, userId } = {}) => {
  const params = new URLSearchParams();
  if (searchTerm) {
    params.append('searchTerm', searchTerm.trim());
  }
  if (Array.isArray(typeList)) {
    typeList.forEach((type) => {
      if (type) params.append('typeList', type);
    });
  } else if (typeList) {
    params.append('typeList', typeList);
  }
  if (userId) {
    params.append('userId', userId);
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
    // More detailed error logging
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
  // Get all destinations (optionally filtered)
  getAll: (params = {}) => apiRequest(`/search${buildSearchQuery(params)}`),
  
  // Get a single destination by ID
  getById: (id, userId) => apiRequest(`/attraction/${id}${userId ? `?userId=${userId}` : ''}`),
};

// API functions for attractions
export const attractionsAPI = {
  // Search attractions by filters
  search: (params = {}) => apiRequest(`/search${buildSearchQuery(params)}`),

  // Get detailed info (with optional favorite state)
  getDetail: (id, userId) => apiRequest(`/attraction/${id}${userId ? `?userId=${userId}` : ''}`),

  // Create review
  createReview: (id, payload) => apiRequest(`/attraction/${id}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Update review
  updateReview: (id, payload) => apiRequest(`/attraction/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),

  // Delete review
  deleteReview: (id, payload) => apiRequest(`/attraction/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  }),

  // Toggle favorite
  toggleFavorite: (id, payload) => apiRequest(`/attraction/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
};

// Health check
export const healthCheck = () => apiRequest('/health');

// API functions for authentication
export const authAPI = {
  // Đăng ký tài khoản mới
  signup: (userData) => apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),

  // Đăng nhập
  login: (credentials) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),

  // Đăng xuất (server-side logout)
  logout: () => {
    const accessToken = localStorage.getItem('access_token');
    return apiRequest('/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  },

  //Xac thuc OTP cho login
  verifyOTP: (payload) => apiRequest('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  //Gui lai OTP
  resendOTP: (payload) => apiRequest('/auth/resend-code', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  //QUEN MAT KHAU
  forgotPassword: (payload) => apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  //Xac thuc OTP cho QUEN MAT KHAU
  verifyForgotOTP: (payload) => apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  resetPassword: (payload) => apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Lấy thông tin người dùng theo ID
  getUser: (userId) => apiRequest(`/auth/user/${userId}`),
};

// API functions for user profile
export const userAPI = {
  // Lấy danh sách địa điểm yêu thích
  getFavorites: (userId) => apiRequest(`/user/${userId}/favorites`),
  
  // Lấy lịch sử đánh giá
  getReviews: (userId) => apiRequest(`/user/${userId}/reviews`),
};

// API functions for blogs
export const blogsAPI = {
  // Lấy tất cả blogs
  getAll: () => apiRequest('/blogs'),
  
  // Lấy blog theo ID
  getById: (blogId) => apiRequest(`/blogs/${blogId}`),
  
  // Tạo blog mới (với FormData để upload hình ảnh)
  create: (formData) => {
    const token = localStorage.getItem("accessToken");
    const url = `${API_BASE_URL}/blogs`;

    return fetch(url, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${token}`
        //  KHÔNG thêm Content-Type vì FormData tự tạo boundary
      },
      body: formData, // FormData không cần Content-Type header
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
    })
    .catch(error => {
      console.error('API request failed:', error);
      throw error;
    });
  },
};

export default {
  destinationsAPI,
  attractionsAPI,
  authAPI,
  blogsAPI,
  userAPI,
  healthCheck,
};
