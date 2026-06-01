import React from 'react';
import { motion } from 'motion/react';
import { getSchoolNameFromId } from '../lib/schoolUtils';

export default function LoadingScreen() {
  const cachedBranding = React.useMemo(() => {
    try {
      const cached = localStorage.getItem('school_branding');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }, []);

  const schoolName = React.useMemo(() => {
    return getSchoolNameFromId(cachedBranding?.school_id);
  }, [cachedBranding]);

  return (
    <div className="fixed inset-0 bg-[#0F172A] flex flex-col items-center justify-center z-50 overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-logo-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="flex flex-col items-center max-w-sm px-6 text-center z-10">
        {/* Animated logo wrapper */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: [0.8, 1.05, 1], 
            opacity: 1 
          }}
          transition={{ 
            duration: 1.2,
            ease: "easeOut"
          }}
          className="relative mb-6"
        >
          {/* Pulsing ring effect */}
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.4, 0, 0.4]
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 rounded-3xl bg-logo-500/20 blur-md"
          />
          
          <img 
            src={cachedBranding?.logo_url || "/edumetric.png"} 
            alt="School Logo" 
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-3xl shadow-2xl relative z-10"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        {/* Brand Name */}
        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-white text-3xl sm:text-4xl font-extrabold tracking-tight"
        >
          {schoolName}
        </motion.h1>

        {/* Subtitle / Slogan */}
        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="text-slate-400 text-xs sm:text-sm font-medium mt-2 tracking-wide uppercase"
        >
          Academic Management Platform
        </motion.p>

        {/* Loader Progress Bar Container */}
        <div className="mt-8 w-44 sm:w-52 h-1 bg-slate-800 rounded-full overflow-hidden relative">
          <motion.div 
            initial={{ left: "-100%" }}
            animate={{ left: "100%" }}
            transition={{ 
              repeat: Infinity, 
              duration: 1.5, 
              ease: "easeInOut" 
            }}
            className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-logo-500 to-sky-500 rounded-full shadow-[0_0_8px_rgba(2,46,102,0.5)]"
          />
        </div>

        {/* Floating status text */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="text-[10px] text-slate-500 font-mono tracking-widest mt-4 uppercase"
        >
          Initializing Secure Session
        </motion.span>
      </div>
    </div>
  );
}
