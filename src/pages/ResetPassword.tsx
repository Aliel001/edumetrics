import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'react-hot-toast';
import { 
  Lock, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles, 
  GraduationCap 
} from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  
  // Token payload details
  const [userInfo, setUserInfo] = useState<{
    fullname: string;
    email: string;
    schoolName: string;
    logoUrl?: string | null;
  } | null>(null);

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Verify the invitation token on mount
  useEffect(() => {
    if (!token) {
      setTokenError('Missing secure authentication token. Please check your email link.');
      setVerifyingToken(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await api.post('/auth/verify-token', { token });
        setUserInfo(res.data);
      } catch (err: any) {
        setTokenError(err.response?.data?.message || 'The invitation token is invalid, expired, or has already been used.');
      } finally {
        setVerifyingToken(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error('Password is required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/setup-password', { token, password });
      setSuccess(true);
      toast.success('Password configured successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Loading state during token verification
  if (verifyingToken) {
    return (
      <div id="reset-password-loading-container" className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600 font-medium">Verifying your secure invitation token...</p>
        </div>
      </div>
    );
  }

  // 2. Error state (Invalid/Expired token)
  if (tokenError) {
    return (
      <div id="reset-password-error-container" className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center space-y-6">
          <div className="inline-flex p-4 bg-red-50 text-red-600 rounded-full">
            <AlertCircle className="h-12 w-12" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Setup Link Problem</h2>
          <p className="text-gray-600 leading-relaxed">{tokenError}</p>
          <div className="pt-2">
            <Link 
              to="/login"
              className="inline-flex w-full items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors duration-200"
            >
              Go Code to Portal Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Success state after password setup
  if (success) {
    return (
      <div id="reset-password-success-container" className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center space-y-6">
          <div className="inline-flex p-4 bg-green-50 text-green-600 rounded-full">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Setup Completed!</h2>
            {userInfo && (
              <p className="text-sm font-medium text-gray-500">
                Welcome to {userInfo.schoolName}, {userInfo.fullname}
              </p>
            )}
          </div>
          <p className="text-gray-600">Your account is active and your password is updated. You can now log into the portal directly.</p>
          <div className="pt-2">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors duration-200"
            >
              Log In Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Input form state
  return (
    <div id="reset-password-form-container" className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {userInfo?.logoUrl ? (
          <img 
            src={userInfo.logoUrl} 
            alt="School Logo" 
            className="mx-auto h-16 w-auto object-contain rounded-xl shadow-lg bg-white border p-1 mb-4"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="mx-auto h-14 w-14 bg-blue-50 text-blue-600 flex items-center justify-center rounded-2xl shadow-sm mb-4">
            <GraduationCap className="h-8 w-8" />
          </div>
        )}
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Account Invitation Setup
        </h2>
        {userInfo && (
          <p className="mt-2 text-sm text-gray-600 max-w">
            Welcome to <strong className="text-blue-600">{userInfo.schoolName}</strong>
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden">
          {/* Subtle colored accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />

          {userInfo && (
            <div className="mb-6 p-4 bg-blue-50/50 rounded-xl text-left border border-blue-100/30">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block mb-1">
                Assigned Profile Details
              </span>
              <p className="text-sm text-gray-800 font-semibold mb-0.5">{userInfo.fullname}</p>
              <p className="text-xs text-gray-500 font-mono">{userInfo.email}</p>
            </div>
          )}

          <form className="space-y-6 text-left" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Setup Secure Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-450" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Confirm Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-450" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type your secure password"
                  required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                  Saving secure profile passcode...
                </>
              ) : (
                'Configure Profile Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
