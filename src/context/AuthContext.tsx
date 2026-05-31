import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export interface SchoolBranding {
  school_id: string;
  logo_url: string | null;
  primary_color: string;
}

export function applyBrandingTheme(primaryHex: string) {
  let hex = (primaryHex || '#022e66').replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) {
    hex = '022e66';
  }
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  if (isNaN(r) || isNaN(g) || isNaN(b)) return;

  const resolvedHex = '#' + hex;

  // Primary colors
  document.documentElement.style.setProperty('--color-primary', resolvedHex);
  document.documentElement.style.setProperty('--color-logo-600', resolvedHex);

  // Generate darker shade (700) for hover
  const darken = (val: number, factor = 0.8) => Math.max(0, Math.floor(val * factor));
  const hoverHex = `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;
  document.documentElement.style.setProperty('--color-primary-hover', hoverHex);
  document.documentElement.style.setProperty('--color-logo-700', hoverHex);

  // Generate softer light shades for focus, active, light backgrounds (logo-50, logo-100, logo-200)
  const soften = (val: number, factor = 0.95) => Math.min(255, Math.floor(val + (255 - val) * factor));
  const logo50 = `#${soften(r, 0.95).toString(16).padStart(2, '0')}${soften(g, 0.95).toString(16).padStart(2, '0')}${soften(b, 0.95).toString(16).padStart(2, '0')}`;
  const logo100 = `#${soften(r, 0.9).toString(16).padStart(2, '0')}${soften(g, 0.9).toString(16).padStart(2, '0')}${soften(b, 0.9).toString(16).padStart(2, '0')}`;
  const logo200 = `#${soften(r, 0.75).toString(16).padStart(2, '0')}${soften(g, 0.75).toString(16).padStart(2, '0')}${soften(b, 0.75).toString(16).padStart(2, '0')}`;
  const logo500 = `#${soften(r, 0.2).toString(16).padStart(2, '0')}${soften(g, 0.2).toString(16).padStart(2, '0')}${soften(b, 0.2).toString(16).padStart(2, '0')}`;

  document.documentElement.style.setProperty('--color-logo-50', logo50);
  document.documentElement.style.setProperty('--color-logo-100', logo100);
  document.documentElement.style.setProperty('--color-logo-200', logo200);
  document.documentElement.style.setProperty('--color-logo-500', logo500);
}

interface User {
  id: string;
  email: string;
  fullname: string;
  role: 'admin' | 'teacher' | 'dos';
  school_id?: string;
}

interface AuthContextType {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  academicYear: string;
  setAcademicYear: (year: string) => void;
  branding: SchoolBranding | null;
  refreshBranding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const [academicYear, setAcademicYearState] = useState<string>(() => {
    return localStorage.getItem('academic_year') || '2026';
  });

  const [branding, setBranding] = useState<SchoolBranding | null>(() => {
    const cached = localStorage.getItem('school_branding');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.primary_color) {
          applyBrandingTheme(parsed.primary_color);
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const setAcademicYear = (year: string) => {
    localStorage.setItem('academic_year', year);
    setAcademicYearState(year);
  };

  const refreshBranding = useCallback(async () => {
    try {
      const res = await api.get('/school-branding');
      const brandingData = res.data;
      if (brandingData) {
        setBranding(brandingData);
        localStorage.setItem('school_branding', JSON.stringify(brandingData));
        if (brandingData.primary_color) {
          applyBrandingTheme(brandingData.primary_color);
        }
        
        // Dynamically set favicon if it exists and logo_url is provided
        const favicon = document.querySelector("link[rel~='icon']");
        if (favicon && brandingData.logo_url) {
          favicon.setAttribute('href', brandingData.logo_url);
        }
      }
    } catch (err) {
      console.error('Failed to get school branding info:', err);
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token && storedUser !== 'undefined') {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse user from localStorage', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    
    // Custom 3-second loading period to display the polished app intro logo animation
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (userId) {
      refreshBranding();
    } else {
      setBranding(null);
      localStorage.removeItem('school_branding');
      
      // Reset document styles back to defaults
      document.documentElement.style.removeProperty('--color-primary');
      document.documentElement.style.removeProperty('--color-logo-600');
      document.documentElement.style.removeProperty('--color-primary-hover');
      document.documentElement.style.removeProperty('--color-logo-700');
      document.documentElement.style.removeProperty('--color-logo-50');
      document.documentElement.style.removeProperty('--color-logo-100');
      document.documentElement.style.removeProperty('--color-logo-200');
      document.documentElement.style.removeProperty('--color-logo-500');
    }
  }, [userId, refreshBranding]);

  const login = (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    navigate('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, academicYear, setAcademicYear, branding, refreshBranding }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
