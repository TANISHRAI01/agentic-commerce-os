'use client';

import { useState, useRef, useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import LoadingState from './components/LoadingState';
import DemoPanel from './components/DemoPanel';
import MerchantDashboard from './components/MerchantDashboard';

const SUGGESTIONS = [
  'Find me noise-cancelling headphones under ₹8,000',
  'Best laptop for a college student under ₹40,000',
  'A good book on productivity under ₹500',
  'Fitness tracker with heart rate monitor under ₹5,000',
  'Wireless earbuds with long battery under ₹3,000',
  'Something for my home kitchen under ₹4,000',
];

interface Message {
  id: string;
  type: 'user' | 'ai' | 'error';
  content: string;
  timestamp: string;
  shopResult?: Record<string, unknown>;
}

type ViewMode = 'chat' | 'dashboard';

export default function Home() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userQuery = query.trim();
    setQuery('');

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: userQuery,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          type: 'error',
          content: data.details || data.error || 'Something went wrong. Please try again.',
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } else {
        let negotiationResult = null;

        // ── Phase 9: Run negotiation if a product was selected ──
        if (data.transactionId && data.selectedProduct) {
          try {
            const negResponse = await fetch('/api/negotiate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transactionId: data.transactionId }),
            });
            if (negResponse.ok) {
              const negData = await negResponse.json();
              negotiationResult = negData.negotiationResult ?? null;
            }
          } catch {
            console.warn('Negotiation call failed, continuing without negotiation result');
          }
        }

        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          type: 'ai',
          content: data.message || 'Here are the results:',
          timestamp: new Date().toLocaleTimeString(),
          shopResult: { ...data, negotiationResult },
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'error',
        content: 'Network error. Please check your connection and try again.',
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    inputRef.current?.focus();
  };

  const handleDemoScenario = (scenarioQuery: string) => {
    setQuery(scenarioQuery);
    inputRef.current?.focus();
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="h-screen overflow-hidden flex bg-background text-on-surface">
      {/* SideNavBar */}
      <nav className="fixed left-0 top-0 h-full w-20 hover:w-64 transition-all duration-300 z-40 bg-surface-container-lowest/80 backdrop-blur-xl border-r border-outline-variant/10 shadow-lg flex flex-col py-stack_lg px-base_unit group">
        <div className="flex items-center px-4 mb-8 overflow-hidden whitespace-nowrap">
          <div className="w-10 h-10 rounded-full bg-surface-container flex-shrink-0 flex items-center justify-center border border-outline-variant/20 relative group-hover:mr-3 transition-all">
            <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Agent Core</h2>
            <p className="font-label-micro text-label-micro text-on-surface-variant uppercase">Autonomous Mode</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden px-2">
          <button className="w-full flex items-center p-3 text-on-surface-variant hover:bg-surface-variant/50 transition-all ease-in-out rounded-xl whitespace-nowrap" onClick={() => setViewMode('chat')}>
            <span className="material-symbols-outlined mr-4">history</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">History</span>
          </button>
          <button className="w-full flex items-center p-3 text-on-surface-variant hover:bg-surface-variant/50 transition-all ease-in-out rounded-xl whitespace-nowrap" onClick={() => setViewMode('dashboard')}>
            <span className="material-symbols-outlined mr-4">analytics</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">Analytics</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 ml-20 flex flex-col relative h-full">
        {/* TopNavBar */}
        <header className="fixed top-0 w-full z-50 bg-surface/40 backdrop-blur-md border-b border-outline-variant/20 flex justify-between items-center px-margin_mobile md:px-margin_desktop py-stack_md" style={{ width: 'calc(100% - 5rem)' }}>
          <div className="flex items-center gap-6">
            <h1 className="font-display-lg text-[24px] md:text-display-lg font-extrabold text-primary leading-none">Agentic OS</h1>
            <nav className="hidden md:flex gap-6 ml-8">
              <button 
                onClick={() => setViewMode('dashboard')}
                className={`transition-colors font-headline-sm text-headline-sm ${viewMode === 'dashboard' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`}>
                Dashboard
              </button>
              <button 
                onClick={() => setViewMode('chat')}
                className={`transition-colors font-headline-sm text-headline-sm ${viewMode === 'chat' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`}>
                Chat
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4 hidden md:flex">
             <div className="header-phase-badge font-label-micro text-label-micro text-on-surface-variant uppercase border border-outline-variant/30 px-3 py-1 rounded-full">Phase 9 — Complete</div>
          </div>
        </header>

        {viewMode === 'chat' && (
          <div className="flex-1 pt-24 pb-32 overflow-y-auto flex justify-center w-full relative z-10 custom-scrollbar">
            <div className="w-full max-w-[720px] px-margin_mobile md:px-0 flex flex-col gap-8">
              {!hasMessages && (
                <div className="text-center mt-12 mb-8">
                   <h2 className="custom-display-hero text-on-background mb-stack_lg text-[48px] leading-tight">Your AI Does the Shopping.</h2>
                   <p className="font-body-main text-[20px] text-secondary mb-12">Intent → Negotiation → Checkout. Fully autonomous.</p>
                   
                   <DemoPanel onSelectScenario={handleDemoScenario} disabled={isLoading} />
                   
                   <div className="flex flex-wrap justify-center gap-stack_sm mt-8">
                    {SUGGESTIONS.slice(0,3).map((s, i) => (
                      <div key={i} onClick={() => handleSuggestion(s)} className="flex items-center px-4 py-2 rounded-full border border-outline-variant/30 bg-surface-container-high/40 backdrop-blur-md cursor-pointer hover:bg-surface-variant/60 transition-colors">
                        <span className="font-label-micro text-label-micro text-on-surface-variant">{s}</span>
                      </div>
                    ))}
                   </div>
                </div>
              )}

              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  type={msg.type}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  shopResult={msg.shopResult as any}
                />
              ))}
              
              {isLoading && <LoadingState />}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Form */}
            <form onSubmit={handleSubmit} className="fixed bottom-stack_lg left-1/2 -translate-x-1/2 w-full max-w-[720px] px-margin_mobile md:px-0 z-50 ml-10 md:ml-10">
              <div className="bg-surface-container/40 backdrop-blur-xl border border-white/10 shadow-xl rounded-full flex items-center p-2 pl-6 focus-within:border-primary/50 focus-within:bg-surface-container/60 transition-all duration-300">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isLoading}
                  placeholder={isLoading ? 'Processing...' : 'Instruct agent...'}
                  className="flex-1 bg-transparent border-none text-on-surface font-body-main text-[16px] focus:ring-0 placeholder:text-on-surface-variant/50 h-10 outline-none"
                />
                <div className="flex items-center gap-2 ml-4">
                  <button type="submit" disabled={!query.trim() || isLoading} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${!query.trim() || isLoading ? 'bg-surface-variant text-on-surface-variant' : 'bg-primary-container text-on-primary-container hover:bg-primary ai-pulse'}`}>
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_upward</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {viewMode === 'dashboard' && (
          <div className="flex-1 pt-24 overflow-y-auto px-margin_mobile md:px-margin_desktop pb-12 w-full z-10 custom-scrollbar">
            <MerchantDashboard />
          </div>
        )}
      </main>

      {/* Footer Status */}
      <div className="fixed bottom-4 right-4 z-50 hidden md:flex items-center space-x-stack_md px-stack_md py-base_unit bg-surface-container-high/40 backdrop-blur-sm rounded-full border border-outline-variant/20">
        <span className="font-tabular-data text-tabular-data text-on-surface-variant text-xs">OS v1.0.4 - System Secure</span>
        <div className="w-px h-3 bg-outline-variant/50"></div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#4ade80]"></div>
          <span className="font-tabular-data text-tabular-data text-on-surface-variant text-xs">Razorpay Mode Active</span>
        </div>
      </div>
    </div>
  );
}
