"use client";

import { Bell, Menu, Search, Plus, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalUI } from "@/contexts/GlobalUIContext";
import { useNotifications } from "@/hooks/useNotifications";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, showMenuButton, onMenuClick, actions }: HeaderProps) {
  const { profile, user } = useAuth();
  const { setIsSearchPaletteOpen, setIsAddClientModalOpen, setIsNotificationsOpen } = useGlobalUI();
  const { unreadCount } = useNotifications();

  const isInternal = profile?.role && profile.role !== 'client';

  return (
    <header
      className="header-main fixed top-0 right-0 flex items-center justify-between px-4 md:px-6 z-30"
      style={{
        height: "var(--header-height)",
        background: "rgba(7, 11, 20, 0.92)",
        borderBottom: "1px solid rgba(99, 128, 191, 0.1)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Left: hamburger (mobile) + title */}
      <div className="flex items-center gap-3 min-w-0">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-white truncate" style={{ fontFamily: "Plus Jakarta Sans" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[10px] hidden sm:block truncate" style={{ color: "#475569" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end px-4">
        {actions}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Search — hidden on small mobile */}
        <div
          onClick={() => setIsSearchPaletteOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-all"
          style={{
            background: "rgba(15, 22, 41, 0.8)",
            border: "1px solid rgba(99, 128, 191, 0.15)",
            minWidth: 180,
          }}
        >
          <Search size={14} style={{ color: "#475569" }} />
          <input
            type="text"
            readOnly
            placeholder="Search clients, tasks..."
            className="bg-transparent text-xs outline-none flex-1 pointer-events-none"
            style={{ color: "#94a3b8" }}
          />
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "rgba(99, 128, 191, 0.1)", color: "#475569", fontSize: 10 }}
          >
            ⌘K
          </span>
        </div>

        {/* Add button — icon only on mobile (Admin only) */}
        {profile?.role === 'admin' && (
          <button 
            onClick={() => setIsAddClientModalOpen(true)}
            className="btn-primary flex items-center gap-2 text-xs px-3 py-2"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">New Client</span>
          </button>
        )}

        {/* Notifications */}
        <button
          onClick={() => setIsNotificationsOpen(true)}
          className="relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-white/5 transition-all"
          style={{ background: "rgba(15, 22, 41, 0.8)", border: "1px solid rgba(99, 128, 191, 0.15)" }}
        >
          <Bell size={15} style={{ color: "#94a3b8" }} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#0b0f1a] animate-pulse"
              style={{ background: "#3b82f6" }}
            />
          )}
        </button>

        {/* Profile Link (Header) */}
        <Link
          to="/profile"
          className="w-9 h-9 flex items-center justify-center rounded-lg overflow-hidden border transition-all hover:opacity-80"
          style={{ background: "rgba(15, 22, 41, 0.8)", borderColor: "rgba(99, 128, 191, 0.15)", color: "#94a3b8" }}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User size={15} />
          )}
        </Link>
      </div>
    </header>
  );
}
