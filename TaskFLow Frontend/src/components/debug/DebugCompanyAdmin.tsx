// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState } from '../types';
import { authAPI } from '../services/api';
import { transformBackendUser } from '../utils/transform';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  canAccessRoute: (route: string) => boolean;
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

// --- PERMISSIONS AND ROUTE MAPPINGS ---
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['manage_companies', 'manage_all_users', 'view_dashboard'],
  admin: ['manage_company_users', 'manage_company_tasks', 'view_dashboard'],
  user: ['view_own_tasks', 'update_own_tasks', 'view_dashboard'],
};

const ROUTE_ACCESS: Record<string, string[]> = {
  '/dashboard': ['super_admin', 'admin', 'user'],
  '/users': ['super_admin', 'admin'],
  '/companies': ['super_admin'],
};


export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const currentUserFromAPI = await authAPI.getCurrentUser();
          const user = transformBackendUser(currentUserFromAPI);
          localStorage.setItem('auth', JSON.stringify(user));
          setAuthState({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          console.error('Token validation failed, logging out.', error);
          localStorage.removeItem('auth');
          localStorage.removeItem('access_token');
          setAuthState({ user: null, isAuthenticated: false, isLoading: false });
        }
      } else {
        setAuthState({ user: null, isAuthenticated: false, isLoading: false });
      }
    };
    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await authAPI.login(email, password);
      const user = transformBackendUser(response.user);
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('auth', JSON.stringify(user));
      setAuthState({ user, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Login failed.';
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('access_token');
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    window.location.href = '/login';
  };

  const updateUser = (user: User) => {
    localStorage.setItem('auth', JSON.stringify(user));
    setAuthState(prev => ({ ...prev, user }));
  };

  const refreshUser = async () => {
    try {
      const currentUserFromAPI = await authAPI.getCurrentUser();
      const updatedUser = transformBackendUser(currentUserFromAPI);
      updateUser(updatedUser);
    } catch (error) {
      console.error('Failed to refresh user, logging out.', error);
      logout();
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!authState.user) return false;
    const userPermissions = ROLE_PERMISSIONS[authState.user.role] || [];
    return userPermissions.includes(permission);
  };

  const canAccessRoute = (route: string): boolean => {
    if (!authState.user) return false;
    const allowedRoles = ROUTE_ACCESS[route];
    if (!allowedRoles) return true; // Default to accessible if not specified
    return allowedRoles.includes(authState.user.role);
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    updateUser,
    refreshUser,
    hasPermission,
    canAccessRoute,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// --- FIX: RE-ADDING THE EXPORTED CUSTOM HOOKS ---
export const usePermissions = () => {
  const { user, hasPermission } = useAuth();
  return {
    canManageUsers: hasPermission('manage_all_users') || hasPermission('manage_company_users'),
    canManageCompanies: hasPermission('manage_companies'),
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
