import { lazy, Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bot, Sparkles, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotType } from "./ChatWindow";
import { ChatWindowFallback } from "./ChatWindowFallback";

const LazyChatWindow = lazy(() =>
  import("./ChatWindow").then((module) => ({
    default: module.ChatWindow,
  })),
);

interface AgencyChatbotLauncherProps {
  type: BotType;
  clientId?: string;
  userId?: string;
  className?: string;
}

export function AgencyChatbotLauncher({ type, clientId, userId, className }: AgencyChatbotLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const config = {
    website: { gradient: "from-blue-600 to-indigo-700", icon: MessageSquare },
    admin: { gradient: "from-slate-800 to-slate-900", icon: Bot },
    client: { gradient: "from-emerald-600 to-teal-700", icon: Sparkles },
    terminal: { gradient: "from-black to-slate-900", icon: Bot },
  }[type];

  return (
    <div className={cn("pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end", className)}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="pointer-events-auto mb-4"
          >
            <Suspense fallback={<ChatWindowFallback className="w-[350px]" />}>
              <LazyChatWindow type={type} clientId={clientId} userId={userId} onClose={() => setIsOpen(false)} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "pointer-events-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 text-white shadow-2xl transition-all",
          isOpen ? "bg-white text-gray-800" : `bg-gradient-to-br ${config.gradient}`,
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <config.icon className="h-8 w-8" />}
      </motion.button>
    </div>
  );
}
