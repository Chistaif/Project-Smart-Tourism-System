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
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
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

export default {
  destinationsAPI,
  attractionsAPI,
  healthCheck,
};

