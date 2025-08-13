import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Task, User, Client, Notification } from '../types';

interface AppContextType {
  tasks: Task[];
  clients: Client[];
  notifications: Notification[];
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
  updateTasks: (tasks: Task[]) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  markNotificationAsRead: (id: string | number) => void;
  setNotifications: (notifications: Notification[] | ((prev: Notification[]) => Notification[])) => void; // 🆕 Added setNotifications
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const updateTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
  };

  const addTask = (task: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = { ...task, id: Date.now().toString(), createdAt: new Date() };
    setTasks(prev => [...prev, newTask]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { ...task, ...updates } : task
    ));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>) => {
    const newNotification: Notification = { 
      ...notification, 
      id: Date.now().toString(), 
      createdAt: new Date() 
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markNotificationAsRead = (id: string | number) => {
    setNotifications(prev => prev.map(notif => 
      notif.id.toString() === id.toString() ? { ...notif, isRead: true } : notif
    ));
  };

  return (
    <AppContext.Provider value={{
      tasks,
      clients,
      notifications,
      selectedClient,
      setSelectedClient,
      updateTasks,
      addTask,
      updateTask,
      deleteTask,
      addNotification,
      markNotificationAsRead,
      setNotifications, // 🆕 Added setNotifications to the provider
    }}>
      {children}
    </AppContext.Provider>
  );
};