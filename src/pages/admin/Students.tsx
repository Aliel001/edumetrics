import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Plus, Search, Trash2, Edit2, Loader2, GraduationCap } from 'lucide-react';

export default function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ firstname: '', lastname: '', gender: 'Male', classId: '' });
  const [submitting, setSubmitting] = useState(false);

  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const fetchData = async () => {
    try {
      const [studentsRes, classesRes] = await Promise.all([
        api.get('/students'),
        api.get('/classes')
      ]);
      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
      setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
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
    if (!formData.classId) return toast.error('Please select a class');
    setSubmitting(true);
    try {
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, formData);
        toast.success('Student updated');
      } else {
        await api.post('/students', formData);
        toast.success('Student added successfully');
      }
      setFormData({ firstname: '', lastname: '', gender: 'Male', classId: '' });
      setShowModal(false);
      setEditingStudent(null);
      fetchData();
    } catch (error) {
      toast.error(editingStudent ? 'Failed to update student' : 'Failed to add student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (student: any) => {
    setEditingStudent(student);
    setFormData({ 
      firstname: student.firstname, 
      lastname: student.lastname, 
      gender: student.gender, 
      classId: student.classId 
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/students/${id}`);
      setDeletingId(null);
      toast.success('Student deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete student');
    }
  };

  const filteredStudents = Array.isArray(students) ? students.filter(s => {
    const matchesSearch = 
      (s.firstname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.lastname || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = !classFilter || s.classId === classFilter;
    return matchesSearch && matchesClass;
  }) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manage Students</h2>
          <p className="text-slate-500">Register new students and assign to classes</p>
        </div>
        <button 
          onClick={() => {
            setEditingStudent(null);
            setFormData({ firstname: '', lastname: '', gender: 'Male', classId: '' });
            setShowModal(true);
          }} 
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Register Student
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search students..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            />
          </div>
          <select 
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none bg-white font-medium text-slate-600"
          >
            <option value="">All Classes</option>
            {Array.isArray(classes) && classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[650px]">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Gender</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2" />
                    Loading students...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">No students found.</td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-emerald-600 font-bold">
                        {s.firstname.charAt(0)}{s.lastname.charAt(0)}
                      </div>
                      <span className="font-semibold text-slate-900">{s.firstname} {s.lastname}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{s.gender}</td>
                    <td className="px-6 py-4">
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold">{s.class.className}</span>
                    </td>
                    <td className="px-6 py-4 text-right min-w-[200px]">
                      {deletingId === s.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-rose-600 font-semibold animate-pulse mr-1">Delete student?</span>
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
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">{editingStudent ? 'Edit Student' : 'Add New Student'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">First Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    required
                    value={formData.firstname}
                    onChange={(e) => setFormData({...formData, firstname: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Last Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    required
                    value={formData.lastname}
                    onChange={(e) => setFormData({...formData, lastname: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                <select 
                  className="input-field" 
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assign Class</label>
                <select 
                  className="input-field" 
                  required
                  value={formData.classId}
                  onChange={(e) => setFormData({...formData, classId: e.target.value})}
                >
                  <option value="">Select a class</option>
                  {Array.isArray(classes) && classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? (editingStudent ? 'Updating...' : 'Registering...') : (editingStudent ? 'Update Student' : 'Complete Registration')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
