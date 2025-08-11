// types/index.ts - Fixed User interface with proper types
export interface User {
  id: number; // Changed from string to number to match backend
  name?: string;
  email: string;
  username: string;
  role: 'super_admin' | 'admin' | 'user' | 'company'; // Added 'company' role
  avatar?: string;
  canAssignTasks: boolean;
  can_assign_tasks?: boolean; // Keep both for compatibility
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
  company_id?: number;
  companyId?: number; // Keep both formats for compatibility
  fullName?: string;
  company?: Company;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  assignedTo: string;
  assignedBy: string;
  createdAt: Date;
  dueDate: Date;
  completedAt?: Date;
  reminderSet?: Date;
  tags?: string[];
}

export interface DashboardData {
  dashboard_type: string;
  user: {
    id: number;
    username: string;
    role: string;
    company_id?: number;
  };
  stats: {
    total_users?: number;
    total_tasks?: number;
    total_companies?: number;
    assigned_tasks?: number;
    company_tasks?: number;
    company_users?: number;
  };
}

export interface ApiError {
  detail: string;
}

export interface Company {
  id: number; // Changed from string to number
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  company_username?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  avatar?: string;
  tasksCount: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
  };
  createdAt: Date;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Notification {
  id: string;
  type: 'task_assigned' | 'task_completed' | 'reminder' | 'deadline_approaching' | 'task_created' | 'error';
  title: string;
  message: string;
  userId: string;
  taskId?: string;
  isRead: boolean;
  createdAt: Date;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Backend API response interfaces
export interface BackendUserResponse {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  role: 'super_admin' | 'admin' | 'user' | 'company';
  created_at: string;
  full_name?: string;
  phone_number?: string;
  department?: string;
  company_id?: number;
  company?: {
    id: number;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    company_username?: string;
  };
  can_assign_tasks: boolean;
}