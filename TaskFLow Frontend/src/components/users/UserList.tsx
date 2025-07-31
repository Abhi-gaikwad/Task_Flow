// UserList.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Search, UserPlus, Shield, User, Edit, Trash2, UserCheck, UserX, RefreshCw, Building, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { transformBackendUser } from '../../utils/transform';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { UserForm } from './UserForm';
import { CompanyAdminForm } from '../admin/CompanyAdminForm';
import { User as UserType } from '../../types';
import { usersAPI } from '../../services/api';

export const UserList: React.FC = () => {
  const { user: loggedInUser } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isSuperAdmin = loggedInUser?.role === 'super_admin';
  const isAdmin = loggedInUser?.role === 'admin';
  const isAdminOrSuperAdmin = isAdmin || isSuperAdmin;

  const fetchAndSetUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For super admin, we want to get company admins
      // For regular admin, we want to get users in their company
      const usersData = await usersAPI.listUsers({
        limit: 100,
        is_active: undefined,
        // The backend will filter appropriately based on the logged-in user's role
      });
      
      setAllUsers(usersData.map(transformBackendUser));
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminOrSuperAdmin) {
      fetchAndSetUsers();
    } else {
      setLoading(false);
    }
  }, [loggedInUser]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return allUsers;
    return allUsers.filter(u => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const nameMatch = u.name.toLowerCase().includes(lowerSearchTerm);
      const emailMatch = u.email.toLowerCase().includes(lowerSearchTerm);
      const companyMatch = isSuperAdmin && u.company?.name.toLowerCase().includes(lowerSearchTerm);
      return nameMatch || emailMatch || !!companyMatch;
    });
  }, [allUsers, searchTerm, isSuperAdmin]);

  const refreshUsers = async () => {
    setRefreshing(true);
    await fetchAndSetUsers();
    setRefreshing(false);
  };

  const handleSuccess = async () => {
    await refreshUsers();
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedUser(null);
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    try {
      await usersAPI.deleteUser(userId);
      await refreshUsers();
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      setError('Failed to deactivate user: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleActivateUser = async (userId: number) => {
    try {
      await usersAPI.activateUser(userId);
      await refreshUsers();
    } catch (err: any) {
      console.error('Failed to activate user:', err);
      setError('Failed to activate user: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEditUser = (user: UserType) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  if (!isAdminOrSuperAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <Shield className="w-6 h-6 text-red-600 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-red-800">Error Loading Users</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <button 
              onClick={refreshUsers}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isSuperAdmin ? "Company Administrators" : "Team Members"}
          </h1>
          <p className="text-gray-600">
            {isSuperAdmin 
              ? "Manage company administrators and create new companies." 
              : "Manage team members and permissions."
            }
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            variant="secondary" 
            icon={RefreshCw} 
            onClick={refreshUsers} 
            disabled={refreshing} 
            className={refreshing ? 'animate-spin' : ''}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button icon={UserPlus} onClick={() => setIsCreateModalOpen(true)}>
            {isSuperAdmin ? "New Company & Admin" : "Add User"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total {isSuperAdmin ? 'Admins' : 'Users'}
              </p>
              <p className="text-2xl font-bold text-gray-900">{allUsers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">
                {allUsers.filter(user => user.isActive).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="bg-red-500 p-3 rounded-lg">
              <UserX className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Inactive</p>
              <p className="text-2xl font-bold text-gray-900">
                {allUsers.filter(user => !user.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={isSuperAdmin ? "Search by admin name, email, or company..." : "Search users..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-sm">
                <th className="text-left py-3 px-6 font-semibold text-gray-600">
                  {isSuperAdmin ? 'Administrator' : 'User'}
                </th>
                {isSuperAdmin && (
                  <th className="text-left py-3 px-6 font-semibold text-gray-600">Company</th>
                )}
                <th className="text-left py-3 px-6 font-semibold text-gray-600">Role</th>
                <th className="text-left py-3 px-6 font-semibold text-gray-600">Status</th>
                <th className="text-left py-3 px-6 font-semibold text-gray-600">Joined</th>
                <th className="text-left py-3 px-6 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={u.avatar || `https://i.pravatar.cc/40?u=${u.email}`} 
                        alt={u.name} 
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{u.name}</p>
                        <div className="flex items-center space-x-1 mt-1">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span className="text-sm text-gray-500">{u.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {isSuperAdmin && (
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{u.company?.name || 'N/A'}</span>
                      </div>
                    </td>
                  )}
                  
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      u.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      <Shield className="w-3 h-3 mr-1" />
                      {u.role === 'super_admin' ? 'Super Admin' : 
                       u.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {u.isActive ? (
                        <>
                          <UserCheck className="w-3 h-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX className="w-3 h-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </span>
                  </td>
                  
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </td>
                  
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleEditUser(u)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      
                      {u.isActive ? (
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deactivate User"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleActivateUser(u.id)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Activate User"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredUsers.length === 0 && !loading && (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {isSuperAdmin ? 'administrators' : 'users'} found
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? 'Try adjusting your search criteria'
                : `Get started by adding your first ${isSuperAdmin ? 'company and admin' : 'user'}`
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsCreateModalOpen(true)}>
                {isSuperAdmin ? "Create First Company & Admin" : "Add First User"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title={isSuperAdmin ? "Create New Company and Admin" : "Add New User"} 
        maxWidth="lg"
      >
        {isSuperAdmin ? (
          <CompanyAdminForm 
            onSuccess={handleSuccess} 
            onClose={() => setIsCreateModalOpen(false)} 
          />
        ) : (
          <UserForm 
            onSuccess={handleSuccess} 
            onClose={() => setIsCreateModalOpen(false)} 
          />
        )}
      </Modal>
      
      {/* Edit Modal */}
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
            mode="edit"
            onSuccess={handleSuccess} 
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