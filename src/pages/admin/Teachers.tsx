import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Plus, Search, Trash2, Edit2, Loader2, UserCircle, Shield, GraduationCap } from 'lucide-react';

export default function Teachers() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ fullname: '', email: '', password: '', role: 'teacher' });
  const [submitting, setSubmitting] = useState(false);

  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTeachers = async () => {
    try {
      const res = await api.get('/teachers');
      setTeachers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error('Failed to fetch staff members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingTeacher) {
        await api.put(`/teachers/${editingTeacher.id}`, formData);
        toast.success('Staff account updated');
      } else {
        const res = await api.post('/teachers', formData);
        if (res.data.emailSent) {
          toast.success(`${formData.role === 'dos' ? 'DOS' : 'Teacher'} account created & invitation sent!`);
          if (res.data.previewUrl) {
            console.log(`✉️ Ethereal sandbox real email link: ${res.data.previewUrl}`);
            toast((t) => (
              <span className="text-sm flex flex-col gap-1 text-left">
                <span className="font-semibold text-blue-900">✉️ Real Invitation Link Generated</span>
                <span className="text-xs text-gray-550">Click below to view the actual email sent to the teacher:</span>
                <a
                  href={res.data.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-blue-600 underline hover:text-blue-800 mt-1"
                >
                  Open Sandbox Delivered Email ↗
                </a>
              </span>
            ), { duration: 12000, id: 'email-preview-toast' });
          }
        } else {
          toast.success(`${formData.role === 'dos' ? 'DOS' : 'Teacher'} account created, SMTP email dispatch skipped.`);
        }
      }
      setFormData({ fullname: '', email: '', password: '', role: 'teacher' });
      setShowModal(false);
      setEditingTeacher(null);
      fetchTeachers();
    } catch (error: any) {
      const serverMessage = error.response?.data?.message;
      if (editingTeacher) {
        toast.error(serverMessage || 'Failed to update account');
      } else {
        toast.error(serverMessage || 'Failed to create staff account');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (teacher: any) => {
    setEditingTeacher(teacher);
    setFormData({ fullname: teacher.fullname, email: teacher.email, password: '', role: teacher.role || 'teacher' });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/teachers/${id}`);
      setDeletingId(null);
      toast.success('Staff deleted successfully');
      fetchTeachers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete staff member');
    }
  };

  const filteredTeachers = Array.isArray(teachers) ? teachers.filter((t) => 
    (t.fullname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Management</h2>
          <p className="text-slate-500 text-sm">Create and configure accounts for Teachers and Director of Studies (DOS)</p>
        </div>
        <button 
          onClick={() => {
            setEditingTeacher(null);
            setFormData({ fullname: '', email: '', password: '', role: 'teacher' });
            setShowModal(true);
          }} 
          className="btn btn-primary flex items-center gap-2 cursor-pointer"
        >
          <Plus size={20} />
          Add New Staff
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-50 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search staff members..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-700 focus:border-logo-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Email Address</th>
                <th className="px-6 py-4">System Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2 text-logo-600" />
                    Loading system staff accounts...
                  </td>
                </tr>
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No teaching staff accounts configured yet.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="h-10 w-10 bg-logo-50 rounded-full flex items-center justify-center text-logo-700 font-bold border border-logo-100">
                        {t.fullname.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900">{t.fullname}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{t.email}</td>
                    <td className="px-6 py-4">
                      {t.role === 'dos' ? (
                        <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border border-amber-200/50">
                          <Shield size={12} />
                          Directors of Studies (DOS)
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border border-emerald-200/50">
                          <GraduationCap size={12} />
                          Teacher
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Active</span>
                    </td>
                    <td className="px-6 py-4 text-right min-w-[200px]">
                      {deletingId === t.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-rose-600 font-semibold animate-pulse mr-1">Delete?</span>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap inline-flex items-center"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap inline-flex items-center"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="space-x-2 flex items-center justify-end">
                          <button 
                            onClick={() => handleEdit(t)}
                            className="text-slate-400 hover:text-logo-600 transition-colors p-1"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setDeletingId(t.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">
                {editingTeacher ? 'Edit Staff Account' : 'Add New Staff'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">System Role</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  <option value="teacher">Teacher</option>
                  <option value="dos">Director of Studies (DOS)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Full Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400" 
                  placeholder="e.g. John Doe" 
                  required
                  value={formData.fullname}
                  onChange={(e) => setFormData({...formData, fullname: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Email Address</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400" 
                  placeholder="name@edumetric.com" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {editingTeacher ? 'New Password (Optional)' : 'Password'}
                </label>
                <input 
                  type="password" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400" 
                  placeholder="••••••••" 
                  required={!editingTeacher}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? 'Saving...' : (editingTeacher ? 'Save Changes' : 'Create Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
