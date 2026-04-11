"use client";

import { lazy, Suspense, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, X as CloseIcon } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { GlobalUIProvider, useGlobalUI } from "@/contexts/GlobalUIContext";

const LazyAdminCopilot = lazy(() =>
  import("../chat/AdminCopilot").then((module) => ({
    default: module.AdminCopilot,
  })),
);

const LazyAgencyChatbot = lazy(() =>
  import("../chat/AgencyChatbotLauncher").then((module) => ({
    default: module.AgencyChatbotLauncher,
  })),
);

const LazyAddClientGlobalModal = lazy(() =>
  import("../clients/AddClientGlobalModal").then((module) => ({
    default: module.AddClientGlobalModal,
  })),
);

const LazySearchPalette = lazy(() =>
  import("../search/SearchPalette").then((module) => ({
    default: module.SearchPalette,
  })),
);

const LazyNotificationPane = lazy(() =>
  import("../notifications/NotificationPane").then((module) => ({
    default: module.NotificationPane,
  })),
);

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  noPadding?: boolean;
  hideBottomNav?: boolean;
}

function AppShellContent({ children, title, subtitle, noPadding = false, hideBottomNav = false }: AppShellProps) {
  const { profile } = useAuth();
  const { isAddClientModalOpen, isSearchPaletteOpen, isNotificationsOpen } = useGlobalUI();
  const isClient = profile?.role === "client";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ background: "#070b14" }}>
      {!isClient && (
        <>
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <Sidebar
            mobileOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          showMenuButton={!isClient}
          onMenuClick={() => setSidebarOpen((o) => !o)}
          actions={!isClient ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCopilotOpen(!copilotOpen)}
              className={cn("gap-2 border-primary/20 hover:border-primary/50 text-slate-400", copilotOpen && "bg-primary/10 text-primary border-primary/30")}
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">AI Copilot</span>
            </Button>
          ) : undefined}
        />

        <main
          className={cn(
            "flex-1 transition-all duration-300",
            !isClient && "lg-sidebar-offset"
          )}
          style={{
            marginLeft: isClient ? 0 : undefined,
            paddingTop: "var(--header-height)",
            minHeight: "100vh",
          }}
        >
          <div className={cn(
            !noPadding && "p-4 md:p-6 pb-24 lg:pb-6",
            noPadding && "h-full"
          )}>
            {children}
          </div>
        </main>

        {!isClient && !hideBottomNav && <BottomNav />}
      </div>

      {!isClient && (
        <aside
          className={cn(
            "fixed right-0 top-0 bottom-0 z-40 w-80 bg-[#070b14] border-l border-white/5 shadow-2xl transition-transform duration-300 ease-in-out transform",
            copilotOpen ? "translate-x-0" : "translate-x-full"
          )}
          style={{ paddingTop: "var(--header-height)" }}
        >
          <div className="h-full relative">
            {copilotOpen && (
              <Suspense fallback={null}>
                <LazyAdminCopilot />
              </Suspense>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCopilotOpen(false)}
              className="absolute -left-10 top-20 bg-[#070b14] border border-white/5 border-r-0 rounded-r-none h-10 w-10 text-white/50 hover:text-white"
            >
              <CloseIcon className="w-4 h-4" />
            </Button>
          </div>
        </aside>
      )}

      {isClient && (
        <Suspense fallback={null}>
          <LazyAgencyChatbot
            type="client"
            clientId={profile?.id}
            userId={profile?.id}
          />
        </Suspense>
      )}

      {isAddClientModalOpen && (
        <Suspense fallback={null}>
          <LazyAddClientGlobalModal />
        </Suspense>
      )}
      {isSearchPaletteOpen && (
        <Suspense fallback={null}>
          <LazySearchPalette />
        </Suspense>
      )}
      {isNotificationsOpen && (
        <Suspense fallback={null}>
          <LazyNotificationPane />
        </Suspense>
      )}
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <GlobalUIProvider>
      <AppShellContent {...props} />
    </GlobalUIProvider>
  );
}
