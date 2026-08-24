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

/**
 * Generate a plain-language explanation from policy check data.
 * No LLM involvement — purely deterministic string construction.
 */
function getSimpleExplanation(
  policyResult: PolicyPanelProps['policyResult'],
  transactionState: string,
): string {
  const failedChecks = policyResult.checks.filter(c => c.result === 'FAIL');

  if (policyResult.overall === 'FAIL' && failedChecks.length > 0) {
    const first = failedChecks[0];
    if (first.name === 'AGENT_SPENDING_LIMIT') {
      return `Purchase blocked because the product costs ₹${Number(first.details.actual).toLocaleString('en-IN')}, which exceeds your agent's spending limit of ₹${Number(first.details.limit).toLocaleString('en-IN')}.`;
    }
    if (first.name === 'BUDGET_CHECK') {
      return `Purchase blocked because the product costs ₹${Number(first.details.actual).toLocaleString('en-IN')}, which exceeds your budget of ₹${Number(first.details.limit).toLocaleString('en-IN')}.`;
    }
    if (first.name === 'MERCHANT_TRUST') {
      return `Purchase blocked because the merchant's trust tier (${first.details.actual}) is not in the allowed tiers.`;
    }
    return `Purchase blocked: ${first.reason}`;
  }

  if (policyResult.requiresApproval) {
    const agentCheck = policyResult.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT');
    const actual = agentCheck ? Number(agentCheck.details.actual) : 0;
    if (transactionState === 'APPROVED') {
      return `Purchase approved. The product costs ₹${actual.toLocaleString('en-IN')}, which was above the auto-approval threshold and required your confirmation.`;
    }
    if (transactionState === 'BLOCKED') {
      return `Purchase rejected. You declined the approval for this ₹${actual.toLocaleString('en-IN')} purchase.`;
    }
    return `This purchase needs your approval because it costs ₹${actual.toLocaleString('en-IN')}, which is above the auto-approval threshold.`;
  }

  // All pass, auto-approved
  const agentCheck = policyResult.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT');
  const budgetCheck = policyResult.checks.find(c => c.name === 'BUDGET_CHECK');
  const actual = agentCheck ? Number(agentCheck.details.actual) : 0;
  const agentLimit = agentCheck ? Number(agentCheck.details.limit) : 0;
  const budget = budgetCheck ? Number(budgetCheck.details.limit) : 0;

  return `Purchase allowed because the product costs ₹${actual.toLocaleString('en-IN')} and your limits are ₹${budget.toLocaleString('en-IN')} (budget) and ₹${agentLimit.toLocaleString('en-IN')} (agent).`;
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

      {/* Simple explanation */}
      <div className={`policy-simple-explanation ${policyResult.overall === 'PASS' ? 'policy-explanation-pass' : 'policy-explanation-fail'}`}>
        {getSimpleExplanation(policyResult, transactionState)}
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
