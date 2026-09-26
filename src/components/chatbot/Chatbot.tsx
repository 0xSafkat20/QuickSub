import SiteLink from '../ui/SiteLink';
import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ChevronRight, ChevronDown } from 'lucide-react';

const quickReplies = [
  'Contact on WhatsApp', 'Netflix Premium', 'Spotify Premium',
  'PUBG UC', 'Freefire Diamonds', 'ChatGPT',
  'Track My Order',
];

interface Message {
  id: number;
  text: string;
  isBot: boolean;
  url?: string;
}

export default function Chatbot() {
  useEffect(() => { const openChat = () => setOpen(true); window.addEventListener('quicksub:open-chat', openChat); return () => window.removeEventListener('quicksub:open-chat', openChat); }, []);
  const [open, setOpen] = useState(false);
  const [quickRepliesExpanded, setQuickRepliesExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, text: 'Hi! I’m QuickSub’s AI assistant. What do you need, and what’s your budget? 👋 Chat messages are sent to our AI provider. Please don’t share passwords, OTPs or payment PINs.', isBot: true },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [sending, setSending] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<string>();
  const nextId = useRef(1);

  const addBotReply = (text: string, url?: string) => {
    const id = nextId.current++;
    setMessages(prev => [...prev, { id, text, isBot: true, url }].slice(-60));
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setSending(true);
    const userId = nextId.current++;
    const replyId = nextId.current++;
    setMessages(prev => [...prev, { id: userId, text, isBot: false },
      { id: replyId, text: 'Thinking…', isBot: true }].slice(-60));
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionRef.current }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if ([400, 409, 429].includes(response.status)) {
          setMessages(prev => prev.map(msg => msg.id === replyId ? {
            ...msg, text: response.status === 429 ? 'Please wait a minute before sending another message.' : 'Please send a shorter message and try again.',
          } : msg));
          return;
        }
        throw new Error('Chat unavailable');
      }
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('Invalid reply');
      if (typeof data.sessionId === 'string') sessionRef.current = data.sessionId;
      setMessages(prev => prev.map(msg => msg.id === replyId ? { ...msg, text: data.reply } : msg));
      if (typeof data.url === 'string' && /^\/buy(?:\?text=[^\s]*)?$/.test(data.url)) {
        addBotReply(/[\u0980-\u09ff]/.test(data.reply) ? 'চেকআউটে যান' : 'Continue to checkout', data.url.replace('/buy', '/checkout'));
      }
    } catch {
      if (requestRef.current !== controller) return;
      setMessages(prev => prev.map(msg => msg.id === replyId ? {
        ...msg, text: 'Chat is temporarily unavailable. Please try again or contact us on WhatsApp.',
      } : msg));
      addBotReply('Contact WhatsApp support', '/api/support/whatsapp');
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setSending(false);
      }
    }
  };

  useEffect(() => () => {
    const controller = requestRef.current;
    requestRef.current = null;
    controller?.abort();
  }, []);

  const handleQuickReply = (reply: string) => {
    if (reply === 'Contact on WhatsApp') {
      addBotReply('You can contact us directly on WhatsApp for support.', '/api/support/whatsapp');
      return;
    }

    void sendMessage(reply);
  };

  const handleSend = () => {
    if (!input.trim() || requestRef.current) return;
    const msg = input.trim();
    setInput('');
    void sendMessage(msg);
  };

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, open]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('quicksub:open-chat', handler);
    return () => window.removeEventListener('quicksub:open-chat', handler);
  }, []);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-primary text-white flex items-center justify-center shadow-blue-lg hover:shadow-blue-xl transition-all duration-300 ${
          open ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100 animate-pulse-blue'
        }`}
        aria-label="Open chat"
      >
        <MessageCircle size={24} />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] w-[440px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-blue-xl border border-brand-100 flex flex-col overflow-hidden transition-all duration-300 ${
          open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
        style={{ height: 'min(640px, calc(100dvh - 3rem))', visibility: open ? 'visible' : 'hidden' }}
      >
        {/* Header */}
        <div className="gradient-primary p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">QuickSub Support</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-ping-slow" />
                <p className="text-[10px] text-white/75">AI shopping assistant</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-11 h-11 shrink-0 bg-white/15 hover:bg-white/25 rounded-lg flex items-center justify-center text-white transition-colors"
            aria-label="Close chat"
          >
            <X size={15} />
          </button>
        </div>

        {/* Messages */}
        <div role="log" aria-live="polite" aria-busy={sending} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3 bg-brand-50/30">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[90%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] ${
                  msg.isBot
                    ? 'bg-white border border-brand-100 text-ink-700 rounded-bl-sm shadow-sm'
                    : 'gradient-primary text-white rounded-br-sm shadow-sm'
                }`}
              >
                {msg.url ? (
                  <SiteLink
                    href={msg.url}
                    target={msg.url.startsWith("/api/support/") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 underline hover:text-blue-800"
                  >
                    {msg.text}
                  </SiteLink>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies */}
        <div className="px-4 pb-2 pt-2 flex-shrink-0 border-t border-brand-50">
          <div className="flex flex-wrap gap-1.5 pb-1" aria-label="Support chat suggestions">
            {quickReplies.slice(0, quickRepliesExpanded ? quickReplies.length : 3).map(reply => (
              <button
                key={reply}
                data-quick-reply
                onClick={() => handleQuickReply(reply)}
                disabled={sending && reply !== 'Contact on WhatsApp'}
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded-full text-xs text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-colors font-medium"
              >
                {reply} <ChevronRight size={10} />
              </button>
            ))}
            <button
              type="button"
              aria-expanded={quickRepliesExpanded}
              onClick={() => setQuickRepliesExpanded(value => !value)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-brand-200 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              {quickRepliesExpanded ? "Show less" : "Show more"}
              <ChevronDown
                size={12}
                className={quickRepliesExpanded ? "rotate-180 transition-transform" : "transition-transform"}
              />
            </button>
          </div>
        </div>

        {/* Input */}
        <div className="p-3 border-t border-brand-50 flex-shrink-0 bg-white">
          <form
            onSubmit={e => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <input
              value={input}
              maxLength={1500}
              aria-label="Message QuickSub support"
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
              className="min-w-0 flex-1 px-4 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:border-brand-300 focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="w-11 h-11 gradient-primary rounded-xl flex items-center justify-center text-white hover:shadow-blue-sm transition-all flex-shrink-0"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
