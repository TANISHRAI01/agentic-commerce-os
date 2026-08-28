'use client';

import React, { useState } from 'react';

interface PolicyCheck {
  name: string;
  result: 'PASS' | 'FAIL';
  reason: string;
  details: { actual: number | string; limit: number | string };
}

interface ApprovalDialogProps {
  transactionId: string;
  productName: string;
  productPrice: number;
  merchantTrustTier: string;
  policyResult: {
    overall: 'PASS' | 'FAIL';
    requiresApproval: boolean;
    approvalReason?: string;
    checks: PolicyCheck[];
  };
  onDecision: (decision: 'APPROVED' | 'REJECTED', transactionId: string) => void;
}

export default function ApprovalDialog({
  transactionId,
  productName,
  productPrice,
  merchantTrustTier,
  policyResult,
  onDecision,
}: ApprovalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to process decision');
        setLoading(false);
        return;
      }
      onDecision(decision, transactionId);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const passChecks = policyResult.checks.filter(c => c.result === 'PASS');

  return (
    <div className="glass-panel p-6 rounded-xl border border-secondary/30 mt-4 bg-surface-container-low/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
      
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-secondary">assignment_late</span>
        </div>
        <div>
          <div className="font-headline-sm text-on-surface text-lg">Approval Required</div>
          <div className="font-body-main text-on-surface-variant text-sm mt-1">
            {policyResult.approvalReason || 'This purchase requires your authorization'}
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest/50 rounded-lg p-4 border border-outline-variant/10 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="font-headline-sm text-on-surface text-base mb-1">{productName}</div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-surface-variant/50 text-on-surface-variant border border-outline-variant/20">{merchantTrustTier}</span>
          </div>
        </div>
        <div className="font-tabular-data text-primary text-xl">
          ₹{productPrice.toLocaleString('en-IN')}
        </div>
      </div>

      {passChecks.length > 0 && (
        <div className="mb-6">
          <div className="font-label-micro text-label-micro text-on-surface-variant uppercase mb-3">All policy checks passed:</div>
          <div className="space-y-2">
            {passChecks.map((check, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4ade80] text-[16px]">check_circle</span>
                <span className="font-body-main text-sm text-on-surface-variant">{check.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="p-3 mb-4 rounded bg-error/10 text-error border border-error/20 text-sm">{error}</div>}

      <div className="flex gap-3 mt-6">
        <button
          id="approve-btn"
          className="flex-1 py-3 px-4 rounded font-label-micro text-label-micro uppercase tracking-widest bg-primary-container text-on-primary-container hover:bg-primary transition-colors flex items-center justify-center gap-2"
          onClick={() => handleDecision('APPROVED')}
          disabled={loading}
        >
          {loading ? <span className="btn-spinner border-on-primary-container" /> : <><span className="material-symbols-outlined text-[18px]">check</span> Approve Purchase</>}
        </button>
        <button
          id="reject-btn"
          className="flex-1 py-3 px-4 rounded font-label-micro text-label-micro uppercase tracking-widest bg-surface-variant text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 border border-outline-variant/20"
          onClick={() => handleDecision('REJECTED')}
          disabled={loading}
        >
          <span className="material-symbols-outlined text-[18px]">close</span> Reject
        </button>
      </div>
    </div>
  );
}
