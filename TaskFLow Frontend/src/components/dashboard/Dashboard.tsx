// Dashboard.tsx
import React from 'react';
import { CheckSquare, Users, Clock, TrendingUp } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { StatsCard } from './StatsCard';
import { TaskChart } from './TaskChart';

export const Dashboard: React.FC = () => {
  const { tasks, users, clients } = useApp();
  const { user } = useAuth(); //

  // If the user is a super_admin, we return a specific message
  if (user?.role === 'super_admin') { //
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome, Super Admin!</h1>
        <p className="text-gray-600">Please navigate to the "Company Admins" section in the sidebar to manage administrators.</p> {/* */}
      </div>
    );
  }

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
  };

  const userTasks = tasks.filter(t => t.assignedTo === user?.id);
  const userTaskStats = {
    total: userTasks.length,
    completed: userTasks.filter(t => t.status === 'completed').length,
    pending: userTasks.filter(t => t.status === 'pending').length,
    inProgress: userTasks.filter(t => t.status === 'in-progress').length,
  };

  const displayStats = user?.role === 'admin' ? taskStats : userTaskStats; //

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}!</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Tasks"
          value={displayStats.total}
          icon={CheckSquare}
          color="blue"
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Completed"
          value={displayStats.completed}
          icon={TrendingUp}
          color="green"
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="In Progress"
          value={displayStats.inProgress}
          icon={Clock}
          color="yellow"
        />
        {user?.role === 'admin' && ( //
          <StatsCard
            title="Active Users"
            value={users.filter(u => u.isActive).length}
            icon={Users}
            color="purple"
            trend={{ value: 5, isPositive: true }}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskChart data={displayStats} />

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Tasks</h3>
          <div className="space-y-3">
            {(user?.role === 'admin' ? tasks : userTasks) //
              .slice(0, 5)
              .map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    <p className="text-xs text-gray-500">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                      task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {task.priority}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      task.status === 'completed' ? 'bg-green-100 text-green-800' :
                      task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {user?.role === 'admin' && ( //
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clients.map((client) => (
              <div key={client.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  <img
                    src={client.avatar || `https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400`}
                    alt={client.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{client.name}</p>
                    <p className="text-sm text-gray-500">{client.company}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center p-2 bg-white rounded">
                    <p className="font-medium text-gray-900">{client.tasksCount.total}</p>
                    <p className="text-gray-500">Total</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <p className="font-medium text-green-600">{client.tasksCount.completed}</p>
                    <p className="text-gray-500">Completed</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};