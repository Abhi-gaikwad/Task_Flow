import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  User,
  AlertTriangle,
  Clock,
  CheckCircle,
  Edit,
  Trash2
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { TaskForm } from './TaskForm';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Task } from '../../types';

export const TaskList: React.FC = () => {
  const { tasks, addNotification, updateTasks, updateTask } = useApp();
  const { user, canAssignTasks } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned_to_me' | 'assigned_by_me'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Sorting state
  const [sortField, setSortField] = useState<keyof Task>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      // For users with task assignment permissions, fetch all tasks
      // For regular users without permissions, fetch only their assigned tasks
      const shouldFetchAllTasks = user?.role === 'admin' || canAssignTasks();
      const endpoint = shouldFetchAllTasks ? '/api/v1/tasks' : '/api/v1/my-tasks';
      
      console.log('Fetching tasks with endpoint:', endpoint, 'for user:', {
        id: user?.id,
        role: user?.role,
        canAssign: canAssignTasks()
      });

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

  const handleStatusChange = async (task: Task, newStatus: Task['status']) => {
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

  // Fixed filtering logic
  const allFilteredTasks = (tasks || []).filter(task => {
    const title = (task.title ?? '').toLowerCase();
    const description = (task.description ?? '').toLowerCase();
    const term = searchTerm.toLowerCase();
    const currentUserId = user?.id?.toString();
    const userCanAssign = canAssignTasks();
    const isAdmin = user?.role === 'admin';

    const matchesSearch = title.includes(term) || description.includes(term);
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    // If user is admin or has task assignment permissions, show all tasks
    // If user is regular user without permissions, show only tasks assigned to them
    const hasViewPermission = isAdmin || userCanAssign || task.assignedTo === currentUserId;

    return matchesSearch && matchesStatus && matchesPriority && hasViewPermission;
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
        return allFilteredTasks;
    }
  })();

  // Sorting logic
  const sortedTasks = [...tasksToDisplay].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    let comparison = 0;
    if (aVal < bVal) comparison = -1;
    else if (aVal > bVal) comparison = 1;
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTasks = sortedTasks.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: keyof Task) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCreateTask = async () => {
    await fetchTasks(); 
    setIsCreateModalOpen(false);
    setAssignmentFilter('assigned_by_me');
  };

  const handleEditTask = (task: Task) => {
    console.log('Edit task:', task);
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
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

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    if (diffDays === 0) return { text: 'Due today', isOverdue: false };
    if (diffDays === 1) return { text: 'Due tomorrow', isOverdue: false };
    if (diffDays <= 7) return { text: `${diffDays}d left`, isOverdue: false };
    return { text: date.toLocaleDateString(), isOverdue: false };
  };

  const getPriorityStyle = (priority: Task['priority']) => {
    const styles = {
      low: 'bg-green-100 text-green-800 border-green-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      urgent: 'bg-red-100 text-red-800 border-red-300',
    };
    return styles[priority];
  };

  const getStatusStyle = (status: Task['status']) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
    };
    return styles[status];
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'in-progress': return <AlertTriangle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
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

  const isCurrentUserAdmin = user?.role === 'admin';
  const userCanAssign = canAssignTasks();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600">
            {isCurrentUserAdmin || userCanAssign ? 'Manage tasks' : 'Your assigned tasks'}
          </p>
        </div>
        {(isCurrentUserAdmin || userCanAssign) && (
          <Button icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
            New Task
          </Button>
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignment</label>
                <select
                  value={assignmentFilter}
                  onChange={(e) => setAssignmentFilter(e.target.value as 'all' | 'assigned_to_me' | 'assigned_by_me')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Tasks ({allFilteredTasks.length})</option>
                  <option value="assigned_to_me">Assigned to Me ({assignedToMeTasks.length})</option>
                  {(isCurrentUserAdmin || userCanAssign) && (
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items per page</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Title</span>
                    {sortField === 'title' && (
                      <span className={`text-blue-500 ${sortDirection === 'desc' ? 'rotate-180' : ''}`}>↑</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('priority')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Priority</span>
                    {sortField === 'priority' && (
                      <span className={`text-blue-500 ${sortDirection === 'desc' ? 'rotate-180' : ''}`}>↑</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {sortField === 'status' && (
                      <span className={`text-blue-500 ${sortDirection === 'desc' ? 'rotate-180' : ''}`}>↑</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assignee
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creator
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Due Date</span>
                    {sortField === 'dueDate' && (
                      <span className={`text-blue-500 ${sortDirection === 'desc' ? 'rotate-180' : ''}`}>↑</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTasks.length > 0 ? (
                paginatedTasks.map((task) => {
                  const dueDateInfo = formatDate(task.dueDate);
                  const isAssignedToMe = user?.id?.toString() === task.assignedTo;
                  const canUpdateStatus = isAssignedToMe;
                  
                  return (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate" title={task.title}>
                          {task.title}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-600 max-w-xs truncate" title={task.description}>
                          {task.description || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityStyle(task.priority)}`}>
                          {task.priority?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(task.status)}
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyle(task.status)}`}>
                            {task.status === 'in-progress' ? 'In Progress' : 
                             task.status === 'pending' ? 'Pending' : 'Completed'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {task.assignee_name || 'Unassigned'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {task.creator_name || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {typeof dueDateInfo === 'object' ? (
                          <div className={`flex items-center space-x-1 text-sm ${dueDateInfo.isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                            {dueDateInfo.isOverdue && <AlertTriangle className="w-4 h-4" />}
                            <Calendar className="w-4 h-4" />
                            <span>{dueDateInfo.text}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-600">{dueDateInfo}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {canUpdateStatus && task.status !== 'completed' && (
                            <>
                              {task.status === 'pending' && (
                                <button
                                  onClick={() => handleStatusChange(task, 'in-progress')}
                                  className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                                  title="Start Task"
                                >
                                  <Clock className="w-4 h-4" />
                                  <span>Start</span>
                                </button>
                              )}
                              {task.status === 'in-progress' && (
                                <button
                                  onClick={() => handleStatusChange(task, 'completed')}
                                  className="text-green-600 hover:text-green-900 flex items-center space-x-1"
                                  title="Complete Task"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Complete</span>
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => handleEditTask(task)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit Task"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {(isCurrentUserAdmin || userCanAssign || task.assignedBy === user?.id?.toString()) && (
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Filter className="w-12 h-12 text-gray-300 mb-4" />
                      <p className="text-lg mb-2">No tasks found</p>
                      <p className="text-sm">
                        {statusFilter !== 'all' || priorityFilter !== 'all' || searchTerm
                          ? 'Try adjusting your filters or search terms'
                          : 'No tasks have been created yet'
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedTasks.length)} of {sortedTasks.length} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        currentPage === pageNumber
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
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