// src/utils/transform.ts

export interface BackendUser {
  id: number;
  email: string;
  username: string;
  role: 'super_admin' | 'admin' | 'user';
  company_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  full_name?: string;
  avatar_url?: string;
  phone_number?: string;
  department?: string;
  about_me?: string;
  preferred_language?: string;
  can_assign_tasks?: boolean;
  company?: {
    id: number;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
  };
}

export interface FrontendUser {
  id: number;
  email: string;
  username: string;
  name: string; // Transformed from username or full_name
  role: 'super_admin' | 'admin' | 'user';
  companyId?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  fullName?: string;
  avatar?: string;
  phoneNumber?: string;
  department?: string;
  aboutMe?: string;
  preferredLanguage?: string;
  canAssignTasks?: boolean;
  company?: {
    id: number;
    name: string;
    description?: string;
    isActive: boolean;
    createdAt: string;
  };
}

/**
 * Transform backend user data to frontend format
 */
export const transformBackendUser = (backendUser: BackendUser): FrontendUser => {
  return {
    id: backendUser.id,
    email: backendUser.email,
    username: backendUser.username,
    name: backendUser.full_name || backendUser.username,
    role: backendUser.role,
    companyId: backendUser.company_id ?? backendUser.company?.id ?? undefined,
    isActive: backendUser.is_active,
    createdAt: backendUser.created_at,
    updatedAt: backendUser.updated_at,
    fullName: backendUser.full_name,
    avatar: backendUser.avatar_url,
    phoneNumber: backendUser.phone_number,
    department: backendUser.department,
    aboutMe: backendUser.about_me,
    preferredLanguage: backendUser.preferred_language || 'en',
    canAssignTasks: backendUser.can_assign_tasks || false,
    company: backendUser.company
      ? {
        id: backendUser.company.id,
        name: backendUser.company.name,
        description: backendUser.company.description,
        isActive: backendUser.company.is_active,
        createdAt: backendUser.company.created_at,
      }
      : undefined,
  };
};


/**
 * Transform frontend user data to backend format for API calls
 */
export const transformFrontendUser = (frontendUser: Partial<FrontendUser>): Partial<BackendUser> => {
  const backendUser: Partial<BackendUser> = {
    id: frontendUser.id,
    email: frontendUser.email,
    username: frontendUser.username,
    role: frontendUser.role,
    company_id: frontendUser.companyId,
    is_active: frontendUser.isActive,
    created_at: frontendUser.createdAt,
    updated_at: frontendUser.updatedAt,
    full_name: frontendUser.fullName,
    avatar_url: frontendUser.avatar,
    phone_number: frontendUser.phoneNumber,
    department: frontendUser.department,
    about_me: frontendUser.aboutMe,
    preferred_language: frontendUser.preferredLanguage,
    can_assign_tasks: frontendUser.canAssignTasks,
  };

  // Remove undefined values
  return Object.fromEntries(
    Object.entries(backendUser).filter(([_, value]) => value !== undefined)
  ) as Partial<BackendUser>;
};

/**
 * Get user display name with fallback
 */
export const getUserDisplayName = (user: BackendUser | FrontendUser): string => {
  if ('name' in user && user.name) {
    return user.name;
  }

  if ('fullName' in user && user.fullName) {
    return user.fullName;
  }

  if ('full_name' in user && user.full_name) {
    return user.full_name;
  }

  return user.username;
};

/**
 * Get user avatar with fallback
 */
export const getUserAvatar = (user: BackendUser | FrontendUser): string => {
  const avatar = 'avatar' in user ? user.avatar :
    'avatar_url' in user ? user.avatar_url : null;

  if (avatar) {
    return avatar;
  }

  // Generate avatar from email or username
  const identifier = user.email || user.username;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserDisplayName(user))}&background=3b82f6&color=white&size=40`;
};

/**
 * Format user role for display
 */
export const formatUserRole = (role: string): string => {
  return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Check if user can perform admin actions
 */
export const canUserPerformAdminActions = (user: BackendUser | FrontendUser): boolean => {
  return user.role === 'admin' || user.role === 'super_admin';
};

/**
 * Check if user can manage other users
 */
export const canUserManageUsers = (user: BackendUser | FrontendUser): boolean => {
  return user.role === 'admin' || user.role === 'super_admin';
};

/**
 * Check if user can create companies
 */
export const canUserManageCompanies = (user: BackendUser | FrontendUser): boolean => {
  return user.role === 'super_admin';
};

/**
 * Check if user is in the same company as another user
 */
export const areUsersInSameCompany = (user1: BackendUser | FrontendUser, user2: BackendUser | FrontendUser): boolean => {
  const company1 = 'companyId' in user1 ? user1.companyId : user1.company_id;
  const company2 = 'companyId' in user2 ? user2.companyId : user2.company_id;

  return company1 !== undefined && company2 !== undefined && company1 === company2;
};

/**
 * Get users that the current user can manage
 */
export const getManageableUsers = (currentUser: BackendUser | FrontendUser, allUsers: (BackendUser | FrontendUser)[]): (BackendUser | FrontendUser)[] => {
  if (currentUser.role === 'super_admin') {
    // Super admin can manage all admin users
    return allUsers.filter(user => user.role === 'admin');
  }

  if (currentUser.role === 'admin') {
    // Admin can manage users in their company (except super admins)
    return allUsers.filter(user =>
      user.role !== 'super_admin' &&
      areUsersInSameCompany(currentUser, user)
    );
  }

  // Regular users can't manage anyone
  return [];
};

/**
 * Filter user data based on current user's permissions
 */
export const filterUsersForRole = (currentUser: BackendUser | FrontendUser, users: (BackendUser | FrontendUser)[]): (BackendUser | FrontendUser)[] => {
  if (currentUser.role === 'super_admin') {
    // Super admin sees all company admins
    return users.filter(user => user.role === 'admin');
  }

  if (currentUser.role === 'admin') {
    // Admin sees users in their company (except super admins)
    return users.filter(user =>
      user.role !== 'super_admin' &&
      areUsersInSameCompany(currentUser, user)
    );
  }

  // Regular users only see themselves
  return users.filter(user => user.id === currentUser.id);
};

export default {
  transformBackendUser,
  transformFrontendUser,
  getUserDisplayName,
  getUserAvatar,
  formatUserRole,
  canUserPerformAdminActions,
  canUserManageUsers,
  canUserManageCompanies,
  areUsersInSameCompany,
  getManageableUsers,
  filterUsersForRole,
};