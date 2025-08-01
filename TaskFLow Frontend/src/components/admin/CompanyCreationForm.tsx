// src/components/admin/CompanyCreationForm.tsx
import React, { useState } from 'react';
import { companyAPI, handleApiError } from '../../services/api';
import { Building, Eye, EyeOff, Lock, Mail } from 'lucide-react';

interface CompanyCreationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface CompanyFormData {
  name: string;
  description: string;
  company_email: string;
  company_password: string;
  company_password_confirmation: string;
}

const CompanyCreationForm: React.FC<CompanyCreationFormProps> = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [companyData, setCompanyData] = useState<CompanyFormData>({
    name: '',
    description: '',
    company_email: '',
    company_password: '',
    company_password_confirmation: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompanyData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (companyData.company_password !== companyData.company_password_confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // The API endpoint now expects company_email instead of company_username
      await companyAPI.createCompany({
        name: companyData.name,
        description: companyData.description,
        company_email: companyData.company_email,
        company_password: companyData.company_password,
        company_password_confirmation: companyData.company_password_confirmation,
      });
      onSuccess();
    } catch (err: any) {
      console.error('Company creation failed:', err);
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCompanySubmit} className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Create New Company</h3>
        <p className="text-sm text-gray-600 mt-1">Provide Company and Admin Email Information</p>
      </div>

      <div className="space-y-4">
        {/* Company Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Company Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={companyData.name}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter company name"
            required
          />
        </div>

        {/* Company Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={companyData.description}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Brief description of the company"
          />
        </div>
        
        {/* Company Admin Email */}
        <div className="mt-4">
          <div className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-gray-400" />
            <label htmlFor="company_email" className="block text-sm font-medium text-gray-700">
              Admin Email *
            </label>
          </div>
          <input
            type="email"
            id="company_email"
            name="company_email"
            value={companyData.company_email}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Admin's email address"
            required
          />
          <p className="text-xs text-gray-500 mt-1">This email will be the login for the company's administrator</p>
        </div>

        {/* Password */}
        <div className="mt-4">
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-gray-400" />
            <label htmlFor="company_password" className="block text-sm font-medium text-gray-700">
              Password *
            </label>
          </div>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              id="company_password"
              name="company_password"
              value={companyData.company_password}
              onChange={handleChange}
              className="block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
              placeholder="Secure password"
              required
              minLength={6}
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </span>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="mt-4">
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-gray-400" />
            <label htmlFor="company_password_confirmation" className="block text-sm font-medium text-gray-700">
              Confirm Password *
            </label>
          </div>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              id="company_password_confirmation"
              name="company_password_confirmation"
              value={companyData.company_password_confirmation}
              onChange={handleChange}
              className="block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
              placeholder="Confirm your password"
              required
              minLength={6}
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            loading || 
            !companyData.name || 
            !companyData.company_email || 
            !companyData.company_password ||
            !companyData.company_password_confirmation
          }
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Company...' : 'Create Company'}
        </button>
      </div>
    </form>
  );
};

export default CompanyCreationForm;