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
      console.error('Network error - Is the backend server running?', error);
      throw new Error('Cannot connect to server. Please make sure the backend is running on http://localhost:5000');
    }
    console.error('API request failed:', error);
    throw error;
  }
}

// API functions for destinations
export const destinationsAPI = {
  // Get all destinations
  getAll: () => apiRequest('/destinations'),
  
  // Get a single destination by ID
  getById: (id) => apiRequest(`/destinations/${id}`),
};

// API functions for attractions
export const attractionsAPI = {
  // Get all attractions
  getAll: () => apiRequest('/attractions'),
  
  // Search attractions by location
  search: (location) => apiRequest(`/attractions/search?location=${encodeURIComponent(location)}`),
};

// Health check
export const healthCheck = () => apiRequest('/health');

// API functions for authentication
export const authAPI = {
  // Sign up a new user
  signup: (userData) => apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),
  
  // Login user
  login: (credentials) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  
  // Get user by ID
  getUser: (userId) => apiRequest(`/auth/user/${userId}`),
};

export default {
  destinationsAPI,
  attractionsAPI,
  authAPI,
  healthCheck,
};

