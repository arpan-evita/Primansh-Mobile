import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  FileText,
  CreditCard,
  LogOut,
  Zap,
  ChevronRight,
  MessageSquare,
  Video,
  FolderOpen,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { href: "overview", label: "Overview", icon: LayoutDashboard },
  { href: "seo", label: "SEO Status", icon: Search },
  { href: "tasks", label: "Project Updates", icon: FileText },
  { href: "messages", label: "Messages", icon: MessageSquare },
  { href: "meetings", label: "Meetings", icon: Video },
  { href: "documents", label: "Documents", icon: FolderOpen },
  { href: "billing", label: "Billing", icon: CreditCard },
  { href: "connection", label: "Connect Site", icon: Zap },
];

interface PortalSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function PortalSidebar({ mobileOpen = false, onClose }: PortalSidebarProps) {
  const { pathname } = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: clientData } = useQuery({
    queryKey: ['portal_client_firm', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase.from('clients').select('firm_name').eq('slug', slug).single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug
  });

  const handleExit = async () => {
    if (profile?.role === 'client') {
      await signOut();
      navigate('/login');
    } else {
      navigate('/dashboard');
    }
  };

  const handleSupport = () => {
    const { slug } = { slug: window.location.pathname.split('/')[2] };
    navigate(`/clientportal/${slug}/messages`);
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-full flex flex-col transition-transform duration-300 ease-in-out z-40 -translate-x-full lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : ""
      }`}
      style={{
        width: "256px",
        background: "rgba(7, 11, 20, 0.98)",
        borderRight: "1px solid rgba(99, 128, 191, 0.1)",
      }}
    >
      {/* Logo + mobile close */}
      <div className="flex items-center gap-3 px-6 py-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            boxShadow: "0 4px 14px rgba(59,130,246,0.4)",
          }}
        >
          <Zap size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white tracking-tight truncate">
            {clientData?.firm_name || "Client Portal"}
          </p>
          <p className="text-[10px] font-medium truncate" style={{ color: "#475569" }}>
            PRIMANSH AGENCY
          </p>
        </div>
        {/* X close button — mobile only */}
        <button
          className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const targetHref = `/clientportal/${slug}/${href === 'overview' ? '' : href}`.replace(/\/$/, "");
          const isActive = pathname === targetHref;
          
          return (
            <Link
              key={href}
              to={targetHref}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                isActive 
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
              )}
            >
              <Icon size={18} className={cn("transition-colors", isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-400")} />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight size={14} className="opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 mt-auto space-y-2">
        <Link
          to="/profile"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all group text-sm font-medium"
        >
          <User size={18} className="group-hover:text-blue-400" />
          <span>Profile Settings</span>
        </Link>
        <button
          onClick={handleExit}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-white hover:bg-red-500/10 transition-all group text-sm font-medium mb-4"
        >
          <LogOut size={18} className="group-hover:text-red-400" />
          <span>Exit Portal</span>
        </button>

        <div
          className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/10"
        >
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Support</p>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">Need help with your project?</p>
          <button 
            onClick={handleSupport}
            className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            Contact Team
          </button>
        </div>
      </div>
    </aside>
  );
}
