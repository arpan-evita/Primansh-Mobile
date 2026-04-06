import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'team' | 'client' | 'seo' | 'content' | 'developer' | 'pending')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div className="mt-8 text-center space-y-2">
          <h2 className="text-xl font-bold text-white tracking-widest uppercase" style={{ fontFamily: "Plus Jakarta Sans" }}>Authenticating</h2>
          <p className="text-slate-500 text-xs font-mono tracking-tighter">// Verifying secure session & role</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles) {
    if (!profile || !allowedRoles.includes(profile.role)) {
      // If user is a client, redirect them to their specific portal
      if (profile?.role === 'client' && profile.associated_client_id) {
        return <Navigate to={`/clientportal/${profile.associated_client_id}`} replace />;
      }
      // Otherwise redirect to safety (home)
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
