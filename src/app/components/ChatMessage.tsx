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
    selectedProduct?: {
      id: string;
      name: string;
      description: string;
      price: number;
      currency?: string;
      rating: number;
      deliveryDays: number;
      merchantTrustTier: string;
      category: string;
      tags: string[];
      attributes: Record<string, string>;
      stock: number;
    };
    ranking?: {
      selectedProductId: string;
      confidenceScore: number;
      reasons: Array<{ factor: string; explanation: string; satisfied: boolean }>;
      alternatives: Array<{
        productId: string;
        reason: string;
        score: number;
        product?: {
          id: string;
          name: string;
          price: number;
          rating: number;
          deliveryDays: number;
          description: string;
          merchantTrustTier: string;
          category: string;
          tags: string[];
          attributes: Record<string, string>;
          stock: number;
          currency?: string;
        } | null;
      }>;
      summary: string;
    };
    products?: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      currency?: string;
      rating: number;
      deliveryDays: number;
      merchantTrustTier: string;
      category: string;
      tags: string[];
      attributes: Record<string, string>;
      stock: number;
    }>;
    policyResult?: PolicyResult;
    requiresApproval?: boolean;
    searchRelaxed?: boolean;
    merchantRecommendations?: {
      crossSells: Array<{
        productId: string;
        productName: string;
        price: number;
        type: 'CROSS_SELL';
        reason: string;
        isOptional: true;
      }>;
      upsells: Array<{
        productId: string;
        productName: string;
        price: number;
        type: 'UPSELL';
        reason: string;
        isOptional: true;
      }>;
      bundles: Array<{
        productId: string;
        productName: string;
        price: number;
        type: 'BUNDLE';
        reason: string;
        isOptional: true;
      }>;
      contextualOffer: {
        productId: string;
        productName: string;
        price: number;
        type: 'CONTEXTUAL_OFFER';
        reason: string;
        isOptional: true;
      } | null;
      summary: string;
    } | null;
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
      <div className="chat-message chat-message-user">
        <div className="message-avatar message-avatar-user">You</div>
        <div className="message-content">
          <p className="message-text">{content}</p>
          {timestamp && <span className="message-time">{timestamp}</span>}
        </div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="chat-message chat-message-error">
        <div className="message-avatar message-avatar-error">!</div>
        <div className="message-content">
          <p className="message-text message-error-text">{content}</p>
          {timestamp && <span className="message-time">{timestamp}</span>}
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

  // AI message
  return (
    <div className="chat-message chat-message-ai">
      <div className="message-avatar message-avatar-ai">AI</div>
      <div className="message-content message-content-ai">

        {/* ── Section 1: Intent ── */}
        {shopResult?.intent && (
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-icon">🧠</span>
              <span className="section-card-title">Intent</span>
            </div>
            <div className="intent-chips">
              <span className="intent-chip">📦 {shopResult.intent.category}</span>
              {shopResult.intent.maximumPrice && (
                <span className="intent-chip">💰 ≤ ₹{shopResult.intent.maximumPrice.toLocaleString('en-IN')}</span>
              )}
              {shopResult.intent.deliveryDeadline && (
                <span className="intent-chip">🚚 ≤ {shopResult.intent.deliveryDeadline} days</span>
              )}
              {shopResult.intent.requiredAttributes.map((attr, i) => (
                <span key={i} className="intent-chip">🔍 {attr}</span>
              ))}
            </div>
          </div>
        )}

        {shopResult?.searchRelaxed && (
          <div className="search-relaxed-notice">
            ℹ️ Broadened search to find more options
          </div>
        )}

        {/* Ambiguity questions */}
        {shopResult?.intent?.ambiguityQuestions && shopResult.intent.ambiguityQuestions.length > 0 && (
          <div className="ambiguity-section">
            <span className="ambiguity-label">💡 I could help more if you specify:</span>
            <ul className="ambiguity-list">
              {shopResult.intent.ambiguityQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {/* No products found */}
        {shopResult && (!shopResult.products || shopResult.products.length === 0) && (
          <div className="no-products-message">
            <span className="no-products-icon">🔍</span>
            <p>{content || 'No products found matching your criteria. Try broadening your search.'}</p>
          </div>
        )}

        {/* ── Section 2: AI Recommendation ── */}
        {shopResult?.ranking && (
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-icon">🎯</span>
              <span className="section-card-title">AI Recommendation</span>
            </div>
            <RankingExplanation
              summary={shopResult.ranking.summary}
              confidenceScore={shopResult.ranking.confidenceScore}
              reasons={shopResult.ranking.reasons}
              alternatives={shopResult.ranking.alternatives}
            />
          </div>
        )}

        {/* Selected product */}
        {shopResult?.selectedProduct && (
          <ProductCard
            product={shopResult.selectedProduct}
            isRecommended={true}
          />
        )}

        {/* ── Negotiation Panel (Phase 9) ── */}
        {shopResult?.negotiationResult && shopResult.selectedProduct && (
          <NegotiationPanel
            negotiationResult={shopResult.negotiationResult}
            productName={shopResult.selectedProduct.name}
          />
        )}

        {/* ── Merchant Recommendations (optional, Phase 8) ── */}
        {shopResult?.merchantRecommendations && (
          <MerchantRecommendations recommendations={shopResult.merchantRecommendations as Parameters<typeof MerchantRecommendations>[0]['recommendations']} />
        )}

        {/* ── Section 3: Policy ── */}
        {shopResult?.policyResult && (
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-icon">🛡️</span>
              <span className="section-card-title">Policy</span>
            </div>
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
          <ApprovalDialog
            transactionId={shopResult.transactionId}
            productName={shopResult.selectedProduct.name}
            productPrice={shopResult.selectedProduct.price}
            merchantTrustTier={shopResult.selectedProduct.merchantTrustTier}
            policyResult={shopResult.policyResult}
            onDecision={handleApprovalDecision}
          />
        )}

        {/* ── Section 4: Payment ── */}
        {isPayable &&
          shopResult?.transactionId &&
          shopResult?.selectedProduct && (
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-icon">💳</span>
              <span className="section-card-title">Payment</span>
            </div>
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
          <PaymentReceipt
            transactionId={shopResult.transactionId}
            productName={shopResult.selectedProduct.name}
            productPrice={shopResult.selectedProduct.price}
            razorpayPaymentId={paymentResult.razorpayPaymentId || ''}
            razorpayOrderId={paymentResult.razorpayOrderId || ''}
          />
        )}

        {/* Payment Failed banner */}
        {isPaymentFailed && (
          <div className="authorization-blocked">
            <span>❌</span>
            <div>
              <div className="authorization-title">Payment Failed</div>
              <div className="authorization-subtitle">The payment could not be verified. Please try again.</div>
            </div>
          </div>
        )}

        {/* Blocked banner */}
        {isBlocked && shopResult?.policyResult?.overall === 'PASS' && currentState === 'BLOCKED' && (
          <div className="authorization-blocked">
            <span>🚫</span>
            <div>
              <div className="authorization-title">Purchase Rejected</div>
              <div className="authorization-subtitle">This transaction has been cancelled</div>
            </div>
          </div>
        )}

        {/* Alternative products */}
        {shopResult?.ranking?.alternatives && shopResult.ranking.alternatives.length > 0 && !isBlocked && (
          <div className="alternatives-section">
            <h4 className="alternatives-title">Also considered:</h4>
            {shopResult.ranking.alternatives.slice(0, 3).map((alt, i) => (
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
        )}

        {/* ── Section 5: Audit Trail ── */}
        {hasTransaction && (isTerminal || showAuditTrail) && (
          <div className="section-card section-card-audit">
            <IncidentTimeline
              transactionId={shopResult!.transactionId!}
              autoRefresh={!isTerminal}
              title="Audit Trail"
            />
          </div>
        )}

        {hasTransaction && !isTerminal && !showAuditTrail && (
          <button
            className="audit-trail-toggle-btn"
            onClick={() => setShowAuditTrail(true)}
          >
            📋 Show Audit Trail
          </button>
        )}

        {/* Fallback text */}
        {!shopResult && <p className="message-text">{content}</p>}

        {timestamp && <span className="message-time">{timestamp}</span>}
      </div>
    </div>
  );
}
