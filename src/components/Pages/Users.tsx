import { useEffect, useState, FormEvent } from 'react';
import { addRecord, deleteRecord, getRecords, updateRecord } from '../../lib/api';
import { Plus, Edit2, Trash2, UserPlus, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

interface ManagedUser {
  id: number | string;
  full_name: string;
  username?: string | null;
  email: string;
  password?: string;
  role: 'superadmin' | 'admin' | 'manager' | 'staff';
  phone?: string;
  photo_url?: string | null;
  created_at?: string;
}

const DEFAULT_FORM: Partial<ManagedUser> = {
  full_name: '',
  username: '',
  email: '',
  password: '',
  role: 'staff',
  phone: '',
};

const normalizePhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits || digits === '62') return '';
  if (digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  return `+62${digits}`;
};

export default function Users() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [formData, setFormData] = useState<Partial<ManagedUser>>(DEFAULT_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
  const { profile } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      if (!silent) {
        setLoading(true);
      }
      const data = await getRecords<ManagedUser>('users');
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useAutoRefresh({
    onRefresh: () => fetchUsers({ silent: true }),
    pause: showModal,
  });

  const openModal = (user?: ManagedUser) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        ...user,
        password: '',
        phone: normalizePhoneInput(user.phone || ''),
        username: user.username || '',
      });
    } else {
      setEditingUser(null);
      setFormData(DEFAULT_FORM);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData(DEFAULT_FORM);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = { ...formData, phone: formData.phone ? normalizePhoneInput(formData.phone) : undefined };
      const creatorContext = { performed_by: profile?.id, creator_role: profile?.role };
      if (editingUser) {
        if (!payload.password) {
          delete payload.password;
        }
        await updateRecord<ManagedUser>('users', editingUser.id, { ...payload, ...creatorContext });
      } else {
        await addRecord<ManagedUser>('users', { ...(payload as ManagedUser), ...creatorContext });
      }
      await fetchUsers();
      closeModal();
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  const handleDelete = async (id: number | string) => {
    const targetUser = users.find((user) => user.id === id);
    if (targetUser?.role === 'superadmin') return;
    if (!confirm('Delete this user?')) return;
    try {
      await deleteRecord('users', id);
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const filteredUsers = users.filter((user) => {
    if (user.role === 'superadmin') return false;
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query) ||
      user.phone?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">
            Superadmins, admins, and managers can add, edit, or remove system users with roles.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add User
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by name, username, email, role, or phone..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-800 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                  Phone
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-900 dark:divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
                    <UserPlus className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                    No users found. Add a team member to begin.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-gray-600 font-semibold dark:bg-slate-700 dark:text-slate-200">
                          {user.photo_url ? (
                            <img src={`${apiRoot}${user.photo_url}`} alt={user.full_name} className="w-full h-full object-cover" />
                          ) : (
                            user.full_name
                              .split(' ')
                              .filter(Boolean)
                              .map((part) => part[0]?.toUpperCase())
                              .slice(0, 2)
                              .join('') || 'U'
                          )}
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-slate-100">{user.full_name}</div>
                        {user.username && (
                          <div className="text-xs text-gray-500 dark:text-slate-400">@{user.username}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-slate-200">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 capitalize dark:bg-blue-500/20 dark:text-blue-200">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-slate-200">{user.phone || '-'}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openModal(user)}
                        className="inline-flex items-center px-3 py-1.5 text-sm bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                      >
                        <Edit2 className="h-4 w-4 mr-1" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={user.role === 'superadmin'}
                        className="inline-flex items-center px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingUser ? 'Edit User' : 'Add User'}
              </h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {!editingUser && (
                <p className="text-sm text-gray-500">
                  Password default akan dikirim ke email user untuk setup awal.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editingUser && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                  {editingUser?.role === 'superadmin' ? (
                    <div className="px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 capitalize">Superadmin</div>
                  ) : (
                    <select
                      value={formData.role || 'staff'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as ManagedUser['role'] })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent capitalize"
                    >
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                  <div className="flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent overflow-hidden">
                    <span className="px-3 py-3 bg-gray-50 text-gray-600 text-sm border-r border-gray-200">+62</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={formData.phone?.replace('+62', '') || ''}
                      onChange={(e) => setFormData({ ...formData, phone: normalizePhoneInput(`+62${e.target.value}`) })}
                      className="w-full px-3 py-3 outline-none"
                      placeholder="81234567890"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Number will be saved with the +62 prefix.</p>
                </div>
              </div>

              {editingUser && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Leave blank to keep current password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
