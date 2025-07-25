import React from 'react';
import { BarChart3 } from 'lucide-react';

interface TaskChartProps {
  data: {
    completed: number;
    pending: number;
    inProgress: number;
  };
}

export const TaskChart: React.FC<TaskChartProps> = ({ data }) => {
  const total = data.completed + data.pending + data.inProgress;
  const completedPercentage = (data.completed / total) * 100;
  const pendingPercentage = (data.pending / total) * 100;
  const inProgressPercentage = (data.inProgress / total) * 100;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Task Distribution</h3>
        <BarChart3 className="w-5 h-5 text-gray-400" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Completed</span>
          <span className="text-sm font-bold text-green-600">{data.completed}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completedPercentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">In Progress</span>
          <span className="text-sm font-bold text-blue-600">{data.inProgress}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${inProgressPercentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Pending</span>
          <span className="text-sm font-bold text-yellow-600">{data.pending}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${pendingPercentage}%` }}
          />
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          <span className="font-medium">Total Tasks:</span> {total}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          <span className="font-medium">Completion Rate:</span> {completedPercentage.toFixed(1)}%
        </p>
      </div>
    </div>
  );
};