// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
  // Get all destinations
  getAll: () => apiRequest('/search'),
  
  // Get a single destination by ID
  getById: (id) => apiRequest(`/attraction/${id}`),
};

// API functions for attractions
export const attractionsAPI = {
  // Get all attractions
  getAll: () => apiRequest('/search'),
  
  // Search attractions by location
  search: (location) => apiRequest(`/search?searchTerm=${encodeURIComponent(location)}`),
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
  
  // Lấy thông tin người dùng theo ID
  getUser: (userId) => apiRequest(`/auth/user/${userId}`),
};

// API functions for blogs
export const blogsAPI = {
  // Lấy tất cả blogs
  getAll: () => apiRequest('/blogs'),
  
  // Lấy blog theo ID
  getById: (blogId) => apiRequest(`/blogs/${blogId}`),
  
  // Tạo blog mới (với FormData để upload hình ảnh)
  create: (formData) => {
    const url = `${API_BASE_URL}/blogs`;
    return fetch(url, {
      method: 'POST',
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
  healthCheck,
};

