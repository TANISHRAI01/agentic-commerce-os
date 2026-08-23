'use client';

import React from 'react';

interface PaymentReceiptProps {
  transactionId: string;
  productName: string;
  productPrice: number;
  razorpayPaymentId: string;
  razorpayOrderId: string;
}

export default function PaymentReceipt({
  transactionId,
  productName,
  productPrice,
  razorpayPaymentId,
  razorpayOrderId,
}: PaymentReceiptProps) {
  return (
    <div className="payment-receipt">
      <div className="receipt-header">
        <div className="receipt-success-icon">✅</div>
        <div className="receipt-title">Payment Successful</div>
        <div className="receipt-subtitle">Your purchase has been verified and completed</div>
      </div>

      <div className="receipt-body">
        <div className="receipt-row">
          <span className="receipt-label">Product</span>
          <span className="receipt-value">{productName}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-label">Amount</span>
          <span className="receipt-value receipt-amount">₹{productPrice.toLocaleString('en-IN')}</span>
        </div>
        <div className="receipt-divider" />
        <div className="receipt-row">
          <span className="receipt-label">Transaction ID</span>
          <span className="receipt-value receipt-mono">{transactionId.slice(0, 8)}...</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-label">Razorpay Order</span>
          <span className="receipt-value receipt-mono">{razorpayOrderId}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-label">Payment ID</span>
          <span className="receipt-value receipt-mono">{razorpayPaymentId}</span>
        </div>
        <div className="receipt-divider" />
        <div className="receipt-row">
          <span className="receipt-label">Status</span>
          <span className="receipt-value receipt-verified">
            <span className="receipt-verified-dot" />
            Verified & Completed
          </span>
        </div>
        <div className="receipt-row">
          <span className="receipt-label">Time</span>
          <span className="receipt-value">{new Date().toLocaleString()}</span>
        </div>
      </div>

      <div className="receipt-footer">
        🧪 TEST MODE — No real money was charged
      </div>
    </div>
  );
}
