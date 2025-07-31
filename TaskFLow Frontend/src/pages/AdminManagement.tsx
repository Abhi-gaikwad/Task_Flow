// src/pages/AdminManagement.tsx
import React, { useState } from 'react';
import { AdminList } from '../components/admin/AdminList';
import { CompanyAdminForm } from '../components/admin/CompanyAdminForm';
import { UserForm } from '../components/users/UserForm';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface Admin {
  id: number;
  username: string;
  email: string;
  role: string;
  company_id: number;
  is_active: boolean;
  company?: {
    id: number;
    name: string;
    description?: string;
  };
}

export const AdminManagement: React.FC = () => {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateCompanyForm, setShowCreateCompanyForm] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Only Super Admins can access this page
  if (user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    setShowCreateCompanyForm(false);
    setSelectedAdmin(null);
    setRefreshTrigger(prev => prev + 1); // Trigger refresh of admin list
  };

  const handleEditAdmin = (admin: Admin) => {
    setSelectedAdmin(admin);
    setShowCreateForm(true);
  };

  const handleCreateAdmin = () => {
    setSelectedAdmin(null);
    setShowCreateForm(true);
  };

  const handleCreateCompanyWithAdmin = () => {
    setShowCreateCompanyForm(true);
  };

  const closeAllForms = () => {
    setShowCreateForm(false);
    setShowCreateCompanyForm(false);
    setSelectedAdmin(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Management</h1>
            <p className="text-gray-600 mt-2">
              Manage company administrators and create new companies with their admins
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCreateAdmin}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Existing Company Admin
            </button>
            <button
              onClick={handleCreateCompanyWithAdmin}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Create Company + Admin
            </button>
          </div>
        </div>
      </div>

      {/* Forms */}
      {showCreateCompanyForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Create New Company with Admin
          </h2>
          <CompanyAdminForm
            onSuccess={handleCreateSuccess}
            onClose={closeAllForms}
          />
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {selectedAdmin ? 'Edit Admin' : 'Add Admin to Existing Company'}
          </h2>
          <UserForm
            user={selectedAdmin}
            mode={selectedAdmin ? 'edit' : 'create'}
            onSuccess={handleCreateSuccess}