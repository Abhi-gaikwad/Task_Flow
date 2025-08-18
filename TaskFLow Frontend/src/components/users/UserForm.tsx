import React, { useState, useEffect } from "react";
import { Mail, User as UserIcon, Shield, KeyRound, Building, ClipboardList, Eye, EyeOff } from "lucide-react";
import { Button } from "../common/Button";
import { usersAPI, companyAPI } from "../../services/api";
import { User as UserType, Company } from "../../types";
import { useAuth } from "../../contexts/AuthContext";

interface UserFormProps {
  user?: UserType;
  onSuccess?: () => void;
  onClose: () => void;
  mode?: "create" | "edit";
}

const getRoleOptions = (currentUser: UserType | undefined) =>
  currentUser?.role === "super_admin" || currentUser?.role === "company"
    ? [
        { value: "admin", label: "Admin" },
        { value: "user", label: "User" },
      ]
    : currentUser?.role === "admin"
      ? [
          { value: "user", label: "User" },
        ]
      : [{ value: "user", label: "User" }];

export const UserForm: React.FC<UserFormProps> = ({
  user,
  onSuccess,
  onClose,
  mode = "create",
}) => {
  const { user: currentUser } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Correctly access company_id from currentUser
  const defaultCompanyId =
    currentUser?.role === "admin" || currentUser?.role === "company"
      ? String(currentUser.company_id ?? "")
      : user?.company_id?.toString() || "";

  const [formData, setFormData] = useState({
    email: user?.email || "",
    username: user?.username || "",
    password: "",
    confirmPassword: "",
    role:
      currentUser?.role === "admin" && mode === "create"
        ? "user"
        : user?.role || "user",
    companyId: defaultCompanyId,
    isActive: (user as any)?.isActive ?? true,
    canAssignTasks: user?.can_assign_tasks ?? false,
  });

  useEffect(() => {
    if (currentUser?.role === "super_admin") {
      companyAPI
        .listCompanies()
        .then(setCompanies)
        .catch(() => setCompanies([]));
    }
  }, [currentUser]);

  const handleChange = (key: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => {
      const newState = { ...prev, [key]: value };

      // Auto-manage can_assign_tasks based on role
      if (key === "role") {
        if (value === "admin") {
          // Admins inherently have task assignment permissions
          newState.canAssignTasks = false; // Hide the field by setting to false
        } else if (value === "user" && currentUser?.role === "admin") {
          // When admin creates a user, keep current canAssignTasks value
          // (this allows admin to choose)
        }
      }
      
      return newState;
    });
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Please enter a valid email address";
      
    if (!formData.username.trim())
      newErrors.username = "Username is required";
    else if (formData.username.length < 3)
      newErrors.username = "Username must be at least 3 characters";
      
    if (mode === "create" && !formData.password)
      newErrors.password = "Password is required";
    else if (formData.password && formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
      
    // Password confirmation validation
    if (formData.password || formData.confirmPassword) {
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
      if (mode === "create" && !formData.confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      }
    }
      
    if (currentUser?.role === "super_admin" && !formData.companyId)
      newErrors.companyId = "Company is required";
      
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const userData: any = {
        email: formData.email,
        username: formData.username,
        ...(formData.password && { password: formData.password }),
        is_active: formData.isActive,
      };

      const user = JSON.parse(localStorage.getItem('auth'));
      

      if (currentUser?.role === "super_admin") {
        if (!formData.companyId) throw new Error("Company required");
        userData.company_id = Number(formData.companyId);
        userData.role = formData.role;
        userData.can_assign_tasks = formData.canAssignTasks;
      } else if (currentUser?.role === "company") {
        console.log(user);
        const companyId = user.company.id;
        if (!companyId)
          throw new Error("Company user must have a company_id");
        userData.company_id = Number(companyId);
        userData.role = formData.role;
        userData.can_assign_tasks = formData.canAssignTasks;
      } else if (currentUser?.role === "admin") {
        const companyId = user.company.id;
        if (!companyId)
          throw new Error("Admin user must have a company_id");
        userData.company_id = Number(companyId);
        userData.role = formData.role;
        
        if (formData.role === "user") {
          userData.can_assign_tasks = formData.canAssignTasks;
        } else {
          userData.can_assign_tasks = false;
        }
      } else {
        delete userData.can_assign_tasks;
      }

      if (mode === "create") {
        await usersAPI.createUser(userData);
      } else if (user) {
        await usersAPI.updateUser(user.id, userData);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      setErrors({
        general:
          error?.response?.data?.detail || error?.message || "Failed to save user",
      });
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = getRoleOptions(currentUser);
  const showCompanySelect = currentUser?.role === "super_admin" && companies.length > 0;
  
  const showCanAssignTasks = 
    (currentUser?.role === "super_admin" || 
    currentUser?.role === "company" ||
    (currentUser?.role === "admin" && formData.role === "user")) &&
    formData.role === "user"; // Only show for USER role

  const isCanAssignTasksEditable = 
    ((currentUser?.role === "super_admin" || currentUser?.role === "company") ||
    (currentUser?.role === "admin" && formData.role === "user")) &&
    formData.role === "user"; // Only editable for USER role

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {mode === "create" ? "Create New User" : "Edit User"}
        </h2>
        <p className="text-gray-600 mt-2">
          {mode === "create"
            ? "Add a new user to the system"
            : "Update user information"}
        </p>
        {(currentUser?.role === "admin" || currentUser?.role === "company") && (
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
            onChange={(e) => handleChange("email", e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.email ? "border-red-300 bg-red-50" : "border-gray-300"
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
            onChange={(e) => handleChange("username", e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.username ? "border-red-300 bg-red-50" : "border-gray-300"
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
            Password {mode === "create" ? "*" : "(leave blank to keep current)"}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              className={`w-full px-4 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.password ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder={mode === "create" ? "Enter password" : "Enter new password"}
              disabled={loading}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-600 text-sm mt-1">{errors.password}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <KeyRound className="w-4 h-4 inline mr-2" />
            Confirm Password {mode === "create" ? "*" : "(required if changing password)"}
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              className={`w-full px-4 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.confirmPassword ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder="Confirm password"
              disabled={loading}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
          )}
        </div>
        
        {/* Role Select - Admins, Company and Super Admins can pick */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Shield className="w-4 h-4 inline mr-2" />
            Role
          </label>
          <select
            value={formData.role}
            onChange={(e) => handleChange("role", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Company - Only show for super admins */}
        {showCompanySelect && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building className="w-4 h-4 inline mr-2" />
              Company *
            </label>
            <select
              value={formData.companyId}
              onChange={(e) => handleChange("companyId", e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.companyId ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              disabled={loading}
            >
              <option value="">Select a company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            {errors.companyId && (
              <p className="text-red-600 text-sm mt-1">{errors.companyId}</p>
            )}
          </div>
        )}
        
        {/* Active Status */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => handleChange("isActive", e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={loading}
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
            User is active
          </label>
        </div>
        
        {/* Can Assign Tasks Checkbox - Now visible for Admin and Company when creating/editing USER role */}
        {showCanAssignTasks && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="canAssignTasks"
              checked={formData.canAssignTasks}
              onChange={(e) => handleChange("canAssignTasks", e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={loading || !isCanAssignTasksEditable}
            />
            <label htmlFor="canAssignTasks" className="ml-2 block text-sm text-gray-700">
              <ClipboardList className="w-4 h-4 inline mr-2" />
              Can assign tasks
            </label>
          </div>
        )}
        
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
            ) : mode === "create" ? "Create User" : "Update User"}
          </Button>
        </div>
      </form>
    </div>
  );
};