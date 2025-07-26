import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Shield, User, Edit, Trash2, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { transformBackendUser } from '../../utils/transform';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { UserForm } from './UserForm';
import { User as UserType } from '../../types';
import { userAPI } from '../../services/api';

export const UserList: React.FC = () => {
  const { users } = useApp();
  const { user } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserType[]>(users);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Add refreshing state

  // Check if current user is admin or super_admin
  const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const latestUsers = await userAPI.getUsers();
        setAllUsers(latestUsers.map(transformBackendUser));
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load users.');
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Update local state when context users change
  useEffect(() => {
    if (users && users.length > 0) {
      setAllUsers(users.map(transformBackendUser));
    }
  }, [users]);

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const refreshUsers = async () => {
    try {
      setRefreshing(true); // Set refreshing state
      const latestUsers = await userAPI.getUsers();
      setAllUsers(latestUsers.map(transformBackendUser));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh user list.');
    } finally {
      setRefreshing(false); // Clear refreshing state
    }
  };

  // Manual refresh handler
  const handleManualRefresh = async () => {
    await refreshUsers();
  };

  const handleUserAdded = async () => {
    await refreshUsers();
    setIsCreateModalOpen(false);
  };

  const handleUserUpdated = async () => {
    await refreshUsers();
    setIsEditModalOpen(false);
    setSelectedUser(null);
  };

  const toggleTaskAssignPermission = async (userId: string, canAssignTasks: boolean) => {
    if (!isAdminOrSuperAdmin) {
      setError('Only administrators can modify task assignment permissions.');
      return;
    }

    try {
      const updatedUser = await userAPI.updateUser(userId, { can_assign_tasks: canAssignTasks });
      setAllUsers(prev => prev.map(u => u.id === userId ? transformBackendUser(updatedUser) : u));
    } catch (err: any) {
      setError(err.message || 'Failed to update user permissions.');
    }
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    if (!isAdminOrSuperAdmin) {
      setError('Only administrators can activate/deactivate users.');
      return;
    }

    try {
      const updatedUser = await userAPI.updateUser(userId, { is_active: isActive });
      setAllUsers(prev => prev.map(u => u.id === userId ? transformBackendUser(updatedUser) : u));
    } catch (err: any) {
      setError(err.message || 'Failed to update user status.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isAdminOrSuperAdmin) {
      setError('Only administrators can delete users.');
      return;
    }

    if (userId === user?.id) {
      setError('You cannot delete your own account.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await userAPI.deleteUser(userId);
        await refreshUsers();
      } catch (err: any) {
        setError(err.message || 'Failed to delete user.');
      }
    }
  };

  const handleEditUser = (userToEdit: UserType) => {
    if (!isAdminOrSuperAdmin) {
      setError('Only administrators can edit users.');
      return;
    }
    setSelectedUser(userToEdit);
    setIsEditModalOpen(true);
  };

  // Check if user can be modified (prevent super_admin from being modified by regular admin)
  const canModifyUser = (targetUser: UserType) => {
    if (isSuperAdmin) return true; // Super admin can modify anyone
    if (user?.role === 'admin' && targetUser.role === 'super_admin') return false; // Admin cannot modify super_admin
    return isAdminOrSuperAdmin;
  };

  if (!isAdminOrSuperAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-500">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600">Manage team members and permissions</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Refresh Button */}
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={handleManualRefresh}
            disabled={refreshing}
            className={refreshing ? 'animate-spin' : ''}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          
          {/* Add User Button */}
          <Button icon={UserPlus} onClick={() => setIsCreateModalOpen(true)}>
            Add User
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        {/* Search and Filter */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-4 px-6 font-medium text-gray-900">User</th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">Role</th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">Status</th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">Permissions</th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">Last Login</th>
                <th className="text-left py-4 px-6 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <img
                        src={u.avatar || `https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=400`}
                        alt={u.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{u.name}</p>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      {u.role === 'super_admin' ? (
                        <Shield className="w-4 h-4 text-red-600" />
                      ) : u.role === 'admin' ? (
                        <Shield className="w-4 h-4 text-purple-600" />
                      ) : (
                        <User className="w-4 h-4 text-gray-400" />
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.role === 'super_admin' 
                          ? 'bg-red-100 text-red-800' 
                          : u.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={u.canAssignTasks}
                          onChange={(e) => toggleTaskAssignPermission(u.id, e.target.checked)}
                          disabled={!canModifyUser(u)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="ml-2 text-sm text-gray-600">Can assign tasks</span>
                      </label>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-600">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-1">
                      {/* Edit User Button */}
                      <button
                        onClick={() => handleEditUser(u)}
                        disabled={!canModifyUser(u)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      {/* Toggle Active Status */}
                      <button
                        onClick={() => toggleUserActive(u.id, !u.isActive)}
                        disabled={!canModifyUser(u) || u.id === user?.id}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          u.isActive 
                            ? 'text-red-600 hover:text-red-800 hover:bg-red-50' 
                            : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                        }`}
                        title={u.isActive ? 'Deactivate User' : 'Activate User'}
                      >
                        {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>

                      {/* Delete User Button */}
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={!canModifyUser(u) || u.id === user?.id}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <User className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500 text-lg">No users found matching your criteria.</p>
            <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filter settings.</p>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New User"
        maxWidth="lg"
      >
        <UserForm
          onSuccess={handleUserAdded}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        title="Edit User"
        maxWidth="lg"
      >
        {selectedUser && (
          <UserForm
            user={selectedUser}
            onSuccess={handleUserUpdated}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedUser(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
};
