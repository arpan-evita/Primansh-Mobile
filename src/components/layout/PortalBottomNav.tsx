import { Link, useLocation, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  FileText,
  MessageSquare,
  Video,
  CreditCard,
  FolderOpen,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function PortalBottomNav() {
  const { pathname } = useLocation();
  const { slug } = useParams<{ slug: string }>();

  const navItems = [
    { href: `/clientportal/${slug}`, label: "Home", icon: LayoutDashboard },
    { href: `/clientportal/${slug}/seo`, label: "SEO", icon: Search },
    { href: `/clientportal/${slug}/tasks`, label: "Tasks", icon: FileText },
    { href: `/clientportal/${slug}/messages`, label: "Chat", icon: MessageSquare },
    { href: `/clientportal/${slug}/meetings`, label: "Meetings", icon: Video },
    { href: `/clientportal/${slug}/documents`, label: "Docs", icon: FolderOpen },
    { href: `/clientportal/${slug}/billing`, label: "Billing", icon: CreditCard },
    { href: `/clientportal/${slug}/connection`, label: "Connect", icon: Zap },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 lg:hidden z-50 flex items-center justify-around px-2 py-2"
      style={{
        background: "rgba(7, 11, 20, 0.97)",
        borderTop: "1px solid rgba(99, 128, 191, 0.12)",
        backdropFilter: "blur(20px)",
        height: "var(--bottom-nav-height, 64px)",
      }}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== `/clientportal/${slug}` && pathname.startsWith(href));
        
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
