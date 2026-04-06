"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, Save, User, Mail, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [editingName, setEditingName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditingName(profile.full_name || "");
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    
    // Check size limit: 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar size must be strictly under 2 MB for faster loading.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName; // The path within the 'avatars' bucket

      const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      // Update profile
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
      setAvatarUrl(publicUrl);
      toast.success("Profile photo updated successfully!");
    } catch (err: any) {
      toast.error("Upload failed. Ensure you have the right permissions or contact support.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    if (!editingName.trim()) {
      toast.error("Display name cannot be empty.");
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: editingName }).eq('id', profile.id);
      if (error) throw error;
      toast.success("Profile details saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell title="My Profile" subtitle="Manage your account settings and personal information">
      <div className="fade-up max-w-2xl mx-auto space-y-8 mt-4">
        
        {profile?.role === 'client' && (
          <button 
            onClick={() => navigate(-1)} 
            className="mb-[-1rem] flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Return to Portal
          </button>
        )}

        {/* Profile Card */}
        <div className="glass-card rounded-[2rem] border border-white/5 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-accent/20 relative">
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          </div>
          
          <div className="px-8 pb-8 relative">
            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 mb-8 relative z-10">
              <div className="relative group">
                <div className="w-32 h-32 rounded-[2rem] bg-[#0a0f1d] border-4 border-[#070b14] shadow-2xl overflow-hidden flex items-center justify-center text-4xl font-black text-white relative">
                  {avatarUrl
                    ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    : (profile?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()
                  }
                  
                  {isUploading && (
                    <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center backdrop-blur-sm">
                      <Loader2 className="animate-spin text-blue-400" size={32} />
                    </div>
                  )}
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer pointer-events-none">
                     <Camera size={24} className="text-white mb-2" />
                  </div>
                </div>
                
                {/* Upload Button */}
                <label className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all border-4 border-[#070b14] flex items-center justify-center shadow-lg group-hover:scale-110 duration-300">
                  <Camera size={16} className="text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} />
                </label>
              </div>
              
              <div className="text-center sm:text-left flex-1 mb-2">
                <h2 className="text-2xl font-black text-white tracking-tight">{profile?.full_name || "User"}</h2>
                <div className="flex items-center justify-center sm:justify-start gap-3 mt-1.5">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                        <Shield size={10} />
                        {profile?.role || "Client"}
                    </span>
                    {profile?.role === "client" && (
                        <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded uppercase tracking-wider">
                            Pending Approval
                        </span>
                    )}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                 {/* Display Name */}
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                      <User size={12} />
                      Display Name
                  </label>
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    placeholder="Your full name..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 px-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all placeholder:text-slate-700"
                  />
                </div>
                
                {/* Email (Read-Only) */}
                <div className="space-y-2 relative opacity-70">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                      <Mail size={12} />
                      Account Email
                  </label>
                  <div className="relative">
                      <input
                        type="email"
                        value={user?.email || ""}
                        disabled
                        className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-400 cursor-not-allowed"
                      />
                  </div>
                </div>
              </div>
              
              <div className="pt-6 border-t border-white/5 flex justify-end">
                <button 
                    onClick={handleSaveProfile} 
                    disabled={isSaving || editingName === profile?.full_name} 
                    className="btn-accent px-8 py-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 group"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="group-hover:scale-110 transition-transform" />}
                  {isSaving ? 'UPDATING IDENTITY...' : 'SAVE CHANGES'}
                </button>
              </div>
            </div>
            
          </div>
        </div>
        
        {/* Info Card */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 flex gap-4 items-start bg-blue-500/[0.02]">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Shield size={18} className="text-blue-400" />
            </div>
            <div>
                <h4 className="text-sm font-bold text-white mb-1">Security & Access</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Your account role determines which areas of the platform you can access. 
                    If you believe your role ({profile?.role}) is incorrect, please contact your system administrator.
                    Profile images and display names are securely stored and visible across the agency network.
                </p>
                <button className="text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors">
                    Reset Password
                </button>
            </div>
        </div>

      </div>
    </AppShell>
  );
}
