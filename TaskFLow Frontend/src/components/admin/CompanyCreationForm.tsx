// src/components/admin/CompanyCreationForm.tsx
import React, { useState } from 'react';
import { companyAPI, handleApiError } from '../../services/api'; // Import handleApiError
import { Building, User, Lock, Mail, UserCheck } from 'lucide-react';

interface CompanyCreationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface CompanyFormData {
  name: string;
  description: string;
  company_username: string;
  company_password: string;
}

// AdminFormData and step 'admin' are no longer needed
// interface AdminFormData {
//   email: string;
//   username: string;
//   password: string;
//   full_name: string;
// }

const CompanyCreationForm: React.FC<CompanyCreationFormProps> = ({ onSuccess, onCancel }) => {
  // Removed step state, now always 'company' implicitly
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // createdCompanyId and adminData state no longer needed for this simplified flow
  // const [createdCompanyId, setCreatedCompanyId] = useState<number | null>(null);

  const [companyData, setCompanyData] = useState<CompanyFormData>({
    name: '',
    description: '',
    company_username: '',
    company_password: '',
  });

  // Removed adminData state
  // const [adminData, setAdminData] = useState<AdminFormData>({
  //   email: '',
  //   username: '',
  //   password: '',
  //   full_name: '',
  // });

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompanyData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  // Removed handleAdminChange
  // const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const { name, value } = e.target;
  //   setAdminData(prev => ({ ...prev, [name]: value }));
  //   setError(null);
  // };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await companyAPI.createCompany(companyData);
      // No need to setCreatedCompanyId or setStep to 'admin'
      onSuccess(); // Directly call onSuccess after company creation
    } catch (err: any) {
      console.error('Company creation failed:', err);
      setError(handleApiError(err)); // Use handleApiError for better messages
    } finally {
      setLoading(false);
    }
  };

  // Removed handleAdminSubmit and handleSkipAdmin
  // const handleAdminSubmit = async (e: React.FormEvent) => { /* ... */ };
  // const handleSkipAdmin = () => { /* ... */ };

  // Only render the company creation form
  return (
    <form onSubmit={handleCompanySubmit} className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Create New Company</h3>
        <p className="text-sm text-gray-600 mt-1">Provide Company Information</p> {/* Simplified text */}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Company Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={companyData.name}
            onChange={handleCompanyChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter company name"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={companyData.description}
            onChange={handleCompanyChange}
            rows={3}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Brief description of the company"
          />
        </div>

        <div>
          <label htmlFor="company_username" className="block text-sm font-medium text-gray-700">
            Company Login Username *
          </label>
          <input
            type="text"
            id="company_username"
            name="company_username"
            value={companyData.company_username}
            onChange={handleCompanyChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Unique username for company login"
            required
          />
          <p className="text-xs text-gray-500 mt-1">This will be used to log in as the company's administrator</p> {/* Simplified text */}
        </div>

        <div>
          <label htmlFor="company_password" className="block text-sm font-medium text-gray-700">
            Company Login Password *
          </label>
          <input
            type="password"
            id="company_password"
            name="company_password"
            value={companyData.company_password}
            onChange={handleCompanyChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Secure password for company login"
            required
            minLength={6}
          />
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
          disabled={loading || !companyData.name || !companyData.company_username || !companyData.company_password}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Company...' : 'Create Company'} {/* Simplified button text */}
        </button>
      </div>
    </form>
  );
};

export default CompanyCreationForm;