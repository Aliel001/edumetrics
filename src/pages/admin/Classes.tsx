import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Plus, Search, Trash2, Edit2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function Classes() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [className, setClassName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingClass, setEditingClass] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchClasses = async () => {
    try {
      const res = await api.get('/classes');
      setClasses(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error('Failed to fetch classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingClass) {
        await api.put(`/classes/${editingClass.id}`, { className });
        toast.success('Class updated');
      } else {
        await api.post('/classes', { className });
        toast.success('Class created successfully');
      }
      setClassName('');
      setShowModal(false);
      setEditingClass(null);
      fetchClasses();
    } catch (error) {
      toast.error(editingClass ? 'Failed to update class' : 'Failed to create class');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (c: any) => {
    setEditingClass(c);
    setClassName(c.className);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/classes/${id}`);
      setDeletingId(null);
      toast.success('Class deleted');
      fetchClasses();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete class');
    }
  };

  const filteredClasses = Array.isArray(classes) ? classes.filter((c) => 
    (c.className || '').toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manage Classes</h2>
          <p className="text-slate-500">Add and manage school classes</p>
        </div>
        <button 
          onClick={() => {
            setEditingClass(null);
            setClassName('');
            setShowModal(true);
          }} 
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add New Class
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search classes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[550px]">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Class Name</th>
                <th className="px-6 py-4 text-center">Students</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2" />
                    Loading classes...
                  </td>
                </tr>
              ) : filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">No classes found.</td>
                </tr>
              ) : (
                filteredClasses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{c.className}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold">
                        {c._count?.students || 0} Students
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right min-w-[200px]">
                      {deletingId === c.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-rose-600 font-semibold animate-pulse mr-1">Delete class?</span>
                          <button
                            onClick={() => handleDelete(c.id)}
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
                            onClick={() => handleEdit(c)}
                            className="text-slate-400 hover:text-emerald-600 transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setDeletingId(c.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
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
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Add New Class</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Class Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. S1A" 
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
