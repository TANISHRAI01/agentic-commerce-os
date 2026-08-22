'use client';

import { useState } from 'react';

const SUGGESTIONS = [
  'Find me noise-cancelling headphones under ₹8,000',
  'Best laptop for a college student under ₹40,000',
  'A good book on productivity under ₹500',
  'Fitness tracker with heart rate monitor under ₹5,000',
];

export default function Home() {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    // Phase 2 will wire this to the AI pipeline
    console.log('Intent:', query);
  };

  const handleSuggestion = (suggestion: string) => {
    setQuery(suggestion);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">⚡</div>
          <div>
            <div className="header-title">Agentic Commerce OS</div>
            <div className="header-subtitle">AI-Powered Shopping Assistant</div>
          </div>
        </div>
        <div className="header-status">
          <span className="status-dot" />
          <span>Phase 1 — Foundation Ready</span>
        </div>
      </header>

      {/* Chat Area */}
      <main className="chat-container">
        <div className="chat-messages">
          <div className="chat-welcome">
            <div className="chat-welcome-icon">🛒</div>
            <h2>What would you like to buy?</h2>
            <p>
              Tell me what you&apos;re looking for in plain English. I&apos;ll search the catalog,
              find the best options, check your budget, and handle the checkout — all with
              complete transparency and your approval.
            </p>
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
        </div>

        {/* Input */}
        <form className="chat-input-area" onSubmit={handleSubmit}>
          <input
            id="shopping-intent-input"
            className="chat-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what you want to buy..."
            autoComplete="off"
          />
          <button
            id="send-intent-btn"
            className="chat-send-btn"
            type="submit"
            disabled={!query.trim()}
          >
            Search →
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="footer">
        Razorpay AI Buildathon 2026 · Track 01 — AI Growth & Agentic Commerce ·{' '}
        <a href="https://github.com/TANISHRAI01/agentic-commerce-os" target="_blank" rel="noopener">
          GitHub
        </a>
      </footer>
    </div>
  );
}
