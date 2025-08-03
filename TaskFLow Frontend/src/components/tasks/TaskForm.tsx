import React, { useState, useEffect } from 'react';
import { Calendar, User, Tag, AlertCircle } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../common/Button';
import { Toast } from '../common/Toast';
import { Task } from '../../types';

interface TaskFormProps {
  onSubmit: () => void; // Simplified - just trigger refresh
  onClose: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ onSubmit, onClose }) => {
  // Remove users from context, always fetch fresh list on open:
  const { addNotification } = useApp();
  const { user } = useAuth();

  // Local state for users list in this form
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    assignedTo: '',
    dueDate: '',
    reminderSet: '',
    tags: '',
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch users when the form/modal is mounted
  useEffect(() => {
    async function fetchUsers() {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const res = await fetch('http://localhost:8000/api/v1/users', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json'
          }
        });
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        setAvailableUsers(data.filter((u: any) => u.id !== user?.id)); // Exclude self!
      } catch (err: any) {
        setUsersError(err.message || 'Error loading users');
      } finally {
        setUsersLoading(false);
      }
    }
    fetchUsers();
  }, [user?.id]); // (Re-)fetch if current user changes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validation
    if (!formData.title.trim()) {
      setToastMessage('Task title is required');
      setToastType('error');
      setShowToast(true);
      setIsLoading(false);
      return;
    }
    if (!formData.assignedTo) {
      setToastMessage('Please select a user to assign the task to');
      setToastType('error');
      setShowToast(true);
      setIsLoading(false);
      return;
    }
    if (!formData.dueDate) {
      setToastMessage('Due date is required');
      setToastType('error');
      setShowToast(true);
      setIsLoading(false);
      return;
    }

    try {
      // Prepare API payload
      const taskPayload = {
        title: formData.title.trim(),
        description: formData.description.trim() || "",
        assigned_to_id: parseInt(formData.assignedTo, 10),
        due_date: new Date(formData.dueDate).toISOString(),
        priority: formData.priority,
      };

      // API Call
      const response = await fetch('http://localhost:8000/api/v1/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(taskPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const newTask = await response.json();

      // Reset form after successful creation
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        assignedTo: '',
        dueDate: '',
        reminderSet: '',
        tags: '',
      });

      onSubmit();

      // Optional: Add notification for the assigned user
      addNotification({
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `You have been assigned a new task: ${formData.title}`,
        userId: formData.assignedTo,
        taskId: newTask.id?.toString() || '',
        isRead: false,
      });

      setToastMessage(`Task "${formData.title}" created successfully!`);
      setToastType('success');
      setShowToast(true);

      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error: any) {
      let errorMessage = 'Error creating task';
      if (error.message?.includes('Field required')) {
        errorMessage = 'Please fill in all required fields correctly';
      } else if (error.message?.includes('403')) {
        errorMessage = 'You do not have permission to assign tasks';
      } else if (error.message?.includes('404')) {
        errorMessage = 'Selected user not found';
      } else if (error.message?.includes('422')) {
        errorMessage = 'Invalid data provided. Please check all fields.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setToastMessage(errorMessage);
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Task Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Task Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
              formData.title.trim()
                ? 'border-gray-300 focus:ring-blue-500'
                : 'border-red-300 focus:ring-red-500'
            }`}
            placeholder="Enter task title"
            required
            disabled={isLoading}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter task description"
            disabled={isLoading}
          />
        </div>

        {/* Priority and Assign To */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as Task['priority'] })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Assign To
            </label>
            {usersLoading ? (
              <div className="px-4 py-2 text-sm text-gray-400">Loading users...</div>
            ) : usersError ? (
              <div className="px-4 py-2 text-sm text-red-500">{usersError}</div>
            ) : (
              <select
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
              >
                <option value="">Select user</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.username || user.email || 'Unknown User'}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Due Date and Reminder */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Due Date
            </label>
            <input
              type="datetime-local"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reminder
            </label>
            <input
              type="datetime-local"
              value={formData.reminderSet}
              onChange={(e) => setFormData({ ...formData, reminderSet: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Tag className="w-4 h-4 inline mr-1" />
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. design, urgent, frontend"
            disabled={isLoading}
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </form>

      {/* Toast Notification */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};
