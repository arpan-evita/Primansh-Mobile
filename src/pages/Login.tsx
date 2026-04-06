import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Lock, Mail, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get the redirect path from state, or default to /dashboard
  const from = location.state?.from?.pathname || '/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Fetch profile to check role and redirection needs
      // Wrap in a separate try-catch to avoid blocking primary login if migration is pending
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, associated_client_id')
          .eq('id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        if (profile?.role === 'client' && profile.associated_client_id) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('slug')
            .eq('id', profile.associated_client_id)
            .single();
          
          if (clientData?.slug) {
            toast.success('Secure Portal Initialized', {
              description: `Welcome to your firm's dashboard.`,
            });
            navigate(`/clientportal/${clientData.slug}`, { replace: true });
            return;
          }
        } else if (profile?.role === 'team' || profile?.role === 'seo' || profile?.role === 'content' || profile?.role === 'developer') {
          // If a team/specialist member logs in and was headed to /dashboard (which they can't access)
          // or just logged in directly, send them to /tasks
          if (from === '/dashboard' || from === '/') {
            toast.success('Access Granted', {
              description: 'Welcome back to the Primansh Command Center.',
            });
            navigate('/tasks', { replace: true });
            return;
          }
        }
      } catch (loginRedirectError) {
        console.warn("Client redirect failed (migration pending?):", loginRedirectError);
        // Continue to default dashboard
      }

      toast.success('Access Granted', {
        description: 'Welcome back to the Primansh Command Center.',
      });
      navigate(from, { replace: true });
    } catch (error: any) {
      console.error("Login attempt failed:", error);
      
      let errorTitle = 'Authentication Failed';
      let errorDesc = error.message || 'Please check your credentials and try again.';

      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        errorTitle = 'Network Connection Error';
        errorDesc = 'Unable to reach the security server. This may be due to a CORS policy, network restriction, or the database being paused.';
      }

      toast.error(errorTitle, {
        description: errorDesc,
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
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl mb-6 relative group"
          >
            <div className="absolute inset-0 bg-accent/20 blur-xl group-hover:bg-accent/30 transition-all rounded-full" />
            <Zap className="text-accent relative z-10" size={32} />
          </motion.div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-3">Primansh <span className="text-accent italic font-light font-mono text-2xl ml-2">Admin</span></h1>
          <p className="text-slate-500 text-sm uppercase tracking-[0.2em] font-mono">// Secure Authentication Required</p>
        </div>

        <div className="glass-premium p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Administrative Email</label>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Access Key</label>
                <Link to="/forgot-password" className="text-[10px] text-slate-600 hover:text-accent uppercase tracking-tighter transition-colors">Forgot Key?</Link>
              </div>
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
                    Initialize Session <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-3">
              <ShieldCheck className="text-slate-600" size={16} />
              <p className="text-[10px] text-slate-600 uppercase tracking-widest font-mono">End-to-End Encrypted Node</p>
            </div>
            <p className="text-slate-500 text-[11px] font-medium">
              New Operator?{" "}
              <Link to="/signup" className="text-accent hover:text-accent/80 font-bold ml-1 transition-colors">
                Initialize New Access
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-slate-600 text-[10px] uppercase tracking-tighter font-mono">
          Primansh Agency OS v4.2.0 // Node: SG-Alpha-01
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
