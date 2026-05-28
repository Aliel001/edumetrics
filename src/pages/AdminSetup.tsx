import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Loader2, ShieldCheck, User, Mail, Lock, Building } from 'lucide-react';
import api from '../lib/api';

export default function AdminSetup() {
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    password: '',
    schoolName: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Setup the first admin
      await api.post('/auth/setup-admin', formData);
      toast.success('Admin Account Configured Successfully! Please log in now.', { id: 'admin-setup-success' });
      
      // Delay to allow database sync & toast rendering
      setTimeout(() => {
        navigate('/login');
      }, 1000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error occurred during initial setup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F172A] flex flex-col items-center justify-center z-50 overflow-y-auto px-4 py-8">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-logo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden z-10 p-8 relative">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-4 bg-logo-50 rounded-2xl text-logo-600 mb-4 ring-8 ring-logo-500/5">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight">First-Time Setup</h1>
          <p className="text-slate-500 text-sm mt-2 max-w-sm">
            Configure the primary System Administrator account to start securing and managing your school metrics.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400" 
                placeholder="e.g. Principal Admin" 
                required
                value={formData.fullname}
                onChange={(e) => setFormData({...formData, fullname: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="email" 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400" 
                placeholder="admin@school.com" 
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="password" 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400" 
                placeholder="••••••••" 
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              School Name <span className="text-slate-400 text-[10px] lowercase font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400" 
                placeholder="e.g. Edumetric Academy" 
                value={formData.schoolName}
                onChange={(e) => setFormData({...formData, schoolName: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={submitting} 
              className="w-full btn btn-primary py-2.5 font-bold flex items-center justify-center gap-2 cursor-pointer h-[46px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin text-white" size={18} />
                  Provisioning Admin Core...
                </>
              ) : (
                'Configure Admin Profile'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400 font-medium">
          Note: This form locks permanently once the admin database profile is set up.
        </div>
      </div>
    </div>
  );
}
