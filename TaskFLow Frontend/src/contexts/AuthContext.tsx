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

// Role-based permissions mapping
const ROLE_PERMISSIONS = {
  super_admin: [
    'manage_companies',
    'manage_all_users',
    'manage_all_tasks',
    'view_reports',
    'manage_settings',
    'view_dashboard',
    'assign_tasks',
    'create_users',
    'delete_users',
    'update_users'
  ],
  admin: [
    'manage_company_users',
    'manage_company_tasks',
    'view_company_reports',
    'view_dashboard',
    'assign_tasks',
    'create_users',
    'update_users'
  ],
  user: [
    'view_own_tasks',
    'update_own_tasks',
    'view_profile',
    'view_dashboard'
  ]
};

// Route access mapping
const ROUTE_ACCESS = {
  '/dashboard': ['super_admin', 'admin', 'user'],
  '/dashboard/superadmin': ['super_admin'],
  '/dashboard/user': ['user'],
  '/dashboard/admin': ['super_admin', 'admin'],
  '/users': ['super_admin', 'admin'],
  '/users/create': ['super_admin', 'admin'],
  '/tasks': ['super_admin', 'admin', 'user'],
  '/tasks/create': ['super_admin', 'admin'],
  '/companies': ['super_admin'],
  '/reports': ['super_admin', 'admin'],
  '/settings': ['super_admin', 'admin'],
  '/profile': ['super_admin', 'admin', 'user']
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const initializeAuth = async () => {
      const savedAuth = localStorage.getItem('auth');
      const token = localStorage.getItem('access_token');
      
      console.log('AuthContext initializing...', { savedAuth: !!savedAuth, token: !!token }); // Debug log
      
      if (savedAuth && token) {
        try {
          const user = JSON.parse(savedAuth);
          
          // Verify token is still valid with backend
          try {
            const currentUser = await authAPI.getCurrentUser();
            const updatedUser = transformBackendUser(currentUser);
            
            console.log('AuthContext loaded user from API:', updatedUser); // Debug log
            
            // Update stored user data if it changed
            localStorage.setItem('auth', JSON.stringify(updatedUser));
            
            setAuthState({
              user: updatedUser,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            console.log('Token validation failed, clearing auth');
            localStorage.removeItem('auth');
            localStorage.removeItem('access_token');
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
          console.error('Error parsing saved auth:', error);
          localStorage.removeItem('auth');
          localStorage.removeItem('access_token');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else if (savedAuth) {
        // Handle mock users (without token)
        try {
          const user = JSON.parse(savedAuth);
          console.log('AuthContext loaded mock user:', user); // Debug log
          
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          localStorage.removeItem('auth');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        console.log('No saved auth found'); // Debug log
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    // Check for demo/mock login
    if (email === 'demoadmin@company.com' || email === 'demouser@company.com') {
      const mockUser: User = {
        id: '1',
        name: email === 'demoadmin@company.com' ? 'Demo Admin' : 'Demo User',
        email,
        role: email === 'demoadmin@company.com' ? 'admin' : 'user',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split('@')[0])}&background=random`,
        canAssignTasks: email === 'demoadmin@company.com',
        isActive: true,
        createdAt: new Date(),
        lastLogin: new Date(),
        username: email.split('@')[0],
      };

      localStorage.setItem('auth', JSON.stringify(mockUser));
      setAuthState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      });
      
      console.log('AuthContext mock login successful:', mockUser); // Debug log
      return { success: true };
    }

    // Real API login for FastAPI backend
    try {
      const response = await authAPI.login(email, password);
      
      // Transform backend user to frontend format
      const user = transformBackendUser(response.user);
      
      console.log('AuthContext API login successful:', user); // Debug log
      
      // Store both token and user data
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('auth', JSON.stringify(user));
      
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('AuthContext login failed:', error); // Debug log
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      
      const errorMessage = error.response?.data?.detail || 
                          error.message || 
                          'Login failed. Please check your credentials.';
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  const logout = () => {
    console.log('AuthContext logging out'); // Debug log
    
    localStorage.removeItem('auth');
    localStorage.removeItem('access_token');
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    
    // Redirect to login page
    window.location.href = '/login';
  };

  const updateUser = (user: User) => {
    console.log('AuthContext updating user:', user); // Debug log
    
    localStorage.setItem('auth', JSON.stringify(user));
    setAuthState(prev => ({ ...prev, user }));
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const currentUser = await authAPI.getCurrentUser();
      const updatedUser = transformBackendUser(currentUser);
      updateUser(updatedUser);
      
      console.log('AuthContext user refreshed:', updatedUser); // Debug log
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      // If refresh fails, user might need to re-login
      logout();
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!authState.user) return false;
    
    const userPermissions = ROLE_PERMISSIONS[authState.user.role as keyof typeof ROLE_PERMISSIONS] || [];
    return userPermissions.includes(permission);
  };

  const canAccessRoute = (route: string): boolean => {
    if (!authState.user) return false;
    
    const allowedRoles = ROUTE_ACCESS[route as keyof typeof ROUTE_ACCESS];
    if (!allowedRoles) return true; // If route not defined, allow access
    
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

// Custom hooks for specific use cases
export const usePermissions = () => {
  const { user, hasPermission } = useAuth();
  
  return {
    canManageUsers: hasPermission('manage_all_users') || hasPermission('manage_company_users'),
    canManageTasks: hasPermission('manage_all_tasks') || hasPermission('manage_company_tasks'),
    canAssignTasks: hasPermission('assign_tasks'),
    canViewReports: hasPermission('view_reports') || hasPermission('view_company_reports'),
    canManageCompanies: hasPermission('manage_companies'),
    canCreateUsers: hasPermission('create_users'),
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
    isUser: user?.role === 'user',
  };
};

export const useRouteAccess = () => {
  const { canAccessRoute } = useAuth();
  
  return {
    canAccessDashboard: canAccessRoute('/dashboard'),
    canAccessUsers: canAccessRoute('/users'),
    canAccessTasks: canAccessRoute('/tasks'),
    canAccessReports: canAccessRoute('/reports'),
    canAccessSettings: canAccessRoute('/settings'),
    canAccessCompanies: canAccessRoute('/companies'),
  };
};
