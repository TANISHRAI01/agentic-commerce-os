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
    <div className="approval-dialog">
      <div className="approval-dialog-header">
        <span className="approval-dialog-icon">📋</span>
        <div>
          <div className="approval-dialog-title">Approval Required</div>
          <div className="approval-dialog-subtitle">
            {policyResult.approvalReason || 'This purchase requires your authorization'}
          </div>
        </div>
      </div>

      <div className="approval-product-summary">
        <div className="approval-product-name">{productName}</div>
        <div className="approval-product-price">
          ₹{productPrice.toLocaleString('en-IN')}
        </div>
        <div className="approval-product-meta">
          <span className={`trust-badge trust-${merchantTrustTier.toLowerCase()}`}>
            {merchantTrustTier}
          </span>
        </div>
      </div>

      <div className="approval-policy-summary">
        <div className="approval-policy-title">All policy checks passed:</div>
        {passChecks.map((check, i) => (
          <div key={i} className="approval-policy-row">
            <span className="approval-policy-check-pass">✓</span>
            <span>{check.reason}</span>
          </div>
        ))}
      </div>

      {error && <div className="approval-error">{error}</div>}

      <div className="approval-actions">
        <button
          id="approve-btn"
          className="approval-btn approval-btn-approve"
          onClick={() => handleDecision('APPROVED')}
          disabled={loading}
        >
          {loading ? <span className="btn-spinner" /> : '✓ Approve Purchase'}
        </button>
        <button
          id="reject-btn"
          className="approval-btn approval-btn-reject"
          onClick={() => handleDecision('REJECTED')}
          disabled={loading}
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
}
