import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  MessageSquare,
  Video,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const bottomNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, roles: ["admin", "seo", "content", "developer", "team"] },
  { href: "/clients", label: "Clients", icon: Users, roles: ["admin", "seo", "content", "developer", "team"] },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, roles: ["admin", "seo", "content", "developer", "team"] },
  { href: "/messages", label: "Chat", icon: MessageSquare, roles: ["admin", "seo", "content", "developer", "team"] },
  { href: "/meetings", label: "Meetings", icon: Video, roles: ["admin", "seo", "content", "developer", "team"] },
  { href: "/documents", label: "Docs", icon: FolderOpen, roles: ["admin", "seo", "content", "developer", "team"] },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const userRole = (profile?.role || "client").toLowerCase();

  const items = bottomNavItems.filter((item) => item.roles.includes(userRole));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 lg:hidden z-50 flex items-center justify-around px-2 py-2"
      style={{
        background: "rgba(7, 11, 20, 0.97)",
        borderTop: "1px solid rgba(99, 128, 191, 0.12)",
        backdropFilter: "blur(20px)",
        height: "var(--bottom-nav-height)",
      }}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            to={href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-0",
              isActive
                ? "text-blue-400"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                isActive && "bg-blue-500/15"
              )}
            >
              <Icon size={18} />
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-wide leading-none truncate">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
