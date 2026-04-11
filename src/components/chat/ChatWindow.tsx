import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { X, Send, Bot, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { LeadCaptureForm } from "./LeadCaptureForm";
import { MeetingCard } from "./MeetingCard";

export type BotType = "website" | "admin" | "client" | "terminal";

interface ChatWindowProps {
  type: BotType;
  clientId?: string;
  userId?: string;
  onClose?: () => void;
  isDrawer?: boolean;
}

export function ChatWindow({ type, clientId, userId, onClose, isDrawer }: ChatWindowProps) {
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const greetings = {
      website: "Welcome to Primansh! I'm your Growth Consultant. Want to see how we can scale your practice to 25L+ monthly revenue?",
      admin: "Director, operational insights are ready. Which client or metric should we analyze for high-impact growth?",
      client: "Hello! I'm your dedicated Assistant. I'm here to translate task progress into growth ROI. What's on your mind?",
      terminal: "Strategy Director initialized. Ready to optimize agency operations. Access granted to: [Clients, Analytics, Leads, Tasks]. How shall we execute today?",
    };

    setMessages([{ role: "assistant", content: greetings[type] }]);
  }, [type]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (content?: string) => {
    const text = content || inputValue;
    if (!text.trim()) return;

    const newMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, newMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat-router", {
        body: {
          messages: [...messages, newMsg],
          botType: type === "terminal" ? "admin" : type,
          clientId,
          userId,
        },
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
      });

      if (error) throw error;

      if (data?.response) {
        let responseText = data.response;
        if (responseText.includes("[SHOW_LEAD_FORM]")) {
          responseText = responseText.replace("[SHOW_LEAD_FORM]", "");
          setShowLeadForm(true);
        }

        const meetingMatch = responseText.match(/\[SHOW_MEETING_CARD:(.*?)\]/);
        if (meetingMatch) {
          responseText = responseText.replace(meetingMatch[0], "");
          setActiveMeeting(meetingMatch[1]);
        }

        setMessages((prev) => [...prev, { role: "assistant", content: responseText }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having a bit of trouble connecting to the growth matrix. Please try again!" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const config = {
    website: { gradient: "from-blue-600 to-indigo-700", label: "Growth Consultant", icon: Zap },
    admin: { gradient: "from-slate-800 to-slate-900", label: "Strategy Director", icon: Bot },
    client: { gradient: "from-emerald-600 to-teal-700", label: "ROI Assistant", icon: Sparkles },
    terminal: { gradient: "from-black to-slate-900", label: "Admin Copilot", icon: Bot },
  }[type];

  const isTerminal = type === "terminal";

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden",
        !isDrawer && "max-h-[550px] w-[350px] rounded-3xl border border-gray-100 bg-white shadow-2xl",
        isTerminal && "border-white/5 bg-[#070b14] font-mono text-xs",
      )}
      style={!isDrawer ? { borderBottomRightRadius: "0" } : {}}
    >
      <div
        className={cn(
          "flex items-start justify-between p-4 text-white",
          isTerminal ? "border-b border-white/5 bg-black/20" : cn("bg-gradient-to-br", config.gradient),
        )}
      >
        <div className="flex items-center gap-3">
          {!isTerminal && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <config.icon className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="space-y-0.5">
            <h3
              className={cn(
                "font-bold leading-tight",
                !isTerminal && "font-serif text-lg",
                isTerminal && "text-[10px] uppercase tracking-widest text-primary",
              )}
            >
              {isTerminal && "SYS> "} {config.label}
            </h3>
            {!isTerminal && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Context
              </p>
            )}
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2 -mt-1 text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-5">
        <div className="space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}>
              {isTerminal ? (
                <div className="flex w-full gap-2">
                  <span className={cn("shrink-0", msg.role === "user" ? "text-primary" : "text-white/50")}>
                    {msg.role === "user" ? "USER>" : "SYS>"}
                  </span>
                  <div className="prose prose-invert prose-xs max-w-none flex-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                    msg.role === "user"
                      ? "rounded-tr-none bg-slate-900 text-white"
                      : "rounded-tl-none border border-gray-100 bg-gray-50 text-gray-700",
                  )}
                >
                  <div className="prose prose-sm max-w-none prose-p:m-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}

          {showLeadForm && (
            <div className="py-2">
              <LeadCaptureForm onComplete={() => setShowLeadForm(false)} />
            </div>
          )}

          {activeMeeting && (
            <div className="py-2">
              <MeetingCard
                meetingId={activeMeeting}
                status="active"
                startTime={new Date().toISOString()}
                isOwn={false}
                onJoin={(id) => {
                  toast.success("Opening Meeting Room...");
                  window.location.href = `/meeting/${id}`;
                }}
              />
            </div>
          )}

          {isLoading && (
            <div className={cn("flex items-center gap-2", isTerminal && "italic text-white/30")}>
              {!isTerminal && (
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: "200ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: "400ms" }} />
                </div>
              )}
              <span className={cn("text-[10px] font-bold uppercase tracking-widest", !isTerminal && "text-muted-foreground")}>
                {isTerminal ? "EXECUTING ANALYSIS..." : "Thinking"}
              </span>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className={cn("border-t p-4", isTerminal ? "border-white/5 bg-black/40" : "border-gray-50 bg-gray-50/20")}>
        <div className="relative flex items-center">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={isTerminal ? "RUN COMMAND..." : "Type your message..."}
            className={cn(
              "h-10 w-full py-3 text-sm transition-all focus:outline-none",
              isTerminal
                ? "rounded-sm border-primary/10 bg-black/50 px-2 font-mono text-[11px] text-primary focus:border-primary/50"
                : "rounded-2xl border border-gray-200 bg-white pl-4 pr-12 placeholder:text-gray-400 focus:ring-2 focus:ring-primary/20",
            )}
          />
          {!isTerminal && (
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={isLoading || !inputValue.trim()}
              className="absolute right-1.5 h-8 w-8 rounded-xl shadow-lg transition-transform active:scale-95"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
          {isTerminal && <div className="absolute right-2 select-none text-white/20">Enter</div>}
        </div>
        <p className="mt-2 text-center text-[10px] font-medium text-gray-500">
          {isTerminal ? "> STANDBY MODE ACTIVE" : `Agency OS • ${type.toUpperCase()}`}
        </p>
      </div>
    </div>
  );
}

export function ChatWindowLoader({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f1a]/90 shadow-2xl", className)}>
      <div className="h-16 border-b border-white/5 bg-white/[0.02]" />
      <div className="flex h-[360px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
      </div>
    </div>
  );
}
