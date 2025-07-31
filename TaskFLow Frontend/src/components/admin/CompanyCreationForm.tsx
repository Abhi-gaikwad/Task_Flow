// CompanyCreationForm.tsx
import React, { useState } from 'react';
import { companyAPI } from '../../services/api'; // Adjust this path based on your project structure, e.g., '../api'

interface CompanyCreationFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    onClose?: () => void;
}

interface FormData {
    company_name: string;
    company_username: string; // Changed from admin_username
    company_password: string; // Changed from admin_password
    company_description?: string; // Added for description
}

interface FormErrors {
    company_name?: string;
    company_username?: string;
    company_password?: string;
    company_description?: string;
}

const CompanyCreationForm: React.FC<CompanyCreationFormProps> = ({ 
    onSuccess, 
    onCancel, 
    onClose 
}) => {
    const [formData, setFormData] = useState<FormData>({
        company_name: '',
        company_username: '',
        company_password: '',
        company_description: '',
    });
    const [errors, setErrors] = useState<FormErrors>({}); // Client-side validation errors
    const [loading, setLoading] = useState(false); // For showing loading state
    const [apiError, setApiError] = useState<string | null>(null); // For general API errors from backend

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear specific error for the field as user types
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name as keyof FormErrors];
            return newErrors;
        });
        setApiError(null); // Clear general API error on any input change
    };

    const validateForm = (): boolean => {
        let newErrors: FormErrors = {};

        if (!formData.company_name.trim()) {
            newErrors.company_name = 'Company name is required.';
        }
        if (!formData.company_username.trim()) {
            newErrors.company_username = 'Company username is required.';
        }
        if (!formData.company_password.trim()) {
            newErrors.company_password = 'Company password is required.';
        } else if (formData.company_password.length < 6) {
            newErrors.company_password = 'Password must be at least 6 characters.';
        }

        setErrors(newErrors); // Update the state with new errors
        return Object.keys(newErrors).length === 0; // Returns true if no errors
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); // Prevent default form submission behavior
        setApiError(null); // Clear any previous API errors before a new attempt

        if (!validateForm()) {
            console.warn("Client-side validation failed. Please check the form errors.");
            return; // Stop submission if validation fails
        }

        setLoading(true); // Set loading state
        try {
            console.log("Attempting to create company with data:", formData);
            // Call companyAPI.createCompany instead of createCompanyWithAdmin
            await companyAPI.createCompany({
                name: formData.company_name,
                description: formData.company_description,
                company_username: formData.company_username,
                company_password: formData.company_password,
            });
            console.log("Company created successfully!");
            onSuccess(); // Call the success callback provided by the parent
        } catch (error: any) {
            console.error("API call failed during company creation:", error.response?.data || error.message);
            // Extract a more user-friendly error message
            const errorMessage = error.response?.data?.detail || 'Failed to create company. Please try again.';
            setApiError(errorMessage); // Set the API error state
        } finally {
            setLoading(false); // Reset loading state
        }
    };

    // Handle cancel/close
    const handleCancel = () => {
        if (onCancel) onCancel();
        if (onClose) onClose();
    };

    // Determine if the submit button should be enabled
    const canSubmit = !loading &&
        formData.company_name.trim() !== '' &&
        formData.company_username.trim() !== '' &&
        formData.company_password.trim() !== '' &&
        Object.keys(errors).length === 0; // Also ensure no current client-side validation errors

    return (
        <form onSubmit={handleSubmit} className="p-4 space-y-4 bg-white rounded-lg shadow-sm">
            <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">Company Name:</label>
                <input
                    type="text"
                    id="company_name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Acme Corp"
                    aria-invalid={!!errors.company_name}
                    aria-describedby={errors.company_name ? "company-name-error" : undefined}
                />
                {errors.company_name && <p id="company-name-error" className="text-red-500 text-xs mt-1">{errors.company_name}</p>}
            </div>

            <div>
                <label htmlFor="company_description" className="block text-sm font-medium text-gray-700">Company Description (Optional):</label>
                <input
                    type="text"
                    id="company_description"
                    name="company_description"
                    value={formData.company_description}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Leading tech solutions provider"
                />
            </div>

            <div>
                <label htmlFor="company_username" className="block text-sm font-medium text-gray-700">Company Login Username:</label>
                <input
                    type="text"
                    id="company_username"
                    name="company_username"
                    value={formData.company_username}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., acmecorp_login"
                    aria-invalid={!!errors.company_username}
                    aria-describedby={errors.company_username ? "company-username-error" : undefined}
                />
                {errors.company_username && <p id="company-username-error" className="text-red-500 text-xs mt-1">{errors.company_username}</p>}
            </div>
            
            <div>
                <label htmlFor="company_password" className="block text-sm font-medium text-gray-700">Company Login Password:</label>
                <input
                    type="password"
                    id="company_password"
                    name="company_password"
                    value={formData.company_password}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Minimum 6 characters"
                    aria-invalid={!!errors.company_password}
                    aria-describedby={errors.company_password ? "company-password-error" : undefined}
                />
                {errors.company_password && <p id="company-password-error" className="text-red-500 text-xs mt-1">{errors.company_password}</p>}
            </div>

            {/* Display general API errors */}
            {apiError && (
                <div className="text-red-600 text-sm p-3 bg-red-50 border border-red-400 rounded-md" role="alert">
                    {apiError}
                </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={loading} // Disable cancel button when loading
                    className="px-5 py-2 bg-gray-300 text-gray-800 font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!canSubmit || loading} // Disable submit if not canSubmit or if loading
                    className="px-5 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Creating...' : 'Create Company'}
                </button>
            </div>
        </form>
    );
};

export default CompanyCreationForm;