'use client';

import React, { useState } from 'react';

interface DemoPanelProps {
  onSelectScenario: (query: string) => void;
  disabled?: boolean;
}

interface DemoScenario {
  id: string;
  icon: string;
  title: string;
  description: string;
  query: string;
  outcome: string;
  outcomeClass: string;
  note?: string;
}

const SCENARIOS: DemoScenario[] = [
  {
    id: 'success',
    icon: '✅',
    title: 'Successful Purchase',
    description: 'Product under agent limit, auto-approved, Razorpay checkout completes.',
    query: 'Find me noise-cancelling headphones under ₹4,000 available within 3 days',
    outcome: 'AUTO_APPROVED → COMPLETED',
    outcomeClass: 'text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20',
  },
  {
    id: 'rejection',
    icon: '🚫',
    title: 'Policy Rejection',
    description: 'Product exceeds agent spending limit. Policy engine blocks the purchase.',
    query: 'I need a premium laptop under ₹80,000 for video editing',
    outcome: 'POLICY_FAIL → BLOCKED',
    outcomeClass: 'text-error bg-error/10 border-error/20',
  },
  {
    id: 'approval',
    icon: '⏳',
    title: 'Approval Required',
    description: 'Product costs > ₹3,000 approval threshold. Human must approve.',
    query: 'Find me wireless earbuds with long battery life under ₹4,500',
    outcome: 'APPROVAL_REQUIRED → approve/reject',
    outcomeClass: 'text-secondary bg-secondary/10 border-secondary/20',
  },
  {
    id: 'timeout',
    icon: '⚠️',
    title: 'Payment Timeout Recovery',
    description: 'Simulates payment timeout. System verifies before retry.',
    query: 'Find me a fitness tracker with heart rate monitor under ₹3,000',
    outcome: 'PAYMENT_UNKNOWN → recover → COMPLETED',
    outcomeClass: 'text-warning bg-warning/10 border-warning/20',
    note: 'Set PAYMENT_SIM_MODE=TIMEOUT_THEN_SUCCESS in .env and restart the dev server.',
  },
];

export default function DemoPanel({ onSelectScenario, disabled }: DemoPanelProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="w-full mb-8">
      <button
        className="flex items-center gap-2 mx-auto font-label-micro text-label-micro uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="material-symbols-outlined text-[16px]">science</span>
        <span>Demo Scenarios — Test Mode</span>
        <span className="material-symbols-outlined text-[16px] transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
      </button>

      {expanded && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              className="glass-panel p-4 rounded-xl border border-outline-variant/20 hover:border-outline-variant/50 hover:bg-surface-variant/30 transition-all text-left flex flex-col group disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onSelectScenario(scenario.query)}
              disabled={disabled}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{scenario.icon}</span>
                <span className="font-headline-sm text-sm text-on-surface group-hover:text-primary transition-colors">{scenario.title}</span>
              </div>
              <p className="font-body-main text-xs text-on-surface-variant mb-4 flex-1">
                {scenario.description}
              </p>
              <div className={`font-tabular-data text-[10px] uppercase px-2 py-1 rounded border inline-block w-fit mb-2 ${scenario.outcomeClass}`}>
                {scenario.outcome}
              </div>
              {scenario.note && (
                <div className="font-body-main text-[10px] text-on-surface-variant bg-surface-variant/50 px-2 py-1 rounded mt-auto border border-outline-variant/10">
                  ⚙️ {scenario.note}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
