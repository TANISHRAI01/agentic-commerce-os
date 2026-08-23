'use client';

import React from 'react';

interface PolicyCheck {
  name: string;
  result: 'PASS' | 'FAIL';
  reason: string;
  details: {
    actual: number | string;
    limit: number | string;
  };
}

interface PolicyPanelProps {
  policyResult: {
    overall: 'PASS' | 'FAIL';
    requiresApproval: boolean;
    approvalReason?: string;
    checks: PolicyCheck[];
  };
  transactionState: string;
}

const CHECK_LABELS: Record<string, string> = {
  BUDGET_CHECK: 'Budget',
  AGENT_SPENDING_LIMIT: 'Agent Limit',
  MERCHANT_TRUST: 'Merchant Trust',
  CURRENCY_MATCH: 'Currency',
};

const CHECK_ICONS: Record<string, string> = {
  BUDGET_CHECK: '💰',
  AGENT_SPENDING_LIMIT: '🤖',
  MERCHANT_TRUST: '🏪',
  CURRENCY_MATCH: '💱',
};

function formatLimit(name: string, details: { actual: number | string; limit: number | string }): string {
  if (name === 'BUDGET_CHECK' || name === 'AGENT_SPENDING_LIMIT') {
    return `₹${Number(details.limit).toLocaleString('en-IN')}`;
  }
  if (name === 'MERCHANT_TRUST') {
    return String(details.actual);
  }
  return String(details.limit);
}

export default function PolicyPanel({ policyResult, transactionState }: PolicyPanelProps) {
  const isBlocked = transactionState === 'BLOCKED';
  const isApproved = transactionState === 'APPROVED' || transactionState === 'AUTO_APPROVED';
  const isWaiting = transactionState === 'APPROVAL_REQUIRED';

  return (
    <div className={`policy-panel ${isBlocked ? 'policy-panel-blocked' : ''}`}>
      <div className="policy-header">
        <span className="policy-title">🛡️ Policy Checks</span>
        <span className={`policy-overall-badge ${policyResult.overall === 'PASS' ? 'badge-pass' : 'badge-fail'}`}>
          {policyResult.overall}
        </span>
      </div>

      <div className="policy-checks">
        {policyResult.checks.map((check, i) => (
          <div key={i} className="policy-check-row">
            <span className="policy-check-icon">{CHECK_ICONS[check.name] || '📋'}</span>
            <span className="policy-check-name">{CHECK_LABELS[check.name] || check.name}</span>
            <span className="policy-check-limit">{formatLimit(check.name, check.details)}</span>
            <span className={`policy-check-badge ${check.result === 'PASS' ? 'badge-pass' : 'badge-fail'}`}>
              {check.result === 'PASS' ? '✓ PASS' : '✗ FAIL'}
            </span>
          </div>
        ))}
      </div>

      {/* Approval status row */}
      {policyResult.overall === 'PASS' && (
        <div className="policy-approval-row">
          <span className="policy-check-icon">📝</span>
          <span className="policy-check-name">Approval</span>
          <span className="policy-check-limit">
            {policyResult.requiresApproval ? 'Required' : 'Not required'}
          </span>
          <span className={`policy-check-badge ${
            isApproved ? 'badge-pass' :
            isWaiting ? 'badge-waiting' :
            isBlocked ? 'badge-fail' :
            'badge-waiting'
          }`}>
            {isApproved ? '✓ APPROVED' :
             isWaiting ? '⏳ WAITING' :
             isBlocked ? '✗ REJECTED' :
             policyResult.requiresApproval ? '⏳ WAITING' : '✓ AUTO'}
          </span>
        </div>
      )}

      {/* Status message */}
      {isBlocked && policyResult.overall === 'FAIL' && (
        <div className="policy-status-blocked">
          🚫 Transaction blocked — {policyResult.checks.filter(c => c.result === 'FAIL').map(c => c.reason).join('. ')}
        </div>
      )}

      {isApproved && (
        <div className="policy-status-approved">
          ✅ Authorization Granted
        </div>
      )}
    </div>
  );
}
