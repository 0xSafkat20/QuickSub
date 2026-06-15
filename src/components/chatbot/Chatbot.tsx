import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ChevronRight } from 'lucide-react';

const quickReplies = [
  'Netflix Premium', 'Spotify Premium', 'PUBG UC',
  'Freefire Diamonds', 'ChatGPT', 'Track My Order',
  'Contact on WhatsApp',
];

interface Message {
  id: number;
  text: string;
  isBot: boolean;
  url?: string;
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, text: 'Hi! What are you looking for today? 👋', isBot: true },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const addBotReply = (text: string, url?: string) => {
    setMessages(prev => [...prev, { id: Date.now(), text, isBot: true, url }]);
  };

  const handleQuickReply = (reply: string) => {
    if (reply === 'Contact on WhatsApp') {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: 'You can contact us directly on WhatsApp for purchase or support.',
        isBot: true,
        url: '/buy',
      }]);
      return;
    }

    setMessages(prev => [...prev, { id: Date.now(), text: reply, isBot: false }]);
    setTimeout(() => {
      if (reply.includes('Track')) {
        addBotReply('Please enter your order ID or payment reference number.');
      } else {
        const message = `Hi, I want to order ${reply}. Please send me the package details and price.`;
        addBotReply(
          `Great choice! ${reply} is available. Click here to place your order on WhatsApp.`,
          `/buy?text=${encodeURIComponent(message)}`
        );
      }
    }, 600);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const msg = input;
    setMessages(prev => [...prev, { id: Date.now(), text: msg, isBot: false }]);
    setInput('');
    setTimeout(() => {
      addBotReply("Thanks for your message! Our support team will get back to you shortly. You can also check the FAQ section for quick answers.");
    }, 700);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

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
        className={`fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-blue-xl border border-brand-100 flex flex-col overflow-hidden transition-all duration-300 ${
          open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
        style={{ height: '490px' }}
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
                <p className="text-[10px] text-white/75">Online now</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 bg-white/15 hover:bg-white/25 rounded-lg flex items-center justify-center text-white transition-colors"
            aria-label="Close chat"
          >
            <X size={15} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-brand-50/30">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.isBot
                    ? 'bg-white border border-brand-100 text-ink-700 rounded-bl-sm shadow-sm'
                    : 'gradient-primary text-white rounded-br-sm shadow-sm'
                }`}
              >
                {msg.url ? (
                  <a
                    href={msg.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 underline hover:text-blue-800"
                  >
                    {msg.text}
                  </a>
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
          <div className="flex flex-wrap gap-1.5 pb-1">
            {quickReplies.map(reply => (
              <button
                key={reply}
                onClick={() => handleQuickReply(reply)}
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded-full text-xs text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-colors whitespace-nowrap font-medium"
              >
                {reply} <ChevronRight size={10} />
              </button>
            ))}
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
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:border-brand-300 focus:bg-white transition-all"
            />
            <button
              type="submit"
              className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center text-white hover:shadow-blue-sm transition-all flex-shrink-0"
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
