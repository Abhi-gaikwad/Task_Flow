import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Modal } from '../common/Modal';
import { TaskForm } from '../tasks/TaskForm';
import { useApp } from '../../contexts/AppContext';
import { Outlet } from 'react-router-dom';


export const AppLayout: React.FC = () => {
  // Hooks for application state and actions
  const { addTask, addNotification } = useApp();
  
  // State for the "Create New Task" modal
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  // Handler to open the modal
  const handleNewTask = () => {
    setIsCreateTaskModalOpen(true);
  };

  // Handler for form submission
  const handleCreateTask = async (taskData: Parameters<typeof addTask>[0]) => {
    try {
      // Call the addTask function from the context
      await addTask(taskData);
      
      // Optionally, show a success notification
      addNotification({
        type: 'task_created',
        title: 'Task Created Successfully',
        message: `The task "${taskData.title}" has been assigned.`,
        userId: taskData.assignedTo,
        taskId: '', // The API call should return the new task ID
        isRead: false,
      });

      // Close the modal on success
      setIsCreateTaskModalOpen(false);
    } catch (error) {
      console.error("Failed to create task:", error);
      // Optionally, show an error notification
      addNotification({
        type: 'error',
        title: 'Creation Failed',
        message: 'There was an error creating the task.',
        userId: '',
        isRead: false,
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      {/* Sidebar for navigation */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with user info and actions */}
        <Header onNewTask={handleNewTask} />
        {/* The main content for the current route will be rendered here */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <Outlet />
        </main>
      </div>

      {/* Modal for creating a new task */}
      <Modal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        title="Create a New Task"
        maxWidth="xl"
      >
        <TaskForm
          onSubmit={handleCreateTask}
          onClose={() => setIsCreateTaskModalOpen(false)}
        />
      </Modal>
    </div>
  );
};
