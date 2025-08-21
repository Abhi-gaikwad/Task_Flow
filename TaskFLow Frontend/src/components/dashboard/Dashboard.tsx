// src/components/dashboard/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import CompanyCreationForm from '../admin/CompanyCreationForm';
import { Modal } from '../common/Modal';
import { useLocation } from "react-router-dom";
import { usersAPI, companyAPI, tasksAPI, notificationsAPI } from '../../services/api';
import { analyticsAPI } from '../../services/api';

import {
  Users,
  Building,
  CheckSquare,
  Clock,
  AlertTriangle,
  UserPlus,
  TrendingUp,
  Bell,
  Calendar,
  UserCheck,
  UserX,
  Eye,
  Edit,
  Mail,
  Plus,
  CheckCircle,
  User, 
} from 'lucide-react';

export interface UserTaskStats {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  upcomingTasks: number;
}

export interface DashboardStats {
  totalUsers: number;
  totalCompanies: number;
  activeCompanies?: number;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  upcomingTasks: number;
  activeUsers: number;
  inactiveUsers: number;
  assignedToMe?: UserTaskStats;
  assignedByMe?: UserTaskStats;
  canCreateTasks?: boolean;
  // Additional user permission stats
  delegatedPending?: number;
  delegatedCompleted?: number;
}

export interface RecentActivity {
  id: string;
  type: 'task_created' | 'task_completed' | 'user_added' | 'company_created';
  message: string;
  timestamp: Date;
  user?: string;
}

export interface DashboardUser {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  company?: {
    id: number;
    name: string;
  };
}

export interface Company {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  company_username?: string;
}

// Analytics API response structure
export interface AnalyticsResponse {
  scope: 'global' | 'company' | 'user';
  role: string;
  company_id?: number;
  company_name?: string;
  user_id?: number;
  can_create_tasks?: boolean;
  totals: {
    total_companies?: number;
    active_companies?: number;
    total_users?: number;
    active_users?: number;
    inactive_users?: number;
    total_tasks: number;
    pending_tasks: number;
    in_progress_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    upcoming_tasks?: number;
  };
  assigned_to_me?: {
    total_tasks: number;
    pending_tasks: number;
    in_progress_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    upcoming_tasks: number;
  };
  assigned_by_me?: {
    total_tasks: number;
    pending_tasks: number;
    in_progress_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    upcoming_tasks: number;
  };
  delegated_pending?: number;
  delegated_completed?: number;
  priority_summary: Record<string, number>;
  average_completion_time_hours: number;
  recent_activity: {
    tasks_created_last_7_days?: number;
    tasks_completed_last_7_days?: number;
    tasks_assigned_to_me_last_7_days?: number;
    tasks_created_by_me_last_7_days?: number;
    companies_managed?: number;
  };
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { tasks = [], notifications = [], setTasks } = useApp();

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalCompanies: 0,
    totalTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    upcomingTasks: 0,
    activeUsers: 0,
    inactiveUsers: 0,
  });

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);

  const loadUsers = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'company')) {
      console.log('[Dashboard] User not authorized to load users');
      setUsers([]);
      return;
    }

    try {
      setUsersLoading(true);
      console.log('[Dashboard] Loading users...');
      
      const usersData = await usersAPI.getUsers({
        limit: 100,
        is_active: undefined,
      });
      
      console.log('[Dashboard] Users loaded:', usersData?.length || 0);
      setUsers(usersData || []);
      
    } catch (err: any) {
      console.error('[Dashboard] Failed to load users:', err);
      setError('Failed to load users data');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadCompanies = async () => {
    if (!user || user.role !== 'super_admin') {
      setCompanies([]);
      return;
    }
    try {
      setCompaniesLoading(true);
      const companiesData = await companyAPI.listCompanies();
      if (Array.isArray(companiesData)) {
        setCompanies(companiesData);
      }
    } catch (err: any) {
      console.error('Failed to load companies:', err);
      setError('Failed to load companies data');
    } finally {
      setCompaniesLoading(false);
    }
  };

  const location = useLocation();

useEffect(() => {
  const loadDashboardData = async () => {
    if (!user) {
      console.log('[Dashboard] No user found, skipping load');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('[Dashboard] Starting to load dashboard data for user:', {
        role: user.role,
        id: user.id,
        email: user.email,
        company_id: user.company_id
      });

      // Try analytics API first
      try {
        console.log('[Dashboard] Attempting analytics API call...');
        const analyticsData = await analyticsAPI.getDashboardAnalytics();
        console.log('[Dashboard] Analytics API success! Data received:', analyticsData);

        // Extract data from the response structure based on role
        const totals = analyticsData.totals || {};
        const recentActivity = analyticsData.recent_activity || {};
        const prioritySummary = analyticsData.priority_summary || {};
        const canCreateTasks = analyticsData.can_create_tasks || false;
        const assignedToMe = analyticsData.assigned_to_me;
        const assignedByMe = analyticsData.assigned_by_me;
        
        let newStats: DashboardStats = {
          // Initialize all required stats with defaults
          totalUsers: 0,
          totalCompanies: 0,
          activeCompanies: 0,
          totalTasks: 0,
          pendingTasks: 0,
          inProgressTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          upcomingTasks: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          canCreateTasks: canCreateTasks,
        };

        // Role-specific stat mapping
        switch (user.role) {
          case 'super_admin':
            newStats = {
              ...newStats,
              totalCompanies: totals.total_companies || 0,
              activeCompanies: totals.active_companies || 0,
            };
            break;

          case 'company':
            newStats = {
              ...newStats,
              totalUsers: totals.total_users || 0,
              activeUsers: totals.active_users || 0,
              inactiveUsers: totals.inactive_users || 0,
              totalTasks: totals.total_tasks || 0,
              pendingTasks: totals.pending_tasks || 0,
              inProgressTasks: totals.in_progress_tasks || 0,
              completedTasks: totals.completed_tasks || 0,
              overdueTasks: totals.overdue_tasks || 0,
              upcomingTasks: totals.upcoming_tasks || 0,
            };
            break;

          case 'admin':
            newStats = {
              ...newStats,
              totalUsers: totals.total_users || 0,
              activeUsers: totals.active_users || 0,
              inactiveUsers: totals.inactive_users || 0,
              totalTasks: totals.total_tasks || 0,
              pendingTasks: totals.pending_tasks || 0,
              inProgressTasks: totals.in_progress_tasks || 0,
              completedTasks: totals.completed_tasks || 0,
              overdueTasks: totals.overdue_tasks || 0,
              upcomingTasks: totals.upcoming_tasks || 0,
              assignedToMe: assignedToMe ? {
                totalTasks: assignedToMe.total_tasks || 0,
                pendingTasks: assignedToMe.pending_tasks || 0,
                inProgressTasks: assignedToMe.in_progress_tasks || 0,
                completedTasks: assignedToMe.completed_tasks || 0,
                overdueTasks: assignedToMe.overdue_tasks || 0,
                upcomingTasks: assignedToMe.upcoming_tasks || 0,
              } : undefined,
              assignedByMe: assignedByMe ? {
                totalTasks: assignedByMe.total_tasks || 0,
                pendingTasks: assignedByMe.pending_tasks || 0,
                inProgressTasks: assignedByMe.in_progress_tasks || 0,
                completedTasks: assignedByMe.completed_tasks || 0,
                overdueTasks: assignedByMe.overdue_tasks || 0,
                upcomingTasks: assignedByMe.upcoming_tasks || 0,
              } : undefined,
            };
            break;

          case 'user':
          default:
            newStats = {
              ...newStats,
              totalTasks: totals.total_tasks || 0,
              pendingTasks: totals.pending_tasks || 0,
              inProgressTasks: totals.in_progress_tasks || 0,
              completedTasks: totals.completed_tasks || 0,
              overdueTasks: totals.overdue_tasks || 0,
              upcomingTasks: totals.upcoming_tasks || 0,
              assignedToMe: assignedToMe ? {
                totalTasks: assignedToMe.total_tasks || 0,
                pendingTasks: assignedToMe.pending_tasks || 0,
                inProgressTasks: assignedToMe.in_progress_tasks || 0,
                completedTasks: assignedToMe.completed_tasks || 0,
                overdueTasks: assignedToMe.overdue_tasks || 0,
                upcomingTasks: assignedToMe.upcoming_tasks || 0,
              } : undefined,
            };

            // Add create-task permission specific stats
            if (canCreateTasks) {
              newStats.assignedByMe = assignedByMe ? {
                totalTasks: assignedByMe.total_tasks || 0,
                pendingTasks: assignedByMe.pending_tasks || 0,
                inProgressTasks: assignedByMe.in_progress_tasks || 0,
                completedTasks: assignedByMe.completed_tasks || 0,
                overdueTasks: assignedByMe.overdue_tasks || 0,
                upcomingTasks: assignedByMe.upcoming_tasks || 0,
              } : undefined;
              
              newStats.delegatedPending = analyticsData.delegated_pending || assignedByMe?.pending_tasks || 0;
              newStats.delegatedCompleted = analyticsData.delegated_completed || assignedByMe?.completed_tasks || 0;
            }
            break;
        }

        console.log('[Dashboard] Setting stats from analytics:', newStats);
        setStats(newStats);

        // Generate activities from analytics
        const activities: RecentActivity[] = [];
        
        // Role-specific activity generation
        if (user.role === 'super_admin') {
          if (newStats.totalCompanies > 0) {
            activities.push({
              id: "companies-managed",
              type: "company_created",
              message: `Managing ${newStats.totalCompanies} companies (${newStats.activeCompanies} active)`,
              timestamp: new Date(),
            });
          }
        } else {
          // Add recent task activity for non-super-admin roles
          if (recentActivity.tasks_created_last_7_days > 0) {
            activities.push({
              id: "created-7d",
              type: "task_created",
              message: `${recentActivity.tasks_created_last_7_days} tasks created in last 7 days`,
              timestamp: new Date(),
            });
          }
          
          if (recentActivity.tasks_completed_last_7_days > 0) {
            activities.push({
              id: "completed-7d",
              type: "task_completed",
              message: `${recentActivity.tasks_completed_last_7_days} tasks completed in last 7 days`,
              timestamp: new Date(),
            });
          }

          // Add priority summary to activities
          Object.entries(prioritySummary).forEach(([priority, count]) => {
            if (typeof count === 'number' && count > 0) {
              activities.push({
                id: `priority-${priority}`,
                type: "task_created",
                message: `${count} ${priority} priority tasks`,
                timestamp: new Date(),
              });
            }
          });

          // Add user/company specific activities
          if ((user.role === 'company' || user.role === 'admin') && newStats.totalUsers > 0) {
            activities.push({
              id: "users-count",
              type: "user_added",
              message: `${newStats.activeUsers} active users out of ${newStats.totalUsers} total`,
              timestamp: new Date(),
            });
          }

          // Add completion time info if available
          if (analyticsData.average_completion_time_hours > 0) {
            activities.push({
              id: "avg-completion",
              type: "task_completed",
              message: `Average task completion time: ${analyticsData.average_completion_time_hours.toFixed(1)} hours`,
              timestamp: new Date(),
            });
          }

          // Add user-specific activities for create-task users
          if (user.role === 'user' && canCreateTasks) {
            if (recentActivity.tasks_created_by_me_last_7_days > 0) {
              activities.push({
                id: "created-by-me-7d",
                type: "task_created",
                message: `You created ${recentActivity.tasks_created_by_me_last_7_days} tasks in last 7 days`,
                timestamp: new Date(),
              });
            }
            
            if (recentActivity.tasks_assigned_to_me_last_7_days > 0) {
              activities.push({
                id: "assigned-to-me-7d",
                type: "task_created",
                message: `${recentActivity.tasks_assigned_to_me_last_7_days} tasks assigned to you in last 7 days`,
                timestamp: new Date(),
              });
            }
          }
        }

        // If no activities, add a default one based on role
        if (activities.length === 0) {
          let message = "Welcome to your dashboard!";
          switch (user.role) {
            case 'super_admin':
              message = "Global system overview ready";
              break;
            case 'company':
              message = "Company dashboard ready - manage your team and tasks!";
              break;
            case 'admin':
              message = "Admin dashboard ready - oversee tasks and users!";
              break;
            case 'user':
              message = canCreateTasks 
                ? "Your task management dashboard - create and track tasks!" 
                : "Your personal task dashboard - stay productive!";
              break;
          }
          
          activities.push({
            id: "welcome",
            type: "task_created",
            message: message,
            timestamp: new Date(),
          });
        }

        setRecentActivities(activities);
        console.log('[Dashboard] Analytics data loaded successfully');

      } catch (analyticsError: any) {
        console.error('[Dashboard] Analytics API failed:', {
          error: analyticsError,
          message: analyticsError.message,
          status: analyticsError.response?.status,
          data: analyticsError.response?.data
        });
        
        // Fallback: Load basic task data (only for non-super-admin roles)
        if (user.role !== 'super_admin') {
          console.log('[Dashboard] Starting fallback data loading...');
          
          try {
            let freshTasks = [];
            console.log('[Dashboard] Loading tasks for role:', user.role);
            
            if (user.role === 'user') {
              freshTasks = await tasksAPI.getMyTasks({ limit: 50 });
              console.log('[Dashboard] Loaded user tasks:', freshTasks?.length);
            } else if (user.role === 'admin' || user.role === 'company') {
              freshTasks = await tasksAPI.getAllTasks({ limit: 50 });
              console.log('[Dashboard] Loaded all tasks:', freshTasks?.length);
            }
            
            // Ensure freshTasks is an array
            if (!Array.isArray(freshTasks)) {
              console.warn('[Dashboard] Tasks data is not an array, using empty array');
              freshTasks = [];
            }
            
            // Calculate stats from tasks
            const now = new Date();
            const fallbackStats: DashboardStats = {
              totalUsers: 0,
              totalCompanies: 0,
              activeCompanies: 0,
              totalTasks: freshTasks.length,
              pendingTasks: freshTasks.filter(t => t.status === 'pending').length,
              inProgressTasks: freshTasks.filter(t => t.status === 'in_progress').length,
              completedTasks: freshTasks.filter(t => t.status === 'completed').length,
              overdueTasks: freshTasks.filter(t => {
                if (!t.due_date || t.status === 'completed') return false;
                try {
                  return new Date(t.due_date) < now;
                } catch (e) {
                  return false;
                }
              }).length,
              upcomingTasks: freshTasks.filter(t => {
                if (!t.due_date || t.status === 'completed') return false;
                try {
                  const dueDate = new Date(t.due_date);
                  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                  return dueDate >= now && dueDate <= weekFromNow;
                } catch (e) {
                  return false;
                }
              }).length,
              activeUsers: 0,
              inactiveUsers: 0,
            };
            
            console.log('[Dashboard] Fallback stats calculated:', fallbackStats);
            setStats(fallbackStats);
            
            if (setTasks && typeof setTasks === 'function') {
              setTasks(freshTasks);
            }
            
            // Generate activities from recent tasks
            const fallbackActivities: RecentActivity[] = [];
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            freshTasks.forEach((task, index) => {
              if (index < 5) { // Limit to 5 activities
                try {
                  const createdAt = new Date(task.created_at);
                  const isRecent = createdAt >= sevenDaysAgo;
                  
                  fallbackActivities.push({
                    id: `task-${task.id}`,
                    type: task.status === 'completed' ? "task_completed" : "task_created",
                    message: `Task "${task.title}" was ${task.status === 'completed' ? 'completed' : 'assigned'}${isRecent ? ' (recent)' : ''}`,
                    timestamp: createdAt,
                    user: task.assignee_name || task.creator_name,
                  });
                } catch (e) {
                  console.warn('[Dashboard] Error processing task for activity:', task.id, e);
                }
              }
            });

            // Sort by most recent
            fallbackActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            
            // If no activities, add a default one
            if (fallbackActivities.length === 0) {
              fallbackActivities.push({
                id: "no-tasks",
                type: "task_created",
                message: "No recent task activity",
                timestamp: new Date(),
              });
            }
            
            setRecentActivities(fallbackActivities);
            console.log('[Dashboard] Fallback data loaded successfully');
            
          } catch (fallbackError: any) {
            console.error('[Dashboard] Fallback loading also failed:', fallbackError);
            
            // Set minimal working state
            setStats({
              totalUsers: 0,
              totalCompanies: 0,
              activeCompanies: 0,
              totalTasks: 0,
              pendingTasks: 0,
              inProgressTasks: 0,
              completedTasks: 0,
              overdueTasks: 0,
              upcomingTasks: 0,
              activeUsers: 0,
              inactiveUsers: 0,
            });
            setRecentActivities([{
              id: "error",
              type: "task_created",
              message: "Unable to load recent activities",
              timestamp: new Date(),
            }]);
            
            console.log('[Dashboard] Set minimal working state due to fallback failure');
          }
        } else {
          // For super admin, set minimal company stats
          setStats({
            totalUsers: 0,
            totalCompanies: 0,
            activeCompanies: 0,
            totalTasks: 0,
            pendingTasks: 0,
            inProgressTasks: 0,
            completedTasks: 0,
            overdueTasks: 0,
            upcomingTasks: 0,
            activeUsers: 0,
            inactiveUsers: 0,
          });
          setRecentActivities([{
            id: "super-admin-error",
            type: "company_created",
            message: "Unable to load company data",
            timestamp: new Date(),
          }]);
        }
      }

      // Load additional role-specific data
      try {
        if (user.role === "super_admin") {
          console.log('[Dashboard] Loading companies for super admin...');
          await loadCompanies();
        }
        if (user.role === "admin" || user.role === "company") {
          console.log('[Dashboard] Loading users for admin/company...');
          await loadUsers();
        }
      } catch (roleSpecificError: any) {
        console.error('[Dashboard] Role-specific data loading failed:', roleSpecificError);
        // Don't fail the entire dashboard for role-specific data
      }

    } catch (generalError: any) {
      console.error('[Dashboard] General dashboard loading error:', generalError);
      
      setError('Failed to load dashboard. Please try refreshing the page.');
      setStats({
        totalUsers: 0,
        totalCompanies: 0,
        activeCompanies: 0,
        totalTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        upcomingTasks: 0,
        activeUsers: 0,
        inactiveUsers: 0,
      });
      setRecentActivities([{
        id: "general-error",
        type: "task_created",
        message: "Dashboard temporarily unavailable",
        timestamp: new Date(),
      }]);
    } finally {
      console.log('[Dashboard] Finished loading dashboard data');
      setLoading(false);
    }
  };

  if (location.pathname.includes("/dashboard") && user) {
    console.log('[Dashboard] Conditions met, starting dashboard load...');
    loadDashboardData();
  } else {
    console.log('[Dashboard] Conditions not met for loading:', { 
      pathIncludes: location.pathname.includes("/dashboard"), 
      hasUser: !!user,
      currentPath: location.pathname
    });
    setLoading(false);
  }
}, [user, location.pathname]);

  const handleUserAction = async (action: string, userId: number) => {
    try {
      if (action === 'activate') {
        await usersAPI.activateUser(userId);
      } else if (action === 'deactivate') {
        await usersAPI.deleteUser(userId);
      }
      await loadUsers();
    } catch (err: any) {
      console.error(`Failed to ${action} user:`, err);
      setError(`Failed to ${action} user`);
    }
  };

  const handleCreateCompanySuccess = () => {
    console.log("Company created successfully, closing modal and reloading companies");
    setShowCreateCompanyModal(false);
    loadCompanies();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-red-800">Dashboard Error</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Updated stat cards configuration with proper role hierarchy
const statCards = [
  // ========== SUPER ADMIN CARDS ==========
  {
    title: 'Total Companies',
    value: stats.totalCompanies || 0,
    icon: Building,
    color: 'bg-cyan-500',
    show: user?.role === 'super_admin',
  },
  {
    title: 'Active Companies',
    value: stats.activeCompanies || 0,
    icon: Building,
    color: 'bg-emerald-500',
    show: user?.role === 'super_admin',
  },

  // ========== COMPANY ROLE CARDS ==========
  {
    title: 'Total Users',
    value: stats.totalUsers || 0,
    icon: Users,
    color: 'bg-indigo-500',
    show: user?.role === 'company',
  },
  {
    title: 'Active Users',
    value: stats.activeUsers || 0,
    icon: Users, // Changed from UserCheck to Users (more commonly available)
    color: 'bg-green-500',
    show: user?.role === 'company',
  },
  {
    title: 'Total Tasks',
    value: stats.totalTasks || 0,
    icon: CheckSquare,
    color: 'bg-blue-500',
    show: user?.role === 'company',
  },
  {
    title: 'Pending Tasks',
    value: stats.pendingTasks || 0,
    icon: Clock,
    color: 'bg-yellow-500',
    show: user?.role === 'company',
  },
  {
    title: 'In Progress',
    value: stats.inProgressTasks || 0,
    icon: TrendingUp,
    color: 'bg-orange-500',
    show: user?.role === 'company',
  },
  {
    title: 'Completed',
    value: stats.completedTasks || 0,
    icon: CheckCircle,
    color: 'bg-green-500',
    show: user?.role === 'company',
  },
  {
    title: 'Overdue Tasks',
    value: stats.overdueTasks || 0,
    icon: AlertTriangle,
    color: 'bg-red-500',
    show: user?.role === 'company',
  },

  // ========== ADMIN ROLE CARDS ==========
  {
    title: 'Total Users',
    value: stats.totalUsers || 0,
    icon: Users,
    color: 'bg-indigo-500',
    show: user?.role === 'admin',
  },
  {
    title: 'Active Users',
    value: stats.activeUsers || 0,
    icon: Users, // Changed from UserCheck to Users
    color: 'bg-green-500',
    show: user?.role === 'admin',
  },
  {
    title: 'Total Tasks',
    value: stats.totalTasks || 0,
    icon: CheckSquare,
    color: 'bg-blue-500',
    show: user?.role === 'admin',
  },
  {
    title: 'Pending Tasks',
    value: stats.pendingTasks || 0,
    icon: Clock,
    color: 'bg-yellow-500',
    show: user?.role === 'admin',
  },
  {
    title: 'In Progress',
    value: stats.inProgressTasks || 0,
    icon: TrendingUp,
    color: 'bg-orange-500',
    show: user?.role === 'admin',
  },
  {
    title: 'Completed',
    value: stats.completedTasks || 0,
    icon: CheckCircle,
    color: 'bg-green-500',
    show: user?.role === 'admin',
  },
  {
    title: 'Overdue Tasks',
    value: stats.overdueTasks || 0,
    icon: AlertTriangle,
    color: 'bg-red-500',
    show: user?.role === 'admin',
  },
  {
    title: 'Assigned by Me',
    value: stats.assignedByMe?.totalTasks || 0,
    icon: Users, // Changed from UserPlus to Users
    color: 'bg-purple-500',
    show: user?.role === 'admin',
  },
  {
    title: 'Assigned to Me',
    value: stats.assignedToMe?.totalTasks || 0,
    icon: User,
    color: 'bg-teal-500',
    show: user?.role === 'admin',
  },

  // ========== USER ROLE CARDS (Basic - No Create Permission) ==========
  {
    title: 'Total Tasks',
    value: stats.totalTasks || 0,
    icon: CheckSquare,
    color: 'bg-blue-500',
    show: user?.role === 'user' && !stats.canCreateTasks,
  },
  {
    title: 'Pending Tasks',
    value: stats.pendingTasks || 0,
    icon: Clock,
    color: 'bg-yellow-500',
    show: user?.role === 'user' && !stats.canCreateTasks,
  },
  {
    title: 'Completed Tasks',
    value: stats.completedTasks || 0,
    icon: CheckCircle,
    color: 'bg-green-500',
    show: user?.role === 'user' && !stats.canCreateTasks,
  },
  {
    title: 'Overdue Tasks',
    value: stats.overdueTasks || 0,
    icon: AlertTriangle,
    color: 'bg-red-500',
    show: user?.role === 'user' && !stats.canCreateTasks,
  },
  // {
  //   title: 'Assigned to Me',
  //   value: stats.assignedToMe?.totalTasks || 0,
  //   icon: User,
  //   color: 'bg-teal-500',
  //   show: user?.role === 'user' && !stats.canCreateTasks,
  // },

  // ========== USER ROLE CARDS (With Create Permission) ==========
  {
    title: 'Total Tasks',
    value: stats.totalTasks || 0,
    icon: CheckSquare,
    color: 'bg-blue-500',
    show: user?.role === 'user' && stats.canCreateTasks,
  },
  {
    title: 'Pending Tasks',
    value: stats.pendingTasks || 0,
    icon: Clock,
    color: 'bg-yellow-500',
    show: user?.role === 'user' && stats.canCreateTasks,
  },
  {
    title: 'Completed Tasks',
    value: stats.completedTasks || 0,
    icon: CheckCircle,
    color: 'bg-green-500',
    show: user?.role === 'user' && stats.canCreateTasks,
  },
  {
    title: 'Overdue Tasks',
    value: stats.overdueTasks || 0,
    icon: AlertTriangle,
    color: 'bg-red-500',
    show: user?.role === 'user' && stats.canCreateTasks,
  },
  {
    title: 'Assigned to Me',
    value: stats.assignedToMe?.totalTasks || 0,
    icon: User,
    color: 'bg-teal-500',
    show: user?.role === 'user' && stats.canCreateTasks,
  },
  {
    title: 'Delegated Pending',
    value: stats.delegatedPending || stats.assignedByMe?.pendingTasks || 0,
    icon: Clock,
    color: 'bg-amber-500',
    show: user?.role === 'user' && stats.canCreateTasks,
  },
  {
    title: 'Delegated Completed',
    value: stats.delegatedCompleted || stats.assignedByMe?.completedTasks || 0,
    icon: CheckCircle,
    color: 'bg-emerald-500',
    show: user?.role === 'user' && stats.canCreateTasks,
  },
  {
    title: 'Assigned by Me',
    value: stats.assignedByMe?.totalTasks || 0,
    icon: Users, // Changed from UserPlus to Users
    color: 'bg-purple-500',
    show: user?.role === 'user' && stats.canCreateTasks,
  },
].filter(card => card.show);

// Show team member section for admin and company roles
const shouldShowUserSection = (user?.role === 'admin' || user?.role === 'company') && users.length > 0;

return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.username}!
            </h1>
            <p className="text-gray-600 mt-1">
              {user?.role === 'super_admin' && 'Managing the entire platform and all companies.'}
              {user?.role === 'company' && 'Managing your company and all its tasks.'}
              {user?.role === 'admin' && 'Managing users and tasks within your organization.'}
              {user?.role === 'user' && "Here's what's happening with your tasks today."}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
              {user?.role?.replace('_', ' ')}
            </span>
            {(user?.role === 'admin' || user?.role === 'company') && user?.company?.name && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-800">
                Company: {user.company.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Recent Activity
            </h2>
          </div>
          <div className="p-6">
            {recentActivities.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.message}</p>
                      <p className="text-xs text-gray-500">
                        {activity.timestamp.toLocaleDateString()} at {activity.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                <div className="flex items-center">
                  <CheckSquare className="w-5 h-5 text-blue-600 mr-3" />
                  <span className="text-blue-900 font-medium">Create New Task</span>
                </div>
              </button>

              {user?.role === 'super_admin' && (
                <button
                  onClick={() => {
                    console.log("Create New Company button clicked from Quick Actions!");
                    setShowCreateCompanyModal(true);
                  }}
                  className="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors flex items-center"
                >
                  <Building className="w-5 h-5 text-green-600 mr-3" />
                  <span className="text-green-900 font-medium">Create New Company</span>
                </button>
              )}

              <button className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center">
                  <Bell className="w-5 h-5 text-gray-600 mr-3" />
                  <span className="text-gray-900 font-medium">View Notifications</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Super Admin: Companies List */}
      {user?.role === 'super_admin' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Building className="w-5 h-5 mr-2" />
                Companies ({companies.length})
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={loadCompanies}
                  disabled={companiesLoading}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                >
                  {companiesLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {companiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading companies...</span>
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8">
                <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No companies found</p>
                <button
                  onClick={() => {
                    console.log("Create First Company button clicked!");
                    setShowCreateCompanyModal(true);
                  }}
                  className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Company
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{company.name}</h3>
                          {company.description && (
                            <p className="text-sm text-gray-600 mt-1">{company.description}</p>
                          )}
                          {company.company_username && (
                            <p className="text-xs text-gray-500 flex items-center mt-1">
                              Username: {company.company_username}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            Created: {new Date(company.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        company.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {company.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Management Section - Only for Admin and Company roles */}
      {shouldShowUserSection && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Team Members
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">
                  {stats.activeUsers} active, {stats.inactiveUsers} inactive
                </span>
                <button
                  onClick={loadUsers}
                  disabled={usersLoading}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                >
                  {usersLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading users...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-3 text-sm font-medium text-gray-600">User</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">Role</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">Status</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">Joined</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(u => user?.role === 'super_admin' || u.company?.id === user?.company_id)
                      .slice(0, 10)
                      .map((dashboardUser) => (
                        <tr key={dashboardUser.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-600">
                                  {dashboardUser.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{dashboardUser.username}</p>
                                <div className="flex items-center space-x-1 mt-1">
                                  <Mail className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">{dashboardUser.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                              {dashboardUser.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              dashboardUser.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {dashboardUser.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="text-sm text-gray-500">
                              {new Date(dashboardUser.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center space-x-2">
                              <button
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                title="Edit User"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              {dashboardUser.is_active ? (
                                <button
                                  onClick={() => handleUserAction('deactivate', dashboardUser.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Deactivate User"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUserAction('activate', dashboardUser.id)}
                                  className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                  title="Activate User"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {users.filter(u => user?.role === 'super_admin' || u.company?.id === user?.company_id).length > 10 && (
                  <div className="mt-4 text-center">
                    <button className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                      View all users →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Company Modal */}
      <Modal
        isOpen={showCreateCompanyModal}
        title="Create New Company"
        onClose={() => setShowCreateCompanyModal(false)}
      >
        <CompanyCreationForm
          onSuccess={handleCreateCompanySuccess}
          onCancel={() => setShowCreateCompanyModal(false)}
        />
      </Modal>
    </div>
  );
};