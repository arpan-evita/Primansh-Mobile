import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Zap, ArrowRight, Loader2 } from 'lucide-react';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a session. Supabase handles the link click by 
    // putting the session into the URL fragment, which it then processes.
    const checkSession = async () => {
       const { data: { session } } = await supabase.auth.getSession();
       if (!session) {
         toast.error("Invalid or expired reset link. Please request a new one.");
         navigate('/forgot-password');
       }
    };
    checkSession();
  }, [navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Access Keys do not match.");
      return;
    }

    if (password.length < 6) {
      toast.error("Access Key too weak.", {
        description: "Password must be at least 6 characters."
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success('Access Key Recalibrated', {
        description: 'New credentials registered in the secure vault.',
      });
      navigate('/login', { replace: true });
    } catch (error: any) {
      toast.error('Encryption Failure', {
        description: error.message || 'Failed to update system password.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden noise">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/30 blur-[120px] rounded-full animate-blob overflow-hidden" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-hot/20 blur-[120px] rounded-full animate-blob animation-delay-2000 overflow-hidden" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl mb-6 relative group mx-auto"
          >
            <div className="absolute inset-0 bg-accent/20 blur-xl group-hover:bg-accent/30 transition-all rounded-full" />
            <Lock className="text-accent relative z-10" size={32} />
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">Reset Access Key</h1>
          <p className="text-slate-500 text-xs uppercase tracking-[0.2em] font-mono">// Recalibrating User Security</p>
        </div>

        <div className="glass-premium p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">New Access Key</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-accent transition-colors" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-accent ring-accent/5 focus:ring-4 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Confirm Access Key</label>
              <div className="relative group">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-accent transition-colors" size={18} />
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-accent ring-accent/5 focus:ring-4 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 rounded-2xl bg-accent hover:bg-accent/90 text-white font-bold text-sm uppercase tracking-widest group shadow-xl shadow-accent/20 overflow-hidden relative"
              disabled={loading}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Confirm New Credentials <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
