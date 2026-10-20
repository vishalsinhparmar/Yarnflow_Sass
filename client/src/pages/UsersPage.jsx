import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Users, Loader2, X, Check, KeyRound, Smartphone } from 'lucide-react';
import userManagementAPI from '../services/userManagementAPI';
import { useAuth } from '../context/AuthContext';
import { MODULES } from '../services/saasAPI';

const emptyForm = { name: '', username: '', email: '', password: '', role: 'User', mobileAccess: false, permissions: [] };

export default function UsersPage() {
  const { company } = useAuth();
  const permissionModules = MODULES.filter(module => module.key !== 'users' && company?.modules?.includes(module.key));
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [modal, setModal]         = useState(null); // null | 'create' | 'edit' | 'password'
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [pwForm, setPwForm]       = useState({ password: '', confirm: '' });
  const [error, setError]         = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await userManagementAPI.getAll();
      setUsers(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate   = () => { setForm(emptyForm); setEditing(null); setModal('create'); setError(''); };
  const openEdit     = (u) => { setForm({ name: u.name || '', username: u.username || '', email: u.email, password: '', role: u.role, mobileAccess: u.mobileAccess || false, permissions: (u.permissions || []).filter(key => company?.modules?.includes(key)) }); setEditing(u); setModal('edit'); setError(''); };
  const openPassword = (u) => { setPwForm({ password: '', confirm: '' }); setEditing(u); setModal('password'); setError(''); };
  const closeModal   = () => { setModal(null); setEditing(null); setError(''); };

  const handleSave = async () => {
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (modal === 'create' && form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        await userManagementAPI.create(form);
      } else {
        const payload = { name: form.name, username: form.username, email: form.email, role: form.role, mobileAccess: form.mobileAccess, permissions: form.permissions };
        await userManagementAPI.update(editing._id, payload);
      }
      closeModal();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (pwForm.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (pwForm.password !== pwForm.confirm) { setError('Passwords do not match'); return; }
    setSaving(true); setError('');
    try {
      await userManagementAPI.resetPassword(editing._id, pwForm.password);
      closeModal();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (u) => {
    try {
      await userManagementAPI.toggleActive(u._id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await userManagementAPI.remove(id);
      setConfirmDelete(null);
      load();
    } catch (e) {
      setError(e.message);
      setConfirmDelete(null);
    }
  };

  const roleBadge = (role) => role === 'Admin'
    ? 'bg-orange-100 text-orange-700'
    : 'bg-blue-100 text-blue-700';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-500" /> User Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage users, roles, module permissions, and mobile access</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {error && !modal && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No users found. Add the first user.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name / Email', 'Username', 'Role', 'Mobile Access', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u._id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-gray-900">{u.name || '—'}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{u.username || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>{u.role}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    {u.mobileAccess
                      ? <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><Smartphone className="w-3.5 h-3.5" /> Enabled</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => handleToggle(u)} title={u.isActive ? 'Disable account' : 'Enable account'}>
                      {u.isActive
                        ? <ToggleRight className="w-5 h-5 text-green-500" />
                        : <ToggleLeft  className="w-5 h-5 text-gray-400" />}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openPassword(u)} className="p-1.5 rounded-md hover:bg-yellow-50 text-yellow-600 transition-colors" title="Reset Password"><KeyRound className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setConfirmDelete(u)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{modal === 'create' ? 'Add User' : 'Edit User'}</h2>
              <button onClick={closeModal}><X className="w-5 h-5 text-gray-400 hover:text-gray-700" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                    value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                    value={form.username} onChange={e => setForm(p => ({...p, username: e.target.value}))} placeholder="johndoe" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                  value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} placeholder="user@company.com" />
              </div>
              {modal === 'create' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                  <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                    value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} placeholder="Min. 8 characters" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                    value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))}>
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form.mobileAccess} onChange={e => setForm(p => ({...p, mobileAccess: e.target.checked}))} className="rounded w-4 h-4 accent-orange-500" />
                    <span className="flex items-center gap-1"><Smartphone className="w-4 h-4 text-gray-500" /> Mobile Access</span>
                  </label>
                </div>
              </div>
              <fieldset className="border-t pt-4">
                <legend className="text-sm font-semibold text-gray-800">Module permissions</legend>
                <p className="mb-3 text-xs text-gray-500">{form.role === 'Admin' ? 'Admins can access all company-enabled modules and manage users.' : 'Choose the company-enabled modules this user can access.'}</p>
                <div className="grid grid-cols-2 gap-3">
                  {permissionModules.map(module => <label key={module.key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" className="h-4 w-4 accent-orange-500" disabled={form.role === 'Admin'} checked={form.role === 'Admin' || form.permissions.includes(module.key)} onChange={event => setForm(previous => ({ ...previous, permissions: event.target.checked ? [...previous.permissions, module.key] : previous.permissions.filter(key => key !== module.key) }))} />
                    {module.label}
                  </label>)}
                </div>
                {!permissionModules.length && <p className="text-sm text-gray-500">No modules enabled for this company.</p>}
              </fieldset>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {modal === 'create' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {modal === 'password' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Reset Password</h2>
              <button onClick={closeModal}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Resetting password for <strong>{editing?.name || editing?.email}</strong></p>
              {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                  value={pwForm.password} onChange={e => setPwForm(p => ({...p, password: e.target.value}))} placeholder="Min. 8 characters" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password</label>
                <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                  value={pwForm.confirm} onChange={e => setPwForm(p => ({...p, confirm: e.target.value}))} placeholder="Repeat password" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleResetPassword} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete User?</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete <strong>{confirmDelete.name || confirmDelete.email}</strong>? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete._id)} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
