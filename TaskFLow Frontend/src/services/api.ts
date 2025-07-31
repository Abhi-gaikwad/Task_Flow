// src/services/api.ts - Enhanced with comprehensive debugging and error handling
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('[API] Request:', config.method?.toUpperCase(), config.url, {
      headers: config.headers,
      data: config.data instanceof FormData ? 'FormData' : config.data
    });
    return config;
  },
  (error) => {
    console.error('[API] Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    console.log('[API] Response Success:', response.status, response.config.url, {
      data: response.data,
      headers: response.headers
    });
    return response;
  },
  (error) => {
    console.error('[API] Response Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      data: error.response?.data,
      message: error.message,
      code: error.code
    });
    
    if (error.response?.status === 401) {
      console.log('[API] 401 Unauthorized - clearing tokens and redirecting to login');
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth');
      // Only redirect if we're not already on the login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    console.log('[API] Regular login attempt for:', email);
    
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);
      
      const response = await api.post('/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      console.log('[API] Regular login successful for:', email);
      
      // Validate response structure
      if (!response.data.access_token || !response.data.user) {
        throw new Error('Invalid response structure: missing access_token or user');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[API] Regular login failed for:', email, error.response?.data || error.message);
      throw error;
    }
  },

  companyLogin: async (company_username: string, company_password: string) => {
    console.log('[API] Company login attempt for:', company_username);
    
    try {
      const formData = new FormData();
      formData.append('username', company_username);
      formData.append('password', company_password);

      console.log('[API] Company login FormData prepared');
      
      const response = await api.post('/company-login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      console.log('[API] Company login API call completed successfully');
      
      // Validate response structure
      if (!response.data) {
        throw new Error('Empty response from server');
      }
      
      if (!response.data.access_token) {
        console.error('[API] Missing access_token in response:', response.data);
        throw new Error('Invalid response: missing access_token');
      }
      
      if (!response.data.user) {
        console.error('[API] Missing user data in response:', response.data);
        throw new Error('Invalid response: missing user data');
      }
      
      console.log('[API] Company login successful for:', company_username, {
        hasToken: !!response.data.access_token,
        hasUser: !!response.data.user,
        userId: response.data.user?.id,
        userRole: response.data.user?.role
      });
      
      return response.data;
    } catch (error: any) {
      console.error('[API] Company login failed for:', company_username, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
  },

  getCurrentUser: async () => {
    console.log('[API] Getting current user');
    try {
      const response = await api.get('/users/me');
      console.log('[API] Current user retrieved successfully:', {
        id: response.data?.id,
        email: response.data?.email,
        role: response.data?.role
      });
      return response.data;
    } catch (error: any) {
      console.error('[API] Get current user failed:', error.response?.data || error.message);
      throw error;
    }
  },
};

// Users API
export const usersAPI = {
  listUsers: async (params: { 
    limit?: number; 
    is_active?: boolean;
    company_id?: number;
  }) => {
    const response = await api.get('/users', { params });
    return response.data;
  },
  
  activateUser: async (userId: number) => {
    const response = await api.post(`/users/${userId}/activate`);
    return response.data;
  },
  
  deleteUser: async (userId: number) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },
  
  updateUser: async (userId: number, data: any) => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  }
};

// Company API
export const companyAPI = {
  createCompany: async (data: { 
    name: string; 
    description?: string; 
    company_username: string; 
    company_password: string; 
  }) => {
    const response = await api.post('/companies', data);
    return response.data;
  },

  listCompanies: async () => {
    const response = await api.get('/companies');
    return response.data;
  },

  getCompany: async (companyId: number) => {
    const response = await api.get(`/companies/${companyId}`);
    return response.data;
  },

  updateCompany: async (companyId: number, updates: {
    name?: string;
    description?: string;
    is_active?: boolean;
  }) => {
    const response = await api.put(`/companies/${companyId}`, updates);
    return response.data;
  },
};

export const handleApiError = (error: any): string => {
  console.log('[API] Handling API Error:', {
    hasResponse: !!error.response,
    status: error.response?.status,
    data: error.response?.data,
    message: error.message,
    code: error.code
  });
  
  // Handle network errors
  if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') {
    return 'Network error. Please check your connection and try again.';
  }
  
  // Handle timeout errors
  if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  
  // Handle response errors
  if (error.response?.data?.detail) {
    if (typeof error.response.data.detail === 'string') {
      return error.response.data.detail;
    }
    
    if (Array.isArray(error.response.data.detail)) {
      return error.response.data.detail
        .map((err: any) => err.msg || err.message || String(err))
        .join(', ');
    }
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  // Handle specific status codes
  if (error.response?.status === 500) {
    return 'Server error. Please try again later.';
  }
  
  if (error.response?.status === 404) {
    return 'The requested resource was not found.';
  }
  
  if (error.response?.status === 403) {
    return 'You do not have permission to access this resource.';
  }
  
  if (error.response?.status === 401) {
    return 'Authentication failed. Please check your credentials.';
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
};

export default api;