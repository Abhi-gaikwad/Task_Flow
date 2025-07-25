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
      params.append('username', username); // Your backend uses 'username' field for email
      params.append('password', password);

      const response: AxiosResponse<LoginResponse> = await api.post('/api/v1/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      // Store the token
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
      // Your backend doesn't have a logout endpoint, so just clear local storage
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth');
    } catch (e) {
      console.warn('Logout cleanup failed');
    }
  },
};

// ✅ User API - Updated for your RBAC endpoints
export const userAPI = {
  getUsers: async (params?: {
    skip?: number;
    limit?: number;
    company_id?: number;
    role?: string;
    is_active?: boolean;
  }): Promise<User[]> => {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.company_id) queryParams.append('company_id', params.company_id.toString());
    if (params?.role) queryParams.append('role', params.role);
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());

    const url = `/api/v1/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response: AxiosResponse<User[]> = await api.get(url);
    return response.data;
  },

  getUser: async (userId: number): Promise<User> => {
    const response: AxiosResponse<User> = await api.get(`/api/v1/users/${userId}`);
    return response.data;
  },

  createUser: async (data: {
    email: string;
    username: string;
    password: string;
    role: string;
    company_id?: number;
    is_active?: boolean;
  }): Promise<User> => {
    const response: AxiosResponse<User> = await api.post('/api/v1/users', data);
    return response.data;
  },

  updateUser: async (
    userId: number,
    updates: Partial<{
      email: string;
      username: string;
      password: string;
      role: string;
      company_id: number;
      is_active: boolean;
    }>
  ): Promise<User> => {
    const response: AxiosResponse<User> = await api.put(`/api/v1/users/${userId}`, updates);
    return response.data;
  },

  deleteUser: async (userId: number): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.delete(`/api/v1/users/${userId}`);
    return response.data;
  },

  activateUser: async (userId: number): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.post(`/api/v1/users/${userId}/activate`);
    return response.data;
  },

  // Profile management
  getProfile: async (): Promise<User> => {
    const response: AxiosResponse<User> = await api.get('/api/v1/profile');
    return response.data;
  },

  updateProfile: async (updates: Partial<{
    email: string;
    username: string;
    password: string;
  }>): Promise<User> => {
    const response: AxiosResponse<User> = await api.put('/api/v1/profile', updates);
    return response.data;
  },
};

// ✅ Company API - Updated for your endpoints
export const companyAPI = {
  getCompanies: async (): Promise<Company[]> => {
    const response: AxiosResponse<Company[]> = await api.get('/api/v1/companies');
    return response.data;
  },

  getCompany: async (companyId: number): Promise<Company> => {
    const response: AxiosResponse<Company> = await api.get(`/api/v1/companies/${companyId}`);
    return response.data;
  },

  createCompany: async (data: {
    name: string;
    description?: string;
  }): Promise<Company> => {
    // Your backend expects query parameters for company creation
    const params = new URLSearchParams();
    params.append('name', data.name);
    if (data.description) params.append('description', data.description);

    const response: AxiosResponse<Company> = await api.post(`/api/v1/companies?${params.toString()}`);
    return response.data;
  },

  updateCompany: async (
    companyId: number,
    updates: Partial<{ name: string; description: string; is_active: boolean }>
  ): Promise<Company> => {
    const response: AxiosResponse<Company> = await api.put(`/api/v1/companies/${companyId}`, updates);
    return response.data;
  },

  deleteCompany: async (companyId: number): Promise<void> => {
    await api.delete(`/api/v1/companies/${companyId}`);
  },
};

// ✅ Task API - Updated for your backend structure
export const taskAPI = {
  getTasks: async (): Promise<Task[]> => {
    const response: AxiosResponse<Task[]> = await api.get('/api/v1/tasks');
    return response.data;
  },

  getTask: async (taskId: number): Promise<Task> => {
    const response: AxiosResponse<Task> = await api.get(`/api/v1/tasks/${taskId}`);
    return response.data;
  },

  createTask: async (taskData: {
    title: string;
    description?: string;
    assigned_to_id: number; // Match your backend field name
  }): Promise<Task> => {
    // Your backend expects query parameters for task creation
    const params = new URLSearchParams();
    params.append('title', taskData.title);
    if (taskData.description) params.append('description', taskData.description);
    params.append('assigned_to_id', taskData.assigned_to_id.toString());

    const response: AxiosResponse<Task> = await api.post(`/api/v1/tasks?${params.toString()}`);
    return response.data;
  },

  updateTask: async (
    taskId: number,
    updates: Partial<{
      title: string;
      description: string;
      status: string;
      assigned_to_id: number;
      due_date: string;
    }>
  ): Promise<Task> => {
    const response: AxiosResponse<Task> = await api.put(`/api/v1/tasks/${taskId}`, updates);
    return response.data;
  },

  updateTaskStatus: async (taskId: number, status: string): Promise<Task> => {
    const response = await api.put(`/api/v1/tasks/${taskId}`, { status });
    return response.data;
  },

  deleteTask: async (taskId: number): Promise<void> => {
    await api.delete(`/api/v1/tasks/${taskId}`);
  },

  // Note: Your backend doesn't have search endpoint, remove or implement later
  searchTasks: async (query: string, status?: string): Promise<Task[]> => {
    // This endpoint doesn't exist in your backend yet
    console.warn('Task search not implemented in backend');
    return [];
  },
};

// ✅ Dashboard API - These endpoints don't exist in your backend yet
export const dashboardAPI = {
  getSuperAdminDashboard: async (): Promise<DashboardData> => {
    // You'll need to implement these endpoints in your backend
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
    const response = await api.get('/health'); // Your backend has this endpoint
    return response.data;
  },
};

// ✅ Error Utility
export const handleApiError = (error: AxiosError): string => {
  const response = error.response;
  if (response?.data) {
    const data = response.data as ApiError;
    return data.detail || 'Request failed';
  }
  if (error.request) {
    return 'Server did not respond. Check your connection.';
  }
  return 'Something went wrong.';
};

export default api;
