// src/components/layout/Sidebar.tsx
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
  CheckSquare,
} from 'lucide-react';
import { useAuth, usePermissions } from '../../contexts/AuthContext';
import logo from '../../assets/logoNew.jpg'; // Ensure this file really exists in /src/assets/

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { canManageUsers } = usePermissions();

  const appTitle = user?.company?.name || 'Blasto';

  const menuItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
    { label: 'Tasks', href: '/tasks', icon: ListTodo, show: user?.role !== 'super_admin' },
    {
      label: 'Users',
      href: '/users',
      icon: Users,
      show: (user?.role === 'admin' || user?.role === 'company') && canManageUsers,
    },
    { label: 'Reports', href: '/reports', icon: BarChart3, show: user?.role !== 'super_admin' },
    { label: 'Notifications', href: '/notifications', icon: Bell, show: true },
    { label: 'Settings', href: '/settings', icon: Settings, show: true },
  ];

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'company':
        return 'Company';
      case 'admin':
        return 'Admin';
      case 'user':
        return 'User';
      default:
        return role?.replace('_', ' ') || 'User';
    }
  };

  // Function to get display name for company users
  const getDisplayName = () => {
    if (user?.role === 'company') {
      // For company role users, show the company name instead of the virtual username
      return user?.company?.name || 'Company User';
    }
    // For other users, show their actual name or username
    return user?.name || user?.username || 'User';
  };

  return (
    <div className="w-64 bg-white shadow-lg h-screen flex flex-col border-r border-gray-200">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          {/* Logo Image with fallback */}
          <img
            src={logo}
            alt="Company Logo"
            onError={(e) => {
              const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(appTitle)}&background=random`;
              (e.target as HTMLImageElement).src = fallback;
            }}
            className="w-10 h-10 object-contain rounded-md bg-gray-100"
          />

          <div>
            <h2 className="text-xl font-bold text-gray-900">{appTitle}</h2>
            {user?.company?.name && <p className="text-sm text-gray-500">Dashboard</p>}
            {user?.role === 'super_admin' && <p className="text-sm text-gray-500">Pro</p>}
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6" aria-label="Sidebar Navigation">
        <ul className="space-y-2">
          {menuItems.map((item) =>
            item.show ? (
              <li key={item.label}>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${
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
            ) : null
          )}
        </ul>
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <img
            src={
              user?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(getDisplayName())}&background=random`
            }
            alt={`${getDisplayName()}'s avatar`}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{getDisplayName()}</p>
            <p className="text-xs text-gray-500">{getRoleDisplay(user?.role || '')}</p>
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