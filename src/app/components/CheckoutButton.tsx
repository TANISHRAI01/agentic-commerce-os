'use client';

import React, { useRef, useState } from 'react';
import IncidentTimeline from './IncidentTimeline';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface CheckoutButtonProps {
  transactionId: string;
  productName: string;
  productPrice: number;
  merchantTrustTier: string;
  onPaymentComplete: (result: {
    success: boolean;
    transactionState: string;
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
  }) => void;
}

type CheckoutState =
  | 'idle'
  | 'creating_order'
  | 'checkout_open'
  | 'verifying'
  | 'success'
  | 'failed'
  | 'unknown'      // PAYMENT_UNKNOWN — recovery required
  | 'recovering'   // calling /api/payment/recover
  | 'error';

export default function CheckoutButton({
  transactionId,
  productName,
  productPrice,
  merchantTrustTier,
  onPaymentComplete,
}: CheckoutButtonProps) {
  const [state, setState] = useState<CheckoutState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showTimeline, setShowTimeline] = useState(false);

  // Track if the Razorpay handler fired (payment completion callback)
  const handlerFiredRef = useRef(false);

  const handleCheckout = async () => {
    setState('creating_order');
    setErrorMessage('');
    handlerFiredRef.current = false;

    try {
      // ── Step 1: Create Razorpay order via backend ──
      const orderRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        // Server returned CALL_RECOVER — transition to unknown UI
        if (orderData.action === 'CALL_RECOVER') {
          setState('unknown');
          setShowTimeline(true);
          return;
        }
        throw new Error(orderData.details || orderData.error || 'Failed to create order');
      }

      // ── Step 2: Open Razorpay Standard Checkout ──
      if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay SDK not loaded. Please refresh the page.');
      }

      setState('checkout_open');

      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Agentic Commerce OS',
        description: `Purchase: ${productName}`,
        order_id: orderData.razorpayOrderId,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          handlerFiredRef.current = true;
          // ── Step 3: Verify payment server-side ──
          setState('verifying');

          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transactionId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.verified) {
              setState('success');
              setShowTimeline(true);
              onPaymentComplete({
                success: true,
                transactionState: 'COMPLETED',
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
              });
            } else {
              setState('failed');
              setErrorMessage(verifyData.message || 'Payment verification failed');
              onPaymentComplete({ success: false, transactionState: 'PAYMENT_FAILED' });
            }
          } catch {
            // Verification network error — state is now unknown
            setState('unknown');
            setShowTimeline(true);
            onPaymentComplete({ success: false, transactionState: 'PAYMENT_UNKNOWN' });
          }
        },
        modal: {
          ondismiss: async function () {
            // If handler never fired, the user closed the modal without paying
            // The server may be in PAYMENT_PENDING. Check and potentially go to unknown.
            if (!handlerFiredRef.current) {
              // Poll current state
              try {
                const statusRes = await fetch(`/api/payment/status?transactionId=${transactionId}`);
                const statusData = await statusRes.json();
                if (statusData.state === 'PAYMENT_PENDING') {
                  // The order was created but never confirmed or failed
                  // We must NOT silently stay idle — mark as unknown so user must verify
                  setState('unknown');
                  setShowTimeline(true);
                } else {
                  setState('idle');
                }
              } catch {
                setState('idle');
              }
            }
          },
          confirm_close: true,
        },
        prefill: {
          name: 'Test User',
          email: 'test@example.com',
          contact: '9999999999',
        },
        theme: { color: '#6366f1' },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (response: any) {
        handlerFiredRef.current = true;
        setState('failed');
        const reason = response?.error?.description || 'Payment failed';
        setErrorMessage(reason);
        onPaymentComplete({ success: false, transactionState: 'PAYMENT_FAILED' });
      });

      rzp.open();
    } catch (err: any) {
      setState('error');
      setErrorMessage(err.message || 'An error occurred');
    }
  };

  const handleRecover = async () => {
    setState('recovering');
    try {
      const res = await fetch('/api/payment/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });
      const data = await res.json();

      if (data.outcome === 'SUCCESS') {
        setState('success');
        onPaymentComplete({ success: true, transactionState: 'COMPLETED' });
      } else if (data.outcome === 'FAILED') {
        setState('failed');
        setErrorMessage('Payment was not completed. Please try again.');
        onPaymentComplete({ success: false, transactionState: 'PAYMENT_FAILED' });
      } else {
        // STILL_UNKNOWN
        setState('unknown');
        setErrorMessage('Payment provider is still unreachable. Do not retry payment.');
      }
    } catch {
      setState('unknown');
      setErrorMessage('Network error during recovery check.');
    }
  };

  if (state === 'success') {
    return (
      <div className="checkout-section">
        {showTimeline && (
          <IncidentTimeline
            transactionId={transactionId}
            title="Payment Incident Timeline"
          />
        )}
      </div>
    );
  }

  return (
    <div className="checkout-section">
      {/* Order Summary */}
      <div className="checkout-summary">
        <div className="checkout-summary-header">
          <span className="checkout-summary-icon">🛒</span>
          <span className="checkout-summary-title">Order Summary</span>
        </div>
        <div className="checkout-summary-row">
          <span>{productName}</span>
          <span className="checkout-summary-price">₹{productPrice.toLocaleString('en-IN')}</span>
        </div>
        <div className="checkout-summary-row checkout-summary-trust">
          <span>Merchant</span>
          <span className={`trust-badge trust-${merchantTrustTier.toLowerCase()}`}>
            {merchantTrustTier}
          </span>
        </div>
        <div className="checkout-summary-divider" />
        <div className="checkout-summary-row checkout-summary-total">
          <span>Total</span>
          <span>₹{productPrice.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Unknown State — Recovery Required */}
      {state === 'unknown' && (
        <div className="checkout-unknown">
          <div className="checkout-unknown-header">
            <span>⏱️</span>
            <div>
              <div className="checkout-unknown-title">Payment Status Unknown</div>
              <div className="checkout-unknown-desc">
                Confirmation was not received. <strong>Automatic retry is blocked.</strong> Verify the payment status before proceeding.
              </div>
            </div>
          </div>
          {errorMessage && (
            <div className="checkout-unknown-error">{errorMessage}</div>
          )}
          <button
            className="checkout-recover-btn"
            onClick={handleRecover}
          >
            🔍 Verify Payment Status
          </button>
          {showTimeline && (
            <IncidentTimeline
              transactionId={transactionId}
              title="Incident Timeline"
            />
          )}
        </div>
      )}

      {/* Recovering State */}
      {state === 'recovering' && (
        <div className="checkout-recovering">
          <span className="btn-spinner" />
          <span>Checking payment status with provider…</span>
          {showTimeline && (
            <IncidentTimeline
              transactionId={transactionId}
              title="Incident Timeline"
            />
          )}
        </div>
      )}

      {/* Normal Pay Button (idle / creating / checkout open / verifying) */}
      {state !== 'unknown' && state !== 'recovering' && (
        <>
          <button
            className={`checkout-button ${state !== 'idle' ? 'checkout-button-loading' : ''}`}
            onClick={handleCheckout}
            disabled={state !== 'idle'}
          >
            {state === 'idle' && (
              <>
                <span className="checkout-button-icon">💳</span>
                <span>Pay ₹{productPrice.toLocaleString('en-IN')} with Razorpay</span>
              </>
            )}
            {state === 'creating_order' && (
              <><span className="btn-spinner" /><span>Creating order...</span></>
            )}
            {state === 'checkout_open' && (
              <><span className="btn-spinner" /><span>Waiting for payment...</span></>
            )}
            {state === 'verifying' && (
              <><span className="btn-spinner" /><span>Verifying payment...</span></>
            )}
          </button>

          {/* Test Mode Notice */}
          <div className="checkout-test-notice">
            🧪 <strong>TEST MODE</strong> — Use card 4111 1111 1111 1111, any future expiry, any CVV
          </div>

          {/* Error / Failed State */}
          {(state === 'failed' || state === 'error') && (
            <div className="checkout-error">
              <span>❌</span>
              <div>
                <div className="checkout-error-title">
                  {state === 'failed' ? 'Payment Failed' : 'Error'}
                </div>
                <div className="checkout-error-message">{errorMessage}</div>
              </div>
              <button
                className="checkout-retry-btn"
                onClick={() => { setState('idle'); setErrorMessage(''); }}
              >
                Retry
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
