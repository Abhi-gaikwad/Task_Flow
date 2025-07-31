// src/components/admin/AdminList.tsx
import React, { useState, useEffect } from 'react';
import { usersAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  Building, 
  Mail, 
  Calendar,
  Shield,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '../common/Button';
// Removed: import { AdminCreationForm } from './AdminCreationForm';
import { Modal } from '../common/Modal'; // Assuming you have a Modal component

interface Admin {
  id: number;
  username: string;
  email: string;
  role: string;
  company_id: number;
  is_active: boolean;
  created_at?: string;
  company?: {
    id: number;
    name: string;
    description?: string;
  };
}

interface AdminListProps {
  showInDashboard?: boolean;
  maxItems?: number;
  // onCreateAdmin?: () => void; // This prop is removed as admin creation is not here
  onEditAdmin?: (admin: Admin) => void;
}

export const AdminList: React.FC<AdminListProps> = ({ 
  showInDashboard = false, 
  maxItems,
  onEditAdmin 
}) => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | 'all'>('all');
  // Removed: const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);

  const fetchAdmins = async () => {
    // This component is now primarily for listing users, if needed by other roles.
    // Super admin will not see this section in the dashboard.
    // If this component is intended *only* for super admin to manage admins,
    // then its usage should be removed from the app entirely.
    // For now, assuming it might be used by an 'admin' role to list 'user' roles.
    if (!user) {
      setError('Authentication required.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch users with admin role (if super_admin) or users within own company (if admin)
      let usersData: Admin[] = [];
      if (user.role === 'super_admin') {
        usersData = await usersAPI.listUsers({ 
          role: 'admin', // Only fetch actual admins if super admin
          limit: maxItems || 100 
        });
      } else if (user.role === 'admin' && user.company_id) {
        usersData = await usersAPI.listUsers({
          company_id: user.company_id,
          role: 'user', // Admin might list regular users
          limit: maxItems || 100
        });
      } else {
        setError('Access denied or no relevant users to display.');
        setLoading(false);
        return;
      }
      
      console.log('Fetched users/admins:', usersData);
      setAdmins(Array.isArray(usersData) ? usersData : []);
    } catch (err: any) {
      console.error('Failed to fetch users/admins:', err);
      setError(err.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, [user]);

  const handleDeleteAdmin = async (adminId: number) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    try {
      await usersAPI.deleteUser(adminId);
      await fetchAdmins(); // Refresh the list
    } catch (err: any) {
      console.error('Failed to deactivate user:', err);
      alert('Failed to deactivate user: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleActivateAdmin = async (adminId: number) => {
    try {
      await usersAPI.activateUser(adminId);
      await fetchAdmins(); // Refresh the list
    } catch (err: any) {
      console.error('Failed to activate user:', err);
      alert('Failed to activate user: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Removed: handleCreateAdminSuccess is no longer relevant here

  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = admin.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         admin.company?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterActive === 'all' || admin.is_active === filterActive;
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Data</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchAdmins} className="inline-flex items-center">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const AdminCard: React.FC<{ admin: Admin }> = ({ admin }) => (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {admin.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{admin.username}</h3>
            <p className="text-sm text-gray-600 flex items-center">
              <Mail className="w-3 h-3 mr-1" />
              {admin.email}
            </p>
            {admin.company && (
              <p className="text-sm text-gray-500 flex items-center mt-1">
                <Building className="w-3 h-3 mr-1" />
                {admin.company.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {admin.is_active ? (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <XCircle className="w-3 h-3 mr-1" />
              Inactive
            </span>
          )}
        </div>
      </div>
      
      {!showInDashboard && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            ID: {admin.id} | Company ID: {admin.company_id}
          </div>
          <div className="flex items-center space-x-2">
            {onEditAdmin && (
              <button
                onClick={() => onEditAdmin(admin)}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                title="Edit User"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {admin.is_active ? (
              <button
                onClick={() => handleDeleteAdmin(admin.id)}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Deactivate User"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => handleActivateAdmin(admin.id)}
                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                title="Activate User"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (showInDashboard) {
    // Dashboard view - compact version
    // This section is now only relevant if an 'admin' user needs to see a compact list of 'users'.
    // Super admin dashboard no longer uses this component.
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Team Members ({filteredAdmins.length})
            </h2>
            {/* Removed: Add Admin button */}
          </div>
        </div>
        <div className="p-6">
          {filteredAdmins.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No team members found</p>
              {/* Removed: Create First Admin button */}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAdmins.slice(0, maxItems || 5).map((admin) => (
                <AdminCard key={admin.id} admin={admin} />
              ))}
              {filteredAdmins.length > (maxItems || 5) && (
                <div className="text-center pt-4">
                  <p className="text-sm text-gray-500">
                    Showing {maxItems || 5} of {filteredAdmins.length} members
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full page view (if this component is used as a standalone page for user management)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="text-gray-600 mt-1">Manage your company's team members</p>
        </div>
        {/* Removed: Add New Admin button */}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value === 'all' ? 'all' : e.target.value === 'true')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
          <Button onClick={fetchAdmins} variant="secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Members</p>
              <p className="text-2xl font-bold text-gray-900">{admins.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Members</p>
              <p className="text-2xl font-bold text-gray-900">
                {admins.filter(admin => admin.is_active).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="bg-red-500 p-3 rounded-lg">
              <XCircle className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Inactive Members</p>
              <p className="text-2xl font-bold text-gray-900">
                {admins.filter(admin => !admin.is_active).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          {filteredAdmins.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No members found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || filterActive !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Get started by adding your first team member'
                }
              </p>
              {/* Removed: Add First Admin button */}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAdmins.map((admin) => (
                <AdminCard key={admin.id} admin={admin} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Removed: Admin creation modal */}
    </div>
  );
};
