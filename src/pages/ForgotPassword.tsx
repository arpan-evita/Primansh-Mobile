import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Zap, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success('Recovery Protocol Initialized', {
        description: 'Authentication reset link dispatched to your secure email.',
      });
    } catch (error: any) {
      toast.error('Protocol Error', {
        description: error.message || 'Failed to initialize password recovery.',
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
          <Link to="/login" className="inline-flex items-center gap-2 text-[10px] text-slate-500 hover:text-white uppercase tracking-widest transition-colors mb-8">
            <ArrowLeft size={12} /> Back to Login
          </Link>
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl mb-6 relative group mx-auto"
          >
            <div className="absolute inset-0 bg-accent/20 blur-xl group-hover:bg-accent/30 transition-all rounded-full" />
            <ShieldCheck className="text-accent relative z-10" size={32} />
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">Recover Access</h1>
          <p className="text-slate-500 text-xs uppercase tracking-[0.2em] font-mono">// System Credential Recovery</p>
        </div>

        <div className="glass-premium p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
          {!submitted ? (
            <form onSubmit={handleResetRequest} className="space-y-6">
              <p className="text-xs text-slate-400 leading-relaxed text-center mb-6">
                Enter your administrative email address. We will transmit a secure, one-time recovery link to verify your identity.
              </p>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Secure Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-accent transition-colors" size={18} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-accent ring-accent/5 focus:ring-4 transition-all"
                    placeholder="admin@primansh.com"
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
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Transmit Reset Link <Zap size={16} className="group-hover:scale-125 transition-transform" />
                    </>
                  )}
                </span>
              </Button>
            </form>
          ) : (
            <div className="text-center py-4 space-y-6">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail className="text-emerald-400" size={24} />
              </div>
              <h2 className="text-xl font-bold text-white">Check Your Inbox</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                If an account exists for <span className="text-white font-bold">{email}</span>, you will receive a secure reset coordinate within the next few minutes.
              </p>
              <div className="pt-6">
                <Link to="/login">
                  <Button className="w-full bg-slate-900 border border-white/5 hover:bg-slate-800 rounded-xl">
                    Return to Operational Base
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
