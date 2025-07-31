// src/components/users/UserForm.tsx
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { usersAPI, companyAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../common/Button';
import { Mail, User as UserIcon, KeyRound, Building, Shield } from 'lucide-react';

interface UserFormProps {
  user?: User;
  onSuccess?: () => void;
  onClose: () => void;
  mode?: 'create' | 'edit';
}

interface Company {
  id: number;
  name: string;
  description?: string;
}

export const UserForm: React.FC<UserFormProps> = ({ 
  user, 
  onSuccess, 
  onClose, 
  mode = 'create' 
}) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // For admins, always use their company_id. For super_admins, allow selection.
  const defaultCompanyId = currentUser?.role === 'admin' 
    ? currentUser.company_id 
    : user?.company_id || '';

  const [formData, setFormData] = useState({
    email: user?.email || '',
    username: user?.username || '',
    password: '',
    role: user?.role || 'user',
    company_id: defaultCompanyId,
    is_active: user?.is_active ?? true,
  });

  // Load companies when component mounts (only for super admins)
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const companiesData = await companyAPI.listCompanies();
        setCompanies(companiesData);
      } catch (error) {
        console.error('Failed to load companies:', error);
      }
    };

    // Only super admins can select different companies
    if (currentUser?.role === 'super_admin') {
      loadCompanies();
    }
  }, [currentUser]);

  const handleChange = (key: keyof typeof formData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // Clear field-specific error when user starts typing
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (mode === 'create' && !formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Only super admins need to select a company
    if (currentUser?.role === 'super_admin' && !formData.company_id) {
      newErrors.company_id = 'Company is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Prepare user data
      const userData = {
        email: formData.email,
        username: formData.username,
        ...(formData.password && { password: formData.password }),
        role: formData.role as UserRole,
        is_active: formData.is_active,
      };

      // Set company_id based on user role
      if (currentUser?.role === 'super_admin') {
        // Super admin can assign to any company
        if (formData.company_id) {
          userData.company_id = Number(formData.company_id);
        }
      } else if (currentUser?.role === 'admin') {
        // Admin can only create users in their own company
        if (!currentUser.company_id) {
          throw new Error('Admin user must have a company_id');
        }
        userData.company_id = currentUser.company_id;
      }

      console.log('Sending user data:', userData); // Debug log
      console.log('Current user:', currentUser); // Debug log

      if (mode === 'create') {
        await usersAPI.createUser(userData);
      } else if (user) {
        await usersAPI.updateUser(user.id, userData);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to save user:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save user';
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const canEditRole = currentUser?.role === 'super_admin' || 
    (currentUser?.role === 'admin' && formData.role !== 'super_admin');

  const availableRoles = currentUser?.role === 'super_admin' 
    ? ['admin', 'user'] 
    : ['user'];

  const showCompanySelect = currentUser?.role === 'super_admin' && companies.length > 0;

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {mode === 'create' ? 'Create New User' : 'Edit User'}
        </h2>
        <p className="text-gray-600 mt-2">
          {mode === 'create' ? 'Add a new user to the system' : 'Update user information'}
        </p>
        {currentUser?.role === 'admin' && (
          <p className="text-sm text-blue-600 mt-1">
            User will be added to your company: {currentUser.company?.name}
          </p>
        )}
      </div>

      {errors.general && (
        <div className="mb-4 p-4 border border-red-300 rounded-lg bg-red-50">
          <p className="text-red-800 text-sm">{errors.general}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            Email Address *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Enter email address"
            disabled={loading}
          />
          {errors.email && (
            <p className="text-red-600 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <UserIcon className="w-4 h-4 inline mr-2" />
            Username *
          </label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => handleChange('username', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.username ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Enter username"
            disabled={loading}
          />
          {errors.username && (
            <p className="text-red-600 text-sm mt-1">{errors.username}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <KeyRound className="w-4 h-4 inline mr-2" />
            Password {mode === 'create' ? '*' : '(leave blank to keep current)'}
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder={mode === 'create' ? 'Enter password' : 'Enter new password'}
            disabled={loading}
            autoComplete="new-password"
          />
          {errors.password && (
            <p className="text-red-600 text-sm mt-1">{errors.password}</p>
          )}
        </div>

        {/* Role */}
        {canEditRole && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="w-4 h-4 inline mr-2" />
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => handleChange('role', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {availableRoles.map(role => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Company - Only show for super admins */}
        {showCompanySelect && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building className="w-4 h-4 inline mr-2" />
              Company *
            </label>
            <select
              value={formData.company_id}
              onChange={(e) => handleChange('company_id', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.company_id ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              disabled={loading}
            >
              <option value="">Select a company</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            {errors.company_id && (
              <p className="text-red-600 text-sm mt-1">{errors.company_id}</p>
            )}
          </div>
        )}

        {/* Active Status */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => handleChange('is_active', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={loading}
          />
          <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
            User is active
          </label>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3 pt-6">
          <Button 
            type="button" 
            variant="secondary" 
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="min-w-[120px]"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              mode === 'create' ? 'Create User' : 'Update User'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};