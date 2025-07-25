import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ListTodo,
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Bell,
  CheckSquare
} from 'lucide-react';
import { useAuth, usePermissions } from '../../contexts/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { canManageUsers, canViewReports } = usePermissions();

  const menuItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Tasks', href: '/tasks', icon: ListTodo },
    { label: 'Users', href: '/users', icon: Users, show: canManageUsers },
    { label: 'Reports', href: '/reports', icon: BarChart3, show: canViewReports },
    { label: 'Notifications', href: '/notifications', icon: Bell },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-white shadow-lg h-screen flex flex-col border-r border-gray-200">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <CheckSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">TaskFlow</h2>
            <p className="text-sm text-gray-500">Pro</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6" aria-label="Sidebar Navigation">
        <ul className="space-y-2">
          {menuItems.map((item) =>
            item.show !== false && (
              <li key={item.label}>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium
                    ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </NavLink>
              </li>
            )
          )}
        </ul>
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <img
            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=random`}
            alt={`${user?.name || 'User'}'s avatar`}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );
};
