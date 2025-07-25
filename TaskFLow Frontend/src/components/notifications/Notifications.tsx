import React from 'react';
import { Bell, CheckCircle, Clock, AlertTriangle, Info } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

export const Notifications: React.FC = () => {
  const { notifications, markNotificationAsRead } = useApp();
  const { user } = useAuth();

  const userNotifications = notifications.filter(n => n.userId === user?.id);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'task_completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'reminder':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'deadline_approaching':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return 'bg-blue-50 border-blue-200';
      case 'task_completed':
        return 'bg-green-50 border-green-200';
      case 'reminder':
        return 'bg-yellow-50 border-yellow-200';
      case 'deadline_approaching':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">Stay updated with your tasks and activities</p>
        </div>
        <div className="flex items-center space-x-2">
          <Bell className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-600">
            {userNotifications.filter(n => !n.isRead).length} unread
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6">
          <div className="space-y-4">
            {userNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No notifications yet</p>
              </div>
            ) : (
              userNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                    notification.isRead ? 'bg-gray-50 border-gray-200' : getNotificationBg(notification.type)
                  } ${!notification.isRead ? 'hover:shadow-md' : ''}`}
                  onClick={() => !notification.isRead && markNotificationAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${
                          notification.isRead ? 'text-gray-600' : 'text-gray-900'
                        }`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className={`text-sm mt-1 ${
                        notification.isRead ? 'text-gray-500' : 'text-gray-700'
                      }`}>
                        {notification.message}
                      </p>
                      {!notification.isRead && (
                        <div className="flex items-center mt-2">
                          <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
                          <span className="text-xs text-blue-600 font-medium">New</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};