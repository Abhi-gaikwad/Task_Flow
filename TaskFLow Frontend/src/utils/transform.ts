// Utility to transform backend user object to frontend user shape
import { User } from '../types';

export const transformBackendUser = (backendUser: any): User => {
  return {
    id: backendUser.id.toString(),
    name: backendUser.full_name || backendUser.username || backendUser.email.split('@')[0],
    email: backendUser.email,
    role: backendUser.role,
    avatar: backendUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(backendUser.username || 'User')}&background=random`,
    canAssignTasks: backendUser.can_assign_tasks || backendUser.role === 'super_admin' || backendUser.role === 'admin',
    isActive: backendUser.is_active,
    createdAt: new Date(backendUser.created_at),
    lastLogin: backendUser.last_login_at ? new Date(backendUser.last_login_at) : new Date(),
    company_id: backendUser.company_id,
    username: backendUser.username,
    // Add any additional fields from your enhanced User model
  };
}; 