'use client';

import React, { useState } from 'react';
import ProductCard from './ProductCard';
import RankingExplanation from './RankingExplanation';
import PolicyPanel from './PolicyPanel';
import ApprovalDialog from './ApprovalDialog';
import CheckoutButton from './CheckoutButton';
import PaymentReceipt from './PaymentReceipt';

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
  };
}

export default function ChatMessage({ type, content, timestamp, shopResult }: ChatMessageProps) {
  const [transactionState, setTransactionState] = useState(shopResult?.transactionState ?? '');
  const [paymentResult, setPaymentResult] = useState<{
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
  } | null>(null);

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

  // AI message
  return (
    <div className="chat-message chat-message-ai">
      <div className="message-avatar message-avatar-ai">AI</div>
      <div className="message-content message-content-ai">
        {/* Intent summary */}
        {shopResult?.intent && (
          <div className="intent-summary">
            <span className="intent-label">Understood:</span>
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

        {/* Ranking explanation */}
        {shopResult?.ranking && (
          <RankingExplanation
            summary={shopResult.ranking.summary}
            confidenceScore={shopResult.ranking.confidenceScore}
            reasons={shopResult.ranking.reasons}
            alternatives={shopResult.ranking.alternatives}
          />
        )}

        {/* Selected product */}
        {shopResult?.selectedProduct && (
          <ProductCard
            product={shopResult.selectedProduct}
            isRecommended={true}
          />
        )}

        {/* Policy Panel */}
        {shopResult?.policyResult && (
          <PolicyPanel
            policyResult={shopResult.policyResult}
            transactionState={currentState}
          />
        )}

        {/* Approval Dialog — only when awaiting approval */}
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

        {/* Checkout Button — when approved and ready for payment */}
        {isPayable &&
          shopResult?.transactionId &&
          shopResult?.selectedProduct && (
          <CheckoutButton
            transactionId={shopResult.transactionId}
            productName={shopResult.selectedProduct.name}
            productPrice={shopResult.selectedProduct.price}
            merchantTrustTier={shopResult.selectedProduct.merchantTrustTier}
            onPaymentComplete={handlePaymentComplete}
          />
        )}

        {/* Payment Receipt — after successful payment */}
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

        {/* Fallback text */}
        {!shopResult && <p className="message-text">{content}</p>}

        {timestamp && <span className="message-time">{timestamp}</span>}
      </div>
    </div>
  );
}
