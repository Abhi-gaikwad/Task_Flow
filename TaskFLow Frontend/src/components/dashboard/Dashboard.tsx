// src/components/dashboard/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { usersAPI, companyAPI } from '../../services/api';
import CompanyCreationForm  from '../admin/CompanyCreationForm'; // This component will be modified
import { Modal } from '../common/Modal';

import {
  Users,
  Building,
  CheckSquare,
  Clock,
  AlertTriangle,
  TrendingUp,
  Bell,
  Calendar,
  UserCheck,
  UserX,
  Eye,
  Edit,
  Mail,
  Shield,
  Plus,
  CheckCircle,
  KeyRound
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalCompanies: number;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  activeUsers: number;
  inactiveUsers: number;
}

interface RecentActivity {
  id: string;
  type: 'task_created' | 'task_completed' | 'user_added' | 'company_created';
  message: string;
  timestamp: Date;
  user?: string;
}

interface DashboardUser {
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

interface Company {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  company_username?: string;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { tasks = [], notifications = [] } = useApp();

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalCompanies: 0,
    totalTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
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
    if (!user || user.role !== 'admin') {
      setUsers([]);
      return;
    }
    try {
      setUsersLoading(true);
      const usersData = await usersAPI.listUsers({
        limit: 100,
        is_active: undefined,
      });
      setUsers(usersData || []);
      const activeUsers = usersData?.filter(u => u.is_active).length || 0;
      const inactiveUsers = usersData?.filter(u => !u.is_active).length || 0;
      setStats(prevStats => ({
        ...prevStats,
        totalUsers: usersData?.length || 0,
        activeUsers,
        inactiveUsers,
      }));
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError('Failed to load users data');
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
        setStats(prevStats => ({
          ...prevStats,
          totalCompanies: companiesData.length,
        }));
      }
    } catch (err: any) {
      console.error('Failed to load companies:', err);
      setError('Failed to load companies data');
    } finally {
      setCompaniesLoading(false);
    }
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const newStats: DashboardStats = {
          totalUsers: 0,
          totalCompanies: 0,
          totalTasks: Array.isArray(tasks) ? tasks.length : 0,
          pendingTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          activeUsers: 0,
          inactiveUsers: 0,
        };

        if (Array.isArray(tasks) && tasks.length > 0) {
          newStats.pendingTasks = tasks.filter(task => task.status === 'pending' || task.status === 'in_progress').length;
          newStats.completedTasks = tasks.filter(task => task.status === 'completed').length;
          newStats.overdueTasks = tasks.filter(task => {
            if (!task.dueDate) return false;
            const dueDate = new Date(task.dueDate);
            const now = new Date();
            return dueDate < now && task.status !== 'completed';
          }).length;
        }

        if (user?.role === 'admin') {
          newStats.totalCompanies = 1;
        }

        setStats(newStats);

        // Recent Activities
        const activities: RecentActivity[] = [];
        if (Array.isArray(tasks)) {
          const recentTasks = tasks
            .filter(task => task.createdAt)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 3);

          recentTasks.forEach(task => {
            activities.push({
              id: `task-${task.id}`,
              type: 'task_created',
              message: `New task "${task.title}" was created`,
              timestamp: new Date(task.createdAt),
              user: task.assignedTo
            });
          });
        }
        if (Array.isArray(notifications)) {
          const recentNotifications = notifications
            .filter(notif => notif.createdAt)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 2);

          recentNotifications.forEach(notif => {
            activities.push({
              id: `notif-${notif.id}`,
              type: 'task_completed',
              message: notif.message,
              timestamp: new Date(notif.createdAt)
            });
          });
        }
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setRecentActivities(activities.slice(0, 5));

        if (user?.role === 'admin') {
          await loadUsers();
        }
        if (user?.role === 'super_admin') {
          await loadCompanies();
        }
      } catch (err: any) {
        console.error('Dashboard loading error:', err);
        setError('Failed to load dashboard data. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    // eslint-disable-next-line
  }, [user, tasks, notifications]);

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

  const handleCompanyClick = (company: Company) => {
    console.log("Company card clicked:", company);
    // Add modal or navigation if needed
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

  const statCards = [
    {
      title: 'Total Tasks',
      value: stats.totalTasks,
      icon: CheckSquare,
      color: 'bg-blue-500',
      show: true,
    },
    {
      title: 'Pending Tasks',
      value: stats.pendingTasks,
      icon: Clock,
      color: 'bg-yellow-500',
      show: true,
    },
    {
      title: 'Completed Tasks',
      value: stats.completedTasks,
      icon: CheckSquare,
      color: 'bg-green-500',
      show: true,
    },
    {
      title: 'Overdue Tasks',
      value: stats.overdueTasks,
      icon: AlertTriangle,
      color: 'bg-red-500',
      show: true,
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-purple-500',
      show: user?.role === 'admin',
    },
    {
      title: 'Active Users',
      value: stats.activeUsers,
      icon: UserCheck,
      color: 'bg-green-600',
      show: user?.role === 'admin',
    },
    {
      title: 'Total Companies',
      value: stats.totalCompanies,
      icon: Building,
      color: 'bg-indigo-500',
      show: user?.role === 'super_admin',
    },
  ].filter(card => card.show);

  const shouldShowUserSection = user?.role === 'admin';

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
              Here's what's happening with your workspace today.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
              {user?.role?.replace('_', ' ')}
            </span>
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
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleCompanyClick(company)}
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
                              <KeyRound className="w-3 h-3 mr-1" />
                              Login: {company.company_username}
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

      {/* User Management Section - Only for 'Admin' */}
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
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No users found in your company.
                </p>
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
                      .filter(dashboardUser =>
                        dashboardUser.company?.id === user?.company_id
                      )
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
                {users.filter(u => u.company?.id === user?.company_id).length > 10 && (
                  <div className="mt-4 text-center">
                    <button className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                      View all {users.filter(u => u.company?.id === user?.company_id).length} users →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Company Modal */}
      {/* Create Company Modal */}
      <Modal 
        isOpen={showCreateCompanyModal} // <--- ADD THIS PROP
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