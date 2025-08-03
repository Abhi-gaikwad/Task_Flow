import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, Plus, CheckCircle, Trash } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

interface HeaderProps {
  onNewTask: () => void;
}

// Path to your sound file (put in public/sounds/notify.wav)
const NOTIF_SOUND_URL = "/sounds/notify.mp3";

export const Header: React.FC<HeaderProps> = ({ onNewTask }) => {
  const { user } = useAuth();
  const { notifications, markNotificationAsRead } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Track unread count for sound effect
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const [lastUnread, setLastUnread] = useState(unreadCount);

  // Play notification sound when new unread notifications arrive
  useEffect(() => {
    if (unreadCount > lastUnread) {
      const audio = new Audio(NOTIF_SOUND_URL);
      audio.play();
    }
    setLastUnread(unreadCount);
    // eslint-disable-next-line
  }, [unreadCount]);

  // Outside click closes dropdown
  useEffect(() => {
    if (!showNotifications) return;
    function handleClick(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifications]);

  // Mark all as read handler (calls your context/method)
  const markAllAsRead = () => {
    notifications
      .filter(n => !n.isRead)
      .forEach(n => markNotificationAsRead && markNotificationAsRead(n.id));
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks, users, projects…"
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
            />
          </div>
        </div>

        {/* Actions, Notifications, User */}
        <div className="flex items-center space-x-4">
          {(user?.role === 'admin' || user?.canAssignTasks) && (
            <button
              onClick={onNewTask}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center space-x-2 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          )}

          {/* Notification Dropdown */}
          <div className="relative">
            <button
              ref={bellRef}
              onClick={() => setShowNotifications(v => !v)}
              className="p-2 text-gray-400 hover:text-blue-500 relative hover:bg-blue-50 rounded-full border border-transparent focus:ring-2 focus:ring-blue-300 focus:outline-none transition"
              aria-label="Show Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-white shadow">
                  {unreadCount}
                </span>
              )}
            </button>
            {/* Dropdown */}
            {showNotifications && (
              <div
                ref={dropdownRef}
                className="absolute z-50 right-0 mt-3 w-96 max-w-xs bg-white shadow-2xl border border-gray-100 rounded-2xl overflow-hidden backdrop-blur-sm transition"
                style={{
                  background: 'rgba(255,255,255,0.97)',
                  boxShadow: '0 8px 32px rgba(50,60,100,0.18)'
                }}
              >
                <div className="flex justify-between items-center border-b border-gray-100 px-5 py-3 bg-white/90 sticky top-0 z-10">
                  <span className="font-semibold text-gray-800">Notifications</span>
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center text-xs text-blue-600 hover:underline font-medium"
                    disabled={notifications.length === 0 || unreadCount === 0}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" /> Mark all as read
                  </button>
                </div>
                <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <li className="py-8 px-6 text-center text-gray-400">No notifications</li>
                  ) : (
                    notifications.map((n, idx) => (
                      <li
                        key={n.id || idx}
                        className={`px-6 py-3 cursor-pointer transition group ${
                          !n.isRead
                            ? 'bg-blue-50/80 hover:bg-blue-100 shadow-sm'
                            : 'hover:bg-gray-50'
                        }`}
                        title={
                          n.createdAt
                            ? new Date(n.createdAt).toLocaleString()
                            : undefined
                        }
                        onClick={() =>
                          markNotificationAsRead && !n.isRead && markNotificationAsRead(n.id)
                        }
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-gray-800 leading-tight" style={!n.isRead ? { fontWeight: 600 } : {}}>
                              {n.message}
                            </div>
                            {n.createdAt && (
                              <div className="text-xs text-gray-400">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                          {!n.isRead && (
                            <span className="ml-2 mt-1 inline-block bg-blue-500 w-2.5 h-2.5 rounded-full animate-pulse"></span>
                          )}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <div className="border-t border-gray-100 px-4 py-3 bg-white/80 text-right">
                  <button
                    className="flex items-center justify-center text-xs text-red-500 hover:text-red-700 transition"
                    // onClick={...} // implement clearAll if you want!
                    disabled
                  >
                    <Trash className="w-4 h-4 mr-1" />
                    Clear all (coming soon)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User summary */}
          <div className="flex items-center space-x-3">
            <img
              src={user?.avatar || `https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=400`}
              alt={user?.name}
              className="w-8 h-8 rounded-full object-cover border border-gray-300 shadow-sm"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
