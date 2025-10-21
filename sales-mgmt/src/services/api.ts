import { http } from './http';

export type LoginResponse = { token: string; user: { id: string; name: string; email: string; role: string; code: string } };

export const api = {
  // auth
  async login(email: string, password: string) {
    return http<LoginResponse>('/api/login', { method: 'POST', body: { email, password } });
  },
  async signup(name: string, email: string, password: string, role?: string, code?: string) {
    return http<LoginResponse>('/api/signup', { method: 'POST', body: { name, email, password, role, code } });
  },
  // products
  listProducts(params?: { q?: string; category?: string }) {
    const usp = new URLSearchParams(params as any);
    const qs = usp.toString();
    return http(`/api/products${qs ? `?${qs}` : ''}`);
  },
  createProduct(body: any) {
    return http('/api/products', { method: 'POST', body });
  },
  updateProduct(id: string, body: any) {
    return http(`/api/products/${id}`, { method: 'PATCH', body });
  },
  deleteProduct(id: string) {
    return http(`/api/products/${id}`, { method: 'DELETE' });
  },
  // tasks
  listTasks(params?: { status?: string; assignee?: string; priority?: string; category?: string }) {
    const usp = new URLSearchParams(params as any);
    const qs = usp.toString();
    return http(`/api/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask(body: any) {
    return http('/api/tasks', { method: 'POST', body });
  },
  updateTask(id: string, body: any) {
    return http(`/api/tasks/${id}`, { method: 'PATCH', body });
  },
  updateTaskStatus(id: string, status: string) {
    return http(`/api/tasks/${id}`, { method: 'PATCH', body: { status } });
  },
  deleteTask(id: string) {
    return http(`/api/tasks/${id}`, { method: 'DELETE' });
  },
  addTaskComment(id: string, text: string) {
    return http(`/api/tasks/${id}/comments`, { method: 'POST', body: { text } });
  },
  // notifications
  listNotifications(params?: { unread?: boolean }) {
    const usp = new URLSearchParams(params as any);
    const qs = usp.toString();
    return http(`/api/notifications${qs ? `?${qs}` : ''}`);
  },
  markNotificationRead(taskId: string, notificationId: string) {
    return http(`/api/notifications/${taskId}/${notificationId}`, { method: 'PATCH' });
  },
  // invoices
  listInvoices() {
    return http('/api/invoices');
  },
  createInvoice(body: any) {
    return http('/api/invoices', { method: 'POST', body });
  },
  // categories
  listCategories() {
    return http('/api/categories');
  },
  createCategory(body: any) {
    return http('/api/categories', { method: 'POST', body });
  },
  updateCategory(id: string, body: any) {
    return http(`/api/categories/${id}`, { method: 'PATCH', body });
  },
  deleteCategory(id: string) {
    return http(`/api/categories/${id}`, { method: 'DELETE' });
  },
  // users
  listUsers() {
    return http('/api/users');
  },
  // dashboard
  getDashboardStats(params?: { startDate?: string; endDate?: string; userId?: string }) {
    const usp = new URLSearchParams(params as any);
    const qs = usp.toString();
    return http(`/api/dashboard/stats${qs ? `?${qs}` : ''}`);
  },
  getDashboardActivity(params?: { limit?: number }) {
    const usp = new URLSearchParams(params as any);
    const qs = usp.toString();
    return http(`/api/dashboard/activity${qs ? `?${qs}` : ''}`);
  },
  // billing
  getInvoicePDF(id: string) {
    return fetch(`/api/invoices/${id}/pdf`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
    });
  },
  sendInvoiceEmail(id: string, body: { to: string; subject?: string; message?: string }) {
    return http(`/api/invoices/${id}/email`, { method: 'POST', body });
  },
  // uploads
  listUploads() {
    return http('/api/uploads');
  },
  createUpload(formData: FormData) {
    return fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
      body: formData
    });
  },
  // chats
  listChats() {
    return http('/api/chats');
  },
  createChat(body: { name: string; type: string; participants: any[] }) {
    return http('/api/chats', { method: 'POST', body });
  },
  getChatMessages(chatId: string) {
    return http(`/api/chats/${chatId}/messages`);
  },
  sendMessage(chatId: string, body: { content: string; type?: string }) {
    return http(`/api/chats/${chatId}/messages`, { method: 'POST', body });
  },
  markChatRead(chatId: string) {
    return http(`/api/chats/${chatId}/read`, { method: 'PUT' });
  },
  // reports
  listReports() {
    return http('/api/reports');
  },
  createReport(body: any) {
    return http('/api/reports', { method: 'POST', body });
  },
  addReportAttachment(reportId: string, formData: FormData) {
    return fetch(`/api/reports/${reportId}/attachments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
      body: formData
    });
  },
  addReportComment(reportId: string, body: { content: string }) {
    return http(`/api/reports/${reportId}/comments`, { method: 'POST', body });
  },
  likeReport(reportId: string) {
    return http(`/api/reports/${reportId}/like`, { method: 'POST' });
  },
  // seed data
  seedData() {
    return http('/api/seed', { method: 'POST' });
  },
};


