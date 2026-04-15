import { http, axiosInstance } from './http';

export type LoginResponse = {
  token?: string;
  requiresPasswordChange?: boolean;
  user?: { id: string; name: string; email: string; role?: string; code?: string };
};

export const api = {
  // auth (consolidated into /api/auth?action=...)
  async login(email: string, password: string) {
    return http<LoginResponse>('/api/auth?action=login', { method: 'POST', body: { email, password } });
  },
  async changeInitialPassword(email: string, currentPassword: string, newPassword: string) {
    return http<LoginResponse>('/api/auth?action=change-password', {
      method: 'POST',
      body: { email, currentPassword, newPassword }
    });
  },
  async forgotPassword(email: string) {
    return http<{ message?: string }>('/api/auth?action=forgot-password', { method: 'POST', body: { email } });
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
  // notifications (consolidated into /api/dashboard?view=notifications)
  listNotifications(params?: { unread?: boolean }) {
    const usp = new URLSearchParams(params as any);
    const qs = usp.toString();
    return http(`/api/dashboard?view=notifications${qs ? `&${qs}` : ''}`);
  },
  markNotificationRead(taskId: string, notificationId: string) {
    return http(`/api/dashboard?view=notifications`, { method: 'PATCH', body: { taskId, notificationId } });
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
  // dashboard (consolidated into /api/dashboard?view=...)
  getDashboardStats(params?: { startDate?: string; endDate?: string; userId?: string }) {
    const usp = new URLSearchParams(params as any);
    const qs = usp.toString();
    return http(`/api/dashboard?view=stats${qs ? `&${qs}` : ''}`);
  },
  getDashboardActivity(params?: { limit?: number }) {
    const usp = new URLSearchParams(params as any);
    const qs = usp.toString();
    return http(`/api/dashboard?view=activity${qs ? `&${qs}` : ''}`);
  },
  // billing
  getInvoicePDF(id: string) {
    return axiosInstance.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' });
  },
  sendInvoiceEmail(id: string, body: { to: string; subject?: string; message?: string }) {
    return http(`/api/invoices/${id}/email`, { method: 'POST', body });
  },
  // uploads
  listUploads() {
    return http('/api/general?type=uploads');
  },
  createUpload(formData: FormData) {
    return axiosInstance.post('/api/uploads', formData);
  },
  // chats
  listChats() {
    return http('/api/general?type=chats');
  },
  createChat(body: { name: string; type: string; participants: any[] }) {
    return http('/api/general?type=chats', { method: 'POST', body });
  },
  getChatMessages(chatId: string) {
    return http(`/api/general?type=chat-messages&chatId=${chatId}`);
  },
  sendMessage(chatId: string, body: { content: string; type?: string }) {
    return http(`/api/general?type=chat-messages&chatId=${chatId}`, { method: 'POST', body });
  },
  markChatRead(chatId: string) {
    return http(`/api/general?type=chat-messages&chatId=${chatId}`, { method: 'PUT' });
  },
  // reports
  listReports() {
    return http('/api/general?type=reports');
  },
  createReport(body: any) {
    return http('/api/general?type=reports', { method: 'POST', body });
  },
  addReportAttachment(reportId: string, formData: FormData) {
    return axiosInstance.post(`/api/general?type=report-attachment&reportId=${reportId}`, formData);
  },
  addReportComment(reportId: string, body: { content: string }) {
    return http(`/api/general?type=report-comment&reportId=${reportId}`, { method: 'POST', body });
  },
  likeReport(reportId: string) {
    return http(`/api/general?type=report-like&reportId=${reportId}`, { method: 'POST' });
  },
  // seed data
  seedData() {
    return http('/api/general?type=seed', { method: 'POST' });
  },
  // session management (consolidated into /api/auth?action=sessions)
  getSessions() {
    return http('/api/auth?action=sessions');
  },
  revokeSession(token: string) {
    return http(`/api/auth?action=sessions&token=${token}`, { method: 'DELETE' });
  },
  extendSession(hours?: number) {
    return http('/api/auth?action=sessions', { method: 'POST', body: { hours } });
  },
  logoutAll() {
    return http('/api/general?type=logout-all', { method: 'POST' });
  },
};
