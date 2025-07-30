// src/components/users/UserForm.tsx

import React, { useState, useEffect } from "react";
import { Mail, User, Shield, KeyRound } from "lucide-react";
import { Button } from "../common/Button";
import { userAPI, companyAPI } from "../../services/api";
import { User as UserType, Company } from "../../types";
import { useAuth } from "../../contexts/AuthContext"; // Import useAuth

interface UserFormProps {
  currentUser?: UserType; // if provided, form can be prefilled for edit; for now, only create is handled
  onSuccess?: () => void; // callback for parent to update user list etc
  onClose: () => void; // callback for closing the modal/dialog
}

export const UserForm: React.FC<UserFormProps> = ({ currentUser, onSuccess, onClose }) => {
  const { user: loggedInUser } = useAuth(); // Get the logged-in user from AuthContext

  // Determine allowed roles based on logged-in user's role
  const ALLOWED_ROLES = loggedInUser?.role === 'super_admin'
    ? [{ value: "admin", label: "Admin" }] // Super admin can only create Admin
    : [
        { value: "user", label: "User" },
        { value: "admin", label: "Admin" }
      ] as const;

  // "Default" effective user - useful for required company, role during initial company_id set
  const effectiveUser = currentUser || {
    id: '1',
    name: 'Default Admin',
    email: 'admin@test.com',
    role: 'super_admin' as const, // This role is for the 'default' and not necessarily the loggedInUser
    company_id: 1,
    username: 'defaultadmin',
    isActive: true,
  };

  // Form state: match backend field names!
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    // Default role: if super_admin is logged in, default to "admin", otherwise "user"
    role: loggedInUser?.role === 'super_admin' ? "admin" : "user" as UserType["role"],
    company_id: effectiveUser.role === "admin"
      ? String(effectiveUser.company_id || "1")
      : "1",
    is_active: true,
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch companies initially (for dropdown)
  useEffect(() => {
    (async () => {
      try {
        const companiesData = await companyAPI.getCompanies();
        setCompanies(companiesData);
      } catch (err) {
        // optionally log; don't show to user
        setCompanies([]);
      }
    })();
  }, []);

  const handleChange = <T extends keyof typeof formData>(
    key: T,
    value: typeof formData[T]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Validation: require all fields
  const canSubmit =
    !!formData.username &&
    !!formData.email &&
    !!formData.password &&
    !!formData.company_id;

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Username, email, password, and company are required.");
      return;
    }

    setLoading(true);
    try {
      await userAPI.createUser({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        company_id: Number(formData.company_id),
        is_active: formData.is_active,
      });

      if (onSuccess) onSuccess();
      onClose();

    } catch (err: any) {
      let errorMessage = "Failed to create user.";
      if (err?.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const showCompanySelector = companies.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 inline mr-1" />
            Username
          </label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => handleChange("username", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter username"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="w-4 h-4 inline mr-1" />
            Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter email address"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <KeyRound className="w-4 h-4 inline mr-1" />
          Password
        </label>
        <input
          type="password"
          autoComplete="new-password"
          value={formData.password}
          onChange={(e) => handleChange("password", e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Set password"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Shield className="w-4 h-4 inline mr-1" />
          Role
        </label>
        <select
          value={formData.role}
          onChange={(e) => handleChange("role", e.target.value as UserType["role"])}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loggedInUser?.role === 'super_admin'} // Disable if super admin
        >
          {ALLOWED_ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      {/* Company Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Company *
        </label>
        {showCompanySelector ? (
          <select
            value={formData.company_id}
            onChange={(e) => handleChange("company_id", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
            Loading companies...
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.is_active}
            onChange={(e) => handleChange("is_active", e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isActive" className="text-sm text-gray-700">
            User is active
          </label>
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm p-2 border border-red-300 rounded bg-red-50">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <Button variant="secondary" onClick={onClose} type="button" disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !canSubmit}>
          {loading ? "Creating..." : "Create User"}
        </Button>
      </div>
    </form>
  );
};