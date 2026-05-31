import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Plus, Search, Trash2, Edit2, Loader2, Link2 } from 'lucide-react';

export default function Assignments() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ teacherId: '', classId: '', subjectId: '', periodsPerWeek: 5 });
  const [submitting, setSubmitting] = useState(false);

  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [assignRes, teachRes, classRes, subRes] = await Promise.all([
        api.get('/assignments'),
        api.get('/teachers'),
        api.get('/classes'),
        api.get('/subjects')
      ]);
      setAssignments(Array.isArray(assignRes.data) ? assignRes.data : []);
      setTeachers(Array.isArray(teachRes.data) ? teachRes.data : []);
      setClasses(Array.isArray(classRes.data) ? classRes.data : []);
      setSubjects(Array.isArray(subRes.data) ? subRes.data : []);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.teacherId || !formData.classId || !formData.subjectId) {
      return toast.error('Please fill all fields');
    }

    // Client-side Duplicate & Conflict Validation
    const duplicateCombo = Array.isArray(assignments) && assignments.find(a => 
      a.teacherId === formData.teacherId &&
      a.classId === formData.classId &&
      a.subjectId === formData.subjectId &&
      (!editingAssignment || a.id !== editingAssignment.id)
    );
    if (duplicateCombo) {
      toast.error('This teacher is already assigned to this class and subject.');
      return;
    }

    // A teacher can teach multiple classes and multiple subjects. We only prevent duplicating the exact same teacher-class-subject link.

    setSubmitting(true);
    try {
      if (editingAssignment) {
        await api.put(`/assignments/${editingAssignment.id}`, formData);
        toast.success('Assignment updated');
      } else {
        await api.post('/assignments', formData);
        toast.success('Assignment created');
      }
      setFormData({ teacherId: '', classId: '', subjectId: '', periodsPerWeek: 5 });
      setShowModal(false);
      setEditingAssignment(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (a: any) => {
    setEditingAssignment(a);
    setFormData({ 
      teacherId: a.teacherId, 
      classId: a.classId, 
      subjectId: a.subjectId, 
      periodsPerWeek: a.periodsPerWeek 
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/assignments/${id}`);
      setDeletingId(null);
      toast.success('Assignment deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete assignment');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manage Assignments</h2>
          <p className="text-slate-500">Link teachers to classes and subjects</p>
        </div>
        <button 
          onClick={() => {
            setEditingAssignment(null);
            setFormData({ teacherId: '', classId: '', subjectId: '', periodsPerWeek: 5 });
            setShowModal(true);
          }} 
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Create Assignment
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Teacher</th>
                <th className="px-6 py-4 text-center">Class</th>
                <th className="px-6 py-4 text-center">Subject</th>
                <th className="px-6 py-4 text-center">Periods/Week</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2" />
                    Loading assignments...
                  </td>
                </tr>
              ) : (Array.isArray(assignments) && assignments.length === 0) ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No assignments found.</td>
                </tr>
              ) : (
                Array.isArray(assignments) && assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{a.teacher.fullname}</td>
                    <td className="px-6 py-4 text-center text-slate-600 font-bold">{a.class.className}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                        {a.subject.subjectName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">
                      {a.periodsPerWeek}
                    </td>
                    <td className="px-6 py-4 text-right min-w-[200px]">
                      {deletingId === a.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-rose-600 font-semibold animate-pulse mr-1">Delete assignment?</span>
                          <button
                            onClick={() => handleDelete(a.id)}
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
                            onClick={() => handleEdit(a)}
                            className="text-slate-400 hover:text-emerald-600 transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setDeletingId(a.id)}
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
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2">
              <Link2 size={24} className="text-emerald-600" />
              <h3 className="text-xl font-bold text-slate-900">{editingAssignment ? 'Edit Assignment' : 'New Assignment'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Teacher</label>
                <select 
                  className="input-field" 
                  value={formData.teacherId}
                  onChange={(e) => setFormData({...formData, teacherId: e.target.value})}
                >
                  <option value="">Choose a teacher</option>
                  {Array.isArray(teachers) && teachers.map(t => <option key={t.id} value={t.id}>{t.fullname}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Class</label>
                <select 
                  className="input-field" 
                  value={formData.classId}
                  onChange={(e) => setFormData({...formData, classId: e.target.value})}
                >
                  <option value="">Choose a class</option>
                  {Array.isArray(classes) && classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Subject</label>
                <select 
                  className="input-field" 
                  value={formData.subjectId}
                  onChange={(e) => setFormData({...formData, subjectId: e.target.value})}
                >
                  <option value="">Choose a subject</option>
                  {Array.isArray(subjects) && subjects.map(s => <option key={s.id} value={s.id}>{s.subjectName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Periods Per Week</label>
                <input 
                  type="number"
                  min="1"
                  max="40"
                  className="input-field"
                  value={formData.periodsPerWeek}
                  onChange={(e) => setFormData({...formData, periodsPerWeek: parseInt(e.target.value)})}
                />
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? (editingAssignment ? 'Updating...' : 'Linking...') : (editingAssignment ? 'Update Assignment' : 'Assign Teacher')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
