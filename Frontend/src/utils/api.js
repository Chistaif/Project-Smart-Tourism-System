// API configuration
const API_BASE_URL = "http://127.0.0.1:5000/api";

const buildSearchQuery = ({ searchTerm, typeList, userId, attractionIds } = {}) => {
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
  if (attractionIds) {
    params.append('attractionIds', attractionIds);
  }
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

const getToken = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setAccessToken = (token) => {
  try {
    localStorage.setItem('access_token', token);
  } catch {
    /* ignore */
  }
};

const clearTokens = () => {
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  } catch {
    /* ignore */
  }
};

/**
 * Refresh access token using stored refresh_token
 */
async function refreshAccessToken() {
  const refreshToken = getToken('refresh_token');
  if (!refreshToken) {
    throw new Error('Không có refresh token');
  }

  // Sửa đoạn gọi fetch: Thêm Content-Type và body rỗng
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', // Thêm dòng này
      'Authorization': `Bearer ${refreshToken}`,
    },
    body: JSON.stringify({}) // Thêm body rỗng cho đúng chuẩn POST
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok || !data?.success || !data?.access_token) {
    // Nếu refresh thất bại, xóa token để user đăng nhập lại từ đầu
    clearTokens();
    throw new Error(data?.error || 'Không thể làm mới phiên đăng nhập');
  }

  setAccessToken(data.access_token);
  return data.access_token;
}
/**
 * Generic API request function with auto-refresh + retry once on 401
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

  // Attach Authorization header automatically when access_token is present
  const token = getToken('access_token');
  if (token) {
    if (!config.headers) config.headers = {};
    if (!config.headers.Authorization && !config.headers.authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : null;

    // Handle expired/invalid access token by attempting refresh once
    if (response.status === 401 && !options._retry) {
      try {
        const newAccess = await refreshAccessToken();
        return apiRequest(endpoint, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newAccess}`,
          },
          _retry: true,
        });
      } catch (refreshError) {
        clearTokens();
        throw refreshError;
      }
    }

    if (!response.ok) {
      throw new Error(data?.error || `HTTP error! status: ${response.status}`);
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
    const accessToken = getToken('access_token');
    const refreshToken = getToken('refresh_token');
    return apiRequest('/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
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

  // Lấy danh sách tour đã lưu
  getSavedTours: (userId) => apiRequest(`/saved-tours?userId=${userId}`),
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
    const token = getToken("access_token");

    const makeRequest = async (retry = true, overrideToken = token) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${overrideToken}`
          //  KHÔNG thêm Content-Type vì FormData tự tạo boundary
        },
        body: formData,
      });

      // Attempt refresh on 401 once
      if (response.status === 401 && retry) {
        const newAccess = await refreshAccessToken();
        return makeRequest(false, newAccess);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Expected JSON response, got ${contentType}`);
      }
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create blog');
      }
      return data;
    };

    return makeRequest();
  },

  delete: (blogId) => {
    const token = getToken("access_token");
    const url = `${API_BASE_URL}/blogs/${blogId}`;

    const makeRequest = async (retry = true, overrideToken = token) => {
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${overrideToken}`
        }
      });

      if (response.status === 401 && retry) {
        const newAccess = await refreshAccessToken();
        return makeRequest(false, newAccess);
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete blog');
      }
      return data;
    };

    return makeRequest();
  }
};

// API functions cho Tour Packages
export const tourPackageAPI = {
  getAll: () => apiRequest('/tour-packages'),

  getById: (packageId) => apiRequest(`/tour-packages/${packageId}`),
};

export const tourAPI = {
  // Tạo lịch trình nhanh
  createQuickTour: (params) => {
    // params là object { attractionIds, startLat, startLon, startTime, endTime }
    const queryParams = new URLSearchParams();

    if (params.attractionIds) {
      params.attractionIds.forEach(id => queryParams.append('attractionIds', id));
    }
    if (params.startLat) queryParams.append('startLat', params.startLat);
    if (params.startLon) queryParams.append('startLon', params.startLon);
    if (params.startTime) queryParams.append('startTime', params.startTime);
    if (params.endTime) queryParams.append('endTime', params.endTime);
    if (params.startPointName) queryParams.append('startPointName', params.startPointName);

    return apiRequest(`/quick-tour-creator?${queryParams.toString()}`);
  },

  // Lưu tour
  saveTour: (payload) => apiRequest('/save-tour', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Hủy lưu tour
  unsaveTour: (tourId, userId) => apiRequest('/save-tour', {
    method: 'PATCH',
    body: JSON.stringify({ tourId, userId })
  }),

  // Lấy danh sách tour đã lưu
  getSavedTours: (userId) => apiRequest(`/saved-tours?userId=${userId}`)
};

export default {
  destinationsAPI,
  attractionsAPI,
  authAPI,
  blogsAPI,
  userAPI,
  tourAPI,
  tourPackageAPI,
  healthCheck,
}