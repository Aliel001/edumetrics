import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Plus, Search, Trash2, Edit2, Loader2, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

export default function Subjects() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSubjects = async () => {
    try {
      const res = await api.get('/subjects');
      setSubjects(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error('Failed to fetch subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingSubject) {
        await api.put(`/subjects/${editingSubject.id}`, { subjectName });
        toast.success('Subject updated');
      } else {
        await api.post('/subjects', { subjectName });
        toast.success('Subject created successfully');
      }
      setSubjectName('');
      setShowModal(false);
      setEditingSubject(null);
      fetchSubjects();
    } catch (error) {
      toast.error(editingSubject ? 'Failed to update subject' : 'Failed to create subject');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (s: any) => {
    setEditingSubject(s);
    setSubjectName(s.subjectName);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/subjects/${id}`);
      setDeletingId(null);
      toast.success('Subject deleted');
      fetchSubjects();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete subject');
    }
  };

  const filteredSubjects = Array.isArray(subjects) ? subjects.filter((s) => 
    (s.subjectName || '').toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manage Subjects</h2>
          <p className="text-slate-500">Configure curriculum subjects</p>
        </div>
        <button 
          onClick={() => {
            setEditingSubject(null);
            setSubjectName('');
            setShowModal(true);
          }} 
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add New Subject
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search subjects..." 
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
                <th className="px-6 py-4">Subject Name</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2" />
                    Loading subjects...
                  </td>
                </tr>
              ) : filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">No subjects found.</td>
                </tr>
              ) : (
                filteredSubjects.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <BookOpen size={16} />
                      </div>
                      <span className="font-semibold text-slate-900">{s.subjectName}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-sm uppercase">
                      {s.subjectName.substring(0, 3)}
                    </td>
                    <td className="px-6 py-4 text-right min-w-[200px]">
                      {deletingId === s.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-rose-600 font-semibold animate-pulse mr-1">Delete subject?</span>
                          <button
                            onClick={() => handleDelete(s.id)}
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
                            onClick={() => handleEdit(s)}
                            className="text-slate-400 hover:text-emerald-600 transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setDeletingId(s.id)}
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
              <h3 className="text-xl font-bold text-slate-900">Add New Subject</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Subject Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Mathematics" 
                  required
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? 'Creating...' : 'Create Subject'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
