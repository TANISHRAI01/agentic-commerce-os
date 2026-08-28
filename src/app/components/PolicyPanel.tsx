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

function formatLimit(name: string, details: { actual: number | string; limit: number | string }): string {
  if (name === 'BUDGET_CHECK' || name === 'AGENT_SPENDING_LIMIT') {
    return `₹${Number(details.limit).toLocaleString('en-IN')}`;
  }
  if (name === 'MERCHANT_TRUST') {
    return String(details.actual);
  }
  return String(details.limit);
}

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

  const agentCheck = policyResult.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT');
  const budgetCheck = policyResult.checks.find(c => c.name === 'BUDGET_CHECK');
  const actual = agentCheck ? Number(agentCheck.details.actual) : 0;
  const agentLimit = agentCheck ? Number(agentCheck.details.limit) : 0;
  const budget = budgetCheck ? Number(budgetCheck.details.limit) : 0;

  return `Within budget (₹${budget.toLocaleString('en-IN')}) and agent limit (₹${agentLimit.toLocaleString('en-IN')}).`;
}

export default function PolicyPanel({ policyResult, transactionState }: PolicyPanelProps) {
  const isBlocked = transactionState === 'BLOCKED';
  const isApproved = transactionState === 'APPROVED' || transactionState === 'AUTO_APPROVED';
  const isWaiting = transactionState === 'APPROVAL_REQUIRED';

  if (policyResult.overall === 'PASS' && !policyResult.requiresApproval) {
    return (
      <div className="rounded-xl border border-[#1b4d3e]/30 bg-[#0a1a15]/40 flex items-center p-3 gap-3">
        <span className="material-symbols-outlined text-[#4ade80]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        <p className="font-body-main text-body-main text-[#4ade80] text-sm">
          {getSimpleExplanation(policyResult, transactionState)}
        </p>
      </div>
    );
  }

  if (isBlocked || policyResult.overall === 'FAIL') {
    return (
      <div className="rounded-xl border border-error/30 bg-[#351000]/40 flex items-start p-4 gap-3">
        <span className="material-symbols-outlined text-error mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
        <div>
          <p className="font-headline-sm text-error text-sm mb-1">Policy Check Failed</p>
          <p className="font-body-main text-body-main text-error/80 text-sm">
            {getSimpleExplanation(policyResult, transactionState)}
          </p>
        </div>
      </div>
    );
  }

  if (policyResult.requiresApproval) {
    return (
      <div className="rounded-xl border border-secondary/30 bg-[#352500]/40 flex items-start p-4 gap-3">
        <span className="material-symbols-outlined text-secondary mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>policy</span>
        <div className="flex-1">
          <p className="font-headline-sm text-secondary text-sm mb-1">Approval Required</p>
          <p className="font-body-main text-body-main text-secondary/80 text-sm mb-3">
            {getSimpleExplanation(policyResult, transactionState)}
          </p>
          
          <div className="bg-surface-container-lowest/50 rounded p-3">
            <p className="font-label-micro text-label-micro text-on-surface-variant uppercase mb-2">Check Details</p>
            {policyResult.checks.map((check, i) => (
              <div key={i} className="flex justify-between items-center text-xs mb-1 last:mb-0">
                <span className="text-on-surface-variant">{CHECK_LABELS[check.name] || check.name}</span>
                <span className="text-on-surface font-tabular-data">{formatLimit(check.name, check.details)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
