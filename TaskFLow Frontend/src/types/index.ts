export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'user';
  avatar?: string;
  canAssignTasks: boolean;
  isActive: boolean;
  createdAt: Date;
  lastLogin: Date;
  company_id?: number;        
  username?: string;          
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
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
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