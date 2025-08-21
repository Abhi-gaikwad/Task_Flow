import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types';
import { authAPI } from '../services/api';
import { transformBackendUser } from '../utils/transform';
import { handleApiError } from '../services/api';

// This UserResponse interface is taken from the first snippet and is a good representation of what the backend returns.
interface UserResponse {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  role: 'super_admin' | 'admin' | 'user' | 'company';
  created_at: string;
  full_name?: string;
  phone_number?: string;
  department?: string;
  company_id?: number;
  company?: {
    id: number;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    company_username?: string;
  };
  can_assign_tasks?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
}

// Enhanced context types with new smart login method
interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  companyLogin: (companyUsername: string, companyPassword: string) => Promise<{ success: boolean; error?: string }>;
  smartLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  canAccessRoute: (route: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
  canAssignTasks: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Role-based permissions and route access from the first snippet
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['manage_companies', 'manage_all_users', 'view_dashboard', 'view_assignable_users'],
  admin: ['manage_company_users', 'manage_company_tasks', 'view_dashboard', 'view_assignable_users'],
  company: ['manage_company_users', 'manage_company_tasks', 'view_dashboard', 'view_assignable_users'],
  user: ['view_own_tasks', 'update_own_tasks', 'view_dashboard'],
};

const ROUTE_ACCESS: Record<string, string[]> = {
  '/dashboard': ['super_admin', 'admin', 'user', 'company'],
  '/users': ['super_admin', 'admin', 'company'],
  '/companies': ['super_admin'],
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    token: localStorage.getItem('access_token'),
  });

  const refreshUser = useCallback(async () => {
    try {
      const currentUserFromAPI: UserResponse = await authAPI.getCurrentUser();
      const updatedUser = transformBackendUser(currentUserFromAPI);
      
      localStorage.setItem('auth', JSON.stringify(updatedUser));
      setAuthState(prev => ({ 
        ...prev, 
        user: updatedUser, 
        isAuthenticated: true, 
        isLoading: false, 
        token: localStorage.getItem('access_token')
      }));
    } catch (error) {
      console.error('Failed to refresh user, logging out.', error);
      localStorage.removeItem('auth');
      localStorage.removeItem('access_token');
      setAuthState({ user: null, isAuthenticated: false, isLoading: false, token: null });
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      const savedAuth = localStorage.getItem('auth');
      
      if (token) {
        if (savedAuth) {
          try {
            const authData = JSON.parse(savedAuth);
            setAuthState(prev => ({ 
              ...prev, 
              user: authData.user || null, 
              isAuthenticated: true, 
              token 
            }));
            // Immediately attempt to refresh the user to validate the token
            await refreshUser(); 
          } catch (error) {
            console.error('[AuthContext] Error parsing saved auth data:', error);
            localStorage.removeItem('auth');
            localStorage.removeItem('access_token');
            setAuthState({ user: null, isAuthenticated: false, isLoading: false, token: null });
          }
        } else {
          // Token exists but no auth data, refresh from backend
          await refreshUser();
        }
      } else {
        setAuthState({ user: null, isAuthenticated: false, isLoading: false, token: null });
      }
    };
    initializeAuth();
  }, [refreshUser]);

  const commonLoginLogic = useCallback((accessToken: string, userData: UserResponse) => {
    const user = transformBackendUser(userData);
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('auth', JSON.stringify({ ...userData, user })); // Store full user data
    setAuthState({ user, isAuthenticated: true, isLoading: false, token: accessToken });
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await authAPI.login(email, password);
      commonLoginLogic(response.access_token, response.user);
      await refreshUser(); // Ensure latest user data and permissions
      return { success: true };
    } catch (error: any) {
      const errorMessage = handleApiError(error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: errorMessage };
    }
  };

  const companyLogin = async (
    companyUsername: string,
    companyPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await authAPI.companyLogin(companyUsername, companyPassword);
      if (!response.access_token || !response.user) {
        throw new Error('Invalid response from server - missing token or user data');
      }
      commonLoginLogic(response.access_token, response.user);
      await refreshUser(); // Ensure latest user data and permissions
      return { success: true };
    } catch (error: any) {
      const errorMessage = handleApiError(error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: errorMessage };
    }
  };

  // NEW: Smart login that automatically tries both user and company authentication
  const smartLogin = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    console.log('[AUTH] Smart login attempt for:', username);
    
    // First try unified login (handles users including SuperAdmin)
    try {
      console.log('[AUTH] Trying unified user login...');
      const response = await authAPI.login(username, password);
      console.log('[AUTH] Unified login successful, user role:', response.user?.role);
      
      commonLoginLogic(response.access_token, response.user);
      await refreshUser();
      return { success: true };
    } catch (userError: any) {
      console.log('[AUTH] Unified login failed, trying company login...', handleApiError(userError));
      
      // If unified login fails, try company-specific login
      try {
        const response = await authAPI.companyLogin(username, password);
        if (!response.access_token || !response.user) {
          throw new Error('Invalid response from server - missing token or user data');
        }
        console.log('[AUTH] Company login successful');
        
        commonLoginLogic(response.access_token, response.user);
        await refreshUser();
        return { success: true };
      } catch (companyError: any) {
        console.log('[AUTH] Both login attempts failed');
        
        // Return the most relevant error message
        const userErrorMessage = handleApiError(userError);
        const companyErrorMessage = handleApiError(companyError);
        
        // If user error suggests wrong credentials, use that. Otherwise, use a generic message.
        const finalError = userErrorMessage.toLowerCase().includes('incorrect') || 
                          userErrorMessage.toLowerCase().includes('password') ||
                          userErrorMessage.toLowerCase().includes('username') ||
                          userErrorMessage.toLowerCase().includes('email')
                          ? userErrorMessage 
                          : 'Invalid username/email or password';
        
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: finalError };
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('access_token');
    setAuthState({ user: null, isAuthenticated: false, isLoading: false, token: null });
    window.location.href = '/login';
  };

  const updateUser = useCallback((user: User) => {
    localStorage.setItem('auth', JSON.stringify(user));
    setAuthState(prev => ({ ...prev, user }));
  }, []);

  // hasPermission logic is combined from both snippets, prioritizing the more detailed switch-case approach
  const hasPermission = useCallback((permission: string): boolean => {
    if (!authState.user) return false;
    
    const { user } = authState;

    switch (permission) {
      case 'view_assignable_users':
      case 'assign_tasks':
        // Super Admin, Company, and Admin can assign tasks.
        // Regular users can if they have the can_assign_tasks flag.
        if (['super_admin', 'company', 'admin'].includes(user.role)) return true;
        if (user.role === 'user' && user.can_assign_tasks) return true;
        return false;

      case 'manage_users':
        // Super Admin, Company, and Admin can manage users.
        return ['super_admin', 'company', 'admin'].includes(user.role);

      case 'manage_companies':
        return user.role === 'super_admin';

      case 'view_all_tasks':
        // Super Admin, Company, and Admin can view tasks within their scope
        return ['super_admin', 'company', 'admin'].includes(user.role);

      case 'manage_tasks':
        // Super Admin, Company, and Admin can manage tasks in their company.
        // Regular users can manage their own tasks.
        return ['super_admin', 'company', 'admin', 'user'].includes(user.role);

      case 'update_task_status':
        // All authenticated users can update the status of their assigned tasks.
        return true;

      case 'create_admin_users':
        // Super Admin and Company can create admin users.
        return ['super_admin', 'company'].includes(user.role);

      case 'view_company_data':
        // Super Admin, Company, and Admin can view company data.
        return ['super_admin', 'company', 'admin'].includes(user.role);

      default:
        // Use the ROLE_PERMISSIONS map as a fallback for other permissions
        const userPermissions = ROLE_PERMISSIONS[user.role] || [];
        return userPermissions.includes(permission);
    }
  }, [authState.user]);

  const canAccessRoute = useCallback((route: string): boolean => {
    if (!authState.user) return false;
    const allowedRoles = ROUTE_ACCESS[route];
    if (!allowedRoles) return true;
    return allowedRoles.includes(authState.user.role);
  }, [authState.user]);

  const hasRole = useCallback((role: string | string[]): boolean => {
    if (!authState.user) return false;
    const userRole = authState.user.role;
    if (Array.isArray(role)) {
      return role.includes(userRole);
    }
    return userRole === role;
  }, [authState.user]);

  const canAssignTasks = useCallback((): boolean => {
    return hasPermission('assign_tasks');
  }, [hasPermission]);

  const contextValue: AuthContextType = {
    ...authState,
    login,
    companyLogin,
    smartLogin, // NEW: Added smart login method
    logout,
    updateUser,
    refreshUser,
    hasPermission,
    canAccessRoute,
    hasRole,
    canAssignTasks,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const usePermissions = () => {
  const { user, hasPermission } = useAuth();
  return {
    canManageUsers: hasPermission('manage_users'),
    canManageCompanies: hasPermission('manage_companies'),
    canViewAssignableUsers: hasPermission('view_assignable_users'),
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
  };
};

export const useRouteAccess = () => {
  const { canAccessRoute } = useAuth();
  return {
    canAccessDashboard: canAccessRoute('/dashboard'),
    canAccessUsers: canAccessRoute('/users'),
    canAccessCompanies: canAccessRoute('/companies'),
  };
};