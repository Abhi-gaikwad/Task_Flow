// src/components/tasks/TaskList.tsx

import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, ChevronDown, User, UserCheck } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { TaskCard } from './TaskCard';
import { TaskForm } from './TaskForm';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Task } from '../../types';

export const TaskList: React.FC = () => {
  const { tasks, addNotification, updateTasks } = useApp();
  const { user, canAssignTasks } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned_to_me' | 'assigned_by_me'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all tasks for an admin, and only my tasks for a regular user
      const endpoint = user?.role === 'admin' ? '/api/v1/tasks' : '/api/v1/my-tasks';
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const backendTasks = await response.json();
      console.log('Fetched backend tasks:', backendTasks);

      const transformedTasks: Task[] = backendTasks.map((task: any) => ({
        id: task.id.toString(),
        title: task.title,
        description: task.description || '',
        priority: task.priority || ('medium' as Task['priority']),
        status: task.status === 'in_progress' ? 'in-progress' :
          (task.status || 'pending') as 'pending' | 'in-progress' | 'completed',
        assignedTo: task.assigned_to_id?.toString() || '',
        assignedBy: task.created_by?.toString() || '',
        createdAt: task.created_at ? new Date(task.created_at) : new Date(),
        dueDate: task.due_date ? new Date(task.due_date) : new Date(),
        completedAt: task.completed_at ? new Date(task.completed_at) : undefined,
        tags: [],
        assignee_name: task.assignee_name,
        creator_name: task.creator_name
      }));

      console.log('Transformed tasks:', transformedTasks);
      updateTasks(transformedTasks);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      setError(error.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const allFilteredTasks = (tasks || []).filter(task => {
    const title = (task.title ?? '').toLowerCase();
    const description = (task.description ?? '').toLowerCase();
    const term = searchTerm.toLowerCase();
    const isCurrentUserAdmin = user?.role === 'admin';
    const currentUserId = user?.id?.toString();

    const matchesSearch = title.includes(term) || description.includes(term);
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    // Filter logic for non-admin users: only show tasks assigned to them
    if (!isCurrentUserAdmin) {
      return matchesSearch && matchesStatus && matchesPriority && task.assignedTo === currentUserId;
    }
    
    // Admin users see all tasks, with no additional filtering here
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const assignedToMeTasks = allFilteredTasks.filter(task => task.assignedTo === user?.id?.toString());
  const assignedByMeTasks = allFilteredTasks.filter(task => task.assignedBy === user?.id?.toString());
  
  const tasksToDisplay = (() => {
    switch(assignmentFilter) {
      case 'assigned_to_me':
        return assignedToMeTasks;
      case 'assigned_by_me':
        return assignedByMeTasks;
      case 'all':
      default:
        // Combine tasks from both categories, ensuring no duplicates
        const combinedTasks = [...assignedToMeTasks, ...assignedByMeTasks];
        const uniqueTaskIds = new Set(combinedTasks.map(task => task.id));
        return Array.from(uniqueTaskIds).map(id => combinedTasks.find(task => task.id === id)!);
    }
  })();
  
  const handleCreateTask = async () => {
    // Re-fetch tasks after creating to ensure the list is up-to-date
    await fetchTasks(); 
    setIsCreateModalOpen(false);
    // After creating a task, automatically switch to the 'Assigned by Me' filter
    setAssignmentFilter('assigned_by_me');
  };

  const handleEditTask = (task: Task) => {
    console.log('Edit task:', task);
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/tasks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        await fetchTasks();
        addNotification({
          type: 'task_created',
          title: 'Task Deleted',
          message: 'Task has been deleted successfully',
          userId: user?.id || '',
          isRead: false,
        });
      } else {
        throw new Error('Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const getTaskCountsByFilter = () => {
    const isCurrentUserAdmin = user?.role === 'admin';
    const myTasks = isCurrentUserAdmin ? allFilteredTasks : allFilteredTasks.filter(t => t.assignedTo === user?.id?.toString());

    return {
      all: myTasks.length,
      assignedToMe: assignedToMeTasks.length,
      assignedByMe: assignedByMeTasks.length,
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Error: {error}</p>
        <Button onClick={fetchTasks}>Retry</Button>
      </div>
    );
  }

  const taskCounts = getTaskCountsByFilter();
  const isCurrentUserAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600">
            {isCurrentUserAdmin ? 'Manage all tasks' : 'Your assigned tasks'}
          </p>
        </div>
        {(isCurrentUserAdmin || canAssignTasks()) && (
          <Button icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
            New Task
          </Button>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button
            variant="secondary"
            icon={Filter}
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center"
          >
            Filters
            <ChevronDown className={`ml-2 w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignment</label>
                <select
                  value={assignmentFilter}
                  onChange={(e) => setAssignmentFilter(e.target.value as 'all' | 'assigned_to_me' | 'assigned_by_me')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Tasks ({taskCounts.all})</option>
                  <option value="assigned_to_me">Assigned to Me ({assignedToMeTasks.length})</option>
                  {(isCurrentUserAdmin || canAssignTasks()) && (
                    <option value="assigned_by_me">Assigned by Me ({assignedByMeTasks.length})</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">Total Tasks</p>
            <p className="text-2xl font-bold text-blue-700">{tasksToDisplay.length}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-yellow-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-700">
              {tasksToDisplay.filter(t => t.status === 'pending').length}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600">In Progress</p>
            <p className="text-2xl font-bold text-purple-700">
              {tasksToDisplay.filter(t => t.status === 'in-progress').length}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">Completed</p>
            <p className="text-2xl font-bold text-green-700">
              {tasksToDisplay.filter(t => t.status === 'completed').length}
            </p>
          </div>
        </div>

        <div>
          {tasksToDisplay.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tasksToDisplay.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={handleEditTask}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Filter className="w-16 h-16 mx-auto" />
              </div>
              <p className="text-gray-500 text-lg mb-2">No tasks found</p>
              <p className="text-gray-400">
                {statusFilter !== 'all' || priorityFilter !== 'all' || searchTerm
                  ? 'Try adjusting your filters or search terms'
                  : 'No tasks have been assigned to you yet'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Task"
        maxWidth="lg"
      >
        <TaskForm
          onSubmit={handleCreateTask}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </Modal>
    </div>
  );
};