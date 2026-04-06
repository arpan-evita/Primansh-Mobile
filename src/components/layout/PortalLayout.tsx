import React, { useState } from "react";
import { PortalSidebar } from "@/components/layout/PortalSidebar";
import { PortalBottomNav } from "@/components/layout/PortalBottomNav";
import { AgencyChatbot } from "@/components/chat/AgencyChatbot";
import { Menu, ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PortalLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  clientId?: string;
}

export function PortalLayout({ children, title, subtitle, clientId }: PortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200 font-sans selection:bg-accent/30 selection:text-white">
      {/* 🔮 BACKGROUND BLUR ELEMENTS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <PortalSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:pl-72 min-h-screen flex flex-col relative z-10 transition-all duration-500">
        {/* 📱 MOBILE HEADER */}
        <div
          className="lg:hidden flex items-center gap-3 px-5 py-4 sticky top-0 z-30"
          style={{
            background: "rgba(7, 11, 20, 0.8)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(20px)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 active:scale-95"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white truncate tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[10px] text-slate-500 truncate font-medium uppercase tracking-widest">{subtitle}</p>
            )}
          </div>
        </div>

        {/* 🖥️ DESKTOP CONTENT AREA */}
        <div className="flex-1 w-full max-w-[1440px] mx-auto">
          <div className="px-6 md:px-10 py-8 lg:py-12 fade-up">
            {/* Desktop breadcrumbs & heading */}
            <header className="mb-10 hidden lg:block">
              <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-6">
                <Link to="/" className="hover:text-accent transition-colors flex items-center gap-1.5">
                  <Home size={10} />
                  Terminal
                </Link>
                <ChevronRight size={10} className="text-slate-800" />
                <span className="text-slate-400">Portal</span>
                <ChevronRight size={10} className="text-slate-800" />
                <span className="text-accent">{title}</span>
              </nav>

              <div className="space-y-1.5">
                <h1 className="text-4xl font-black text-white tracking-tighter" style={{ fontFamily: "Plus Jakarta Sans" }}>
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-slate-500 text-sm font-medium max-w-2xl leading-relaxed italic border-l-2 border-accent/20 pl-4 py-1">
                    {subtitle}
                  </p>
                )}
              </div>
            </header>

            {/* Content Slot */}
            <div className="relative">
              {children}
            </div>
          </div>
        </div>

        {/* 📋 FOOTER / BOTTOM SPACER */}
        <footer className="mt-auto py-8 px-10 border-t border-white/5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-700 hidden lg:flex">
          <p>© 2026 PRIMANSH AGENCY OS // SECURE NODE</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-emerald-500" /> System Active</span>
            <span className="text-slate-800 px-3 py-1 rounded-lg border border-white/5">LATENCY: 14MS</span>
          </div>
        </footer>
      </main>

      <PortalBottomNav />

      {/* 🤖 FLOATING CHATBOT */}
      {clientId && (
        <div className="fixed bottom-6 right-6 z-50 transition-transform hover:scale-105 active:scale-95 duration-300">
          <AgencyChatbot
            type="client"
            clientId={clientId}
            userId={clientId}
          />
        </div>
      )}
    </div>
  );
}
