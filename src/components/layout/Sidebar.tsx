import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Search,
  FileText,
  BarChart2,
  CreditCard,
  FolderOpen,
  Settings,
  Zap,
  ChevronRight,
  LogOut,
  PenTool,
  MessageSquare,
  Video,
  TrendingUp,
  X,
  Edit,
  Camera,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",             label: "Dashboard",     icon: LayoutDashboard, roles: ["admin", "seo", "content", "developer", "team"] },
  { href: "/clients",               label: "Clients",       icon: Users,           roles: ["admin", "seo", "content", "developer", "team"] },
  { href: "/tasks",                label: "Task Board",    icon: CheckSquare,     roles: ["admin", "seo", "content", "developer", "team"] },
  { href: "/messages",             label: "Messages",      icon: MessageSquare,   roles: ["admin", "seo", "content", "developer", "team"] },
  { href: "/meetings",             label: "Meetings",      icon: Video,           roles: ["admin", "seo", "content", "developer", "team"] },
  { href: "/leads",                label: "Leads",         icon: TrendingUp,      roles: ["admin"] },
  { href: "/seo",                  label: "SEO Panel",     icon: Search,          roles: ["admin", "seo", "developer"] },
  { href: "/content",              label: "Content",       icon: FileText,        roles: ["admin", "content", "seo", "developer"] },
  { href: "/blogs",                label: "Article Master",icon: PenTool,         roles: ["admin", "content", "seo", "developer", "team"] },
  { href: "/content/testimonials", label: "Testimonials",  icon: MessageSquare,   roles: ["admin", "content", "seo", "developer"] },
  { href: "/dashboard/case-studies",label: "Case Studies", icon: FolderOpen,      roles: ["admin", "seo", "content", "developer"] },
  { href: "/analytics",            label: "Analytics",     icon: BarChart2,       roles: ["admin", "seo", "developer"] },
  { href: "/billing",              label: "Billing",       icon: CreditCard,      roles: ["admin", "seo", "developer"] },
  { href: "/documents",            label: "Documents",     icon: FolderOpen,      roles: ["admin", "seo", "content", "developer", "team"] },
];

const bottomItems = [
  { href: "/team", label: "Team", icon: Settings, roles: ["admin", "seo", "developer"] },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { pathname } = useLocation();
  const { user, profile, signOut } = useAuth();
  
  const userRole = (profile?.role || "client").toLowerCase();


  const filteredNavItems = navItems.filter((item) => item.roles.includes(userRole));
  const filteredBottomItems = bottomItems.filter((item) => item.roles.includes(userRole));

  const handleNavClick = () => {
    onClose?.();
  };

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 h-full flex flex-col transition-transform duration-300 ease-in-out",
        // Desktop: always visible; Mobile: slide in/out
        "z-40",
        "-translate-x-full lg:translate-x-0",
        mobileOpen && "translate-x-0"
      )}
      style={{
        width: "var(--sidebar-width)",
        background: "rgba(7, 11, 20, 0.98)",
        borderRight: "1px solid rgba(99, 128, 191, 0.1)",
      }}
    >
      {/* Logo + mobile close button */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            boxShadow: "0 4px 14px rgba(59,130,246,0.4)",
          }}
        >
          <Zap size={17} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white" style={{ fontFamily: "Plus Jakarta Sans" }}>
            Primansh
          </p>
          <p className="text-xs" style={{ color: "#475569" }}>
            Agency OS
          </p>
        </div>
        {/* Close button — mobile only */}
        <button
          className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(99, 128, 191, 0.08)", margin: "0 16px 1px" }} />

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <p className="section-title mt-4 mb-2">Main Menu</p>
        {filteredNavItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              to={href}
              onClick={handleNavClick}
              className={cn("nav-item mb-0.5", isActive && "active")}
            >
              <Icon size={16} />
              <span className="flex-1 text-xs">{label}</span>
              {isActive && <ChevronRight size={13} className="opacity-50" />}
            </Link>
          );
        })}
        {filteredNavItems.length === 0 && (
          <div className="px-3 py-10 text-center">
            <p className="text-[10px] text-slate-600 uppercase font-bold tracking-widest leading-relaxed">
              Waiting for Node Authorization...
            </p>
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-8">
        <div style={{ height: 1, background: "rgba(99, 128, 191, 0.08)", marginBottom: 12 }} />
        {filteredBottomItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              to={href}
              onClick={handleNavClick}
              className={cn("nav-item", isActive && "active")}
            >
              <Icon size={16} />
              <span className="text-xs">{label}</span>
            </Link>
          );
        })}

        <button
          onClick={() => { signOut(); onClose?.(); }}
          className="nav-item w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs mt-1"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>

        {/* User card — click to edit profile */}
        <Link
          to="/profile"
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl mt-4 group/card hover:bg-white/5 transition-all text-left"
          style={{ background: "rgba(99, 128, 191, 0.06)" }}
          title="Edit my profile"
        >
          <div className="relative shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white" }}
            >
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : (user?.email?.substring(0, 2).toUpperCase() || "U")}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
              <Edit size={10} className="text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-white truncate">
              {profile?.full_name || user?.email?.split("@")[0] || "User"}
            </p>
            <p className="text-[8px] uppercase tracking-tighter" style={{ color: "#475569" }}>
              {userRole === "client" ? "Pending Approval" : `Role: ${userRole}`}
            </p>
          </div>
          <Edit size={12} className="text-slate-600 group-hover/card:text-blue-400 transition-colors shrink-0" />
        </Link>


      </div>
    </aside>
  );
}
