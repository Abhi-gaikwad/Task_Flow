// src/components/admin/CompanyAdminForm.tsx
import React, { useState } from "react";
import { Mail, User, KeyRound, Building, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "../common/Button";
import { companyAPI } from "../../services/api";

interface CompanyAdminFormProps {
  onSuccess?: () => void;
  onClose: () => void;
}

export const CompanyAdminForm: React.FC<CompanyAdminFormProps> = ({ onSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    company_name: "",
    company_description: "",
    admin_username: "",
    admin_email: "",
    admin_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChange = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear field-specific error when user starts typing
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = "Company name is required";
    }

    if (!formData.admin_username.trim()) {
      newErrors.admin_username = "Admin username is required";
    } else if (formData.admin_username.length < 3) {
      newErrors.admin_username = "Username must be at least 3 characters";
    }

    if (!formData.admin_email.trim()) {
      newErrors.admin_email = "Admin email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
      newErrors.admin_email = "Please enter a valid email address";
    }

    if (!formData.admin_password) {
      newErrors.admin_password = "Admin password is required";
    } else if (formData.admin_password.length < 6) {
      newErrors.admin_password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      console.log('Submitting form data:', formData); // Debug log
      
      const result = await companyAPI.createCompanyWithAdmin(formData);
      console.log('Company created successfully:', result); // Debug log
      
      setSuccessMessage(`Company "${formData.company_name}" and admin user created successfully!`);
      
      // Reset form
      setFormData({
        company_name: "",
        company_description: "",
        admin_username: "",
        admin_email: "",
        admin_password: "",
      });

      // Call success callback after a short delay to show success message
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error('Error creating company and admin:', err); // Debug log
      
      let errorMessage = "Failed to create company and admin.";
      
      if (err?.response?.data?.detail) {
        // Handle specific backend validation errors
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else {
          errorMessage = JSON.stringify(err.response.data.detail);
        }
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      // Set general error
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && 
    formData.company_name.trim() && 
    formData.admin_username.trim() && 
    formData.admin_email.trim() && 
    formData.admin_password;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create New Company & Admin</h2>
        <p className="text-gray-600 mt-2">Create a new company and assign its first administrator.</p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 border border-green-300 rounded-lg bg-green-50 flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}

      {errors.general && (
        <div className="mb-6 p-4 border border-red-300 rounded-lg bg-red-50 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
          <span className="text-red-800">{errors.general}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Details Section */}
        <div className="p-6 border rounded-lg space-y-4 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Building className="w-5 h-5 mr-2 text-blue-600" />
            Company Details
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name *
            </label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => handleChange("company_name", e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.company_name ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Enter company name"
              disabled={loading}
            />
            {errors.company_name && (
              <p className="text-red-600 text-sm mt-1">{errors.company_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Description
            </label>
            <textarea
              value={formData.company_description}
              onChange={(e) => handleChange("company_description", e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Briefly describe the company's business (optional)"
              rows={3}
              disabled={loading}
            />
          </div>
        </div>

        {/* Admin Details Section */}
        <div className="p-6 border rounded-lg space-y-4 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <User className="w-5 h-5 mr-2 text-green-600" />
            Company Admin Credentials
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username *
              </label>
              <input
                type="text"
                value={formData.admin_username}
                onChange={(e) => handleChange("admin_username", e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.admin_username ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter admin's username"
                disabled={loading}
              />
              {errors.admin_username && (
                <p className="text-red-600 text-sm mt-1">{errors.admin_username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.admin_email}
                onChange={(e) => handleChange("admin_email", e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.admin_email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter admin's email"
                disabled={loading}
              />
              {errors.admin_email && (
                <p className="text-red-600 text-sm mt-1">{errors.admin_email}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={formData.admin_password}
              onChange={(e) => handleChange("admin_password", e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.admin_password ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Set a strong password for the admin"
              disabled={loading}
            />
            {errors.admin_password && (
              <p className="text-red-600 text-sm mt-1">{errors.admin_password}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6">
          <Button 
            variant="secondary" 
            onClick={onClose} 
            type="button" 
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!canSubmit}
            className="min-w-[200px]"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </span>
            ) : (
              "Create Company & Admin"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};