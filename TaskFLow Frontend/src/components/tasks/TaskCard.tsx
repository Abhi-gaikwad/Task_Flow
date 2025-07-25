import React from 'react';
import { Calendar, User, Tag, MoreHorizontal, Clock, CheckCircle } from 'lucide-react';
import { Task } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete }) => {
  const { users, updateTask } = useApp();
  const { user } = useAuth();

  const assignedUser = users.find(u => u.id === task.assignedTo);
  const assignedByUser = users.find(u => u.id === task.assignedBy);

  const priorityColors = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    urgent: 'bg-red-100 text-red-800 border-red-200',
  };

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800 border-gray-200',
    'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
  };

  const handleStatusChange = (newStatus: Task['status']) => {
    updateTask(task.id, { 
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date() : undefined
    });
  };

  const canEdit = user?.role === 'admin' || user?.id === task.assignedBy;
  const canDelete = user?.role === 'admin';

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{task.title}</h3>
          <p className="text-gray-600 text-sm mb-3">{task.description}</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
          {(canEdit || canDelete) && (
            <button className="p-1 text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center">
            <User className="w-4 h-4 mr-1" />
            <span>{assignedUser?.name}</span>
          </div>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
          </div>
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag, index) => (
                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[task.status]}`}>
              {task.status}
            </span>
            {task.status === 'completed' && task.completedAt && (
              <span className="text-xs text-gray-500">
                Completed {new Date(task.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {user?.id === task.assignedTo && task.status !== 'completed' && (
            <div className="flex space-x-2">
              {task.status === 'pending' && (
                <button
                  onClick={() => handleStatusChange('in-progress')}
                  className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Start
                </button>
              )}
              {task.status === 'in-progress' && (
                <button
                  onClick={() => handleStatusChange('completed')}
                  className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Complete
                </button>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500">
          Assigned by {assignedByUser?.name} • {new Date(task.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};