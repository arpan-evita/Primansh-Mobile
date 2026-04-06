import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Bot, Sparkles, Zap, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { LeadCaptureForm } from './LeadCaptureForm';
import { MeetingCard } from './MeetingCard';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export type BotType = 'website' | 'admin' | 'client' | 'terminal';

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
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const greetings = {
            website: "Welcome to Primansh! I'm your Growth Consultant. Want to see how we can scale your practice to 25L+ monthly revenue?",
            admin: "Director, operational insights are ready. Which client or metric should we analyze for high-impact growth?",
            client: "Hello! I'm your dedicated Assistant. I'm here to translate task progress into growth ROI. What's on your mind?",
            terminal: "Strategy Director initialized. Ready to optimize agency operations. Access granted to: [Clients, Analytics, Leads, Tasks]. How shall we execute today?"
        };
        setMessages([{ role: 'assistant', content: greetings[type] }]);
    }, [type]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async (content?: string) => {
        const text = content || inputValue;
        if (!text.trim()) return;

        const newMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, newMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke('chat-router', {
                body: { messages: [...messages, newMsg], botType: type === 'terminal' ? 'admin' : type, clientId, userId },
                headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
                }
            });
            
            if (error) throw error;
            
            if (data?.response) {
                let responseText = data.response;
                if (responseText.includes('[SHOW_LEAD_FORM]')) {
                    responseText = responseText.replace('[SHOW_LEAD_FORM]', '');
                    setShowLeadForm(true);
                }
                
                const meetingMatch = responseText.match(/\[SHOW_MEETING_CARD:(.*?)\]/);
                if (meetingMatch) {
                    responseText = responseText.replace(meetingMatch[0], '');
                    setActiveMeeting(meetingMatch[1]);
                }

                setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
            }
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm having a bit of trouble connecting to the growth matrix. Please try again!" }]);
        } finally {
            setIsLoading(false);
        }
    };

    const config = {
        website: { gradient: "from-blue-600 to-indigo-700", label: "Growth Consultant", icon: Zap, theme: 'light' },
        admin: { gradient: "from-slate-800 to-slate-900", label: "Strategy Director", icon: Bot, theme: 'dark' },
        client: { gradient: "from-emerald-600 to-teal-700", label: "ROI Assistant", icon: Sparkles, theme: 'light' },
        terminal: { gradient: "from-black to-slate-900", label: "Admin Copilot", icon: Bot, theme: 'terminal' }
    }[type];

    const isTerminal = type === 'terminal';

    return (
        <div className={cn(
            "flex flex-col overflow-hidden h-full",
            !isDrawer && "w-[350px] max-h-[550px] bg-white border border-gray-100 rounded-3xl shadow-2xl",
            isTerminal && "bg-[#070b14] border-white/5 font-mono text-xs"
        )}
        style={!isDrawer ? { borderBottomRightRadius: '0' } : {}}
        >
            {/* Header */}
            <div className={cn(
                "p-4 text-white flex justify-between items-start",
                isTerminal ? "border-b border-white/5 bg-black/20" : cn("bg-gradient-to-br", config.gradient)
            )}>
                <div className="flex gap-3 items-center">
                    {!isTerminal && (
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <config.icon className="w-6 h-6 text-white" />
                        </div>
                    )}
                    <div className="space-y-0.5">
                        <h3 className={cn("font-bold leading-tight", !isTerminal && "text-lg font-serif", isTerminal && "uppercase tracking-widest text-primary text-[10px]")}>
                            {isTerminal && "SYS> "} {config.label}
                        </h3>
                        {!isTerminal && <p className="text-white/80 text-xs flex items-center gap-1.5 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active Context
                        </p>}
                    </div>
                </div>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 -mt-1 -mr-2">
                        <X className="w-5 h-5" />
                    </Button>
                )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-5">
                <div className="space-y-5">
                    {messages.map((msg, i) => (
                        <div key={i} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                            {isTerminal ? (
                                <div className="flex gap-2 w-full">
                                    <span className={cn("shrink-0", msg.role === 'user' ? "text-primary" : "text-white/50")}>
                                        {msg.role === 'user' ? "USER>" : "SYS>"}
                                    </span>
                                    <div className="flex-1 prose prose-invert prose-xs max-w-none">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                </div>
                            ) : (
                                <div className={cn(
                                    "max-w-[90%] px-4 py-3 text-sm leading-relaxed shadow-sm", 
                                    msg.role === 'user' 
                                        ? "bg-slate-900 text-white rounded-2xl rounded-tr-none" 
                                        : "bg-gray-50 text-gray-700 rounded-2xl rounded-tl-none border border-gray-100"
                                )}>
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
                        <div className={cn("flex gap-2 items-center", isTerminal && "text-white/30 italic")}>
                           {!isTerminal && <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '200ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '400ms' }} />
                            </div>}
                            <span className={cn("text-[10px] font-bold uppercase tracking-widest", !isTerminal && "text-muted-foreground")}>
                                {isTerminal ? "EXECUTING ANALYSIS..." : "Thinking"}
                            </span>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className={cn("p-4 border-t", isTerminal ? "border-white/5 bg-black/40" : "border-gray-50 bg-gray-50/20")}>
                <div className="relative flex items-center">
                    <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={isTerminal ? "RUN COMMAND..." : "Type your message..."}
                        className={cn(
                            "w-full py-3 h-10 text-sm focus:outline-none transition-all",
                            isTerminal 
                                ? "bg-black/50 border-white/10 rounded-sm font-mono text-[11px] px-2 text-primary focus:border-primary/50" 
                                : "pl-4 pr-12 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary/20 placeholder:text-gray-400"
                        )}
                    />
                    {!isTerminal && (
                        <Button 
                            size="icon" 
                            onClick={() => handleSend()} 
                            disabled={isLoading || !inputValue.trim()} 
                            className="absolute right-1.5 w-8 h-8 rounded-xl shadow-lg transition-transform active:scale-95"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </Button>
                    )}
                    {isTerminal && <div className="absolute right-2 text-white/20 select-none">⏎</div>}
                </div>
                <p className="text-center text-[10px] text-gray-500 mt-2 font-medium">
                    {isTerminal ? "> STANDBY MODE ACTIVE" : `Agency OS • ${type.toUpperCase()}`}
                </p>
            </div>
        </div>
    );
}

interface AgencyChatbotProps {
    type: BotType;
    clientId?: string;
    userId?: string;
    className?: string;
}

export function AgencyChatbot({ type, clientId, userId, className }: AgencyChatbotProps) {
    const [isOpen, setIsOpen] = useState(false);

    const config = {
        website: { gradient: "from-blue-600 to-indigo-700", icon: MessageSquare },
        admin: { gradient: "from-slate-800 to-slate-900", icon: Bot },
        client: { gradient: "from-emerald-600 to-teal-700", icon: Sparkles },
        terminal: { gradient: "from-black to-slate-900", icon: Bot }
    }[type];

    return (
        <div className={cn("fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none", className)}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="mb-4 pointer-events-auto"
                    >
                        <ChatWindow 
                            type={type} 
                            clientId={clientId} 
                            userId={userId} 
                            onClose={() => setIsOpen(false)} 
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Float Trigger */}
            <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center pointer-events-auto border border-white/20 transition-all",
                    isOpen ? "bg-white text-gray-800" : `bg-gradient-to-br text-white ${config.gradient}`
                )}
            >
                {isOpen ? <X className="w-6 h-6" /> : <config.icon className="w-8 h-8" />}
            </motion.button>
        </div>
    );
}
