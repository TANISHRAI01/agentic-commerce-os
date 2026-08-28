'use client';

import React, { useState } from 'react';
import ProductCard from './ProductCard';
import RankingExplanation from './RankingExplanation';
import PolicyPanel from './PolicyPanel';
import ApprovalDialog from './ApprovalDialog';
import CheckoutButton from './CheckoutButton';
import PaymentReceipt from './PaymentReceipt';
import IncidentTimeline from './IncidentTimeline';
import MerchantRecommendations from './MerchantRecommendations';
import NegotiationPanel from './NegotiationPanel';
import type { NegotiationResult } from '@/types/negotiation';

interface PolicyCheck {
  name: string;
  result: 'PASS' | 'FAIL';
  reason: string;
  details: { actual: number | string; limit: number | string };
}

interface PolicyResult {
  overall: 'PASS' | 'FAIL';
  requiresApproval: boolean;
  approvalReason?: string;
  checks: PolicyCheck[];
}

interface ChatMessageProps {
  type: 'user' | 'ai' | 'error';
  content: string;
  timestamp?: string;
  shopResult?: {
    transactionId?: string;
    transactionState?: string;
    intent?: {
      category: string;
      maximumPrice?: number;
      deliveryDeadline?: number;
      requiredAttributes: string[];
      ambiguityQuestions: string[];
    };
    selectedProduct?: any;
    ranking?: any;
    products?: any[];
    policyResult?: PolicyResult;
    requiresApproval?: boolean;
    searchRelaxed?: boolean;
    merchantRecommendations?: any;
    negotiationResult?: NegotiationResult | null;
  };
}

export default function ChatMessage({ type, content, timestamp, shopResult }: ChatMessageProps) {
  const [transactionState, setTransactionState] = useState(shopResult?.transactionState ?? '');
  const [paymentResult, setPaymentResult] = useState<{
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
  } | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  const handleApprovalDecision = (decision: 'APPROVED' | 'REJECTED') => {
    setTransactionState(decision === 'APPROVED' ? 'APPROVED' : 'BLOCKED');
  };

  const handlePaymentComplete = (result: {
    success: boolean;
    transactionState: string;
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
  }) => {
    setTransactionState(result.transactionState);
    if (result.success) {
      setPaymentResult({
        razorpayPaymentId: result.razorpayPaymentId,
        razorpayOrderId: result.razorpayOrderId,
      });
    }
  };

  if (type === 'user') {
    return (
      <div className="flex flex-col items-end gap-2 w-full mt-8">
        <div className="flex items-center gap-2 mb-1 opacity-60">
          <span className="font-tabular-data text-tabular-data text-on-surface-variant">USR_REQ</span>
          {timestamp && <span className="font-tabular-data text-tabular-data text-on-surface-variant text-[10px]">{timestamp}</span>}
        </div>
        <div className="bg-surface-container border border-outline-variant/20 rounded-xl rounded-tr-sm p-4 max-w-[85%]">
          <p className="font-body-main text-body-main text-on-surface">{content}</p>
        </div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="flex flex-col items-start gap-2 w-full mt-8">
        <div className="flex items-center gap-2 mb-1 opacity-60">
          <span className="material-symbols-outlined text-[16px] text-error">error</span>
          <span className="font-tabular-data text-tabular-data text-error">SYS_ERR</span>
          {timestamp && <span className="font-tabular-data text-tabular-data text-on-surface-variant text-[10px]">{timestamp}</span>}
        </div>
        <div className="bg-error-container/20 border border-error/30 rounded-xl rounded-tl-sm p-4 max-w-[85%]">
          <p className="font-body-main text-body-main text-error">{content}</p>
        </div>
      </div>
    );
  }

  const currentState = transactionState || shopResult?.transactionState || '';
  const isBlocked = currentState === 'BLOCKED';
  const isPayable = currentState === 'APPROVED' || currentState === 'AUTO_APPROVED';
  const isCompleted = currentState === 'COMPLETED';
  const isPaymentFailed = currentState === 'PAYMENT_FAILED';
  const isTerminal = isCompleted || isBlocked || isPaymentFailed || currentState === 'CANCELLED';
  const hasTransaction = !!shopResult?.transactionId;

  return (
    <div className="flex flex-col gap-4 w-full mt-8">
      <div className="flex items-center gap-2 mb-1 opacity-60 pl-2">
        <span className="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
        <span className="font-tabular-data text-tabular-data text-primary">SYS_RES</span>
        {timestamp && <span className="font-tabular-data text-tabular-data text-on-surface-variant text-[10px]">{timestamp}</span>}
      </div>

      {/* ── Section 1: Intent ── */}
      {shopResult?.intent && (
        <div className="glass-panel rounded-xl p-5 border-l-2 border-l-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="font-label-micro text-label-micro text-primary uppercase tracking-widest">Intent Parsed</span>
            <div className="h-px bg-outline-variant/30 flex-1 ml-2"></div>
          </div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6">
            <div>
              <p className="font-label-micro text-label-micro text-on-surface-variant uppercase mb-1">Category</p>
              <p className="font-body-main text-body-main text-on-surface">{shopResult.intent.category}</p>
            </div>
            {shopResult.intent.maximumPrice && (
              <div>
                <p className="font-label-micro text-label-micro text-on-surface-variant uppercase mb-1">Budget Constraint</p>
                <p className="font-tabular-data text-tabular-data text-on-surface">&le; ₹{shopResult.intent.maximumPrice.toLocaleString('en-IN')}</p>
              </div>
            )}
            {shopResult.intent.deliveryDeadline && (
              <div>
                <p className="font-label-micro text-label-micro text-on-surface-variant uppercase mb-1">Delivery</p>
                <p className="font-tabular-data text-tabular-data text-on-surface">&le; {shopResult.intent.deliveryDeadline} days</p>
              </div>
            )}
            {shopResult.intent.requiredAttributes && shopResult.intent.requiredAttributes.length > 0 && (
              <div className="col-span-2 pt-2 border-t border-outline-variant/10">
                <p className="font-label-micro text-label-micro text-on-surface-variant uppercase mb-1">Required Attributes</p>
                <div className="flex flex-wrap gap-2">
                  {shopResult.intent.requiredAttributes.map((attr, i) => (
                    <div key={i} className="inline-flex items-center gap-1.5 bg-secondary-container/20 border border-secondary-container/40 rounded-full px-2 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                      <span className="font-label-micro text-label-micro text-secondary uppercase">{attr}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {shopResult?.searchRelaxed && (
        <div className="rounded-xl border border-warning/30 bg-warning-bg/40 flex items-center p-3 gap-3">
          <span className="material-symbols-outlined text-warning" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
          <p className="font-body-main text-body-main text-warning text-sm">Broadened search to find more options</p>
        </div>
      )}

      {shopResult?.intent?.ambiguityQuestions && shopResult.intent.ambiguityQuestions.length > 0 && (
        <div className="rounded-xl border border-info/30 bg-info-bg/40 p-4">
          <span className="font-label-micro text-label-micro text-info uppercase tracking-widest mb-2 block">I could help more if you specify:</span>
          <ul className="list-none space-y-1 mt-2">
            {shopResult.intent.ambiguityQuestions.map((q, i) => (
              <li key={i} className="font-body-main text-body-main text-on-surface-variant flex gap-2"><span className="text-info">→</span> {q}</li>
            ))}
          </ul>
        </div>
      )}

      {shopResult && (!shopResult.products || shopResult.products.length === 0) && (
        <div className="glass-panel rounded-xl p-5 border-l-2 border-l-outline text-center">
          <span className="material-symbols-outlined text-outline text-3xl mb-2">search_off</span>
          <p className="font-body-main text-on-surface">{content || 'No products found matching your criteria. Try broadening your search.'}</p>
        </div>
      )}

      {/* ── Section 2: AI Recommendation ── */}
      {shopResult?.ranking && (
        <div className="glass-panel rounded-xl p-5 border-l-2 border-l-tertiary mt-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-label-micro text-label-micro text-tertiary uppercase tracking-widest">AI Recommendation</span>
            <div className="h-px bg-outline-variant/30 flex-1 ml-2"></div>
          </div>
          <RankingExplanation
            summary={shopResult.ranking.summary}
            confidenceScore={shopResult.ranking.confidenceScore}
            reasons={shopResult.ranking.reasons}
            alternatives={shopResult.ranking.alternatives}
          />
          {shopResult?.selectedProduct && (
            <div className="mt-4">
              <ProductCard
                product={shopResult.selectedProduct}
                isRecommended={true}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Negotiation Panel (Phase 9) ── */}
      {shopResult?.negotiationResult && shopResult.selectedProduct && (
        <div className="mt-2">
          <NegotiationPanel
            negotiationResult={shopResult.negotiationResult}
            productName={shopResult.selectedProduct.name}
          />
        </div>
      )}

      {/* ── Merchant Recommendations (optional, Phase 8) ── */}
      {shopResult?.merchantRecommendations && (
        <div className="mt-2">
          <MerchantRecommendations recommendations={shopResult.merchantRecommendations as any} />
        </div>
      )}

      {/* ── Section 3: Policy ── */}
      {shopResult?.policyResult && (
        <div className="mt-2">
          <PolicyPanel
            policyResult={shopResult.policyResult}
            transactionState={currentState}
          />
        </div>
      )}

      {/* Approval Dialog */}
      {shopResult?.requiresApproval &&
        shopResult?.transactionId &&
        shopResult?.selectedProduct &&
        shopResult?.policyResult &&
        currentState === 'APPROVAL_REQUIRED' && (
        <div className="mt-2">
          <ApprovalDialog
            transactionId={shopResult.transactionId}
            productName={shopResult.selectedProduct.name}
            productPrice={shopResult.selectedProduct.price}
            merchantTrustTier={shopResult.selectedProduct.merchantTrustTier}
            policyResult={shopResult.policyResult}
            onDecision={handleApprovalDecision}
          />
        </div>
      )}

      {/* ── Section 4: Payment ── */}
      {isPayable &&
        shopResult?.transactionId &&
        shopResult?.selectedProduct && (
        <div className="mt-2">
          <CheckoutButton
            transactionId={shopResult.transactionId}
            productName={shopResult.selectedProduct.name}
            productPrice={shopResult.selectedProduct.price}
            merchantTrustTier={shopResult.selectedProduct.merchantTrustTier}
            onPaymentComplete={handlePaymentComplete}
          />
        </div>
      )}

      {/* Payment Receipt */}
      {isCompleted &&
        shopResult?.transactionId &&
        shopResult?.selectedProduct &&
        paymentResult && (
        <div className="mt-2">
          <PaymentReceipt
            transactionId={shopResult.transactionId}
            productName={shopResult.selectedProduct.name}
            productPrice={shopResult.selectedProduct.price}
            razorpayPaymentId={paymentResult.razorpayPaymentId || ''}
            razorpayOrderId={paymentResult.razorpayOrderId || ''}
          />
        </div>
      )}

      {/* Payment Failed banner */}
      {isPaymentFailed && (
        <div className="rounded-xl border border-error/30 bg-[#351000]/40 flex items-center p-4 gap-4 mt-2">
          <span className="material-symbols-outlined text-error text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <div>
            <div className="font-headline-sm text-on-surface">Payment Failed</div>
            <div className="font-body-main text-on-surface-variant text-sm">The payment could not be verified. Please try again.</div>
          </div>
        </div>
      )}

      {/* Blocked banner */}
      {isBlocked && shopResult?.policyResult?.overall === 'PASS' && currentState === 'BLOCKED' && (
        <div className="rounded-xl border border-error/30 bg-[#351000]/40 flex items-center p-4 gap-4 mt-2">
          <span className="material-symbols-outlined text-error text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
          <div>
            <div className="font-headline-sm text-on-surface">Purchase Rejected</div>
            <div className="font-body-main text-on-surface-variant text-sm">This transaction has been cancelled</div>
          </div>
        </div>
      )}

      {/* Alternative products */}
      {shopResult?.ranking?.alternatives && shopResult.ranking.alternatives.length > 0 && !isBlocked && (
        <div className="mt-4 border-t border-outline-variant/20 pt-4">
          <h4 className="font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest mb-4">Also considered:</h4>
          <div className="space-y-4">
            {shopResult.ranking.alternatives.slice(0, 3).map((alt: any, i: number) => (
              alt.product && (
                <ProductCard
                  key={i}
                  product={alt.product}
                  isRecommended={false}
                  alternativeReason={alt.reason}
                  alternativeScore={alt.score}
                />
              )
            ))}
          </div>
        </div>
      )}

      {/* ── Section 5: Audit Trail ── */}
      {hasTransaction && (isTerminal || showAuditTrail) && (
        <div className="mt-2">
          <IncidentTimeline
            transactionId={shopResult!.transactionId!}
            autoRefresh={!isTerminal}
            title="Audit Trail"
          />
        </div>
      )}

      {hasTransaction && !isTerminal && !showAuditTrail && (
        <button
          className="w-full text-center p-3 text-on-surface-variant hover:text-primary hover:bg-surface-variant/20 transition-all rounded-xl mt-2 font-label-micro text-label-micro uppercase tracking-widest"
          onClick={() => setShowAuditTrail(true)}
        >
          <span className="material-symbols-outlined align-bottom mr-1 text-[16px]">receipt_long</span>
          Show Audit Trail
        </button>
      )}

      {/* Fallback text */}
      {!shopResult && <div className="glass-panel rounded-xl p-4"><p className="font-body-main text-on-surface">{content}</p></div>}
    </div>
  );
}
