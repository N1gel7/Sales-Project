import { http } from './http';

export type LoginResponse = { token: string; user: { id: string; name: string; email: string; role: string; code: string } };

export const api = {
  // auth
  async login(email: string, password: string) {
    return http<LoginResponse>('/api/auth', { method: 'POST', body: { type: 'login', email, password } });
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
  listTasks() {
    return http('/api/tasks');
  },
  createTask(body: any) {
    return http('/api/tasks', { method: 'POST', body });
  },
  updateTaskStatus(id: string, status: string) {
    return http('/api/tasks', { method: 'PATCH', body: { id, status } });
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
};


