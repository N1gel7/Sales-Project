import React, { useState, useEffect } from 'react';
import { axiosInstance } from '../services/http';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  Users as UsersIcon, 
  Plus, 
  UserPlus, 
  ShieldCheck, 
  Mail, 
  Phone,
  Briefcase,
  User 
} from 'lucide-react';

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: string;
  code: string;
  active: boolean;
  avatarUrl?: string;
  createdAt: string;
}

const roleColors = {
  admin: 'bg-red-100 text-red-800 border-red-200',
  manager: 'bg-blue-100 text-blue-800 border-blue-200', 
  sales: 'bg-emerald-100 text-emerald-800 border-emerald-200'
};

const Users = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'sales'
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/api/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await axiosInstance.post('/api/users', formData);
      setUsers([res.data, ...users]);
      setShowAddModal(false);
      setFormData({ name: '', email: '', role: 'sales' });
      toast.success(`User ${res.data?.name ?? ''} created`.trim());
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animation-fade-in pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <UsersIcon className="h-7 w-7 text-indigo-600" />
            User Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage platform access, roles, and onboarding for your team.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Add User
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {users.map(user => (
            <div key={user._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden group">
              <div className="p-6 relative">
                <div className="absolute top-4 right-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${roleColors[user.role as keyof typeof roleColors]}`}>
                    {user.role}
                  </span>
                </div>
                
                <div className="flex items-center flex-col text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300 shadow-inner">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-gray-400" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{user.name}</h3>
                  <div className="flex items-center justify-center gap-1.5 mt-1 text-gray-500 bg-gray-50 px-3 py-1 rounded-lg text-sm font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    ID: {user.code}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-4 w-4 text-indigo-600" />
                    </div>
                    <span className="capitalize">{user.role} Department</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={showAddModal} onOpenChange={setShowAddModal}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-[var(--color-border-tertiary)] pb-4 text-left">
            <SheetTitle className="page-title flex items-center gap-2 text-xl">
              <UserPlus className="h-6 w-6 text-[var(--brand-green)]" />
              New user
            </SheetTitle>
          </SheetHeader>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all text-sm outline-none"
                    placeholder="E.g. John Doe"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all text-sm outline-none"
                    placeholder="john@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">System Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all text-sm outline-none appearance-none"
                  >
                    <option value="sales">Sales Agent</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    A secure initial password will be auto-generated and emailed to the user.
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-sm flex items-center gap-2 disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : 'Create Account'}
                </button>
              </div>
            </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Users;
