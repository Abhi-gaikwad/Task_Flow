import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { LoginForm } from './components/auth/LoginForm';
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from './components/dashboard/Dashboard';
import { TaskList } from './components/tasks/TaskList';
import { UserList } from './components/users/UserList';
import { Reports } from './components/reports/Reports';
import { Settings } from './components/settings/Settings';
import { Notifications } from './components/notifications/Notifications';

/**
 * A component to protect routes that require authentication.
 * If the user is not authenticated, it redirects them to the login page.
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // You can replace this with a dedicated loading spinner component
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    // Redirect to the login page if not authenticated
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/**
 * The main App component that sets up providers and routing.
 */
function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            {/* Public route for the login page */}
            <Route path="/login" element={<LoginForm />} />

            {/* Protected routes for the main application */}
            <Route
              path="/*" // This will match all routes other than /login
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* Nested routes will be rendered inside AppLayout's <Outlet> */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="tasks" element={<TaskList />} />
              <Route path="users" element={<UserList />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              <Route path="notifications" element={<Notifications />} />
              {/* Default route for authenticated users */}
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
