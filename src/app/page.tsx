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
            // Negotiation is non-fatal — shop continues without it
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
    <div className="page-container">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">⚡</div>
          <div>
            <div className="header-title">Agentic Commerce OS</div>
            <div className="header-subtitle">AI-Powered Shopping · Razorpay Buildathon 2026</div>
          </div>
        </div>
        <div className="header-badges">
          <div className="header-view-toggle">
            <button
              id="view-chat-btn"
              className={`view-toggle-btn ${viewMode === 'chat' ? 'view-toggle-active' : ''}`}
              onClick={() => setViewMode('chat')}
            >
              💬 Shop
            </button>
            <button
              id="view-dashboard-btn"
              className={`view-toggle-btn ${viewMode === 'dashboard' ? 'view-toggle-active' : ''}`}
              onClick={() => setViewMode('dashboard')}
            >
              📊 Dashboard
            </button>
          </div>
          <div className="header-status">
            <span className="status-dot" />
            <span>Live</span>
          </div>
          <div className="header-phase-badge">Phase 8 — Merchant AI</div>
        </div>
      </header>

      {/* Demo Panel - only in chat mode */}
      {viewMode === 'chat' && (
        <DemoPanel onSelectScenario={handleDemoScenario} disabled={isLoading} />
      )}

      {/* Dashboard View */}
      {viewMode === 'dashboard' && (
        <main className="dashboard-main">
          <MerchantDashboard />
        </main>
      )}

      {/* Chat Area */}
      {viewMode === 'chat' && (
      <main className="chat-container">
        <div className="chat-messages">
          {!hasMessages && (
            <div className="chat-welcome">
              <div className="chat-welcome-glow" />
              <div className="chat-welcome-icon">🛒</div>
              <h2>What would you like to buy?</h2>
              <p className="chat-welcome-subtitle">
                Describe what you need in plain English. The AI will search the catalog,
                recommend the best product, run policy checks, and process payment &mdash;
                with every decision fully auditable.
              </p>
              <div className="chat-welcome-features">
                <div className="welcome-feature">
                  <span>🎯</span>
                  <span>AI Recommendation</span>
                </div>
                <div className="welcome-feature">
                  <span>🛡️</span>
                  <span>Policy Engine</span>
                </div>
                <div className="welcome-feature">
                  <span>💳</span>
                  <span>Razorpay Checkout</span>
                </div>
                <div className="welcome-feature">
                  <span>📋</span>
                  <span>Full Audit Trail</span>
                </div>
              </div>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    className="suggestion-chip"
                    onClick={() => handleSuggestion(s)}
                  >
                    {s}
                  </button>
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

        {/* Input */}
        <form className="chat-input-area" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            id="shopping-intent-input"
            className="chat-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isLoading ? 'Processing your request...' : 'Describe what you want to buy...'}
            autoComplete="off"
            disabled={isLoading}
          />
          <button
            id="send-intent-btn"
            className="chat-send-btn"
            type="submit"
            disabled={!query.trim() || isLoading}
          >
            {isLoading ? (
              <span className="btn-spinner" />
            ) : (
              'Search →'
            )}
          </button>
        </form>
      </main>
      )}  {/* end chat view */}


      {/* Footer */}
      <footer className="footer">
        Razorpay AI Buildathon 2026 · Track 01 — AI Growth &amp; Agentic Commerce ·{' '}
        <a href="https://github.com/TANISHRAI01/agentic-commerce-os" target="_blank" rel="noopener">
          GitHub
        </a>
      </footer>
    </div>
  );
}
