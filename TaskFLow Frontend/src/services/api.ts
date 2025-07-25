import axios, { AxiosResponse, AxiosError } from 'axios';
import {
  LoginResponse,
  User,
  Task,
  Company,
  DashboardData,
  ApiError,
} from '../types';

// ✅ Backend base URL
const API_BASE_URL = 'http://localhost:8000';

// ✅ Axios Instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// ✅ Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Global error handler (401 redirect)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ✅ Auth API - Updated for OAuth2PasswordRequestForm
export const authAPI = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response: AxiosResponse<LoginResponse> = await api.post('/api/v1/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token);
      }

      return response.data;
    } catch (error) {
      const axiosErr = error as AxiosError<ApiError>;
      throw new Error(
        axiosErr.response?.data?.detail || 'Login failed. Invalid credentials.'
      );
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response: AxiosResponse<User> = await api.get('/api/v1/profile');
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth');
    } catch (e) {
      console.warn('Logout cleanup failed');
    }
  },
};

// ✅ User API - Enhanced for UserList component compatibility
export const userAPI = {
  getUsers: async (params?: {
    skip?: number;
    limit?: number;
    company_id?: number;
    role?: string;
    is_active?: boolean;
  }): Promise<User[]> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.skip) queryParams.append('skip', params.skip.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.company_id) queryParams.append('company_id', params.company_id.toString());
      if (params?.role) queryParams.append('role', params.role);
      if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());

      const url = `/api/v1/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response: AxiosResponse<User[]> = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  getUser: async (userId: string | number): Promise<User> => {
    try {
      const response: AxiosResponse<User> = await api.get(`/api/v1/users/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  createUser: async (data: {
    email: string;
    username: string;
    password: string;
    role?: string;
    company_id?: number;
    is_active?: boolean;
    full_name?: string;
    phone_number?: string;
    department?: string;
    can_assign_tasks?: boolean;
  }): Promise<User> => {
    try {
      const userData = {
        email: data.email,
        username: data.username,
        password: data.password,
        role: data.role || 'user',
        company_id: data.company_id,
        is_active: data.is_active !== undefined ? data.is_active : true,
        full_name: data.full_name,
        phone_number: data.phone_number,
        department: data.department,
        can_assign_tasks: data.can_assign_tasks || false,
      };

      const response: AxiosResponse<User> = await api.post('/api/v1/users', userData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  updateUser: async (
    userId: string | number,
    updates: Partial<{
      email: string;
      username: string;
      password: string;
      role: string;
      company_id: number;
      is_active: boolean;
      full_name: string;
      phone_number: string;
      department: string;
      can_assign_tasks: boolean;
      canAssignTasks: boolean; // Support both naming conventions
      isActive: boolean; // Support both naming conventions
    }>
  ): Promise<User> => {
    try {
      // Convert camelCase to snake_case for backend compatibility
      const backendUpdates: any = { ...updates };
      
      if ('canAssignTasks' in updates) {
        backendUpdates.can_assign_tasks = updates.canAssignTasks;
        delete backendUpdates.canAssignTasks;
      }
      
      if ('isActive' in updates) {
        backendUpdates.is_active = updates.isActive;
        delete backendUpdates.isActive;
      }

      const response: AxiosResponse<User> = await api.put(`/api/v1/users/${userId}`, backendUpdates);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  deleteUser: async (userId: string | number): Promise<{ message: string }> => {
    try {
      const response: AxiosResponse<{ message: string }> = await api.delete(`/api/v1/users/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  activateUser: async (userId: string | number): Promise<{ message: string }> => {
    try {
      const response: AxiosResponse<{ message: string }> = await api.post(`/api/v1/users/${userId}/activate`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  // Profile management
  getProfile: async (): Promise<User> => {
    try {
      const response: AxiosResponse<User> = await api.get('/api/v1/profile');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  updateProfile: async (updates: Partial<{
    email: string;
    username: string;
    password: string;
    full_name: string;
    phone_number: string;
    department: string;
  }>): Promise<User> => {
    try {
      const response: AxiosResponse<User> = await api.put('/api/v1/profile', updates);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },
};

// ✅ Company API - Updated for your endpoints
export const companyAPI = {
  getCompanies: async (): Promise<Company[]> => {
    try {
      const response: AxiosResponse<Company[]> = await api.get('/api/v1/companies');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  getCompany: async (companyId: number): Promise<Company> => {
    try {
      const response: AxiosResponse<Company> = await api.get(`/api/v1/companies/${companyId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  createCompany: async (data: {
    name: string;
    description?: string;
  }): Promise<Company> => {
    try {
      const params = new URLSearchParams();
      params.append('name', data.name);
      if (data.description) params.append('description', data.description);

      const response: AxiosResponse<Company> = await api.post(`/api/v1/companies?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  updateCompany: async (
    companyId: number,
    updates: Partial<{ name: string; description: string; is_active: boolean }>
  ): Promise<Company> => {
    try {
      const response: AxiosResponse<Company> = await api.put(`/api/v1/companies/${companyId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  deleteCompany: async (companyId: number): Promise<void> => {
    try {
      await api.delete(`/api/v1/companies/${companyId}`);
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },
};

// ✅ Task API - Enhanced for better error handling
export const taskAPI = {
  getTasks: async (): Promise<Task[]> => {
    try {
      const response: AxiosResponse<Task[]> = await api.get('/api/v1/tasks');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  getTask: async (taskId: string | number): Promise<Task> => {
    try {
      const response: AxiosResponse<Task> = await api.get(`/api/v1/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  createTask: async (taskData: {
    title: string;
    description?: string;
    assigned_to_id: number;
    due_date?: string;
  }): Promise<Task> => {
    try {
      const params = new URLSearchParams();
      params.append('title', taskData.title);
      if (taskData.description) params.append('description', taskData.description);
      params.append('assigned_to_id', taskData.assigned_to_id.toString());
      if (taskData.due_date) params.append('due_date', taskData.due_date);

      const response: AxiosResponse<Task> = await api.post(`/api/v1/tasks?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  updateTask: async (
    taskId: string | number,
    updates: Partial<{
      title: string;
      description: string;
      status: string;
      assigned_to_id: number;
      due_date: string;
    }>
  ): Promise<Task> => {
    try {
      const response: AxiosResponse<Task> = await api.put(`/api/v1/tasks/${taskId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  updateTaskStatus: async (taskId: string | number, status: string): Promise<Task> => {
    try {
      const response = await api.put(`/api/v1/tasks/${taskId}`, { status });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  deleteTask: async (taskId: string | number): Promise<void> => {
    try {
      await api.delete(`/api/v1/tasks/${taskId}`);
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },

  searchTasks: async (query: string, status?: string): Promise<Task[]> => {
    // This endpoint doesn't exist in your backend yet
    console.warn('Task search not implemented in backend yet');
    return [];
  },
};

// ✅ Dashboard API - Placeholder for future implementation
export const dashboardAPI = {
  getSuperAdminDashboard: async (): Promise<DashboardData> => {
    console.warn('Dashboard endpoints not implemented in backend yet');
    return {} as DashboardData;
  },

  getAdminDashboard: async (): Promise<DashboardData> => {
    console.warn('Dashboard endpoints not implemented in backend yet');
    return {} as DashboardData;
  },

  getUserDashboard: async (): Promise<DashboardData> => {
    console.warn('Dashboard endpoints not implemented in backend yet');
    return {} as DashboardData;
  },
};

// ✅ Health Check
export const healthAPI = {
  checkHealth: async (): Promise<{ status: string }> => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error as AxiosError));
    }
  },
};

// ✅ Enhanced Error Utility
export const handleApiError = (error: AxiosError): string => {
  const response = error.response;
  
  if (response?.data) {
    const data = response.data as ApiError;
    if (data.detail) {
      // Handle validation errors
      if (typeof data.detail === 'string') {
        return data.detail;
      }
      // Handle array of validation errors
      if (Array.isArray(data.detail)) {
        return data.detail.map((err: any) => err.msg || err.message || err).join(', ');
      }
    }
    return 'Request failed';
  }
  
  if (error.request) {
    return 'Server did not respond. Check your connection.';
  }
  
  return error.message || 'Something went wrong.';
};

export default api;
