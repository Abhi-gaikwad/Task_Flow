import React, { useState, useEffect } from 'react';
import { Calendar, User, Tag, AlertCircle, Users, Check, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../common/Button';
import { Toast } from '../common/Toast';
import { Task } from '../../types';

interface TaskFormProps {
  onSubmit: () => void;
  onClose: () => void;
}

interface UserData {
  id: number;
  username: string;
  email: string;
  role: string;
  full_name?: string;
  is_active: boolean;
}

interface UserGroup {
  admins: UserData[];
  users: UserData[];
  all: UserData[];
}

export const TaskForm: React.FC<TaskFormProps> = ({ onSubmit, onClose }) => {
  const { addNotification } = useApp();
  const { user } = useAuth();

  // User data and loading states
  const [userGroups, setUserGroups] = useState<UserGroup>({
    admins: [],
    users: [],
    all: []
  });
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Assignment selection states
  const [assignmentMode, setAssignmentMode] = useState<'individual' | 'group'>('individual');
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [groupSelections, setGroupSelections] = useState({
    allAdmins: false,
    allUsers: false,
    everyone: false
  });

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    dueDate: '',
    reminderSet: '',
    tags: '',
  });

  // UI states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);
  const [showUserList, setShowUserList] = useState(false);

  // Fetch users when component mounts
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
        
        const data: UserData[] = await res.json();
        
        // Filter out current user and group by role
        const filteredUsers = data.filter((u: UserData) => u.id !== user?.id && u.is_active);
        
        const admins = filteredUsers.filter(u => u.role === 'admin');
        const regularUsers = filteredUsers.filter(u => u.role === 'user');
        
        setUserGroups({
          admins,
          users: regularUsers,
          all: filteredUsers
        });
      } catch (err: any) {
        setUsersError(err.message || 'Error loading users');
      } finally {
        setUsersLoading(false);
      }
    }
    
    fetchUsers();
  }, [user?.id]);

  // Handle group selection changes
  const handleGroupSelection = (groupType: keyof typeof groupSelections) => {
    const newGroupSelections = { ...groupSelections };
    newGroupSelections[groupType] = !groupSelections[groupType];
    
    // Handle mutual exclusivity and user selection
    if (newGroupSelections[groupType]) {
      let usersToAdd: number[] = [];
      
      switch (groupType) {
        case 'everyone':
          newGroupSelections.allAdmins = false;
          newGroupSelections.allUsers = false;
          usersToAdd = userGroups.all.map(u => u.id);
          break;
        case 'allAdmins':
          newGroupSelections.everyone = false;
          usersToAdd = userGroups.admins.map(u => u.id);
          break;
        case 'allUsers':
          newGroupSelections.everyone = false;
          usersToAdd = userGroups.users.map(u => u.id);
          break;
      }
      
      setSelectedUsers(new Set(usersToAdd));
    } else {
      // If unchecking, clear related individual selections
      const newSelectedUsers = new Set(selectedUsers);
      
      switch (groupType) {
        case 'everyone':
          newSelectedUsers.clear();
          break;
        case 'allAdmins':
          userGroups.admins.forEach(u => newSelectedUsers.delete(u.id));
          break;
        case 'allUsers':
          userGroups.users.forEach(u => newSelectedUsers.delete(u.id));
          break;
      }
      
      setSelectedUsers(newSelectedUsers);
    }
    
    setGroupSelections(newGroupSelections);
  };

  // Handle individual user selection
  const handleUserSelection = (userId: number) => {
    const newSelectedUsers = new Set(selectedUsers);
    
    if (selectedUsers.has(userId)) {
      newSelectedUsers.delete(userId);
    } else {
      newSelectedUsers.add(userId);
    }
    
    setSelectedUsers(newSelectedUsers);
    
    // Update group selections based on individual selections
    const newGroupSelections = {
      allAdmins: userGroups.admins.every(u => newSelectedUsers.has(u.id)) && userGroups.admins.length > 0,
      allUsers: userGroups.users.every(u => newSelectedUsers.has(u.id)) && userGroups.users.length > 0,
      everyone: userGroups.all.every(u => newSelectedUsers.has(u.id)) && userGroups.all.length > 0
    };
    
    setGroupSelections(newGroupSelections);
  };

  // Create multiple tasks for selected users using bulk API
  const createTasksForUsers = async (userIds: number[]) => {
    try {
      const taskPayload = {
        title: formData.title.trim(),
        description: formData.description.trim() || "",
        assigned_to_ids: userIds,
        due_date: new Date(formData.dueDate).toISOString(),
        priority: formData.priority,
      };

      const response = await fetch('http://localhost:8000/api/v1/tasks/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(taskPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const bulkResult = await response.json();
      
      // Add notifications for successful assignments
      bulkResult.successful.forEach((task: any) => {
        addNotification({
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `You have been assigned a new task: ${formData.title}`,
          userId: task.assigned_to_id.toString(),
          taskId: task.id?.toString() || '',
          isRead: false,
        });
      });

      // Convert to the expected format
      return {
        successful: bulkResult.successful.map((task: any) => task.assigned_to_id),
        failed: bulkResult.failed.map((failure: any) => ({
          userId: failure.user_id,
          error: failure.error
        }))
      };

    } catch (error: any) {
      // If bulk API fails, fall back to individual creation
      console.warn('Bulk API failed, falling back to individual task creation:', error.message);
      
      const results = {
        successful: [] as number[],
        failed: [] as { userId: number; error: string }[]
      };

      for (const userId of userIds) {
        try {
          const taskPayload = {
            title: formData.title.trim(),
            description: formData.description.trim() || "",
            assigned_to_id: userId,
            due_date: new Date(formData.dueDate).toISOString(),
            priority: formData.priority,
          };

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
            throw new Error(errorData.detail || `HTTP ${response.status}`);
          }

          const newTask = await response.json();
          results.successful.push(userId);

          // Add notification for the assigned user
          addNotification({
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `You have been assigned a new task: ${formData.title}`,
            userId: userId.toString(),
            taskId: newTask.id?.toString() || '',
            isRead: false,
          });

        } catch (error: any) {
          results.failed.push({
            userId,
            error: error.message || 'Unknown error'
          });
        }
      }

      return results;
    }
  };

  // Handle form submission
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

    if (selectedUsers.size === 0) {
      setToastMessage('Please select at least one user to assign the task to');
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
      const userIds = Array.from(selectedUsers);
      const results = await createTasksForUsers(userIds);

      // Reset form after successful creation
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        reminderSet: '',
        tags: '',
      });
      setSelectedUsers(new Set());
      setGroupSelections({
        allAdmins: false,
        allUsers: false,
        everyone: false
      });

      onSubmit();

      // Show success/failure message
      if (results.failed.length === 0) {
        setToastMessage(`Task "${formData.title}" successfully assigned to ${results.successful.length} user(s)!`);
        setToastType('success');
      } else if (results.successful.length === 0) {
        setToastMessage(`Failed to assign task to any users. Please try again.`);
        setToastType('error');
      } else {
        setToastMessage(`Task assigned to ${results.successful.length} user(s). ${results.failed.length} assignment(s) failed.`);
        setToastType('success');
      }

      setShowToast(true);

      if (results.successful.length > 0) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }

    } catch (error: any) {
      setToastMessage('Error creating tasks: ' + (error.message || 'Unknown error'));
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserDisplayName = (user: UserData) => {
    return user.full_name || user.username || user.email || 'Unknown User';
  };

  const getSelectedCount = () => selectedUsers.size;

  return (
    <div className="max-w-4xl mx-auto">
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

        {/* Priority */}
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
        </div>

        {/* User Assignment Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">
              <Users className="w-4 h-4 inline mr-1" />
              Assign To ({getSelectedCount()} selected)
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowUserList(!showUserList)}
              disabled={isLoading}
            >
              {showUserList ? 'Hide' : 'Show'} User Selection
            </Button>
          </div>

          {usersLoading ? (
            <div className="px-4 py-8 text-center text-gray-500">
              Loading users...
            </div>
          ) : usersError ? (
            <div className="px-4 py-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {usersError}
            </div>
          ) : showUserList ? (
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              {/* Assignment Mode Selector */}
              <div className="mb-4">
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="group"
                      checked={assignmentMode === 'group'}
                      onChange={(e) => setAssignmentMode(e.target.value as 'group')}
                      className="mr-2"
                      disabled={isLoading}
                    />
                    Group Selection
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="individual"
                      checked={assignmentMode === 'individual'}
                      onChange={(e) => setAssignmentMode(e.target.value as 'individual')}
                      className="mr-2"
                      disabled={isLoading}
                    />
                    Individual Selection
                  </label>
                </div>
              </div>

              {/* Group Selection */}
              {assignmentMode === 'group' && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Select Groups:</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <label className="flex items-center p-3 border rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={groupSelections.everyone}
                        onChange={() => handleGroupSelection('everyone')}
                        className="mr-3"
                        disabled={isLoading}
                      />
                      <div>
                        <div className="font-medium">Everyone</div>
                        <div className="text-xs text-gray-500">
                          {userGroups.all.length} users
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={groupSelections.allAdmins}
                        onChange={() => handleGroupSelection('allAdmins')}
                        className="mr-3"
                        disabled={isLoading}
                      />
                      <div>
                        <div className="font-medium">All Admins</div>
                        <div className="text-xs text-gray-500">
                          {userGroups.admins.length} admins
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={groupSelections.allUsers}
                        onChange={() => handleGroupSelection('allUsers')}
                        className="mr-3"
                        disabled={isLoading}
                      />
                      <div>
                        <div className="font-medium">All Users</div>
                        <div className="text-xs text-gray-500">
                          {userGroups.users.length} users
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Individual User Selection */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Individual Users:</h4>
                
                {/* Admins Section */}
                {userGroups.admins.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                      Admins ({userGroups.admins.length})
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      {userGroups.admins.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center p-2 border rounded hover:bg-white cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => handleUserSelection(user.id)}
                            className="mr-3"
                            disabled={isLoading}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {getUserDisplayName(user)}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {user.email}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Regular Users Section */}
                {userGroups.users.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                      Users ({userGroups.users.length})
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      {userGroups.users.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center p-2 border rounded hover:bg-white cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => handleUserSelection(user.id)}
                            className="mr-3"
                            disabled={isLoading}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {getUserDisplayName(user)}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {user.email}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {userGroups.all.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No users available for assignment
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
              {getSelectedCount() > 0 
                ? `${getSelectedCount()} user(s) selected for task assignment`
                : 'Click "Show User Selection" to choose users'
              }
            </div>
          )}
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
        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || selectedUsers.size === 0}>
            {isLoading ? 'Creating Tasks...' : `Create Task${selectedUsers.size > 1 ? 's' : ''} (${selectedUsers.size})`}
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