import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { toast } from 'react-hot-toast';
import { 
  Mail, 
  Lock, 
  Loader2, 
  Building, 
  User, 
  Phone, 
  Upload, 
  ShieldCheck, 
  Clock, 
  BookOpen, 
  Sparkles,
  CheckCircle2,
  FileText
} from 'lucide-react';

export default function Login() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Registration Form States
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSchoolName, setRegSchoolName] = useState('');
  const [regLogoUrl, setRegLogoUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const { login } = useAuth();

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      toast.success('Welcome back!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Process File for Logo Base64 string
  const processLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image formats are supported (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > 1.2 * 1024 * 1024) {
      toast.error('Logo file size must be under 1.2MB for index performance');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        setRegLogoUrl(e.target.result);
        toast.success('School logo processed and ready!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processLogoFile(e.dataTransfer.files[0]);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processLogoFile(e.target.files[0]);
    }
  };

  // Handle Registration submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/auth/register-school', {
        fullname: regFullName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        schoolName: regSchoolName,
        logoUrl: regLogoUrl || null
      });

      toast.success('School Tenant registered successfully! You can now log in.');
      
      // Auto fill login credentials and switch views
      setEmail(regEmail);
      setPassword('');
      setIsRegisterMode(false);
      
      // Reset registration states
      setRegFullName('');
      setRegEmail('');
      setRegPhone('');
      setRegPassword('');
      setRegSchoolName('');
      setRegLogoUrl('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'School registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-3">
        <img 
          src="/edumetric.png" 
          alt="Edumetric Logo" 
          className="w-12 h-12 object-contain rounded-2xl shadow-xl shadow-logo-500/10"
          referrerPolicy="no-referrer"
        />
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Edumetric</h1>
      </div>

      <div className="auth-card w-full max-w-lg bg-white p-6 sm:p-8 rounded-2xl border border-slate-150 shadow-xl">
        
        {/* Toggle Mode Switcher */}
        <div className="flex border-b border-slate-100 pb-4 mb-6">
          <button
            type="button"
            onClick={() => setIsRegisterMode(false)}
            className={`flex-1 pb-3 text-center text-sm font-bold border-b-2 transition-all ${!isRegisterMode ? 'border-logo-600 text-logo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Sign In to School
          </button>
          <button
            type="button"
            onClick={() => setIsRegisterMode(true)}
            className={`flex-1 pb-3 text-center text-sm font-bold border-b-2 transition-all ${isRegisterMode ? 'border-logo-600 text-logo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Register New School
          </button>
        </div>

        {new URL(window.location.href).searchParams.get('verified') === 'true' && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-150 text-emerald-800 text-sm flex gap-3 items-start animate-fadeIn">
            <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
            <div className="text-left">
              <p className="font-bold text-emerald-900">Email verified successfully!</p>
              <p className="text-xs text-emerald-600/90 mt-1 font-medium">Your teacher profile has been verified and active. You can now use your credentials to sign in below.</p>
            </div>
          </div>
        )}

        {/* Dynamic header text */}
        <div className="text-left mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isRegisterMode ? 'Register School Tenant' : 'Welcome Back'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isRegisterMode 
              ? 'Deploy a secure, isolated workspace and administrative account for your institution.' 
              : 'Access classes, schedules, and generate official student report cards.'}
          </p>
        </div>

        {/* --- FORM VIEWS --- */}
        {!isRegisterMode ? (
          // LOGIN FORM
          <form onSubmit={handleLoginSubmit} className="space-y-5 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">School Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400"
                  placeholder="admin@school.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Security Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Sign In'}
            </button>
          </form>
        ) : (
          // REGISTRATION FORM
          <form onSubmit={handleRegisterSubmit} className="space-y-5 text-left max-h-[500px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Owner / Admin Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400"
                    placeholder="e.g. John Doe"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Contact Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="tel" 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400"
                    placeholder="+1 (555) 0192"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Admin Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="email" 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400"
                    placeholder="owner@school.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Admin Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="password" 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400"
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">School Institution Name</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-800 focus:border-logo-400"
                  placeholder="e.g. Oakbridge TVET Academy"
                  value={regSchoolName}
                  onChange={(e) => setRegSchoolName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* School Logo upload block */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                School Emblem Logo <span className="text-slate-400 text-[10px] lowercase font-normal">(optional)</span>
              </label>
              
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('reg-logo-input')?.click()}
                className={`
                  border border-dashed p-4 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer bg-slate-50 min-h-[90px]
                  ${dragActive ? 'border-logo-500 bg-logo-50/10' : 'border-slate-300 hover:border-logo-400'}
                `}
              >
                <input 
                  type="file" 
                  id="reg-logo-input" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleLogoFileChange}
                />
                {regLogoUrl ? (
                  <div className="flex items-center gap-4 text-left w-full">
                    <img 
                      src={regLogoUrl} 
                      alt="Brand Emblem Preview" 
                      className="w-12 h-12 object-contain rounded-lg p-1 bg-white border border-slate-200 shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">Logo Emblem Loaded</p>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRegLogoUrl('');
                        }}
                        className="text-[10px] font-bold text-red-500 hover:underline mt-0.5"
                      >
                        Remove logo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-1">
                    <div className="mx-auto text-logo-600 bg-white p-1.5 rounded-full border border-slate-100 shadow-xs w-8 h-8 flex items-center justify-center">
                      <Upload size={14} />
                    </div>
                    <p className="text-[11px] font-bold text-slate-700">Drag logo here, or <span className="text-logo-600 underline">browse</span></p>
                    <p className="text-[9px] text-slate-400">PNG, JPG or WebP (max 1.2MB)</p>
                  </div>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Provisioning School Workspace...
                </>
              ) : (
                'Deploy School Workspace'
              )}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-medium">
            Authorized admin credentials required. Access subject to school tenant configuration.
          </p>
        </div>
      </div>
      
      <div className="mt-8 text-slate-400 text-xs">
        &copy; 2026 Edumetric School Management System • Multi-Tenant Platform
      </div>
    </div>
  );
}
