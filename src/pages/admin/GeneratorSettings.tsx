import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { 
  Settings, 
  Save, 
  Loader2, 
  ArrowLeft,
  Clock,
  Coffee,
  Utensils,
  LayoutGrid
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function GeneratorSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    periodsPerDay: 8,
    breakStartTime: '10:30',
    breakDuration: 30,
    lunchStartTime: '13:00',
    lunchDuration: 60
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/generator-settings');
      setSettings(res.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/generator-settings', settings);
      toast.success('Generator settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Timetable</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Generator Configuration</h1>
            <p className="text-sm text-slate-500">Fine-tune the auto-generation algorithms</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <LayoutGrid className="text-emerald-600" size={20} />
            <h3 className="font-bold text-slate-800">Layout Parameters</h3>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Periods Per Day</label>
            <input 
              type="number"
              className="input-field"
              value={settings.periodsPerDay}
              onChange={(e) => setSettings({...settings, periodsPerDay: parseInt(e.target.value)})}
              min="1"
              max="15"
              required
            />
            <p className="text-xs text-slate-400 mt-2">Maximum number of instructional periods available in a single working day.</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <Coffee className="text-orange-500" size={20} />
            <h3 className="font-bold text-slate-800">Short Break</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Time</label>
              <input 
                type="time"
                className="input-field"
                value={settings.breakStartTime}
                onChange={(e) => setSettings({...settings, breakStartTime: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Duration (min)</label>
              <input 
                type="number"
                className="input-field"
                value={settings.breakDuration}
                onChange={(e) => setSettings({...settings, breakDuration: parseInt(e.target.value)})}
                required
              />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <Utensils className="text-emerald-500" size={20} />
            <h3 className="font-bold text-slate-800">Lunch Break</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Time</label>
              <input 
                type="time"
                className="input-field"
                value={settings.lunchStartTime}
                onChange={(e) => setSettings({...settings, lunchStartTime: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Duration (min)</label>
              <input 
                type="number"
                className="input-field"
                value={settings.lunchDuration}
                onChange={(e) => setSettings({...settings, lunchDuration: parseInt(e.target.value)})}
                required
              />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#0F172A] p-8 rounded-3xl text-white shadow-xl flex flex-col justify-center items-center text-center space-y-4"
        >
          <div className="p-4 bg-emerald-600/20 rounded-full">
            <Save className="text-emerald-400" size={32} />
          </div>
          <h3 className="text-xl font-bold">Ready to Save?</h3>
          <p className="text-slate-400 text-sm">Changes will be applied to future auto-generation processes.</p>
          <button 
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            SAVE CONFIGURATION
          </button>
        </motion.div>
      </form>
    </div>
  );
}
