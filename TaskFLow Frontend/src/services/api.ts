// src/services/api.ts
import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1', // Adjust this to match your backend URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const formData = new FormData();
    formData.append('username', email); // Note: backend expects 'username' field
    formData.append('password', password);
    
    const response = await api.post('/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },
};

// Company API
export const companyAPI = {
  // Create company with admin (for Super Admins)
  createCompanyWithAdmin: async (data: {
    company_name: string;
    company_description?: string;
    admin_username: string;
    admin_email: string;
    admin_password: string;
  }) => {
    const response = await api.post('/companies/with-admin', data);
    return response.data;
  },

  // Create company only (existing method)
  createCompany: async (name: string, description?: string) => {
    const response = await api.post('/companies', { name, description });
    return response.data;
  },

  // List companies
  listCompanies: async () => {
    const response = await api.get('/companies');
    return response.data;
  },

  // Get company by ID
  getCompany: async (companyId: number) => {
    const response = await api.get(`/companies/${companyId}`);
    return response.data;
  },

  // Update company
  updateCompany: async (companyId: number, updates: {
    name?: string;
    description?: string;
    is_active?: boolean;
  }) => {
    const response = await api.put(`/companies/${companyId}`, updates);
    return response.data;
  },

  // Delete company
  deleteCompany: async (companyId: number) => {
    const response = await api.delete(`/companies/${companyId}`);
    return response.data;
  },
};

// Users API (also export as userAPI for backward compatibility)
export const usersAPI = {
  // Create user
  createUser: async (userData: {
    email: string;
    username: string;
    password: string;
    role: string;
    company_id?: number;
    is_active?: boolean;
  }) => {
    try {
      const response = await api.post('/users', userData);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to create user';
      throw new Error(errorMessage);
    }
  },

  // List users with enhanced error handling
  listUsers: async (params?: {
    skip?: number;
    limit?: number;
    role?: string;
    is_active?: boolean;
  }) => {
    try {
      const response = await api.get('/users', { params });
      
      // Ensure the response data is an array
      if (!Array.isArray(response.data)) {
        console.warn('API returned non-array response for users:', response.data);
        return [];
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Failed to list users:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to fetch users';
      throw new Error(errorMessage);
    }
  },

  // Get user by ID
  getUser: async (userId: number) => {
    try {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to fetch user';
      throw new Error(errorMessage);
    }
  },

  // Update user
  updateUser: async (userId: number, userData: any) => {
    try {
      const response = await api.put(`/users/${userId}`, userData);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to update user';
      throw new Error(errorMessage);
    }
  },

  // Delete user (soft delete)
  deleteUser: async (userId: number) => {
    try {
      const response = await api.delete(`/users/${userId}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to delete user';
      throw new Error(errorMessage);
    }
  },

  // Activate user
  activateUser: async (userId: number) => {
    try {
      const response = await api.post(`/users/${userId}/activate`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to activate user';
      throw new Error(errorMessage);
    }
  },

  // Get current user profile
  getCurrentProfile: async () => {
    try {
      const response = await api.get('/users/me');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to fetch profile';
      throw new Error(errorMessage);
    }
  },

  // Update current user profile
  updateProfile: async (updates: {
    email?: string;
    username?: string;
    password?: string;
    full_name?: string;
    phone_number?: string;
    department?: string;
  }) => {
    try {
      const response = await api.put('/profile', updates);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to update profile';
      throw new Error(errorMessage);
    }
  },

  // Get users statistics for dashboard
  getUserStats: async () => {
    try {
      const users = await usersAPI.listUsers({ limit: 1000 });
      
      const stats = {
        total: users.length,
        active: users.filter(u => u.is_active).length,
        inactive: users.filter(u => !u.is_active).length,
        admins: users.filter(u => u.role === 'admin').length,
        regularUsers: users.filter(u => u.role === 'user').length,
        superAdmins: users.filter(u => u.role === 'super_admin').length,
      };
      
      return stats;
    } catch (error: any) {
      console.error('Failed to get user stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        admins: 0,
        regularUsers: 0,
        superAdmins: 0,
      };
    }
  },
};

// Export userAPI as an alias for backward compatibility
export const userAPI = usersAPI;

// Task API
export const taskAPI = {
  // Get all tasks
  getTasks: async (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    assigned_to_id?: number;
  }) => {
    try {
      const response = await api.get('/tasks', { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error('Failed to fetch tasks:', error);
      throw new Error(error.response?.data?.detail || 'Failed to fetch tasks');
    }
  },

  // Get task by ID
  getTask: async (taskId: number) => {
    try {
      const response = await api.get(`/tasks/${taskId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch task');
    }
  },

  // Create task
  createTask: async (taskData: {
    title: string;
    description?: string;
    assigned_to_id: number;
    due_date?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  }) => {
    try {
      const response = await api.post('/tasks', taskData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to create task');
    }
  },

  // Update task
  updateTask: async (taskId: number, updates: {
    title?: string;
    description?: string;
    status?: 'pending' | 'in_progress' | 'completed';
    due_date?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  }) => {
    try {
      const response = await api.put(`/tasks/${taskId}`, updates);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to update task');
    }
  },

  // Update task status
  updateTaskStatus: async (taskId: number, status: 'pending' | 'in_progress' | 'completed') => {
    try {
      const response = await api.put(`/tasks/${taskId}`, { status });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to update task status');
    }
  },

  // Delete task
  deleteTask: async (taskId: number) => {
    try {
      const response = await api.delete(`/tasks/${taskId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to delete task');
    }
  },

  // Get task statistics
  getTaskStats: async () => {
    try {
      const tasks = await taskAPI.getTasks({ limit: 1000 });
      
      const now = new Date();
      const stats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        overdue: tasks.filter(t => {
          if (!t.due_date || t.status === 'completed') return false;
          return new Date(t.due_date) < now;
        }).length,
        highPriority: tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
      };
      
      return stats;
    } catch (error: any) {
      console.error('Failed to get task stats:', error);
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
        highPriority: 0,
      };
    }
  },
};

// Notification API
export const notificationAPI = {
  // Get notifications for current user
  getNotifications: async (params?: {
    skip?: number;
    limit?: number;
    is_read?: boolean;
  }) => {
    try {
      const response = await api.get('/notifications', { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId: number) => {
    try {
      const response = await api.put(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to mark notification as read');
    }
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    try {
      const response = await api.put('/notifications/mark-all-read');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to mark all notifications as read');
    }
  },
};

// Dashboard API for getting aggregated data
export const dashboardAPI = {
  // Get dashboard data for current user based on role
  getDashboardData: async () => {
    try {
      const [userStats, taskStats, notifications] = await Promise.allSettled([
        usersAPI.getUserStats(),
        taskAPI.getTaskStats(),
        notificationAPI.getNotifications({ limit: 10 }),
      ]);

      return {
        userStats: userStats.status === 'fulfilled' ? userStats.value : null,
        taskStats: taskStats.status === 'fulfilled' ? taskStats.value : null,
        recentNotifications: notifications.status === 'fulfilled' ? notifications.value : [],
      };
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      throw new Error('Failed to load dashboard data');
    }
  },

  // Get recent activities
  getRecentActivities: async (limit: number = 10) => {
    try {
      // This would ideally be a dedicated endpoint, but for now we'll combine data
      const [tasks, notifications] = await Promise.allSettled([
        taskAPI.getTasks({ limit: 20 }),
        notificationAPI.getNotifications({ limit: 10 }),
      ]);

      const activities = [];

      // Add recent task activities
      if (tasks.status === 'fulfilled' && Array.isArray(tasks.value)) {
        const recentTasks = tasks.value
          .filter(task => task.created_at)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);

        recentTasks.forEach(task => {
          activities.push({
            id: `task-${task.id}`,
            type: 'task_created',
            message: `New task "${task.title}" was created`,
            timestamp: new Date(task.created_at),
            task_id: task.id,
          });
        });
      }

      // Add notification activities
      if (notifications.status === 'fulfilled' && Array.isArray(notifications.value)) {
        notifications.value.forEach(notif => {
          activities.push({
            id: `notification-${notif.id}`,
            type: 'notification',
            message: notif.message,
            timestamp: new Date(notif.created_at),
            notification_id: notif.id,
          });
        });
      }

      // Sort by timestamp and limit
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return activities.slice(0, limit);

    } catch (error: any) {
      console.error('Failed to get recent activities:', error);
      return [];
    }
  },
};

// Health check
export const healthAPI = {
  checkHealth: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error: any) {
      throw new Error('Health check failed');
    }
  },
};

// Error handling utility
export const handleApiError = (error: any): string => {
  if (error.response?.data?.detail) {
    // Handle FastAPI validation errors
    if (typeof error.response.data.detail === 'string') {
      return error.response.data.detail;
    }
    
    // Handle array of validation errors
    if (Array.isArray(error.response.data.detail)) {
      return error.response.data.detail
        .map((err: any) => err.msg || err.message || String(err))
        .join(', ');
    }
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

export default api;