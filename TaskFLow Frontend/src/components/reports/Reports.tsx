import React, { useState } from 'react';
import { BarChart3, Download, Calendar, TrendingUp, Users, CheckSquare } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../common/Button';

export const Reports: React.FC = () => {
  const { tasks, users, clients } = useApp();
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthlyTasks = tasks.filter(task => {
    const taskDate = new Date(task.createdAt);
    return taskDate.getMonth() === selectedMonth && taskDate.getFullYear() === selectedYear;
  });

  const monthlyStats = {
    total: monthlyTasks.length,
    completed: monthlyTasks.filter(t => t.status === 'completed').length,
    pending: monthlyTasks.filter(t => t.status === 'pending').length,
    inProgress: monthlyTasks.filter(t => t.status === 'in-progress').length,
  };

  const userTaskStats = users.map(u => ({
    user: u,
    assigned: tasks.filter(t => t.assignedTo === u.id).length,
    completed: tasks.filter(t => t.assignedTo === u.id && t.status === 'completed').length,
    pending: tasks.filter(t => t.assignedTo === u.id && t.status === 'pending').length,
    inProgress: tasks.filter(t => t.assignedTo === u.id && t.status === 'in-progress').length,
  }));

  const priorityStats = {
    low: monthlyTasks.filter(t => t.priority === 'low').length,
    medium: monthlyTasks.filter(t => t.priority === 'medium').length,
    high: monthlyTasks.filter(t => t.priority === 'high').length,
    urgent: monthlyTasks.filter(t => t.priority === 'urgent').length,
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const exportReport = () => {
    const reportData = {
      month: months[selectedMonth],
      year: selectedYear,
      stats: monthlyStats,
      userStats: userTaskStats,
      priorityStats,
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `task-report-${selectedYear}-${selectedMonth + 1}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Monthly task analytics and insights</p>
        </div>
        <Button icon={Download} onClick={exportReport}>
          Export Report
        </Button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex items-center space-x-4 mb-6">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((month, index) => (
              <option key={index} value={index}>
                {month}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[2023, 2024, 2025].map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Tasks</p>
                <p className="text-2xl font-bold text-blue-900">{monthlyStats.total}</p>
              </div>
              <CheckSquare className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Completed</p>
                <p className="text-2xl font-bold text-green-900">{monthlyStats.completed}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">In Progress</p>
                <p className="text-2xl font-bold text-yellow-900">{monthlyStats.inProgress}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Pending</p>
                <p className="text-2xl font-bold text-red-900">{monthlyStats.pending}</p>
              </div>
              <Users className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
            <div className="space-y-3">
              {Object.entries(priorityStats).map(([priority, count]) => {
                const total = Object.values(priorityStats).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                const colors = {
                  low: 'bg-green-500',
                  medium: 'bg-yellow-500',
                  high: 'bg-orange-500',
                  urgent: 'bg-red-500',
                };
                return (
                  <div key={priority}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">{priority}</span>
                      <span className="text-sm text-gray-600">{count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${colors[priority as keyof typeof colors]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Performance</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {userTaskStats.map((userStat) => (
                <div key={userStat.user.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div className="flex items-center space-x-3">
                    <img
                      src={userStat.user.avatar || `https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=400`}
                      alt={userStat.user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{userStat.user.name}</p>
                      <p className="text-xs text-gray-500">{userStat.assigned} tasks assigned</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{userStat.completed} completed</p>
                    <p className="text-xs text-gray-500">
                      {userStat.assigned > 0 ? ((userStat.completed / userStat.assigned) * 100).toFixed(1) : 0}% rate
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};