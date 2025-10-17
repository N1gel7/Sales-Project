import React, { useEffect, useState } from 'react';
import { Bell, Plus, Search, Calendar, MapPin, User, Clock } from 'lucide-react';

type Task = {
  _id: string;
  title: string;
  description?: string;
  assignee: { id: string; name: string; code: string; email: string };
  createdBy: { id: string; name: string; code: string; email: string };
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  dueAt?: string;
  location?: { name?: string; coords?: { lat: number; lng: number } };
  comments: Array<{ text: string; author: { name: string; code: string }; createdAt: string }>;
  notifications: Array<{ type: string; message: string; read: boolean; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
};

type User = {
  _id: string;
  name: string;
  code: string;
  email: string;
  role: string;
};

export default function Tasks(): React.ReactElement {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Task creation form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeId: '',
    dueAt: '',
    priority: 'medium',
    category: 'general',
    location: { name: '', coords: null as { lat: number; lng: number } | null }
  });
  
  // Task details modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState('');

  async function loadTasks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (assigneeFilter) params.append('assignee', assigneeFilter);
      
      const response = await fetch(`/api/tasks?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  async function loadNotifications() {
    try {
      const response = await fetch('/api/notifications?unread=true', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  useEffect(() => {
    loadTasks();
    loadUsers();
    loadNotifications();
  }, [statusFilter, priorityFilter, assigneeFilter]);

  async function createTask() {
    if (!newTask.title || !newTask.assigneeId) {
      alert('Please fill in title and assignee');
      return;
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(newTask)
      });

      if (response.ok) {
        setNewTask({
          title: '',
          description: '',
          assigneeId: '',
          dueAt: '',
          priority: 'medium',
          category: 'general',
          location: { name: '', coords: null }
        });
        setShowCreateForm(false);
        await loadTasks();
        await loadNotifications();
        alert('Task created successfully!');
      } else {
        const error = await response.json();
        alert('Error creating task: ' + error.error);
      }
    } catch (error) {
      alert('Error creating task: ' + error);
    }
  }

  async function updateTaskStatus(taskId: string, status: string) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        await loadTasks();
        await loadNotifications();
      } else {
        const error = await response.json();
        alert('Error updating task: ' + error.error);
      }
    } catch (error) {
      alert('Error updating task: ' + error);
    }
  }

  async function addComment(taskId: string) {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ text: newComment })
      });

      if (response.ok) {
        setNewComment('');
        await loadTasks();
        if (selectedTask) {
          const updatedTask = await fetch(`/api/tasks/${taskId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          }).then(r => r.json());
          setSelectedTask(updatedTask);
        }
      }
    } catch (error) {
      alert('Error adding comment: ' + error);
    }
  }

  function captureLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setNewTask(prev => ({
            ...prev,
            location: {
              name: 'Current Location',
              coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }
            }
          }));
        },
        () => alert('Location capture failed')
      );
    }
  }

  function getStatusColor(status: string) {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  }

  function getPriorityColor(priority: string) {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  }

  const filteredTasks = tasks.filter(task => {
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header with notifications */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Task Management</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Bell className="h-6 w-6 text-gray-600" />
            {notifications.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 h-9 border border-gray-200 rounded-md px-3 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 border border-gray-200 rounded-md px-3 text-sm"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 border border-gray-200 rounded-md px-3 text-sm"
            >
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="h-9 border border-gray-200 rounded-md px-3 text-sm"
            >
              <option value="">All Assignees</option>
              {users.map(user => (
                <option key={user._id} value={user._id}>{user.name} ({user.code})</option>
              ))}
            </select>
            <button
              onClick={() => {
                setStatusFilter('');
                setPriorityFilter('');
                setAssigneeFilter('');
                setSearchTerm('');
              }}
              className="h-9 px-3 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>Tasks ({filteredTasks.length})</div>
          {loading && <div className="text-sm text-gray-500">Loading...</div>}
        </div>
        <div className="card-body">
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div key={task._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{task.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {task.assignee.name} ({task.assignee.code})
                      </div>
                      {task.dueAt && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.dueAt).toLocaleDateString()}
                        </div>
                      )}
                      {task.location?.name && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {task.location.name}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(task.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {task.comments.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        {task.comments.length} comment{task.comments.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="h-8 px-3 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
                    >
                      View
                    </button>
                    {task.status === 'pending' && (
                      <button
                        onClick={() => updateTaskStatus(task._id, 'in_progress')}
                        className="h-8 px-3 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                      >
                        Start
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => updateTaskStatus(task._id, 'completed')}
                        className="h-8 px-3 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredTasks.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                No tasks found. {searchTerm || statusFilter || priorityFilter || assigneeFilter ? 'Try adjusting your filters.' : 'Create a new task to get started.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">Create New Task</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm"
              />
              <textarea
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                className="w-full h-20 border border-gray-200 rounded-md px-3 py-2 text-sm resize-none"
              />
              <select
                value={newTask.assigneeId}
                onChange={(e) => setNewTask(prev => ({ ...prev, assigneeId: e.target.value }))}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm"
              >
                <option value="">Select assignee</option>
                {users.map(user => (
                  <option key={user._id} value={user._id}>{user.name} ({user.code})</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="datetime-local"
                  value={newTask.dueAt}
                  onChange={(e) => setNewTask(prev => ({ ...prev, dueAt: e.target.value }))}
                  className="h-10 border border-gray-200 rounded-md px-3 text-sm"
                />
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                  className="h-10 border border-gray-200 rounded-md px-3 text-sm"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Category"
                value={newTask.category}
                onChange={(e) => setNewTask(prev => ({ ...prev, category: e.target.value }))}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={captureLocation}
                  className="flex items-center gap-2 h-9 px-3 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
                >
                  <MapPin className="h-4 w-4" />
                  Capture Location
                </button>
                {newTask.location?.coords && (
                  <span className="text-xs text-green-600">
                    📍 {newTask.location.coords.lat.toFixed(4)}, {newTask.location.coords.lng.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="h-9 px-4 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createTask}
                className="h-9 px-4 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold">{selectedTask.title}</h2>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTask.status)}`}>
                    {selectedTask.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Priority:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedTask.priority)}`}>
                    {selectedTask.priority}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Assignee:</span>
                  <span className="ml-2">{selectedTask.assignee.name} ({selectedTask.assignee.code})</span>
                </div>
                <div>
                  <span className="font-medium">Created by:</span>
                  <span className="ml-2">{selectedTask.createdBy.name} ({selectedTask.createdBy.code})</span>
                </div>
                {selectedTask.dueAt && (
                  <div>
                    <span className="font-medium">Due date:</span>
                    <span className="ml-2">{new Date(selectedTask.dueAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedTask.location?.name && (
                  <div>
                    <span className="font-medium">Location:</span>
                    <span className="ml-2">{selectedTask.location.name}</span>
                  </div>
                )}
              </div>

              {selectedTask.description && (
                <div>
                  <span className="font-medium">Description:</span>
                  <p className="mt-1 text-sm text-gray-600">{selectedTask.description}</p>
                </div>
              )}

              {/* Comments */}
              <div>
                <h3 className="font-medium mb-2">Comments</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedTask.comments.map((comment, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{comment.author.name}</span>
                        <span className="text-xs text-gray-500">{comment.author.code}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{comment.text}</p>
                    </div>
                  ))}
                  {selectedTask.comments.length === 0 && (
                    <p className="text-sm text-gray-500">No comments yet</p>
                  )}
                </div>
                
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1 h-9 border border-gray-200 rounded-md px-3 text-sm"
                  />
                  <button
                    onClick={() => addComment(selectedTask._id)}
                    className="h-9 px-3 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}