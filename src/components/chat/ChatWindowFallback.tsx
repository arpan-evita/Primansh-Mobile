import { cn } from "@/lib/utils";

export function ChatWindowFallback({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f1a]/90 shadow-2xl", className)}>
      <div className="h-16 border-b border-white/5 bg-white/[0.02]" />
      <div className="flex h-[360px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
      </div>
    </div>
  );
}
