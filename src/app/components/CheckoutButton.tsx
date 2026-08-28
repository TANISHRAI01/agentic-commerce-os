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
  | 'unknown'
  | 'recovering'
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
  const handlerFiredRef = useRef(false);

  const handleCheckout = async () => {
    setState('creating_order');
    setErrorMessage('');
    handlerFiredRef.current = false;

    try {
      const orderRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        if (orderData.action === 'CALL_RECOVER') {
          setState('unknown');
          setShowTimeline(true);
          return;
        }
        throw new Error(orderData.details || orderData.error || 'Failed to create order');
      }

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
        handler: async function (response: any) {
          handlerFiredRef.current = true;
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
            setState('unknown');
            setShowTimeline(true);
            onPaymentComplete({ success: false, transactionState: 'PAYMENT_UNKNOWN' });
          }
        },
        modal: {
          ondismiss: async function () {
            if (!handlerFiredRef.current) {
              try {
                const statusRes = await fetch(`/api/payment/status?transactionId=${transactionId}`);
                const statusData = await statusRes.json();
                if (statusData.state === 'PAYMENT_PENDING') {
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
      <div className="mt-4">
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
    <div className="mt-4">
      {/* Unknown State — Recovery Required */}
      {state === 'unknown' && (
        <div className="rounded-xl border border-warning/30 bg-[#352500]/40 p-5 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-warning text-2xl">timer</span>
            <div>
              <div className="font-headline-sm text-on-surface">Payment Status Unknown</div>
              <div className="font-body-main text-on-surface-variant text-sm mt-1">
                Confirmation was not received. <strong>Automatic retry is blocked.</strong> Verify the payment status before proceeding.
              </div>
            </div>
          </div>
          {errorMessage && (
            <div className="bg-error-container/20 border border-error/30 text-error p-3 rounded mb-3 text-sm">
              {errorMessage}
            </div>
          )}
          <button
            className="bg-warning text-[#352500] hover:bg-warning/80 transition-colors font-label-micro text-label-micro uppercase px-4 py-2 rounded-lg"
            onClick={handleRecover}
          >
            🔍 Verify Payment Status
          </button>
          {showTimeline && (
            <div className="mt-4"><IncidentTimeline transactionId={transactionId} title="Incident Timeline" /></div>
          )}
        </div>
      )}

      {/* Recovering State */}
      {state === 'recovering' && (
        <div className="rounded-xl border border-warning/30 bg-[#352500]/40 p-5 mb-4 flex items-center gap-3 text-warning">
          <span className="btn-spinner border-warning" />
          <span className="font-body-main text-sm">Checking payment status with provider…</span>
        </div>
      )}

      {/* Normal Pay Button (idle / creating / checkout open / verifying) */}
      {state !== 'unknown' && state !== 'recovering' && (
        <>
          <button
            className="w-full glass-panel bg-primary/10 hover:bg-primary/20 transition-all duration-300 rounded-xl p-5 flex items-center justify-between group border-primary/30"
            onClick={handleCheckout}
            disabled={state !== 'idle'}
          >
            <div className="flex flex-col items-start text-left">
              <span className="font-headline-sm text-headline-sm text-primary group-hover:text-primary-fixed transition-colors">
                {state === 'idle' ? 'Settle Payment' : 
                 state === 'creating_order' ? 'Creating Order...' :
                 state === 'checkout_open' ? 'Waiting for Payment...' :
                 state === 'verifying' ? 'Verifying Payment...' : 'Processing...'}
              </span>
              <span className="font-body-main text-body-main text-on-surface-variant text-sm mt-1">
                {state === 'idle' ? `₹${productPrice.toLocaleString('en-IN')} with Razorpay` : 'Please do not close this window'}
              </span>
            </div>
            
            <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              {state === 'idle' ? (
                <span className="material-symbols-outlined">arrow_forward</span>
              ) : (
                <span className="btn-spinner border-on-primary" />
              )}
            </div>
          </button>

          {/* Test Mode Notice */}
          <div className="mt-3 flex items-center gap-2 bg-[#1f1f25]/50 border border-outline-variant/10 rounded-lg p-2.5">
            <span className="material-symbols-outlined text-outline-variant text-[16px]">science</span>
            <span className="font-body-main text-on-surface-variant text-xs">
              <strong>TEST MODE</strong> — Use card 4111 1111 1111 1111, any future expiry, any CVV
            </span>
          </div>

          {/* Error / Failed State */}
          {(state === 'failed' || state === 'error') && (
            <div className="rounded-xl border border-error/30 bg-[#351000]/40 p-4 mt-4 flex items-start gap-4">
              <span className="material-symbols-outlined text-error text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              <div className="flex-1">
                <div className="font-headline-sm text-on-surface">
                  {state === 'failed' ? 'Payment Failed' : 'Error'}
                </div>
                <div className="font-body-main text-on-surface-variant text-sm mt-1">{errorMessage}</div>
              </div>
              <button
                className="font-label-micro text-label-micro text-primary uppercase hover:bg-primary/10 px-3 py-1.5 rounded transition-colors"
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
