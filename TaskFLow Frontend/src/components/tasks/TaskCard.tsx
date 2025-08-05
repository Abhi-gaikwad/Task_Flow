// src/components/tasks/TaskCard.tsx

import React from 'react';
import { Calendar, User, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Task } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete }) => {
  const { updateTask } = useApp();
  const { user } = useAuth();

  const priorityConfig = {
    low: { 
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200'
    },
    medium: { 
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200'
    },
    high: { 
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200'
    },
    urgent: { 
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200'
    },
  };

  const statusConfig = {
    pending: { 
      color: 'text-gray-600',
      bg: 'bg-gray-100',
      dot: 'bg-gray-400'
    },
    'in-progress': { 
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      dot: 'bg-blue-500'
    },
    completed: { 
      color: 'text-green-600',
      bg: 'bg-green-100',
      dot: 'bg-green-500'
    },
  };

  const handleStatusChange = async (newStatus: Task['status']) => {
    try {
      const backendStatus = newStatus === 'in-progress' ? 'in_progress' : newStatus;
      const response = await fetch(`http://localhost:8000/api/v1/tasks/${task.id}/status?status=${backendStatus}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (response.ok) {
        updateTask(task.id, { ...task, status: newStatus });
      } else {
        const errorText = await response.text();
        console.error('Failed to update task status:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  // Permission logic
  const isAssignedToMe = user?.id?.toString() === task.assignedTo;
  const canUpdateStatus = isAssignedToMe;

  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];

  const formatDate = (date: Date | undefined) => {
    if (!date) return null;
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    if (diffDays === 0) return { text: 'Due today', isOverdue: false };
    if (diffDays === 1) return { text: 'Due tomorrow', isOverdue: false };
    if (diffDays <= 7) return { text: `${diffDays}d left`, isOverdue: false };
    return { text: new Date(date).toLocaleDateString(), isOverdue: false };
  };

  const dueDateInfo = formatDate(task.dueDate);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-base leading-tight pr-2">
          {task.title}
        </h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Priority Badge */}
          <span className={`px-2 py-1 rounded text-xs font-medium ${priority.bg} ${priority.color} ${priority.border} border`}>
            {task.priority.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-gray-600 text-sm mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Status and Due Date Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.dot}`}></div>
          <span className={`text-sm font-medium ${status.color}`}>
            {task.status === 'in-progress' ? 'In Progress' : 
             task.status === 'pending' ? 'Pending' : 'Completed'}
          </span>
        </div>
        
        {dueDateInfo && (
          <div className={`flex items-center gap-1 text-sm ${dueDateInfo.isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
            {dueDateInfo.isOverdue && <AlertTriangle className="w-3 h-3" />}
            <Calendar className="w-3 h-3" />
            <span className="font-medium">{dueDateInfo.text}</span>
          </div>
        )}
      </div>

      {/* Assignee */}
      <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
        <User className="w-4 h-4" />
        <span>{task.assignee_name || 'Unassigned'}</span>
      </div>

      {/* Completion Status */}
      {task.status === 'completed' && task.completedAt && (
        <div className="bg-green-50 border border-green-200 rounded-md p-2 mb-3">
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Completed on {new Date(task.completedAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {canUpdateStatus && task.status !== 'completed' && (
        <div className="flex gap-2">
          {task.status === 'pending' && (
            <button
              type="button"
              onClick={() => handleStatusChange('in-progress')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Start
            </button>
          )}
          {task.status === 'in-progress' && (
            <button
              type="button"
              onClick={() => handleStatusChange('completed')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Complete
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          Created by <span className="font-medium">{task.creator_name}</span>
          {task.createdAt && (
            <> • {new Date(task.createdAt).toLocaleDateString()}</>
          )}
        </div>
      </div>
    </div>
  );
};