import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { getSchoolNameFromId } from '../../lib/schoolUtils';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  Upload, 
  Paintbrush, 
  Check, 
  Undo, 
  RotateCcw, 
  School, 
  Palette,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

const PRESET_COLORS = [
  { name: 'Classic Edumetric (Blue)', hex: '#022e66' },
  { name: 'Royal Navy', hex: '#0f172a' },
  { name: 'Emerald Forest', hex: '#064e3b' },
  { name: 'Crimson Pride', hex: '#991b1b' },
  { name: 'Imperial Maroon', hex: '#701a75' },
  { name: 'Warm Ochre', hex: '#7c2d12' },
  { name: 'Teal Academy', hex: '#115e59' },
  { name: 'Deep Indigo', hex: '#312e81' },
];

export default function Branding() {
  const { branding, refreshBranding, user } = useAuth();
  
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [primaryColor, setPrimaryColor] = useState<string>('#022e66');
  const [isSaving, setIsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (branding) {
      setLogoUrl(branding.logo_url || '');
      setPrimaryColor(branding.primary_color || '#022e66');
    }
  }, [branding]);

  // Handle Drag and Drop for Logo Upload
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, SVG, WebP)');
      return;
    }
    
    // Check file size, limit to 1MB to prevent excessive DB bloat
    if (file.size > 1.2 * 1024 * 1024) {
      toast.error('Logo image size must be under 1.2MB for optimal performance');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        setLogoUrl(e.target.result);
        toast.success('Logo image uploaded successfully!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handlePresetSelect = (hex: string) => {
    setPrimaryColor(hex);
    toast.success(`Theme color set to ${hex}`);
  };

  const handleResetDefaults = () => {
    setLogoUrl('');
    setPrimaryColor('#022e66');
    toast.success('Reset to default values. Click Save to apply.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.post('/school-branding', {
        logo_url: logoUrl,
        primary_color: primaryColor
      });
      // Synchronize the client states
      await refreshBranding();
      toast.success('School branding saved and applied globally across your tenant!');
    } catch (err: any) {
      console.error('Failed to save branding:', err);
      toast.error(err.response?.data?.error || 'Failed to persist branding settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const schoolName = getSchoolNameFromId(user?.school_id);

  return (
    <div className="space-y-8 text-left max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-logo-50 to-logo-50/50 p-6 rounded-2xl border border-logo-100/40 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <Palette size={22} className="text-logo-600 animate-pulse" />
            School Branding Settings
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Customize labels, custom logos, and primary brand theme colors applied globally across all student, teacher, and DOS dashboards.
          </p>
        </div>
        <div className="font-mono text-left bg-white px-4 py-2 border border-slate-200 shadow-sm rounded-xl min-w-[120px] self-start md:self-auto">
          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">TENANT BRAND</span>
          <span className="text-sm font-bold text-slate-800 truncate block max-w-[150px]">{schoolName}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Form Settings Panel */}
        <div className="lg:col-span-2 space-y-6">
          <form id="branding-form" onSubmit={handleSave} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-150 shadow-sm space-y-8">
            
            {/* School Logo Section */}
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon size={18} className="text-logo-600" />
                School Logo Upload
              </label>
              <p className="text-xs text-slate-400 font-medium">
                Upload a custom image (ideally a square or landscape with transparent background) under 1.2MB. This represents your school in headers, student reports, and loading screens.
              </p>

              {/* Drag and Drop Zone */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`
                  relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[160px]
                  ${dragActive ? 'border-logo-500 bg-logo-50/30 ring-4 ring-logo-100' : 'border-slate-250 hover:border-logo-400 hover:bg-slate-50/50'}
                `}
                onClick={() => document.getElementById('logo-file-input')?.click()}
              >
                <input 
                  type="file" 
                  id="logo-file-input" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />

                {logoUrl ? (
                  <div className="flex items-center gap-6 text-left">
                    <img 
                      src={logoUrl} 
                      alt="Uploaded Logo Preview" 
                      className="w-16 h-16 object-contain rounded-xl border border-slate-200 p-2 bg-white shadow-sm flex-shrink-0"
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Your logo is loaded</p>
                      <p className="text-xs text-slate-500 mt-0.5">Click or drag a new image file to replace.</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLogoUrl('');
                          toast.success('Removed logo. Default will be applied.');
                        }}
                        className="text-xs font-bold text-red-600 hover:text-red-700 mt-2 flex items-center gap-1 inline-flex py-1 px-2 rounded-md hover:bg-red-50 transition"
                      >
                        Remove Logo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-10 h-10 rounded-full bg-logo-50 text-logo-600 flex items-center justify-center">
                      <Upload size={20} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Drag & drop your school logo, or <span className="text-logo-600 font-bold underline">browse files</span></p>
                    <p className="text-xs text-slate-400 font-mono">PNG, JPG, WebP, or SVG up to 1.2MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Branding Color Picker Section */}
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <label className="block text-sm font-bold text-slate-900 flex items-center gap-2">
                <Paintbrush size={18} className="text-logo-600" />
                Primary Branding Theme Color
              </label>
              <p className="text-xs text-slate-400 font-medium">
                Choose the primary branding theme color of your school. This is applied globally to buttons, navigation menus, badges, performance curves, and highlighting indicators.
              </p>

              {/* Color Preset Palette */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {PRESET_COLORS.map((color) => {
                  const isSelected = primaryColor.toLowerCase() === color.hex.toLowerCase();
                  return (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => handlePresetSelect(color.hex)}
                      className={`
                        group flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all active:scale-95 text-xs font-semibold
                        ${isSelected ? 'border-slate-800 bg-slate-900 text-white shadow-md' : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'}
                      `}
                    >
                      <span 
                        className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0 block shadow-xs" 
                        style={{ backgroundColor: color.hex }} 
                      />
                      <span className="truncate pr-1 select-none">{color.name}</span>
                      {isSelected && <Check size={12} className="ml-auto text-emerald-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Input */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-6 p-4 rounded-xl bg-slate-50 border border-slate-150 max-w-md">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-slate-250 flex-shrink-0">
                    <input 
                      type="color" 
                      id="custom-hex-color" 
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="absolute inset-x-0 -inset-y-3 w-[150%] h-[150%] cursor-pointer border-0" 
                    />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-900 block">Custom Theme HEX</span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold block">INTERACTIVE PICKER</span>
                  </div>
                </div>

                <div className="flex-1">
                  <input 
                    type="text" 
                    value={primaryColor} 
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#022e66"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-250 font-mono text-sm uppercase font-bold focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-slate-800 focus:border-logo-500"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons inside Form */}
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="btn btn-secondary inline-flex items-center gap-1.5 font-bold"
                title="Reset local changes"
              >
                <RotateCcw size={16} />
                Reset Defaults
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary inline-flex items-center gap-2 font-bold px-6 py-2.5 shadow-md"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving Branding...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Apply & Save Branding
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Sidebar Interactive Simulator Card */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-950 flex items-center gap-2">
              <Sparkles size={18} className="text-logo-600 animate-pulse" />
              Live Shell Simulator
            </h3>
            <p className="text-xs text-slate-500">
              Interactive preview representing how the active menu, buttons, and student logotype will immediately render inside the client sidebar.
            </p>

            {/* Simulated Sidebar Widget */}
            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs bg-slate-900 text-white select-none">
              <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-slate-950/45">
                <img 
                  src={logoUrl || "/edumetric.png"} 
                  alt="School Logo" 
                  className="w-6 h-6 object-contain rounded-md bg-white p-0.5 shadow-xs flex-shrink-0"
                />
                <span className="text-sm font-bold truncate max-w-[140px] text-white">
                  {schoolName}
                </span>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">PREVIEW CHANNELS</p>
                
                {/* Active Sidebar item styled using selected primary color */}
                <div 
                  className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  <School size={12} className="text-white" />
                  <span>Dashboard</span>
                  <div className="ml-auto w-1 h-1 rounded-full bg-white animate-ping" />
                </div>

                <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400">
                  <Palette size={12} />
                  <span>Branding Config</span>
                </div>
              </div>

              {/* Stats Card simulator inside */}
              <div className="p-4 bg-white/5 border-t border-white/5 text-left space-y-1.5">
                <p className="text-[10px] text-slate-400 font-semibold uppercase font-mono tracking-wide">Dynamic Primary Shade</p>
                <div className="flex gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded font-bold font-mono text-white shadow-xs" style={{ backgroundColor: primaryColor }}>
                    {primaryColor.toUpperCase()}
                  </span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                    <Check size={11} /> Live Preview
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Apply Notice */}
            <div className="p-4 bg-logo-50 rounded-xl border border-logo-100/40 text-xs text-logo-950 leading-relaxed text-left flex gap-2.5">
              <Sparkles size={16} className="text-logo-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-logo-900">Immediate CSS-in-JS Cascade</p>
                <p className="text-logo-750 font-medium mt-1">
                  Once saved, our dynamic theme-shading engine computes a coordinated portfolio of 6 custom tints (logo-50 up to logo-700) and cascades them into Tailwind custom CSS variables instantly.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
