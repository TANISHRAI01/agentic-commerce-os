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
    outcomeClass: 'demo-outcome-success',
  },
  {
    id: 'rejection',
    icon: '🚫',
    title: 'Policy Rejection',
    description: 'Product exceeds agent spending limit. Policy engine blocks the purchase.',
    query: 'I need a premium laptop under ₹80,000 for video editing',
    outcome: 'POLICY_FAIL → BLOCKED',
    outcomeClass: 'demo-outcome-blocked',
  },
  {
    id: 'approval',
    icon: '⏳',
    title: 'Approval Required',
    description: 'Product costs > ₹3,000 approval threshold. Human must approve.',
    query: 'Find me wireless earbuds with long battery life under ₹4,500',
    outcome: 'APPROVAL_REQUIRED → approve/reject',
    outcomeClass: 'demo-outcome-approval',
  },
  {
    id: 'timeout',
    icon: '⚠️',
    title: 'Payment Timeout Recovery',
    description: 'Simulates payment timeout. System verifies before retry.',
    query: 'Find me a fitness tracker with heart rate monitor under ₹3,000',
    outcome: 'PAYMENT_UNKNOWN → recover → COMPLETED',
    outcomeClass: 'demo-outcome-warning',
    note: 'Set PAYMENT_SIM_MODE=TIMEOUT_THEN_SUCCESS in .env and restart the dev server.',
  },
];

export default function DemoPanel({ onSelectScenario, disabled }: DemoPanelProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="demo-panel">
      <button
        className="demo-panel-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="demo-panel-toggle-icon">🧪</span>
        <span className="demo-panel-toggle-title">Demo Scenarios — Test Mode</span>
        <span className="demo-panel-toggle-chevron">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="demo-panel-body">
          <div className="demo-scenarios-grid">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                className={`demo-scenario-card demo-scenario-${scenario.id}`}
                onClick={() => onSelectScenario(scenario.query)}
                disabled={disabled}
              >
                <div className="demo-scenario-header">
                  <span className="demo-scenario-icon">{scenario.icon}</span>
                  <span className="demo-scenario-title">{scenario.title}</span>
                </div>
                <p className="demo-scenario-desc">{scenario.description}</p>
                <div className={`demo-scenario-outcome ${scenario.outcomeClass}`}>
                  {scenario.outcome}
                </div>
                {scenario.note && (
                  <div className="demo-scenario-note">⚙️ {scenario.note}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
