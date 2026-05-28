import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Trash2, 
  Edit2,
  Loader2, 
  Clock, 
  Coffee, 
  Utensils, 
  BookOpen,
  Calendar
} from 'lucide-react';
import { motion } from 'motion/react';

export default function TimeSlots() {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ startTime: '08:00', endTime: '08:40', slotType: 'class' });
  const [submitting, setSubmitting] = useState(false);

  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    try {
      const res = await api.get('/time-slots');
      setSlots(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error('Failed to fetch time slots');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingSlot) {
        await api.put(`/time-slots/${editingSlot.id}`, formData);
        toast.success('Time slot updated');
      } else {
        await api.post('/time-slots', formData);
        toast.success('Time slot created');
      }
      setShowModal(false);
      setEditingSlot(null);
      fetchSlots();
    } catch (error) {
      toast.error(editingSlot ? 'Failed to update slot' : 'Failed to create time slot');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (slot: any) => {
    setEditingSlot(slot);
    setFormData({ startTime: slot.startTime, endTime: slot.endTime, slotType: slot.slotType });
    setShowModal(true);
  };

  const deleteSlot = async (id: string) => {
    try {
      await api.delete(`/time-slots/${id}`);
      setDeletingId(null);
      fetchSlots();
      toast.success('Slot removed');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const getSlotIcon = (type: string) => {
    switch(type) {
      case 'break': return <Coffee size={16} className="text-amber-500" />;
      case 'lunch': return <Utensils size={16} className="text-rose-500" />;
      default: return <BookOpen size={16} className="text-emerald-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-600 p-3 rounded-xl text-white shadow-lg shadow-emerald-200">
            <Clock size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Academic Time Slots</h2>
            <p className="text-slate-500 text-sm">Define your school's daily schedule structure</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setEditingSlot(null);
            setFormData({ startTime: '08:00', endTime: '08:40', slotType: 'class' });
            setShowModal(true);
          }} 
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add New Slot
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Time Duration</th>
                <th className="px-6 py-4">Slot Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-emerald-600 w-8 h-8" />
                  </td>
                </tr>
              ) : (Array.isArray(slots) && slots.length === 0) ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No time slots defined yet.
                  </td>
                </tr>
              ) : (
                Array.isArray(slots) && slots.map((slot) => (
                  <tr key={slot.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                            <Calendar size={14} />
                         </div>
                         <span className="font-bold text-slate-900">{slot.startTime} — {slot.endTime}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getSlotIcon(slot.slotType)}
                        <span className="capitalize font-medium text-slate-700">{slot.slotType}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        slot.slotType === 'class' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {slot.slotType === 'class' ? 'Instruction' : 'Break'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right min-w-[200px]">
                      {deletingId === slot.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-rose-600 font-semibold animate-pulse mr-1">Delete this slot?</span>
                          <button
                            onClick={() => deleteSlot(slot.id)}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="space-x-2">
                          <button 
                            onClick={() => handleEdit(slot)}
                            className="text-slate-400 hover:text-emerald-600 transition-all p-2 hover:bg-emerald-50 rounded-lg cursor-pointer inline-flex items-center"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setDeletingId(slot.id)}
                            className="text-slate-400 hover:text-rose-600 transition-all p-2 hover:bg-rose-50 rounded-lg cursor-pointer inline-flex items-center"
                            title="Delete"
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{editingSlot ? 'Edit Time Slot' : 'Define Time Slot'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Time</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    required 
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">End Time</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    required 
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Slot Type</label>
                <select 
                  className="input-field" 
                  value={formData.slotType}
                  onChange={(e) => setFormData({...formData, slotType: e.target.value})}
                >
                  <option value="class">Instructional (Class)</option>
                  <option value="break">Short Break</option>
                  <option value="lunch">Lunch Break</option>
                </select>
              </div>
              <div className="flex gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowModal(false);
                    setEditingSlot(null);
                  }} 
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="btn btn-primary flex-1 shadow-lg shadow-emerald-200"
                >
                  {submitting ? (editingSlot ? 'Updating...' : 'Creating...') : (editingSlot ? 'Update Slot' : 'Create Slot')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
